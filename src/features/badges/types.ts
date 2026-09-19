export interface Badge {
  id: number;
  name: string;
  name_en?: string | null;
  category: string;
  icon: string;
  color: string;
  description: string;
  requirements: string;
  created_at?: string;
  updated_at?: string;
  awarded_count?: number;
}

export interface MemberBadge {
  award_id: number;
  member_id: number;
  badge_id: number;
  awarded_at: string;
  awarded_by: string;
  reason?: string | null;
  notes?: string | null;
  name: string;
  name_en?: string | null;
  category: string;
  icon: string;
  color: string;
  description: string;
  requirements: string;
}

export interface MemberBadgeSummaryRecord {
  award_id: number;
  member_id: number;
  badge_id: number;
  awarded_at: string;
  awarded_by: string;
  reason?: string | null;
  notes?: string | null;
  badge_name: string;
  badge_name_en?: string | null;
  badge_category: string;
  badge_icon: string;
  badge_color: string;
  badge_description: string;
  badge_requirements: string;
  student_name: string;
  member_code?: string | null;
  member_type: 'عضوة' | 'قائد';
  photo_path?: string | null;
  school_stage?: string | null;
  tribe_name?: string | null;
}

export interface BadgeFormPayload {
  name: string;
  name_en?: string;
  category: string;
  icon: string;
  color: string;
  description: string;
  requirements: string;
}

export interface AwardBadgePayload {
  badge_id: number;
  awarded_at?: string;
  reason?: string;
  notes?: string;
}
