import {
    Mic, MicOff, Video, VideoOff, Monitor,
    Hand, Users, PhoneOff, Settings, Circle, Play, Pause
} from 'lucide-react';

interface MeetingControlsProps {
    isMicOn: boolean;
    isCamOn: boolean;
    isScreenSharing: boolean;
    handRaised: boolean;
    showSidebar: boolean;
    isHost: boolean;
    isRecording: boolean;
    isPaused: boolean;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onToggleScreenShare: () => void;
    onToggleHand: () => void;
    onToggleSidebar: () => void;
    onOpenSettings: () => void;
    onToggleRecording: () => void;
    onPauseRecording: () => void;
    onResumeRecording: () => void;
    onLeave: () => void;
}

export default function MeetingControls({
    isMicOn,
    isCamOn,
    isScreenSharing,
    handRaised,
    showSidebar,
    isHost,
    isRecording,
    isPaused,
    onToggleMic,
    onToggleCam,
    onToggleScreenShare,
    onToggleHand,
    onToggleSidebar,
    onOpenSettings,
    onToggleRecording,
    onPauseRecording,
    onResumeRecording,
    onLeave,
}: MeetingControlsProps) {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-4 glass-panel rounded-[2rem] z-50 animate-in slide-in-from-bottom-12 duration-1000 ease-out transition-all">
            {/* Media Controls */}
            <div className="flex items-center gap-4 pr-5 border-r border-white/5">
                <button
                    onClick={onToggleMic}
                    style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                    className={`group relative flex items-center justify-center rounded-full transition-all duration-500 hover:scale-110 active:scale-95 ${isMicOn ? 'glass-button text-white' : 'bg-accent-danger text-white shadow-xl shadow-red-500/20'}`}
                >
                    {isMicOn ? <Mic size={'var(--ui-icon-size)'} className="transition-transform group-hover:rotate-12" /> : <MicOff size={'var(--ui-icon-size)'} />}
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                        {isMicOn ? 'Mute' : 'Unmute'} (Ctrl+D)
                    </div>
                </button>

                <button
                    onClick={onToggleCam}
                    style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                    className={`group relative flex items-center justify-center rounded-full transition-all duration-500 hover:scale-110 active:scale-95 ${isCamOn ? 'glass-button text-white' : 'bg-accent-danger text-white shadow-xl shadow-red-500/20'}`}
                >
                    {isCamOn ? <Video size={'var(--ui-icon-size)'} className="transition-transform group-hover:rotate-12" /> : <VideoOff size={'var(--ui-icon-size)'} />}
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                        {isCamOn ? 'Stop Video' : 'Start Video'} (Ctrl+E)
                    </div>
                </button>
            </div>

            {/* Feature Controls */}
            <div className="flex items-center gap-4 px-5 border-r border-white/5">
                <button
                    onClick={onToggleScreenShare}
                    style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                    className={`group relative flex items-center justify-center rounded-full transition-all duration-500 hover:scale-110 active:scale-95 ${isScreenSharing ? 'bg-accent text-white shadow-2xl shadow-accent/40 scale-110' : 'glass-button text-white'}`}
                >
                    <Monitor size={'var(--ui-icon-size)'} className={isScreenSharing ? 'animate-pulse' : ''} />
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                        {isScreenSharing ? 'Stop Presenting' : 'Present now'}
                    </div>
                </button>

                <button
                    onClick={onToggleHand}
                    style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                    className={`group relative flex items-center justify-center rounded-full transition-all duration-500 hover:scale-110 active:scale-95 ${handRaised ? 'bg-accent text-white shadow-2xl shadow-accent/40 scale-110' : 'glass-button text-white'}`}
                >
                    <Hand size={'var(--ui-icon-size)'} className={handRaised ? 'animate-bounce' : ''} />
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                        {handRaised ? 'Lower hand' : 'Raise hand'}
                    </div>
                </button>

                <button
                    onClick={onOpenSettings}
                    style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                    className="group relative flex items-center justify-center glass-button text-white rounded-full transition-all duration-500 hover:scale-110 active:scale-95"
                >
                    <Settings size={'var(--ui-icon-size)'} className="group-hover:rotate-90 transition-transform duration-700" />
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                        Settings
                    </div>
                </button>

                {isHost && (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onToggleRecording}
                            style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                            className={`group relative flex items-center justify-center rounded-full transition-all duration-500 hover:scale-110 active:scale-95 ${isRecording ? 'bg-accent-danger text-white shadow-2xl shadow-red-600/40' : 'glass-button text-white'}`}
                        >
                            <Circle size={'var(--ui-icon-size)'} className={isRecording ? 'fill-current animate-pulse' : ''} />
                            <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                                {isRecording ? 'Stop Recording' : 'Record Meeting'}
                            </div>
                        </button>
                        
                        {isRecording && (
                            <button
                                onClick={isPaused ? onResumeRecording : onPauseRecording}
                                style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                                className="group relative flex items-center justify-center glass-button text-white rounded-full transition-all duration-500 hover:scale-110 active:scale-95"
                            >
                                {isPaused ? <Play size={'var(--ui-icon-size)'} className="fill-current" /> : <Pause size={'var(--ui-icon-size)'} className="fill-current" />}
                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                                    {isPaused ? 'Resume Recording' : 'Pause Recording'}
                                </div>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Utility Controls */}
            <div className="flex items-center gap-4 pl-5">
                <button
                    onClick={onToggleSidebar}
                    style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                    className={`group relative flex items-center justify-center rounded-full transition-all duration-500 hover:scale-110 active:scale-95 ${showSidebar ? 'bg-accent/20 text-accent border border-accent/20' : 'glass-button text-white'}`}
                >
                    <Users size={'var(--ui-icon-size)'} />
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                        Meeting details
                    </div>
                </button>

                <button
                    onClick={onLeave}
                    style={{ width: 'var(--ui-button-size)', height: 'var(--ui-button-size)' }}
                    className="group relative flex items-center justify-center bg-accent-danger hover:bg-red-500 text-white rounded-full shadow-2xl shadow-red-600/50 transition-all duration-500 hover:scale-110 active:scale-90 border border-white/10"
                >
                    <PhoneOff size={'var(--ui-icon-size)'} />
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap translate-y-2 group-hover:translate-y-0 shadow-2xl border border-white/10">
                        Leave call
                    </div>
                </button>
            </div>
        </div>
    );
}
