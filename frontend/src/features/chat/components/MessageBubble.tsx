import { format } from 'date-fns';
import { MessageInput } from './MessageInput';
import { MessageStatusIcon } from './MessageStatusIcon';
import type { Message, Attachment } from '../../../redux/chat/chatSlice';
import { FileText, Download, Smile, MessageSquare, Edit2, Trash2, MoreHorizontal, Headphones } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { toggleReaction, editMessage, deleteMessage } from '../../../redux/chat/chatThunks';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import { meetingApi } from '../../../services/meetingApi';
import { Tooltip } from '../../../components/ui';

interface Props {
  message: Message;
  isOwn: boolean;
  showAvatar?: boolean;
  onReply?: () => void;
}

export function MessageBubble({ message, isOwn, showAvatar = true, onReply }: Props) {
  const dispatch = useAppDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const timeStr = format(new Date(message.createdAt), 'h:mm a');
  const currentUser = useAppSelector(state => state.auth.userProfile);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleEdit = (newContent: string) => {
    if (newContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    dispatch(editMessage({ messageId: message.id, content: newContent.trim() }));
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this message?')) {
      dispatch(deleteMessage({ messageId: message.id, conversationId: message.conversationId, forEveryone: true }));
    }
  };

  const handleReact = (emoji: string) => {
    dispatch(toggleReaction({ messageId: message.id, conversationId: message.conversationId, emoji }));
    setShowEmojiPicker(false);
  };

  const isMeeting = message.content?.includes('Join my video call:');

  if (message.deletedForEveryone) {
    return (
      <div className="flex w-full py-2 px-6 text-xs italic text-[var(--text-muted)] opacity-50">
        This message was deleted
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex w-full group relative py-0.5 px-4 md:px-5 transition-colors hover:bg-white/[0.02] ${!showAvatar && !isMeeting ? 'mt-[-2px]' : 'mt-1.5'}`}
    >
      {/* Avatar / Icon / Time Column */}
      <div className="w-9 flex-shrink-0 flex flex-col items-center">
        {isMeeting ? (
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] shadow-sm">
            <Headphones className="w-4 h-4" />
          </div>
        ) : showAvatar ? (
          ((message.sender as any)?.avatarUrl || (message.sender as any)?.avatar) ? (
            <img
              src={((message.sender as any)?.avatarUrl || (message.sender as any)?.avatar) as string}
              alt={message.sender?.name || 'User'}
              className="w-8 h-8 rounded-lg object-cover border border-[var(--border-subtle)] shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-bold text-[var(--text-primary)] shadow-sm">
              {message.sender?.name?.charAt(0).toUpperCase() || '?'}
            </div>
          )
        ) : (
          <div className="text-[9px] text-[var(--text-muted)] font-bold opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
             {format(new Date(message.createdAt), 'HH:mm')}
          </div>
        )}
      </div>

      {/* Content Column */}
      <div className="flex-1 min-w-0 ml-2.5">
        {(showAvatar || isMeeting) && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[13px] font-bold text-[var(--text-primary)] cursor-pointer hover:underline">
              {isMeeting ? 'A video call started' : (message.sender?.name || 'Unknown User')}
            </span>
            <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {timeStr}
            </span>
          </div>
        )}

        {isEditing ? (
          <div className="mt-1.5 mb-2">
            <MessageInput 
              initialContent={message.content}
              onSend={handleEdit}
              onCancel={() => setIsEditing(false)}
              submitLabel="Save"
            />
            <div className="px-2 pb-1 text-[10px] text-[var(--text-muted)] font-medium">
              Press Escape to <span className="text-[var(--accent-primary)] cursor-pointer" onClick={() => setIsEditing(false)}>cancel</span> • Enter to <span className="text-[var(--accent-primary)] cursor-pointer" onClick={() => handleEdit(message.content || '')}>save</span>
            </div>
          </div>
        ) : (
          <div className={`
            relative inline-block max-w-[85%] md:max-w-[70%] text-[13px] leading-relaxed font-medium transition-all
            ${isOwn ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}
          `}>
            <div className="whitespace-pre-wrap break-words flex flex-wrap items-end gap-1">
              <MessageContent content={message.content || ''} />
              {message.isEdited && <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">(edited)</span>}
            </div>
          </div>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {message.attachments.map((att, index) => (
              <AttachmentPreview key={att.id || index} attachment={att} />
            ))}
          </div>
        )}

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
             {Object.entries(
               message.reactions.reduce((acc, r) => {
                 acc[r.emoji] = (acc[r.emoji] || []);
                 acc[r.emoji].push(r.userId);
                 return acc;
               }, {} as Record<string, string[]>)
             ).map(([emoji, userIds]) => {
                const hasReacted = userIds.includes(currentUser?.id || '');
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={`
                      flex items-center gap-1 px-2 py-0.5 rounded-md border transition-all duration-200
                      ${hasReacted 
                        ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]' 
                        : 'bg-white/5 border-[var(--border-subtle)] hover:border-[var(--text-muted)]'}
                    `}
                  >
                    <span className="text-[11px]">{emoji}</span>
                    <span className="text-[9px] font-bold">{userIds.length}</span>
                  </button>
                );
             })}
          </div>
        )}
      </div>

      {/* Hover Action Menu */}
      <div className="absolute right-6 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-150 z-30">
        <div className="flex items-center gap-0.5 p-1 glass-morphism rounded-xl premium-shadow border border-[var(--border-medium)] bg-[var(--bg-sidebar)]/80">
           <div className="relative" ref={emojiPickerRef}>
              <ActionButton 
                icon={<Smile className="w-4 h-4" />} 
                onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                tooltip="Add reaction" 
              />
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute bottom-full right-0 mb-3 z-50 premium-shadow rounded-2xl overflow-hidden border border-[var(--border-medium)]"
                  >
                    <EmojiPicker 
                      onEmojiClick={(emojiData) => handleReact(emojiData.emoji)}
                      theme={EmojiTheme.DARK}
                      skinTonesDisabled
                      searchDisabled
                      height={350}
                      width={280}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
           <ActionButton icon={<MessageSquare className="w-4 h-4" />} onClick={onReply} tooltip="Reply in thread" />
           {isOwn && <ActionButton icon={<Edit2 className="w-4 h-4" />} onClick={() => setIsEditing(true)} tooltip="Edit message" />}
           {isOwn && <ActionButton icon={<Trash2 className="w-4 h-4 text-rose-500" />} onClick={handleDelete} tooltip="Delete message" />}
           <div className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />
           <ActionButton icon={<MoreHorizontal className="w-4 h-4" />} tooltip="More actions" />
           
           {isOwn && (
             <div className="ml-1 pl-1 border-l border-[var(--border-subtle)] flex items-center pr-1.5">
               <MessageStatusIcon status={message.deliveryStatus} />
             </div>
           )}
        </div>
      </div>
    </motion.div>
  );
}

function MessageContent({ content }: { content: string }) {
  const [meeting, setMeeting] = useState<any>(null);
  const meetingMatch = content?.match(/Join my video call:\s*(https?:\/\/[^\s<]+)/i);
  
  useEffect(() => {
    if (meetingMatch) {
      const code = meetingMatch[1].split('/').pop();
      if (code) {
        meetingApi.getMeetingByCode(code).then(setMeeting).catch(() => {});
      }
    }
  }, [content]);

  if (meetingMatch) {
    const fullUrl = meetingMatch[1];
    const isEnded = !!meeting?.endedAt;
    
    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center gap-3 py-1">
          <button 
            onClick={() => !isEnded && window.open(fullUrl, '_blank')}
            disabled={isEnded}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all border ${
              isEnded 
              ? 'bg-white/5 text-[var(--text-muted)] cursor-not-allowed border-[var(--border-subtle)]' 
              : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border-emerald-500/20'
            }`}
          >
            {isEnded ? 'Closed' : 'Join'}
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
               <div className={`w-1.5 h-1.5 rounded-full ${isEnded ? 'bg-[var(--text-muted)]' : 'bg-emerald-500 animate-pulse'}`} />
               <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest leading-none">
                  {isEnded ? 'Finished' : 'Live Now'}
               </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="tiptap-editor [&>p]:inline" 
      dangerouslySetInnerHTML={{ __html: content || '' }} 
    />
  );
}

function ActionButton({ icon, onClick, tooltip }: { icon: any, onClick?: () => void, tooltip: string }) {
  return (
    <Tooltip content={tooltip}>
      <button 
        onClick={onClick}
        className="chat-icon-button p-1.5 rounded-lg"
      >
        {icon}
      </button>
    </Tooltip>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  if (attachment.type === 'image' || attachment.mimeType?.startsWith('image/')) {
    return (
      <motion.div 
        whileHover={{ scale: 1.01 }}
        className="relative rounded-2xl overflow-hidden max-w-[400px] cursor-pointer hover:ring-2 ring-[var(--accent-primary)] transition-all shadow-xl border border-[var(--border-subtle)]"
      >
        <img src={attachment.url} alt={attachment.originalName} className="max-h-[300px] w-full object-cover bg-white/5" />
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--surface-soft)] border border-[var(--border-subtle)] rounded-2xl max-w-sm group/att cursor-pointer hover:bg-[var(--surface-soft-hover)] transition-all glass-morphism">
      <div className="w-10 h-10 rounded-xl bg-[var(--surface-soft)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] group-hover/att:text-[var(--accent-primary)] transition-colors">
        <FileText className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--text-primary)] truncate">{attachment.originalName}</p>
        <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{(attachment.sizeBytes / 1024).toFixed(1)} KB</p>
      </div>
      <a href={attachment.url} download={attachment.originalName} className="p-2 hover:bg-[var(--surface-soft-hover)] rounded-full transition-colors opacity-0 group-hover/att:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
}
