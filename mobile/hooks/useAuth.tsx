import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, TokenStorage } from '@/services/api';
import type { LoginPayload, RegisterPayload, User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.me();
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await TokenStorage.getAccess();
      if (!token) {
        setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      await refreshUser();
    })();
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const { access, refresh, user } = await authApi.login(payload);
    await TokenStorage.save(access, refresh);
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { access, refresh, user } = await authApi.register(payload);
    await TokenStorage.save(access, refresh);
    setState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      const refresh = await TokenStorage.getRefresh();
      if (refresh) await authApi.logout(refresh);
    } catch {
      // ignore
    } finally {
      await TokenStorage.clear();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
