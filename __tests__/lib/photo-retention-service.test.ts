import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  dailyReport: { findMany: vi.fn(), update: vi.fn() },
  project: { findUnique: vi.fn() },
}));
const mockDeleteFile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/s3', () => ({ deleteFile: mockDeleteFile }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  addExpirationToPhotos,
  checkPhotoExpiration,
  cleanupExpiredPhotos,
  getExpirationWarnings,
  generateThumbnailKey,
} from '@/lib/photo-retention-service';

describe('photo-retention-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.dailyReport.update.mockResolvedValue({});
    mockDeleteFile.mockResolvedValue(undefined);
  });

  describe('addExpirationToPhotos', () => {
    it('should add expiresAt 7 days from now by default', () => {
      const photos = [{ s3Key: 'key1', fileName: 'photo1.jpg' }];

      const result = addExpirationToPhotos(photos);

      expect(result).toHaveLength(1);
      const expiresAt = new Date(result[0].expiresAt);
      const expectedMin = new Date(Date.now() + 6.9 * 24 * 60 * 60 * 1000);
      const expectedMax = new Date(Date.now() + 7.1 * 24 * 60 * 60 * 1000);
      expect(expiresAt.getTime()).toBeGreaterThan(expectedMin.getTime());
      expect(expiresAt.getTime()).toBeLessThan(expectedMax.getTime());
    });

    it('should use custom retentionDays', () => {
      const photos = [{ s3Key: 'key1', fileName: 'photo1.jpg' }];

      const result = addExpirationToPhotos(photos, 30);

      const expiresAt = new Date(result[0].expiresAt);
      const expectedMin = new Date(Date.now() + 29.9 * 24 * 60 * 60 * 1000);
      const expectedMax = new Date(Date.now() + 30.1 * 24 * 60 * 60 * 1000);
      expect(expiresAt.getTime()).toBeGreaterThan(expectedMin.getTime());
      expect(expiresAt.getTime()).toBeLessThan(expectedMax.getTime());
    });

    it('should preserve existing expiresAt if already set', () => {
      const existingDate = '2026-03-01T00:00:00.000Z';
      const photos = [{ s3Key: 'key1', fileName: 'photo1.jpg', expiresAt: existingDate }];

      const result = addExpirationToPhotos(photos);

      expect(result[0].expiresAt).toBe(existingDate);
    });

    it('should set onedriveSynced to false by default', () => {
      const photos = [{ s3Key: 'key1', fileName: 'photo1.jpg' }];

      const result = addExpirationToPhotos(photos);

      expect(result[0].onedriveSynced).toBe(false);
    });
  });

  describe('checkPhotoExpiration', () => {
    it('should categorize expired photos correctly', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'k1', fileName: 'f1.jpg', expiresAt: pastDate }],
          onedriveExported: false,
        },
      ]);

      const result = await checkPhotoExpiration('project-1');

      expect(result.expired).toHaveLength(1);
      expect(result.expiringSoon).toHaveLength(0);
      expect(result.safe).toHaveLength(0);
    });

    it('should categorize expiring soon photos (within 2 days)', async () => {
      const soonDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'k1', fileName: 'f1.jpg', expiresAt: soonDate }],
          onedriveExported: false,
        },
      ]);

      const result = await checkPhotoExpiration('project-1');

      expect(result.expiringSoon).toHaveLength(1);
      expect(result.expired).toHaveLength(0);
      expect(result.safe).toHaveLength(0);
    });

    it('should put safe photos (>2 days) in safe category', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'k1', fileName: 'f1.jpg', expiresAt: futureDate }],
          onedriveExported: false,
        },
      ]);

      const result = await checkPhotoExpiration('project-1');

      expect(result.safe).toHaveLength(1);
      expect(result.expired).toHaveLength(0);
      expect(result.expiringSoon).toHaveLength(0);
    });

    it('should treat photos without expiresAt as safe', async () => {
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'k1', fileName: 'f1.jpg' }],
          onedriveExported: false,
        },
      ]);

      const result = await checkPhotoExpiration('project-1');

      expect(result.safe).toHaveLength(1);
    });
  });

  describe('generateThumbnailKey', () => {
    it('should insert -thumb before extension', () => {
      expect(generateThumbnailKey('photos/img.jpg')).toBe('photos/img-thumb.jpg');
      expect(generateThumbnailKey('reports/2026/photo.png')).toBe('reports/2026/photo-thumb.png');
    });

    it('should append -thumb when no extension', () => {
      expect(generateThumbnailKey('photos/img')).toBe('photos/img-thumb');
      expect(generateThumbnailKey('noext')).toBe('noext-thumb');
    });

    it('should handle multiple dots correctly', () => {
      expect(generateThumbnailKey('photo.backup.jpg')).toBe('photo.backup-thumb.jpg');
    });
  });

  describe('cleanupExpiredPhotos', () => {
    it('should mark photos as fullResDeleted instead of removing from array', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/expired.jpg', fileName: 'expired.jpg', expiresAt: pastDate, onedriveSynced: true, thumbnailKey: 'photos/expired-thumb.jpg' }],
          onedriveExported: true,
          status: 'APPROVED',
        },
      ]);

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(1);
      expect(mockDeleteFile).toHaveBeenCalledWith('photos/expired.jpg');
      // Photo should remain in array with fullResDeleted flag
      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          photos: [
            expect.objectContaining({
              s3Key: 'photos/expired.jpg',
              fullResDeleted: true,
            }),
          ],
        },
      });
    });

    it('should skip photos already marked fullResDeleted', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/processed.jpg', fileName: 'processed.jpg', expiresAt: pastDate, onedriveSynced: true, fullResDeleted: true, thumbnailKey: 'photos/processed-thumb.jpg' }],
          onedriveExported: true,
          status: 'APPROVED',
        },
      ]);

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(0);
      expect(mockDeleteFile).not.toHaveBeenCalled();
      // No update needed since nothing changed
      expect(mockPrisma.dailyReport.update).not.toHaveBeenCalled();
    });

    it('should extend retention for DRAFT reports', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/draft.jpg', fileName: 'draft.jpg', expiresAt: pastDate }],
          onedriveExported: false,
          status: 'DRAFT',
        },
      ]);

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockDeleteFile).not.toHaveBeenCalled();
      // Should have extended the expiration in the update
      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          photos: [
            expect.objectContaining({
              s3Key: 'photos/draft.jpg',
              expiresAt: expect.any(String),
            }),
          ],
        },
      });
    });

    it('should extend retention for SUBMITTED reports', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/sub.jpg', fileName: 'sub.jpg', expiresAt: pastDate }],
          onedriveExported: false,
          status: 'SUBMITTED',
        },
      ]);

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });

    it('should delete expired photos from APPROVED reports', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/approved.jpg', fileName: 'approved.jpg', expiresAt: pastDate, onedriveSynced: true, thumbnailKey: 'photos/approved-thumb.jpg' }],
          onedriveExported: true,
          status: 'APPROVED',
        },
      ]);

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(1);
      expect(mockDeleteFile).toHaveBeenCalledWith('photos/approved.jpg');
    });

    it('should handle deleteFile errors and keep photo in list', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/fail.jpg', fileName: 'fail.jpg', expiresAt: pastDate, onedriveSynced: true, thumbnailKey: 'photos/fail-thumb.jpg' }],
          onedriveExported: true,
          status: 'APPROVED',
        },
      ]);
      mockDeleteFile.mockRejectedValue(new Error('R2 error'));

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('R2 error');
      // Photo should remain since deletion failed — no update because modified=false
      expect(mockPrisma.dailyReport.update).not.toHaveBeenCalled();
    });

    it('should update report.photos JSON after cleanup', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [
            { s3Key: 'photos/expired.jpg', fileName: 'expired.jpg', expiresAt: pastDate, onedriveSynced: true, thumbnailKey: 'photos/expired-thumb.jpg' },
            { s3Key: 'photos/keep.jpg', fileName: 'keep.jpg', expiresAt: futureDate },
          ],
          onedriveExported: true,
          status: 'APPROVED',
        },
      ]);

      await cleanupExpiredPhotos('project-1');

      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          photos: [
            expect.objectContaining({ s3Key: 'photos/expired.jpg', fullResDeleted: true }),
            expect.objectContaining({ s3Key: 'photos/keep.jpg' }),
          ],
        },
      });
    });

    it('should keep photo entry even when full-res deleted (for timeline)', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/only.jpg', fileName: 'only.jpg', expiresAt: pastDate, onedriveSynced: true, thumbnailKey: 'photos/only-thumb.jpg' }],
          onedriveExported: true,
          status: 'APPROVED',
        },
      ]);

      await cleanupExpiredPhotos('project-1');

      // Should keep the entry with fullResDeleted flag, not set to null
      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          photos: [
            expect.objectContaining({
              s3Key: 'photos/only.jpg',
              fullResDeleted: true,
            }),
          ],
        },
      });
    });

    it('should not delete photos when OneDrive is not configured', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: null,
        oneDriveRefreshToken: null,
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/expired.jpg', fileName: 'expired.jpg', expiresAt: pastDate }],
          onedriveExported: false,
          status: 'APPROVED',
        },
      ]);

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockDeleteFile).not.toHaveBeenCalled();
      // Photo should remain in the list (not deleted, not updated)
      expect(mockPrisma.dailyReport.update).not.toHaveBeenCalled();
    });

    it('should not delete unsynced photos when OneDrive is configured', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/unsynced.jpg', fileName: 'unsynced.jpg', expiresAt: pastDate, onedriveSynced: false }],
          onedriveExported: false,
          status: 'APPROVED',
        },
      ]);

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(0);
      expect(result.skipped).toBe(1);
      expect(mockDeleteFile).not.toHaveBeenCalled();
      // Should extend retention by 7 days
      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          photos: [
            expect.objectContaining({
              s3Key: 'photos/unsynced.jpg',
              expiresAt: expect.any(String),
            }),
          ],
        },
      });
    });

    it('should delete synced photos when OneDrive is configured', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.project.findUnique.mockResolvedValue({
        oneDriveAccessToken: 'token',
        oneDriveRefreshToken: 'refresh',
      });
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          photos: [{ s3Key: 'photos/synced.jpg', fileName: 'synced.jpg', expiresAt: pastDate, onedriveSynced: true, thumbnailKey: 'photos/synced-thumb.jpg' }],
          onedriveExported: true,
          status: 'APPROVED',
        },
      ]);

      const result = await cleanupExpiredPhotos('project-1');

      expect(result.deleted).toBe(1);
      expect(mockDeleteFile).toHaveBeenCalledWith('photos/synced.jpg');
      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          photos: [
            expect.objectContaining({
              s3Key: 'photos/synced.jpg',
              fullResDeleted: true,
            }),
          ],
        },
      });
    });
  });

  describe('getExpirationWarnings', () => {
    it('should return warnings for expiring photos', async () => {
      const soonDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          reportNumber: 10,
          photos: [{ s3Key: 'k1', fileName: 'f1.jpg', expiresAt: soonDate }],
        },
      ]);

      const warnings = await getExpirationWarnings('project-1');

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toEqual({
        reportId: 'r1',
        reportNumber: 10,
        expiringCount: 1,
        expiresAt: soonDate,
      });
    });

    it('should exclude reports with onedriveExported=true via query', async () => {
      // The function queries with onedriveExported: false, so exported reports
      // should not appear in the results
      mockPrisma.dailyReport.findMany.mockResolvedValue([]);

      const warnings = await getExpirationWarnings('project-1');

      expect(warnings).toHaveLength(0);
      expect(mockPrisma.dailyReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            onedriveExported: false,
          }),
        })
      );
    });

    it('should return empty array when no expiring photos', async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          reportNumber: 10,
          photos: [{ s3Key: 'k1', fileName: 'f1.jpg', expiresAt: futureDate }],
        },
      ]);

      const warnings = await getExpirationWarnings('project-1');

      expect(warnings).toHaveLength(0);
    });

    it('should find earliest expiration date among expiring photos', async () => {
      const earliest = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(); // 12h
      const later = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(); // 36h
      mockPrisma.dailyReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          reportNumber: 5,
          photos: [
            { s3Key: 'k1', fileName: 'f1.jpg', expiresAt: later },
            { s3Key: 'k2', fileName: 'f2.jpg', expiresAt: earliest },
          ],
        },
      ]);

      const warnings = await getExpirationWarnings('project-1');

      expect(warnings).toHaveLength(1);
      expect(warnings[0].expiresAt).toBe(earliest);
      expect(warnings[0].expiringCount).toBe(2);
    });
  });
});
