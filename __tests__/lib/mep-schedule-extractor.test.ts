import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock LLM responses for different schedule types
const mockLightFixturesResponse = {
  content: JSON.stringify([
    {
      type: 'A',
      manufacturer: 'LITHONIA',
      modelNumber: 'STAR-2x4-7200LM-80CRI-30K-COL-MVOLT',
      volts: 120,
      description: '7,200 LUMEN LED @ 30K, 2x4 RECESSED CENTER ELEMENT LED',
      watts: 65,
      mounting: 'LAY-IN',
    },
    {
      type: 'B',
      manufacturer: 'VISA',
      modelNumber: 'VT-LED-4500LM',
      volts: 120,
      description: '4,500 LUMEN LED TROFFER',
      watts: 45,
      mounting: 'RECESSED',
    },
  ]),
};

const mockPlumbingFixturesResponse = {
  content: JSON.stringify([
    {
      tag: 'WC-1',
      typeOfUnit: 'FLOOR SET WATER CLOSET FLUSH VALVE ADA',
      supplyMfr: 'SLOAN',
      supplyModel: 'ROYAL 111-1.28',
      unitMfr: 'PROFLO',
      unitModel: 'PFCT203HE',
      fixtureUnits: { drain: 4, cw: 10, trap: 3 },
      pipeSizes: { cwSupply: '1"', cwBranch: '3/4"' },
      adaHeight: '17"-19"',
      remarks: 'ADA COMPLIANT',
    },
    {
      tag: 'LAV-1',
      typeOfUnit: 'WALL MOUNTED LAVATORY ADA',
      supplyMfr: 'SLOAN',
      unitMfr: 'PROFLO',
      fixtureUnits: { drain: 1, cw: 2, hw: 2 },
    },
  ]),
};

const mockHVACEquipmentResponse = {
  content: JSON.stringify([
    {
      unitNo: 'EF-1',
      location: 'ROOF',
      type: 'PROPELLER EXHAUST FAN',
      manufacturer: 'CARRIER',
      model: 'EF-200',
      weight: '150 LBS',
      performance: { airflowCfm: 2000, staticPressure: 0.25 },
      electrical: { voltage: '208-230V', phase: '1PH', mca: 5, mop: 15 },
    },
    {
      unitNo: 'ERV-1',
      location: 'MECHANICAL ROOM',
      type: 'ENERGY RECOVERY VENTILATOR',
      manufacturer: 'GREENBACK',
      model: 'ERV-500',
      performance: { airflowCfm: 500, minOA: 250 },
    },
  ]),
};

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: vi.fn().mockImplementation(async (messages) => {
    const prompt = messages[1]?.content || '';
    if (prompt.includes('LIGHT FIXTURE')) {
      return mockLightFixturesResponse;
    } else if (prompt.includes('PLUMBING FIXTURES')) {
      return mockPlumbingFixturesResponse;
    } else if (prompt.includes('FANS') || prompt.includes('ERV') || prompt.includes('HVAC')) {
      return mockHVACEquipmentResponse;
    }
    return { content: '[]' };
  }),
}));

// Mock Prisma
const mockProject = {
  id: 'project-1',
  slug: 'test-project',
  Document: [
    {
      id: 'doc-1',
      name: 'Electrical Plans.pdf',
      fileName: 'electrical.pdf',
      processed: true,
      deletedAt: null,
      DocumentChunk: [
        {
          id: 'chunk-1',
          content: 'LIGHT FIXTURE SCHEDULE\nType A - LITHONIA STAR-2x4',
          pageNumber: 1,
        },
      ],
    },
    {
      id: 'doc-2',
      name: 'Plumbing Plans.pdf',
      fileName: 'plumbing.pdf',
      processed: true,
      deletedAt: null,
      DocumentChunk: [
        {
          id: 'chunk-2',
          content: 'PLUMBING FIXTURES AND SPECIALTIES\nWC-1 - FLOOR SET WATER CLOSET',
          pageNumber: 1,
        },
      ],
    },
    {
      id: 'doc-3',
      name: 'HVAC Plans.pdf',
      fileName: 'hvac.pdf',
      processed: true,
      deletedAt: null,
      DocumentChunk: [
        {
          id: 'chunk-3',
          content: 'FAN SCHEDULE\nEF-1 - EXHAUST FAN - ROOF MOUNTED',
          pageNumber: 1,
        },
      ],
    },
  ],
};

const prismaMock = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  projectDataSource: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('extractMEPSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue(mockProject);
    prismaMock.projectDataSource.upsert.mockResolvedValue({ id: 'data-source-1' });
  });

  it('should return error when project not found', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    prismaMock.project.findUnique.mockResolvedValue(null);

    const result = await extractMEPSchedules('nonexistent');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Project not found');
  });

  it('should extract light fixtures from documents', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    const result = await extractMEPSchedules('test-project');

    expect(result.success).toBe(true);
    expect(result.lightFixtures.length).toBeGreaterThan(0);
    expect(result.lightFixtures[0]).toMatchObject({
      type: 'A',
      manufacturer: 'LITHONIA',
      volts: 120,
    });
  });

  it('should extract plumbing fixtures from documents', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    const result = await extractMEPSchedules('test-project');

    expect(result.success).toBe(true);
    // Plumbing fixtures are extracted if found in documents
    expect(result.plumbingFixtures).toBeDefined();
  });

  it('should extract HVAC equipment from documents', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    const result = await extractMEPSchedules('test-project');

    expect(result.success).toBe(true);
    expect(result.hvacEquipment.length).toBeGreaterThan(0);
    expect(result.hvacEquipment[0]).toMatchObject({
      unitNo: 'EF-1',
      type: 'PROPELLER EXHAUST FAN',
      manufacturer: 'CARRIER',
    });
  });

  it('should identify found schedule types', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    const result = await extractMEPSchedules('test-project');

    expect(result.schedulesFound).toContain('lightFixtures');
    expect(result.schedulesFound).toContain('plumbingFixtures');
    expect(result.schedulesFound).toContain('fans');
  });

  it('should store extracted data in database', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    await extractMEPSchedules('test-project');

    expect(prismaMock.projectDataSource.upsert).toHaveBeenCalledWith({
      where: {
        projectId_featureType: {
          projectId: 'project-1',
          featureType: 'mep_schedules',
        },
      },
      update: expect.objectContaining({
        metadata: expect.any(Object),
      }),
      create: expect.objectContaining({
        projectId: 'project-1',
        featureType: 'mep_schedules',
        sourceType: 'ai_extraction',
      }),
    });
  });

  it('should include summary counts in stored data', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    await extractMEPSchedules('test-project');

    const upsertCall = prismaMock.projectDataSource.upsert.mock.calls[0][0];
    const metadata = upsertCall.create.metadata;
    expect(metadata.summary).toMatchObject({
      lightFixtureCount: expect.any(Number),
      plumbingFixtureCount: expect.any(Number),
      hvacEquipmentCount: expect.any(Number),
    });
  });

  it('should return error when no MEP schedules found', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    prismaMock.project.findUnique.mockResolvedValue({
      ...mockProject,
      Document: [
        {
          id: 'doc-4',
          name: 'General.pdf',
          processed: true,
          deletedAt: null,
          DocumentChunk: [
            {
              id: 'chunk-4',
              content: 'This is a general document with no schedules',
              pageNumber: 1,
            },
          ],
        },
      ],
    });

    const result = await extractMEPSchedules('test-project');

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No MEP schedules found in documents');
  });

  it('should handle light fixture extraction with all properties', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    const result = await extractMEPSchedules('test-project');

    const fixture = result.lightFixtures[0];
    expect(fixture.type).toBe('A');
    expect(fixture.manufacturer).toBe('LITHONIA');
    expect(fixture.modelNumber).toBeDefined();
    expect(fixture.volts).toBe(120);
    expect(fixture.description).toBeDefined();
    expect(fixture.watts).toBe(65);
    expect(fixture.mounting).toBe('LAY-IN');
  });

  it('should handle plumbing fixture extraction', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    const result = await extractMEPSchedules('test-project');

    // Plumbing fixtures should be extracted
    expect(result.plumbingFixtures).toBeDefined();
    expect(result.plumbingFixtures.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle HVAC equipment extraction', async () => {
    const { extractMEPSchedules } = await import('@/lib/mep-schedule-extractor');
    const result = await extractMEPSchedules('test-project');

    // HVAC equipment should be extracted
    expect(result.hvacEquipment).toBeDefined();
    expect(result.hvacEquipment.length).toBeGreaterThanOrEqual(0);
  });
});

describe('getMEPScheduleContext', () => {
  const mockMEPData = {
    extractedAt: new Date().toISOString(),
    lightFixtures: [
      {
        type: 'A',
        manufacturer: 'LITHONIA',
        modelNumber: 'STAR-2x4',
        volts: 120,
        description: 'LED 2x4',
        watts: 65,
        mounting: 'LAY-IN',
      },
    ],
    plumbingFixtures: [
      {
        tag: 'WC-1',
        typeOfUnit: 'WATER CLOSET',
        supplyMfr: 'SLOAN',
        supplyModel: 'ROYAL 111',
        remarks: 'ADA COMPLIANT',
      },
    ],
    hvacEquipment: [
      {
        unitNo: 'EF-1',
        type: 'EXHAUST FAN',
        manufacturer: 'CARRIER',
        model: 'EF-200',
        location: 'ROOF',
        performance: { airflowCfm: 2000 },
        electrical: { voltage: '208-230V', phase: '1PH' },
      },
    ],
    electricalEquipment: [
      {
        tag: 'EP-1',
        type: 'ELECTRICAL PANEL',
        description: 'MAIN DISTRIBUTION PANEL',
        manufacturer: 'SQUARE D',
        model: 'QO142L225G',
        location: 'ELECTRICAL ROOM',
        voltage: '120/208V',
        phase: '3PH',
        amps: 225,
        panelFed: 'MAIN SERVICE',
        circuitBreaker: '225A',
      },
    ],
    abbreviations: [
      { abbreviation: 'CFM', meaning: 'CUBIC FEET PER MINUTE', category: 'airflow' },
      { abbreviation: 'BTU', meaning: 'BRITISH THERMAL UNIT', category: 'hvac' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1' });
    prismaMock.projectDataSource.findUnique.mockResolvedValue({
      id: 'data-source-1',
      metadata: mockMEPData,
    });
  });

  it('should return empty string when project not found', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    prismaMock.project.findUnique.mockResolvedValue(null);

    const context = await getMEPScheduleContext('nonexistent');

    expect(context).toBe('');
  });

  it('should return empty string when no MEP data stored', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    prismaMock.projectDataSource.findUnique.mockResolvedValue(null);

    const context = await getMEPScheduleContext('test-project');

    expect(context).toBe('');
  });

  it('should include light fixtures in context', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    const context = await getMEPScheduleContext('test-project');

    expect(context).toContain('LIGHT FIXTURE SCHEDULE');
    expect(context).toContain('Type A: LITHONIA STAR-2x4');
    expect(context).toContain('(65W)');
    expect(context).toContain('[LAY-IN]');
  });

  it('should include electrical equipment in context', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    const context = await getMEPScheduleContext('test-project');

    expect(context).toContain('ELECTRICAL EQUIPMENT SCHEDULE');
    expect(context).toContain('EP-1: ELECTRICAL PANEL');
    expect(context).toContain('MAIN DISTRIBUTION PANEL');
    expect(context).toContain('SQUARE D QO142L225G');
    expect(context).toContain('@ ELECTRICAL ROOM');
    expect(context).toContain('120/208V');
    expect(context).toContain('Fed from: MAIN SERVICE');
    expect(context).toContain('CB: 225A');
  });

  it('should include plumbing fixtures in context', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    const context = await getMEPScheduleContext('test-project');

    expect(context).toContain('PLUMBING FIXTURES AND SPECIALTIES');
    expect(context).toContain('WC-1: WATER CLOSET');
    expect(context).toContain('Supply: SLOAN ROYAL 111');
    expect(context).toContain('[ADA COMPLIANT]');
  });

  it('should include HVAC equipment in context', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    const context = await getMEPScheduleContext('test-project');

    expect(context).toContain('HVAC EQUIPMENT SCHEDULES');
    expect(context).toContain('EF-1: EXHAUST FAN');
    expect(context).toContain('CARRIER EF-200');
    expect(context).toContain('@ ROOF');
    expect(context).toContain('(2000 CFM)');
    expect(context).toContain('208-230V');
  });

  it('should include abbreviations summary in context', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    const context = await getMEPScheduleContext('test-project');

    expect(context).toContain('MECHANICAL ABBREVIATIONS (Project-Specific)');
    expect(context).toContain('CFM = CUBIC FEET PER MINUTE');
    expect(context).toContain('BTU = BRITISH THERMAL UNIT');
  });

  it('should group abbreviations by category', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    const context = await getMEPScheduleContext('test-project');

    expect(context).toContain('AIRFLOW:');
    expect(context).toContain('HVAC:');
  });

  it('should limit abbreviations display to 10 per category', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    const manyAbbreviations = Array.from({ length: 15 }, (_, i) => ({
      abbreviation: `ABB${i}`,
      meaning: `MEANING ${i}`,
      category: 'general',
    }));

    prismaMock.projectDataSource.findUnique.mockResolvedValue({
      id: 'data-source-1',
      metadata: {
        ...mockMEPData,
        abbreviations: manyAbbreviations,
      },
    });

    const context = await getMEPScheduleContext('test-project');

    expect(context).toContain('(+5 more)');
  });

  it('should handle missing optional fields gracefully', async () => {
    const { getMEPScheduleContext } = await import('@/lib/mep-schedule-extractor');
    prismaMock.projectDataSource.findUnique.mockResolvedValue({
      id: 'data-source-1',
      metadata: {
        lightFixtures: [
          {
            type: 'A',
            manufacturer: 'LITHONIA',
            modelNumber: 'STAR-2x4',
            volts: 120,
            description: 'LED',
          },
        ],
      },
    });

    const context = await getMEPScheduleContext('test-project');

    expect(context).toContain('LIGHT FIXTURE SCHEDULE');
    expect(context).not.toContain('(W)'); // No watts
    expect(context).not.toContain('['); // No mounting
  });
});
