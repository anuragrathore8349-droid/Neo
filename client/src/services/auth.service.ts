import { apiFetch } from './api';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  isTwoFactorEnabled?: boolean;
  twoFactorEnabled?: boolean;
  isEmailVerified?: boolean;
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
  message?: string;
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

export async function login(
  email: string,
  password: string,
  twoFactorCode?: string
): Promise<ApiResponse<LoginResponseData>> {
  return apiFetch<ApiResponse<LoginResponseData>>('/api/auth/login', {
    method: 'POST',
    body: { email, password, ...(twoFactorCode ? { twoFactorCode } : {}) }
  });
}

export async function register(
  firstName: string,
  lastName: string,
  email: string,
  password: string
): Promise<ApiResponse<{ userId: string; email: string }>> {
  return apiFetch<ApiResponse<{ userId: string; email: string }>>('/api/auth/register', {
    method: 'POST',
    body: { firstName, lastName, email, password }
  });
}

export async function resendVerification(email: string): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>('/api/auth/resend-verification', {
    method: 'POST',
    body: { email }
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
  refreshToken?: string;
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

export async function logout(): Promise<ApiResponse<unknown>> {
  // apiFetch automatically attaches the current access token (if any) and
  // sends cookies, so the refresh token cookie is available server-side too.
  return apiFetch<ApiResponse<unknown>>('/api/auth/logout', {
    method: 'POST'
  });
}

export async function verifyTwoFactor(token: string): Promise<ApiResponse<{ verified: boolean }>> {
  return apiFetch<ApiResponse<{ verified: boolean }>>('/api/auth/2fa/verify', {
    method: 'POST',
    body: { token }
  });
}

export async function setupTwoFactor(): Promise<ApiResponse<{ secret: string; qrCode: string }>> {
  return apiFetch<ApiResponse<{ secret: string; qrCode: string }>>('/api/auth/2fa/setup', {
    method: 'POST'
  });
}

export async function disableTwoFactor(): Promise<ApiResponse<unknown>> {
  return apiFetch<ApiResponse<unknown>>('/api/auth/2fa/disable', {
    method: 'POST'
  });
}
