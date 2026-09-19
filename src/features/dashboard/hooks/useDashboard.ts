/**
 * Feature: Dashboard - Custom Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { DashboardStats } from '../types';
import { dashboardService } from '../services/dashboardService';

export function useDashboard(enabled: boolean = true) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل إحصائيات لوحة التحكم');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}
