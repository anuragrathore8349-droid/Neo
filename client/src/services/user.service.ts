import { apiFetch } from './api';

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  twoFactorEnabled?: boolean;
  phoneNumber?: string;
  country?: string;
  dateOfBirth?: string;
  profession?: string;
  avatar?: string;
  bio?: string;
  plan?: string;
  preferences?: {
    notifications?: Record<string, any>;
    appearance?: { theme?: string; accent?: string; fontSize?: string };
    permissions?: { trading?: boolean; api?: boolean; notifications?: boolean };
  };
  timezone?: string;
  language?: string;
  currency?: string;
}

export async function getProfile() {
  return apiFetch<{ status: string; data: UserProfile }>('/api/user/profile');
}

export async function updateProfile(data: Record<string, unknown>) {
  return apiFetch<{ status: string; data: UserProfile }>('/api/user/profile', {
    method: 'PUT',
    body: data,
  });
}

export async function changePassword(data: { currentPassword: string; newPassword: string }) {
  return apiFetch('/api/user/password', { method: 'PUT', body: data });
}

export async function getNotificationSettings() {
  return apiFetch<{ status: string; data: Record<string, any> }>('/api/user/notifications');
}

export async function updateNotificationSettings(settings: Record<string, any>) {
  return apiFetch<{ status: string; data: Record<string, any> }>('/api/user/notifications', {
    method: 'PUT',
    body: settings,
  });
}

export async function getApiKeys() {
  return apiFetch<{ status: string; data: any[] }>('/api/user/api-keys');
}

export async function createApiKey(data: {
  label: string; exchange: string; apiKey: string; secret: string;
}) {
  return apiFetch<{ status: string; data: any }>('/api/user/api-keys', {
    method: 'POST',
    body: data,
  });
}

export async function deleteApiKey(id: string) {
  return apiFetch(`/api/user/api-keys/${id}`, { method: 'DELETE' });
}

// Security helpers
export async function getSecurityStatus() {
  return apiFetch<{ status: string; data: any }>('/api/user/security-status');
}

export async function getSessions() {
  return apiFetch<{ status: string; data: any[] }>('/api/user/sessions');
}

export async function removeSession(id: string) {
  return apiFetch(`/api/user/sessions/${id}`, { method: 'DELETE' });
}

export async function getActivityLog() {
  return apiFetch<{ status: string; data: any }>('/api/security/activity');
}

export async function togglePermission(id: string, enabled: boolean) {
  return apiFetch(`/api/security/permissions/${id}`, { method: 'PUT', body: { enabled } });
}
