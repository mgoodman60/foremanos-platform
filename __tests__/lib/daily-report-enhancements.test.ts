import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock data
const mockReports = [
  {
    id: 'report-1',
    projectId: 'project-1',
    reportDate: new Date('2024-01-15'),
    weatherCondition: 'Sunny',
    temperatureHigh: 75,
    workPerformed: 'Completed foundation forms and rebar placement',
    workPlanned: 'Pour foundation concrete tomorrow',
    safetyIncidents: 0,
    safetyNotes: 'Toolbox talk completed',
    photoIds: ['photo-1', 'photo-2', 'photo-3'],
    delayReason: null,
    delayHours: null,
    laborEntries: [
      { workerCount: 5, regularHours: 8, tradeName: 'Carpenter' },
      { workerCount: 3, regularHours: 8, tradeName: 'Electrician' },
    ],
    equipmentOnSite: [
      { name: 'Excavator', hours: 6, status: 'active' },
    ],
    materialsReceived: [
      { name: 'Concrete', quantity: 20, unit: 'CY' },
    ],
  },
  {
    id: 'report-2',
    projectId: 'project-1',
    reportDate: new Date('2024-01-16'),
    weatherCondition: 'Rain',
    temperatureHigh: 65,
    workPerformed: 'Limited work due to weather',
    workPlanned: 'Resume framing',
    safetyIncidents: 1,
    safetyNotes: 'Minor slip incident',
    photoIds: [],
    delayReason: 'Weather delay',
    delayHours: 4,
    laborEntries: [
      { workerCount: 8, regularHours: 4, tradeName: 'Carpenter' },
    ],
    equipmentOnSite: [],
    materialsReceived: null,
  },
];

const mockSchedule = {
  id: 'schedule-1',
  projectId: 'project-1',
  isActive: true,
  ScheduleTask: [
    {
      id: 'task-1',
      name: 'Foundation work',
      percentComplete: 75,
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-01-20'),
    },
    {
      id: 'task-2',
      name: 'Framing',
      percentComplete: 25,
      startDate: new Date('2024-01-16'),
      endDate: new Date('2024-01-25'),
    },
  ],
};

// Mock Prisma
const prismaMock = {
  dailyReport: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  schedule: {
    findFirst: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// Mock OpenAI
const mockOpenAI = {
  audio: {
    transcriptions: {
      create: vi.fn(),
    },
  },
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}));

describe('calculateCompletenessScore', () => {
  it('should calculate high score for complete report', async () => {
    const { calculateCompletenessScore } = await import('@/lib/daily-report-enhancements');

    const score = calculateCompletenessScore({
      weatherCondition: 'Sunny',
      temperatureHigh: 75,
      workPerformed: 'Completed foundation forms and rebar placement',
      workPlanned: 'Pour foundation concrete tomorrow',
      laborEntries: [
        { workerCount: 5, regularHours: 8 },
        { workerCount: 3, regularHours: 8 },
      ],
      equipmentOnSite: [{ name: 'Excavator' }],
      materialsReceived: [{ name: 'Concrete' }],
      safetyNotes: 'Toolbox talk completed',
      safetyIncidents: 0,
      photoIds: ['photo-1', 'photo-2', 'photo-3'],
    });

    expect(score.overall).toBeGreaterThan(85);
    expect(score.sections).toHaveLength(7);
  });

  it('should penalize missing weather data', async () => {
    const { calculateCompletenessScore } = await import('@/lib/daily-report-enhancements');

    const score = calculateCompletenessScore({
      weatherCondition: null,
      temperatureHigh: null,
      workPerformed: 'Some work',
      laborEntries: [{ workerCount: 5, regularHours: 8 }],
    });

    const weatherSection = score.sections.find(s => s.name === 'Weather');
    expect(weatherSection?.score).toBe(0);
    expect(weatherSection?.missing).toContain('Weather condition');
    expect(weatherSection?.missing).toContain('Temperature');
  });

  it('should penalize short work descriptions', async () => {
    const { calculateCompletenessScore } = await import('@/lib/daily-report-enhancements');

    const score = calculateCompletenessScore({
      workPerformed: 'Work done',
      workPlanned: 'More work',
      laborEntries: [{ workerCount: 5, regularHours: 8 }],
    });

    const workSection = score.sections.find(s => s.name === 'Work Summary');
    expect(workSection?.score).toBeLessThan(70);
  });

  it('should penalize missing labor entries', async () => {
    const { calculateCompletenessScore } = await import('@/lib/daily-report-enhancements');

    const score = calculateCompletenessScore({
      weatherCondition: 'Sunny',
      workPerformed: 'Work completed',
      laborEntries: [],
    });

    const laborSection = score.sections.find(s => s.name === 'Labor Hours');
    expect(laborSection?.score).toBe(0);
    expect(laborSection?.missing).toContain('Labor/crew information');
  });

  it('should score materials as 50% by default', async () => {
    const { calculateCompletenessScore } = await import('@/lib/daily-report-enhancements');

    const score = calculateCompletenessScore({
      weatherCondition: 'Sunny',
      materialsReceived: null,
    });

    const materialsSection = score.sections.find(s => s.name === 'Materials');
    expect(materialsSection?.score).toBe(50);
  });

  it('should penalize missing safety data', async () => {
    const { calculateCompletenessScore } = await import('@/lib/daily-report-enhancements');

    const score = calculateCompletenessScore({
      weatherCondition: 'Sunny',
      safetyIncidents: undefined,
      safetyNotes: null,
    });

    const safetySection = score.sections.find(s => s.name === 'Safety');
    expect(safetySection?.score).toBe(0);
    expect(safetySection?.missing).toContain('Safety incident count');
    expect(safetySection?.missing).toContain('Safety observations');
  });

  it('should score photos based on count', async () => {
    const { calculateCompletenessScore } = await import('@/lib/daily-report-enhancements');

    const noPhotos = calculateCompletenessScore({ photoIds: [] });
    const onePhoto = calculateCompletenessScore({ photoIds: ['photo-1'] });
    const threePhotos = calculateCompletenessScore({ photoIds: ['photo-1', 'photo-2', 'photo-3'] });

    const noPhotosSection = noPhotos.sections.find(s => s.name === 'Photos');
    const onePhotoSection = onePhoto.sections.find(s => s.name === 'Photos');
    const threePhotosSection = threePhotos.sections.find(s => s.name === 'Photos');

    expect(noPhotosSection?.score).toBe(0);
    expect(onePhotoSection?.score).toBe(60);
    expect(threePhotosSection?.score).toBe(100);
  });

  it('should generate suggestions for low-scoring sections', async () => {
    const { calculateCompletenessScore } = await import('@/lib/daily-report-enhancements');

    const score = calculateCompletenessScore({
      weatherCondition: null,
      workPerformed: null,
      laborEntries: [],
      photoIds: [],
    });

    expect(score.suggestions.length).toBeGreaterThan(0);
    expect(score.suggestions.length).toBeLessThanOrEqual(5);
  });
});

describe('getTrendAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyReport.findMany.mockResolvedValue(mockReports);
  });

  it('should analyze delay reasons', async () => {
    const { getTrendAnalytics } = await import('@/lib/daily-report-enhancements');

    const analytics = await getTrendAnalytics('project-1', 30);

    expect(analytics.delayAnalysis.byReason).toHaveProperty('Weather delay');
    expect(analytics.delayAnalysis.topReasons.length).toBeGreaterThan(0);
    expect(analytics.delayAnalysis.totalDelayDays).toBeGreaterThan(0);
  });

  it('should calculate productivity trends by week', async () => {
    const { getTrendAnalytics } = await import('@/lib/daily-report-enhancements');

    const analytics = await getTrendAnalytics('project-1', 30);

    expect(analytics.productivityTrend.length).toBeGreaterThan(0);
    expect(analytics.productivityTrend[0]).toHaveProperty('week');
    expect(analytics.productivityTrend[0]).toHaveProperty('avgCrewSize');
    expect(analytics.productivityTrend[0]).toHaveProperty('avgHoursWorked');
  });

  it('should track weather impact', async () => {
    const { getTrendAnalytics } = await import('@/lib/daily-report-enhancements');

    const analytics = await getTrendAnalytics('project-1', 30);

    expect(analytics.weatherImpact.daysLostToWeather).toBe(1);
    expect(analytics.weatherImpact.commonConditions).toHaveProperty('Sunny');
    expect(analytics.weatherImpact.commonConditions).toHaveProperty('Rain');
  });

  it('should calculate safety metrics', async () => {
    const { getTrendAnalytics } = await import('@/lib/daily-report-enhancements');

    const analytics = await getTrendAnalytics('project-1', 30);

    expect(analytics.safetyMetrics.totalIncidents).toBe(1);
    expect(analytics.safetyMetrics.incidentFrequency).toBeGreaterThanOrEqual(0);
    expect(analytics.safetyMetrics.daysWithoutIncident).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty reports gracefully', async () => {
    prismaMock.dailyReport.findMany.mockResolvedValue([]);

    const { getTrendAnalytics } = await import('@/lib/daily-report-enhancements');

    const analytics = await getTrendAnalytics('project-1', 30);

    expect(analytics.delayAnalysis.totalDelayDays).toBe(0);
    expect(analytics.productivityTrend).toHaveLength(0);
    expect(analytics.safetyMetrics.totalIncidents).toBe(0);
  });

  it('should handle database errors', async () => {
    prismaMock.dailyReport.findMany.mockRejectedValue(new Error('Database error'));

    const { getTrendAnalytics } = await import('@/lib/daily-report-enhancements');

    const analytics = await getTrendAnalytics('project-1', 30);

    expect(analytics.delayAnalysis.totalDelayDays).toBe(0);
    expect(analytics.productivityTrend).toHaveLength(0);
  });
});

describe('getEquipmentSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyReport.findMany.mockResolvedValue([
      {
        equipmentOnSite: [
          { name: 'Excavator', hours: 8, fuelUsed: 50, status: 'active' },
          { name: 'Loader', hours: 6, fuelUsed: 40, status: 'active' },
        ],
      },
      {
        equipmentOnSite: [
          { name: 'Excavator', hours: 7, fuelUsed: 45, status: 'active' },
        ],
      },
    ]);
  });

  it('should aggregate equipment usage', async () => {
    const { getEquipmentSummary } = await import('@/lib/daily-report-enhancements');

    const summary = await getEquipmentSummary('project-1', 7);

    expect(summary.totalEquipment).toBe(2);
    expect(summary.totalHours).toBe(21); // 8+7+6
    expect(summary.totalFuel).toBe(135); // 50+45+40
  });

  it('should calculate utilization rate', async () => {
    const { getEquipmentSummary } = await import('@/lib/daily-report-enhancements');

    const summary = await getEquipmentSummary('project-1', 7);

    expect(summary.utilizationRate).toBeGreaterThanOrEqual(0);
    expect(summary.utilizationRate).toBeLessThanOrEqual(100);
  });

  it('should generate maintenance alerts for high-hour equipment', async () => {
    prismaMock.dailyReport.findMany.mockResolvedValue([
      {
        equipmentOnSite: [
          { name: 'Excavator', hours: 240, status: 'active' },
        ],
      },
    ]);

    const { getEquipmentSummary } = await import('@/lib/daily-report-enhancements');

    const summary = await getEquipmentSummary('project-1', 7);

    expect(summary.maintenanceAlerts.length).toBeGreaterThan(0);
    expect(summary.maintenanceAlerts[0]).toHaveProperty('equipmentName');
    expect(summary.maintenanceAlerts[0]).toHaveProperty('urgency');
  });

  it('should prioritize urgent maintenance alerts', async () => {
    prismaMock.dailyReport.findMany.mockResolvedValue([
      {
        equipmentOnSite: [
          { name: 'Excavator', hours: 245, status: 'active' },
          { name: 'Loader', hours: 230, status: 'active' },
        ],
      },
    ]);

    const { getEquipmentSummary } = await import('@/lib/daily-report-enhancements');

    const summary = await getEquipmentSummary('project-1', 7);

    const highUrgency = summary.maintenanceAlerts.filter(a => a.urgency === 'high');
    expect(highUrgency.length).toBeGreaterThan(0);
  });

  it('should handle empty equipment data', async () => {
    prismaMock.dailyReport.findMany.mockResolvedValue([]);

    const { getEquipmentSummary } = await import('@/lib/daily-report-enhancements');

    const summary = await getEquipmentSummary('project-1', 7);

    expect(summary.totalEquipment).toBe(0);
    expect(summary.totalHours).toBe(0);
    expect(summary.maintenanceAlerts).toHaveLength(0);
  });

  it('should handle database errors', async () => {
    prismaMock.dailyReport.findMany.mockRejectedValue(new Error('Database error'));

    const { getEquipmentSummary } = await import('@/lib/daily-report-enhancements');

    const summary = await getEquipmentSummary('project-1', 7);

    expect(summary.totalEquipment).toBe(0);
    expect(summary.maintenanceAlerts).toHaveLength(0);
  });
});

describe('getYesterdayCarryover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.dailyReport.findFirst.mockResolvedValue({
      workPlanned: 'Pour foundation concrete',
      equipmentOnSite: [
        { name: 'Excavator', hours: 8, status: 'active' },
      ],
      laborEntries: [
        { workerCount: 5 },
        { workerCount: 3 },
      ],
    });
    prismaMock.dailyReport.findMany.mockResolvedValue([]);
    prismaMock.schedule.findFirst.mockResolvedValue(mockSchedule);
  });

  it('should return yesterday\'s carryover data', async () => {
    const { getYesterdayCarryover } = await import('@/lib/daily-report-enhancements');

    const carryover = await getYesterdayCarryover('project-1');

    expect(carryover).not.toBeNull();
    expect(carryover?.workPlanned).toBe('Pour foundation concrete');
    expect(carryover?.crewSize).toBe(8);
    expect(carryover?.equipmentOnSite).toHaveLength(1);
  });

  it('should include today\'s scheduled tasks', async () => {
    const { getYesterdayCarryover } = await import('@/lib/daily-report-enhancements');

    const carryover = await getYesterdayCarryover('project-1');

    expect(carryover?.scheduledTasks.length).toBeGreaterThan(0);
    expect(carryover?.scheduledTasks[0]).toHaveProperty('name');
    expect(carryover?.scheduledTasks[0]).toHaveProperty('percentComplete');
  });

  it('should handle no previous reports', async () => {
    prismaMock.dailyReport.findFirst.mockResolvedValue(null);

    const { getYesterdayCarryover } = await import('@/lib/daily-report-enhancements');

    const carryover = await getYesterdayCarryover('project-1');

    expect(carryover?.workPlanned).toBe('');
    expect(carryover?.crewSize).toBe(0);
  });

  it('should handle database errors', async () => {
    prismaMock.dailyReport.findFirst.mockRejectedValue(new Error('Database error'));

    const { getYesterdayCarryover } = await import('@/lib/daily-report-enhancements');

    const carryover = await getYesterdayCarryover('project-1');

    expect(carryover).toBeNull();
  });
});
