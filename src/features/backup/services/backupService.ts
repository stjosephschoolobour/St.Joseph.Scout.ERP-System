/**
 * Feature: Backup & Restore - Application & Domain Service
 */

import { httpClient } from '../../../core/http/httpClient';
import {
  BatchImportResult,
  RestoreResult,
  FullSystemRestoreResult,
  PhotosRestoreResult,
  BackupStatusResponse,
} from '../types';

export class BackupService {
  private static instance: BackupService;

  private constructor() {}

  public static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  public getCsvTemplateUrl(): string {
    const token = httpClient.getToken();
    return `/api/csv/template?token=${encodeURIComponent(token || '')}`;
  }

  public getCsvExportUrl(): string {
    const token = httpClient.getToken();
    return `/api/csv/export?token=${encodeURIComponent(token || '')}`;
  }

  public getBackupDownloadUrl(): string {
    const token = httpClient.getToken();
    return `/api/backup/download?token=${encodeURIComponent(token || '')}`;
  }

  public getFullSystemBackupDownloadUrl(): string {
    const token = httpClient.getToken();
    return `/api/backup/full-system/download?token=${encodeURIComponent(token || '')}`;
  }

  public getExcelBackupDownloadUrl(): string {
    const token = httpClient.getToken();
    return `/api/backup/excel/download?token=${encodeURIComponent(token || '')}`;
  }

  public getPhotosBackupDownloadUrl(memberIds?: number[]): string {
    const token = httpClient.getToken();
    let url = `/api/backup/photos/download?token=${encodeURIComponent(token || '')}`;
    if (memberIds && memberIds.length > 0) {
      url += `&memberIds=${encodeURIComponent(memberIds.join(','))}`;
    }
    return url;
  }

  public async restorePhotosBackup(file: File): Promise<PhotosRestoreResult> {
    const token = httpClient.getToken();
    const formData = new FormData();
    formData.append('photosZip', file);

    const response = await fetch('/api/backup/photos/restore', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشلت عملية استيراد صور الأعضاء');
    }
    return data;
  }

  public async batchImportMembers(file: File): Promise<BatchImportResult> {
    const token = httpClient.getToken();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/members/batch-import', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشلت عملية استيراد الأعضاء');
    }
    return data;
  }

  public async restoreFullSystemBackup(file: File): Promise<FullSystemRestoreResult> {
    const token = httpClient.getToken();
    const formData = new FormData();
    formData.append('fullBackupFile', file);

    const response = await fetch('/api/backup/full-system/restore', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشلت عملية استعادة النسخة الاحتياطية الشاملة للنظام');
    }
    return data;
  }

  public async restoreBackup(file: File): Promise<RestoreResult> {
    const token = httpClient.getToken();
    const formData = new FormData();
    formData.append('backupFile', file);

    const response = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشلت عملية استعادة النسخة الاحتياطية');
    }
    return data;
  }

  public async restoreExcelBackup(file: File): Promise<RestoreResult> {
    const token = httpClient.getToken();
    const formData = new FormData();
    formData.append('excelFile', file);

    const response = await fetch('/api/backup/excel/restore', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشلت عملية استعادة النسخة الاحتياطية من Excel');
    }
    return data;
  }

  public async getBackupStatus(): Promise<BackupStatusResponse> {
    const token = httpClient.getToken();
    const response = await fetch('/api/backup/status', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشل جلب حالة النسخ الاحتياطي');
    }
    return data;
  }

  public async reapplyLastBackup(): Promise<RestoreResult> {
    const token = httpClient.getToken();
    const response = await fetch('/api/backup/excel/reapply-last', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشلت إعادة تطبيق النسخة السابقة');
    }
    return data;
  }

  public async persistPermanent(): Promise<{ success: boolean; memberCount: number; tribeCount: number; message: string }> {
    const token = httpClient.getToken();
    const response = await fetch('/api/backup/persist-permanent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشل تأمين الحفظ الدائم على القرص الصلب');
    }
    return data;
  }

  public async normalizeAllGrades(): Promise<{ success: boolean; updatedCount: number; totalMembers: number; message: string }> {
    const token = httpClient.getToken();
    const response = await fetch('/api/members/normalize-all-grades', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشل توحيد وتصحيح الصفوف الدراسية');
    }
    return data;
  }

  public async repairMemberPhotos(): Promise<{ success: boolean; repairedCount: number; totalChecked: number; message: string }> {
    const token = httpClient.getToken();
    const response = await fetch('/api/members/repair-photos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'فشل فحص وإصلاح صور الأعضاء');
    }
    return data;
  }

  public async openPhotosFolder(): Promise<{ success: boolean; path: string; message?: string }> {
    const token = httpClient.getToken();
    const response = await fetch('/api/backup/photos/open-folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json().catch(() => ({ success: false, path: '' }));
  }
}

export const backupService = BackupService.getInstance();
