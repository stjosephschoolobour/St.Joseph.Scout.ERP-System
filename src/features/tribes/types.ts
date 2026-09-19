/**
 * Feature: Tribes - Domain Models & Contracts
 */

import { Member } from '../members/types';

export interface Tribe {
  id: number;
  code: string;
  name: string;
  leader_id?: number | null;
  leader_name?: string | null;
  deputy_id?: number | null;
  deputy_name?: string | null;
  description?: string | null;
  member_count?: number;
  members?: Member[];
  created_at: string;
  updated_at: string;
}

export interface TribeFormData {
  name: string;
  code?: string;
  leader_id?: number | null | '';
  deputy_id?: number | null | '';
  description?: string;
}

export interface TribeOperationResult {
  success: boolean;
  message: string;
  id?: number;
  code?: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE';

export interface TribeMeeting {
  id: number;
  tribe_id: number;
  meeting_date: string;
  title: string;
  notes?: string | null;
  day_name?: string;
  created_at: string;
  updated_at: string;
  total_members: number;
  attendance_records_count?: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  late_count: number;
  attendance_rate: number;
  is_recorded: boolean;
}

export interface MemberAttendanceItem {
  member_id: number;
  member_code: string;
  student_name: string;
  photo_path?: string | null;
  school_stage: string;
  phone?: string;
  status: AttendanceStatus;
  notes: string;
  is_saved: boolean;
}

export interface MeetingAttendanceData {
  success: boolean;
  meeting: TribeMeeting;
  tribe: { id: number; name: string; code: string };
  stats: {
    total: number;
    present: number;
    absent: number;
    excused: number;
    late: number;
  };
  is_recorded: boolean;
  records: MemberAttendanceItem[];
}

export interface TribeAttendanceSummaryItem {
  member_id: number;
  member_code: string;
  student_name: string;
  photo_path?: string | null;
  school_stage: string;
  present_count: number;
  absent_count: number;
  excused_count: number;
  late_count: number;
  attended_count: number;
  total_meetings: number;
  attendance_rate: number;
}

export interface TribeAttendanceSummaryResponse {
  success: boolean;
  tribe: { id: number; name: string; code: string };
  total_meetings: number;
  summary: TribeAttendanceSummaryItem[];
}
