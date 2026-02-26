import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { deleteFile } from '@/lib/s3';

const log = createScopedLogger('PHOTO_RETENTION');

export interface PhotoMeta {
  s3Key: string;
  fileName: string;
  uploadedAt: string;
  expiresAt: string;
  onedriveSynced?: boolean;
  thumbnailKey?: string;  // S3 key for the thumbnail copy
  fullResDeleted?: boolean; // true when full-res has been cleaned up
  size?: number;
}

export interface RetentionCheckResult {
  expiringSoon: PhotoMeta[];
  expired: PhotoMeta[];
  safe: PhotoMeta[];
}

export interface CleanupResult {
  deleted: number;
  skipped: number;
  errors: string[];
}

/**
 * Generate the S3 key for a photo's thumbnail.
 * Thumbnails are stored at the same path with a `-thumb` suffix before the extension.
 */
export function generateThumbnailKey(s3Key: string): string {
  const lastDot = s3Key.lastIndexOf('.');
  if (lastDot === -1) return `${s3Key}-thumb`;
  return `${s3Key.substring(0, lastDot)}-thumb${s3Key.substring(lastDot)}`;
}

/**
 * Add expiration metadata to photo objects.
 */
export function addExpirationToPhotos(
  photos: Array<{ s3Key: string; fileName: string; [key: string]: any }>,
  retentionDays: number = 7
): PhotoMeta[] {
  const now = new Date();
  return photos.map(photo => ({
    ...photo,
    s3Key: photo.s3Key,
    fileName: photo.fileName,
    uploadedAt: photo.uploadedAt || now.toISOString(),
    expiresAt: photo.expiresAt || new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
    onedriveSynced: photo.onedriveSynced || false,
  }));
}

/**
 * Check photo expiration status for a project's reports.
 */
export async function checkPhotoExpiration(
  projectId: string
): Promise<RetentionCheckResult> {
  const now = new Date();
  const warningDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const reports = await prisma.dailyReport.findMany({
    where: {
      projectId,
      deletedAt: null,
      // @ts-expect-error strictNullChecks migration
      photos: { not: null },
    },
    select: { id: true, photos: true, onedriveExported: true },
  });

  const expiringSoon: PhotoMeta[] = [];
  const expired: PhotoMeta[] = [];
  const safe: PhotoMeta[] = [];

  for (const report of reports) {
    const photos = (report.photos as unknown as PhotoMeta[]) || [];
    for (const photo of photos) {
      if (!photo.expiresAt) {
        safe.push(photo);
        continue;
      }

      const expiresAt = new Date(photo.expiresAt);
      if (expiresAt <= now) {
        expired.push(photo);
      } else if (expiresAt <= warningDate) {
        expiringSoon.push(photo);
      } else {
        safe.push(photo);
      }
    }
  }

  return { expiringSoon, expired, safe };
}

/**
 * Clean up expired photos from R2 storage.
 */
export async function cleanupExpiredPhotos(
  projectId: string
): Promise<CleanupResult> {
  const now = new Date();
  let deleted = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Check if OneDrive is configured for this project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      oneDriveAccessToken: true,
      oneDriveRefreshToken: true,
    },
  });
  const onedriveConfigured = !!(project?.oneDriveAccessToken && project?.oneDriveRefreshToken);

  const reports = await prisma.dailyReport.findMany({
    where: {
      projectId,
      deletedAt: null,
      // @ts-expect-error strictNullChecks migration
      photos: { not: null },
    },
    select: { id: true, photos: true, onedriveExported: true, status: true },
  });

  for (const report of reports) {
    const photos = (report.photos as unknown as PhotoMeta[]) || [];
    const remainingPhotos: PhotoMeta[] = [];
    let modified = false;

    for (const photo of photos) {
      if (!photo.expiresAt) {
        remainingPhotos.push(photo);
        continue;
      }

      const expiresAt = new Date(photo.expiresAt);

      if (expiresAt > now) {
        remainingPhotos.push(photo);
        continue;
      }

      // Extend retention for unapproved reports
      if (report.status !== 'APPROVED' && report.status !== 'REJECTED') {
        remainingPhotos.push({
          ...photo,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        skipped++;
        modified = true;
        continue;
      }

      // Don't delete photos that haven't been synced to OneDrive
      if (!photo.onedriveSynced && onedriveConfigured) {
        // OneDrive is configured but this photo hasn't been synced — extend retention
        remainingPhotos.push({
          ...photo,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        skipped++;
        modified = true;
        log.warn('Extended retention for unsynced photo', { reportId: report.id, s3Key: photo.s3Key });
        continue;
      }

      // If OneDrive isn't configured, never auto-delete — keep photos indefinitely
      if (!onedriveConfigured) {
        remainingPhotos.push(photo);
        skipped++;
        continue;
      }

      // Tiered retention: keep thumbnail, delete full-res only
      if (photo.fullResDeleted) {
        // Already processed — keep the thumbnail reference
        remainingPhotos.push(photo);
        continue;
      }

      // Delete full-res from R2
      try {
        await deleteFile(photo.s3Key);
        deleted++;
        modified = true;
        // Keep the photo entry with fullResDeleted flag for timeline
        remainingPhotos.push({
          ...photo,
          fullResDeleted: true,
        });
        log.info('Deleted full-res photo, thumbnail retained', {
          reportId: report.id, s3Key: photo.s3Key, thumbnailKey: photo.thumbnailKey
        });
      } catch (err) {
        errors.push(`Failed to delete ${photo.s3Key}: ${(err as Error).message}`);
        remainingPhotos.push(photo);
      }
    }

    if (modified) {
      await prisma.dailyReport.update({
        where: { id: report.id },
        data: { photos: remainingPhotos as unknown as any },
      });
    }
  }

  log.info('Photo cleanup completed', { projectId, deleted, skipped, errors: errors.length });
  return { deleted, skipped, errors };
}

/**
 * Get photos that need expiration warnings.
 */
export async function getExpirationWarnings(
  projectId: string
): Promise<Array<{ reportId: string; reportNumber: number; expiringCount: number; expiresAt: string }>> {
  const now = new Date();
  const warningDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const reports = await prisma.dailyReport.findMany({
    where: {
      projectId,
      deletedAt: null,
      onedriveExported: false,
      // @ts-expect-error strictNullChecks migration
      photos: { not: null },
    },
    select: { id: true, reportNumber: true, photos: true },
  });

  const warnings: Array<{ reportId: string; reportNumber: number; expiringCount: number; expiresAt: string }> = [];

  for (const report of reports) {
    const photos = (report.photos as unknown as PhotoMeta[]) || [];
    const expiringPhotos = photos.filter(p => {
      if (!p.expiresAt) return false;
      const exp = new Date(p.expiresAt);
      return exp > now && exp <= warningDate;
    });

    if (expiringPhotos.length > 0) {
      const earliest = expiringPhotos.reduce((min, p) =>
        new Date(p.expiresAt) < new Date(min.expiresAt) ? p : min
      );

      warnings.push({
        reportId: report.id,
        reportNumber: report.reportNumber,
        expiringCount: expiringPhotos.length,
        expiresAt: earliest.expiresAt,
      });
    }
  }

  return warnings;
}
