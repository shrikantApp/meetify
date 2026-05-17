/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useAppSelector } from '../../../redux/store';
import { useNavigate } from 'react-router-dom';
import { ConversationItem } from './ConversationItem';
import { CreateChannelModal } from './CreateChannelModal';
import { CreateDirectChatModal } from './CreateDirectChatModal';
import { WorkspaceEditorModal } from './WorkspaceEditorModal';
import {
  ChevronDown, Plus,
  MessageSquare, AtSign, Bookmark, MoreVertical, Layers, Pencil, LogOut, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../contexts/AuthContext';

export function ConversationList() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { conversationOrder, activeConversationId } = useAppSelector(state => state.chat);
  const conversations = useAppSelector(state => state.chat.conversations);
  const { workspaces, activeWorkspaceId } = useAppSelector(state => state.workspace);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const isWorkspaceOwner = activeWorkspace?.currentUserRole === 'owner';

  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isDMModalOpen, setIsDMModalOpen] = useState(false);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isWorkspaceEditorOpen, setIsWorkspaceEditorOpen] = useState(false);
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
        <div className="relative flex-1 min-w-0">
          <button
            onClick={() => setIsWorkspaceMenuOpen((value) => !value)}
            className="flex items-center gap-2 overflow-hidden group cursor-pointer w-full text-left"
          >
            {activeWorkspace?.avatarUrl ? (
              <img src={activeWorkspace.avatarUrl} alt={activeWorkspace.name} className="w-7 h-7 rounded-lg object-cover border border-white/10" />
            ) : (
              <div className="w-7 h-7 rounded-lg premium-gradient flex items-center justify-center text-white text-[11px] font-black">
                {activeWorkspace?.name?.charAt(0).toUpperCase() || 'W'}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-[13px] font-bold truncate text-white">
                {activeWorkspace?.name || 'Select Workspace'}
              </h1>
              <p className="text-[10px] text-white/40 truncate">{activeWorkspace?.slug ? `${activeWorkspace.slug}.slack.com` : 'No workspace selected'}</p>
            </div>
            <ChevronDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity ml-auto" />
          </button>

          <AnimatePresence>
            {isWorkspaceMenuOpen && activeWorkspace && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="absolute left-0 top-[calc(100%+10px)] z-[90] w-[300px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl glass-morphism overflow-hidden"
              >
                <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-4">
                  {activeWorkspace.avatarUrl ? (
                    <img src={activeWorkspace.avatarUrl} alt={activeWorkspace.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl premium-gradient flex items-center justify-center text-white text-lg font-black">
                      {activeWorkspace.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{activeWorkspace.name}</p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">{activeWorkspace.slug}.slack.com</p>
                  </div>
                </div>

                <div className="p-2">
                  {isWorkspaceOwner ? (
                    <>
                      <MenuAction
                        icon={<Pencil className="w-4 h-4" />}
                        label="Edit workspace"
                        onClick={() => {
                          setIsWorkspaceEditorOpen(true);
                          setIsWorkspaceMenuOpen(false);
                        }}
                      />
                      <MenuAction
                        icon={<ImageIcon className="w-4 h-4" />}
                        label="Change image"
                        onClick={() => {
                          setIsWorkspaceEditorOpen(true);
                          setIsWorkspaceMenuOpen(false);
                        }}
                      />
                    </>
                  ) : null}
                  <MenuAction
                    icon={<LogOut className="w-4 h-4" />}
                    label="Sign out"
                    onClick={() => {
                      setIsWorkspaceMenuOpen(false);
                      logout();
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
      <WorkspaceEditorModal isOpen={isWorkspaceEditorOpen} onClose={() => setIsWorkspaceEditorOpen(false)} />
    </div>
  );
}

function MenuAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-white/5 transition-colors"
    >
      <span className="text-[var(--text-secondary)]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function SidebarLink({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ${active
        ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/20'
        : 'hover:bg-white/5 text-white/70 hover:text-white'
      }`}>
      <Icon className={`w-3.5 h-3.5 ${active ? 'opacity-100' : 'opacity-70'}`} />
      <span className="text-[13px] font-semibold tracking-tight">{label}</span>
    </div>
  );
}
