/**
 * Feature: Audit Logs - Domain Models & Contracts
 */

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'ADD'
  | 'EDIT'
  | 'DELETE'
  | 'BACKUP'
  | 'RESTORE'
  | 'EXPORT'
  | 'BATCH_IMPORT';

export interface AuditLogItem {
  id: number;
  date: string;
  time: string;
  user: string;
  action: AuditAction | string;
  member_id?: number | null;
  member_name?: string | null;
  details?: string | null;
  created_at: string;
}
