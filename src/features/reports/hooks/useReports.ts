/**
 * Feature: Reports - Custom Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { ReportData } from '../types';
import { reportsService } from '../services/reportsService';

export function useReports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reports = await reportsService.getReports();
      setData(reports);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات التقارير');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return {
    data,
    loading,
    error,
    refresh: fetchReports,
  };
}
