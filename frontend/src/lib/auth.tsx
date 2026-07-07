'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    api.get<User>('/auth/me').then((res) => {
      setState({ user: res.success && res.data ? res.data : null, loading: false });
    });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const res = await api.post<User>('/auth/login', { email, password });
    if (res.success && res.data) {
      setState({ user: res.data, loading: false });
      return null;
    }
    return res.message ?? 'Login failed';
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string): Promise<string | null> => {
      const res = await api.post<User>('/auth/register', { name, email, password });
      if (res.success && res.data) {
        setState({ user: res.data, loading: false });
        return null;
      }
      return res.message ?? 'Registration failed';
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    await api.post('/auth/logout', {});
    setState({ user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
