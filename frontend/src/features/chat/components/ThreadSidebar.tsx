import { useAppSelector, useAppDispatch } from '../../../redux/store';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { useChatSocket } from '../../../hooks/useChatSocket';
import { addOptimisticMessage } from '../../../redux/chat/chatSlice';
import { X, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  messageId: string;
  onClose: () => void;
}

export function ThreadSidebar({ messageId, onClose }: Props) {
  const dispatch = useAppDispatch();
  const rootMessage = useAppSelector(state => 
    Object.values(state.chat.messages).flat().find(m => m.id === messageId)
  );
  const replies = useAppSelector(state => 
    Object.values(state.chat.messages).flat().filter(m => m.parentMessageId === messageId)
  );
  const currentUser = useAppSelector(state => state.auth.userProfile);
  const { emit } = useChatSocket();

  if (!rootMessage) return null;

  const handleSendReply = (content: string) => {
    if (!currentUser) return;
    
    const tempId = `temp_thread_${Date.now()}`;
    const msgData = {
      conversationId: rootMessage.conversationId,
      parentMessageId: messageId,
      content,
      type: 'text',
      tempId
    };

    dispatch(addOptimisticMessage({
      ...msgData,
      id: tempId,
      senderId: currentUser.id,
      sender: { id: currentUser.id, name: currentUser.name },
      deliveryStatus: 'sending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEdited: false,
      isDeleted: false,
      deletedForEveryone: false,
    } as any));

    emit('send_message', msgData);
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-[320px] flex-shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-sidebar)] flex flex-col overflow-hidden z-40"
    >
      {/* Header */}
      <div className="h-[48px] px-4 flex items-center justify-between border-b border-[var(--border-subtle)] glass-morphism">
        <div className="flex items-center gap-2">
           <h3 className="font-bold text-sm text-[var(--text-primary)]">Thread</h3>
           <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-[var(--border-subtle)]">
             <Hash className="w-2.5 h-2.5 text-[var(--text-muted)]" />
             <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">general</span>
           </div>
        </div>
        <button 
          onClick={onClose} 
          className="chat-icon-button chat-icon-button-muted p-1.5 rounded-xl transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="py-2">
          {/* Root Message */}
          <div className="border-b border-[var(--border-subtle)] pb-2 mb-2">
             <MessageBubble message={rootMessage} isOwn={rootMessage.senderId === currentUser?.id} />
          </div>

          {/* Replies Section Header */}
          <div className="px-4 py-1 flex items-center gap-2">
             <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest whitespace-nowrap">
               {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
             </span>
             <div className="flex-1 h-px bg-[var(--border-subtle)]"></div>
          </div>

          {/* Replies List */}
          <div className="space-y-0.5 mt-1">
             <AnimatePresence initial={false}>
               {replies.map(reply => (
                 <MessageBubble 
                   key={reply.id} 
                   message={reply} 
                   isOwn={reply.senderId === currentUser?.id} 
                 />
               ))}
             </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]">
        <MessageInput onSend={handleSendReply} onTyping={() => {}} placeholder="Reply to thread..." />
      </div>
    </motion.div>
  );
}
