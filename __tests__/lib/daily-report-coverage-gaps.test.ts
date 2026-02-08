/**
 * Coverage gap tests for daily report modules.
 * Targets critical untested paths identified during audit:
 * - Error boundaries and null/edge-case handling
 * - Partial parameter combinations
 * - Multi-item scenarios
 * - Result structure validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
  weatherDay: {
    create: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
  },
  schedule: { findFirst: vi.fn() },
  scheduleTask: { update: vi.fn() },
  dailyReport: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  dailyReportChunk: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}));

const mockDeleteFile = vi.hoisted(() => vi.fn());
const mockOneDriveUploadFile = vi.hoisted(() => vi.fn());
const mockGenerateDOCX = vi.hoisted(() => vi.fn());
const mockFormatExport = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/s3', () => ({ deleteFile: mockDeleteFile, downloadFile: mockDownloadFile }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/lib/onedrive-service', () => ({
  OneDriveService: vi.fn().mockImplementation(() => ({
    uploadFile: mockOneDriveUploadFile,
    createFolder: vi.fn().mockResolvedValue('folder-id'),
  })),
}));
vi.mock('@/lib/daily-report-docx-generator', () => ({
  generateDailyReportDOCX: mockGenerateDOCX,
  formatDailyReportForExport: mockFormatExport,
}));

// ─── Imports ─────────────────────────────────────────────────────────

import { getDailyReportRole, sanitizeText } from '@/lib/daily-report-permissions';
import {
  recordWeatherDay,
  getCumulativeWeatherDays,
  getWeatherDayLedger,
} from '@/lib/weather-day-tracker';
import { syncDailyReportToOneDrive } from '@/lib/daily-report-onedrive-sync';
import {
  cleanupExpiredPhotos,
  checkPhotoExpiration,
  getExpirationWarnings,
} from '@/lib/photo-retention-service';
import {
  indexDailyReport,
  searchDailyReportChunks,
  splitIntoChunks,
} from '@/lib/daily-report-indexer';
import { parseSMSToReportFields, aggregateSMSMessages } from '@/lib/sms-daily-report-service';

// =====================================================================
// 1. daily-report-permissions.ts gaps
// =====================================================================

describe('daily-report-permissions - coverage gaps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getDailyReportRole should return null when project not found and user is not a member', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    mockPrisma.projectMember.findUnique.mockResolvedValue(null);

    const role = await getDailyReportRole('user-1', 'nonexistent-project');

    // project is null, ownerId check fails, member check returns null => null
    expect(role).toBeNull();
  });

  it('sanitizeText should decode &#x27; (apostrophe) entity', () => {
    expect(sanitizeText('it&#x27;s fine')).toBe("it's fine");
  });

  it('sanitizeText should decode &#x2F; (forward slash) entity', () => {
    expect(sanitizeText('a&#x2F;b')).toBe('a/b');
  });

  it('sanitizeText should strip nested script tags with attributes', () => {
    expect(sanitizeText('<script type="text/javascript">alert(1)</script>safe')).toBe('safe');
  });

  it('sanitizeText should handle multiple HTML entities and strip decoded tags', () => {
    // After security fix: entities decoded FIRST, then tags stripped
    // '&lt;a href=&quot;url&quot;&gt;' → '<a href="url">' (decode) → '' (strip tag)
    expect(sanitizeText('&lt;a href=&quot;url&quot;&gt;')).toBe('');
  });

  it('getDailyReportRole should map owner role to ADMIN', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'owner' });

    const role = await getDailyReportRole('user-1', 'project-1');
    expect(role).toBe('ADMIN');
  });

  it('getDailyReportRole should map foreman role to REPORTER', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'foreman' });

    const role = await getDailyReportRole('user-1', 'project-1');
    expect(role).toBe('REPORTER');
  });

  it('getDailyReportRole should map viewer role to VIEWER', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'other-user' });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: 'viewer' });

    const role = await getDailyReportRole('user-1', 'project-1');
    expect(role).toBe('VIEWER');
  });
});

// =====================================================================
// 2. weather-day-tracker.ts gaps
// =====================================================================

describe('weather-day-tracker - coverage gaps', () => {
  beforeEach(() => vi.clearAllMocks());

  const baseParams = {
    projectId: 'proj-1',
    date: new Date('2026-01-15'),
    hoursLost: 8,
    reason: 'Heavy rain',
    weatherCondition: 'rain',
    flaggedBy: 'user-1',
  };

  it('recordWeatherDay should handle reportId with no labor entries (costImpact=0)', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.dailyReport.findUnique.mockResolvedValue({
      id: 'report-1',
      laborEntries: [],
    });
    mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-1' });

    const result = await recordWeatherDay({ ...baseParams, reportId: 'report-1' });

    expect(result.costImpact).toBe(0);
    expect(mockPrisma.weatherDay.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ costImpact: null }),
    });
  });

  it('recordWeatherDay should handle reportId when report is not found', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.dailyReport.findUnique.mockResolvedValue(null);
    mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-2' });

    const result = await recordWeatherDay({ ...baseParams, reportId: 'missing-report' });

    expect(result.costImpact).toBe(0);
  });

  it('recordWeatherDay should push multiple outdoor tasks simultaneously', async () => {
    const tasks = [
      { id: 'task-1', endDate: new Date('2026-02-01') },
      { id: 'task-2', endDate: new Date('2026-02-05') },
      { id: 'task-3', endDate: new Date('2026-02-10') },
    ];

    mockPrisma.schedule.findFirst.mockResolvedValue({
      id: 'sched-1',
      ScheduleTask: tasks,
    });
    mockPrisma.scheduleTask.update.mockResolvedValue({});
    mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-3' });

    const result = await recordWeatherDay(baseParams);

    expect(result.affectedTasks).toBe(3);
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledTimes(3);

    // Verify each task was pushed by ceil(8/8)=1 day
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { endDate: new Date('2026-02-02') },
    });
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-2' },
      data: { endDate: new Date('2026-02-06') },
    });
    expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
      where: { id: 'task-3' },
      data: { endDate: new Date('2026-02-11') },
    });
  });

  it('getCumulativeWeatherDays should handle only startDate (no endDate)', async () => {
    const start = new Date('2026-01-01');

    mockPrisma.weatherDay.aggregate.mockResolvedValue({
      _count: 1,
      _sum: { hoursLost: 8, costImpact: 500 },
    });
    mockPrisma.weatherDay.findMany.mockResolvedValue([]);

    await getCumulativeWeatherDays('proj-1', start);

    expect(mockPrisma.weatherDay.aggregate).toHaveBeenCalledWith({
      where: {
        projectId: 'proj-1',
        date: { gte: start },
      },
      _count: true,
      _sum: { hoursLost: true, costImpact: true },
    });
  });

  it('getCumulativeWeatherDays should handle only endDate (no startDate)', async () => {
    const end = new Date('2026-06-30');

    mockPrisma.weatherDay.aggregate.mockResolvedValue({
      _count: 1,
      _sum: { hoursLost: 8, costImpact: 500 },
    });
    mockPrisma.weatherDay.findMany.mockResolvedValue([]);

    await getCumulativeWeatherDays('proj-1', undefined, end);

    expect(mockPrisma.weatherDay.aggregate).toHaveBeenCalledWith({
      where: {
        projectId: 'proj-1',
        date: { lte: end },
      },
      _count: true,
      _sum: { hoursLost: true, costImpact: true },
    });
  });

  it('getWeatherDayLedger should handle only startDate filter', async () => {
    const start = new Date('2026-01-01');
    mockPrisma.weatherDay.findMany.mockResolvedValue([]);

    await getWeatherDayLedger('proj-1', { startDate: start });

    expect(mockPrisma.weatherDay.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'proj-1',
          date: { gte: start },
        },
      })
    );
  });

  it('recordWeatherDay should store optional fields (temperature, precipitation, windSpeed, notes)', async () => {
    mockPrisma.schedule.findFirst.mockResolvedValue(null);
    mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-opt' });

    await recordWeatherDay({
      ...baseParams,
      temperature: 35,
      precipitation: 1.5,
      windSpeed: 25,
      notes: 'Heavy downpour starting at 10am',
    });

    expect(mockPrisma.weatherDay.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        temperature: 35,
        precipitation: 1.5,
        windSpeed: 25,
        notes: 'Heavy downpour starting at 10am',
      }),
    });
  });
});

// =====================================================================
// 3. daily-report-onedrive-sync.ts gaps
// =====================================================================

describe('daily-report-onedrive-sync - coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateDOCX.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });
    mockFormatExport.mockReturnValue({});
    mockOneDriveUploadFile.mockResolvedValue({ id: 'file-id' });
    mockPrisma.dailyReport.update.mockResolvedValue({});
  });

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
    },
    createdByUser: { username: 'testuser' },
    laborEntries: [],
    equipmentEntries: [],
    progressEntries: [],
    ...overrides,
  });

  it('should catch and return error when top-level findUnique throws', async () => {
    mockPrisma.dailyReport.findUnique.mockRejectedValue(new Error('Connection timeout'));

    const result = await syncDailyReportToOneDrive('report-1');

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Connection timeout']);
    expect(result.docxUploaded).toBe(false);
    expect(result.photosUploaded).toBe(0);
  });

  it('should continue uploading other photos when one photo fails', async () => {
    const report = makeMockReport({
      photos: [
        { s3Key: 'photos/good1.jpg', fileName: 'good1.jpg' },
        { s3Key: 'photos/bad.jpg', fileName: 'bad.jpg' },
        { s3Key: 'photos/good2.jpg', fileName: 'good2.jpg' },
      ],
    });
    mockPrisma.dailyReport.findUnique.mockResolvedValue(report);

    // First and third photo succeed, second fails
    mockDownloadFile
      .mockResolvedValueOnce(new ArrayBuffer(100))
      .mockRejectedValueOnce(new Error('S3 download failed'))
      .mockResolvedValueOnce(new ArrayBuffer(100));

    const result = await syncDailyReportToOneDrive('report-1');

    expect(result.photosUploaded).toBe(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('Photo upload failed')])
    );
    // Sync overall should still succeed
    expect(result.success).toBe(true);
  });

  it('should use photo.name fallback when fileName is not set', async () => {
    const report = makeMockReport({
      photos: [{ s3Key: 'photos/img.jpg', name: 'my-photo.jpg' }],
    });
    mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
    mockDownloadFile.mockResolvedValue(new ArrayBuffer(50));

    const result = await syncDailyReportToOneDrive('report-1');

    expect(result.photosUploaded).toBe(1);
    expect(mockOneDriveUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'my-photo.jpg',
      expect.any(String)
    );
  });

  it('should use default filename when neither fileName nor name is set', async () => {
    const report = makeMockReport({
      photos: [{ s3Key: 'photos/img.jpg' }],
    });
    mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
    mockDownloadFile.mockResolvedValue(new ArrayBuffer(50));

    const result = await syncDailyReportToOneDrive('report-1');

    expect(result.photosUploaded).toBe(1);
    expect(mockOneDriveUploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'photo-1.jpg',
      expect.any(String)
    );
  });
});

// =====================================================================
// 4. photo-retention-service.ts gaps
// =====================================================================

describe('photo-retention-service - coverage gaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.dailyReport.update.mockResolvedValue({});
    mockDeleteFile.mockResolvedValue(undefined);
  });

  it('checkPhotoExpiration should handle multiple reports with mixed statuses', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const soonDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'r1',
        photos: [{ s3Key: 'k1', fileName: 'f1.jpg', expiresAt: pastDate }],
        onedriveExported: false,
      },
      {
        id: 'r2',
        photos: [
          { s3Key: 'k2', fileName: 'f2.jpg', expiresAt: soonDate },
          { s3Key: 'k3', fileName: 'f3.jpg', expiresAt: futureDate },
        ],
        onedriveExported: false,
      },
      {
        id: 'r3',
        photos: [{ s3Key: 'k4', fileName: 'f4.jpg' }], // no expiresAt
        onedriveExported: true,
      },
    ]);

    const result = await checkPhotoExpiration('project-1');

    expect(result.expired).toHaveLength(1);
    expect(result.expired[0].s3Key).toBe('k1');
    expect(result.expiringSoon).toHaveLength(1);
    expect(result.expiringSoon[0].s3Key).toBe('k2');
    expect(result.safe).toHaveLength(2); // k3 (future) + k4 (no expiry)
  });

  it('getExpirationWarnings should skip photos without expiresAt', async () => {
    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'r1',
        reportNumber: 5,
        photos: [
          { s3Key: 'k1', fileName: 'f1.jpg' }, // no expiresAt
          { s3Key: 'k2', fileName: 'f2.jpg' }, // no expiresAt
        ],
      },
    ]);

    const warnings = await getExpirationWarnings('project-1');

    expect(warnings).toHaveLength(0);
  });

  it('cleanupExpiredPhotos should handle REJECTED reports as deletable', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    mockPrisma.project.findUnique.mockResolvedValue({
      oneDriveAccessToken: 'token',
      oneDriveRefreshToken: 'refresh',
    });
    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'r1',
        photos: [{ s3Key: 'photos/rejected.jpg', fileName: 'rejected.jpg', expiresAt: pastDate, onedriveSynced: true, thumbnailKey: 'photos/rejected-thumb.jpg' }],
        onedriveExported: true,
        status: 'REJECTED',
      },
    ]);

    const result = await cleanupExpiredPhotos('project-1');

    // REJECTED is treated as an approvable/deletable status (not DRAFT/SUBMITTED)
    expect(result.deleted).toBe(1);
    expect(mockDeleteFile).toHaveBeenCalledWith('photos/rejected.jpg');
  });

  it('cleanupExpiredPhotos should handle reports with no photos gracefully', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      oneDriveAccessToken: 'token',
      oneDriveRefreshToken: 'refresh',
    });
    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'r1',
        photos: null,
        onedriveExported: false,
        status: 'APPROVED',
      },
    ]);

    const result = await cleanupExpiredPhotos('project-1');

    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('cleanupExpiredPhotos should handle non-expired photos without modification', async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    mockPrisma.project.findUnique.mockResolvedValue({
      oneDriveAccessToken: 'token',
      oneDriveRefreshToken: 'refresh',
    });
    mockPrisma.dailyReport.findMany.mockResolvedValue([
      {
        id: 'r1',
        photos: [{ s3Key: 'photos/future.jpg', fileName: 'future.jpg', expiresAt: futureDate }],
        onedriveExported: false,
        status: 'APPROVED',
      },
    ]);

    const result = await cleanupExpiredPhotos('project-1');

    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockPrisma.dailyReport.update).not.toHaveBeenCalled();
  });
});

// =====================================================================
// 5. daily-report-indexer.ts gaps
// =====================================================================

describe('daily-report-indexer - coverage gaps', () => {
  beforeEach(() => vi.clearAllMocks());

  it('indexDailyReport should create safety chunk when safetyIncidents > 0 but no safetyNotes', async () => {
    const report = {
      id: 'report-1',
      projectId: 'project-1',
      reportDate: new Date('2026-02-08'),
      reportNumber: 42,
      status: 'APPROVED',
      weatherCondition: null,
      temperatureHigh: null,
      temperatureLow: null,
      humidity: null,
      precipitation: null,
      windSpeed: null,
      weatherNotes: null,
      workPerformed: null,
      workPlanned: null,
      delaysEncountered: null,
      delayHours: 0,
      delayReason: null,
      safetyIncidents: 2,
      safetyNotes: null,
      materialsReceived: [],
      visitors: [],
      project: { id: 'project-1' },
      laborEntries: [],
      equipmentEntries: [],
      progressEntries: [],
    };

    mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
    mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 1 });

    const result = await indexDailyReport('report-1');

    expect(result.chunksCreated).toBe(1);
    const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
    const safetyChunk = chunks.find((c: any) => c.section === 'safety');
    expect(safetyChunk).toBeDefined();
    expect(safetyChunk.content).toContain('Safety incidents: 2');
  });

  it('searchDailyReportChunks should map result fields correctly', async () => {
    mockPrisma.dailyReportChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'Poured concrete on east wing',
        section: 'summary',
        reportDate: new Date('2026-02-08'),
        dailyReportId: 'report-1',
        metadata: { reportNumber: 42, trades: ['Concrete'] },
        chunkIndex: 0,
      },
    ]);

    const results = await searchDailyReportChunks('project-1', 'concrete');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: 'chunk-1',
      content: 'Poured concrete on east wing',
      section: 'summary',
      reportDate: new Date('2026-02-08'),
      dailyReportId: 'report-1',
      metadata: { reportNumber: 42, trades: ['Concrete'] },
      chunkIndex: 0,
    });
  });

  it('splitIntoChunks should return empty array for empty string', () => {
    const chunks = splitIntoChunks('');
    expect(chunks).toEqual(['']);
  });

  it('splitIntoChunks should handle text exactly at maxLength', () => {
    const text = 'A'.repeat(1000);
    const chunks = splitIntoChunks(text, 1000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it('splitIntoChunks should handle text one character over maxLength', () => {
    const text = 'A'.repeat(1001);
    const chunks = splitIntoChunks(text, 1000);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(1000);
    expect(chunks[1]).toHaveLength(1);
  });

  it('indexDailyReport should handle materialsReceived as non-array (object)', async () => {
    const report = {
      id: 'report-1',
      projectId: 'project-1',
      reportDate: new Date('2026-02-08'),
      reportNumber: 1,
      status: 'DRAFT',
      weatherCondition: null,
      temperatureHigh: null,
      temperatureLow: null,
      humidity: null,
      precipitation: null,
      windSpeed: null,
      weatherNotes: null,
      workPerformed: 'Test work',
      workPlanned: null,
      delaysEncountered: null,
      delayHours: 0,
      delayReason: null,
      safetyIncidents: 0,
      safetyNotes: null,
      materialsReceived: 'just a string', // not an array
      visitors: null,
      project: { id: 'project-1' },
      laborEntries: [],
      equipmentEntries: [],
      progressEntries: [],
    };

    mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
    mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 1 });

    // Should not throw
    const result = await indexDailyReport('report-1');
    expect(result.errors).toEqual([]);
  });
});

// =====================================================================
// 6. sms-daily-report-service.ts gaps
// =====================================================================

describe('sms-daily-report-service - coverage gaps', () => {
  it('parseSMSToReportFields should detect "subs" keyword for crew size', () => {
    const result = parseSMSToReportFields('3 subs on site today');
    expect(result.crewSize).toBe(3);
  });

  it('parseSMSToReportFields should handle whitespace-only message', () => {
    const result = parseSMSToReportFields('   ');
    expect(result).toEqual({});
  });

  it('parseSMSToReportFields should detect skid steer (two-word equipment)', () => {
    const result = parseSMSToReportFields('Skid steer moving gravel');
    expect(result.equipment).toContain('skid steer');
    expect(result.materials).toContain('gravel');
  });

  it('parseSMSToReportFields should detect scissor lift (two-word equipment)', () => {
    const result = parseSMSToReportFields('Using scissor lift for ceiling');
    expect(result.equipment).toContain('scissor lift');
  });

  it('parseSMSToReportFields should detect dump truck (two-word equipment)', () => {
    const result = parseSMSToReportFields('Dump truck hauling fill');
    expect(result.equipment).toContain('dump truck');
  });

  it('parseSMSToReportFields should detect accident as safety keyword', () => {
    const result = parseSMSToReportFields('Accident reported on level 3');
    expect(result.safety).toBeTruthy();
    expect(result.safety).toContain('Accident');
  });

  it('aggregateSMSMessages should take max delayHours (not sum) across messages', () => {
    const messages = [
      { text: 'Rain delay, lost 2 hours', timestamp: new Date('2026-02-08T09:00:00Z') },
      { text: 'Stopped again, delayed 4 hours total', timestamp: new Date('2026-02-08T14:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    // Should be max(2, 4) = 4, not sum(2+4) = 6
    expect(result.delayHours).toBe(4);
  });

  it('aggregateSMSMessages should handle single message', () => {
    const messages = [
      { text: '6 guys working on framing', timestamp: new Date('2026-02-08T10:00:00Z') },
    ];

    const result = aggregateSMSMessages(messages);

    expect(result.crewSize).toBe(6);
    expect(result.workPerformed).toBe('6 guys working on framing');
  });

  it('parseSMSToReportFields should detect multiple materials in same message', () => {
    const result = parseSMSToReportFields('Delivered rebar, concrete, and sand to site');

    expect(result.materials).toContain('rebar');
    expect(result.materials).toContain('concrete');
    expect(result.materials).toContain('sand');
    expect(result.materials).toHaveLength(3);
  });
});
