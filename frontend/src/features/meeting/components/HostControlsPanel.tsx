// ── HostControlsPanel ────────────────────────────────────────────────────────
// Dropdown/panel of host-level meeting controls: mute all, remove participant,
// lock/unlock room, end meeting, and promote/demote co-host.

import { useState } from 'react';
import {
    MicOff,
    Lock,
    Unlock,
    UserMinus,
    Shield,
    ShieldOff,
    PhoneOff,
    Settings,
    ChevronUp,
} from 'lucide-react';

interface Participant {
    socketId: string;
    userName: string;
    role: string;
}

interface HostControlsPanelProps {
    participants: Participant[];
    isLocked: boolean;
    chatPermission?: 'everyone' | 'host-only' | 'disabled';
    onAction: (action: string, targetSocketId?: string, chatPermission?: 'everyone' | 'host-only' | 'disabled') => void;
}

export default function HostControlsPanel({
    participants,
    isLocked,
    chatPermission = 'everyone',
    onAction,
}: HostControlsPanelProps) {
    const [open, setOpen] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState(false);

    return (
        <div className="host-controls-wrapper">
            <button
                className="btn-host-controls"
                onClick={() => setOpen(!open)}
                aria-label="Host controls"
                aria-expanded={open}
            >
                <Settings size={18} />
                <span>Host Controls</span>
                <ChevronUp
                    size={14}
                    className={`chevron ${open ? 'chevron-open' : ''}`}
                />
            </button>

            {open && (
                <div className="host-controls-menu" role="menu" aria-label="Host controls menu">
                    <button
                        className="hc-item"
                        onClick={() => onAction('mute-all')}
                        role="menuitem"
                    >
                        <MicOff size={16} />
                        <span>Mute all participants</span>
                    </button>

                    <button
                        className="hc-item"
                        onClick={() => onAction(isLocked ? 'unlock-room' : 'lock-room')}
                        role="menuitem"
                    >
                        {isLocked ? <Unlock size={16} /> : <Lock size={16} />}
                        <span>{isLocked ? 'Unlock meeting' : 'Lock meeting'}</span>
                    </button>

                    <div className="hc-divider" />
                    <div className="hc-section-label">Chat Permissions</div>
                    <div className="px-3 py-1.5 flex flex-col gap-1">
                      <button
                        className={`text-xs px-2 py-1 rounded-lg text-left transition-all ${chatPermission === 'everyone' ? 'bg-accent text-white font-bold' : 'text-white/60 hover:bg-white/5'}`}
                        onClick={() => onAction('set-chat-permission', undefined, 'everyone')}
                      >
                        Everyone can chat
                      </button>
                      <button
                        className={`text-xs px-2 py-1 rounded-lg text-left transition-all ${chatPermission === 'host-only' ? 'bg-accent text-white font-bold' : 'text-white/60 hover:bg-white/5'}`}
                        onClick={() => onAction('set-chat-permission', undefined, 'host-only')}
                      >
                        Host only chat
                      </button>
                      <button
                        className={`text-xs px-2 py-1 rounded-lg text-left transition-all ${chatPermission === 'disabled' ? 'bg-accent text-white font-bold' : 'text-white/60 hover:bg-white/5'}`}
                        onClick={() => onAction('set-chat-permission', undefined, 'disabled')}
                      >
                        Disable chat
                      </button>
                    </div>

                    <div className="hc-divider" />

                    <div className="hc-section-label">Participants</div>
                    {participants
                        .filter((p) => p.role !== 'host')
                        .map((p) => (
                            <div key={p.socketId} className="hc-participant-row">
                                <span className="hc-participant-name">
                                    {p.userName}
                                    {p.role === 'co-host' && (
                                        <span className="hc-role-tag">Co-host</span>
                                    )}
                                </span>
                                <div className="hc-participant-actions">
                                    {p.role === 'co-host' ? (
                                        <button
                                            className="btn-icon-xs"
                                            onClick={() =>
                                                onAction('demote-co-host', p.socketId)
                                            }
                                            aria-label={`Demote ${p.userName}`}
                                            title="Demote from co-host"
                                        >
                                            <ShieldOff size={14} />
                                        </button>
                                    ) : (
                                        <button
                                            className="btn-icon-xs"
                                            onClick={() =>
                                                onAction('promote-co-host', p.socketId)
                                            }
                                            aria-label={`Promote ${p.userName}`}
                                            title="Promote to co-host"
                                        >
                                            <Shield size={14} />
                                        </button>
                                    )}
                                    <button
                                        className="btn-icon-xs btn-danger-icon"
                                        onClick={() =>
                                            onAction('remove-participant', p.socketId)
                                        }
                                        aria-label={`Remove ${p.userName}`}
                                        title="Remove from meeting"
                                    >
                                        <UserMinus size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}

                    <div className="hc-divider" />

                    {!confirmEnd ? (
                        <button
                            className="hc-item hc-item-danger"
                            onClick={() => setConfirmEnd(true)}
                            role="menuitem"
                        >
                            <PhoneOff size={16} />
                            <span>End meeting for all</span>
                        </button>
                    ) : (
                        <div className="hc-confirm">
                            <span>End meeting for everyone?</span>
                            <div className="hc-confirm-actions">
                                <button
                                    className="btn-lobby btn-lobby-xs btn-lobby-danger"
                                    onClick={() => {
                                        onAction('end-meeting');
                                        setConfirmEnd(false);
                                    }}
                                >
                                    End Now
                                </button>
                                <button
                                    className="btn-lobby btn-lobby-xs btn-lobby-ghost"
                                    onClick={() => setConfirmEnd(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
