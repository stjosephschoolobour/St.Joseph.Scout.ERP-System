import { Member, SchoolStage } from '../members/types';

export interface BirthdayMember extends Member {
  birthdayDate: string;
  dayOfWeekName: string;
  formattedDate: string;
  turningAge: number;
  isToday: boolean;
  daysRemaining: number;
}

export interface DashboardStats {
  totalMembers: number;
  totalFemales: number;
  totalLeaders: number;
  totalTribes: number;
  tribesBreakdown: { id: number; name: string; count: number }[];
  stages: Record<SchoolStage, number>;
  medicalConditionsCount: number;
  recentMembers: Member[];
  weeklyBirthdays?: BirthdayMember[];
}

