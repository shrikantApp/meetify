import { MicOff, User, Pin } from 'lucide-react';
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
    onClick?: () => void;
    onContextMenu?: () => void;
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
    onClick,
    onContextMenu,
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
            className={`participant-video relative w-full h-full bg-[#1e2130] border-2 rounded-2xl overflow-hidden transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.3)] group cursor-pointer ${isActiveSpeaker ? 'border-accent shadow-accent/20 scale-[1.01] z-10' : isPinned ? 'border-accent shadow-accent/20' : 'border-white/5'} ${className}`}
            data-username={userName}
            data-iscamon={isCamOn}
            data-ismicon={isMicOn}
            data-islocal={isLocal}
            data-ismirrored={isMirrored}
            data-isscreenshare={isScreenShare}
        >
            {/* Video Element - Modularized */}
            {stream && (
                isLocal ? (
                    <LocalVideo
                        stream={stream}
                        isMirrored={isMirrored && !isScreenShare} // Fix: Ensure screen share is NOT mirrored
                        isScreenShare={isScreenShare}
                        className={(isCamOn || isScreenShare) ? `opacity-100 w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'} transition-opacity duration-700` : 'opacity-[0.01] absolute w-1 h-1 pointer-events-none'}
                    />
                ) : (
                    <RemoteVideo
                        stream={stream}
                        isScreenShare={isScreenShare}
                        className={(isCamOn || isScreenShare) ? `opacity-100 w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'} transition-opacity duration-700` : 'opacity-[0.01] absolute w-1 h-1 pointer-events-none'}
                    />
                )
            )}

            {/* Placeholder - Shown when neither camera nor screen share is on */}
            {(!isCamOn && !isScreenShare || !stream) && (
                <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#1a1e35] to-[#0d0f18] z-10">
                    <div className="rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold shadow-2xl shadow-accent/5 transition-all duration-700 group-hover:scale-110" style={{ width: 'min(120px, 30%)', aspectRatio: '1/1', fontSize: 'min(48px, 40px)' }}>
                        {userName ? userName[0].toUpperCase() : <User />}
                    </div>
                    {!isCamOn && !isScreenShare && (
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/5 text-[10px] font-bold text-white/40 tracking-widest uppercase">
                            Camera is off
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Overlay (Name & Status) */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20 transition-all duration-300 pointer-events-none">
                <div className="flex items-center gap-3 px-3 py-1.5 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl group-hover:bg-black/60 transition-colors">
                    <span className="text-xs font-bold text-white/90 tracking-tight">
                        {userName} {isLocal && "(You)"}
                    </span>
                    {!isMicOn && (
                        <div className="p-1 px-1.5 bg-red-500/20 rounded-lg text-red-500 border border-red-500/20">
                            <MicOff size={10} />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isActiveSpeaker && isMicOn && (
                        <div className="flex gap-1 items-end h-3 px-2 py-1.5 bg-accent/20 backdrop-blur-md rounded-lg border border-accent/20">
                            <div className="w-1 bg-accent rounded-full animate-[sound-bar_0.8s_ease-in-out_infinite] px-0.5" />
                            <div className="w-1 bg-accent rounded-full animate-[sound-bar_1.2s_ease-in-out_infinite] px-0.5" />
                            <div className="w-1 bg-accent rounded-full animate-[sound-bar_1s_ease-in-out_infinite] px-0.5" />
                        </div>
                    )}
                    {isPinned && (
                        <div className="p-2 bg-accent/20 rounded-xl text-accent border border-accent/20 backdrop-blur-md">
                            <Pin size={12} className="fill-accent" />
                        </div>
                    )}
                </div>
            </div>

            {/* Speaking Pulse (for active speaker) */}
            {isActiveSpeaker && isMicOn && (
                <div className="absolute inset-0 pointer-events-none border-[3px] border-accent/30 rounded-2xl animate-pulse" />
            )}
        </div>
    );
}
