// ── HostLobbyPanel ───────────────────────────────────────────────────────────
// A sidebar panel shown to the host inside the meeting room. Lists all pending
// join requests with approve/deny buttons, bulk approve, and a search filter.

import { useState, useMemo } from 'react';
import {
    UserCheck,
    UserX,
    Users,
    Search,
    CheckCircle2,
    Mic,
    MicOff,
    Video,
    VideoOff,
    ChevronDown,
} from 'lucide-react';
import type { PendingRequest, ParticipantRole } from '../hooks/useLobby';

interface HostLobbyPanelProps {
    requests: PendingRequest[];
    onApprove: (socketId: string, role: ParticipantRole) => void;
    onDeny: (socketId: string, reason?: string) => void;
    onBulkApprove: (targets: Array<{ socketId: string; role: ParticipantRole }>) => void;
    onClose: () => void;
}

export default function HostLobbyPanel({
    requests,
    onApprove,
    onDeny,
    onBulkApprove,
    onClose,
}: HostLobbyPanelProps) {
    const [search, setSearch] = useState('');
    const [roleDropdown, setRoleDropdown] = useState<string | null>(null);

    const filtered = useMemo(
        () =>
            requests.filter((r) =>
                r.userName.toLowerCase().includes(search.toLowerCase()),
            ),
        [requests, search],
    );

    const handleBulkApprove = () => {
        onBulkApprove(filtered.map((r) => ({ socketId: r.socketId, role: 'participant' })));
    };

    const elapsed = (requestedAt: number) => {
        const diff = Math.floor((Date.now() - requestedAt) / 1000);
        if (diff < 60) return `${diff}s ago`;
        return `${Math.floor(diff / 60)}m ago`;
    };

    return (
        <div className="host-lobby-panel" role="complementary" aria-label="Pending join requests">
            <div className="lobby-panel-header">
                <div className="lobby-panel-title">
                    <Users size={18} />
                    <span>Waiting Room</span>
                    {requests.length > 0 && (
                        <span className="lobby-badge">{requests.length}</span>
                    )}
                </div>
                <button
                    className="btn-icon-sm"
                    onClick={onClose}
                    aria-label="Close waiting room panel"
                >
                    ✕
                </button>
            </div>

            {requests.length > 0 && (
                <>
                    <div className="lobby-search-bar">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Search by name…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            aria-label="Search pending requests"
                        />
                    </div>

                    <div className="lobby-bulk-actions">
                        <button
                            className="btn-lobby btn-lobby-sm btn-lobby-success"
                            onClick={handleBulkApprove}
                            aria-label={`Approve all ${filtered.length} requests`}
                        >
                            <CheckCircle2 size={14} />
                            Approve All ({filtered.length})
                        </button>
                    </div>
                </>
            )}

            <div className="lobby-requests-list">
                {filtered.length === 0 && (
                    <div className="lobby-empty">
                        <Users size={32} />
                        <p>No pending requests</p>
                    </div>
                )}

                {filtered.map((req) => (
                    <div
                        key={req.socketId}
                        className="lobby-request-card"
                        aria-label={`Join request from ${req.userName}`}
                    >
                        <div className="lobby-request-info">
                            <div className="lobby-request-avatar">
                                {req.userName.charAt(0).toUpperCase()}
                            </div>
                            <div className="lobby-request-details">
                                <span className="lobby-request-name">{req.userName}</span>
                                <span className="lobby-request-time">{elapsed(req.requestedAt)}</span>
                            </div>
                            <div className="lobby-request-media">
                                {req.mediaState.mic ? (
                                    <Mic size={14} className="media-on" />
                                ) : (
                                    <MicOff size={14} className="media-off" />
                                )}
                                {req.mediaState.camera ? (
                                    <Video size={14} className="media-on" />
                                ) : (
                                    <VideoOff size={14} className="media-off" />
                                )}
                            </div>
                        </div>

                        <div className="lobby-request-actions">
                            <div className="approve-dropdown-wrapper">
                                <button
                                    className="btn-lobby btn-lobby-xs btn-lobby-success"
                                    onClick={() => onApprove(req.socketId, 'participant')}
                                    aria-label={`Approve ${req.userName} as participant`}
                                >
                                    <UserCheck size={13} />
                                    Approve
                                </button>
                                <button
                                    className="btn-lobby btn-lobby-xs btn-lobby-success-alt"
                                    onClick={() =>
                                        setRoleDropdown(
                                            roleDropdown === req.socketId ? null : req.socketId,
                                        )
                                    }
                                    aria-label="Choose role"
                                    aria-expanded={roleDropdown === req.socketId}
                                >
                                    <ChevronDown size={12} />
                                </button>
                                {roleDropdown === req.socketId && (
                                    <div className="approve-role-menu" role="menu">
                                        <button
                                            role="menuitem"
                                            onClick={() => {
                                                onApprove(req.socketId, 'participant');
                                                setRoleDropdown(null);
                                            }}
                                        >
                                            Approve &amp; admit with mic
                                        </button>
                                        <button
                                            role="menuitem"
                                            onClick={() => {
                                                onApprove(req.socketId, 'viewer');
                                                setRoleDropdown(null);
                                            }}
                                        >
                                            Join as viewer (no mic/cam)
                                        </button>
                                        <button
                                            role="menuitem"
                                            onClick={() => {
                                                onApprove(req.socketId, 'co-host');
                                                setRoleDropdown(null);
                                            }}
                                        >
                                            Promote to co-host
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button
                                className="btn-lobby btn-lobby-xs btn-lobby-danger"
                                onClick={() => onDeny(req.socketId)}
                                aria-label={`Deny ${req.userName}`}
                            >
                                <UserX size={13} />
                                Deny
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
