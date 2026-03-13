import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type {
    MediaState,
    JoinRequest,
    RoomSettings,
    ParticipantRole,
    AuditEntry,
    JoinRequestPayload,
    ApproveRequestPayload,
    DenyRequestPayload,
    BulkApprovePayload,
    HostActionPayload,
    ParticipantActionPayload,
    RaiseHandPayload,
} from './lobby.types';
import {
    DEFAULT_REQUEST_TTL,
    CLEANUP_INTERVAL,
} from './lobby.types';

// ── INTERNAL TYPES ───────────────────────────────────────────────────────────

type MediaType = 'camera' | 'mic' | 'screen';

type ParticipantInfo = {
    roomId: string;
    userId: string;
    userName: string;
    mediaState: MediaState;
    role: ParticipantRole;
};

type AuthPayload = { sub: string };

type JoinRoomPayload = {
    roomId: string;
    userName: string;
    mediaState?: MediaState;
};

type TargetPayload = { targetSocketId: string };
type OfferPayload = TargetPayload & { sdp: RTCSessionDescriptionInit };
type AnswerPayload = TargetPayload & { sdp: RTCSessionDescriptionInit };
type IcePayload = TargetPayload & { candidate: RTCIceCandidateInit };
type ChatPayload = { roomId?: string; message: string; userName?: string };
type MediaStatePayload = { roomId: string; type: MediaType; enabled: boolean };
type ScreenShareStartPayload = { roomId: string };
type ScreenShareStopPayload = { roomId: string; isCamOn: boolean };

type RoomState = {
    roomId: string;
    participants: Record<string, ParticipantInfo>;
    screenSharerSocketId?: string;
    createdAt: number;
};

type AuthenticatedSocket = Socket & { user?: AuthPayload };

// ── GATEWAY ──────────────────────────────────────────────────────────────────

@WebSocketGateway({
    cors: {
        origin: process.env.ALLOW_WEBSITE_URLS?.split?.(",") || 'http://localhost:5173',
        credentials: true,
    },
    namespace: '/signaling',
})
export class EventsGateway
    implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
    @WebSocketServer()
    server: Server;

    // ── In-memory stores (swap with Redis for horizontal scaling) ─────────

    /** Active rooms with admitted participants. */
    private readonly rooms = new Map<string, RoomState>();

    /** Per-room pending join requests. roomId → (socketId → JoinRequest). */
    private readonly pendingRequests = new Map<string, Map<string, JoinRequest>>();

    /** Per-room host / lobby settings. */
    private readonly roomSettings = new Map<string, RoomSettings>();

    /** Per-room audit log. */
    private readonly auditLogs = new Map<string, AuditEntry[]>();

    /** Handle for TTL cleanup interval. */
    private cleanupTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    // ── LIFECYCLE ────────────────────────────────────────────────────────

    onModuleInit() {
        this.cleanupTimer = setInterval(() => this.sweepExpiredRequests(), CLEANUP_INTERVAL);
    }

    onModuleDestroy() {
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    }

    // ── LOGGING ──────────────────────────────────────────────────────────

    private isDebugEnabled() {
        return this.configService.get<string>('SIGNALING_DEBUG') === 'true';
    }

    private logDebug(message: string, context?: Record<string, unknown>) {
        if (!this.isDebugEnabled()) return;
        const details = context ? ` ${JSON.stringify(context)}` : '';
        console.log(`[signaling] ${message}${details}`);
    }

    // ── AUDIT ────────────────────────────────────────────────────────────

    private addAudit(roomId: string, entry: Omit<AuditEntry, 'timestamp'>) {
        if (!this.auditLogs.has(roomId)) this.auditLogs.set(roomId, []);
        this.auditLogs.get(roomId)!.push({ ...entry, timestamp: Date.now() });
    }

    // ── HELPERS ──────────────────────────────────────────────────────────

    /** Remove a participant from room bookkeeping and notify peers. */
    private removeParticipant(client: Socket, reason: 'disconnect' | 'leave-room') {
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

            if (room.screenSharerSocketId === client.id) {
                room.screenSharerSocketId = undefined;
            }

            // Auto sweep empty rooms
            if (Object.keys(room.participants).length === 0) {
                this.rooms.delete(targetRoomId);
                this.roomSettings.delete(targetRoomId);
                this.pendingRequests.delete(targetRoomId);
                this.auditLogs.delete(targetRoomId);
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

    /** Remove a socket from pending requests (on disconnect or cancel). */
    private removePendingRequest(client: Socket) {
        for (const [roomId, requestsMap] of this.pendingRequests.entries()) {
            if (requestsMap.has(client.id)) {
                requestsMap.delete(client.id);

                // Notify host that the request was cancelled
                const settings = this.roomSettings.get(roomId);
                if (settings?.hostSocketId) {
                    this.server.to(settings.hostSocketId).emit('join-request-cancelled', {
                        socketId: client.id,
                    });
                    // Also notify co-hosts
                    for (const coHostId of settings.coHostSocketIds) {
                        this.server.to(coHostId).emit('join-request-cancelled', {
                            socketId: client.id,
                        });
                    }
                }

                this.logDebug('pending request removed', { socketId: client.id, roomId });
                break;
            }
        }
    }

    private getParticipant(client: Socket, eventName: string): ParticipantInfo | null {
        for (const room of this.rooms.values()) {
            if (room.participants[client.id]) {
                return room.participants[client.id];
            }
        }
        this.logDebug('event from socket not in a room', { eventName, socketId: client.id });
        return null;
    }

    private isValidTarget(clientId: string, targetSocketId: string, eventName: string) {
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

    /** Check if a socket is the host or co-host for a room. */
    private isHostOrCoHost(socketId: string, roomId: string): boolean {
        const settings = this.roomSettings.get(roomId);
        if (!settings) return false;
        return settings.hostSocketId === socketId || settings.coHostSocketIds.has(socketId);
    }

    /** Build the peer list for room-state emission. */
    private buildPeerList(room: RoomState, excludeSocketId?: string) {
        return Object.entries(room.participants)
            .filter(([id]) => id !== excludeSocketId)
            .map(([id, info]) => ({
                socketId: id,
                userId: info.userId,
                userName: info.userName,
                mediaState: info.mediaState,
                role: info.role,
            }));
    }

    /** Admit a participant into the room (shared by direct join and lobby approve). */
    private admitParticipant(
        targetSocketId: string,
        userId: string,
        roomId: string,
        userName: string,
        mediaState: MediaState,
        role: ParticipantRole,
    ) {
        // Safely force the target socket into the room without traversing internal map
        this.server.in(targetSocketId).socketsJoin(roomId);

        const participant: ParticipantInfo = {
            roomId,
            userId,
            userName,
            mediaState,
            role,
        };

        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                roomId,
                participants: {},
                createdAt: Date.now(),
            });
        }

        const room = this.rooms.get(roomId)!;

        if (participant.mediaState.screen) {
            room.screenSharerSocketId = targetSocketId;
        }

        room.participants[targetSocketId] = participant;

        // Broadcast to existing peers using 'except' to exclude the new joiner
        this.server.to(roomId).except(targetSocketId).emit('user-joined', {
            socketId: targetSocketId,
            userId: participant.userId,
            userName: participant.userName,
            mediaState: participant.mediaState,
            role: participant.role,
        });

        // Send room-state to the joiner
        const peerList = this.buildPeerList(room, targetSocketId);
        const settings = this.roomSettings.get(roomId);

        this.server.to(targetSocketId).emit('room-state', {
            participants: peerList,
            screenSharerSocketId: room.screenSharerSocketId,
            lobbyEnabled: settings?.lobbyEnabled ?? false,
            isHost: settings?.hostSocketId === targetSocketId,
        });

        this.logDebug('admitted to room', {
            socketId: targetSocketId,
            roomId,
            role,
            peersInRoom: peerList.length,
        });
    }

    /** Sweep expired pending requests. */
    private sweepExpiredRequests() {
        const now = Date.now();
        for (const [roomId, requestsMap] of this.pendingRequests.entries()) {
            for (const [socketId, req] of requestsMap.entries()) {
                if (now - req.requestedAt > req.ttl) {
                    requestsMap.delete(socketId);

                    // Notify the participant their request expired
                    this.server.to(socketId).emit('request-denied', {
                        reason: 'Request timed out. Please try again.',
                    });

                    // Notify host
                    const settings = this.roomSettings.get(roomId);
                    if (settings?.hostSocketId) {
                        this.server.to(settings.hostSocketId).emit('join-request-cancelled', {
                            socketId,
                        });
                    }

                    this.logDebug('request expired', { socketId, roomId });
                }
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // CONNECTION / DISCONNECTION
    // ══════════════════════════════════════════════════════════════════════

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
        this.removePendingRequest(client);
        this.removeParticipant(client, 'disconnect');
    }

    // ══════════════════════════════════════════════════════════════════════
    // JOIN ROOM (with lobby gate)
    // ══════════════════════════════════════════════════════════════════════

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

        // Clean up any previous room membership (reconnect/join retry)
        // AND check if the same userId is already in a room with a different socketId
        for (const [rid, room] of this.rooms.entries()) {
            for (const [sid, info] of Object.entries(room.participants)) {
                if (info.userId === client.user.sub) {
                    this.logDebug('removing stale session for user', { userId: info.userId, oldSocketId: sid, newSocketId: client.id });
                    const oldSocket = this.server.of('/signaling').sockets.get(sid);
                    if (oldSocket) {
                        this.removeParticipant(oldSocket, 'leave-room');
                        oldSocket.disconnect();
                    } else {
                        // If socket is already gone from server.sockets, manually clean up
                        delete room.participants[sid];
                        this.server.to(rid).emit('user-left', { socketId: sid, userId: info.userId, userName: info.userName });
                    }
                }
            }
        }
        this.removeParticipant(client, 'leave-room');

        const settings = this.roomSettings.get(data.roomId);
        const isHost = settings?.hostUserId === client.user.sub;
        const isCoHost = settings
            ? [...settings.coHostSocketIds].some(
                (sid) => this.rooms.get(data.roomId)?.participants[sid]?.userId === client.user!.sub,
            )
            : false;

        // If room has no settings yet OR if lobby is disabled OR if user is host/co-host → direct admit
        if (!settings || !settings.lobbyEnabled || isHost || isCoHost) {
            const role: ParticipantRole = isHost ? 'host' : isCoHost ? 'co-host' : 'participant';
            this.admitParticipant(
                client.id,
                client.user!.sub,
                data.roomId,
                data.userName || 'Guest',
                data.mediaState || { camera: false, mic: false, screen: false },
                role,
            );

            // If host is joining, update their socketId in settings
            if (isHost && settings) {
                settings.hostSocketId = client.id;
            }

            return;
        }

        // Lobby is enabled and user is not host/co-host → tell client to show lobby
        const roomPending = this.pendingRequests.get(data.roomId);
        const alreadyPending = roomPending?.has(client.id);

        client.emit('lobby-waiting', {
            lobbyEnabled: true,
            alreadyPending: !!alreadyPending,
        });

        this.logDebug('lobby-waiting sent', { socketId: client.id, roomId: data.roomId });
    }

    // ══════════════════════════════════════════════════════════════════════
    // LOBBY: JOIN REQUEST FLOW
    // ══════════════════════════════════════════════════════════════════════

    /** Participant sends a join request to the host. */
    @SubscribeMessage('join-request')
    handleJoinRequest(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: JoinRequestPayload,
    ) {
        if (!data?.roomId || !client.user?.sub) return;

        const settings = this.roomSettings.get(data.roomId);
        if (!settings) {
            client.emit('request-denied', { reason: 'Meeting has not started yet.' });
            return;
        }

        if (settings.locked) {
            client.emit('request-denied', { reason: 'This meeting is locked by the host.' });
            return;
        }

        // Initialize pending map for this room if needed
        if (!this.pendingRequests.has(data.roomId)) {
            this.pendingRequests.set(data.roomId, new Map());
        }

        const roomPending = this.pendingRequests.get(data.roomId)!;

        // Rate limit: max 1 pending request per socket
        if (roomPending.has(client.id)) {
            client.emit('join-request-ack', { status: 'already-pending' });
            return;
        }

        const request: JoinRequest = {
            socketId: client.id,
            userId: client.user.sub,
            userName: data.userName || 'Guest',
            mediaState: data.mediaState || { camera: false, mic: false, screen: false },
            requestedAt: Date.now(),
            ttl: DEFAULT_REQUEST_TTL,
        };

        roomPending.set(client.id, request);

        // Acknowledge to participant
        client.emit('join-request-ack', { status: 'pending' });

        // Notify host + co-hosts
        const notification = {
            socketId: client.id,
            userId: request.userId,
            userName: request.userName,
            mediaState: request.mediaState,
            requestedAt: request.requestedAt,
        };

        this.server.to(settings.hostSocketId).emit('join-request-received', notification);
        for (const coHostId of settings.coHostSocketIds) {
            this.server.to(coHostId).emit('join-request-received', notification);
        }

        this.addAudit(data.roomId, {
            action: 'join-request',
            actorSocketId: client.id,
            actorUserId: client.user.sub,
            details: { userName: request.userName },
        });

        this.logDebug('join-request received', {
            socketId: client.id,
            roomId: data.roomId,
            userName: request.userName,
        });
    }

    /** Participant cancels their join request. */
    @SubscribeMessage('join-request-cancel')
    handleJoinRequestCancel(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: { roomId: string },
    ) {
        if (!data?.roomId) return;

        const roomPending = this.pendingRequests.get(data.roomId);
        if (!roomPending?.has(client.id)) return;

        roomPending.delete(client.id);

        // Notify host
        const settings = this.roomSettings.get(data.roomId);
        if (settings?.hostSocketId) {
            this.server.to(settings.hostSocketId).emit('join-request-cancelled', {
                socketId: client.id,
            });
            for (const coHostId of settings.coHostSocketIds) {
                this.server.to(coHostId).emit('join-request-cancelled', {
                    socketId: client.id,
                });
            }
        }

        client.emit('join-request-cancel-ack', { status: 'cancelled' });

        this.logDebug('join-request cancelled', { socketId: client.id, roomId: data.roomId });
    }

    /** Host approves a join request. */
    @SubscribeMessage('approve-request')
    handleApproveRequest(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: ApproveRequestPayload,
    ) {
        if (!data?.roomId || !data?.targetSocketId) return;
        if (!this.isHostOrCoHost(client.id, data.roomId)) return;

        const roomPending = this.pendingRequests.get(data.roomId);
        const request = roomPending?.get(data.targetSocketId);
        if (!request) return;

        roomPending!.delete(data.targetSocketId);

        // Admit the participant
        const role = data.role || 'participant';
        this.admitParticipant(
            data.targetSocketId,
            request.userId,
            data.roomId,
            request.userName,
            request.mediaState,
            role,
        );

        // Notify the participant they've been admitted
        this.server.to(data.targetSocketId).emit('request-accepted', { role });

        this.addAudit(data.roomId, {
            action: 'approve-request',
            actorSocketId: client.id,
            actorUserId: client.user!.sub,
            targetSocketId: data.targetSocketId,
            details: { role, userName: request.userName },
        });

        this.logDebug('request approved', {
            approver: client.id,
            target: data.targetSocketId,
            role,
        });
    }

    /** Host denies a join request. */
    @SubscribeMessage('deny-request')
    handleDenyRequest(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: DenyRequestPayload,
    ) {
        if (!data?.roomId || !data?.targetSocketId) return;
        if (!this.isHostOrCoHost(client.id, data.roomId)) return;

        const roomPending = this.pendingRequests.get(data.roomId);
        if (!roomPending?.has(data.targetSocketId)) return;

        const request = roomPending.get(data.targetSocketId)!;
        roomPending.delete(data.targetSocketId);

        this.server.to(data.targetSocketId).emit('request-denied', {
            reason: data.reason || 'Your request to join was declined by the host.',
        });

        this.addAudit(data.roomId, {
            action: 'deny-request',
            actorSocketId: client.id,
            actorUserId: client.user!.sub,
            targetSocketId: data.targetSocketId,
            details: { userName: request.userName, reason: data.reason },
        });

        this.logDebug('request denied', {
            denier: client.id,
            target: data.targetSocketId,
        });
    }

    /** Host bulk-approves multiple join requests. */
    @SubscribeMessage('bulk-approve')
    handleBulkApprove(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: BulkApprovePayload,
    ) {
        if (!data?.roomId || !Array.isArray(data.targets)) return;
        if (!this.isHostOrCoHost(client.id, data.roomId)) return;

        for (const target of data.targets) {
            this.handleApproveRequest(client, {
                roomId: data.roomId,
                targetSocketId: target.socketId,
                role: target.role,
            });
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOST: CREATE / CONFIGURE ROOM
    // ══════════════════════════════════════════════════════════════════════

    /** Host configures lobby settings when creating/starting a meeting. */
    @SubscribeMessage('configure-room')
    handleConfigureRoom(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: { roomId: string; lobbyEnabled: boolean },
    ) {
        if (!data?.roomId || !client.user?.sub) return;

        const existing = this.roomSettings.get(data.roomId);

        // Only the original host or first joiner can configure
        if (existing && existing.hostUserId !== client.user.sub) {
            this.logDebug('configure-room denied: not host', { socketId: client.id });
            return;
        }

        this.roomSettings.set(data.roomId, {
            lobbyEnabled: data.lobbyEnabled,
            locked: false,
            hostSocketId: client.id,
            hostUserId: client.user.sub,
            coHostSocketIds: new Set(),
        });

        this.logDebug('room configured', {
            roomId: data.roomId,
            lobbyEnabled: data.lobbyEnabled,
            host: client.id,
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOST ACTIONS (mute-all, remove, promote, lock, end)
    // ══════════════════════════════════════════════════════════════════════

    @SubscribeMessage('host-action')
    handleHostAction(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: HostActionPayload,
    ) {
        if (!data?.roomId || !data?.action) return;
        if (!this.isHostOrCoHost(client.id, data.roomId)) return;

        const room = this.rooms.get(data.roomId);
        if (!room) return;

        const settings = this.roomSettings.get(data.roomId);
        if (!settings) return;

        switch (data.action) {
            case 'mute-all': {
                // Mute all non-host/co-host participants
                for (const [sid, pInfo] of Object.entries(room.participants)) {
                    if (sid !== settings.hostSocketId && !settings.coHostSocketIds.has(sid)) {
                        pInfo.mediaState.mic = false;
                    }
                }
                this.server.to(data.roomId).emit('host-action-applied', {
                    action: 'mute-all',
                    actorSocketId: client.id,
                });
                // Emit to others only
                client.to(data.roomId).emit('force-mute');
                break;
            }

            case 'mute-participant': {
                if (!data.targetSocketId) return;
                const targetSocket = this.server.sockets.sockets.get(data.targetSocketId);
                if (targetSocket) {
                    targetSocket.emit('force-mute');
                    this.logDebug('force-mute sent to participant', { target: data.targetSocketId });
                }
                break;
            }

            case 'disable-camera': {
                if (!data.targetSocketId) return;
                const targetSocket = this.server.sockets.sockets.get(data.targetSocketId);
                if (targetSocket) {
                    targetSocket.emit('force-disable-cam');
                    this.logDebug('force-disable-cam sent to participant', { target: data.targetSocketId });
                }
                break;
            }

            case 'toggle-lobby': {
                const currentSettings = this.roomSettings.get(data.roomId);
                if (currentSettings) {
                    currentSettings.lobbyEnabled = !currentSettings.lobbyEnabled;
                    this.server.to(data.roomId).emit('lobby-setting-changed', {
                        enabled: currentSettings.lobbyEnabled,
                    });
                }
                break;
            }

            case 'remove-participant': {
                if (!data.targetSocketId) return;
                const targetSocket = this.server.sockets.sockets.get(data.targetSocketId);
                if (targetSocket) {
                    targetSocket.emit('host-action-applied', {
                        action: 'removed',
                        reason: 'You have been removed from this meeting by the host.',
                    });
                    this.removeParticipant(targetSocket, 'leave-room');
                }
                break;
            }

            case 'promote-co-host': {
                if (!data.targetSocketId) return;
                settings.coHostSocketIds.add(data.targetSocketId);
                const p = room.participants[data.targetSocketId];
                if (p) p.role = 'co-host';
                this.server.to(data.roomId).emit('host-action-applied', {
                    action: 'promote-co-host',
                    targetSocketId: data.targetSocketId,
                });
                break;
            }

            case 'demote-co-host': {
                if (!data.targetSocketId) return;
                settings.coHostSocketIds.delete(data.targetSocketId);
                const p = room.participants[data.targetSocketId];
                if (p) p.role = 'participant';
                this.server.to(data.roomId).emit('host-action-applied', {
                    action: 'demote-co-host',
                    targetSocketId: data.targetSocketId,
                });
                break;
            }

            case 'lock-room': {
                settings.locked = true;
                this.server.to(data.roomId).emit('host-action-applied', {
                    action: 'lock-room',
                });
                break;
            }

            case 'unlock-room': {
                settings.locked = false;
                this.server.to(data.roomId).emit('host-action-applied', {
                    action: 'unlock-room',
                });
                break;
            }

            case 'recording-start': {
                this.server.to(data.roomId).emit('recording-state-changed', {
                    isRecording: true,
                    startedBy: client.id,
                });
                break;
            }

            case 'recording-stop': {
                this.server.to(data.roomId).emit('recording-state-changed', {
                    isRecording: false,
                    stoppedBy: client.id,
                });
                break;
            }

            case 'end-meeting': {
                this.server.to(data.roomId).emit('host-action-applied', {
                    action: 'end-meeting',
                    reason: 'The host has ended this meeting.',
                });

                // Disconnect all sockets in the room
                for (const sid of Object.keys(room.participants)) {
                    const s = this.server.sockets.sockets.get(sid);
                    if (s) {
                        void s.leave(data.roomId);
                    }
                }

                // Cleanup
                this.rooms.delete(data.roomId);
                this.roomSettings.delete(data.roomId);
                this.pendingRequests.delete(data.roomId);
                break;
            }
        }

        this.addAudit(data.roomId, {
            action: `host-action:${data.action}`,
            actorSocketId: client.id,
            actorUserId: client.user!.sub,
            targetSocketId: data.targetSocketId,
        });

        this.logDebug('host-action executed', {
            action: data.action,
            actorSocketId: client.id,
            targetSocketId: data.targetSocketId,
            roomId: data.roomId,
        });
    }

    @SubscribeMessage('participant-action')
    handleParticipantAction(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() data: ParticipantActionPayload,
    ) {
        if (!data?.roomId || !data?.action || !data?.targetUserId) return;
        if (!this.isHostOrCoHost(client.id, data.roomId)) return;

        const targetSocket = this.server.sockets.sockets.get(data.targetUserId);
        if (targetSocket) {
            targetSocket.emit('participant-action', {
                action: data.action,
            });

            // If remove, actually kick them from the gateway rooms
            if (data.action === 'remove') {
                this.removeParticipant(targetSocket, 'leave-room');
            }

            this.logDebug('participant-action sent', {
                action: data.action,
                target: data.targetUserId,
            });
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    // RAISE HAND
    // ══════════════════════════════════════════════════════════════════════

    @SubscribeMessage('raise-hand')
    handleRaiseHand(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: RaiseHandPayload,
    ) {
        const participant = this.getParticipant(client, 'raise-hand');
        if (!participant) return;

        if (data.roomId !== participant.roomId) return;

        client.to(participant.roomId).emit('hand-raised', {
            socketId: client.id,
            userName: participant.userName,
            raised: data.raised,
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // SIGNALING (unchanged from original, with minor cleanups)
    // ══════════════════════════════════════════════════════════════════════

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
        if (!this.isValidTarget(client.id, data.targetSocketId, 'ice-candidate')) return;

        this.server.to(data.targetSocketId).emit('ice-candidate', {
            candidate: data.candidate,
            fromSocketId: client.id,
        });
    }

    @SubscribeMessage('renegotiate-request')
    handleRenegotiateRequest(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: TargetPayload,
    ) {
        if (!this.isValidTarget(client.id, data.targetSocketId, 'renegotiate-request')) return;

        this.server.to(data.targetSocketId).emit('renegotiate-request', {
            fromSocketId: client.id,
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // CHAT
    // ══════════════════════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════════════════════
    // MEDIA STATE
    // ══════════════════════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════════════════════
    // SCREEN SHARE
    // ══════════════════════════════════════════════════════════════════════

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

    // ══════════════════════════════════════════════════════════════════════
    // LEAVE
    // ══════════════════════════════════════════════════════════════════════

    @SubscribeMessage('leave-room')
    handleLeaveRoom(@ConnectedSocket() client: Socket) {
        this.removeParticipant(client, 'leave-room');
    }
}
