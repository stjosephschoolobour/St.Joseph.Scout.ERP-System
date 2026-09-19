/**
 * Feature: Reports - Domain Models & Contracts
 */

import { Member } from '../members/types';
import { Tribe } from '../tribes/types';

export interface ReportData {
  total: number;
  totalFemales: number;
  totalLeaders: number;
  totalTribes: number;
  stagesBreakdown: Record<string, { total: number; females: number; leaders: number }>;
  joinYearBreakdown: Record<number, number>;
  tribesBreakdown: { id: number; name: string; count: number }[];
  medicalCasesCount: number;
  medicalCases: Member[];
  allMembers: Member[];
  tribes: Tribe[];
}

export type ReportTab = 'summary' | 'stages' | 'leaders' | 'females' | 'medical' | 'join_year';
