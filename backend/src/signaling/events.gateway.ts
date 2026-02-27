import {
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * WebRTC Signaling Flow:
 * ─────────────────────────────────────────────────────────
 * 1. User A joins a room → broadcasts 'user-joined' to others
 * 2. User B receives 'user-joined' → creates RTCPeerConnection
 *    → calls getUserMedia → creates SDP offer → sends 'offer'
 * 3. User A receives 'offer' → creates RTCPeerConnection
 *    → creates SDP answer → sends 'answer'
 * 4. Both sides exchange ICE candidates via 'ice-candidate'
 * 5. WebRTC direct P2P connection established 🎉
 * ─────────────────────────────────────────────────────────
 *
 * This gateway uses Socket.IO rooms to scope messages to a meeting.
 */
@WebSocketGateway({
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
    },
    namespace: '/signaling',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // Track which user is in which room: socketId -> { roomId, userId, userName }
    private participants = new Map<string, { roomId: string; userId: string; userName: string }>();

    constructor(
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    /** Validate JWT from socket handshake and attach user info */
    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token as string;
            if (!token) throw new Error('No token');
            const payload = this.jwtService.verify(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
            // Attach decoded token data to socket for later use
            (client as any).user = payload;
        } catch {
            client.disconnect();
        }
    }

    /** Clean up when a socket disconnects – notify others in the room */
    handleDisconnect(client: Socket) {
        const info = this.participants.get(client.id);
        if (info) {
            client.to(info.roomId).emit('user-left', {
                socketId: client.id,
                userId: info.userId,
                userName: info.userName,
            });
            this.participants.delete(client.id);
        }
    }

    /** Client joins a meeting room */
    @SubscribeMessage('join-room')
    handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { roomId: string; userName: string },
    ) {
        const user = (client as any).user;
        client.join(data.roomId);

        this.participants.set(client.id, {
            roomId: data.roomId,
            userId: user.sub,
            userName: data.userName,
        });

        // Tell everyone else in the room a new user joined
        client.to(data.roomId).emit('user-joined', {
            socketId: client.id,
            userId: user.sub,
            userName: data.userName,
        });

        // Send the new user a list of everyone already in the room
        const roomParticipants = Array.from(this.participants.entries())
            .filter(([sid, p]) => p.roomId === data.roomId && sid !== client.id)
            .map(([sid, p]) => ({ socketId: sid, userId: p.userId, userName: p.userName }));

        client.emit('room-participants', roomParticipants);
    }

    /** Forward SDP offer to a specific peer */
    @SubscribeMessage('offer')
    handleOffer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { targetSocketId: string; sdp: RTCSessionDescriptionInit },
    ) {
        this.server.to(data.targetSocketId).emit('offer', {
            sdp: data.sdp,
            fromSocketId: client.id,
        });
    }

    /** Forward SDP answer to a specific peer */
    @SubscribeMessage('answer')
    handleAnswer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { targetSocketId: string; sdp: RTCSessionDescriptionInit },
    ) {
        this.server.to(data.targetSocketId).emit('answer', {
            sdp: data.sdp,
            fromSocketId: client.id,
        });
    }

    /** Forward ICE candidate to a specific peer */
    @SubscribeMessage('ice-candidate')
    handleIceCandidate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { targetSocketId: string; candidate: RTCIceCandidateInit },
    ) {
        this.server.to(data.targetSocketId).emit('ice-candidate', {
            candidate: data.candidate,
            fromSocketId: client.id,
        });
    }

    /** Mute/unmute notification (host control) */
    @SubscribeMessage('notify-mute')
    handleMute(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { targetSocketId: string; muted: boolean },
    ) {
        this.server.to(data.targetSocketId).emit('force-mute', { muted: data.muted });
    }

    /** Chat message – broadcast to everyone in the room */
    @SubscribeMessage('chat-message')
    handleChatMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { roomId: string; message: string; userName: string },
    ) {
        this.server.to(data.roomId).emit('chat-message', {
            message: data.message,
            userName: data.userName,
            timestamp: new Date().toISOString(),
        });
    }

    /** Leave room explicitly */
    @SubscribeMessage('leave-room')
    handleLeaveRoom(@ConnectedSocket() client: Socket) {
        this.handleDisconnect(client);
    }
}
