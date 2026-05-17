import { useState } from 'react';
import { useAppSelector } from '../../../redux/store';
import { useNavigate } from 'react-router-dom';
import { ConversationItem } from './ConversationItem';
import { CreateChannelModal } from './CreateChannelModal';
import { CreateDirectChatModal } from './CreateDirectChatModal';
import { 
  ChevronDown, Plus, 
  MessageSquare, AtSign, Bookmark, MoreVertical, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ConversationList() {
  const navigate = useNavigate();
  const { conversationOrder, activeConversationId } = useAppSelector(state => state.chat);
  const conversations = useAppSelector(state => state.chat.conversations);
  const { workspaces, activeWorkspaceId } = useAppSelector(state => state.workspace);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isDMModalOpen, setIsDMModalOpen] = useState(false);
  const [isChannelsOpen, setIsChannelsOpen] = useState(true);
  const [isDMsOpen, setIsDMsOpen] = useState(true);

  const groups = conversationOrder
    .map(id => conversations[id])
    .filter(c => c && c.type === 'group' && c.workspaceId === activeWorkspaceId);

  const direct = conversationOrder
    .map(id => conversations[id])
    .filter(c => c && c.type === 'direct' && c.workspaceId === activeWorkspaceId);

  return (
    <div className="w-[260px] flex-shrink-0 h-full bg-[var(--bg-sidebar)] border-r border-white/10 flex flex-col z-30">
      {/* Sidebar Header */}
      <div className="h-[52px] flex items-center justify-between px-4 border-b border-white/10">
        <div className="flex items-center gap-2 overflow-hidden group cursor-pointer">
          <h1 className="text-[13px] font-bold truncate text-white">
            {activeWorkspace?.name || 'Select Workspace'}
          </h1>
          <ChevronDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />
        </div>
        <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/70">
          <Layers className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 py-3">
        <div className="space-y-4">
          {/* Main Navigation */}
          <div className="space-y-0.5">
            <SidebarLink icon={MessageSquare} label="Threads" />
            <SidebarLink icon={AtSign} label="Mentions" />
            <SidebarLink icon={Bookmark} label="Saved" />
            <SidebarLink icon={MoreVertical} label="More" />
          </div>

          {/* Channels Section */}
          <div className="space-y-0.5">
            <div 
              className="flex items-center justify-between px-2 group cursor-pointer"
              onClick={() => setIsChannelsOpen(!isChannelsOpen)}
            >
              <div className="flex items-center gap-1.5">
                <motion.div
                  animate={{ rotate: isChannelsOpen ? 0 : -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-3 h-3 text-white/40" />
                </motion.div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Channels</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsChannelModalOpen(true); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-all text-white/60"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            
            <AnimatePresence initial={false}>
              {isChannelsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-0.5 mt-0.5"
                >
                   {groups.map(conv => (
                      <ConversationItem 
                        key={conv.id} 
                        conversation={conv} 
                        active={activeConversationId === conv.id} 
                        onClick={() => navigate(`/chat/${conv.id}`)}
                      />
                   ))}
                   <button 
                     onClick={() => setIsChannelModalOpen(true)}
                     className="w-full flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded-lg transition-all text-[11px] font-semibold text-white/60 hover:text-white group"
                   >
                      <div className="w-4 h-4 rounded-md bg-white/5 flex items-center justify-center group-hover:bg-[var(--accent-primary)] group-hover:text-white transition-all">
                         <Plus className="w-2.5 h-2.5" />
                      </div>
                      <span>Add channels</span>
                   </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Direct Messages Section */}
          <div className="space-y-0.5">
            <div 
              className="flex items-center justify-between px-2 group cursor-pointer"
              onClick={() => setIsDMsOpen(!isDMsOpen)}
            >
              <div className="flex items-center gap-1.5">
                <motion.div
                  animate={{ rotate: isDMsOpen ? 0 : -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-3 h-3 text-white/40" />
                </motion.div>
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Direct Messages</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsDMModalOpen(true); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all text-white/60"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            
            <AnimatePresence initial={false}>
              {isDMsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-0.5 mt-0.5"
                >
                   {direct.map(conv => (
                      <ConversationItem 
                        key={conv.id} 
                        conversation={conv} 
                        active={activeConversationId === conv.id} 
                        onClick={() => navigate(`/chat/${conv.id}`)}
                      />
                   ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <CreateChannelModal isOpen={isChannelModalOpen} onClose={() => setIsChannelModalOpen(false)} />
      <CreateDirectChatModal isOpen={isDMModalOpen} onClose={() => setIsDMModalOpen(false)} />
    </div>
  );
}

function SidebarLink({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ${
      active 
        ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/20' 
        : 'hover:bg-white/5 text-white/70 hover:text-white'
    }`}>
      <Icon className={`w-3.5 h-3.5 ${active ? 'opacity-100' : 'opacity-70'}`} />
      <span className="text-[13px] font-semibold tracking-tight">{label}</span>
    </div>
  );
}
