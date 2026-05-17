import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { useChatSocket } from '../../hooks/useChatSocket';
import { ConversationList } from './components/ConversationList';
import { ChatWindow } from './components/ChatWindow';
import { MessageInput } from './components/MessageInput';
import { AddMemberModal } from './components/AddMemberModal';
import { selectActiveConversation } from '../../redux/chat/chatSelectors';
import { addOptimisticMessage, setActiveConversation } from '../../redux/chat/chatSlice';
import { fetchConversations } from '../../redux/chat/chatThunks';
import { useMessageQueue } from '../../hooks/useMessageQueue';
import {
  Info, MessageSquarePlus, ChevronRight, ChevronDown,
  Hash, UserPlus, Video, Users
} from 'lucide-react';
import { chatApi } from '../../services/chatApi';
import { meetingApi } from '../../services/meetingApi';
import { ThreadSidebar } from './components/ThreadSidebar';
import { SearchSidebar } from './components/SearchSidebar';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { TopNav } from './components/TopNav';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/chat-overrides.css';


export default function ChatPage() {
  const { conversationId } = useParams();
  const dispatch = useAppDispatch();
  const activeConv = useAppSelector(selectActiveConversation);
  const activeWorkspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId);
  const hasActiveWorkspaceMembership = useAppSelector((state) =>
    activeWorkspaceId ? state.workspace.workspaces.some((workspace) => workspace.id === activeWorkspaceId) : false,
  );
  const currentUser = useAppSelector((state) => state.auth.userProfile);
  const [showDetails, setShowDetails] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  const { emit, isConnected } = useChatSocket();
  const { enqueue } = useMessageQueue();

  useEffect(() => {
    dispatch(fetchConversations(hasActiveWorkspaceMembership ? activeWorkspaceId ?? undefined : undefined));
    dispatch(setActiveConversation(null));
  }, [dispatch, activeWorkspaceId, hasActiveWorkspaceMembership]);

  useEffect(() => {
    if (conversationId) {
      if (conversationId !== activeConv?.id) {
        dispatch(setActiveConversation(conversationId));
        setActiveThreadId(null);
        setShowSearch(false);
      }
    } else if (activeConv) {
      dispatch(setActiveConversation(null));
    }
  }, [conversationId, activeConv?.id, dispatch]);

  const toggleDetails = () => {
    setShowDetails(!showDetails);
    setShowSearch(false);
    setActiveThreadId(null);
  };

  const handleOpenThread = (id: string) => {
    setActiveThreadId(id);
    setShowSearch(false);
    setShowDetails(false);
  };

  const handleStartCall = async () => {
    if (!activeConv || !currentUser) return;
    try {
      const meeting = await meetingApi.createMeeting(`Call with ${activeConv.name || 'Team'}`, 'Chat initiated call');
      const callMsg = `Join my video call: ${window.location.origin}/meeting/${meeting.meetingCode}`;
      handleSendMessage(callMsg);

      emit('call_invite', {
        conversationId: activeConv.id,
        meetingCode: meeting.meetingCode,
        callerName: currentUser.name
      });

      window.open(`/meeting/${meeting?.meetingCode || meeting?.code}`, '_blank');
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  const handleSendMessage = async (content: string, attachment?: File) => {
    if (!activeConv || !currentUser) return;

    let msgType = 'text';
    let attachmentUrls: any[] = [];

    if (attachment) {
      try {
        msgType = attachment.type.startsWith('image/') ? 'image' :
          attachment.type.startsWith('video/') ? 'video' :
            attachment.type.startsWith('audio/') ? 'audio' : 'document';

        const { url, publicUrl } = await chatApi.getPresignedUrl(attachment.name, attachment.type);
        await chatApi.uploadFileToMinio(url, attachment);

        attachmentUrls.push({
          url: publicUrl,
          originalName: attachment.name,
          mimeType: attachment.type,
          sizeBytes: attachment.size,
          type: msgType
        });
      } catch (err) {
        console.error('Failed to upload attachment:', err);
        return;
      }
    }

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const msgData = {
      conversationId: activeConv.id,
      content,
      type: msgType,
      tempId,
      attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined
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

    if (isConnected) {
      emit('send_message', msgData);
    } else {
      enqueue(msgData);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!activeConv) return;
    emit(isTyping ? 'typing_start' : 'typing_stop', { conversationId: activeConv.id });
  };

  return (
    <div className="chat-theme-root flex h-screen bg-[var(--bg-base)] overflow-hidden text-[var(--text-primary)] font-sans selection:bg-[var(--accent-primary)]/30">
      <WorkspaceSidebar />

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopNav />

        <div className="flex-1 flex min-w-0 overflow-hidden">
          <ConversationList />

          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative border-l border-[var(--border-subtle)]">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[var(--bg-base)]">
              {activeConv ? (
                <>
                  {/* Chat Header (Sticky) */}
                  <header className="h-[52px] flex-shrink-0 border-b border-[var(--border-subtle)] flex items-center justify-between px-4 bg-[var(--bg-base)]/80 backdrop-blur-md z-20">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="flex items-center gap-1.5 group cursor-pointer">
                        {activeConv.type === 'group' ? (
                          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[var(--text-secondary)]">
                            <Hash className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg premium-gradient flex items-center justify-center text-white font-bold text-[10px]">
                            {(() => {
                              const otherMember = activeConv.members?.find(m => m.userId !== currentUser?.id);
                              return (otherMember?.user?.name || activeConv.name || 'C').charAt(0).toUpperCase();
                            })()}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <h2 className="text-[13px] font-bold truncate">
                            {activeConv.type === 'group' ? activeConv.name : (() => {
                              const otherMember = activeConv.members?.find(m => m.userId !== currentUser?.id);
                              return otherMember?.user?.name || activeConv.name || 'Chat';
                            })()}
                          </h2>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                            <span className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Active</span>
                          </div>
                        </div>
                        <ChevronDown className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <ActionButton icon={<Video className="w-4 h-4" />} onClick={handleStartCall} tooltip="Video Call" />
                      <div className="w-px h-3 bg-[var(--border-subtle)] mx-0.5" />

                      {activeConv.type === 'group' && (
                        <>
                          <div className="flex items-center -space-x-1.5 mr-2">
                            {activeConv.members?.slice(0, 3).map((m, i) => (
                              <div key={m.id} className="w-5 h-5 rounded-md border-2 border-[var(--bg-base)] bg-[var(--accent-primary)] flex items-center justify-center text-[9px] font-bold text-white shadow-sm" style={{ zIndex: 10 - i }}>
                                {m.user?.name?.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {activeConv.members && activeConv.members.length > 3 && (
                              <div className="w-5 h-5 rounded-md border-2 border-[var(--bg-base)] bg-[var(--bg-sidebar)] flex items-center justify-center text-[7px] font-bold text-[var(--text-muted)] shadow-sm" style={{ zIndex: 0 }}>
                                +{activeConv.members.length - 3}
                              </div>
                            )}
                          </div>
                          <ActionButton icon={<Users className="w-4 h-4" />} tooltip="People" />
                          <ActionButton icon={<UserPlus className="w-4 h-4" />} onClick={() => setIsAddMemberModalOpen(true)} tooltip="Add member" />
                          <div className="w-px h-3 bg-[var(--border-subtle)] mx-0.5" />
                        </>
                      )}

                      <ActionButton icon={<Info className="w-4 h-4" />} onClick={toggleDetails} active={showDetails} tooltip="Details" />
                    </div>
                  </header>

                  <div className="flex-1 flex min-h-0 overflow-hidden">
                    <div className="flex-1 flex flex-col min-w-0 min-h-0">
                      <ChatWindow conversationId={activeConv.id} onOpenThread={handleOpenThread} />
                      <MessageInput onSend={handleSendMessage} onTyping={handleTyping} />
                    </div>

                    <AnimatePresence>
                      {activeThreadId && (
                        <motion.div
                          initial={{ x: 300 }}
                          animate={{ x: 0 }}
                          exit={{ x: 300 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                          <ThreadSidebar
                            messageId={activeThreadId}
                            onClose={() => setActiveThreadId(null)}
                          />
                        </motion.div>
                      )}

                      {showSearch && (
                        <motion.div
                          initial={{ x: 300 }}
                          animate={{ x: 0 }}
                          exit={{ x: 300 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        >
                          <SearchSidebar onClose={() => setShowSearch(false)} />
                        </motion.div>
                      )}

                      {showDetails && (
                        <motion.div
                          initial={{ x: 300 }}
                          animate={{ x: 0 }}
                          exit={{ x: 300 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                          className="w-[280px] flex-shrink-0 border-l border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/50 backdrop-blur-xl flex flex-col overflow-y-auto"
                        >
                          <div className="p-3 flex items-center justify-between border-b border-[var(--border-subtle)]">
                            <h3 className="font-bold text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Details</h3>
                            <button onClick={() => setShowDetails(false)} className="p-1 hover:bg-white/10 rounded-lg text-[var(--text-muted)] transition-colors text-lg">&times;</button>
                          </div>

                          <div className="p-6 flex flex-col items-center text-center border-b border-[var(--border-subtle)]">
                            <div className="w-20 h-20 rounded-2xl premium-gradient flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-xl premium-shadow">
                              {(activeConv.type === 'direct' ? (activeConv.members?.find(m => m.userId !== currentUser?.id)?.user?.name?.charAt(0)) : activeConv.name?.charAt(0))?.toUpperCase() || 'C'}
                            </div>
                            <h3 className="text-lg font-bold mb-0.5">
                              {activeConv.type === 'direct' ? (activeConv.members?.find(m => m.userId !== currentUser?.id)?.user?.name || activeConv.name || 'Chat') : activeConv.name}
                            </h3>
                            <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider mb-4">
                              {activeConv.type === 'direct' ? 'Direct Message' : 'Public Channel'}
                            </p>

                            <div className="flex gap-2 w-full">
                              <button
                                onClick={handleStartCall}
                                className="flex-1 py-2 premium-gradient text-white rounded-xl text-[11px] font-bold transition-all hover:scale-105"
                              >
                                Call
                              </button>
                              <button className="flex-1 py-2 bg-white/5 border border-[var(--border-subtle)] hover:bg-white/10 rounded-xl text-[11px] font-bold transition-all">Mute</button>
                            </div>
                          </div>

                          <div className="p-3 space-y-4">
                            <section>
                              <h4 className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 px-2 flex items-center justify-between group cursor-pointer">
                                <span>About</span>
                                <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                              </h4>
                              <div className="text-[13px] text-[var(--text-secondary)] px-2 leading-relaxed">
                                No description added.
                              </div>
                            </section>

                            <section className="pt-4 border-t border-[var(--border-subtle)]">
                              <h4 className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3 px-2 flex items-center justify-between group cursor-pointer">
                                <span>Members</span>
                                <span className="bg-white/5 px-1.5 py-0.5 rounded text-[9px]">{activeConv.members?.length}</span>
                              </h4>
                              <div className="space-y-0.5">
                                <button
                                  onClick={() => setIsAddMemberModalOpen(true)}
                                  className="w-full flex items-center gap-2.5 p-2 hover:bg-white/5 rounded-xl transition-colors text-left group"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)] group-hover:text-white transition-all">
                                    <UserPlus className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="text-[13px] font-semibold text-[var(--accent-primary)] group-hover:underline">Add People</span>
                                </button>
                                {activeConv.members?.slice(0, 5).map(m => (
                                  <div key={m.id} className="flex items-center gap-2.5 p-2 hover:bg-white/5 rounded-xl transition-colors cursor-pointer group">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-bold text-[var(--text-secondary)]">
                                      {m.user?.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-semibold truncate text-[var(--text-primary)]">{m.user?.name}{m.userId === currentUser?.id && ' (You)'}</p>
                                      <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest leading-none">{m.role}</p>
                                    </div>
                                  </div>
                                ))}
                                {activeConv.members && activeConv.members.length > 5 && (
                                  <button className="w-full text-center py-2 text-[11px] font-bold text-[var(--accent-primary)] hover:underline">Show all</button>
                                )}
                              </div>
                            </section>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <AddMemberModal
                    isOpen={isAddMemberModalOpen}
                    onClose={() => setIsAddMemberModalOpen(false)}
                    conversationId={activeConv.id}
                    existingMemberIds={activeConv.members?.map(m => m.userId) || []}
                  />
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-base)]">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="w-32 h-32 bg-white/5 text-[var(--accent-primary)] rounded-[3rem] flex items-center justify-center mb-8 premium-shadow"
                  >
                    <MessageSquarePlus className="w-16 h-16" />
                  </motion.div>
                  <h2 className="text-3xl font-bold mb-3 tracking-tight">Welcome to Meetify</h2>
                  <p className="text-[var(--text-secondary)] max-w-sm text-center text-sm leading-relaxed font-medium">
                    Select a conversation from the sidebar or explore channels to start collaborating with your team.
                  </p>
                  <button className="mt-8 px-8 py-3 premium-gradient text-white rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl premium-shadow">
                    Browse Channels
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, onClick, tooltip, active = false }: { icon: any, onClick?: () => void, tooltip: string, active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-2 rounded-xl transition-all duration-200 ${active
          ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[var(--accent-primary)]/20'
          : 'hover:bg-white/10 text-[var(--text-secondary)] hover:text-white'
        }`}
    >
      {icon}
    </button>
  );
}
