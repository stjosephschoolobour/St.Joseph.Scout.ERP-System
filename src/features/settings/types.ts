/**
 * Feature: Settings - Domain Models & Contracts
 */

export interface SystemSettings {
  school_name: string;
  system_name: string;
  current_year: string;
  scout_group_name?: string;
  scout_group_name_en?: string;
  scout_logo_url?: string;
  group_slogan?: string;
}

export type { AuditLogItem } from '../audit/types';
