import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock OpenAI response
const mockOpenAIResponse = vi.hoisted(() => ({
  fixtures: [
    {
      fixtureTag: 'WC-1',
      fixtureType: 'Water Closet',
      manufacturer: 'KOHLER',
      model: 'K-3999',
      quantity: 4,
      location: 'RESTROOM 101',
      roughInHeight: '15"',
      carrierRequired: true,
      adaCompliant: true,
      flushType: 'Sensor',
      gpmGpf: '1.28 GPF',
      connectionSize: '3"',
      notes: 'Wall-mounted ADA compliant',
    },
    {
      fixtureTag: 'LAV-1',
      fixtureType: 'Lavatory',
      manufacturer: 'AMERICAN STANDARD',
      model: 'AS-2064',
      quantity: 4,
      location: 'RESTROOM 101',
      roughInHeight: '34"',
      carrierRequired: false,
      adaCompliant: true,
      gpmGpf: '1.5 GPM',
      connectionSize: '1-1/4"',
    },
    {
      fixtureTag: 'URN-1',
      fixtureType: 'Urinal',
      manufacturer: 'SLOAN',
      model: 'SU-1009',
      quantity: 2,
      adaCompliant: false,
      flushType: 'Manual',
      gpmGpf: '0.5 GPF',
    },
    {
      fixtureTag: 'FD-1',
      fixtureType: 'Floor Drain',
      manufacturer: 'ZURN',
      model: 'Z415',
      quantity: 6,
      location: 'KITCHEN',
      connectionSize: '4"',
      notes: 'Stainless steel grate',
    },
  ],
}));

// Mock OpenAI
const mockOpenAI = vi.hoisted(() => ({
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockOpenAIResponse.fixtures),
            },
          },
        ],
      }),
    },
  },
}));

vi.mock('openai', () => ({
  default: vi.fn(() => mockOpenAI),
}));

// Mock Prisma
const prismaMock = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('extractPlumbingFixtures', () => {
  const mockChunks = [
    {
      id: 'chunk-1',
      content: 'PLUMBING FIXTURE SCHEDULE\nWC-1 - WATER CLOSET - KOHLER K-3999 - QTY: 4',
      pageNumber: 1,
      documentId: 'doc-1',
    },
    {
      id: 'chunk-2',
      content: 'LAV-1 - LAVATORY - AMERICAN STANDARD AS-2064 - QTY: 4',
      pageNumber: 2,
      documentId: 'doc-1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue(mockChunks);
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockOpenAIResponse.fixtures),
          },
        },
      ],
    });
  });

  it('should extract plumbing fixtures from project documents', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    const result = await extractPlumbingFixtures('project-1');

    expect(result).not.toBeNull();
    expect(result?.fixtures).toHaveLength(4);
    expect(result?.projectId).toBe('project-1');
  });

  it('should query for plumbing-related content in chunks', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    await extractPlumbingFixtures('project-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: 'project-1',
        OR: expect.arrayContaining([
          { content: { contains: 'PLUMBING FIXTURE SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'FIXTURE SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'P-1', mode: 'insensitive' } },
          { content: { contains: 'LAVATORY', mode: 'insensitive' } },
          { content: { contains: 'WATER CLOSET', mode: 'insensitive' } },
        ]),
      }),
      orderBy: { pageNumber: 'asc' },
      take: 20,
    });
  });

  it('should filter by documentId when provided', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    await extractPlumbingFixtures('project-1', 'doc-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: 'project-1',
        documentId: 'doc-1',
      }),
      orderBy: { pageNumber: 'asc' },
      take: 20,
    });
  });

  it('should return null when no plumbing content found', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await extractPlumbingFixtures('project-1');

    expect(result).toBeNull();
  });

  it('should add IDs to extracted fixtures', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    const result = await extractPlumbingFixtures('project-1');

    result?.fixtures.forEach((fixture, idx) => {
      expect(fixture.id).toBe(`plumb-project-1-${idx}`);
    });
  });

  it('should set default quantity to 1 if not provided', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { fixtureTag: 'P-1', fixtureType: 'Sink' },
            ]),
          },
        },
      ],
    });

    const result = await extractPlumbingFixtures('project-1');

    expect(result?.fixtures[0].quantity).toBe(1);
  });

  it('should set default fixtureType to Unknown if not provided', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { fixtureTag: 'P-1', quantity: 2 },
            ]),
          },
        },
      ],
    });

    const result = await extractPlumbingFixtures('project-1');

    expect(result?.fixtures[0].fixtureType).toBe('Unknown');
  });

  it('should calculate total fixtures correctly', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    const result = await extractPlumbingFixtures('project-1');

    // 4 WC + 4 LAV + 2 URN + 6 FD = 16 total
    expect(result?.totalFixtures).toBe(16);
  });

  it('should group fixtures by type in byType summary', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    const result = await extractPlumbingFixtures('project-1');

    expect(result?.byType).toMatchObject({
      'Water Closet': 4,
      'Lavatory': 4,
      'Urinal': 2,
      'Floor Drain': 6,
    });
  });

  it('should include documentId when provided', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    const result = await extractPlumbingFixtures('project-1', 'doc-1');

    expect(result?.documentId).toBe('doc-1');
  });

  it('should include extraction timestamp', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    const result = await extractPlumbingFixtures('project-1');

    expect(result?.extractedAt).toBeInstanceOf(Date);
  });

  it('should preserve all fixture properties', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    const result = await extractPlumbingFixtures('project-1');

    const wcFixture = result?.fixtures[0];
    expect(wcFixture).toMatchObject({
      fixtureTag: 'WC-1',
      fixtureType: 'Water Closet',
      manufacturer: 'KOHLER',
      model: 'K-3999',
      quantity: 4,
      location: 'RESTROOM 101',
      roughInHeight: '15"',
      carrierRequired: true,
      adaCompliant: true,
      flushType: 'Sensor',
      gpmGpf: '1.28 GPF',
      connectionSize: '3"',
      notes: 'Wall-mounted ADA compliant',
    });
  });

  it('should handle markdown code blocks in LLM response', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '```json\n' + JSON.stringify(mockOpenAIResponse.fixtures) + '\n```',
          },
        },
      ],
    });

    const result = await extractPlumbingFixtures('project-1');

    expect(result?.fixtures).toHaveLength(4);
  });

  it('should handle LLM errors gracefully', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API error'));

    const result = await extractPlumbingFixtures('project-1');

    expect(result).toBeNull();
  });

  it('should handle invalid JSON response', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'Invalid JSON response',
          },
        },
      ],
    });

    const result = await extractPlumbingFixtures('project-1');

    expect(result).toBeNull();
  });

  it('should handle empty LLM response', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '',
          },
        },
      ],
    });

    const result = await extractPlumbingFixtures('project-1');

    // Empty content falls back to '[]', so it returns empty fixtures
    expect(result?.fixtures).toHaveLength(0);
    expect(result?.totalFixtures).toBe(0);
  });

  it('should handle missing message in LLM response', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [{}],
    });

    const result = await extractPlumbingFixtures('project-1');

    // Should parse empty array
    expect(result?.fixtures).toHaveLength(0);
  });

  it('should combine content from multiple chunks', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    await extractPlumbingFixtures('project-1');

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: expect.stringContaining('PLUMBING FIXTURE SCHEDULE'),
        },
      ],
      temperature: 0.1,
    });

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;
    expect(prompt).toContain(mockChunks[0].content);
    expect(prompt).toContain(mockChunks[1].content);
  });

  it('should use low temperature for consistent extraction', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');
    await extractPlumbingFixtures('project-1');

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.1,
      })
    );
  });

  it('should request LLM extraction with structured prompt', async () => {
    const { extractPlumbingFixtures } = await import('@/lib/plumbing-fixture-extractor');

    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue(mockChunks);

    await extractPlumbingFixtures('project-1');

    // Verify the LLM was called with the right parameters
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Extract ALL plumbing fixtures'),
        }),
      ]),
      temperature: 0.1,
    });
  });
});

describe('getPlumbingFixtureContext', () => {
  const mockProject = {
    id: 'project-1',
    slug: 'test-project',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue(mockProject);
    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'PLUMBING FIXTURE SCHEDULE\nWC-1 - WATER CLOSET',
        pageNumber: 1,
      },
    ]);
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockOpenAIResponse.fixtures),
          },
        },
      ],
    });
  });

  it('should return null when project not found', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    prismaMock.project.findUnique.mockResolvedValue(null);

    const context = await getPlumbingFixtureContext('nonexistent');

    expect(context).toBeNull();
  });

  it('should find project by slug', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    await getPlumbingFixtureContext('test-project');

    expect(prismaMock.project.findUnique).toHaveBeenCalledWith({
      where: { slug: 'test-project' },
      select: { id: true },
    });
  });

  it('should return null when no fixtures found', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toBeNull();
  });

  it('should include total fixtures count in context', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('PLUMBING FIXTURE SCHEDULE');
    expect(context).toContain('16 total fixtures'); // Sum of all quantities
  });

  it('should group fixtures by type', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('WATER CLOSET (4 total)');
    expect(context).toContain('LAVATORY (4 total)');
    expect(context).toContain('URINAL (2 total)');
    expect(context).toContain('FLOOR DRAIN (6 total)');
  });

  it('should include fixture tag and manufacturer in context', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('WC-1: KOHLER K-3999');
    expect(context).toContain('LAV-1: AMERICAN STANDARD AS-2064');
  });

  it('should include quantity for each fixture', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('(Qty: 4)');
    expect(context).toContain('(Qty: 2)');
    expect(context).toContain('(Qty: 6)');
  });

  it('should include ADA compliance marker', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('[ADA]');
  });

  it('should include GPM/GPF when available', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('[1.28 GPF]');
    expect(context).toContain('[1.5 GPM]');
    expect(context).toContain('[0.5 GPF]');
  });

  it('should include location when available', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('@ RESTROOM 101');
    expect(context).toContain('@ KITCHEN');
  });

  it('should handle fixtures without manufacturer', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                fixtureTag: 'P-1',
                fixtureType: 'Sink',
                quantity: 1,
              },
            ]),
          },
        },
      ],
    });

    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('P-1:   (Qty: 1)');
  });

  it('should handle fixtures without model', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                fixtureTag: 'P-1',
                fixtureType: 'Sink',
                manufacturer: 'KOHLER',
                quantity: 1,
              },
            ]),
          },
        },
      ],
    });

    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('P-1: KOHLER  (Qty: 1)');
  });

  it('should handle errors gracefully', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    prismaMock.project.findUnique.mockRejectedValueOnce(new Error('Database error'));

    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toBeNull();
  });

  it('should uppercase fixture type in section headers', async () => {
    const { getPlumbingFixtureContext } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                fixtureTag: 'P-1',
                fixtureType: 'water closet',
                quantity: 1,
              },
            ]),
          },
        },
      ],
    });

    const context = await getPlumbingFixtureContext('test-project');

    expect(context).toContain('WATER CLOSET (1 total)');
  });
});

describe('getPlumbingRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'PLUMBING FIXTURE SCHEDULE',
        pageNumber: 1,
      },
    ]);
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockOpenAIResponse.fixtures),
          },
        },
      ],
    });
  });

  it('should return empty array when no fixtures found', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await getPlumbingRequirements('project-1');

    expect(result.fixtures).toEqual([]);
  });

  it('should format fixtures for submittal requirements', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    const result = await getPlumbingRequirements('project-1');

    expect(result.fixtures).toHaveLength(4);
    expect(result.fixtures[0]).toMatchObject({
      productName: 'Water Closet - K-3999',
      manufacturer: 'KOHLER',
      model: 'K-3999',
      requiredQty: 4,
      unit: 'EA',
      specSection: '22 40 00',
      tradeCategory: 'plumbing',
      linkedSourceType: 'plumbing_schedule',
      linkedSourceIds: expect.arrayContaining(['plumb-project-1-0']),
    });
  });

  it('should use fixture type as product name when no model', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                fixtureTag: 'P-1',
                fixtureType: 'Sink',
                quantity: 1,
              },
            ]),
          },
        },
      ],
    });

    const result = await getPlumbingRequirements('project-1');

    expect(result.fixtures[0].productName).toBe('Sink');
  });

  it('should set unit to EA for all fixtures', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    const result = await getPlumbingRequirements('project-1');

    result.fixtures.forEach(fixture => {
      expect(fixture.unit).toBe('EA');
    });
  });

  it('should set spec section to 22 40 00 (Plumbing Fixtures)', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    const result = await getPlumbingRequirements('project-1');

    result.fixtures.forEach(fixture => {
      expect(fixture.specSection).toBe('22 40 00');
    });
  });

  it('should set trade category to plumbing', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    const result = await getPlumbingRequirements('project-1');

    result.fixtures.forEach(fixture => {
      expect(fixture.tradeCategory).toBe('plumbing');
    });
  });

  it('should set linked source type to plumbing_schedule', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    const result = await getPlumbingRequirements('project-1');

    result.fixtures.forEach(fixture => {
      expect(fixture.linkedSourceType).toBe('plumbing_schedule');
    });
  });

  it('should include fixture ID in linkedSourceIds', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    const result = await getPlumbingRequirements('project-1');

    result.fixtures.forEach((fixture, idx) => {
      expect(fixture.linkedSourceIds).toEqual([`plumb-project-1-${idx}`]);
    });
  });

  it('should preserve manufacturer and model when available', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    const result = await getPlumbingRequirements('project-1');

    const wcFixture = result.fixtures[0];
    expect(wcFixture.manufacturer).toBe('KOHLER');
    expect(wcFixture.model).toBe('K-3999');
  });

  it('should handle fixtures without manufacturer or model', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                fixtureTag: 'P-1',
                fixtureType: 'Sink',
                quantity: 1,
              },
            ]),
          },
        },
      ],
    });

    const result = await getPlumbingRequirements('project-1');

    expect(result.fixtures[0].manufacturer).toBeUndefined();
    expect(result.fixtures[0].model).toBeUndefined();
  });

  it('should use quantity from fixture', async () => {
    const { getPlumbingRequirements } = await import('@/lib/plumbing-fixture-extractor');
    const result = await getPlumbingRequirements('project-1');

    expect(result.fixtures[0].requiredQty).toBe(4); // WC-1
    expect(result.fixtures[1].requiredQty).toBe(4); // LAV-1
    expect(result.fixtures[2].requiredQty).toBe(2); // URN-1
    expect(result.fixtures[3].requiredQty).toBe(6); // FD-1
  });
});
