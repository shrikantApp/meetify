/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAsyncThunk } from "@reduxjs/toolkit";
import { workspaceApi } from "../../services/workspaceApi";
import type { WorkspaceRole } from "../../services/workspaceApi";

export const fetchWorkspaces = createAsyncThunk(
  "workspace/fetchWorkspaces",
  async (_, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.getWorkspaces();
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch workspaces",
      );
    }
  },
);

export const createWorkspace = createAsyncThunk(
  "workspace/createWorkspace",
  async (name: string, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.createWorkspace(name);
      return response;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create workspace",
      );
    }
  },
);

export const fetchWorkspaceMembers = createAsyncThunk(
  "workspace/fetchMembers",
  async (workspaceId: string, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.getMembers(workspaceId);
      return { workspaceId, ...response };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch members",
      );
    }
  },
);

export const fetchWorkspaceInvitations = createAsyncThunk(
  "workspace/fetchInvitations",
  async (workspaceId: string, { rejectWithValue }) => {
    try {
      const response = await workspaceApi.getInvitations(workspaceId);
      return { workspaceId, invitations: response };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch invitations",
      );
    }
  },
);

export const fetchMyWorkspaceInvitations = createAsyncThunk(
  "workspace/fetchMyInvitations",
  async (_, { rejectWithValue }) => {
    try {
      return await workspaceApi.getMyInvitations();
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch invitations",
      );
    }
  },
);

export const inviteWorkspaceMember = createAsyncThunk(
  "workspace/inviteMember",
  async (
    payload: {
      workspaceId: string;
      email?: string;
      userId?: string;
      role?: WorkspaceRole;
      message?: string;
    },
    { rejectWithValue },
  ) => {
    try {
      const invitation = await workspaceApi.inviteMember(
        payload.workspaceId,
        payload,
      );
      return { workspaceId: payload.workspaceId, invitation };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to invite member",
      );
    }
  },
);

export const acceptWorkspaceInvitation = createAsyncThunk(
  "workspace/acceptInvitation",
  async (invitationId: string, { rejectWithValue }) => {
    try {
      return await workspaceApi.acceptInvitation(invitationId);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to accept invitation",
      );
    }
  },
);

export const rejectWorkspaceInvitation = createAsyncThunk(
  "workspace/rejectInvitation",
  async (invitationId: string, { rejectWithValue }) => {
    try {
      return await workspaceApi.rejectInvitation(invitationId);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to reject invitation",
      );
    }
  },
);

export const updateWorkspaceMemberRole = createAsyncThunk(
  "workspace/updateMemberRole",
  async (
    payload: { workspaceId: string; userId: string; role: WorkspaceRole },
    { rejectWithValue },
  ) => {
    try {
      const member = await workspaceApi.updateMemberRole(
        payload.workspaceId,
        payload.userId,
        payload.role,
      );
      return { workspaceId: payload.workspaceId, member };
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update role",
      );
    }
  },
);

export const removeWorkspaceMember = createAsyncThunk(
  "workspace/removeMember",
  async (
    payload: { workspaceId: string; userId: string },
    { rejectWithValue },
  ) => {
    try {
      await workspaceApi.removeMember(payload.workspaceId, payload.userId);
      return payload;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to remove member",
      );
    }
  },
);

export const leaveWorkspace = createAsyncThunk(
  "workspace/leave",
  async (workspaceId: string, { rejectWithValue }) => {
    try {
      await workspaceApi.leaveWorkspace(workspaceId);
      return workspaceId;
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to leave workspace",
      );
    }
  },
);
