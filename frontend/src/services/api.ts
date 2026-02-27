const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function getToken() {
    return localStorage.getItem('meetify_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || 'Request failed');
    }
    return data as T;
}

export const api = {
    auth: {
        register: (body: { name: string; email: string; password: string }) =>
            request<{ access_token: string; token_type: any }>('/auth/register', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        login: (body: { email: string; password: string }) =>
            request<{ access_token: string; token_type: any }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        profile: () => request<{ id: string; name: string; email: string }>('/auth/profile'),
    },
    meetings: {
        create: (body: { title: string }) =>
            request<{ id: string; meetingCode: string; title: string }>('/meetings', {
                method: 'POST',
                body: JSON.stringify(body),
            }),
        list: () => request<{ id: string; meetingCode: string; title: string; createdAt: string }[]>('/meetings'),
        get: (code: string) => request<{ id: string; meetingCode: string; title: string; host: { name: string } }>(`/meetings/${code}`),
    },
};
