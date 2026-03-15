import { MicOff, User, Pin, PinOff } from 'lucide-react';
import LocalVideo from './LocalVideo';
import RemoteVideo from './RemoteVideo';

interface VideoTileProps {
    stream?: MediaStream;
    userName: string;
    isLocal?: boolean;
    isMicOn: boolean;
    isCamOn: boolean;
    isMirrored?: boolean;
    isActiveSpeaker?: boolean;
    className?: string;
    isScreenShare?: boolean;
    isPinned?: boolean;
    isSpotlight?: boolean;
    onClick?: () => void;
    onContextMenu?: () => void;
    onPin?: () => void;
}

export default function VideoTile({
    stream,
    userName,
    isLocal,
    isMicOn,
    isCamOn,
    isActiveSpeaker,
    className = "",
    isScreenShare,
    isMirrored,
    isPinned,
    isSpotlight,
    onClick,
    onContextMenu,
    onPin,
}: VideoTileProps) {
    return (
        <div
            onClick={onClick}
            onContextMenu={(e) => {
                if (onContextMenu) {
                    e.preventDefault();
                    onContextMenu();
                }
            }}
            className={`participant-video relative w-full h-full bg-slate-900 border-2 rounded-2xl overflow-hidden transition-all duration-500 shadow-lg group cursor-pointer ${isActiveSpeaker ? 'border-accent shadow-[0_0_20px_rgba(108,99,255,0.3)] z-10' : isPinned ? 'border-accent/40 shadow-accent/10' : 'border-white/5'} ${className}`}
            data-username={userName}
            data-iscamon={isCamOn}
            data-ismicon={isMicOn}
            data-islocal={isLocal}
            data-ismirrored={isMirrored}
            data-isscreenshare={isScreenShare}
            data-isspotlight={isSpotlight}
        >
            {/* Inner Depth Shadow */}
            <div className="absolute inset-0 z-[5] pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] opacity-50" />

            {/* Video Element - Modularized */}
            {/* Video Element - Only render if we have a stream and it has actual video tracks */}
            {stream && (isCamOn || isScreenShare) && stream.getVideoTracks().length > 0 && (
                isLocal ? (
                    <LocalVideo
                        stream={stream}
                        isMirrored={isMirrored && !isScreenShare}
                        isScreenShare={isScreenShare}
                        className="opacity-100 w-full h-full transition-opacity duration-700"
                    />
                ) : (
                    <RemoteVideo
                        stream={stream}
                        isScreenShare={isScreenShare}
                        className="opacity-100 w-full h-full transition-opacity duration-700"
                    />
                )
            )}

            {/* Placeholder - Shown if camera is off, OR if we are waiting for the video track to arrive */}
            {(!isCamOn && !isScreenShare || !stream || stream.getVideoTracks().length === 0) && (
                <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-900 to-bg-primary z-10 overflow-hidden">
                    <div className="absolute inset-0 opacity-20 animate-pulse bg-[radial-gradient(circle_at_center,var(--accent)_0%,transparent_70%)]" />
                    <div className="relative z-10 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold shadow-2xl transition-all duration-700 group-hover:scale-105" style={{ width: 'min(120px, 30%)', aspectRatio: '1/1', fontSize: 'min(48px, 40px)' }}>
                        {userName ? userName[0].toUpperCase() : <User />}
                    </div>
                    {!isCamOn && !isScreenShare ? (
                        <div className="relative z-10 flex items-center gap-2 px-4 py-1.5 glass-panel rounded-full text-[10px] font-bold text-white/40 tracking-widest uppercase">
                            Camera is off
                        </div>
                    ) : (
                        <div className="relative z-10 flex items-center gap-3 px-4 py-1.5 glass-panel rounded-full text-[10px] font-bold text-accent tracking-widest uppercase animate-pulse">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                            Connecting...
                        </div>
                    )}
                </div>
            )}

            {/* Pin Button - Top Right (visible on hover) */}
            {onPin && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPin(); }}
                    className={`absolute top-4 right-4 z-30 p-2.5 rounded-xl transition-all duration-300 ${isPinned
                        ? 'bg-accent text-white shadow-lg opacity-100'
                        : 'glass-button text-white/60 opacity-0 group-hover:opacity-100 hover:text-white'
                        }`}
                >
                    {isPinned ? <PinOff size={14} className="fill-current" /> : <Pin size={14} />}
                </button>
            )}

            {/* Bottom Overlay (Name & Status) */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20 transition-all duration-300 pointer-events-none">
                <div className="flex items-center gap-3 px-3.5 py-1.5 glass-panel rounded-xl shadow-2xl transition-all group-hover:bg-white/[0.08]">
                    <span className="text-xs font-bold text-white tracking-tight">
                        {userName} {isLocal && "(You)"}
                    </span>
                    {!isMicOn && (
                        <div className="p-1 px-1.5 bg-accent-danger/20 rounded-lg text-accent-danger border border-accent-danger/20">
                            <MicOff size={10} />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isActiveSpeaker && isMicOn && (
                        <div className="flex gap-1 items-end h-3 px-2 py-1.5 bg-accent-success/20 backdrop-blur-md rounded-lg border border-accent-success/20">
                            <div className="w-1 bg-accent-success rounded-full animate-[sound-bar_0.8s_ease-in-out_infinite] px-0.5" />
                            <div className="w-1 bg-accent-success rounded-full animate-[sound-bar_1.2s_ease-in-out_infinite] px-0.5" />
                            <div className="w-1 bg-accent-success rounded-full animate-[sound-bar_1s_ease-in-out_infinite] px-0.5" />
                        </div>
                    )}
                    {isPinned && !isActiveSpeaker && (
                        <div className="p-2 glass-panel rounded-xl text-accent border border-accent/20">
                            <Pin size={12} className="fill-accent" />
                        </div>
                    )}
                </div>
            </div>

            {/* Speaking Pulse (for active speaker) */}
            {isActiveSpeaker && isMicOn && (
                <div className="absolute inset-0 pointer-events-none border-[3px] border-accent/40 rounded-2xl animate-pulse z-40" />
            )}
        </div>
    );
}
