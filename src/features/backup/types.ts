/**
 * Feature: Backup & Restore - Domain Models & Contracts
 */

export interface BatchImportResult {
  success: boolean;
  message: string;
  count: number;
  skippedCount: number;
  skippedDetails?: string[];
  downloadedPhotosCount?: number;
}

export interface RestoreResult {
  success: boolean;
  message: string;
}

export interface FullSystemRestoreResult {
  success: boolean;
  message: string;
  stats?: {
    members: number;
    tribes: number;
    photos: number;
  };
}
