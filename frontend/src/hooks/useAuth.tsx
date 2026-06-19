'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { authService, LoginPayload, RegisterPayload } from '../services/auth';
import { usersService, User } from '../services/users';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const router = useRouter();

  const checkAuth = React.useCallback(async () => {
    try {
      setLoading(true);
      const currentUser = await usersService.getMe();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (payload: LoginPayload) => {
    setLoading(true);
    try {
      const data = await authService.login(payload);
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', data.access_token);
      }
      const currentUser = await usersService.getMe();
      setUser(currentUser);
      setLoading(false);
      router.push('/dashboard');
    } catch (error) {
      setUser(null);
      setLoading(false);
      throw error;
    }
  };

  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      await authService.register(payload);
      // Auto login after registration
      await login({
        username_or_email: payload.username,
        password: payload.password,
      });
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error', error);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
      }
      setUser(null);
      setLoading(false);
      router.push('/login');
    }
  };

  const value = React.useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      checkAuth,
    }),
    [user, loading, checkAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
