/**
 * Feature: Auth - Application & Domain Service
 * Pure TypeScript service handling authentication business logic
 */

import { httpClient } from '../../../core/http/httpClient';
import { User, LoginCredentials, AuthResponse } from '../types';

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public getToken(): string | null {
    return httpClient.getToken();
  }

  public getUser(): User | null {
    return httpClient.getUser<User>();
  }

  public setUser(user: User): void {
    httpClient.setUser(user);
  }

  public setAuth(token: string, user: User): void {
    httpClient.setToken(token);
    httpClient.setUser(user);
  }

  public clearAuth(): void {
    httpClient.clearAuth();
  }

  public isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  }

  public async login(
    credentialsOrUsername: LoginCredentials | string,
    maybePassword?: string
  ): Promise<AuthResponse> {
    const username = typeof credentialsOrUsername === 'string' ? credentialsOrUsername : credentialsOrUsername.username;
    const password = typeof credentialsOrUsername === 'string' ? maybePassword || '' : credentialsOrUsername.password;

    if (!username?.trim() || !password?.trim()) {
      throw new Error('يرجى إدخال اسم المستخدم وكلمة المرور');
    }

    const res = await httpClient.post<AuthResponse>('/api/auth/login', {
      username: username.trim(),
      password,
    });

    this.setAuth(res.token, res.user);
    return res;
  }

  public async logout(): Promise<void> {
    try {
      await httpClient.post('/api/auth/logout');
    } catch {
      // Ignore network failure on logout
    } finally {
      this.clearAuth();
    }
  }

  public async checkAuth(): Promise<User | null> {
    try {
      if (!this.getToken()) return null;
      const res = await httpClient.get<{ user: User }>('/api/auth/me');
      if (res?.user) {
        httpClient.setUser(res.user);
        return res.user;
      }
      return null;
    } catch {
      this.clearAuth();
      return null;
    }
  }
}

export const authService = AuthService.getInstance();
