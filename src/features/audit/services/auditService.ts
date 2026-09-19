/**
 * Feature: Audit Logs - Application Service
 */

import { httpClient } from '../../../core/http/httpClient';
import { AuditLogItem } from '../types';

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  public async getAuditLogs(): Promise<AuditLogItem[]> {
    const res = await httpClient.get<{ logs: AuditLogItem[] }>('/api/audit-logs');
    return res.logs;
  }
}

export const auditService = AuditService.getInstance();
