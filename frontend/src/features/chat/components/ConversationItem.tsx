/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAppSelector } from '../../../redux/store';
import { selectPresence } from '../../../redux/chat/chatSelectors';
import { Hash } from 'lucide-react';
import type { Conversation } from '../../../redux/chat/chatSlice';

interface Props {
  conversation: Conversation;
  active: boolean;
  onClick?: () => void;
}

export function ConversationItem({ conversation, active, onClick }: Props) {
  const currentUser = useAppSelector((state) => state.auth.userProfile);

  // Determine other member for direct messages to get their presence correctly
  const otherMember = conversation.type === 'direct' 
    ? conversation.members?.find(m => m.userId !== currentUser?.id)
    : null;
    
  const presence = useAppSelector(selectPresence(otherMember?.userId || ''));
  const isOnline = presence.online;

  // Resolve name
  let name = conversation.name || '';
  
  if (conversation.type === 'direct' && otherMember?.user) {
    name = otherMember.user.name;
  } else if (conversation.type === 'group' && !name) {
    const memberNames = conversation.members
      ?.map(m => m.user?.name)
      .filter(Boolean)
      .filter(n => n !== currentUser?.name);
      
    if (memberNames && memberNames.length > 0) {
      name = memberNames.join(', ');
    } else {
      name = 'Empty Group';
    }
  }

  if (!name) name = 'Chat';

  const directAvatarUrl =
    conversation.type === 'direct'
      ? ((otherMember?.user as any)?.avatarUrl || (otherMember?.user as any)?.avatar || null)
      : null;

  const hasUnread = (conversation.unreadCount ?? 0) > 0;
  
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 group
        ${active 
          ? 'bg-white/10 text-white shadow-sm' 
          : 'hover:bg-white/5 text-white/70 hover:text-white'}
        ${hasUnread && !active ? 'font-bold' : ''}
      `}
    >
      <div className="relative flex-shrink-0">
        {conversation.type === 'group' ? (
          <div className={`
            w-7 h-7 rounded-lg flex items-center justify-center transition-colors
            ${active ? 'bg-[var(--accent-primary)] text-white' : 'bg-white/5 text-white/40 group-hover:bg-white/10'}
          `}>
            <Hash className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div className="relative">
            {directAvatarUrl ? (
              <img
                src={directAvatarUrl}
                alt={name}
                className={`
                  w-7 h-7 rounded-lg object-cover border border-white/10 shadow-sm
                  ${active ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-sidebar)]' : ''}
                `}
              />
            ) : (
              <div className={`
                w-7 h-7 rounded-lg premium-gradient flex items-center justify-center text-white text-[10px] font-bold shadow-sm
                ${active ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-sidebar)]' : ''}
              `}>
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className={`
              absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[var(--bg-sidebar)]
              ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}
            `} />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0 flex items-center justify-between">
        <span className={`text-[13px] truncate ${active ? 'font-bold' : 'font-semibold'}`}>
          {name}
        </span>

        {hasUnread && !active && (
          <div className="min-w-[16px] h-[16px] px-1 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
            <span className="text-[9px] font-bold text-white">{conversation.unreadCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}
