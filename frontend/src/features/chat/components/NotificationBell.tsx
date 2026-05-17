import { Bell, CheckCheck, Inbox, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import {
  acceptDirectChatRequest,
  fetchNotifications,
  markNotificationsRead,
  rejectDirectChatRequest,
} from '../../../redux/notifications/notificationThunks';
import { acceptWorkspaceInvitation, fetchMyWorkspaceInvitations, rejectWorkspaceInvitation } from '../../../redux/workspace/workspaceThunks';
import { ConfirmationModal } from '../../../components/ui';
import type { WorkspaceInvitation } from '../../../services/workspaceApi';
import { useNavigate } from 'react-router-dom';

export function NotificationBell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<WorkspaceInvitation | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const { items, unreadCount, loading } = useAppSelector((state) => state.notifications);
  const myInvitations = useAppSelector((state) => state.workspace.myInvitations);

  useEffect(() => {
    dispatch(fetchNotifications());
    dispatch(fetchMyWorkspaceInvitations());
  }, [dispatch]);

  const handleOpen = () => setOpen((value) => !value);
  const handleAcceptInvite = async () => {
    if (!pendingInvite) return;
    setIsAccepting(true);
    try {
      await dispatch(acceptWorkspaceInvitation(pendingInvite.id)).unwrap();
      setPendingInvite(null);
      setOpen(false);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="chat-icon-button relative p-2 rounded-lg"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-rose-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[360px] max-h-[520px] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl z-[120]">
          <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Notifications</h3>
              <p className="text-[10px] text-[var(--text-muted)]">{unreadCount} unread</p>
            </div>
            <div className="flex gap-1">
              <button
                className="chat-icon-button chat-icon-button-muted p-1.5 rounded-lg"
                onClick={() => dispatch(markNotificationsRead(undefined))}
                title="Mark all read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
              <button className="chat-icon-button chat-icon-button-muted p-1.5 rounded-lg" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
            {myInvitations.map((invite) => (
              <div key={invite.id} className="p-3 border-b border-[var(--border-subtle)] bg-[var(--accent-primary)]/5">
                <p className="text-xs font-bold">Workspace invite</p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  Join {invite.workspace?.name || 'workspace'} as {invite.role}.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    className="px-3 py-1.5 rounded-lg premium-gradient text-white text-[11px] font-bold"
                    onClick={() => setPendingInvite(invite)}
                  >
                    Accept
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-[11px] font-bold hover:bg-white/10"
                    onClick={() => dispatch(rejectWorkspaceInvitation(invite.id))}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}

            {loading && <div className="p-6 text-center text-xs text-[var(--text-muted)]">Loading notifications...</div>}
            {!loading && items.length === 0 && myInvitations.length === 0 && (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <Inbox className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-xs font-semibold">No notifications yet.</p>
              </div>
            )}
            {items.map((item) => {
              const isDirectChatRequest = item.type === 'direct_chat_request' && !!item.referenceId;
              return (
                <div
                  key={item.id}
                  className={`w-full text-left p-3 border-b border-[var(--border-subtle)] hover:bg-white/5 transition-colors ${!item.isRead ? 'bg-white/[0.03]' : ''}`}
                >
                  <div className="flex gap-2">
                    {!item.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className="text-xs font-bold">{item.title}</p>
                      {item.body && <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">{item.body}</p>}
                      <p className="text-[9px] text-[var(--text-muted)] mt-2">{new Date(item.createdAt).toLocaleString()}</p>
                      {isDirectChatRequest ? (
                        <div className="flex gap-2 mt-3">
                          <button
                            className="px-3 py-1.5 rounded-lg premium-gradient text-white text-[11px] font-bold"
                            onClick={async () => {
                              const conversation = await dispatch(acceptDirectChatRequest(item.referenceId!)).unwrap();
                              await dispatch(markNotificationsRead([item.id]));
                              setOpen(false);
                              navigate(`/chat/${conversation.id}`);
                            }}
                          >
                            Accept
                          </button>
                          <button
                            className="px-3 py-1.5 rounded-lg bg-white/5 text-[11px] font-bold hover:bg-white/10"
                            onClick={async () => {
                              await dispatch(rejectDirectChatRequest(item.referenceId!)).unwrap();
                              await dispatch(markNotificationsRead([item.id]));
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <button
                          className="mt-3 text-[11px] font-bold text-[var(--accent-primary)]"
                          onClick={() => dispatch(markNotificationsRead([item.id]))}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!pendingInvite}
        title="Join workspace?"
        description={`Do you want to join ${pendingInvite?.workspace?.name || 'this workspace'} as ${pendingInvite?.role || 'member'}?`}
        confirmLabel="Join workspace"
        cancelLabel="Not now"
        tone="success"
        isLoading={isAccepting}
        onConfirm={handleAcceptInvite}
        onCancel={() => !isAccepting && setPendingInvite(null)}
      />
    </div>
  );
}
