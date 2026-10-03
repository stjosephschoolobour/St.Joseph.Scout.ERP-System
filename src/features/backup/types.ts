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

export interface PhotosRestoreResult {
  success: boolean;
  message: string;
  photosCount: number;
  matchedMembers: number;
}

export interface BackupStatusResponse {
  totalMembers: number;
  totalTribes: number;
  totalPhotos?: number;
  membersWithPhotos?: number;
  photosDir?: string;
  dbPath?: string;
  hasSnapshot: boolean;
  snapshotCount: number;
  snapshotDate: string | null;
  hasBackupExcel: boolean;
}
