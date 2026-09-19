/**
 * Feature: Activities - Domain Models & Contracts
 */

import { SchoolStage, MemberType } from '../members/types';

export interface Activity {
  id: number;
  type: 'معسكر' | 'نشاط';
  name: string;
  location: string;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  fee: number;
  leader_name?: string | null;
  deputy_name?: string | null;
  max_participants?: number;
  description?: string | null;
  status: 'مفتوح' | 'جاري' | 'منتهي' | 'ملغي';
  participant_count?: number;
  total_fees_collected?: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityFormData {
  type: 'معسكر' | 'نشاط';
  name: string;
  location: string;
  address?: string;
  start_date?: string;
  end_date?: string;
  fee: number | string;
  leader_name?: string;
  deputy_name?: string;
  max_participants?: number | string;
  description?: string;
  status: 'مفتوح' | 'جاري' | 'منتهي' | 'ملغي';
}

export interface ActivityParticipant {
  id: number;
  activity_id: number;
  member_id: number;
  payment_status: 'مدفوع' | 'غير مدفوع' | 'جزئي';
  paid_amount: number;
  notes?: string | null;
  registered_at: string;
  member_code: string;
  student_name: string;
  student_name_en?: string | null;
  guardian_name: string;
  national_id: string;
  school_stage: SchoolStage;
  member_type: MemberType;
  tribe_name?: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
  photo_path?: string | null;
}
