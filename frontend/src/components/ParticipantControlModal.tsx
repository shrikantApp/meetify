import { X, Mic, MicOff, Video, VideoOff, UserMinus, Pin, PinOff } from 'lucide-react';

interface ParticipantControlModalProps {
    isOpen: boolean;
    onClose: () => void;
    participant: {
        socketId: string;
        userName: string;
        isMicOn: boolean;
        isCamOn: boolean;
        isPinned: boolean;
    } | null;
    onAction: (action: string, targetSocketId: string) => void;
}

export default function ParticipantControlModal({
    isOpen,
    onClose,
    participant,
    onAction,
}: ParticipantControlModalProps) {
    if (!isOpen || !participant) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="w-full max-w-sm bg-bg-card border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h3 className="text-lg font-bold text-white">Participant Actions</h3>
                    <button onClick={onClose} className="p-2 text-white/30 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent text-3xl font-bold mb-4 shadow-lg shadow-accent/10">
                        {participant.userName[0].toUpperCase()}
                    </div>
                    <h4 className="text-xl font-bold text-white mb-1">{participant.userName}</h4>
                    <p className="text-xs text-white/30 mb-6 tracking-wider uppercase font-bold">Online Participant</p>

                    <div className="w-full grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onAction(participant.isPinned ? 'unpin' : 'pin', participant.socketId)}
                            className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group"
                        >
                            {participant.isPinned ? <PinOff size={20} className="text-accent" /> : <Pin size={20} className="text-white/60 group-hover:text-white" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{participant.isPinned ? 'Unpin' : 'Pin'}</span>
                        </button>

                        <button
                            onClick={() => onAction('mute', participant.socketId)}
                            className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group"
                        >
                            {participant.isMicOn ? <Mic size={20} className="text-white/60 group-hover:text-white" /> : <MicOff size={20} className="text-accent-danger" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{participant.isMicOn ? 'Mute' : 'Muted'}</span>
                        </button>

                        <button
                            onClick={() => onAction('disable-camera', participant.socketId)}
                            className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group"
                        >
                            {participant.isCamOn ? <Video size={20} className="text-white/60 group-hover:text-white" /> : <VideoOff size={20} className="text-accent-danger" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">{participant.isCamOn ? 'Stop Video' : 'Video Off'}</span>
                        </button>

                        <button
                            onClick={() => onAction('remove-participant', participant.socketId)}
                            className="flex flex-col items-center gap-2 p-4 bg-accent-danger/10 hover:bg-accent-danger/20 border border-accent-danger/10 rounded-2xl transition-all group"
                        >
                            <UserMinus size={20} className="text-accent-danger" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-danger">Remove</span>
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-white/5 border-t border-white/5 flex justify-center">
                    <button 
                        onClick={onClose}
                        className="text-xs font-bold text-white/40 hover:text-white transition-all uppercase tracking-[0.2em]"
                    >
                        Close Menu
                    </button>
                </div>
            </div>
        </div>
    );
}
