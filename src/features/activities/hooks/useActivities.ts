/**
 * Feature: Activities - Custom Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { Activity } from '../types';
import { activitiesService } from '../services/activitiesService';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await activitiesService.getActivities();
      setActivities(data);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل الأنشطة والمعسكرات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    activities,
    loading,
    error,
    refresh: fetchActivities,
  };
}
