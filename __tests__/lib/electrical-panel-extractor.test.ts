import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock OpenAI responses with hoisted values
const mockOpenAIResponses = vi.hoisted(() => ({
  panelsResponse: {
    choices: [{
      message: {
        content: JSON.stringify([
          {
            panelTag: 'MDP',
            panelType: 'Main Distribution',
            manufacturer: 'Square D',
            voltage: '120/208V',
            phase: '3PH',
            amperage: 400,
            mainBreaker: 'MB',
            mounting: 'Surface',
            enclosure: 'NEMA 1',
            circuits: 42,
            location: 'Electrical Room',
            wireSize: '500 KCMIL',
            conduitSize: '2.5"',
            quantity: 1,
            notes: 'Main service panel',
          },
          {
            panelTag: 'LP-1',
            panelType: 'Lighting',
            voltage: '120/208V',
            phase: '3PH',
            amperage: 100,
            mounting: 'Flush',
            circuits: 24,
            fedFrom: 'MDP',
            location: '1st Floor Corridor',
            quantity: 2,
          },
        ]),
      },
    }],
  },
  lightingResponse: {
    choices: [{
      message: {
        content: JSON.stringify([
          {
            fixtureTag: 'A',
            fixtureType: 'LED Troffer',
            manufacturer: 'Lithonia',
            catalog: 'GTL4-40L-ADP-LP840',
            wattage: 40,
            lumens: 4000,
            colorTemp: '4000K',
            voltage: '120V',
            mounting: 'Recessed',
            dimming: '0-10V',
            emergencyBattery: false,
            wetLocation: false,
            quantity: 150,
            notes: 'Office areas',
          },
          {
            fixtureTag: 'B',
            fixtureType: 'LED Downlight',
            manufacturer: 'Cooper',
            catalog: 'DL6-30-120',
            wattage: 15,
            lumens: 800,
            colorTemp: '3000K',
            mounting: 'Recessed',
            emergencyBattery: true,
            wetLocation: false,
            quantity: 48,
          },
        ]),
      },
    }],
  },
  emptyResponse: {
    choices: [{
      message: {
        content: '[]',
      },
    }],
  },
  markdownResponse: {
    choices: [{
      message: {
        content: '```json\n[{"panelTag":"PP-1","panelType":"Power","voltage":"277/480V","phase":"3PH","amperage":200,"mounting":"Surface","circuits":30,"quantity":1}]\n```',
      },
    }],
  },
  invalidJsonResponse: {
    choices: [{
      message: {
        content: 'No electrical panels found in this document',
      },
    }],
  },
}));

// Mock OpenAI
const mockOpenAI = vi.hoisted(() => ({
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
}));

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}));

// Mock Prisma
const prismaMock = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('extractElectricalPanels', () => {
  const mockPanelChunks = [
    {
      id: 'chunk-1',
      content: 'PANEL SCHEDULE\nMDP - Main Distribution Panel - 400A, 120/208V, 3PH',
      pageNumber: 1,
    },
    {
      id: 'chunk-2',
      content: 'LP-1 - Lighting Panel - 100A, 120/208V, Fed from MDP',
      pageNumber: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue(mockPanelChunks);
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponses.panelsResponse);
  });

  it('should extract electrical panels from document chunks', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    const result = await extractElectricalPanels('project-1');

    expect(result).toHaveLength(2);
    expect(result[0].panelTag).toBe('MDP');
    expect(result[0].panelType).toBe('Main Distribution');
    expect(result[0].amperage).toBe(400);
  });

  it('should query chunks with electrical panel keywords', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    await extractElectricalPanels('project-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: 'project-1',
        OR: expect.arrayContaining([
          { content: { contains: 'PANEL SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'ELECTRICAL PANEL', mode: 'insensitive' } },
          { content: { contains: 'MDP', mode: 'insensitive' } },
          { content: { contains: 'DISTRIBUTION PANEL', mode: 'insensitive' } },
          { content: { contains: '120/208V', mode: 'insensitive' } },
          { content: { contains: '277/480V', mode: 'insensitive' } },
        ]),
      }),
      orderBy: { pageNumber: 'asc' },
      take: 20,
    });
  });

  it('should filter by documentId when provided', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    await extractElectricalPanels('project-1', 'doc-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentId: 'doc-1',
        }),
      })
    );
  });

  it('should return empty array when no chunks found', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await extractElectricalPanels('project-1');

    expect(result).toEqual([]);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should generate unique IDs for each panel', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    const result = await extractElectricalPanels('project-1');

    expect(result[0].id).toBe('panel-project-1-0');
    expect(result[1].id).toBe('panel-project-1-1');
  });

  it('should default quantity to 1 if not specified', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([{ panelTag: 'PP-1', panelType: 'Power', voltage: '277/480V', phase: '3PH', amperage: 200, mounting: 'Surface' }]),
        },
      }],
    });

    const result = await extractElectricalPanels('project-1');

    expect(result[0].quantity).toBe(1);
  });

  it('should preserve specified quantity', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    const result = await extractElectricalPanels('project-1');

    expect(result[1].quantity).toBe(2); // LP-1 has quantity 2 in mock
  });

  it('should combine multiple chunks with double newline', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    await extractElectricalPanels('project-1');

    const aiCall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(aiCall.messages[0].content).toContain(mockPanelChunks[0].content);
    expect(aiCall.messages[0].content).toContain(mockPanelChunks[1].content);
    expect(aiCall.messages[0].content).toContain('\n\n');
  });

  it('should use claude-sonnet-4-5-20250929 model with low temperature', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    await extractElectricalPanels('project-1');

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-5-20250929',
      messages: expect.any(Array),
      temperature: 0.1,
    });
  });

  it('should strip markdown code blocks from response', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponses.markdownResponse);

    const result = await extractElectricalPanels('project-1');

    expect(result).toHaveLength(1);
    expect(result[0].panelTag).toBe('PP-1');
  });

  it('should handle empty AI response', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponses.emptyResponse);

    const result = await extractElectricalPanels('project-1');

    expect(result).toEqual([]);
  });

  it('should handle missing response content', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{}],
    });

    const result = await extractElectricalPanels('project-1');

    expect(result).toEqual([]);
  });

  it('should handle AI errors gracefully', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('AI service error'));

    const result = await extractElectricalPanels('project-1');

    expect(result).toEqual([]);
  });

  it('should handle invalid JSON response', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponses.invalidJsonResponse);

    const result = await extractElectricalPanels('project-1');

    expect(result).toEqual([]);
  });

  it('should handle database errors gracefully', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

    const result = await extractElectricalPanels('project-1');

    expect(result).toEqual([]);
  });

  it('should include all optional panel properties', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    const result = await extractElectricalPanels('project-1');

    const mdp = result[0];
    expect(mdp.manufacturer).toBe('Square D');
    expect(mdp.mainBreaker).toBe('MB');
    expect(mdp.enclosure).toBe('NEMA 1');
    expect(mdp.circuits).toBe(42);
    expect(mdp.location).toBe('Electrical Room');
    expect(mdp.wireSize).toBe('500 KCMIL');
    expect(mdp.conduitSize).toBe('2.5"');
    expect(mdp.notes).toBe('Main service panel');
  });

  it('should handle panels without optional properties', async () => {
    const { extractElectricalPanels } = await import('@/lib/electrical-panel-extractor');
    const result = await extractElectricalPanels('project-1');

    const lp = result[1];
    expect(lp.manufacturer).toBeUndefined();
    expect(lp.mainBreaker).toBeUndefined();
    expect(lp.enclosure).toBeUndefined();
  });
});

describe('extractLightingFixtures', () => {
  const mockLightingChunks = [
    {
      id: 'chunk-1',
      content: 'LIGHTING FIXTURE SCHEDULE\nType A - LED Troffer - 40W - 4000K',
      pageNumber: 1,
    },
    {
      id: 'chunk-2',
      content: 'Type B - LED Downlight - 15W - 3000K - EM Battery',
      pageNumber: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue(mockLightingChunks);
    mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponses.lightingResponse);
  });

  it('should extract lighting fixtures from document chunks', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    const result = await extractLightingFixtures('project-1');

    expect(result).toHaveLength(2);
    expect(result[0].fixtureTag).toBe('A');
    expect(result[0].fixtureType).toBe('LED Troffer');
    expect(result[0].wattage).toBe(40);
  });

  it('should query chunks with lighting keywords', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    await extractLightingFixtures('project-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: 'project-1',
        OR: expect.arrayContaining([
          { content: { contains: 'LIGHTING FIXTURE SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'LUMINAIRE SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'FIXTURE TYPE', mode: 'insensitive' } },
          { content: { contains: 'LED TROFFER', mode: 'insensitive' } },
          { content: { contains: 'LUMENS', mode: 'insensitive' } },
        ]),
      }),
      orderBy: { pageNumber: 'asc' },
      take: 20,
    });
  });

  it('should filter by documentId when provided', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    await extractLightingFixtures('project-1', 'doc-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentId: 'doc-1',
        }),
      })
    );
  });

  it('should return empty array when no chunks found', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await extractLightingFixtures('project-1');

    expect(result).toEqual([]);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should generate unique IDs for each fixture', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    const result = await extractLightingFixtures('project-1');

    expect(result[0].id).toBe('light-project-1-0');
    expect(result[1].id).toBe('light-project-1-1');
  });

  it('should default quantity to 1 if not specified', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([{ fixtureTag: 'C', fixtureType: 'Exit Sign', mounting: 'Wall' }]),
        },
      }],
    });

    const result = await extractLightingFixtures('project-1');

    expect(result[0].quantity).toBe(1);
  });

  it('should preserve specified quantity', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    const result = await extractLightingFixtures('project-1');

    expect(result[0].quantity).toBe(150);
    expect(result[1].quantity).toBe(48);
  });

  it('should handle boolean flags correctly', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    const result = await extractLightingFixtures('project-1');

    expect(result[0].emergencyBattery).toBe(false);
    expect(result[0].wetLocation).toBe(false);
    expect(result[1].emergencyBattery).toBe(true);
  });

  it('should include all optional fixture properties', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    const result = await extractLightingFixtures('project-1');

    const fixtureA = result[0];
    expect(fixtureA.manufacturer).toBe('Lithonia');
    expect(fixtureA.catalog).toBe('GTL4-40L-ADP-LP840');
    expect(fixtureA.wattage).toBe(40);
    expect(fixtureA.lumens).toBe(4000);
    expect(fixtureA.colorTemp).toBe('4000K');
    expect(fixtureA.voltage).toBe('120V');
    expect(fixtureA.dimming).toBe('0-10V');
    expect(fixtureA.notes).toBe('Office areas');
  });

  it('should handle fixtures without optional properties', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    const result = await extractLightingFixtures('project-1');

    const fixtureB = result[1];
    expect(fixtureB.voltage).toBeUndefined();
    expect(fixtureB.dimming).toBeUndefined();
    expect(fixtureB.notes).toBeUndefined();
  });

  it('should handle AI errors gracefully', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('AI service error'));

    const result = await extractLightingFixtures('project-1');

    expect(result).toEqual([]);
  });

  it('should handle database errors gracefully', async () => {
    const { extractLightingFixtures } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

    const result = await extractLightingFixtures('project-1');

    expect(result).toEqual([]);
  });
});

describe('extractElectricalSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract both panels and lighting fixtures', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    // Mock for extractElectricalPanels call
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    // Mock for extractLightingFixtures call
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await extractElectricalSchedule('project-1');

    expect(result).not.toBeNull();
    expect(result!.panels).toHaveLength(2);
    expect(result!.lightingFixtures).toHaveLength(2);
  });

  it('should include project and document IDs', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await extractElectricalSchedule('project-1', 'doc-1');

    expect(result!.projectId).toBe('project-1');
    expect(result!.documentId).toBe('doc-1');
  });

  it('should set extractedAt timestamp', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await extractElectricalSchedule('project-1');

    expect(result!.extractedAt).toBeInstanceOf(Date);
  });

  it('should calculate total panel count', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await extractElectricalSchedule('project-1');

    // MDP (qty 1) + LP-1 (qty 2) = 3 total
    expect(result!.totalPanels).toBe(3);
  });

  it('should calculate total light fixture count', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await extractElectricalSchedule('project-1');

    // Type A (qty 150) + Type B (qty 48) = 198 total
    expect(result!.totalLightFixtures).toBe(198);
  });

  it('should return null when no panels or fixtures found', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    // Both extraction calls return empty
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);

    const result = await extractElectricalSchedule('project-1');

    expect(result).toBeNull();
  });

  it('should return schedule with only panels if no fixtures', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);

    const result = await extractElectricalSchedule('project-1');

    expect(result).not.toBeNull();
    expect(result!.panels).toHaveLength(2);
    expect(result!.lightingFixtures).toHaveLength(0);
    expect(result!.totalPanels).toBe(3);
    expect(result!.totalLightFixtures).toBe(0);
  });

  it('should return schedule with only fixtures if no panels', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await extractElectricalSchedule('project-1');

    expect(result).not.toBeNull();
    expect(result!.panels).toHaveLength(0);
    expect(result!.lightingFixtures).toHaveLength(2);
    expect(result!.totalPanels).toBe(0);
    expect(result!.totalLightFixtures).toBe(198);
  });

  it('should handle errors gracefully', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockRejectedValueOnce(new Error('Database error'));

    const result = await extractElectricalSchedule('project-1');

    expect(result).toBeNull();
  });

  it('should call both extraction functions in parallel', async () => {
    const { extractElectricalSchedule } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    await extractElectricalSchedule('project-1');

    // Both should be called
    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledTimes(2);
  });
});

describe('getElectricalContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when project not found', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue(null);

    const context = await getElectricalContext('nonexistent');

    expect(context).toBeNull();
  });

  it('should return null when no schedule found', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      slug: 'test-project',
    });
    // Both extraction calls return empty
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);

    const context = await getElectricalContext('test-project');

    expect(context).toBeNull();
  });

  it('should include header with schedule title', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('ELECTRICAL SCHEDULE:');
  });

  it('should include panel section with total count', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('PANELS (3 total)');
  });

  it('should list all panel details', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('MDP: Main Distribution, 120/208V, 3PH, 400A');
    expect(context).toContain('Square D');
    expect(context).toContain('42 circuits');
  });

  it('should include fedFrom information for panels', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('(fed from MDP)');
  });

  it('should include lighting section with total count', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('LIGHTING FIXTURES (198 total)');
  });

  it('should list all fixture details', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('Type A: LED Troffer (Qty: 150)');
    expect(context).toContain('Lithonia');
    expect(context).toContain('GTL4-40L-ADP-LP840');
    expect(context).toContain('40W');
    expect(context).toContain('4000K');
  });

  it('should mark emergency fixtures', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('[EM]');
  });

  it('should handle schedule with only panels', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('PANELS (3 total)');
    expect(context).not.toContain('LIGHTING FIXTURES');
  });

  it('should handle schedule with only fixtures', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', slug: 'test-project' });
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const context = await getElectricalContext('test-project');

    expect(context).toContain('LIGHTING FIXTURES (198 total)');
    expect(context).not.toContain('PANELS');
  });

  it('should handle errors gracefully', async () => {
    const { getElectricalContext } = await import('@/lib/electrical-panel-extractor');
    prismaMock.project.findUnique.mockRejectedValue(new Error('Database error'));

    const context = await getElectricalContext('test-project');

    expect(context).toBeNull();
  });
});

describe('getElectricalRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should format panels for submittal requirements', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await getElectricalRequirements('project-1');

    expect(result.panels).toHaveLength(2);
    expect(result.panels[0]).toMatchObject({
      productName: 'Main Distribution Panel MDP - 400A 120/208V 3PH',
      manufacturer: 'Square D',
      model: undefined,
      requiredQty: 1,
      unit: 'EA',
      specSection: '26 24 00',
      tradeCategory: 'electrical',
      linkedSourceType: 'electrical_schedule',
    });
  });

  it('should format lighting fixtures for submittal requirements', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await getElectricalRequirements('project-1');

    expect(result.lightingFixtures).toHaveLength(2);
    expect(result.lightingFixtures[0]).toMatchObject({
      productName: 'LED Troffer - Type A',
      manufacturer: 'Lithonia',
      model: 'GTL4-40L-ADP-LP840',
      requiredQty: 150,
      unit: 'EA',
      specSection: '26 51 00',
      tradeCategory: 'electrical',
      linkedSourceType: 'lighting_schedule',
    });
  });

  it('should include panel ID in linkedSourceIds', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await getElectricalRequirements('project-1');

    expect(result.panels[0].linkedSourceIds).toEqual(['panel-project-1-0']);
    expect(result.panels[1].linkedSourceIds).toEqual(['panel-project-1-1']);
  });

  it('should include fixture ID in linkedSourceIds', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await getElectricalRequirements('project-1');

    expect(result.lightingFixtures[0].linkedSourceIds).toEqual(['light-project-1-0']);
    expect(result.lightingFixtures[1].linkedSourceIds).toEqual(['light-project-1-1']);
  });

  it('should handle panels without manufacturer', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await getElectricalRequirements('project-1');

    expect(result.panels[1].manufacturer).toBeUndefined();
  });

  it('should handle fixtures without catalog number', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await getElectricalRequirements('project-1');

    expect(result.lightingFixtures[1].model).toBe('DL6-30-120');
  });

  it('should return empty arrays when no schedule found', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);

    const result = await getElectricalRequirements('project-1');

    expect(result.panels).toEqual([]);
    expect(result.lightingFixtures).toEqual([]);
  });

  it('should use correct spec sections', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await getElectricalRequirements('project-1');

    // Panels: 26 24 00 - Switchboards and Panelboards
    expect(result.panels[0].specSection).toBe('26 24 00');

    // Lighting: 26 51 00 - Interior Lighting
    expect(result.lightingFixtures[0].specSection).toBe('26 51 00');
  });

  it('should handle schedule with only panels', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-1', content: 'PANEL SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.panelsResponse);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);

    const result = await getElectricalRequirements('project-1');

    expect(result.panels).toHaveLength(2);
    expect(result.lightingFixtures).toEqual([]);
  });

  it('should handle schedule with only fixtures', async () => {
    const { getElectricalRequirements } = await import('@/lib/electrical-panel-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([]);
    prismaMock.documentChunk.findMany.mockResolvedValueOnce([{ id: 'chunk-2', content: 'LIGHTING FIXTURE SCHEDULE', pageNumber: 1 }]);
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockOpenAIResponses.lightingResponse);

    const result = await getElectricalRequirements('project-1');

    expect(result.panels).toEqual([]);
    expect(result.lightingFixtures).toHaveLength(2);
  });
});
