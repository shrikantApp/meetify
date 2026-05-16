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



    // ── IDLE / REQUESTING / WAITING STATE ─────────────────────────────────

    return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 relative overflow-hidden">
            {/* Mesh Gradient Background Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent-success/5 blur-[150px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center animate-in fade-in slide-in-from-bottom-12 duration-1000 cubic-bezier(0.16, 1, 0.3, 1)">

                {/* Left side: Preview */}
                <div className="flex flex-col gap-6">
                    <div className="relative aspect-video rounded-3xl overflow-hidden bg-bg-card border border-white/10 shadow-2xl group">
                        {camOn ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover mirror"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-bg-secondary to-bg-card">
                                <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                                    <UserCheck size={40} />
                                </div>
                                <span className="text-text-secondary font-medium">Camera is off</span>
                            </div>
                        )}

                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <button
                                onClick={() => setMicOn(!micOn)}
                                className={`p-3 rounded-xl transition-all ${micOn ? 'bg-white/10 text-white' : 'bg-accent-danger text-white'}`}
                                disabled={lobbyStatus === 'waiting'}
                            >
                                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>
                            <button
                                onClick={() => setCamOn(!camOn)}
                                className={`p-3 rounded-xl transition-all ${camOn ? 'bg-white/10 text-white' : 'bg-accent-danger text-white'}`}
                                disabled={lobbyStatus === 'waiting'}
                            >
                                {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                            </button>
                        </div>
                    </div>
                    <div className="px-4 flex items-center gap-3 text-text-secondary">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-success animate-pulse" />
                        <p className="text-sm font-medium">Your camera and mic are working</p>
                    </div>
                </div>

                {/* Right side: Actions */}
                <div className="glass-panel p-12 rounded-[3rem] shadow-2xl relative overflow-hidden border-white/10">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full" />
                    
                    <div className="mb-10 relative z-10">
                        <h1 className="text-4xl font-extrabold text-white mb-3 leading-tight tracking-tight">
                            {meetingTitle || 'Meeting Room'}
                        </h1>
                        <p className="text-text-secondary text-lg font-medium opacity-80">Ready to join the conversation?</p>
                    </div>


                    <div className="space-y-6">
                        {lobbyStatus === 'idle' && (
                            <button
                                onClick={handleRequest}
                                className="w-full py-4 bg-accent hover:bg-accent-hover text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-accent/30 transition-all active:scale-[0.98]"
                            >
                                <UserCheck size={20} />
                                Request to Join
                            </button>
                        )}

                        {lobbyStatus === 'requesting' && (
                            <button className="w-full py-4 bg-white/5 text-white/50 rounded-2xl font-bold flex items-center justify-center gap-3 cursor-wait">
                                <Loader2 size={20} className="animate-spin" />
                                Sending request...
                            </button>
                        )}

                        {lobbyStatus === 'waiting' && (
                            <div className="space-y-8 animate-in fade-in zoom-in duration-700">
                                <div className="flex items-center gap-5 p-5 glass-panel !bg-accent/5 border-accent/20 rounded-[2rem]">
                                    <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/40">
                                        <Clock size={28} className="animate-pulse" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-base font-black text-accent uppercase tracking-widest">Waiting for host</span>
                                        <span className="text-xs text-text-secondary font-mono opacity-60">Elapsed: {formatTime(elapsed)}</span>
                                    </div>
                                </div>
                                <p className="text-sm text-text-secondary leading-relaxed font-medium">
                                    The meeting host has been notified. Hang tight, they'll let you in any moment now.
                                </p>
                                <button
                                    onClick={onCancel}
                                    className="w-full py-4 text-xs font-black text-white/30 hover:text-white transition-all uppercase tracking-[0.2em] hover:bg-white/5 rounded-2xl border border-transparent hover:border-white/5"
                                >
                                    Cancel Request
                                </button>
                            </div>
                        )}


                        {lobbyStatus === 'denied' && (
                            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                                <div className="flex items-center gap-4 p-4 bg-accent-danger/10 border border-accent-danger/20 rounded-2xl">
                                    <div className="w-12 h-12 rounded-xl bg-accent-danger flex items-center justify-center text-white shadow-lg shadow-accent-danger/40">
                                        <XCircle size={24} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-accent-danger">Entry Declined</span>
                                        <p className="text-xs text-text-secondary mt-1">{deniedReason || 'The host declined your request.'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onRetry}
                                    className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold transition-all"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
