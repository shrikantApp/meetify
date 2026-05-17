import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workspace, WorkspaceInvitation, WorkspaceMember } from '../../services/workspaceApi';
import {
  acceptWorkspaceInvitation,
  createWorkspace,
  deleteWorkspace,
  fetchMyWorkspaceInvitations,
  fetchWorkspaceInvitations,
  fetchWorkspaceMembers,
  fetchWorkspaces,
  inviteWorkspaceMember,
  leaveWorkspace,
  rejectWorkspaceInvitation,
  removeWorkspaceMember,
  updateWorkspaceDetails,
  updateWorkspaceMemberRole,
} from './workspaceThunks';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  membersByWorkspace: Record<string, WorkspaceMember[]>;
  invitationsByWorkspace: Record<string, WorkspaceInvitation[]>;
  myInvitations: WorkspaceInvitation[];
  loading: boolean;
  error: string | null;
}

const initialState: WorkspaceState = {
  workspaces: [],
  activeWorkspaceId: null,
  membersByWorkspace: {},
  invitationsByWorkspace: {},
  myInvitations: [],
  loading: false,
  error: null,
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setActiveWorkspace: (state, action: PayloadAction<string>) => {
      state.activeWorkspaceId = action.payload;
    },
    clearWorkspaceError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Workspaces
      .addCase(fetchWorkspaces.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.membersByWorkspace ??= {};
        state.invitationsByWorkspace ??= {};
        state.myInvitations ??= [];
      })
      .addCase(fetchWorkspaces.fulfilled, (state, action: PayloadAction<Workspace[]>) => {
        state.loading = false;
        state.workspaces = action.payload;
        const activeWorkspaceExists = action.payload.some((workspace) => workspace.id === state.activeWorkspaceId);
        if (action.payload.length > 0 && (!state.activeWorkspaceId || !activeWorkspaceExists)) {
          state.activeWorkspaceId = action.payload[0].id;
        } else if (action.payload.length === 0) {
          state.activeWorkspaceId = null;
        }
      })
      .addCase(fetchWorkspaces.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Workspace
      .addCase(createWorkspace.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWorkspace.fulfilled, (state, action: PayloadAction<Workspace>) => {
        state.loading = false;
        state.workspaces.push(action.payload);
        state.activeWorkspaceId = action.payload.id;
      })
      .addCase(createWorkspace.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(updateWorkspaceDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateWorkspaceDetails.fulfilled, (state, action: PayloadAction<Workspace>) => {
        state.loading = false;
        state.workspaces = state.workspaces.map((workspace) =>
          workspace.id === action.payload.id ? action.payload : workspace,
        );
      })
      .addCase(updateWorkspaceDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchWorkspaceMembers.fulfilled, (state, action) => {
        state.membersByWorkspace ??= {};
        state.membersByWorkspace[action.payload.workspaceId] = action.payload.items;
      })
      .addCase(fetchWorkspaceInvitations.fulfilled, (state, action) => {
        state.invitationsByWorkspace ??= {};
        state.invitationsByWorkspace[action.payload.workspaceId] = action.payload.invitations;
      })
      .addCase(fetchMyWorkspaceInvitations.fulfilled, (state, action) => {
        state.myInvitations = action.payload;
      })
      .addCase(inviteWorkspaceMember.fulfilled, (state, action) => {
        state.invitationsByWorkspace ??= {};
        const list = state.invitationsByWorkspace[action.payload.workspaceId] ?? [];
        state.invitationsByWorkspace[action.payload.workspaceId] = [action.payload.invitation, ...list];
      })
      .addCase(acceptWorkspaceInvitation.fulfilled, (state, action) => {
        state.myInvitations = state.myInvitations.filter((invite) => invite.id !== action.meta.arg);
        if (action.payload.workspace && !state.workspaces.some((w) => w.id === action.payload.workspace.id)) {
          state.workspaces.push(action.payload.workspace);
        }
        state.activeWorkspaceId = action.payload.workspace.id;
      })
      .addCase(rejectWorkspaceInvitation.fulfilled, (state, action) => {
        state.myInvitations = state.myInvitations.filter((invite) => invite.id !== action.payload.id);
      })
      .addCase(updateWorkspaceMemberRole.fulfilled, (state, action) => {
        state.membersByWorkspace ??= {};
        const members = state.membersByWorkspace[action.payload.workspaceId] ?? [];
        const idx = members.findIndex((member) => member.userId === action.payload.member.userId);
        if (idx >= 0) members[idx] = action.payload.member;
      })
      .addCase(removeWorkspaceMember.fulfilled, (state, action) => {
        state.membersByWorkspace ??= {};
        state.membersByWorkspace[action.payload.workspaceId] = (state.membersByWorkspace[action.payload.workspaceId] ?? [])
          .filter((member) => member.userId !== action.payload.userId);
      })
      .addCase(leaveWorkspace.fulfilled, (state, action) => {
        state.workspaces = state.workspaces.filter((workspace) => workspace.id !== action.payload);
        if (state.activeWorkspaceId === action.payload) {
          state.activeWorkspaceId = state.workspaces[0]?.id ?? null;
        }
      })
      .addCase(deleteWorkspace.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteWorkspace.fulfilled, (state, action) => {
        state.loading = false;
        state.workspaces = state.workspaces.filter((workspace) => workspace.id !== action.payload);
        delete state.membersByWorkspace[action.payload];
        delete state.invitationsByWorkspace[action.payload];
        if (state.activeWorkspaceId === action.payload) {
          state.activeWorkspaceId = state.workspaces[0]?.id ?? null;
        }
      })
      .addCase(deleteWorkspace.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setActiveWorkspace, clearWorkspaceError } = workspaceSlice.actions;
export default workspaceSlice.reducer;
