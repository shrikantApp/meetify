// ── WaitingRoomView ──────────────────────────────────────────────────────────
// Shown to participants when the meeting has lobby enabled and they are not yet
// admitted. Displays a self-preview, "Request to join" button, waiting state
// with cancel, and denied state with retry.

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, UserCheck, XCircle, Clock, Loader2 } from 'lucide-react';
import type { LobbyStatus, MediaState } from '../hooks/useLobby';

interface WaitingRoomViewProps {
    meetingTitle: string;
    lobbyStatus: LobbyStatus;
    deniedReason: string;
    onRequestJoin: (mediaState: MediaState) => void;
    onCancel: () => void;
    onRetry: () => void;
}

export default function WaitingRoomView({
    meetingTitle,
    lobbyStatus,
    deniedReason,
    onRequestJoin,
    onCancel,
    onRetry,
}: WaitingRoomViewProps) {
    const [micOn, setMicOn] = useState(false);
    const [camOn, setCamOn] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [elapsed, setElapsed] = useState(0);

    // Self-preview camera
    useEffect(() => {
        if (camOn) {
            navigator.mediaDevices
                .getUserMedia({ video: true, audio: micOn })
                .then((stream) => {
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                })
                .catch(() => setCamOn(false));
        } else {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, [camOn, micOn]);

    // Elapsed timer while waiting
    useEffect(() => {
        if (lobbyStatus !== 'waiting') {
            setElapsed(0);
            return;
        }
        const start = Date.now();
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [lobbyStatus]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const handleRequest = () => {
        onRequestJoin({ camera: camOn, mic: micOn, screen: false });
    };

    // ── DENIED STATE ─────────────────────────────────────────────────────

    if (lobbyStatus === 'denied') {
        return (
            <div className="waiting-room-container" role="main" aria-label="Join request denied">
                <div className="waiting-room-card waiting-room-denied">
                    <div className="denied-icon-wrapper">
                        <XCircle size={56} />
                    </div>
                    <h2>Request Declined</h2>
                    <p className="denied-reason">{deniedReason}</p>
                    <button
                        className="btn-lobby btn-lobby-primary"
                        onClick={onRetry}
                        aria-label="Try requesting again"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // ── IDLE / REQUESTING / WAITING STATE ─────────────────────────────────

    return (
        <div className="waiting-room-container" role="main" aria-label="Meeting waiting room">
            <div className="waiting-room-card">
                <h1 className="waiting-room-title">{meetingTitle || 'Meeting'}</h1>
                <p className="waiting-room-subtitle">You are about to join this meeting</p>

                {/* Self-preview */}
                <div className="self-preview-wrapper">
                    <div className="self-preview" aria-label="Camera preview">
                        {camOn ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="self-preview-video"
                            />
                        ) : (
                            <div className="self-preview-off">
                                <UserCheck size={48} />
                                <span>Camera is off</span>
                            </div>
                        )}
                    </div>

                    <div className="self-preview-controls">
                        <button
                            className={`btn-media ${micOn ? 'btn-media-on' : 'btn-media-off'}`}
                            onClick={() => setMicOn(!micOn)}
                            aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
                            disabled={lobbyStatus === 'waiting'}
                        >
                            {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                        </button>
                        <button
                            className={`btn-media ${camOn ? 'btn-media-on' : 'btn-media-off'}`}
                            onClick={() => setCamOn(!camOn)}
                            aria-label={camOn ? 'Turn off camera' : 'Turn on camera'}
                            disabled={lobbyStatus === 'waiting'}
                        >
                            {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                        </button>
                    </div>
                </div>

                {/* Action area */}
                <div className="waiting-room-actions">
                    {lobbyStatus === 'idle' && (
                        <button
                            className="btn-lobby btn-lobby-primary btn-request-join"
                            onClick={handleRequest}
                            aria-label="Request to join meeting"
                        >
                            <UserCheck size={18} />
                            Request to Join
                        </button>
                    )}

                    {lobbyStatus === 'requesting' && (
                        <button className="btn-lobby btn-lobby-loading" disabled>
                            <Loader2 size={18} className="spinner" />
                            Sending request…
                        </button>
                    )}

                    {lobbyStatus === 'waiting' && (
                        <div className="waiting-state" aria-live="polite">
                            <div className="waiting-indicator">
                                <Clock size={20} className="pulse" />
                                <div className="waiting-text">
                                    <span className="waiting-label">Waiting for host approval</span>
                                    <span className="waiting-timer">{formatTime(elapsed)}</span>
                                </div>
                            </div>
                            <p className="waiting-copy">
                                The host will let you in soon. Please wait.
                            </p>
                            <button
                                className="btn-lobby btn-lobby-ghost"
                                onClick={onCancel}
                                aria-label="Cancel join request"
                            >
                                Cancel Request
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
