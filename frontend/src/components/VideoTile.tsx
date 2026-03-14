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
            className={`participant-video relative w-full h-full bg-bg-card border-2 rounded-2xl overflow-hidden transition-all duration-500 shadow-2xl group cursor-pointer ${isActiveSpeaker ? 'border-accent shadow-accent/20 scale-[1.01] z-10' : isPinned ? 'border-accent shadow-accent/20' : 'border-white/5'} ${className}`}
            data-username={userName}
            data-iscamon={isCamOn}
            data-ismicon={isMicOn}
            data-islocal={isLocal}
            data-ismirrored={isMirrored}
        >
            {/* Video Element - Modularized */}
            {stream && (
                isLocal ? (
                    <LocalVideo
                        stream={stream}
                        isMirrored={isMirrored}
                        isScreenShare={isScreenShare}
                        className={(isCamOn || isScreenShare) ? 'opacity-100 w-full h-full object-cover' : 'opacity-[0.01] absolute w-1 h-1 pointer-events-none'}
                    />
                ) : (
                    <RemoteVideo
                        stream={stream}
                        isScreenShare={isScreenShare}
                        className={(isCamOn || isScreenShare) ? 'opacity-100 w-full h-full object-cover' : 'opacity-[0.01] absolute w-1 h-1 pointer-events-none'}
                    />
                )
            )}

            {/* Placeholder - Shown when neither camera nor screen share is on */}
            {(!isCamOn && !isScreenShare || !stream) && (
                <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-bg-secondary to-bg-card z-10">
                    <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center text-accent text-4xl font-bold shadow-lg shadow-accent/10 transition-transform duration-500 group-hover:scale-110">
                        {userName ? userName[0].toUpperCase() : <User />}
                    </div>
                    {!isCamOn && !isScreenShare && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-white/60 tracking-wider uppercase">
                            Camera is off
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Overlay (Name & Status) */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20 transition-all duration-300 pointer-events-none">
                <div className="flex items-center gap-3 px-3 py-2 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 shadow-lg">
                    <span className="text-xs font-bold text-white drop-shadow-md">
                        {userName} {isLocal && "(You)"}
                    </span>
                    {!isMicOn && (
                        <div className="p-1.5 bg-accent-danger/20 rounded-lg text-accent-danger border border-accent-danger/20">
                            <MicOff size={12} />
                        </div>
                    )}
                </div>

                {isActiveSpeaker && isMicOn && (
                    <div className="flex gap-1 items-end h-3 px-2">
                        <div className="w-1 bg-accent rounded-full animate-[sound-bar_0.8s_ease-in-out_infinite] px-0.5" />
                        <div className="w-1 bg-accent rounded-full animate-[sound-bar_1.2s_ease-in-out_infinite] px-0.5" />
                        <div className="w-1 bg-accent rounded-full animate-[sound-bar_1s_ease-in-out_infinite] px-0.5" />
                    </div>
                )}
                {isPinned && (
                    <div className="p-2 bg-accent/20 rounded-xl text-accent border border-accent/20 backdrop-blur-md">
                        <Pin size={14} className="fill-accent" />
                    </div>
                )}
            </div>

            {/* Speaking Pulse (for active speaker) */}
            {isActiveSpeaker && isMicOn && (
                <div className="absolute inset-0 pointer-events-none border-[3px] border-accent/40 rounded-2xl animate-pulse" />
            )}
        </div>
    );
}
