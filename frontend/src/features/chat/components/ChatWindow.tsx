import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { fetchMessages } from '../../../redux/chat/chatThunks';
import { MessageBubble } from './MessageBubble';
import { format, isSameDay, isBefore, subDays, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, ArrowUp, Clock } from 'lucide-react';

interface Props {
  conversationId: string;
  onOpenThread: (messageId: string) => void;
}

export function ChatWindow({ conversationId, onOpenThread }: Props) {
  const dispatch = useAppDispatch();
  const messages = useAppSelector(state => state.chat.messages[conversationId] || []);
  const loading = useAppSelector(state => state.chat.isLoadingMessages[conversationId]);
  const scrollRef = useRef<any>(null);
  const me = useAppSelector(state => state.auth.userProfile);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Filter to show only top-level messages in the main window
  const topLevelMessages = messages.filter(m => !m.parentMessageId);

  // Calculate available jump options based on history
  const firstMsg = topLevelMessages[0];
  const firstDate = firstMsg ? new Date(firstMsg.createdAt) : null;
  const now = new Date();

  const jumpOptions = {
    yesterday: firstDate && isBefore(firstDate, subDays(now, 1)),
    lastWeek: firstDate && isBefore(firstDate, subDays(now, 7)),
    lastMonth: firstDate && isBefore(firstDate, subMonths(now, 1)),
    beginning: topLevelMessages.length > 10
  };

  useEffect(() => {
    dispatch(fetchMessages({ conversationId }));
  }, [conversationId, dispatch]);

  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAtBottom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
  };

  const jumpToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 p-6 space-y-6 overflow-hidden bg-[var(--bg-base)]">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-9 h-9 rounded-xl bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-white/5 rounded w-1/4" />
              <div className="h-4 bg-white/5 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 relative flex flex-col min-h-0 bg-[var(--bg-base)] overflow-hidden">
      <div
        className="flex-1 overflow-y-auto custom-scrollbar"
        ref={scrollRef}
        onScroll={handleScroll}
      >
        <div className="flex flex-col py-4">
          {/* Welcome Section */}
          <div className="px-6 mb-8 mt-4 welcome-section-compact">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[var(--accent-primary)] mb-3">
              <Hash className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1.5">Welcome to this conversation!</h1>
            <p className="text-[13px] text-[var(--text-secondary)] max-w-sm leading-relaxed">
              This is the very beginning of your collaboration. Share files, messages, and stay connected.
            </p>
          </div>

          <AnimatePresence initial={false}>
            {topLevelMessages.map((msg, index) => {
              const prevMsg = topLevelMessages[index - 1];
              const isSameUser = prevMsg && prevMsg.senderId === msg.senderId;
              const isWithin5Mins = prevMsg && (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000);
              const showAvatar = !isSameUser || !isWithin5Mins;

              const showDateHeader = !prevMsg || !isSameDay(new Date(msg.createdAt), new Date(prevMsg.createdAt));
              const dateStr = format(new Date(msg.createdAt), 'EEEE, MMMM do');

              return (
                <div key={msg.id || msg.tempId}>
                  {showDateHeader && (
                    <div className="sticky top-0 z-1 py-4 bg-[var(--bg-base)] relative">
                      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-px bg-[var(--border-subtle)]/50" />
                      <div className="relative flex justify-center">
                        <DateDropdown
                          dateStr={dateStr}
                          onJumpToTop={jumpToTop}
                          options={jumpOptions}
                        />
                      </div>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isOwn={msg.senderId === me?.id}
                    showAvatar={showAvatar}
                    onReply={() => onOpenThread(msg.id)}
                  />
                </div>
              );
            })}
          </AnimatePresence>

          <div className="h-4 flex-shrink-0" />
        </div>
      </div>

      {!isAtBottom && topLevelMessages.length > 5 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
            }
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-[var(--accent-primary)] text-white text-xs font-bold rounded-full shadow-2xl premium-shadow hover:scale-105 active:scale-95 transition-all z-40"
        >
          New messages below
        </motion.button>
      )}
    </div>
  );
}

interface DateDropdownProps {
  dateStr: string;
  onJumpToTop: () => void;
  options: {
    yesterday: boolean | null;
    lastWeek: boolean | null;
    lastMonth: boolean | null;
    beginning: boolean;
  };
}

function DateDropdown({ dateStr, onJumpToTop, options }: DateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-1.5 bg-[var(--bg-base)]/90 border border-[var(--border-subtle)] rounded-full shadow-lg backdrop-blur-md mx-4 flex items-center gap-2 hover:border-[var(--border-medium)] transition-all group"
      >
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.15em] group-hover:text-[var(--text-primary)]">
          {dateStr}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-[70] p-1.5"
          >
            <div className="px-3 py-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-subtle)]/50 mb-1">Jump to...</div>

            {options.yesterday && (
              <button className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[12px] text-[var(--text-primary)] transition-colors">Yesterday</button>
            )}
            {options.lastWeek && (
              <button className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[12px] text-[var(--text-primary)] transition-colors">Last week</button>
            )}
            {options.lastMonth && (
              <button className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[12px] text-[var(--text-primary)] transition-colors">Last month</button>
            )}

            {options.beginning && (
              <button
                onClick={() => { onJumpToTop(); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[12px] text-[var(--text-primary)] transition-colors"
              >
                The very beginning
              </button>
            )}

            {!options.yesterday && !options.lastWeek && !options.lastMonth && !options.beginning && (
              <div className="px-3 py-4 text-center">
                <span className="text-[11px] text-[var(--text-muted)] italic">No older history available</span>
              </div>
            )}

            <div className="h-px bg-[var(--border-subtle)]/50 my-1.5" />
            <button className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[12px] text-sky-400 font-medium transition-colors">Jump to a specific date</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Hash({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="4" y1="9" x2="20" y2="9"></line>
      <line x1="4" y1="15" x2="20" y2="15"></line>
      <line x1="10" y1="3" x2="8" y2="21"></line>
      <line x1="16" y1="3" x2="14" y2="21"></line>
    </svg>
  );
}
