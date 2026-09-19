import { httpClient } from '../../../core/http/httpClient';
import {
  Badge,
  MemberBadge,
  MemberBadgeSummaryRecord,
  BadgeFormPayload,
  AwardBadgePayload,
} from '../types';

export class BadgeService {
  private static instance: BadgeService;

  private constructor() {}

  public static getInstance(): BadgeService {
    if (!BadgeService.instance) {
      BadgeService.instance = new BadgeService();
    }
    return BadgeService.instance;
  }

  public async getBadges(): Promise<Badge[]> {
    return httpClient.get<Badge[]>('/api/badges');
  }

  public async createBadge(data: BadgeFormPayload): Promise<Badge> {
    return httpClient.post<Badge>('/api/badges', data);
  }

  public async updateBadge(id: number, data: BadgeFormPayload): Promise<Badge> {
    return httpClient.put<Badge>(`/api/badges/${id}`, data);
  }

  public async deleteBadge(id: number): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(`/api/badges/${id}`);
  }

  public async getMemberBadges(memberId: number): Promise<MemberBadge[]> {
    return httpClient.get<MemberBadge[]>(`/api/members/${memberId}/badges`);
  }

  public async awardBadge(
    memberId: number,
    data: AwardBadgePayload
  ): Promise<{ success: boolean; message: string; badges: MemberBadge[] }> {
    return httpClient.post<{ success: boolean; message: string; badges: MemberBadge[] }>(
      `/api/members/${memberId}/badges`,
      data
    );
  }

  public async revokeBadge(
    memberId: number,
    badgeId: number
  ): Promise<{ success: boolean; message: string }> {
    return httpClient.delete<{ success: boolean; message: string }>(
      `/api/members/${memberId}/badges/${badgeId}`
    );
  }

  public async getMemberBadgesSummary(): Promise<MemberBadgeSummaryRecord[]> {
    return httpClient.get<MemberBadgeSummaryRecord[]>('/api/badges/member-summary');
  }
}

export const badgeService = BadgeService.getInstance();
