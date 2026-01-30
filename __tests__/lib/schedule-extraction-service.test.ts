import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before module imports
const prismaMock = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  doorScheduleItem: {
    count: vi.fn(),
  },
  hardwareSetDefinition: {
    count: vi.fn(),
  },
  windowScheduleItem: {
    count: vi.fn(),
  },
  quantityRequirement: {
    count: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

// Mock door schedule extractor
const mockDoorExtraction = vi.hoisted(() => ({
  success: true,
  doorsExtracted: 15,
  errors: [],
}));

vi.mock('@/lib/door-schedule-extractor', () => ({
  processDoorScheduleForProject: vi.fn().mockResolvedValue(mockDoorExtraction),
}));

// Mock window schedule extractor
const mockWindowExtraction = vi.hoisted(() => ({
  success: true,
  windowsExtracted: 8,
  errors: [],
}));

vi.mock('@/lib/window-schedule-extractor', () => ({
  processWindowScheduleForProject: vi.fn().mockResolvedValue(mockWindowExtraction),
}));

// Mock MEP schedule extractor
const mockMEPExtraction = vi.hoisted(() => ({
  success: true,
  lightFixtures: [
    { type: 'A', manufacturer: 'LITHONIA', modelNumber: 'STAR-2x4' },
  ],
  plumbingFixtures: [
    { tag: 'WC-1', typeOfUnit: 'FLOOR SET WATER CLOSET' },
  ],
  hvacEquipment: [
    { unitNo: 'EF-1', type: 'EXHAUST FAN', manufacturer: 'CARRIER' },
  ],
  equipment: [],
  abbreviations: [],
  schedulesFound: ['lightFixtures', 'plumbingFixtures', 'hvacEquipment'],
}));

vi.mock('@/lib/mep-schedule-extractor', () => ({
  extractMEPSchedules: vi.fn().mockResolvedValue(mockMEPExtraction),
}));

describe('extractAllSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      slug: 'test-project',
    });
    prismaMock.doorScheduleItem.count.mockResolvedValue(15);
    prismaMock.hardwareSetDefinition.count.mockResolvedValue(3);
    prismaMock.windowScheduleItem.count.mockResolvedValue(8);
    prismaMock.quantityRequirement.count.mockResolvedValue(12);
    prismaMock.activityLog.create.mockResolvedValue({ id: 'log-1' });
  });

  it('should return empty result when project not found', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    prismaMock.project.findUnique.mockResolvedValue(null);

    const result = await extractAllSchedules('nonexistent-project');

    expect(result.projectId).toBe('');
    expect(result.results).toEqual([]);
    expect(result.totalExtracted).toBe(0);
  });

  it('should extract all schedule types successfully', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    const result = await extractAllSchedules('test-project');

    expect(result.projectId).toBe('project-1');
    expect(result.results).toHaveLength(3);
    expect(result.totalExtracted).toBeGreaterThan(0);
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should extract door schedules', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    const result = await extractAllSchedules('test-project');

    const doorResult = result.results.find((r) => r.scheduleType === 'doors');
    expect(doorResult).toBeDefined();
    expect(doorResult?.success).toBe(true);
    expect(doorResult?.itemsExtracted).toBeGreaterThan(0);
  });

  it('should extract window schedules', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    const result = await extractAllSchedules('test-project');

    const windowResult = result.results.find((r) => r.scheduleType === 'windows');
    expect(windowResult).toBeDefined();
    expect(windowResult?.success).toBe(true);
    expect(windowResult?.itemsExtracted).toBeGreaterThan(0);
  });

  it('should extract MEP schedules', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    const result = await extractAllSchedules('test-project');

    const mepResult = result.results.find((r) => r.scheduleType === 'mep');
    expect(mepResult).toBeDefined();
    expect(mepResult?.success).toBe(true);
    expect(mepResult?.itemsExtracted).toBeGreaterThan(0);
  });

  it('should handle door extraction errors gracefully', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    const { processDoorScheduleForProject } = await import(
      '@/lib/door-schedule-extractor'
    );
    vi.mocked(processDoorScheduleForProject).mockRejectedValueOnce(
      new Error('Door extraction failed')
    );

    const result = await extractAllSchedules('test-project');

    const doorResult = result.results.find((r) => r.scheduleType === 'doors');
    expect(doorResult).toBeDefined();
    expect(doorResult?.success).toBe(false);
    expect(doorResult?.errors).toHaveLength(1);
    expect(doorResult?.errors[0]).toContain('Door extraction failed');
  });

  it('should handle window extraction errors gracefully', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    const { processWindowScheduleForProject } = await import(
      '@/lib/window-schedule-extractor'
    );
    vi.mocked(processWindowScheduleForProject).mockRejectedValueOnce(
      new Error('Window extraction failed')
    );

    const result = await extractAllSchedules('test-project');

    const windowResult = result.results.find((r) => r.scheduleType === 'windows');
    expect(windowResult).toBeDefined();
    expect(windowResult?.success).toBe(false);
    expect(windowResult?.errors).toHaveLength(1);
  });

  it('should handle MEP extraction errors gracefully', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    vi.mocked(extractMEPSchedules).mockRejectedValueOnce(
      new Error('MEP extraction failed')
    );

    const result = await extractAllSchedules('test-project');

    const mepResult = result.results.find((r) => r.scheduleType === 'mep');
    expect(mepResult).toBeDefined();
    expect(mepResult?.success).toBe(false);
    expect(mepResult?.errors).toHaveLength(1);
  });

  it('should count total extracted items across all schedules', async () => {
    const { extractAllSchedules } = await import('@/lib/schedule-extraction-service');
    const result = await extractAllSchedules('test-project');

    expect(result.totalExtracted).toBeGreaterThan(0);
    const totalFromResults = result.results.reduce(
      (sum, r) => sum + r.itemsExtracted,
      0
    );
    expect(result.totalExtracted).toBe(totalFromResults);
  });
});

describe('triggerExtractionForDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      slug: 'test-project',
    });
    prismaMock.doorScheduleItem.count.mockResolvedValue(15);
    prismaMock.hardwareSetDefinition.count.mockResolvedValue(3);
    prismaMock.windowScheduleItem.count.mockResolvedValue(8);
    prismaMock.quantityRequirement.count.mockResolvedValue(12);
    prismaMock.activityLog.create.mockResolvedValue({ id: 'log-1' });
  });

  it('should return null when project not found', async () => {
    const { triggerExtractionForDocument } = await import('@/lib/schedule-extraction-service');
    prismaMock.project.findUnique.mockResolvedValue(null);

    const result = await triggerExtractionForDocument('doc-1', 'project-1');

    expect(result).toBeNull();
  });

  it('should trigger extraction and log activity', async () => {
    const { triggerExtractionForDocument } = await import('@/lib/schedule-extraction-service');
    const result = await triggerExtractionForDocument('doc-1', 'project-1');

    expect(result).not.toBeNull();
    expect(result?.projectId).toBe('project-1');
    expect(result?.documentId).toBe('doc-1');
    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: {
        action: 'SCHEDULE_EXTRACTION',
        resource: 'document',
        resourceId: 'doc-1',
        details: expect.any(String),
      },
    });
  });

  it('should include extraction results in activity log', async () => {
    const { triggerExtractionForDocument } = await import('@/lib/schedule-extraction-service');
    await triggerExtractionForDocument('doc-1', 'project-1');

    const logCall = prismaMock.activityLog.create.mock.calls[0][0];
    const details = JSON.parse(logCall.data.details);
    expect(details.projectId).toBe('project-1');
    expect(details.results).toBeDefined();
    expect(details.totalExtracted).toBeGreaterThan(0);
  });

  it('should extract from all schedule types', async () => {
    const { triggerExtractionForDocument } = await import('@/lib/schedule-extraction-service');
    const result = await triggerExtractionForDocument('doc-1', 'project-1');

    expect(result?.results).toHaveLength(3);
    expect(result?.results.map((r) => r.scheduleType)).toContain('doors');
    expect(result?.results.map((r) => r.scheduleType)).toContain('windows');
    expect(result?.results.map((r) => r.scheduleType)).toContain('mep');
  });
});
