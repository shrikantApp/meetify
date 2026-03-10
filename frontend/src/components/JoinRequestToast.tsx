// ── JoinRequestToast ─────────────────────────────────────────────────────────
// A slide-in toast notification shown to the host when a new join request arrives.
// Auto-dismisses after 10 seconds. Provides quick Approve / Deny actions.

import { useEffect, useState } from 'react';
import { UserCheck, UserX, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';
import type { PendingRequest, ParticipantRole } from '../hooks/useLobby';

interface JoinRequestToastProps {
    request: PendingRequest | null;
    onApprove: (socketId: string, role: ParticipantRole) => void;
    onDeny: (socketId: string) => void;
    onDismiss: () => void;
}

export default function JoinRequestToast({
    request,
    onApprove,
    onDeny,
    onDismiss,
}: JoinRequestToastProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (request) {
            // Small delay for slide-in animation
            requestAnimationFrame(() => setVisible(true));

            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(onDismiss, 300); // Wait for exit animation
            }, 10000);

            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [request, onDismiss]);

    if (!request) return null;

    return (
        <div
            className={`join-toast ${visible ? 'join-toast-enter' : 'join-toast-exit'}`}
            role="alert"
            aria-live="assertive"
            aria-label={`${request.userName} wants to join`}
        >
            <div className="join-toast-header">
                <div className="join-toast-avatar">
                    {request.userName.charAt(0).toUpperCase()}
                </div>
                <div className="join-toast-info">
                    <span className="join-toast-name">{request.userName}</span>
                    <span className="join-toast-label">wants to join this meeting</span>
                </div>
                <div className="join-toast-media">
                    {request.mediaState.mic ? (
                        <Mic size={14} className="media-on" />
                    ) : (
                        <MicOff size={14} className="media-off" />
                    )}
                    {request.mediaState.camera ? (
                        <Video size={14} className="media-on" />
                    ) : (
                        <VideoOff size={14} className="media-off" />
                    )}
                </div>
                <button
                    className="btn-icon-xs"
                    onClick={onDismiss}
                    aria-label="Dismiss notification"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="join-toast-actions">
                <button
                    className="btn-lobby btn-lobby-xs btn-lobby-success"
                    onClick={() => onApprove(request.socketId, 'participant')}
                >
                    <UserCheck size={14} />
                    Approve
                </button>
                <button
                    className="btn-lobby btn-lobby-xs btn-lobby-danger"
                    onClick={() => onDeny(request.socketId)}
                >
                    <UserX size={14} />
                    Deny
                </button>
            </div>
        </div>
    );
}
