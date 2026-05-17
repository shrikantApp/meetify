import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Brush,
  Check,
  Globe,
  LogOut,
  MailPlus,
  Monitor,
  Moon,
  Pencil,
  Settings2,
  Shield,
  Sun,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme, SLACK_THEMES, type ThemeMode, type ThemePresetId } from '../../../contexts/ThemeProvider';
import { useAuth } from '../../../contexts/AuthContext';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { ModalPortal } from '../../../components/ui';
import {
  deleteWorkspace,
  fetchWorkspaceInvitations,
  fetchWorkspaceMembers,
  inviteWorkspaceMember,
  leaveWorkspace,
  removeWorkspaceMember,
  updateWorkspaceDetails,
  updateWorkspaceMemberRole,
} from '../../../redux/workspace/workspaceThunks';
import type { WorkspaceRole } from '../../../services/workspaceApi';

type PreferencesSectionId = 'appearance' | 'workspace' | 'members' | 'invitations' | 'advanced';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: PreferencesSectionId;
}

const SECTION_ITEMS: Array<{ id: PreferencesSectionId; label: string; icon: typeof Brush }> = [
  { id: 'appearance', label: 'Appearance', icon: Brush },
  { id: 'workspace', label: 'Workspace', icon: Globe },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'invitations', label: 'Invitations', icon: MailPlus },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
];

const CUSTOM_THEME_FIELDS = [
  { key: 'systemNav', label: 'System navigation' },
  { key: 'selectedItems', label: 'Selected items' },
  { key: 'presence', label: 'Presence indication' },
  { key: 'notifications', label: 'Notifications' },
] as const;

export function PreferencesModal({ isOpen, onClose, initialSection = 'appearance' }: Props) {
  const dispatch = useAppDispatch();
  const { logout } = useAuth();
  const { mode, setMode, presetId, setPresetId, customTheme, updateCustomTheme, resetCustomTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<PreferencesSectionId>(initialSection);
  const [appearanceTab, setAppearanceTab] = useState<'presets' | 'custom'>('presets');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const workspaceState = useAppSelector((state) => state.workspace);
  const activeWorkspaceId = workspaceState.activeWorkspaceId;
  const workspace = useAppSelector((state) => state.workspace.workspaces.find((item) => item.id === activeWorkspaceId));
  const members = useAppSelector((state) => (activeWorkspaceId ? state.workspace.membersByWorkspace?.[activeWorkspaceId] ?? [] : []));
  const invitations = useAppSelector((state) => (activeWorkspaceId ? state.workspace.invitationsByWorkspace?.[activeWorkspaceId] ?? [] : []));
  const currentUserId = useAppSelector((state) => state.auth.userProfile?.id);
  const loading = workspaceState.loading;
  const error = workspaceState.error;

  const currentMember = members.find((member) => member.userId === currentUserId);
  const canAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin' || workspace?.currentUserRole === 'owner' || workspace?.currentUserRole === 'admin';
  const isOwner = currentMember?.role === 'owner' || workspace?.currentUserRole === 'owner';

  useEffect(() => {
    if (!isOpen) return;
    setActiveSection(initialSection);
  }, [initialSection, isOpen]);

  useEffect(() => {
    if (!isOpen || !workspace) return;
    setWorkspaceName(workspace.name);
    setWorkspaceSlug(workspace.slug);
  }, [isOpen, workspace]);

  useEffect(() => {
    if (!isOpen || !activeWorkspaceId) return;
    if (activeSection === 'members') {
      dispatch(fetchWorkspaceMembers(activeWorkspaceId));
    }
    if (activeSection === 'invitations') {
      dispatch(fetchWorkspaceInvitations(activeWorkspaceId));
    }
    if (activeSection === 'workspace' && members.length === 0) {
      dispatch(fetchWorkspaceMembers(activeWorkspaceId));
    }
  }, [activeSection, activeWorkspaceId, dispatch, isOpen, members.length]);

  const sectionMeta = useMemo(
    () => SECTION_ITEMS.find((item) => item.id === activeSection) ?? SECTION_ITEMS[0],
    [activeSection],
  );

  if (!isOpen) return null;

  const handleSaveWorkspace = async () => {
    if (!workspace || !workspaceName.trim() || !workspaceSlug.trim()) return;
    await dispatch(updateWorkspaceDetails({
      workspaceId: workspace.id,
      name: workspaceName.trim(),
      slug: workspaceSlug.trim(),
    }));
  };

  const handleInvite = async () => {
    if (!activeWorkspaceId || !inviteEmail.trim()) return;
    const result = await dispatch(inviteWorkspaceMember({
      workspaceId: activeWorkspaceId,
      email: inviteEmail.trim(),
      role: inviteRole,
    }));
    if (inviteWorkspaceMember.fulfilled.match(result)) {
      setInviteEmail('');
    }
  };

  const renderAppearance = () => (
    <div className="space-y-8">
      <PreferenceGroup
        title="Font"
        description="Keep the typography consistent across the workspace experience."
      >
        <select className="preferences-select max-w-[240px]" defaultValue="lato">
          <option value="lato">Lato (Default)</option>
        </select>
      </PreferenceGroup>

      <PreferenceGroup
        title="Color Mode"
        description="Choose if Meetify should be light or dark, or follow your computer settings."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { id: 'light', label: 'Light', icon: Sun },
            { id: 'dark', label: 'Dark', icon: Moon },
            { id: 'system', label: 'System', icon: Monitor },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id as ThemeMode)}
              className={`preferences-segment ${mode === id ? 'preferences-segment-active' : ''}`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </PreferenceGroup>

      <div className="border-b border-[var(--border-subtle)]">
        <div className="flex gap-6 text-sm font-bold">
          <button
            onClick={() => setAppearanceTab('presets')}
            className={`pb-3 ${appearanceTab === 'presets' ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
          >
            Slack themes
          </button>
          <button
            onClick={() => setAppearanceTab('custom')}
            className={`pb-3 ${appearanceTab === 'custom' ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`}
          >
            Custom theme
          </button>
        </div>
      </div>

      {appearanceTab === 'presets' ? (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Single color</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(Object.entries(SLACK_THEMES) as Array<[ThemePresetId, (typeof SLACK_THEMES)[ThemePresetId]]>).map(([id, theme]) => (
              <button
                key={id}
                onClick={() => setPresetId(id)}
                className={`preferences-theme-card ${presetId === id ? 'preferences-theme-card-active' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full border border-white/10" style={{ backgroundColor: theme.sidebar }} />
                  <span className="font-semibold text-sm">{theme.label}</span>
                </div>
                {presetId === id ? <Check className="w-4 h-4 text-[var(--accent-primary)]" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <button className="preferences-chip">Share</button>
            <button className="preferences-chip">Import</button>
            <button onClick={resetCustomTheme} className="preferences-chip">Reset</button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {CUSTOM_THEME_FIELDS.map(({ key, label }) => (
              <label key={key} className="preferences-color-card">
                <span className="text-xs font-bold text-[var(--text-secondary)]">{label}</span>
                <div className="mt-2 flex items-center gap-3 rounded-full border border-[var(--border-subtle)] bg-black/10 px-3 py-2">
                  <input
                    type="color"
                    value={customTheme[key]}
                    onChange={(event) => updateCustomTheme({ [key]: event.target.value })}
                    className="h-6 w-6 rounded-full border-none bg-transparent"
                  />
                  <span className="font-mono text-xs uppercase">{customTheme[key]}</span>
                </div>
              </label>
            ))}
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-white/5 px-4 py-3">
            <input
              type="checkbox"
              checked={customTheme.windowGradient}
              onChange={(event) => updateCustomTheme({ windowGradient: event.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-bold">Window gradient</span>
              <span className="block text-xs text-[var(--text-secondary)]">
                Blend window background and selected item colors together for richer workspace surfaces.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );

  const renderWorkspace = () => (
    <div className="space-y-8">
      <PreferenceGroup
        title="Workspace Details"
        description="Manage the identity of the active workspace and keep it clean for members."
      >
        {workspace ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="preferences-label">Workspace name</label>
              <input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} className="preferences-input" disabled={!canAdmin} />
            </div>
            <div className="space-y-2">
              <label className="preferences-label">Workspace slug</label>
              <input value={workspaceSlug} onChange={(e) => setWorkspaceSlug(e.target.value)} className="preferences-input" disabled={!canAdmin} />
            </div>
            <PreferenceStat label="Members" value={String(workspace.memberCount ?? members.length)} />
            <PreferenceStat label="Your role" value={workspace.currentUserRole ?? currentMember?.role ?? 'member'} />
          </div>
        ) : (
          <EmptyState copy="Select a workspace to manage its settings." />
        )}
      </PreferenceGroup>

      {canAdmin && workspace ? (
        <div className="flex justify-end">
          <button onClick={handleSaveWorkspace} disabled={loading} className="preferences-primary-button">
            <Pencil className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save changes'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );

  const renderMembers = () => (
    <div className="space-y-4">
      {members.length === 0 ? (
        <EmptyState copy="No members loaded for this workspace yet." />
      ) : (
        members.map((member) => (
          <div key={member.id} className="preferences-list-item">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center text-sm font-bold text-white">
                {member.user?.name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                  {member.user?.name || member.userId}
                  {member.userId === currentUserId ? ' (You)' : ''}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{member.user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canAdmin && member.role !== 'owner' ? (
                <select
                  value={member.role}
                  onChange={(event) => dispatch(updateWorkspaceMemberRole({
                    workspaceId: member.workspaceId,
                    userId: member.userId,
                    role: event.target.value as WorkspaceRole,
                  }))}
                  className="preferences-select min-w-[110px]"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="guest">Guest</option>
                </select>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  <Shield className="w-3 h-3" />
                  {member.role}
                </span>
              )}

              {canAdmin && member.role !== 'owner' && member.userId !== currentUserId ? (
                <button
                  onClick={() => dispatch(removeWorkspaceMember({ workspaceId: member.workspaceId, userId: member.userId }))}
                  className="preferences-icon-button text-rose-400"
                  title="Remove member"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderInvitations = () => (
    <div className="space-y-8">
      {canAdmin ? (
        <PreferenceGroup
          title="Invite Members"
          description="Send workspace invites and assign the right access level before someone joins."
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_160px_auto]">
            <input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@example.com"
              className="preferences-input"
            />
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)} className="preferences-select">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="guest">Guest</option>
            </select>
            <button onClick={handleInvite} className="preferences-primary-button justify-center">
              Invite
            </button>
          </div>
        </PreferenceGroup>
      ) : null}

      <div className="space-y-4">
        {invitations.length === 0 ? (
          <EmptyState copy="No pending invitations yet." />
        ) : (
          invitations.map((invite) => (
            <div key={invite.id} className="preferences-list-item">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{invite.inviteeEmail || invite.inviteeUserId}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {invite.role} · {invite.status} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {invite.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAdvanced = () => (
    <div className="space-y-8">
      <PreferenceGroup
        title="Session"
        description="Sign out of the current account when you need to switch workspaces or users."
      >
        <button onClick={() => { logout(); onClose(); }} className="preferences-secondary-button">
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
      </PreferenceGroup>

      <PreferenceGroup
        title="Danger Zone"
        description="These actions change access for the current workspace and cannot always be undone."
      >
        <div className="space-y-3">
          <button
            onClick={() => activeWorkspaceId && dispatch(leaveWorkspace(activeWorkspaceId))}
            className="preferences-danger-button"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave workspace</span>
          </button>

          {isOwner && workspace ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-rose-300">Delete workspace</p>
                  <p className="mt-1 text-xs text-rose-200/80">
                    Remove this workspace permanently. Conversations and membership references may be lost.
                  </p>
                </div>
                <button onClick={() => setConfirmDelete((value) => !value)} className="preferences-icon-button text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {confirmDelete ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => dispatch(deleteWorkspace(workspace.id))}
                    className="preferences-danger-button"
                  >
                    Confirm delete
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="preferences-secondary-button">
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </PreferenceGroup>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'appearance':
        return renderAppearance();
      case 'workspace':
        return renderWorkspace();
      case 'members':
        return renderMembers();
      case 'invitations':
        return renderInvitations();
      case 'advanced':
        return renderAdvanced();
      default:
        return null;
    }
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.2 }}
          className="preferences-modal relative z-10 flex h-[min(92vh,760px)] w-full max-w-6xl overflow-hidden rounded-[22px] border border-[var(--border-medium)]"
        >
          <aside className="preferences-sidebar w-full max-w-[260px] flex-shrink-0 border-r border-[var(--border-subtle)] px-4 py-5">
            <h2 className="px-3 text-[30px] font-black tracking-tight text-[var(--text-primary)]">Preferences</h2>
            <nav className="mt-5 space-y-1">
              {SECTION_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`preferences-nav-item ${activeSection === id ? 'preferences-nav-item-active' : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-[var(--bg-base)]">
            <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-5">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">{sectionMeta.label}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {activeSection === 'appearance' ? 'Control the look and feel of Meetify.' : 'Manage this workspace with live data and role-aware actions.'}
                </p>
              </div>
              <button onClick={onClose} className="preferences-icon-button">
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
              {error ? (
                <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                  {error}
                </div>
              ) : null}
              {renderSectionContent()}
            </div>
          </section>
        </motion.div>
        </div>
      </AnimatePresence>
    </ModalPortal>
  );
}

function PreferenceGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-[var(--border-subtle)] pb-8">
      <div>
        <h4 className="text-sm font-black text-[var(--text-primary)]">{title}</h4>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function PreferenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-white/5 px-4 py-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-base font-bold capitalize text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/5 px-5 py-8 text-center text-sm text-[var(--text-secondary)]">
      {copy}
    </div>
  );
}
