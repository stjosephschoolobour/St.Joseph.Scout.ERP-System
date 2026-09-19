/**
 * Feature: Tribes - Custom Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { Tribe, TribeFormData } from '../types';
import { tribesService } from '../services/tribesService';

export function useTribes() {
  const [tribes, setTribes] = useState<Tribe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTribes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tribesService.getTribes();
      setTribes(data);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل العشائر');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTribes();
  }, [fetchTribes]);

  const createTribe = useCallback(async (data: TribeFormData) => {
    const res = await tribesService.createTribe(data);
    await fetchTribes();
    return res;
  }, [fetchTribes]);

  const updateTribe = useCallback(async (id: number, data: TribeFormData) => {
    const res = await tribesService.updateTribe(id, data);
    await fetchTribes();
    return res;
  }, [fetchTribes]);

  const deleteTribe = useCallback(async (id: number) => {
    const res = await tribesService.deleteTribe(id);
    await fetchTribes();
    return res;
  }, [fetchTribes]);

  return {
    tribes,
    loading,
    error,
    refresh: fetchTribes,
    createTribe,
    updateTribe,
    deleteTribe,
  };
}
