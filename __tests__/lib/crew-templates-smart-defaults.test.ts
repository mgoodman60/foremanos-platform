/**
 * Tests for crew templates and smart defaults (Phase 5)
 * Tests getSmartDefaults() and getRecurringDelays()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CrewTemplate, DailyReport, LaborEntry } from '@prisma/client';

const mockPrisma = vi.hoisted(() => ({
  crewTemplate: { findMany: vi.fn() },
  dailyReport: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

import { getSmartDefaults, getRecurringDelays } from '@/lib/daily-report-enhancements';

describe('getSmartDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return crew templates sorted by lastUsedAt', async () => {
    const mockTemplates = [
      { id: '1', name: 'Framing Crew', entries: [], lastUsedAt: new Date('2026-02-07') },
      { id: '2', name: 'Concrete Crew', entries: [], lastUsedAt: new Date('2026-02-05') },
      { id: '3', name: 'Electrical Crew', entries: [], lastUsedAt: new Date('2026-02-06') },
    ];

    mockPrisma.crewTemplate.findMany.mockResolvedValue(mockTemplates);
    mockPrisma.dailyReport.findFirst.mockResolvedValue(null);
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await getSmartDefaults('project-1');

    expect(result.crewTemplates).toHaveLength(3);
    expect(result.crewTemplates[0].id).toBe('1'); // Most recent
    expect(result.crewTemplates[0].name).toBe('Framing Crew');
    expect(mockPrisma.crewTemplate.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      orderBy: { lastUsedAt: 'desc' },
      take: 10,
      select: { id: true, name: true, entries: true, lastUsedAt: true },
    });
  });

  it('should return yesterday\'s report with labor and equipment entries', async () => {
    const mockYesterdayReport = {
      id: 'report-1',
      reportDate: new Date('2026-02-07'),
      laborEntries: [
        { id: 'labor-1', tradeName: 'Carpenter', workerCount: 4, regularHours: 8, hourlyRate: 55 },
        { id: 'labor-2', tradeName: 'Electrician', workerCount: 2, regularHours: 8, hourlyRate: 65 },
      ],
      equipmentEntries: [
        { id: 'equip-1', name: 'Crane', hours: 6 },
      ],
      workPlanned: 'Continue framing on second floor',
    };

    mockPrisma.crewTemplate.findMany.mockResolvedValue([]);
    mockPrisma.dailyReport.findFirst.mockResolvedValue(mockYesterdayReport);
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await getSmartDefaults('project-1');

    expect(result.yesterdayReport).not.toBeNull();
    expect(result.yesterdayReport?.laborEntries).toHaveLength(2);
    expect(result.yesterdayReport?.equipmentEntries).toHaveLength(1);
    expect(result.yesterdayReport?.workPlanned).toBe('Continue framing on second floor');
  });

  it('should return null for yesterdayReport when no report exists', async () => {
    mockPrisma.crewTemplate.findMany.mockResolvedValue([]);
    mockPrisma.dailyReport.findFirst.mockResolvedValue(null);
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await getSmartDefaults('project-1');

    expect(result.yesterdayReport).toBeNull();
  });

  it('should return recurring delays (3+ consecutive days)', async () => {
    const mockDelays = [
      { reason: 'weather', consecutiveDays: 3 },
      { reason: 'material delivery', consecutiveDays: 4 },
    ];

    mockPrisma.crewTemplate.findMany.mockResolvedValue([]);
    mockPrisma.dailyReport.findFirst.mockResolvedValueOnce(null); // yesterdayReport
    mockPrisma.dailyReport.findFirst.mockResolvedValueOnce(null); // recentReport
    mockPrisma.dailyReport.findMany.mockResolvedValue([
      { reportDate: new Date(), delaysEncountered: 'weather delay', delayReason: 'weather' },
      { reportDate: new Date(), delaysEncountered: 'weather delay', delayReason: 'weather' },
      { reportDate: new Date(), delaysEncountered: 'weather delay', delayReason: 'weather' },
      { reportDate: new Date(), delaysEncountered: 'late materials', delayReason: 'material delivery' },
      { reportDate: new Date(), delaysEncountered: 'late materials', delayReason: 'material delivery' },
    ]);

    const result = await getSmartDefaults('project-1');

    expect(result.recurringDelays.length).toBeGreaterThan(0);
  });

  it('should return lastUsedRates from most recent report\'s labor entries', async () => {
    const mockRecentReport = {
      id: 'report-1',
      laborEntries: [
        { id: 'labor-1', tradeName: 'Carpenter', workerCount: 4, regularHours: 8, hourlyRate: 55 },
        { id: 'labor-2', tradeName: 'Electrician', workerCount: 2, regularHours: 8, hourlyRate: 65 },
        { id: 'labor-3', tradeName: 'Plumber', workerCount: 1, regularHours: 8, hourlyRate: 60 },
      ],
    };

    mockPrisma.crewTemplate.findMany.mockResolvedValue([]);
    mockPrisma.dailyReport.findFirst.mockResolvedValueOnce(null); // yesterdayReport
    mockPrisma.dailyReport.findFirst.mockResolvedValueOnce(mockRecentReport); // recentReport for rates
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await getSmartDefaults('project-1');

    expect(result.lastUsedRates).toEqual({
      'Carpenter': 55,
      'Electrician': 65,
      'Plumber': 60,
    });
  });

  it('should handle empty project (no templates, no reports)', async () => {
    mockPrisma.crewTemplate.findMany.mockResolvedValue([]);
    mockPrisma.dailyReport.findFirst.mockResolvedValue(null);
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await getSmartDefaults('project-1');

    expect(result.crewTemplates).toEqual([]);
    expect(result.yesterdayReport).toBeNull();
    expect(result.recurringDelays).toEqual([]);
    expect(result.lastUsedRates).toEqual({});
  });

  it('should handle crew templates with complex entries', async () => {
    const mockTemplates = [
      {
        id: '1',
        name: 'Full Crew',
        entries: [
          { tradeName: 'Carpenter', workerCount: 5, hourlyRate: 55 },
          { tradeName: 'Laborer', workerCount: 3, hourlyRate: 35 },
        ],
        lastUsedAt: new Date('2026-02-07'),
      },
    ];

    mockPrisma.crewTemplate.findMany.mockResolvedValue(mockTemplates);
    mockPrisma.dailyReport.findFirst.mockResolvedValue(null);
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await getSmartDefaults('project-1');

    expect(result.crewTemplates[0].entries).toEqual(mockTemplates[0].entries);
  });

  it('should handle error gracefully and return empty defaults', async () => {
    mockPrisma.crewTemplate.findMany.mockRejectedValue(new Error('Database error'));

    const result = await getSmartDefaults('project-1');

    expect(result).toEqual({
      crewTemplates: [],
      yesterdayReport: null,
      recurringDelays: [],
      lastUsedRates: {},
    });
  });

  it('should filter crew templates to max 10', async () => {
    const mockTemplates = Array.from({ length: 15 }, (_, i) => ({
      id: `template-${i}`,
      name: `Crew ${i}`,
      entries: [],
      lastUsedAt: new Date(`2026-02-${i + 1 < 10 ? '0' + (i + 1) : i + 1}`),
    }));

    mockPrisma.crewTemplate.findMany.mockResolvedValue(mockTemplates.slice(0, 10));
    mockPrisma.dailyReport.findFirst.mockResolvedValue(null);
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await getSmartDefaults('project-1');

    expect(result.crewTemplates).toHaveLength(10);
    expect(mockPrisma.crewTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it('should handle labor entries without hourly rates', async () => {
    const mockRecentReport = {
      id: 'report-1',
      laborEntries: [
        { id: 'labor-1', tradeName: 'Carpenter', workerCount: 4, regularHours: 8, hourlyRate: null },
        { id: 'labor-2', tradeName: 'Electrician', workerCount: 2, regularHours: 8, hourlyRate: 65 },
      ],
    };

    mockPrisma.crewTemplate.findMany.mockResolvedValue([]);
    mockPrisma.dailyReport.findFirst.mockResolvedValueOnce(null); // yesterdayReport
    mockPrisma.dailyReport.findFirst.mockResolvedValueOnce(mockRecentReport); // recentReport
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    const result = await getSmartDefaults('project-1');

    // Should only include entries with hourly rates
    expect(result.lastUsedRates).toEqual({ 'Electrician': 65 });
  });
});

describe('getRecurringDelays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find delays appearing 3+ times in lookback window', async () => {
    const mockReports = [
      { reportDate: new Date('2026-02-08'), delaysEncountered: 'Weather delay', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-07'), delaysEncountered: 'Weather delay', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-06'), delaysEncountered: 'Weather delay', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-05'), delaysEncountered: 'Material delay', delayReason: 'Material' },
    ];

    mockPrisma.dailyReport.findMany.mockResolvedValue(mockReports);

    const result = await getRecurringDelays('project-1', 5);

    expect(result.length).toBeGreaterThan(0);
    const weatherDelay = result.find(d => d.reason.toLowerCase().includes('weather'));
    expect(weatherDelay).toBeDefined();
    expect(weatherDelay?.consecutiveDays).toBeGreaterThanOrEqual(3);
  });

  it('should return empty array when fewer than 3 reports', async () => {
    const mockReports = [
      { reportDate: new Date('2026-02-08'), delaysEncountered: 'Weather delay', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-07'), delaysEncountered: 'Weather delay', delayReason: 'Weather' },
    ];

    mockPrisma.dailyReport.findMany.mockResolvedValue(mockReports);

    const result = await getRecurringDelays('project-1', 5);

    expect(result).toEqual([]);
  });

  it('should return empty array when no delays match threshold', async () => {
    const mockReports = [
      { reportDate: new Date('2026-02-08'), delaysEncountered: 'Weather delay', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-07'), delaysEncountered: 'Material delay', delayReason: 'Material' },
      { reportDate: new Date('2026-02-06'), delaysEncountered: 'Equipment failure', delayReason: 'Equipment' },
      { reportDate: new Date('2026-02-05'), delaysEncountered: 'Labor shortage', delayReason: 'Labor' },
    ];

    mockPrisma.dailyReport.findMany.mockResolvedValue(mockReports);

    const result = await getRecurringDelays('project-1', 5);

    // No delay appears 3+ times
    expect(result).toEqual([]);
  });

  it('should handle different delay reasons correctly', async () => {
    const mockReports = [
      { reportDate: new Date('2026-02-08'), delaysEncountered: 'Rain all day', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-07'), delaysEncountered: 'Storm', delayReason: 'weather' }, // lowercase
      { reportDate: new Date('2026-02-06'), delaysEncountered: 'Heavy rain', delayReason: 'WEATHER' }, // uppercase
      { reportDate: new Date('2026-02-05'), delaysEncountered: 'Late delivery', delayReason: 'Material' },
      { reportDate: new Date('2026-02-04'), delaysEncountered: 'Supplier issue', delayReason: 'Material' },
      { reportDate: new Date('2026-02-03'), delaysEncountered: 'No materials', delayReason: 'material' },
    ];

    mockPrisma.dailyReport.findMany.mockResolvedValue(mockReports);

    const result = await getRecurringDelays('project-1', 7);

    expect(result.length).toBeGreaterThanOrEqual(2); // Both weather and material should appear
    const reasons = result.map(d => d.reason.toLowerCase());
    expect(reasons).toContain('weather');
    expect(reasons).toContain('material');
  });

  it('should handle null delayReason and use delaysEncountered', async () => {
    const mockReports = [
      { reportDate: new Date('2026-02-08'), delaysEncountered: 'Weather delay', delayReason: null },
      { reportDate: new Date('2026-02-07'), delaysEncountered: 'Weather delay', delayReason: null },
      { reportDate: new Date('2026-02-06'), delaysEncountered: 'Weather delay', delayReason: null },
    ];

    mockPrisma.dailyReport.findMany.mockResolvedValue(mockReports);

    const result = await getRecurringDelays('project-1', 5);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].consecutiveDays).toBe(3);
  });

  it('should handle database errors gracefully', async () => {
    mockPrisma.dailyReport.findMany.mockRejectedValue(new Error('Database connection failed'));

    const result = await getRecurringDelays('project-1', 5);

    expect(result).toEqual([]);
  });

  it('should handle empty delaysEncountered and delayReason', async () => {
    const mockReports = [
      { reportDate: new Date('2026-02-08'), delaysEncountered: null, delayReason: null },
      { reportDate: new Date('2026-02-07'), delaysEncountered: '', delayReason: '' },
      { reportDate: new Date('2026-02-06'), delaysEncountered: '   ', delayReason: '   ' },
    ];

    mockPrisma.dailyReport.findMany.mockResolvedValue(mockReports);

    const result = await getRecurringDelays('project-1', 5);

    expect(result).toEqual([]);
  });

  it('should respect lookbackDays parameter', async () => {
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    await getRecurringDelays('project-1', 10);

    expect(mockPrisma.dailyReport.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        deletedAt: null,
        delaysEncountered: { not: null },
      },
      orderBy: { reportDate: 'desc' },
      take: 10,
      select: { reportDate: true, delaysEncountered: true, delayReason: true },
    });
  });

  it('should count consecutive appearances correctly for multiple reasons', async () => {
    const mockReports = [
      { reportDate: new Date('2026-02-08'), delaysEncountered: 'Rain', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-07'), delaysEncountered: 'Rain', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-06'), delaysEncountered: 'Rain', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-05'), delaysEncountered: 'Rain', delayReason: 'Weather' },
      { reportDate: new Date('2026-02-04'), delaysEncountered: 'Late materials', delayReason: 'Supplier' },
      { reportDate: new Date('2026-02-03'), delaysEncountered: 'Late materials', delayReason: 'Supplier' },
      { reportDate: new Date('2026-02-02'), delaysEncountered: 'Late materials', delayReason: 'Supplier' },
    ];

    mockPrisma.dailyReport.findMany.mockResolvedValue(mockReports);

    const result = await getRecurringDelays('project-1', 7);

    expect(result.length).toBe(2);
    expect(result.every(d => d.consecutiveDays >= 3)).toBe(true);
  });

  it('should use default lookbackDays of 5 when not specified', async () => {
    mockPrisma.dailyReport.findMany.mockResolvedValue([]);

    await getRecurringDelays('project-1');

    expect(mockPrisma.dailyReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});
