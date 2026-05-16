import { useState, useEffect } from 'react';
import { Search, X, UserPlus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { searchUsers, addMemberToGroup } from '../../../redux/chat/chatThunks';
import { setUserSearchResults } from '../../../redux/chat/chatSlice';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  existingMemberIds?: string[];
}

export function AddMemberModal({ isOpen, onClose, conversationId, existingMemberIds = [] }: Props) {
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const searchResults = useAppSelector(state => state.chat.userSearchResults);
  const currentUser = useAppSelector(state => state.auth.userProfile);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedUsers([]);
      setIsSubmitting(false);
      setIsSearching(false);
      dispatch(setUserSearchResults([]));
    }
  }, [isOpen, dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        setIsSearching(true);
        dispatch(searchUsers({ query: query.trim() })).finally(() => setIsSearching(false));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, dispatch]);

  if (!isOpen) return null;

  const handleSelectUser = (id: string) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
  };

  const handleAddMembers = () => {
    if (selectedUsers.length === 0 || !conversationId || isSubmitting) return;
    
    setIsSubmitting(true);
    Promise.all(selectedUsers.map(uid => dispatch(addMemberToGroup({ conversationId, userId: uid }))))
      .then(() => {
        onClose();
      })
      .finally(() => setIsSubmitting(false));
  };

  const filteredResults = searchResults.filter(u => 
    u.id !== currentUser?.id && !existingMemberIds.includes(u.id)
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="glass-morphism rounded-[2rem] w-full max-w-xl overflow-hidden premium-shadow border border-[var(--border-medium)] flex flex-col max-h-[85vh]"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-white/5">
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Add Members</h2>
              <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-0.5">
                Invite teammates to this conversation
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:bg-white/10 rounded-xl transition-all hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest ml-1">Find Teammates</label>
              
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedUsers.map(userId => {
                  const user = filteredResults.find(u => u.id === userId) || searchResults.find(u => u.id === userId);
                  if (!user) return null;
                  return (
                    <motion.div 
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={user.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 rounded-lg"
                    >
                      <span className="text-[12px] font-bold">{user.name}</span>
                      <button onClick={() => handleSelectUser(user.id)} className="hover:bg-[var(--accent-primary)]/20 rounded p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>

              <div className="relative group">
                <Search className={`w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isSearching ? 'text-[var(--accent-primary)] animate-pulse' : 'text-[var(--text-muted)] group-focus-within:text-[var(--accent-primary)]'}`} />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-[var(--border-subtle)] rounded-xl focus:ring-4 focus:ring-[var(--accent-primary)]/10 focus:border-[var(--accent-primary)] outline-none transition-all font-semibold text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] shadow-inner"
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[var(--accent-primary)]/20 border-t-[var(--accent-primary)] rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <AnimatePresence>
                {filteredResults.map(user => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                      selectedUsers.includes(user.id) 
                        ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] shadow-md shadow-[var(--accent-primary)]/5' 
                        : 'hover:bg-white/5 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg premium-gradient flex items-center justify-center font-bold text-white text-[13px] shadow-lg">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[13px] text-[var(--text-primary)]">{user.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{user.email}</div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedUsers.includes(user.id) 
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white scale-110 shadow-lg' 
                        : 'border-[var(--border-subtle)]'
                    }`}>
                      {selectedUsers.includes(user.id) && <X className="w-3.5 h-3.5" />}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-white/5 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[13px] font-bold hover:bg-white/10 rounded-xl transition-all text-[var(--text-secondary)]">
              Cancel
            </button>
            <button 
              onClick={handleAddMembers}
              disabled={selectedUsers.length === 0 || isSubmitting}
              className={`
                px-5 py-2 text-[13px] font-bold rounded-xl transition-all shadow-xl flex items-center gap-2 min-w-[140px] justify-center
                ${selectedUsers.length === 0 || isSubmitting
                  ? 'bg-white/5 text-[var(--text-muted)] cursor-not-allowed'
                  : 'premium-gradient text-white hover:scale-105 active:scale-95'}
              `}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>{isSubmitting ? 'Adding...' : `Add ${selectedUsers.length} ${selectedUsers.length === 1 ? 'Member' : 'Members'}`}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
