
import {
    Mic, MicOff, Video, VideoOff, Monitor,
    Hand, Users, PhoneOff, Settings
} from 'lucide-react';

interface MeetingControlsProps {
    isMicOn: boolean;
    isCamOn: boolean;
    isScreenSharing: boolean;
    handRaised: boolean;
    showSidebar: boolean;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onToggleScreenShare: () => void;
    onToggleHand: () => void;
    onToggleSidebar: () => void;
    onOpenSettings: () => void;
    onLeave: () => void;
}

export default function MeetingControls({
    isMicOn,
    isCamOn,
    isScreenSharing,
    handRaised,
    showSidebar,
    onToggleMic,
    onToggleCam,
    onToggleScreenShare,
    onToggleHand,
    onToggleSidebar,
    onOpenSettings,
    onLeave,
}: MeetingControlsProps) {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-4 bg-bg-card/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in slide-in-from-bottom-8 duration-700">
            {/* Media Controls */}
            <div className="flex items-center gap-3 pr-4 border-r border-white/10">
                <button
                    onClick={onToggleMic}
                    className={`group relative p-3.5 rounded-full transition-all duration-300 ${isMicOn ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-accent-danger text-white shadow-lg shadow-accent-danger/20'}`}
                >
                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {isMicOn ? 'Mute' : 'Unmute'} (Ctrl+D)
                    </div>
                </button>

                <button
                    onClick={onToggleCam}
                    className={`group relative p-3.5 rounded-full transition-all duration-300 ${isCamOn ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-accent-danger text-white shadow-lg shadow-accent-danger/20'}`}
                >
                    {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {isCamOn ? 'Stop Video' : 'Start Video'} (Ctrl+E)
                    </div>
                </button>
            </div>

            {/* Feature Controls */}
            <div className="flex items-center gap-3 px-4 border-r border-white/10">
                <button
                    onClick={onToggleScreenShare}
                    className={`group relative p-3.5 rounded-full transition-all duration-300 ${isScreenSharing ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                >
                    <Monitor size={20} />
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        {isScreenSharing ? 'Stop Presenting' : 'Present now'}
                    </div>
                </button>

                <button
                    onClick={onToggleHand}
                    className={`group relative p-3.5 rounded-full transition-all duration-300 ${handRaised ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-white/5 hover:bg-white/10 text-white italic'}`}
                >
                    <Hand size={20} />
                    {handRaised && <span className="absolute -top-1 -right-1 flex h-3 w-3 rounded-full bg-accent animate-ping" />}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Raise hand
                    </div>
                </button>

                <button
                    onClick={onOpenSettings}
                    className="group relative p-3.5 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all"
                >
                    <Settings size={20} />
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Settings
                    </div>
                </button>
            </div>

            {/* Utility Controls */}
            <div className="flex items-center gap-3 pl-4">
                <button
                    onClick={onToggleSidebar}
                    className={`group relative p-3.5 rounded-full transition-all duration-300 ${showSidebar ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                >
                    <Users size={20} />
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Meeting details
                    </div>
                </button>

                <button
                    onClick={onLeave}
                    className="group relative p-3.5 bg-accent-danger hover:bg-accent-danger/80 text-white rounded-full shadow-lg shadow-accent-danger/40 transition-all active:scale-90"
                >
                    <PhoneOff size={20} />
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                        Leave call
                    </div>
                </button>
            </div>
        </div>
    );
}
