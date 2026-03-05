import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

type MediaType = 'camera' | 'mic' | 'screen';

type MediaState = {
    camera: boolean;
    mic: boolean;
    screen: boolean;
};

type ParticipantInfo = {
    roomId: string;
    userId: string;
    userName: string;
    mediaState: MediaState;
};

type AuthPayload = {
    sub: string;
};

type JoinRoomPayload = {
    roomId: string;
    userName: string;
    mediaState?: MediaState;
};

type TargetPayload = {
    targetSocketId: string;
};

type OfferPayload = TargetPayload & {
    sdp: RTCSessionDescriptionInit;
};

type AnswerPayload = TargetPayload & {
    sdp: RTCSessionDescriptionInit;
};

type IcePayload = TargetPayload & {
    candidate: RTCIceCandidateInit;
};


type ChatPayload = {
    roomId?: string;
    message: string;
    userName?: string;
};

type MediaStatePayload = {
    roomId: string;
    type: MediaType;
    enabled: boolean;
};

type ScreenShareStartPayload = {
    roomId: string;
};

type ScreenShareStopPayload = {
    roomId: string;
    isCamOn: boolean;
};

type RoomState = {
    roomId: string;
    participants: Record<string, ParticipantInfo>;
    screenSharerSocketId?: string;
    createdAt: number;
};

type AuthenticatedSocket = Socket & {
    user?: AuthPayload;
};

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

    // In production, this can be swapped with a Redis-backed Store + PubSub.
    // e.g., using `redis.hgetall('room:${roomId}')`
    private readonly rooms = new Map<string, RoomState>();

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    private isDebugEnabled() {
        return this.configService.get<string>('SIGNALING_DEBUG') === 'true';
    }

    private logDebug(message: string, context?: Record<string, unknown>) {
        if (!this.isDebugEnabled()) return;
        const details = context ? ` ${JSON.stringify(context)}` : '';
        console.log(`[signaling] ${message}${details}`);
    }

    private removeParticipant(
        client: Socket,
        reason: 'disconnect' | 'leave-room',
    ) {
        // Find which room the participant is in
        let targetRoomId: string | null = null;
        let participantInfo: ParticipantInfo | null = null;

        for (const [roomId, room] of this.rooms.entries()) {
            if (room.participants[client.id]) {
                targetRoomId = roomId;
                participantInfo = room.participants[client.id];
                break;
            }
        }

        if (!targetRoomId || !participantInfo) return;

        const room = this.rooms.get(targetRoomId);
        if (room) {
            delete room.participants[client.id];

            // Clean up screen sharing status if the sharer leaves
            if (room.screenSharerSocketId === client.id) {
                room.screenSharerSocketId = undefined;
            }

            // Auto sweep empty rooms
            if (Object.keys(room.participants).length === 0) {
                this.rooms.delete(targetRoomId);
                this.logDebug('room cleaned up (empty)', { roomId: targetRoomId });
            }
        }

        if (reason === 'leave-room') {
            void client.leave(targetRoomId);
        }

        client.to(targetRoomId).emit('user-left', {
            socketId: client.id,
            userId: participantInfo.userId,
            userName: participantInfo.userName,
        });

        this.logDebug('participant removed', {
            socketId: client.id,
            roomId: targetRoomId,
            reason,
        });
    }

    private getParticipant(client: Socket, eventName: string): ParticipantInfo | null {
        for (const room of this.rooms.values()) {
            if (room.participants[client.id]) {
                return room.participants[client.id];
            }
        }
        this.logDebug('event from socket not in a room', {
            eventName,
            socketId: client.id,
        });
        return null;
    }

    private isValidTarget(
        clientId: string,
        targetSocketId: string,
        eventName: string,
    ) {
        const sender = this.getParticipant({ id: clientId } as Socket, eventName);
        const target = this.getParticipant({ id: targetSocketId } as Socket, eventName);

        if (!sender || !target) {
            this.logDebug('dropped signal due to missing participant', {
                eventName,
                fromSocketId: clientId,
                targetSocketId,
            });
            return false;
        }

        if (sender.roomId !== target.roomId) {
            this.logDebug('blocked cross-room signal', {
                eventName,
                fromSocketId: clientId,
                targetSocketId,
                senderRoom: sender.roomId,
                targetRoom: target.roomId,
            });
            return false;
        }

        return true;
    }

    handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token as string | undefined;
            if (!token) throw new Error('missing token');

            const payload = this.jwtService.verify<AuthPayload>(token, {
                secret: this.configService.get<string>('JWT_SECRET'),
            });

            (client as AuthenticatedSocket).user = payload;
            this.logDebug('socket authenticated', {
                socketId: client.id,
                userId: payload.sub,
            });
        } catch (error) {
            this.logDebug('socket auth failed', {
                socketId: client.id,
                reason: error instanceof Error ? error.message : 'unknown',
            });
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        this.removeParticipant(client, 'disconnect');
    }

    @SubscribeMessage('join-room')
    handleJoinRoom(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: JoinRoomPayload,
    ) {
        if (!data?.roomId) return;

        if (!client.user?.sub) {
            client.disconnect();
            return;
        }

        // Leaving old room keeps participant bookkeeping consistent on reconnect/join retry.
        this.removeParticipant(client, 'leave-room');
        void client.join(data.roomId);

        const participant: ParticipantInfo = {
            roomId: data.roomId,
            userId: client.user.sub,
            userName: data.userName || 'Guest',
            mediaState: data.mediaState || { camera: false, mic: false, screen: false },
        };

        // Create room if it doesn't exist
        if (!this.rooms.has(data.roomId)) {
            this.rooms.set(data.roomId, {
                roomId: data.roomId,
                participants: {},
                createdAt: Date.now()
            });
        }

        const room = this.rooms.get(data.roomId)!;

        // If joiner indicates they are sharing screen right away
        if (participant.mediaState.screen) {
            room.screenSharerSocketId = client.id;
        }

        room.participants[client.id] = participant;

        // Broadcast to rest of room
        client.to(data.roomId).emit('user-joined', {
            socketId: client.id,
            userId: participant.userId,
            userName: participant.userName,
            mediaState: participant.mediaState,
        });

        // Collect all participants for the new joiner
        const peerList = Object.entries(room.participants)
            .filter(([id]) => id !== client.id)
            .map(([id, info]) => ({
                socketId: id,
                userId: info.userId,
                userName: info.userName,
                mediaState: info.mediaState,
            }));

        // Option A: Send 'room-state' directly to the joiner. The frontend joiner then connects to everyone safely.
        client.emit('room-state', {
            participants: peerList,
            screenSharerSocketId: room.screenSharerSocketId
        });

        this.logDebug('joined room', {
            socketId: client.id,
            roomId: data.roomId,
            peersInRoom: peerList.length,
        });
    }

    @SubscribeMessage('offer')
    handleOffer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: OfferPayload,
    ) {
        if (!this.isValidTarget(client.id, data.targetSocketId, 'offer')) return;

        this.server.to(data.targetSocketId).emit('offer', {
            sdp: data.sdp,
            fromSocketId: client.id,
        });
    }

    @SubscribeMessage('answer')
    handleAnswer(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: AnswerPayload,
    ) {
        if (!this.isValidTarget(client.id, data.targetSocketId, 'answer')) return;

        this.server.to(data.targetSocketId).emit('answer', {
            sdp: data.sdp,
            fromSocketId: client.id,
        });
    }

    @SubscribeMessage('ice-candidate')
    handleIceCandidate(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: IcePayload,
    ) {
        if (!this.isValidTarget(client.id, data.targetSocketId, 'ice-candidate'))
            return;

        this.server.to(data.targetSocketId).emit('ice-candidate', {
            candidate: data.candidate,
            fromSocketId: client.id,
        });
    }


    @SubscribeMessage('chat-message')
    handleChatMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: ChatPayload,
    ) {
        const participant = this.getParticipant(client, 'chat-message');
        if (!participant) return;

        if (data.roomId && data.roomId !== participant.roomId) {
            this.logDebug('chat room mismatch', {
                socketId: client.id,
                sentRoom: data.roomId,
                actualRoom: participant.roomId,
            });
            return;
        }

        this.server.to(participant.roomId).emit('chat-message', {
            message: data.message,
            userName: participant.userName,
            timestamp: new Date().toISOString(),
        });
    }

    @SubscribeMessage('media-state-change')
    handleMediaStateChange(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: MediaStatePayload,
    ) {
        const participant = this.getParticipant(client, 'media-state-change');
        if (!participant) return;

        if (data.roomId !== participant.roomId) {
            this.logDebug('media-state-change room mismatch', {
                socketId: client.id,
                sentRoom: data.roomId,
                actualRoom: participant.roomId,
            });
            return;
        }

        participant.mediaState[data.type] = data.enabled;
        client.to(participant.roomId).emit('participant-media-state', {
            socketId: client.id,
            type: data.type,
            enabled: data.enabled,
        });
    }

    @SubscribeMessage('screen-share-start')
    handleScreenShareStart(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: ScreenShareStartPayload,
    ) {
        const participant = this.getParticipant(client, 'screen-share-start');
        if (!participant) return;

        if (data.roomId !== participant.roomId) return;

        participant.mediaState.screen = true;
        participant.mediaState.camera = false;

        const room = this.rooms.get(data.roomId);
        if (room) {
            room.screenSharerSocketId = client.id;
        }

        client.to(participant.roomId).emit('participant-screen-state', {
            socketId: client.id,
            screen: true,
            camera: false,
        });
    }

    @SubscribeMessage('screen-share-stop')
    handleScreenShareStop(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: ScreenShareStopPayload,
    ) {
        const participant = this.getParticipant(client, 'screen-share-stop');
        if (!participant) return;

        if (data.roomId !== participant.roomId) return;

        participant.mediaState.screen = false;
        participant.mediaState.camera = data.isCamOn;

        const room = this.rooms.get(data.roomId);
        if (room && room.screenSharerSocketId === client.id) {
            room.screenSharerSocketId = undefined;
        }

        client.to(participant.roomId).emit('participant-screen-state', {
            socketId: client.id,
            screen: false,
            camera: data.isCamOn,
        });
    }

    @SubscribeMessage('leave-room')
    handleLeaveRoom(@ConnectedSocket() client: Socket) {
        this.removeParticipant(client, 'leave-room');
    }
}
