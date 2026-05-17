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
                className="w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border-medium)] rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)]">
                    <h3 className="text-lg font-bold text-[var(--text-primary)]">Participant Actions</h3>
                    <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent text-3xl font-bold mb-4 shadow-lg shadow-accent/10">
                        {participant.userName[0].toUpperCase()}
                    </div>
                    <h4 className="text-xl font-bold text-[var(--text-primary)] mb-1">{participant.userName}</h4>
                    <p className="text-xs text-[var(--text-muted)] mb-6 tracking-wider uppercase font-bold">Online Participant</p>

                    <div className="w-full grid grid-cols-2 gap-3">
                        <button
                            onClick={() => onAction(participant.isPinned ? 'unpin' : 'pin', participant.socketId)}
                            className="flex flex-col items-center gap-2 p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-[var(--border-subtle)] rounded-2xl transition-all group"
                        >
                            {participant.isPinned ? <PinOff size={20} className="text-accent" /> : <Pin size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]/80">{participant.isPinned ? 'Unpin' : 'Pin'}</span>
                        </button>

                        <button
                            onClick={() => onAction('mute', participant.socketId)}
                            className="flex flex-col items-center gap-2 p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-[var(--border-subtle)] rounded-2xl transition-all group"
                        >
                            {participant.isMicOn ? <Mic size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" /> : <MicOff size={20} className="text-accent-danger" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]/80">{participant.isMicOn ? 'Mute' : 'Muted'}</span>
                        </button>

                        <button
                            onClick={() => onAction('disable-camera', participant.socketId)}
                            className="flex flex-col items-center gap-2 p-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-[var(--border-subtle)] rounded-2xl transition-all group"
                        >
                            {participant.isCamOn ? <Video size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]" /> : <VideoOff size={20} className="text-accent-danger" />}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]/80">{participant.isCamOn ? 'Stop Video' : 'Video Off'}</span>
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

                <div className="p-4 bg-black/[0.02] dark:bg-white/5 border-t border-[var(--border-subtle)] flex justify-center">
                    <button 
                        onClick={onClose}
                        className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all uppercase tracking-[0.2em]"
                    >
                        Close Menu
                    </button>
                </div>
            </div>
        </div>
    );
}
