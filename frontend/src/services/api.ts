/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export interface UserProfileDto {
  id: string;
  name: string;
  fullName?: string | null;
  email: string;
  title?: string | null;
  designation?: string | null;
  phoneNumber?: string | null;
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
  isOnline?: boolean;
  lastSeen?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function getToken() {
  const token = localStorage.getItem("meetify_token");
  if (token) {
    return token;
  }

  const persistedRoot = localStorage.getItem("persist:root");
  if (!persistedRoot) {
    return null;
  }

  try {
    const rootState = JSON.parse(persistedRoot);
    const authState = JSON.parse(rootState.auth);
    return authState?.currentUser?.access_token || null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message || "Request failed";
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export const api = {
  auth: {
    register: (body: { name: string; email: string; password: string }) =>
      request<{ access_token: string; token_type: any }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string }) =>
      request<{ access_token: string; token_type: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    profile: () => request<UserProfileDto>("/auth/profile"),
    updateProfile: (body: Partial<UserProfileDto>) =>
      request<UserProfileDto>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  meetings: {
    create: (body: { title: string; lobbyEnabled?: boolean }) =>
      request<{
        id: string;
        meetingCode: string;
        title: string;
        lobbyEnabled: boolean;
      }>("/meetings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    list: () =>
      request<
        { id: string; meetingCode: string; title: string; createdAt: string }[]
      >("/meetings"),
    get: (code: string) =>
      request<{
        id: string;
        meetingCode: string;
        title: string;
        lobbyEnabled: boolean;
        host: { id: string; name: string };
      }>(`/meetings/${code}`),
  },
};
