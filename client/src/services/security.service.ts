import { apiFetch } from './api';

export interface SecurityStatus {
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  activeSessions: number;
  lastLogin: string | null;
  failedAttempts: number;
}

export async function getSecurityStatus(): Promise<SecurityStatus> {
  const response = await apiFetch('/api/user/security-status');
  return response.data;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiFetch(`/api/user/sessions/${sessionId}`, { method: 'DELETE' });
}
