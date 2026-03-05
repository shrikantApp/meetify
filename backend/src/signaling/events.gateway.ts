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

    private readonly participants = new Map<string, ParticipantInfo>();

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
        const participant = this.participants.get(client.id);
        if (!participant) return;

        if (reason === 'leave-room') {
            void client.leave(participant.roomId);
        }

        client.to(participant.roomId).emit('user-left', {
            socketId: client.id,
            userId: participant.userId,
            userName: participant.userName,
        });

        this.participants.delete(client.id);
        this.logDebug('participant removed', {
            socketId: client.id,
            roomId: participant.roomId,
            reason,
        });
    }

    private getParticipant(client: Socket, eventName: string) {
        const participant = this.participants.get(client.id);
        if (!participant) {
            this.logDebug('event from socket not in a room', {
                eventName,
                socketId: client.id,
            });
            return null;
        }
        return participant;
    }

    private isValidTarget(
        clientId: string,
        targetSocketId: string,
        eventName: string,
    ) {
        const sender = this.participants.get(clientId);
        const target = this.participants.get(targetSocketId);

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

        this.participants.set(client.id, participant);

        client.to(data.roomId).emit('user-joined', {
            socketId: client.id,
            userId: participant.userId,
            userName: participant.userName,
            mediaState: participant.mediaState,
        });

        const roomParticipants = Array.from(this.participants.entries())
            .filter(
                ([socketId, info]) =>
                    socketId !== client.id && info.roomId === data.roomId,
            )
            .map(([socketId, info]) => ({
                socketId,
                userId: info.userId,
                userName: info.userName,
                mediaState: info.mediaState,
            }));

        client.emit('room-participants', roomParticipants);
        this.logDebug('joined room', {
            socketId: client.id,
            roomId: data.roomId,
            peersInRoom: roomParticipants.length,
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
