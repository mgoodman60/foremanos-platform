import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  dailyReport: { findUnique: vi.fn(), update: vi.fn() },
}));
const mockOneDriveUploadFile = vi.hoisted(() => vi.fn());
const mockOneDriveCreateFolder = vi.hoisted(() => vi.fn().mockResolvedValue('folder-id'));
const mockGenerateDOCX = vi.hoisted(() => vi.fn());
const mockFormatExport = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/lib/onedrive-service', () => ({
  OneDriveService: vi.fn().mockImplementation(() => ({
    uploadFile: mockOneDriveUploadFile,
    createFolder: mockOneDriveCreateFolder,
  })),
}));
vi.mock('@/lib/daily-report-docx-generator', () => ({
  generateDailyReportDOCX: mockGenerateDOCX,
  formatDailyReportForExport: mockFormatExport,
}));
vi.mock('@/lib/s3', () => ({ downloadFile: mockDownloadFile }));

import { syncDailyReportToOneDrive, retryOneDriveSync } from '@/lib/daily-report-onedrive-sync';

const makeMockReport = (overrides: Record<string, any> = {}) => ({
  id: 'report-1',
  reportNumber: 42,
  reportDate: new Date('2026-02-08'),
  photos: null,
  project: {
    id: 'project-1',
    name: 'Test Project',
    oneDriveAccessToken: 'token',
    oneDriveRefreshToken: 'refresh',
    oneDriveTokenExpiry: new Date(Date.now() + 3600000),
    oneDriveFolderId: null,
    dailyReportsFolderId: null,
  },
  createdByUser: { username: 'testuser' },
  laborEntries: [],
  equipmentEntries: [],
  progressEntries: [],
  ...overrides,
});

describe('daily-report-onedrive-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateDOCX.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });
    mockFormatExport.mockReturnValue({});
    mockOneDriveUploadFile.mockResolvedValue({ id: 'file-id' });
    mockPrisma.dailyReport.update.mockResolvedValue({});
  });

  describe('syncDailyReportToOneDrive', () => {
    it('should return report not found when report does not exist', async () => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue(null);

      const result = await syncDailyReportToOneDrive('nonexistent');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Report not found');
    });

    it('should return early with OneDrive not configured when project lacks tokens', async () => {
      const report = makeMockReport({
        project: {
          id: 'project-1',
          name: 'Test Project',
          oneDriveAccessToken: null,
          oneDriveRefreshToken: null,
          oneDriveTokenExpiry: null,
          oneDriveFolderId: null,
          dailyReportsFolderId: null,
        },
      });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);

      const result = await syncDailyReportToOneDrive('report-1');

      expect(result.success).toBe(true);
      expect(result.errors).toContain('OneDrive not configured');
      expect(mockOneDriveUploadFile).not.toHaveBeenCalled();
    });

    it('should generate and upload DOCX with correct filename', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);

      const result = await syncDailyReportToOneDrive('report-1');

      expect(result.docxUploaded).toBe(true);
      expect(mockOneDriveUploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'daily-report-42-2026-02-08.docx',
        expect.any(String)
      );
    });

    it('should set correct folder path', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);

      const result = await syncDailyReportToOneDrive('report-1');

      expect(result.exportPath).toBe('Test Project/Daily Reports/2026-02');
    });

    it('should upload photos when report has photo entries', async () => {
      const report = makeMockReport({
        photos: [
          { s3Key: 'photos/photo1.jpg', fileName: 'photo1.jpg' },
          { s3Key: 'photos/photo2.jpg', fileName: 'photo2.jpg' },
        ],
      });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockDownloadFile.mockResolvedValue(new ArrayBuffer(100));

      const result = await syncDailyReportToOneDrive('report-1');

      expect(result.photosUploaded).toBe(2);
      expect(mockDownloadFile).toHaveBeenCalledTimes(2);
    });

    it('should skip photos without s3Key', async () => {
      const report = makeMockReport({
        photos: [
          { fileName: 'no-key.jpg' },
          { s3Key: 'photos/valid.jpg', fileName: 'valid.jpg' },
        ],
      });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockDownloadFile.mockResolvedValue(new ArrayBuffer(50));

      const result = await syncDailyReportToOneDrive('report-1');

      expect(result.photosUploaded).toBe(1);
      expect(mockDownloadFile).toHaveBeenCalledTimes(1);
    });

    it('should handle downloadFile returning null', async () => {
      const report = makeMockReport({
        photos: [{ s3Key: 'photos/missing.jpg', fileName: 'missing.jpg' }],
      });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockDownloadFile.mockResolvedValue(null);

      const result = await syncDailyReportToOneDrive('report-1');

      expect(result.photosUploaded).toBe(0);
      expect(mockOneDriveUploadFile).toHaveBeenCalledTimes(1); // only DOCX
    });

    it('should update onedriveExported fields on success', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);

      await syncDailyReportToOneDrive('report-1');

      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: {
          onedriveExported: true,
          onedriveExportedAt: expect.any(Date),
          onedriveExportPath: 'Test Project/Daily Reports/2026-02',
        },
      });
    });

    it('should handle DOCX generation failure gracefully', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockGenerateDOCX.mockRejectedValue(new Error('DOCX generation failed'));

      const result = await syncDailyReportToOneDrive('report-1');

      expect(result.docxUploaded).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('DOCX upload failed')])
      );
      // Should still update the report
      expect(mockPrisma.dailyReport.update).toHaveBeenCalled();
    });

    it('should use photo.key as fallback when s3Key is absent', async () => {
      const report = makeMockReport({
        photos: [{ key: 'photos/fallback.jpg', fileName: 'fallback.jpg' }],
      });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockDownloadFile.mockResolvedValue(new ArrayBuffer(20));

      const result = await syncDailyReportToOneDrive('report-1');

      expect(result.photosUploaded).toBe(1);
      expect(mockDownloadFile).toHaveBeenCalledWith('photos/fallback.jpg');
    });
  });

  describe('retryOneDriveSync', () => {
    it('should reset export fields before retrying', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReport.update.mockResolvedValue({});

      await retryOneDriveSync('report-1');

      // First call resets fields
      expect(mockPrisma.dailyReport.update).toHaveBeenCalledWith({
        where: { id: 'report-1' },
        data: {
          onedriveExported: false,
          onedriveExportedAt: null,
          onedriveExportPath: null,
        },
      });

      // Second call updates with new export data (from syncDailyReportToOneDrive)
      expect(mockPrisma.dailyReport.update).toHaveBeenCalledTimes(2);
    });

    it('should call syncDailyReportToOneDrive after resetting', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);

      const result = await retryOneDriveSync('report-1');

      expect(result.success).toBe(true);
      expect(result.docxUploaded).toBe(true);
    });
  });
});
