/**
 * Feature: Activities - Application & Domain Service
 */

import { httpClient } from '../../../core/http/httpClient';
import { Activity, ActivityFormData, ActivityParticipant } from '../types';

export class ActivitiesService {
  private static instance: ActivitiesService;

  private constructor() {}

  public static getInstance(): ActivitiesService {
    if (!ActivitiesService.instance) {
      ActivitiesService.instance = new ActivitiesService();
    }
    return ActivitiesService.instance;
  }

  public async getActivities(): Promise<Activity[]> {
    const res = await httpClient.get<{ activities: Activity[] }>('/api/activities');
    return res.activities;
  }

  public async getActivity(id: number): Promise<Activity & { participants: ActivityParticipant[] }> {
    const res = await httpClient.get<{ activity: Activity & { participants: ActivityParticipant[] } }>(
      `/api/activities/${id}`
    );
    return res.activity;
  }

  public async createActivity(data: ActivityFormData): Promise<{ success: boolean; message: string; id: number }> {
    return httpClient.post<{ success: boolean; message: string; id: number }>('/api/activities', data);
  }

  public async updateActivity(id: number, data: ActivityFormData): Promise<{ success: boolean; message: string }> {
    return httpClient.put<{ success: boolean; message: string }>(`/api/activities/${id}`, data);
  }

  public async deleteActivity(id: number): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(`/api/activities/${id}`);
  }

  public async addActivityParticipants(
    activityId: number,
    memberIds: number[],
    paymentStatus: string = 'مدفوع',
    paidAmount?: number,
    notes?: string
  ): Promise<{ success: boolean; message: string; addedCount: number; skippedCount: number }> {
    return httpClient.post<{ success: boolean; message: string; addedCount: number; skippedCount: number }>(
      `/api/activities/${activityId}/participants`,
      {
        member_ids: memberIds,
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        notes,
      }
    );
  }

  public async updateActivityParticipant(
    activityId: number,
    participantId: number,
    paymentStatus: string,
    paidAmount: number,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    return httpClient.put<{ success: boolean; message: string }>(
      `/api/activities/${activityId}/participants/${participantId}`,
      {
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        notes,
      }
    );
  }

  public async removeActivityParticipant(
    activityId: number,
    participantId: number
  ): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(
      `/api/activities/${activityId}/participants/${participantId}`
    );
  }
}

export const activitiesService = ActivitiesService.getInstance();
