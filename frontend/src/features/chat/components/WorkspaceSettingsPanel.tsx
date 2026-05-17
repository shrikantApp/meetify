import { LogOut, MailPlus, Shield, UserMinus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import {
  fetchWorkspaceInvitations,
  fetchWorkspaceMembers,
  inviteWorkspaceMember,
  leaveWorkspace,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '../../../redux/workspace/workspaceThunks';
import type { WorkspaceRole } from '../../../services/workspaceApi';

export function WorkspaceSettingsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const activeWorkspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId);
  const workspace = useAppSelector((state) => state.workspace.workspaces.find((item) => item.id === activeWorkspaceId));
  const members = useAppSelector((state) => activeWorkspaceId ? state.workspace.membersByWorkspace?.[activeWorkspaceId] ?? [] : []);
  const invitations = useAppSelector((state) => activeWorkspaceId ? state.workspace.invitationsByWorkspace?.[activeWorkspaceId] ?? [] : []);
  const currentUserId = useAppSelector((state) => state.auth.userProfile.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('member');

  const currentMember = members.find((member) => member.userId === currentUserId);
  const canAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin' || workspace?.currentUserRole === 'owner' || workspace?.currentUserRole === 'admin';

  useEffect(() => {
    if (isOpen && activeWorkspaceId) {
      dispatch(fetchWorkspaceMembers(activeWorkspaceId));
      dispatch(fetchWorkspaceInvitations(activeWorkspaceId));
    }
  }, [activeWorkspaceId, dispatch, isOpen]);

  if (!isOpen || !activeWorkspaceId || !workspace) return null;

  const handleInvite = async () => {
    if (!email.trim()) return;
    const result = await dispatch(inviteWorkspaceMember({ workspaceId: activeWorkspaceId, email: email.trim(), role }));
    if (inviteWorkspaceMember.fulfilled.match(result)) setEmail('');
  };

  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-[460px] h-full bg-[var(--bg-card)] border-l border-[var(--border-subtle)] shadow-2xl overflow-y-auto">
        <div className="sticky top-0 p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/95 backdrop-blur flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">{workspace.name}</h2>
            <p className="text-[11px] text-[var(--text-muted)]">Workspace settings and members</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-[var(--text-muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {canAdmin && (
            <section className="space-y-3">
              <h3 className="text-[11px] uppercase tracking-widest font-bold text-[var(--text-muted)] flex items-center gap-2">
                <MailPlus className="w-4 h-4" /> Invite member
              </h3>
              <div className="flex gap-2">
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  className="flex-1 bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
                />
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as WorkspaceRole)}
                  className="bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-xl px-2 py-2 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                </select>
                <button onClick={handleInvite} className="px-4 rounded-xl premium-gradient text-white text-xs font-bold">
                  Invite
                </button>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Members</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="p-3 rounded-xl bg-white/5 border border-[var(--border-subtle)] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl premium-gradient text-white flex items-center justify-center font-bold">
                    {member.user?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{member.user?.name || member.userId}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{member.user?.email}</p>
                  </div>
                  {canAdmin && member.role !== 'owner' ? (
                    <select
                      value={member.role}
                      onChange={(event) => dispatch(updateWorkspaceMemberRole({
                        workspaceId: activeWorkspaceId,
                        userId: member.userId,
                        role: event.target.value as WorkspaceRole,
                      }))}
                      className="bg-black/5 dark:bg-white/5 border border-[var(--border-subtle)] rounded-lg px-2 py-1 text-xs"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="guest">Guest</option>
                    </select>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] flex items-center gap-1">
                      <Shield className="w-3 h-3" /> {member.role}
                    </span>
                  )}
                  {canAdmin && member.role !== 'owner' && member.userId !== currentUserId && (
                    <button
                      onClick={() => dispatch(removeWorkspaceMember({ workspaceId: activeWorkspaceId, userId: member.userId }))}
                      className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400"
                      title="Remove member"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {canAdmin && (
            <section className="space-y-3">
              <h3 className="text-[11px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Pending invitations</h3>
              {invitations.length === 0 && <p className="text-xs text-[var(--text-muted)]">No pending or historical invitations yet.</p>}
              {invitations.map((invite) => (
                <div key={invite.id} className="p-3 rounded-xl bg-white/5 border border-[var(--border-subtle)]">
                  <p className="text-sm font-bold">{invite.inviteeEmail || invite.inviteeUserId}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{invite.role} · {invite.status}</p>
                </div>
              ))}
            </section>
          )}

          <section className="pt-4 border-t border-[var(--border-subtle)]">
            <button
              onClick={() => dispatch(leaveWorkspace(activeWorkspaceId))}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 text-rose-400 font-bold text-sm hover:bg-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
              Leave workspace
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
