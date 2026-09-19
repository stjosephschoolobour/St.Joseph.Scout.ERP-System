/**
 * Feature: Auth - Custom Hook
 * Connects React UI to the pure TypeScript AuthService
 */

import { useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials } from '../types';
import { authService } from '../services/authService';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedUser = authService.getUser();
        if (storedUser && authService.getToken()) {
          const verifiedUser = await authService.checkAuth();
          setCurrentUser(verifiedUser);
        }
      } catch (err: any) {
        console.error('[useAuth] Init error:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authService.login(credentials);
      setCurrentUser(res.user);
      return res.user;
    } catch (err: any) {
      const message = err.message || 'فشل تسجيل الدخول';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    currentUser,
    setCurrentUser,
    isInitializing,
    isLoading,
    error,
    login,
    logout,
    isAuthenticated: !!currentUser,
  };
}
