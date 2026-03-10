// ── useLobby Hook ────────────────────────────────────────────────────────────
// Manages the lobby / waiting room lifecycle for both participants and hosts.
// - Participants: send join request → wait → admitted / denied / cancel.
// - Hosts: receive pending requests → approve / deny / bulk approve.

import { useState, useCallback, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LobbyStatus = 'idle' | 'requesting' | 'waiting' | 'admitted' | 'denied';
export type ParticipantRole = 'host' | 'co-host' | 'participant' | 'viewer';

export interface MediaState {
    camera: boolean;
    mic: boolean;
    screen: boolean;
}

export interface PendingRequest {
    socketId: string;
    userId: string;
    userName: string;
    mediaState: MediaState;
    requestedAt: number;
}

export interface RoomStateFromServer {
    participants: Array<{
        socketId: string;
        userId: string;
        userName: string;
        mediaState: MediaState;
        role: ParticipantRole;
    }>;
    screenSharerSocketId?: string;
    lobbyEnabled: boolean;
    isHost: boolean;
}

export interface UseLobbyProps {
    socket: Socket | null;
    roomId: string;
    userName: string;
    userId: string;
}

export interface UseLobbyReturn {
    // Participant state
    lobbyStatus: LobbyStatus;
    deniedReason: string;
    admittedRole: ParticipantRole | null;

    // Participant actions
    sendJoinRequest: (mediaState: MediaState) => void;
    cancelRequest: () => void;
    resetLobby: () => void;

    // Host state
    pendingRequests: PendingRequest[];

    // Host actions
    approveRequest: (targetSocketId: string, role: ParticipantRole) => void;
    denyRequest: (targetSocketId: string, reason?: string) => void;
    bulkApprove: (targets: Array<{ socketId: string; role: ParticipantRole }>) => void;

    // Host controls
    hostAction: (action: string, targetSocketId?: string) => void;

    // Lobby configuration
    configureRoom: (lobbyEnabled: boolean) => void;

    // Toast management (most recent request for toast)
    latestRequest: PendingRequest | null;
    dismissToast: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLobby({ socket, roomId, userName, userId: _userId }: UseLobbyProps): UseLobbyReturn {
    const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus>('idle');
    const [deniedReason, setDeniedReason] = useState('');
    const [admittedRole, setAdmittedRole] = useState<ParticipantRole | null>(null);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [latestRequest, setLatestRequest] = useState<PendingRequest | null>(null);

    // Ref to avoid stale closures in socket listeners
    const statusRef = useRef(lobbyStatus);
    statusRef.current = lobbyStatus;

    // ── Socket Event Listeners ────────────────────────────────────────────

    useEffect(() => {
        if (!socket) return;

        const onJoinRequestAck = (data: { status: string }) => {
            if (data.status === 'pending' || data.status === 'already-pending') {
                setLobbyStatus('waiting');
            }
        };

        const onRequestAccepted = (data: { role: ParticipantRole }) => {
            setLobbyStatus('admitted');
            setAdmittedRole(data.role);
        };

        const onRequestDenied = (data: { reason?: string }) => {
            setLobbyStatus('denied');
            setDeniedReason(data.reason || 'Your request was declined by the host.');
        };

        const onJoinRequestCancelAck = () => {
            setLobbyStatus('idle');
        };

        // Host-side: new pending request
        const onJoinRequestReceived = (data: PendingRequest) => {
            setPendingRequests((prev) => {
                // Avoid duplicates
                if (prev.some((r) => r.socketId === data.socketId)) return prev;
                return [...prev, data];
            });
            setLatestRequest(data);
        };

        // Host-side: request cancelled
        const onJoinRequestCancelled = (data: { socketId: string }) => {
            setPendingRequests((prev) => prev.filter((r) => r.socketId !== data.socketId));
            setLatestRequest((prev) =>
                prev?.socketId === data.socketId ? null : prev,
            );
        };

        socket.on('join-request-ack', onJoinRequestAck);
        socket.on('request-accepted', onRequestAccepted);
        socket.on('request-denied', onRequestDenied);
        socket.on('join-request-cancel-ack', onJoinRequestCancelAck);
        socket.on('join-request-received', onJoinRequestReceived);
        socket.on('join-request-cancelled', onJoinRequestCancelled);

        return () => {
            socket.off('join-request-ack', onJoinRequestAck);
            socket.off('request-accepted', onRequestAccepted);
            socket.off('request-denied', onRequestDenied);
            socket.off('join-request-cancel-ack', onJoinRequestCancelAck);
            socket.off('join-request-received', onJoinRequestReceived);
            socket.off('join-request-cancelled', onJoinRequestCancelled);
        };
    }, [socket]);

    // ── Participant Actions ───────────────────────────────────────────────

    const sendJoinRequest = useCallback(
        (mediaState: MediaState) => {
            if (!socket || !roomId) return;
            setLobbyStatus('requesting');
            socket.emit('join-request', { roomId, userName, mediaState });
        },
        [socket, roomId, userName],
    );

    const cancelRequest = useCallback(() => {
        if (!socket || !roomId) return;
        socket.emit('join-request-cancel', { roomId });
        setLobbyStatus('idle');
    }, [socket, roomId]);

    const resetLobby = useCallback(() => {
        setLobbyStatus('idle');
        setDeniedReason('');
        setAdmittedRole(null);
    }, []);

    // ── Host Actions ──────────────────────────────────────────────────────

    const approveRequest = useCallback(
        (targetSocketId: string, role: ParticipantRole = 'participant') => {
            if (!socket || !roomId) return;
            socket.emit('approve-request', { roomId, targetSocketId, role });
            setPendingRequests((prev) => prev.filter((r) => r.socketId !== targetSocketId));
            setLatestRequest((prev) =>
                prev?.socketId === targetSocketId ? null : prev,
            );
        },
        [socket, roomId],
    );

    const denyRequest = useCallback(
        (targetSocketId: string, reason?: string) => {
            if (!socket || !roomId) return;
            socket.emit('deny-request', { roomId, targetSocketId, reason });
            setPendingRequests((prev) => prev.filter((r) => r.socketId !== targetSocketId));
            setLatestRequest((prev) =>
                prev?.socketId === targetSocketId ? null : prev,
            );
        },
        [socket, roomId],
    );

    const bulkApprove = useCallback(
        (targets: Array<{ socketId: string; role: ParticipantRole }>) => {
            if (!socket || !roomId) return;
            socket.emit('bulk-approve', { roomId, targets });
            const approvedIds = new Set(targets.map((t) => t.socketId));
            setPendingRequests((prev) => prev.filter((r) => !approvedIds.has(r.socketId)));
            setLatestRequest(null);
        },
        [socket, roomId],
    );

    const hostAction = useCallback(
        (action: string, targetSocketId?: string) => {
            if (!socket || !roomId) return;
            socket.emit('host-action', { roomId, action, targetSocketId });
        },
        [socket, roomId],
    );

    const configureRoom = useCallback(
        (lobbyEnabled: boolean) => {
            if (!socket || !roomId) return;
            socket.emit('configure-room', { roomId, lobbyEnabled });
        },
        [socket, roomId],
    );

    const dismissToast = useCallback(() => {
        setLatestRequest(null);
    }, []);

    return {
        lobbyStatus,
        deniedReason,
        admittedRole,
        sendJoinRequest,
        cancelRequest,
        resetLobby,
        pendingRequests,
        approveRequest,
        denyRequest,
        bulkApprove,
        hostAction,
        configureRoom,
        latestRequest,
        dismissToast,
    };
}
