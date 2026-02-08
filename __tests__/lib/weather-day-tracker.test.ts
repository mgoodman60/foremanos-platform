import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mocks ---
const mockPrisma = vi.hoisted(() => ({
  weatherDay: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
  schedule: { findFirst: vi.fn() },
  scheduleTask: { update: vi.fn() },
  dailyReport: { findUnique: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  recordWeatherDay,
  getCumulativeWeatherDays,
  getWeatherDayLedger,
  checkWeatherDayThreshold,
  getSmartWeatherPrompts,
} from '@/lib/weather-day-tracker';

describe('weather-day-tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── recordWeatherDay ────────────────────────────────────────────

  describe('recordWeatherDay', () => {
    const baseParams = {
      projectId: 'proj-1',
      date: new Date('2026-01-15'),
      hoursLost: 8,
      reason: 'Heavy rain',
      weatherCondition: 'rain',
      flaggedBy: 'user-1',
    };

    it('should create a WeatherDay record with correct data', async () => {
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-1', ...baseParams });

      const result = await recordWeatherDay(baseParams);

      expect(mockPrisma.weatherDay.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          date: baseParams.date,
          hoursLost: 8,
          reason: 'Heavy rain',
          weatherCondition: 'rain',
          flaggedBy: 'user-1',
          affectedTaskIds: [],
          costImpact: null,
        }),
      });
      expect(result.weatherDay.id).toBe('wd-1');
    });

    it('should find outdoor tasks from an active schedule', async () => {
      const outdoorTask = {
        id: 'task-1',
        isOutdoorTask: true,
        status: 'in_progress',
        endDate: new Date('2026-02-01'),
      };

      mockPrisma.schedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        ScheduleTask: [outdoorTask],
      });
      mockPrisma.scheduleTask.update.mockResolvedValue({});
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-2' });

      const result = await recordWeatherDay(baseParams);

      expect(mockPrisma.schedule.findFirst).toHaveBeenCalledWith({
        where: { projectId: 'proj-1', isActive: true },
        include: {
          ScheduleTask: {
            where: {
              isOutdoorTask: true,
              status: 'in_progress',
              percentComplete: { lt: 100 },
            },
          },
        },
      });
      expect(result.affectedTasks).toBe(1);
    });

    it('should push outdoor task endDate by 1 day for 8 hours lost', async () => {
      const originalEnd = new Date('2026-02-01');
      const outdoorTask = { id: 'task-1', endDate: new Date(originalEnd) };

      mockPrisma.schedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        ScheduleTask: [outdoorTask],
      });
      mockPrisma.scheduleTask.update.mockResolvedValue({});
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-3' });

      await recordWeatherDay({ ...baseParams, hoursLost: 8 });

      const expectedEnd = new Date('2026-02-02');
      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { endDate: expectedEnd },
      });
    });

    it('should push outdoor task endDate by 1 day for 4 hours lost (rounds up)', async () => {
      const outdoorTask = { id: 'task-2', endDate: new Date('2026-03-10') };

      mockPrisma.schedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        ScheduleTask: [outdoorTask],
      });
      mockPrisma.scheduleTask.update.mockResolvedValue({});
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-4' });

      await recordWeatherDay({ ...baseParams, hoursLost: 4 });

      const expectedEnd = new Date('2026-03-11'); // ceil(4/8) = 1
      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-2' },
        data: { endDate: expectedEnd },
      });
    });

    it('should push outdoor task endDate by 2 days for 16 hours lost', async () => {
      const outdoorTask = { id: 'task-3', endDate: new Date('2026-04-20') };

      mockPrisma.schedule.findFirst.mockResolvedValue({
        id: 'sched-1',
        ScheduleTask: [outdoorTask],
      });
      mockPrisma.scheduleTask.update.mockResolvedValue({});
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-5' });

      await recordWeatherDay({ ...baseParams, hoursLost: 16 });

      const expectedEnd = new Date('2026-04-22'); // ceil(16/8) = 2
      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-3' },
        data: { endDate: expectedEnd },
      });
    });

    it('should return affectedTasks=0 when no active schedule exists', async () => {
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-6' });

      const result = await recordWeatherDay(baseParams);

      expect(result.affectedTasks).toBe(0);
      expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
    });

    it('should NOT push indoor tasks', async () => {
      // Schedule exists but has no outdoor tasks matching the query
      mockPrisma.schedule.findFirst.mockResolvedValue({
        id: 'sched-2',
        ScheduleTask: [], // filter returned nothing (all indoor)
      });
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-7' });

      const result = await recordWeatherDay(baseParams);

      expect(result.affectedTasks).toBe(0);
      expect(mockPrisma.scheduleTask.update).not.toHaveBeenCalled();
    });

    it('should calculate costImpact from labor entries when reportId provided', async () => {
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        id: 'report-1',
        laborEntries: [
          { workerCount: 5, hourlyRate: 60 },
          { workerCount: 3, hourlyRate: 50 },
        ],
      });
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-8' });

      const result = await recordWeatherDay({
        ...baseParams,
        reportId: 'report-1',
        hoursLost: 8,
      });

      // 5 * 8 * 60 = 2400, 3 * 8 * 50 = 1200 => total 3600
      expect(result.costImpact).toBe(3600);
      expect(mockPrisma.weatherDay.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ costImpact: 3600 }),
      });
    });

    it('should use default hourly rate of 45 when entry has no hourlyRate', async () => {
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.dailyReport.findUnique.mockResolvedValue({
        id: 'report-2',
        laborEntries: [{ workerCount: 2, hourlyRate: null }],
      });
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-9' });

      const result = await recordWeatherDay({
        ...baseParams,
        reportId: 'report-2',
        hoursLost: 4,
      });

      // 2 * 4 * 45 = 360
      expect(result.costImpact).toBe(360);
    });

    it('should return costImpact=0 when no reportId is provided', async () => {
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockPrisma.weatherDay.create.mockResolvedValue({ id: 'wd-10' });

      const result = await recordWeatherDay(baseParams);

      expect(result.costImpact).toBe(0);
      expect(mockPrisma.dailyReport.findUnique).not.toHaveBeenCalled();
    });

    it('should throw when prisma fails', async () => {
      mockPrisma.schedule.findFirst.mockRejectedValue(new Error('DB connection lost'));

      await expect(recordWeatherDay(baseParams)).rejects.toThrow('DB connection lost');
    });
  });

  // ─── getCumulativeWeatherDays ────────────────────────────────────

  describe('getCumulativeWeatherDays', () => {
    it('should return correct totals from aggregate results', async () => {
      mockPrisma.weatherDay.aggregate.mockResolvedValue({
        _count: 5,
        _sum: { hoursLost: 40, costImpact: 5000 },
      });
      mockPrisma.weatherDay.findMany.mockResolvedValue([]);

      const result = await getCumulativeWeatherDays('proj-1');

      expect(result.totalDays).toBe(5);
      expect(result.totalHoursLost).toBe(40);
      expect(result.totalCostImpact).toBe(5000);
    });

    it('should filter by date range when provided', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-06-30');

      mockPrisma.weatherDay.aggregate.mockResolvedValue({
        _count: 2,
        _sum: { hoursLost: 16, costImpact: 1000 },
      });
      mockPrisma.weatherDay.findMany.mockResolvedValue([]);

      await getCumulativeWeatherDays('proj-1', start, end);

      expect(mockPrisma.weatherDay.aggregate).toHaveBeenCalledWith({
        where: {
          projectId: 'proj-1',
          date: { gte: start, lte: end },
        },
        _count: true,
        _sum: { hoursLost: true, costImpact: true },
      });
    });

    it('should return byMonth breakdown correctly', async () => {
      mockPrisma.weatherDay.aggregate.mockResolvedValue({
        _count: 3,
        _sum: { hoursLost: 24, costImpact: 2500 },
      });
      mockPrisma.weatherDay.findMany.mockResolvedValue([
        { date: new Date('2026-01-10'), hoursLost: 8, costImpact: 1000 },
        { date: new Date('2026-01-20'), hoursLost: 8, costImpact: 500 },
        { date: new Date('2026-02-05'), hoursLost: 8, costImpact: 1000 },
      ]);

      const result = await getCumulativeWeatherDays('proj-1');

      expect(result.byMonth).toHaveLength(2);
      expect(result.byMonth[0]).toEqual({
        month: '2026-01',
        count: 2,
        hoursLost: 16,
        costImpact: 1500,
      });
      expect(result.byMonth[1]).toEqual({
        month: '2026-02',
        count: 1,
        hoursLost: 8,
        costImpact: 1000,
      });
    });

    it('should return zeros when no weather days exist', async () => {
      mockPrisma.weatherDay.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { hoursLost: null, costImpact: null },
      });
      mockPrisma.weatherDay.findMany.mockResolvedValue([]);

      const result = await getCumulativeWeatherDays('proj-1');

      expect(result.totalDays).toBe(0);
      expect(result.totalHoursLost).toBe(0);
      expect(result.totalCostImpact).toBe(0);
      expect(result.byMonth).toEqual([]);
    });

    it('should handle costImpact=null in monthly breakdown', async () => {
      mockPrisma.weatherDay.aggregate.mockResolvedValue({
        _count: 1,
        _sum: { hoursLost: 8, costImpact: null },
      });
      mockPrisma.weatherDay.findMany.mockResolvedValue([
        { date: new Date('2026-03-15'), hoursLost: 8, costImpact: null },
      ]);

      const result = await getCumulativeWeatherDays('proj-1');

      expect(result.byMonth[0].costImpact).toBe(0);
    });
  });

  // ─── getWeatherDayLedger ─────────────────────────────────────────

  describe('getWeatherDayLedger', () => {
    it('should return paginated results with hasMore flag', async () => {
      // Return limit+1 items to indicate hasMore
      const items = Array.from({ length: 21 }, (_, i) => ({
        id: `wd-${i}`,
        date: new Date(),
      }));
      mockPrisma.weatherDay.findMany.mockResolvedValue(items);

      const result = await getWeatherDayLedger('proj-1');

      expect(result.hasMore).toBe(true);
      expect(result.weatherDays).toHaveLength(20);
      expect(result.nextCursor).toBe('wd-19');
    });

    it('should return hasMore=false when fewer than limit results', async () => {
      const items = [{ id: 'wd-0' }, { id: 'wd-1' }];
      mockPrisma.weatherDay.findMany.mockResolvedValue(items);

      const result = await getWeatherDayLedger('proj-1', { limit: 10 });

      expect(result.hasMore).toBe(false);
      expect(result.weatherDays).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should use cursor-based pagination', async () => {
      mockPrisma.weatherDay.findMany.mockResolvedValue([]);

      await getWeatherDayLedger('proj-1', { cursor: 'wd-5', limit: 10 });

      expect(mockPrisma.weatherDay.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'wd-5' },
          skip: 1,
          take: 11,
        })
      );
    });

    it('should include flaggedByUser and dailyReport relations', async () => {
      mockPrisma.weatherDay.findMany.mockResolvedValue([]);

      await getWeatherDayLedger('proj-1');

      expect(mockPrisma.weatherDay.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            flaggedByUser: { select: { id: true, username: true } },
            dailyReport: { select: { id: true, reportNumber: true, reportDate: true } },
          },
        })
      );
    });

    it('should filter by date range', async () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-03-31');
      mockPrisma.weatherDay.findMany.mockResolvedValue([]);

      await getWeatherDayLedger('proj-1', { startDate: start, endDate: end });

      expect(mockPrisma.weatherDay.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId: 'proj-1',
            date: { gte: start, lte: end },
          },
        })
      );
    });
  });

  // ─── checkWeatherDayThreshold ────────────────────────────────────

  describe('checkWeatherDayThreshold', () => {
    it('should return exceeded=true when count >= default threshold (10)', async () => {
      mockPrisma.weatherDay.count.mockResolvedValue(10);

      const result = await checkWeatherDayThreshold('proj-1');

      expect(result).toEqual({ exceeded: true, currentCount: 10, threshold: 10 });
    });

    it('should return exceeded=false when count < threshold', async () => {
      mockPrisma.weatherDay.count.mockResolvedValue(3);

      const result = await checkWeatherDayThreshold('proj-1');

      expect(result).toEqual({ exceeded: false, currentCount: 3, threshold: 10 });
    });

    it('should accept and use a custom threshold value', async () => {
      mockPrisma.weatherDay.count.mockResolvedValue(5);

      const result = await checkWeatherDayThreshold('proj-1', 5);

      expect(result).toEqual({ exceeded: true, currentCount: 5, threshold: 5 });
    });

    it('should return exceeded=false when count is 0', async () => {
      mockPrisma.weatherDay.count.mockResolvedValue(0);

      const result = await checkWeatherDayThreshold('proj-1');

      expect(result).toEqual({ exceeded: false, currentCount: 0, threshold: 10 });
    });
  });

  // ─── getSmartWeatherPrompts ──────────────────────────────────────

  describe('getSmartWeatherPrompts', () => {
    it('should return crew prompt when crewSize is 0', () => {
      const result = getSmartWeatherPrompts({ crewSize: 0 });

      expect(result.shouldPrompt).toBe(true);
      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0]).toMatch(/No subs on site/);
    });

    it('should return crew prompt when laborEntries is empty array', () => {
      const result = getSmartWeatherPrompts({ laborEntries: [] });

      expect(result.shouldPrompt).toBe(true);
      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0]).toMatch(/No subs on site/);
    });

    it('should return weather prompt when condition includes rain', () => {
      const result = getSmartWeatherPrompts({
        crewSize: 10,
        weatherCondition: 'Heavy rain',
      });

      expect(result.shouldPrompt).toBe(true);
      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0]).toMatch(/Weather conditions show/);
      expect(result.prompts[0]).toContain('Heavy rain');
    });

    it('should return weather prompt when condition includes snow', () => {
      const result = getSmartWeatherPrompts({
        crewSize: 5,
        weatherCondition: 'Light snow',
      });

      expect(result.shouldPrompt).toBe(true);
      expect(result.prompts[0]).toContain('Light snow');
    });

    it('should return weather prompt when condition includes storm', () => {
      const result = getSmartWeatherPrompts({
        crewSize: 5,
        weatherCondition: 'Thunderstorm warning',
      });

      expect(result.shouldPrompt).toBe(true);
      expect(result.prompts[0]).toContain('Thunderstorm warning');
    });

    it('should return shouldPrompt=false with normal conditions and crew present', () => {
      const result = getSmartWeatherPrompts({
        crewSize: 12,
        weatherCondition: 'Sunny, clear skies',
      });

      expect(result.shouldPrompt).toBe(false);
      expect(result.prompts).toHaveLength(0);
    });

    it('should return multiple prompts when both crew=0 AND severe weather', () => {
      const result = getSmartWeatherPrompts({
        crewSize: 0,
        weatherCondition: 'Ice storm',
      });

      expect(result.shouldPrompt).toBe(true);
      expect(result.prompts).toHaveLength(2);
      expect(result.prompts[0]).toMatch(/No subs on site/);
      expect(result.prompts[1]).toMatch(/Weather conditions show/);
    });

    it('should return shouldPrompt=false when no data provided', () => {
      const result = getSmartWeatherPrompts({});

      expect(result.shouldPrompt).toBe(false);
      expect(result.prompts).toHaveLength(0);
    });

    it('should detect all severe weather keywords', () => {
      const keywords = ['rain', 'snow', 'storm', 'thunder', 'ice', 'sleet', 'hail', 'flood', 'tornado', 'hurricane', 'severe'];

      for (const kw of keywords) {
        const result = getSmartWeatherPrompts({
          crewSize: 10,
          weatherCondition: kw,
        });
        expect(result.shouldPrompt).toBe(true);
        expect(result.prompts.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
