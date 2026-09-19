/**
 * Feature: Members - Domain Models & Contracts
 */

export const PRIMARY_GRADES = [
  'الصف الأول الابتدائي',
  'الصف الثاني الابتدائي',
  'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
] as const;

export const PREP_GRADES = [
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي',
] as const;

export const SECONDARY_GRADES = [
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
] as const;

export const SCHOOL_GRADES = [
  ...PRIMARY_GRADES,
  ...PREP_GRADES,
  ...SECONDARY_GRADES,
  'أخرى',
] as const;

export type SchoolStage =
  | (typeof SCHOOL_GRADES)[number]
  | 'ابتدائي'
  | 'إعدادي'
  | 'ثانوي'
  | 'جامعة'
  | 'تمهيدي';
export type MemberType = 'عضوة' | 'قائد';

export interface Member {
  id: number;
  member_code: string;
  student_name: string;
  student_name_en?: string | null;
  guardian_name?: string | null;
  national_id: string;
  birth_date: string;
  school_stage: SchoolStage;
  scout_join_year: number;
  medical_condition?: string | null;
  father_phone?: string | null;
  mother_phone?: string | null;
  leader_phone?: string | null;
  mother_email?: string | null;
  leader_email?: string | null;
  father_job?: string | null;
  mother_name?: string | null;
  mother_job?: string | null;
  address?: string | null;
  talents_skills?: string | null;
  member_type: MemberType;
  tribe_id?: number | null;
  tribe_name?: string | null;
  photo_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberFormData {
  student_name: string;
  student_name_en?: string;
  guardian_name?: string;
  national_id: string;
  birth_date: string;
  school_stage: SchoolStage;
  scout_join_year: number | string;
  medical_condition: string;
  father_phone: string;
  mother_phone: string;
  leader_phone?: string;
  mother_email?: string;
  leader_email?: string;
  father_job?: string;
  mother_name?: string;
  mother_job?: string;
  address?: string;
  talents_skills?: string;
  member_type: MemberType;
  tribe_id?: number | null | '';
  photo_path?: string | null;
}

export interface MemberFilterParams {
  q?: string;
  stage?: string;
  type?: string;
  tribe_id?: string;
}

export interface MemberOperationResult {
  success: boolean;
  message: string;
  id?: number;
  member_code?: string;
}

export interface PhotoUploadResult {
  success: boolean;
  photo_path: string;
  filename: string;
}

export interface MemberBatchImportResult {
  success: boolean;
  message: string;
  count: number;
  skippedCount: number;
  skippedDetails?: string[];
}

export interface BulkDeleteMembersRequest {
  member_ids: number[];
}

export interface BulkTransferMembersRequest {
  member_ids: number[];
  tribe_id: number | null; // null to remove from tribe
}

export interface BulkAwardBadgeRequest {
  member_ids: number[];
  badge_id: number;
  awarded_at?: string;
  reason?: string;
  notes?: string;
}

export interface BulkCardExportItem {
  member_id: number;
  student_name: string;
  member_code: string;
  front_base64: string; // base64 png string
  back_base64?: string; // base64 png string
}

export interface BulkExportCardsRequest {
  target_directory?: string; // defaults to C:\scoutsystem\scoutphoto
  cards: BulkCardExportItem[];
}

export interface BulkOperationResponse {
  success: boolean;
  message: string;
  affected_count: number;
  details?: string[];
  exported_paths?: string[];
  target_directory?: string;
}
