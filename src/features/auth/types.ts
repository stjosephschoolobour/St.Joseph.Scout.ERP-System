/**
 * Feature: Auth - Domain Models & Types
 */

export type UserRole = 'ADMIN' | 'DATA_ENTRY' | 'LEADER';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  full_name?: string;
  member_id?: number | null;
  member_code?: string | null;
  member_name?: string | null;
  tribe_id?: number | null;
  tribe_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  photo_path?: string | null;
  theme_preference?: 'light' | 'dark';
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export type ProfileRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface UserProfileRequest {
  id: number;
  user_id: number;
  username?: string;
  full_name?: string;
  role?: UserRole;
  tribe_name?: string | null;
  current_photo_path?: string | null;
  current_address?: string | null;
  current_phone?: string | null;
  current_email?: string | null;
  requested_photo_path?: string | null;
  requested_address?: string | null;
  requested_phone?: string | null;
  requested_email?: string | null;
  has_new_password?: boolean;
  status: ProfileRequestStatus;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface ProfileFormData {
  photo_path?: string;
  address?: string;
  phone?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
  theme_preference?: 'light' | 'dark';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
