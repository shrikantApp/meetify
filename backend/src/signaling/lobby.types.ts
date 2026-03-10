// ── LOBBY / WAITING ROOM TYPES ───────────────────────────────────────────────
// Shared types for the lobby (waiting room) system.
// The gateway, REST controllers, and tests all import from this file.

export type ParticipantRole = 'host' | 'co-host' | 'participant' | 'viewer';

export type MediaState = {
    camera: boolean;
    mic: boolean;
    screen: boolean;
};

/** A pending join request stored in the lobby. */
export interface JoinRequest {
    socketId: string;
    userId: string;
    userName: string;
    mediaState: MediaState;
    requestedAt: number;   // Date.now()
    ttl: number;           // milliseconds, default 300_000 (5 min)
}

/** Per-room settings managed by the host at runtime. */
export interface RoomSettings {
    lobbyEnabled: boolean;
    locked: boolean;           // No new joins at all
    hostSocketId: string;
    hostUserId: string;
    coHostSocketIds: Set<string>;
}

/** Lobby-related payloads sent over socket.io. */
export interface JoinRequestPayload {
    roomId: string;
    userName: string;
    mediaState: MediaState;
}

export interface ApproveRequestPayload {
    roomId: string;
    targetSocketId: string;
    role: ParticipantRole;
}

export interface DenyRequestPayload {
    roomId: string;
    targetSocketId: string;
    reason?: string;
}

export interface BulkApprovePayload {
    roomId: string;
    targets: Array<{ socketId: string; role: ParticipantRole }>;
}

export type HostActionType =
    | 'mute-all'
    | 'remove-participant'
    | 'promote-co-host'
    | 'demote-co-host'
    | 'lock-room'
    | 'unlock-room'
    | 'end-meeting';

export interface HostActionPayload {
    roomId: string;
    action: HostActionType;
    targetSocketId?: string;
}

export interface RaiseHandPayload {
    roomId: string;
    raised: boolean;
}

/** Immutable audit entry recorded per moderator action. */
export interface AuditEntry {
    timestamp: number;
    action: string;
    actorSocketId: string;
    actorUserId: string;
    targetSocketId?: string;
    details?: Record<string, unknown>;
}

/** Default TTL for pending join requests (5 minutes). */
export const DEFAULT_REQUEST_TTL = 300_000;

/** Interval for sweeping expired requests (30 seconds). */
export const CLEANUP_INTERVAL = 30_000;
