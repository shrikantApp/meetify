import { useState } from 'react';
import { Search as SearchIcon, Calendar, User, MessageSquare } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { searchMessages } from '../../../redux/chat/chatThunks';
import { format } from 'date-fns';

interface Props {
  onClose: () => void;
}

export function SearchSidebar({ onClose }: Props) {
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const searchResults = useAppSelector(state => state.chat.searchResults);
  const activeConv = useAppSelector(state => state.chat.conversations[state.chat.activeConversationId || '']);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    dispatch(searchMessages({ 
      conversationId: activeConv?.id, 
      query: query.trim() 
    }));
  };

  return (
    <div className="w-[400px] flex-shrink-0 border-l border-[var(--slack-border)] bg-[var(--slack-bg)] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      <div className="h-[49px] px-4 flex items-center justify-between border-b border-[var(--slack-border)]">
        <h3 className="font-black text-lg">Search</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-[var(--slack-text-muted)]">&times;</button>
      </div>

      <div className="p-4 border-b border-[var(--slack-border)] bg-gray-50/50 dark:bg-white/5">
        <form onSubmit={handleSearch} className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--slack-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search in ${activeConv?.name || 'this channel'}`}
            className="w-full bg-[var(--slack-input-bg)] border border-[var(--slack-border)] rounded-md py-2 pl-10 pr-3 text-[15px] focus:ring-2 focus:ring-[#1164A3]/20 focus:border-[#1164A3] outline-none transition-all"
          />
        </form>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
           <FilterBadge icon={User} label="From" />
           <FilterBadge icon={Calendar} label="After" />
           <FilterBadge icon={MessageSquare} label="In" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {searchResults.length > 0 ? (
          searchResults.map(msg => (
            <div key={msg.id} className="group p-3 rounded-lg border border-transparent hover:border-[var(--slack-border)] hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-all">
               <div className="flex items-center gap-2 mb-1">
                  {((msg.sender as any)?.avatarUrl || (msg.sender as any)?.avatar) ? (
                    <img
                      src={((msg.sender as any)?.avatarUrl || (msg.sender as any)?.avatar) as string}
                      alt={msg.sender?.name || 'User'}
                      className="w-5 h-5 rounded object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded bg-[#1164A3] flex items-center justify-center text-[10px] text-white font-black">
                       {msg.sender?.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-black text-[13px]">{msg.sender?.name}</span>
                  <span className="text-[11px] text-[var(--slack-text-muted)] font-medium">
                     {format(new Date(msg.createdAt), 'MMM d, yyyy')}
                  </span>
               </div>
               <p className="text-[14px] leading-snug text-[var(--slack-text)] line-clamp-3">
                  {msg.content}
               </p>
            </div>
          ))
        ) : (
          query && (
            <div className="text-center py-20">
               <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <SearchIcon className="w-8 h-8 text-gray-300" />
               </div>
               <p className="text-[15px] font-bold">No results for "{query}"</p>
               <p className="text-[13px] text-[var(--slack-text-muted)] font-medium">Try searching for something else</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function FilterBadge({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <button className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-white/10 border border-[var(--slack-border)] rounded-full text-[12px] font-bold text-[var(--slack-text-muted)] hover:border-gray-400 transition-all">
       <Icon className="w-3 h-3" />
       <span>{label}</span>
    </button>
  );
}
