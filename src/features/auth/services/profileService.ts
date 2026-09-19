/**
 * Feature: Auth - Profile & Account Management Service
 */

import { httpClient } from '../../../core/http/httpClient';
import { User, UserProfileRequest, ProfileFormData } from '../types';

export interface UserProfileResponse {
  user: User;
  pending_request: UserProfileRequest | null;
  last_rejected_request: UserProfileRequest | null;
}

export class ProfileService {
  private static instance: ProfileService;

  private constructor() {}

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  public async getProfile(): Promise<UserProfileResponse> {
    return httpClient.get<UserProfileResponse>('/api/user/profile');
  }

  public async uploadPhoto(file: File): Promise<{ photo_path: string }> {
    const formData = new FormData();
    formData.append('photo', file);

    const token = httpClient.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/photos/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'فشل في رفع الصورة' }));
      throw new Error(err.error || 'فشل في رفع الصورة');
    }

    return res.json();
  }

  public async submitProfileRequest(data: ProfileFormData): Promise<{
    success: boolean;
    message: string;
    auto_approved?: boolean;
    user?: User;
    request?: UserProfileRequest;
  }> {
    return httpClient.post('/api/user/profile/request', data);
  }

  public async cancelProfileRequest(): Promise<{ success: boolean; message: string }> {
    return httpClient.delete('/api/user/profile/request');
  }

  public async updateTheme(theme: 'light' | 'dark'): Promise<{ success: boolean }> {
    return httpClient.put('/api/user/theme', { theme });
  }

  // Admin Profile Request Approvals
  public async getPendingRequests(): Promise<{ requests: UserProfileRequest[] }> {
    return httpClient.get<{ requests: UserProfileRequest[] }>('/api/admin/profile-requests');
  }

  public async getPendingRequestsCount(): Promise<{ count: number }> {
    return httpClient.get<{ count: number }>('/api/admin/profile-requests/count');
  }

  public async approveRequest(requestId: number): Promise<{ success: boolean; message: string }> {
    return httpClient.post(`/api/admin/profile-requests/${requestId}/approve`);
  }

  public async rejectRequest(requestId: number, notes?: string): Promise<{ success: boolean; message: string }> {
    return httpClient.post(`/api/admin/profile-requests/${requestId}/reject`, { notes });
  }
}

export const profileService = ProfileService.getInstance();
