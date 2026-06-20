import { apiFetch } from './api';

interface ApiResponse<T> {
  status: string;
  data: T;
}

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
    notifications?: Record<string, boolean>;
    appearance?: {
      theme?: string;
      accent?: string;
      fontSize?: string;
    };
  };
  timezone?: string;
  language?: string;
  currency?: string;
}

export async function getProfile(accessToken: string): Promise<ApiResponse<UserProfile>> {
  return apiFetch<ApiResponse<UserProfile>>('/api/user/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

export async function updateProfile(accessToken: string, data: Record<string, unknown>): Promise<ApiResponse<UserProfile>> {
  return apiFetch<ApiResponse<UserProfile>>('/api/user/profile', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: data
  });
}

export async function updateNotificationSettings(accessToken: string, settings: Record<string, boolean>): Promise<ApiResponse<Record<string, boolean>>> {
  return apiFetch<ApiResponse<Record<string, boolean>>>('/api/user/notifications', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: settings
  });
}

export async function getNotificationSettings(accessToken: string): Promise<ApiResponse<Record<string, any>>> {
  return apiFetch<ApiResponse<Record<string, any>>>('/api/user/notifications', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

export async function getApiKeys(accessToken: string): Promise<ApiResponse<any[]>> {
  return apiFetch<ApiResponse<any[]>>('/api/user/api-keys', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

export async function createApiKey(accessToken: string, data: Record<string, unknown>): Promise<ApiResponse<any>> {
  return apiFetch<ApiResponse<any>>('/api/user/api-keys', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: data
  });
}

export async function deleteApiKey(accessToken: string, id: string): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>(`/api/user/api-keys/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}
