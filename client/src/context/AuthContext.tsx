// client/src/context/AuthContext.tsx — REPLACE ENTIRE FILE
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, refreshToken } from '../services/auth.service';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading:       boolean;
  user:            any | null;
  login:           (email: string, password: string, twoFa?: string) => Promise<any>;
  logout:          () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user,    setUser]    = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try to restore session
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setIsLoading(false); return; }
    refreshToken()
      .then((data) => { if (data?.user) setUser(data.user); })
      .catch(() => { localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string, twoFa?: string) => {
    const data = await apiLogin(email, password, twoFa);
    if (data?.accessToken) {
      localStorage.setItem('accessToken',  data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken || '');
      setUser(data.user || null);
    }
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated: !!user,
      isLoading,
      user,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
