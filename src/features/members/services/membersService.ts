/**
 * Feature: Members - Application & Domain Service
 * Pure TypeScript service for Member use cases & business rules
 */

import { httpClient } from '../../../core/http/httpClient';
import {
  Member,
  MemberFormData,
  MemberFilterParams,
  MemberOperationResult,
  PhotoUploadResult,
  MemberBatchImportResult,
  BulkOperationResponse,
  BulkCardExportItem,
} from '../types';

export class MembersService {
  private static instance: MembersService;

  private constructor() {}

  public static getInstance(): MembersService {
    if (!MembersService.instance) {
      MembersService.instance = new MembersService();
    }
    return MembersService.instance;
  }

  public async getMembers(params?: MemberFilterParams): Promise<Member[]> {
    const res = await httpClient.get<{ members: Member[] }>('/api/members', params);
    return res.members || [];
  }

  public async getMember(id: number): Promise<Member> {
    const res = await httpClient.get<{ member: Member }>(`/api/members/${id}`);
    return res.member;
  }

  public async addMember(data: MemberFormData): Promise<MemberOperationResult> {
    return httpClient.post<MemberOperationResult>('/api/members', data);
  }

  public async updateMember(id: number, data: MemberFormData): Promise<MemberOperationResult> {
    return httpClient.put<MemberOperationResult>(`/api/members/${id}`, data);
  }

  public async promoteToLeader(id: number, leaderPhone: string, leaderEmail?: string): Promise<MemberOperationResult> {
    return httpClient.post<MemberOperationResult>(`/api/members/${id}/promote-to-leader`, {
      leader_phone: leaderPhone,
      leader_email: leaderEmail ? leaderEmail.trim() : undefined,
    });
  }

  public async deleteMember(id: number): Promise<MemberOperationResult> {
    return httpClient.delete<MemberOperationResult>(`/api/members/${id}`);
  }

  public async uploadPhoto(file: File, memberCode?: string): Promise<PhotoUploadResult> {
    const formData = new FormData();
    formData.append('photo', file);
    if (memberCode) {
      formData.append('member_code', memberCode);
    }
    return httpClient.postFormData<PhotoUploadResult>('/api/photos/upload', formData);
  }

  public async batchImportMembers(file: File): Promise<MemberBatchImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return httpClient.postFormData<MemberBatchImportResult>('/api/members/batch-import', formData);
  }

  public getCsvTemplateUrl(): string {
    const token = httpClient.getToken();
    return `/api/csv/template?token=${encodeURIComponent(token || '')}`;
  }

  public getCsvExportUrl(): string {
    const token = httpClient.getToken();
    return `/api/csv/export?token=${encodeURIComponent(token || '')}`;
  }

  /**
   * Bulk operations
   */
  public async bulkDeleteMembers(memberIds: number[]): Promise<BulkOperationResponse> {
    return httpClient.post<BulkOperationResponse>('/api/members/bulk-delete', {
      member_ids: memberIds,
    });
  }

  public async bulkTransferTribe(memberIds: number[], tribeId: number | null): Promise<BulkOperationResponse> {
    return httpClient.post<BulkOperationResponse>('/api/members/bulk-transfer-tribe', {
      member_ids: memberIds,
      tribe_id: tribeId,
    });
  }

  public async bulkAwardBadge(
    memberIds: number[],
    badgeId: number,
    awardedAt?: string,
    reason?: string,
    notes?: string
  ): Promise<BulkOperationResponse> {
    return httpClient.post<BulkOperationResponse>('/api/members/bulk-award-badge', {
      member_ids: memberIds,
      badge_id: badgeId,
      awarded_at: awardedAt,
      reason,
      notes,
    });
  }

  public async bulkExportCards(cards: BulkCardExportItem[], targetDirectory?: string): Promise<BulkOperationResponse> {
    return httpClient.post<BulkOperationResponse>('/api/members/bulk-export-cards', {
      cards,
      target_directory: targetDirectory || 'C:\\scoutsystem\\scoutphoto',
    });
  }

  /**
   * Domain calculation: Calculate age from birth date string (YYYY-MM-DD)
   */
  public calculateAge(birthDateStr: string): number {
    if (!birthDateStr) return 0;
    const birth = new Date(birthDateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }
}

export const membersService = MembersService.getInstance();
