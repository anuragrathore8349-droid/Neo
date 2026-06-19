import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
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

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  updateNotificationSettings: (settings: Record<string, boolean>) => Promise<void>;
  error: string | null;
  setError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStoredAuth = () => {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem('neofin_auth');
  if (!stored) return null;

  try {
    return JSON.parse(stored) as { user: User; accessToken?: string };
  } catch {
    return null;
  }
};

let restoreSessionPromise: Promise<void> | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const buildUserWithName = (userData: User) => {
    return {
      ...userData,
      name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email,
    };
  };

  const persistAuth = (userData: User, token: string) => {
    const userWithName = buildUserWithName(userData);
    setUser(userWithName);
    setAccessToken(token);
    localStorage.setItem('neofin_auth', JSON.stringify({
      user: userWithName,
      accessToken: token
    }));
  };

  const clearAuth = () => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('neofin_auth');
  };

  useEffect(() => {
    const restoreSession = async () => {
      // Set a generous timeout to ensure loading state is cleared if session restoration hangs
      // Increased from 5s to 15s to account for slower network conditions
      const timeoutId = setTimeout(() => {
        console.log('Session restoration timeout (15s), setting loading to false');
        setIsLoading(false);
      }, 15000); // 15 second timeout

      try {
        const stored = getStoredAuth();
        if (!stored?.user) {
          clearAuth();
          clearTimeout(timeoutId);
          setIsLoading(false);
          return;
        }

        if (!restoreSessionPromise) {
          restoreSessionPromise = (async () => {
            try {
              const result = await authService.refreshToken();
              if (result?.data?.accessToken) {
                const newToken = result.data.accessToken;
                const profileResponse = await userService.getProfile(newToken);
                const profileUser = buildUserWithName(profileResponse.data as User);
                setUser(profileUser);
                setAccessToken(newToken);
                localStorage.setItem('neofin_auth', JSON.stringify({
                  user: profileUser,
                  accessToken: newToken
                }));
                console.log('Session successfully restored');
              } else {
                console.log('No access token in refresh response');
                clearAuth();
              }
            } catch (error: any) {
              const isSessionError = error?.status === 401 ||
                                    error?.message?.toLowerCase().includes('refresh token') ||
                                    error?.message?.toLowerCase().includes('invalid') ||
                                    error?.message?.toLowerCase().includes('expired');

              if (isSessionError) {
                console.log('Session restoration failed due to invalid or expired auth, clearing auth state');
                clearAuth();
              } else {
                console.error('Session restoration error:', error);
              }
            } finally {
              restoreSessionPromise = null;
            }
          })();
        }

        await restoreSessionPromise;
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const splitFullName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || parts[0] || ''
    };
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(email, password);
      persistAuth(response.data.user, response.data.accessToken);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { firstName, lastName } = splitFullName(fullName);
      await authService.register(firstName, lastName, email, password);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (accessToken) {
        await authService.logout(accessToken);
      }
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      clearAuth();
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.forgotPassword(email);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (token: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.resetPassword(token, password);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.verifyEmail(token);
      
      if (response.data) {
        const { user, accessToken } = response.data;
        
        // Use persistAuth to store both user and token
        persistAuth({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          plan: user.plan
        }, accessToken);
      }
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyTwoFactor = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!accessToken) {
        throw new Error('User must be logged in to verify 2FA');
      }
      await authService.verifyTwoFactor(code, accessToken);
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!accessToken) {
        throw new Error('User must be logged in to update profile');
      }

      const payload: Record<string, unknown> = {};
      if (data.name) {
        const { firstName, lastName } = splitFullName(data.name);
        payload.firstName = firstName;
        payload.lastName = lastName;
      }
      if (data.avatar !== undefined) payload.avatar = data.avatar;
      if (data.bio !== undefined) payload.bio = data.bio;
      if (data.phoneNumber !== undefined) payload.phoneNumber = data.phoneNumber;
      if (data.country !== undefined) payload.country = data.country;
      if (data.dateOfBirth !== undefined) payload.dateOfBirth = data.dateOfBirth;
      if (data.profession !== undefined) payload.profession = data.profession;
      if (data.timezone !== undefined) payload.timezone = data.timezone;
      if (data.language !== undefined) payload.language = data.language;
      if (data.currency !== undefined) payload.currency = data.currency;

      const response = await userService.updateProfile(accessToken, payload);
      const responseUser = response.data;
      
      // Merge updated fields with existing user, ensuring all fields are preserved
      const mergedUser: User = {
        ...user,
        ...(responseUser || {}),
        id: user?.id || responseUser?.id || '',
        email: user?.email || responseUser?.email || '',
      } as User;
      
      const updatedUser = buildUserWithName(mergedUser);
      setUser(updatedUser);
      
      localStorage.setItem('neofin_auth', JSON.stringify({ 
        user: updatedUser, 
        accessToken
      }));
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateNotificationSettings = async (settings: Record<string, boolean>) => {
    setIsLoading(true);
    setError(null);

    try {
      if (!accessToken) {
        throw new Error('User must be logged in to update notification settings');
      }

      // Map frontend setting names to backend field names
      // Note: Both priceAlerts and marketUpdates map to the same backend field (marketAlerts)
      const backendSettings: Record<string, boolean> = {
        securityAlerts: settings.securityAlerts ?? true,
        marketAlerts: settings.priceAlerts ?? settings.marketUpdates ?? true,
        newsDigest: settings.aiInsights ?? false,
        tradingUpdates: settings.tradeConfirmations ?? true,
        portfolioSummary: settings.portfolioUpdates ?? true,
      };

      const response = await userService.updateNotificationSettings(accessToken, backendSettings);
      
      // Update the user state with the new preferences
      if (user) {
        const updatedUser = {
          ...user,
          preferences: {
            ...user.preferences,
            notifications: response.data
          }
        };
        setUser(updatedUser);
        
        localStorage.setItem('neofin_auth', JSON.stringify({ 
          user: updatedUser, 
          accessToken
        }));
      }
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        verifyEmail,
        verifyTwoFactor,
        updateProfile,
        updateNotificationSettings,
        error,
        setError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // In development, during hot reloading, context might be temporarily undefined
    // Return a fallback object to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      console.warn('useAuth called outside AuthProvider context - this may be due to hot reloading');
      return {
        user: null,
        isAuthenticated: false,
        isLoading: false, // Allow login form to be usable during hot reloading
        login: async () => {},
        register: async () => {},
        logout: async () => {},
        forgotPassword: async () => {},
        resetPassword: async () => {},
        verifyEmail: async () => {},
        verifyTwoFactor: async () => {},
        updateProfile: async () => {},
        updateNotificationSettings: async () => {},
        error: null,
        setError: () => {}
      };
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
