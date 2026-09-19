/**
 * Feature: Reports - Application & Domain Service
 */

import { httpClient } from '../../../core/http/httpClient';
import { ReportData } from '../types';

export class ReportsService {
  private static instance: ReportsService;

  private constructor() {}

  public static getInstance(): ReportsService {
    if (!ReportsService.instance) {
      ReportsService.instance = new ReportsService();
    }
    return ReportsService.instance;
  }

  public async getReportsSummary(): Promise<ReportData> {
    return httpClient.get<ReportData>('/api/reports/summary');
  }

  public async getReports(): Promise<ReportData> {
    return this.getReportsSummary();
  }
}

export const reportsService = ReportsService.getInstance();
