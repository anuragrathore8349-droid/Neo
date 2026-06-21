import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';

export const AUTH_STORAGE_KEY = 'neofin_auth';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role?: string;
  twoFactorEnabled?: boolean;
  isTwoFactorEnabled?: boolean;
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

interface StoredAuth {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<{ email: string }>;
  resendVerification: (email: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  updateProfile: (data: Record<string, unknown>) => Promise<void>;
  updateNotificationSettings: (settings: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Storage helpers ─────────────────────────────────────────────────────
// Every part of the app (api.ts, services, contexts, components) reads and
// writes auth state under this ONE key/shape. Do not introduce additional
// localStorage keys for tokens - that's what caused authenticated requests
// to silently fail before this fix.
function readStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken || !parsed?.user) return null;
    return parsed as StoredAuth;
  } catch {
    return null;
  }
}

function writeStoredAuth(auth: StoredAuth) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function deriveDisplayName(user: { firstName?: string; lastName?: string; name?: string; email?: string }): string {
  if (user.name) return user.name;
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.email || '';
}

function normalizeUser(rawUser: any): User {
  return {
    ...rawUser,
    id: rawUser.id || rawUser._id,
    name: deriveDisplayName(rawUser),
    twoFactorEnabled: rawUser.isTwoFactorEnabled ?? rawUser.twoFactorEnabled ?? false,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount: verify the stored access token is still
  // valid (or refresh it) before trusting it.
  useEffect(() => {
    const restoreSession = async () => {
      const stored = readStoredAuth();

      if (!stored) {
        setIsLoading(false);
        return;
      }

      // Optimistically restore from storage immediately so the UI doesn't
      // flash a logged-out state, then verify/refresh in the background.
      setUser(stored.user);
      setToken(stored.accessToken);

      try {
        const result = await authService.refreshToken();
        if (result?.data?.accessToken) {
          const updated: StoredAuth = {
            accessToken: result.data.accessToken,
            refreshToken: result.data.refreshToken || stored.refreshToken,
            user: stored.user,
          };
          writeStoredAuth(updated);
          setToken(updated.accessToken);
        }
      } catch {
        // Refresh failed - the session is no longer valid.
        clearStoredAuth();
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string, twoFactorCode?: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await authService.login(email, password, twoFactorCode);

      if (response.data?.accessToken && response.data?.user) {
        const normalizedUser = normalizeUser(response.data.user);
        writeStoredAuth({
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          user: normalizedUser,
        });
        setUser(normalizedUser);
        setToken(response.data.accessToken);
      }
    } catch (err: any) {
      const message = err?.response?.code === 'TWO_FACTOR_REQUIRED'
        ? '2FA code required'
        : (err?.message || 'Login failed');
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      const response = await authService.register(firstName, lastName, email, password);
      return { email: response.data?.email || email };
    } catch (err: any) {
      const message = err?.message || 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setError(null);
    try {
      await authService.resendVerification(email);
    } catch (err: any) {
      const message = err?.message || 'Failed to resend verification email';
      setError(message);
      throw err;
    }
  }, []);

  const verifyEmail = useCallback(async (verifyToken: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await authService.verifyEmail(verifyToken);

      if (response.data?.accessToken && response.data?.user) {
        const normalizedUser = normalizeUser(response.data.user);
        writeStoredAuth({
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          user: normalizedUser,
        });
        setUser(normalizedUser);
        setToken(response.data.accessToken);
      }
    } catch (err: any) {
      const message = err?.message || 'Email verification failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyTwoFactor = useCallback(async (code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.verifyTwoFactor(code);
    } catch (err: any) {
      const message = err?.message || 'Invalid 2FA code';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
    } catch (err: any) {
      const message = err?.message || 'Failed to send reset email';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (resetToken: string, newPassword: string) => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.resetPassword(resetToken, newPassword);
    } catch (err: any) {
      const message = err?.message || 'Failed to reset password';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: Record<string, unknown>) => {
    setError(null);
    const stored = readStoredAuth();
    if (!stored) throw new Error('Not authenticated');

    try {
      const response = await userService.updateProfile(stored.accessToken, data);
      if (response.data) {
        const mergedUser = normalizeUser({ ...stored.user, ...response.data });
        writeStoredAuth({ ...stored, user: mergedUser });
        setUser(mergedUser);
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to update profile';
      setError(message);
      throw err;
    }
  }, []);

  const updateNotificationSettings = useCallback(async (settings: Record<string, unknown>) => {
    setError(null);
    const stored = readStoredAuth();
    if (!stored) throw new Error('Not authenticated');

    try {
      await userService.updateNotificationSettings(stored.accessToken, settings as Record<string, boolean>);
    } catch (err: any) {
      const message = err?.message || 'Failed to update notification settings';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget: tell the server to invalidate the refresh token,
    // but don't block clearing local state on it.
    authService.logout().catch(() => {});

    clearStoredAuth();
    setUser(null);
    setToken(null);
    setError(null);
    window.location.href = '/login';
  }, []);

  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        resendVerification,
        verifyEmail,
        verifyTwoFactor,
        forgotPassword,
        resetPassword,
        updateProfile,
        updateNotificationSettings,
        logout,
        error,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
