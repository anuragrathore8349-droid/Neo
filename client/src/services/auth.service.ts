import { apiFetch } from './api';

export interface AuthUser {
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
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

interface LoginResponseData {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

interface RefreshTokenResponseData {
  accessToken: string;
  refreshToken?: string;
}

export async function login(email: string, password: string): Promise<ApiResponse<LoginResponseData>> {
  return apiFetch<ApiResponse<LoginResponseData>>('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
}

export async function register(firstName: string, lastName: string, email: string, password: string): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>('/api/auth/register', {
    method: 'POST',
    body: { firstName, lastName, email, password }
  });
}

export async function forgotPassword(email: string): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>('/api/auth/forgot-password', {
    method: 'POST',
    body: { email }
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>('/api/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword }
  });
}

export interface VerifyEmailResponseData {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    plan: string;
    isEmailVerified: boolean;
  };
  accessToken: string;
}

export async function verifyEmail(token: string): Promise<ApiResponse<VerifyEmailResponseData>> {
  return apiFetch<ApiResponse<VerifyEmailResponseData>>(`/api/auth/verify-email/${encodeURIComponent(token)}`, {
    method: 'GET'
  });
}

let refreshTokenPromise: Promise<ApiResponse<RefreshTokenResponseData>> | null = null;

export async function refreshToken(): Promise<ApiResponse<RefreshTokenResponseData>> {
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  refreshTokenPromise = apiFetch<ApiResponse<RefreshTokenResponseData>>('/api/auth/refresh-token', {
    method: 'POST'
  }).finally(() => {
    refreshTokenPromise = null;
  });

  return refreshTokenPromise;
}

export async function logout(accessToken: string): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>('/api/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

export async function verifyTwoFactor(token: string, accessToken: string): Promise<ApiResponse<{ verified: boolean }>> {
  return apiFetch<ApiResponse<{ verified: boolean }>>('/api/auth/2fa/verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: { token }
  });
}
