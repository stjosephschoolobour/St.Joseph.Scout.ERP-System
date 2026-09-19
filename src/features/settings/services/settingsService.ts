/**
 * Feature: Settings - Application & Domain Service
 */

import { httpClient } from '../../../core/http/httpClient';
import { SystemSettings, AuditLogItem } from '../types';
import { User } from '../../auth/types';

export class SettingsService {
  private static instance: SettingsService;
  private cachedSettings: SystemSettings | null = null;
  private listeners: Set<(settings: SystemSettings) => void> = new Set();

  private constructor() {}

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  public getCachedSettings(): SystemSettings | null {
    return this.cachedSettings;
  }

  public subscribe(listener: (settings: SystemSettings) => void): () => void {
    this.listeners.add(listener);
    if (this.cachedSettings) {
      listener(this.cachedSettings);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getSettings(): Promise<SystemSettings> {
    const res = await httpClient.get<{ settings: SystemSettings }>('/api/settings');
    this.cachedSettings = res.settings;
    this.listeners.forEach((l) => l(res.settings));
    return res.settings;
  }

  public async updateSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean; message: string }> {
    const res = await httpClient.post<{ success: boolean; message: string }>('/api/settings', settings);
    // Refresh cached settings after update
    await this.getSettings().catch(() => {});
    return res;
  }

  public async getUsers(): Promise<User[]> {
    const res = await httpClient.get<{ users: User[] }>('/api/users');
    return res.users;
  }

  public async addUser(data: {
    username: string;
    password: string;
    role: 'ADMIN' | 'DATA_ENTRY' | 'LEADER';
    full_name?: string;
    member_id?: number | null;
    tribe_id?: number | null;
    phone?: string;
  }): Promise<{ success: boolean; message: string }> {
    return httpClient.post<{ success: boolean; message: string }>('/api/users', data);
  }

  public async updateUser(
    id: number,
    data: {
      role?: 'ADMIN' | 'DATA_ENTRY' | 'LEADER';
      is_active?: boolean;
      new_password?: string;
      full_name?: string;
      member_id?: number | null;
      tribe_id?: number | null;
      phone?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    return httpClient.put<{ success: boolean; message: string }>(`/api/users/${id}`, data);
  }

  public async deleteUser(id: number): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(`/api/users/${id}`);
  }

  public async getNetworkInfo(): Promise<{ port: number; localIps: string[]; urls: string[] }> {
    return httpClient.get<{ port: number; localIps: string[]; urls: string[] }>('/api/network-info');
  }

  public async getAuditLogs(): Promise<AuditLogItem[]> {
    const res = await httpClient.get<{ logs: AuditLogItem[] }>('/api/audit-logs');
    return res.logs;
  }
}

export const settingsService = SettingsService.getInstance();
