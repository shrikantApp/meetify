/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4008/api";

const http = axios.create({ baseURL: API_BASE });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("meetify_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  currentUserRole?: WorkspaceRole;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceRole = "owner" | "admin" | "member" | "guest";

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    isOnline?: boolean;
    lastSeen?: string;
  };
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  inviterId: string;
  inviteeUserId?: string | null;
  inviteeEmail?: string | null;
  role: WorkspaceRole;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  inviteToken?: string;
  workspace?: Workspace;
  inviter?: { id: string; name: string; email: string };
  message?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface WorkspaceActivity {
  id: string;
  action: string;
  metadata?: Record<string, any>;
  actor?: { id: string; name: string; email: string };
  targetUser?: { id: string; name: string; email: string };
  createdAt: string;
}

export const workspaceApi = {
  createWorkspace: async (name: string): Promise<Workspace> => {
    const response = await http.post("/workspaces", { name });
    return response.data;
  },

  getWorkspaces: async (): Promise<Workspace[]> => {
    const response = await http.get("/workspaces");
    return response.data;
  },

  getWorkspaceById: async (id: string): Promise<Workspace> => {
    const response = await http.get(`/workspaces/${id}`);
    return response.data;
  },

  updateWorkspace: async (
    id: string,
    body: { name?: string; slug?: string },
  ): Promise<Workspace> => {
    const response = await http.patch(`/workspaces/${id}`, body);
    return response.data;
  },

  deleteWorkspace: async (id: string): Promise<{ success: boolean }> => {
    const response = await http.delete(`/workspaces/${id}`);
    return response.data;
  },

  getMembers: async (
    workspaceId: string,
  ): Promise<{ items: WorkspaceMember[]; total: number }> => {
    const response = await http.get(`/workspaces/${workspaceId}/members`);
    return response.data;
  },

  inviteMember: async (
    workspaceId: string,
    body: {
      email?: string;
      userId?: string;
      role?: WorkspaceRole;
      message?: string;
    },
  ): Promise<WorkspaceInvitation> => {
    const response = await http.post(
      `/workspaces/${workspaceId}/invitations`,
      body,
    );
    return response.data;
  },

  getInvitations: async (
    workspaceId: string,
  ): Promise<WorkspaceInvitation[]> => {
    const response = await http.get(`/workspaces/${workspaceId}/invitations`);
    return response.data;
  },

  getMyInvitations: async (): Promise<WorkspaceInvitation[]> => {
    const response = await http.get("/me/workspace-invitations", {
      params: { status: "pending" },
    });
    return response.data;
  },

  acceptInvitation: async (
    invitationId: string,
  ): Promise<{ workspace: Workspace; membership: WorkspaceMember }> => {
    const response = await http.post(
      `/me/workspace-invitations/${invitationId}/accept`,
    );
    return response.data;
  },

  rejectInvitation: async (
    invitationId: string,
  ): Promise<WorkspaceInvitation> => {
    const response = await http.post(
      `/me/workspace-invitations/${invitationId}/reject`,
    );
    return response.data;
  },

  updateMemberRole: async (
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> => {
    const response = await http.patch(
      `/workspaces/${workspaceId}/members/${userId}/role`,
      { role },
    );
    return response.data;
  },

  removeMember: async (
    workspaceId: string,
    userId: string,
  ): Promise<{ success: boolean }> => {
    const response = await http.delete(
      `/workspaces/${workspaceId}/members/${userId}`,
    );
    return response.data;
  },

  leaveWorkspace: async (
    workspaceId: string,
  ): Promise<{ success: boolean }> => {
    const response = await http.delete(`/workspaces/${workspaceId}/members/me`);
    return response.data;
  },

  joinByToken: async (
    inviteToken: string,
  ): Promise<{ workspace: Workspace; membership: WorkspaceMember }> => {
    const response = await http.post("/workspaces/join", { inviteToken });
    return response.data;
  },

  getActivity: async (
    workspaceId: string,
  ): Promise<{ items: WorkspaceActivity[]; total: number }> => {
    const response = await http.get(`/workspaces/${workspaceId}/activity`);
    return response.data;
  },
};
