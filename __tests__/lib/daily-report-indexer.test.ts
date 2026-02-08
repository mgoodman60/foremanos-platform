import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  dailyReport: { findUnique: vi.fn() },
  dailyReportChunk: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  indexDailyReport,
  deleteDailyReportChunks,
  searchDailyReportChunks,
  splitIntoChunks,
} from '@/lib/daily-report-indexer';

const makeMockReport = (overrides: Record<string, any> = {}) => ({
  id: 'report-1',
  projectId: 'project-1',
  reportDate: new Date('2026-02-08'),
  reportNumber: 42,
  status: 'APPROVED',
  weatherCondition: 'Clear',
  temperatureHigh: 75,
  temperatureLow: 55,
  humidity: 45,
  precipitation: 0,
  windSpeed: 10,
  weatherNotes: 'Clear skies all day',
  workPerformed: 'Poured concrete for foundation on east wing.',
  workPlanned: 'Continue framing second floor.',
  delaysEncountered: 'Material delivery delayed by 2 hours',
  delayHours: 2,
  delayReason: 'Supplier truck breakdown',
  safetyIncidents: 0,
  safetyNotes: 'Toolbox talk completed. No incidents.',
  materialsReceived: ['Lumber delivery - 500 BF', 'Concrete - 10 yards'],
  visitors: ['Owner rep - John Smith', 'Inspector - Jane Doe'],
  equipmentOnSite: null,
  photoIds: [],
  project: { id: 'project-1' },
  laborEntries: [
    {
      tradeName: 'Concrete',
      workerCount: 4,
      regularHours: 8,
      overtimeHours: 2,
      hourlyRate: 55,
      totalCost: 1980,
    },
    {
      tradeName: 'Carpentry',
      workerCount: 6,
      regularHours: 8,
      overtimeHours: 0,
      hourlyRate: 50,
      totalCost: 2400,
    },
  ],
  equipmentEntries: [
    {
      equipmentName: 'Crane',
      hours: 8,
      hourlyRate: 150,
      dailyRate: null,
      fuelCost: 75,
      operatorCost: null,
      totalCost: 1275,
    },
  ],
  progressEntries: [
    {
      activityName: 'Foundation Pour',
      unitsCompleted: 10,
      percentComplete: 45,
      valueEarned: 15000,
    },
  ],
  ...overrides,
});

describe('daily-report-indexer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('indexDailyReport', () => {
    it('should return error when report not found', async () => {
      mockPrisma.dailyReport.findUnique.mockResolvedValue(null);

      const result = await indexDailyReport('missing-id');

      expect(result).toEqual({ chunksCreated: 0, errors: ['Report not found'] });
      expect(mockPrisma.dailyReport.findUnique).toHaveBeenCalledWith({
        where: { id: 'missing-id' },
        include: {
          laborEntries: true,
          equipmentEntries: true,
          progressEntries: true,
          project: { select: { id: true } },
        },
      });
    });

    it('should create chunks for a full report with all sections populated', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 8 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(8);
      expect(result.errors).toEqual([]);
      expect(mockPrisma.dailyReportChunk.deleteMany).toHaveBeenCalledWith({
        where: { dailyReportId: 'report-1' },
      });
      expect(mockPrisma.dailyReportChunk.createMany).toHaveBeenCalled();

      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      expect(chunks).toHaveLength(8);

      // Verify section types
      const sections = chunks.map((c: any) => c.section);
      expect(sections).toContain('summary');
      expect(sections).toContain('weather');
      expect(sections).toContain('labor');
      expect(sections).toContain('equipment');
      expect(sections).toContain('progress');
      expect(sections).toContain('delays');
      expect(sections).toContain('safety');
      expect(sections).toContain('notes');
    });

    it('should handle empty laborEntries array', async () => {
      const report = makeMockReport({ laborEntries: [] });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(7);
      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      const sections = chunks.map((c: any) => c.section);
      expect(sections).not.toContain('labor');
    });

    it('should handle null workPerformed', async () => {
      const report = makeMockReport({ workPerformed: null, workPlanned: null });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(7);
      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      const sections = chunks.map((c: any) => c.section);
      expect(sections).not.toContain('summary');
    });

    it('should handle empty equipmentEntries array', async () => {
      const report = makeMockReport({ equipmentEntries: [] });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(7);
      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      const sections = chunks.map((c: any) => c.section);
      expect(sections).not.toContain('equipment');
    });

    it('should handle empty progressEntries array', async () => {
      const report = makeMockReport({ progressEntries: [] });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(7);
      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      const sections = chunks.map((c: any) => c.section);
      expect(sections).not.toContain('progress');
    });

    it('should delete old chunks before creating new ones', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 8 });

      await indexDailyReport('report-1');

      // Verify both were called
      expect(mockPrisma.dailyReportChunk.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.dailyReportChunk.createMany).toHaveBeenCalled();
    });

    it('should include metadata with reportNumber, reportDate, trades, crewCount, weatherCondition', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      await indexDailyReport('report-1');

      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      const metadata = chunks[0].metadata;

      expect(metadata.reportNumber).toBe(42);
      expect(metadata.reportDate).toBe('2026-02-08T00:00:00.000Z');
      expect(metadata.trades).toEqual(['Concrete', 'Carpentry']);
      expect(metadata.crewCount).toBe(10); // 4 + 6
      expect(metadata.weatherCondition).toBe('Clear');
      expect(metadata.safetyIncidents).toBe(0);
      expect(metadata.status).toBe('APPROVED');
    });

    it('should correctly assign section types', async () => {
      const report = makeMockReport();
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      await indexDailyReport('report-1');

      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;

      // Summary section
      const summaryChunk = chunks.find((c: any) => c.section === 'summary');
      expect(summaryChunk.content).toContain('Poured concrete');

      // Weather section
      const weatherChunk = chunks.find((c: any) => c.section === 'weather');
      expect(weatherChunk.content).toContain('Weather: Clear');
      expect(weatherChunk.content).toContain('High: 75°F');

      // Labor section
      const laborChunk = chunks.find((c: any) => c.section === 'labor');
      expect(laborChunk.content).toContain('Concrete: 4 workers');
      expect(laborChunk.content).toContain('Carpentry: 6 workers');

      // Equipment section
      const equipmentChunk = chunks.find((c: any) => c.section === 'equipment');
      expect(equipmentChunk.content).toContain('Crane: 8h');

      // Progress section
      const progressChunk = chunks.find((c: any) => c.section === 'progress');
      expect(progressChunk.content).toContain('Foundation Pour');

      // Delays section
      const delaysChunk = chunks.find((c: any) => c.section === 'delays');
      expect(delaysChunk.content).toContain('Material delivery delayed');

      // Notes section
      const notesChunk = chunks.find((c: any) => c.section === 'notes');
      expect(notesChunk.content).toContain('Materials received');
      expect(notesChunk.content).toContain('Visitors');
    });

    it('should skip delays section when delaysEncountered is null', async () => {
      const report = makeMockReport({ delaysEncountered: null });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(7);
      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      const sections = chunks.map((c: any) => c.section);
      expect(sections).not.toContain('delays');
    });

    it('should skip safety section when safetyIncidents is 0 and no notes', async () => {
      const report = makeMockReport({ safetyIncidents: 0, safetyNotes: null });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(7);
      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      const sections = chunks.map((c: any) => c.section);
      expect(sections).not.toContain('safety');
    });

    it('should skip notes section when materialsReceived and visitors are empty', async () => {
      const report = makeMockReport({ materialsReceived: [], visitors: [] });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.dailyReportChunk.createMany.mockResolvedValue({ count: 7 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(7);
      const chunks = mockPrisma.dailyReportChunk.createMany.mock.calls[0][0].data;
      const sections = chunks.map((c: any) => c.section);
      expect(sections).not.toContain('notes');
    });

    it('should return no chunks when report has no content', async () => {
      const report = makeMockReport({
        workPerformed: null,
        workPlanned: null,
        weatherCondition: null,
        laborEntries: [],
        equipmentEntries: [],
        progressEntries: [],
        delaysEncountered: null,
        safetyIncidents: 0,
        safetyNotes: null,
        materialsReceived: [],
        visitors: [],
      });
      mockPrisma.dailyReport.findUnique.mockResolvedValue(report);
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });

      const result = await indexDailyReport('report-1');

      expect(result.chunksCreated).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockPrisma.dailyReportChunk.createMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteDailyReportChunks', () => {
    it('should call deleteMany with correct where clause', async () => {
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 5 });

      await deleteDailyReportChunks('report-1');

      expect(mockPrisma.dailyReportChunk.deleteMany).toHaveBeenCalledWith({
        where: { dailyReportId: 'report-1' },
      });
    });

    it('should return count from deleteMany result', async () => {
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 12 });

      const count = await deleteDailyReportChunks('report-1');

      expect(count).toBe(12);
    });

    it('should return 0 when no chunks exist', async () => {
      mockPrisma.dailyReportChunk.deleteMany.mockResolvedValue({ count: 0 });

      const count = await deleteDailyReportChunks('report-1');

      expect(count).toBe(0);
    });
  });

  describe('searchDailyReportChunks', () => {
    it('should call findMany with correct where clause including content contains', async () => {
      mockPrisma.dailyReportChunk.findMany.mockResolvedValue([]);

      await searchDailyReportChunks('project-1', 'concrete');

      expect(mockPrisma.dailyReportChunk.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          content: { contains: 'concrete', mode: 'insensitive' },
        },
        orderBy: { reportDate: 'desc' },
        take: 10,
      });
    });

    it('should filter by date range', async () => {
      mockPrisma.dailyReportChunk.findMany.mockResolvedValue([]);
      const dateFrom = new Date('2026-02-01');
      const dateTo = new Date('2026-02-08');

      await searchDailyReportChunks('project-1', 'concrete', { dateFrom, dateTo });

      expect(mockPrisma.dailyReportChunk.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          content: { contains: 'concrete', mode: 'insensitive' },
          reportDate: { gte: dateFrom, lte: dateTo },
        },
        orderBy: { reportDate: 'desc' },
        take: 10,
      });
    });

    it('should filter by sections', async () => {
      mockPrisma.dailyReportChunk.findMany.mockResolvedValue([]);

      await searchDailyReportChunks('project-1', 'concrete', {
        sections: ['labor', 'equipment'],
      });

      expect(mockPrisma.dailyReportChunk.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          content: { contains: 'concrete', mode: 'insensitive' },
          section: { in: ['labor', 'equipment'] },
        },
        orderBy: { reportDate: 'desc' },
        take: 10,
      });
    });

    it('should respect limit parameter', async () => {
      mockPrisma.dailyReportChunk.findMany.mockResolvedValue([]);

      await searchDailyReportChunks('project-1', 'concrete', { limit: 50 });

      expect(mockPrisma.dailyReportChunk.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          content: { contains: 'concrete', mode: 'insensitive' },
        },
        orderBy: { reportDate: 'desc' },
        take: 50,
      });
    });

    it('should return empty array when no matches', async () => {
      mockPrisma.dailyReportChunk.findMany.mockResolvedValue([]);

      const results = await searchDailyReportChunks('project-1', 'nonexistent');

      expect(results).toEqual([]);
    });
  });

  describe('splitIntoChunks', () => {
    it('should return single chunk for short text', () => {
      const text = 'This is a short text.';
      const chunks = splitIntoChunks(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('should split long text at sentence boundaries', () => {
      const text = 'A'.repeat(800) + '. ' + 'B'.repeat(800);
      const chunks = splitIntoChunks(text, 1000);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(1000);
    });

    it('should split text without sentence breaks at maxLength', () => {
      const text = 'A'.repeat(2500);
      const chunks = splitIntoChunks(text, 1000);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(1000);
      expect(chunks[1].length).toBeLessThanOrEqual(1000);
    });

    it('should respect maxLength parameter', () => {
      const text = 'A'.repeat(500) + '. ' + 'B'.repeat(500);
      const chunks = splitIntoChunks(text, 300);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(300);
      });
    });

    it('should split at newline boundaries when present', () => {
      const text = 'A'.repeat(500) + '\n' + 'B'.repeat(500);
      const chunks = splitIntoChunks(text, 600);

      expect(chunks.length).toBe(2);
      expect(chunks[0]).toContain('A');
      expect(chunks[1]).toContain('B');
    });
  });
});
