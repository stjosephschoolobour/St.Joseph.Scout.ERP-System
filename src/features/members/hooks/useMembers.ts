/**
 * Feature: Members - Custom Hook
 * Encapsulates member state management, search, filters, and mutations
 */

import { useState, useEffect, useCallback } from 'react';
import { Member, MemberFilterParams, MemberFormData } from '../types';
import { membersService } from '../services/membersService';

export function useMembers(initialParams?: MemberFilterParams) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState(initialParams?.q || '');
  const [selectedStage, setSelectedStage] = useState(initialParams?.stage || 'ALL');
  const [selectedType, setSelectedType] = useState(initialParams?.type || 'ALL');
  const [selectedTribe, setSelectedTribe] = useState(initialParams?.tribe_id || 'ALL');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await membersService.getMembers({
        q: searchTerm || undefined,
        stage: selectedStage !== 'ALL' ? selectedStage : undefined,
        type: selectedType !== 'ALL' ? selectedType : undefined,
        tribe_id: selectedTribe !== 'ALL' ? selectedTribe : undefined,
      });
      setMembers(data);
    } catch (err: any) {
      const msg = err.message || 'فشل تحميل بيانات الأعضاء';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStage, selectedType, selectedTribe]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const addMember = useCallback(async (data: MemberFormData) => {
    const res = await membersService.addMember(data);
    await fetchMembers();
    return res;
  }, [fetchMembers]);

  const updateMember = useCallback(async (id: number, data: MemberFormData) => {
    const res = await membersService.updateMember(id, data);
    await fetchMembers();
    return res;
  }, [fetchMembers]);

  const deleteMember = useCallback(async (id: number) => {
    const res = await membersService.deleteMember(id);
    await fetchMembers();
    return res;
  }, [fetchMembers]);

  return {
    members,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    selectedStage,
    setSelectedStage,
    selectedType,
    setSelectedType,
    selectedTribe,
    setSelectedTribe,
    refresh: fetchMembers,
    addMember,
    updateMember,
    deleteMember,
  };
}
