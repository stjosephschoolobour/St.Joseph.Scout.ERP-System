/**
 * Feature: Dashboard - Application & Domain Service
 * Pure TypeScript service for dashboard stats
 */

import { httpClient } from '../../../core/http/httpClient';
import { DashboardStats, BirthdayMember } from '../types';

export class DashboardService {
  private static instance: DashboardService;

  private constructor() {}

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  public async getStats(): Promise<DashboardStats> {
    return httpClient.get<DashboardStats>('/api/dashboard');
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    return this.getStats();
  }

  public async getBirthdays(period: 'week' | 'next7' | 'month' = 'week'): Promise<BirthdayMember[]> {
    const res = await httpClient.get<{ success: boolean; count: number; period: string; birthdays: BirthdayMember[] }>(
      `/api/birthdays?period=${period}`
    );
    return res.birthdays || [];
  }
}

export const dashboardService = DashboardService.getInstance();
