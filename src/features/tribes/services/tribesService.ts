/**
 * Feature: Tribes - Application & Domain Service
 * Pure TypeScript service for Tribe operations
 */

import { httpClient } from '../../../core/http/httpClient';
import { Tribe, TribeFormData, TribeOperationResult } from '../types';

export class TribesService {
  private static instance: TribesService;

  private constructor() {}

  public static getInstance(): TribesService {
    if (!TribesService.instance) {
      TribesService.instance = new TribesService();
    }
    return TribesService.instance;
  }

  public async getTribes(): Promise<Tribe[]> {
    const res = await httpClient.get<{ tribes: Tribe[] }>('/api/tribes');
    return res.tribes || [];
  }

  public async getTribe(id: number): Promise<Tribe> {
    const res = await httpClient.get<{ tribe: Tribe }>(`/api/tribes/${id}`);
    return res.tribe;
  }

  public async createTribe(data: TribeFormData): Promise<TribeOperationResult> {
    return httpClient.post<TribeOperationResult>('/api/tribes', data);
  }

  public async updateTribe(id: number, data: TribeFormData): Promise<TribeOperationResult> {
    return httpClient.put<TribeOperationResult>(`/api/tribes/${id}`, data);
  }

  public async deleteTribe(id: number): Promise<TribeOperationResult> {
    return httpClient.delete<TribeOperationResult>(`/api/tribes/${id}`);
  }

  public async addMembersToTribe(tribeId: number, memberIds: number[]): Promise<TribeOperationResult> {
    return httpClient.post<TribeOperationResult>(`/api/tribes/${tribeId}/members`, {
      member_ids: memberIds,
    });
  }

  public async removeMemberFromTribe(tribeId: number, memberId: number): Promise<TribeOperationResult> {
    return httpClient.delete<TribeOperationResult>(`/api/tribes/${tribeId}/members/${memberId}`);
  }

  // --- Tribe Meetings & Attendance Methods ---

  public async getTribeMeetings(tribeId: number): Promise<{ tribe: any; meetings: import('../types').TribeMeeting[] }> {
    return httpClient.get<{ tribe: any; meetings: import('../types').TribeMeeting[] }>(`/api/tribes/${tribeId}/meetings`);
  }

  public async createMeeting(
    tribeId: number,
    data: { meeting_date?: string; title?: string; notes?: string; bulk?: boolean; dates?: string[] }
  ): Promise<{ success: boolean; message: string }> {
    return httpClient.post<{ success: boolean; message: string }>(`/api/tribes/${tribeId}/meetings`, data);
  }

  public async deleteMeeting(tribeId: number, meetingId: number): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(`/api/tribes/${tribeId}/meetings/${meetingId}`);
  }

  public async getMeetingAttendance(tribeId: number, meetingId: number): Promise<import('../types').MeetingAttendanceData> {
    return httpClient.get<import('../types').MeetingAttendanceData>(`/api/tribes/${tribeId}/meetings/${meetingId}/attendance`);
  }

  public async saveMeetingAttendance(
    tribeId: number,
    meetingId: number,
    records: Array<{ member_id: number; status: string; notes?: string }>
  ): Promise<{ success: boolean; message: string }> {
    return httpClient.post<{ success: boolean; message: string }>(`/api/tribes/${tribeId}/meetings/${meetingId}/attendance`, {
      records,
    });
  }

  public async getTribeAttendanceSummary(tribeId: number): Promise<import('../types').TribeAttendanceSummaryResponse> {
    return httpClient.get<import('../types').TribeAttendanceSummaryResponse>(`/api/tribes/${tribeId}/attendance-summary`);
  }
}

export const tribesService = TribesService.getInstance();
