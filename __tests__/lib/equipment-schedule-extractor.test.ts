import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock OpenAI responses for different equipment types
const mockMechanicalEquipmentResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify([
          {
            equipmentTag: 'AHU-1',
            equipmentType: 'Air Handling Unit',
            manufacturer: 'TRANE',
            model: 'TAM240A300BA',
            capacity: '10000',
            capacityUnit: 'CFM',
            voltage: '480V',
            phase: '3PH',
            motorHP: 15,
            refrigerant: 'R-410A',
            heatingType: 'Hot Water',
            heatingCapacity: '100 MBH',
            coolingCapacity: '40 Tons',
            efficiency: 'IEER 14.0',
            controls: 'BACnet',
            location: 'ROOF',
            servedArea: 'FLOORS 1-3',
            quantity: 1,
            notes: 'VARIABLE VOLUME',
          },
          {
            equipmentTag: 'RTU-1',
            equipmentType: 'Rooftop Unit',
            manufacturer: 'CARRIER',
            model: '50TCQ060',
            capacity: '5',
            capacityUnit: 'Tons',
            voltage: '208-230V',
            phase: '3PH',
            motorHP: 2,
            refrigerant: 'R-410A',
            heatingType: 'Electric',
            heatingCapacity: '30 KW',
            coolingCapacity: '5 Tons',
            efficiency: 'SEER 14',
            controls: 'Modbus',
            location: 'ROOF',
            servedArea: 'LOBBY',
            quantity: 2,
          },
          {
            equipmentTag: 'FCU-1',
            equipmentType: 'Fan Coil Unit',
            manufacturer: 'YORK',
            model: 'FCH024',
            capacity: '800',
            capacityUnit: 'CFM',
            voltage: '120V',
            phase: '1PH',
            motorHP: 0.25,
            heatingType: 'Hot Water',
            controls: 'Thermostat',
            location: 'ABOVE CEILING',
            quantity: 4,
          },
        ]),
      },
    },
  ],
};

const mockDiffusersResponse = {
  choices: [
    {
      message: {
        content: JSON.stringify([
          {
            tag: 'SD-1',
            type: 'Supply Diffuser',
            manufacturer: 'PRICE',
            model: '4545',
            size: '24x24',
            cfm: 350,
            neckSize: '12"',
            finish: 'White',
            mounting: 'Ceiling',
            quantity: 25,
            notes: '4-WAY',
          },
          {
            tag: 'RG-1',
            type: 'Return Grille',
            manufacturer: 'HART & COOLEY',
            model: 'RG620',
            size: '24x12',
            cfm: 200,
            neckSize: '10"',
            finish: 'Aluminum',
            mounting: 'Wall',
            quantity: 15,
          },
          {
            tag: 'SD-2',
            type: 'Linear Slot Diffuser',
            manufacturer: 'TITUS',
            model: 'SL-2',
            size: '2x48',
            cfm: 500,
            finish: 'Custom',
            mounting: 'Ceiling',
            quantity: 8,
          },
        ]),
      },
    },
  ],
};

const mockEmptyResponse = {
  choices: [
    {
      message: {
        content: '[]',
      },
    },
  ],
};

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

describe('extractMechanicalEquipment', () => {
  const mockChunks = [
    {
      id: 'chunk-1',
      content: 'EQUIPMENT SCHEDULE\nAHU-1 - Air Handling Unit - 10,000 CFM',
      pageNumber: 1,
    },
    {
      id: 'chunk-2',
      content: 'RTU-1 - Rooftop Unit - 5 Tons - Carrier',
      pageNumber: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue(mockChunks);
    mockOpenAI.chat.completions.create.mockResolvedValue(mockMechanicalEquipmentResponse);
  });

  it('should extract mechanical equipment from chunks', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractMechanicalEquipment('project-1');

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      equipmentTag: 'AHU-1',
      equipmentType: 'Air Handling Unit',
      manufacturer: 'TRANE',
      quantity: 1,
    });
  });

  it('should search for equipment schedule chunks', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    await extractMechanicalEquipment('project-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: 'project-1',
        OR: expect.arrayContaining([
          { content: { contains: 'EQUIPMENT SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'MECHANICAL SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'HVAC SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'AHU-', mode: 'insensitive' } },
          { content: { contains: 'RTU-', mode: 'insensitive' } },
        ]),
      }),
      orderBy: { pageNumber: 'asc' },
      take: 25,
    });
  });

  it('should filter by documentId when provided', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    await extractMechanicalEquipment('project-1', 'doc-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentId: 'doc-1',
        }),
      })
    );
  });

  it('should return empty array when no chunks found', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await extractMechanicalEquipment('project-1');

    expect(result).toEqual([]);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should generate unique IDs for each equipment', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractMechanicalEquipment('project-1');

    expect(result[0].id).toBe('equip-project-1-0');
    expect(result[1].id).toBe('equip-project-1-1');
    expect(result[2].id).toBe('equip-project-1-2');
  });

  it('should set default quantity to 1 when not provided', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                equipmentTag: 'AHU-1',
                equipmentType: 'Air Handling Unit',
              },
            ]),
          },
        },
      ],
    });

    const result = await extractMechanicalEquipment('project-1');

    expect(result[0].quantity).toBe(1);
  });

  it('should combine multiple chunks into single prompt', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    await extractMechanicalEquipment('project-1');

    const createCall = mockOpenAI.chat.completions.create.mock.calls[0][0];
    expect(createCall.messages[0].content).toContain('EQUIPMENT SCHEDULE');
    expect(createCall.messages[0].content).toContain('Rooftop Unit');
  });

  it('should use claude-opus-4-6 model with low temperature', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    await extractMechanicalEquipment('project-1');

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-6',
        temperature: 0.1,
      })
    );
  });

  it('should handle markdown wrapped JSON response', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: '```json\n[{"equipmentTag":"AHU-1","equipmentType":"Air Handler","quantity":1}]\n```',
          },
        },
      ],
    });

    const result = await extractMechanicalEquipment('project-1');

    expect(result).toHaveLength(1);
    expect(result[0].equipmentTag).toBe('AHU-1');
  });

  it('should return empty array on LLM error', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));

    const result = await extractMechanicalEquipment('project-1');

    expect(result).toEqual([]);
  });

  it('should return empty array on JSON parse error', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Invalid JSON response',
          },
        },
      ],
    });

    const result = await extractMechanicalEquipment('project-1');

    expect(result).toEqual([]);
  });

  it('should extract all equipment properties', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractMechanicalEquipment('project-1');

    const equipment = result[0];
    expect(equipment.equipmentTag).toBe('AHU-1');
    expect(equipment.equipmentType).toBe('Air Handling Unit');
    expect(equipment.manufacturer).toBe('TRANE');
    expect(equipment.model).toBe('TAM240A300BA');
    expect(equipment.capacity).toBe('10000');
    expect(equipment.capacityUnit).toBe('CFM');
    expect(equipment.voltage).toBe('480V');
    expect(equipment.phase).toBe('3PH');
    expect(equipment.motorHP).toBe(15);
    expect(equipment.refrigerant).toBe('R-410A');
    expect(equipment.heatingType).toBe('Hot Water');
    expect(equipment.heatingCapacity).toBe('100 MBH');
    expect(equipment.coolingCapacity).toBe('40 Tons');
    expect(equipment.efficiency).toBe('IEER 14.0');
    expect(equipment.controls).toBe('BACnet');
    expect(equipment.location).toBe('ROOF');
    expect(equipment.servedArea).toBe('FLOORS 1-3');
    expect(equipment.notes).toBe('VARIABLE VOLUME');
  });

  it('should handle equipment with missing optional fields', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractMechanicalEquipment('project-1');

    const fcu = result[2];
    expect(fcu.equipmentTag).toBe('FCU-1');
    expect(fcu.refrigerant).toBeUndefined();
    expect(fcu.coolingCapacity).toBeUndefined();
    expect(fcu.servedArea).toBeUndefined();
  });

  it('should preserve quantity from LLM response', async () => {
    const { extractMechanicalEquipment } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractMechanicalEquipment('project-1');

    expect(result[0].quantity).toBe(1);
    expect(result[1].quantity).toBe(2);
    expect(result[2].quantity).toBe(4);
  });
});

describe('extractDiffusers', () => {
  const mockChunks = [
    {
      id: 'chunk-1',
      content: 'DIFFUSER SCHEDULE\nSD-1 - Supply Diffuser - 24x24 - 350 CFM',
      pageNumber: 1,
    },
    {
      id: 'chunk-2',
      content: 'RG-1 - Return Grille - 24x12 - 200 CFM',
      pageNumber: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue(mockChunks);
    mockOpenAI.chat.completions.create.mockResolvedValue(mockDiffusersResponse);
  });

  it('should extract diffusers from chunks', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractDiffusers('project-1');

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      tag: 'SD-1',
      type: 'Supply Diffuser',
      manufacturer: 'PRICE',
      quantity: 25,
    });
  });

  it('should search for diffuser schedule chunks', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    await extractDiffusers('project-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        projectId: 'project-1',
        OR: expect.arrayContaining([
          { content: { contains: 'DIFFUSER SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'GRILLE SCHEDULE', mode: 'insensitive' } },
          { content: { contains: 'SUPPLY DIFFUSER', mode: 'insensitive' } },
          { content: { contains: 'RETURN GRILLE', mode: 'insensitive' } },
          { content: { contains: 'AIR DEVICE', mode: 'insensitive' } },
        ]),
      }),
      orderBy: { pageNumber: 'asc' },
      take: 15,
    });
  });

  it('should filter by documentId when provided', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    await extractDiffusers('project-1', 'doc-1');

    expect(prismaMock.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentId: 'doc-1',
        }),
      })
    );
  });

  it('should return empty array when no chunks found', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    const result = await extractDiffusers('project-1');

    expect(result).toEqual([]);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should generate unique IDs for each diffuser', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractDiffusers('project-1');

    expect(result[0].id).toBe('diff-project-1-0');
    expect(result[1].id).toBe('diff-project-1-1');
    expect(result[2].id).toBe('diff-project-1-2');
  });

  it('should set default quantity to 1 when not provided', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                tag: 'SD-1',
                type: 'Supply Diffuser',
                size: '24x24',
              },
            ]),
          },
        },
      ],
    });

    const result = await extractDiffusers('project-1');

    expect(result[0].quantity).toBe(1);
  });

  it('should use claude-opus-4-6 model with low temperature', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    await extractDiffusers('project-1');

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-6',
        temperature: 0.1,
      })
    );
  });

  it('should handle markdown wrapped JSON response', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: '```json\n[{"tag":"SD-1","type":"Supply Diffuser","size":"24x24","quantity":10}]\n```',
          },
        },
      ],
    });

    const result = await extractDiffusers('project-1');

    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe('SD-1');
  });

  it('should return empty array on LLM error', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));

    const result = await extractDiffusers('project-1');

    expect(result).toEqual([]);
  });

  it('should extract all diffuser properties', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractDiffusers('project-1');

    const diffuser = result[0];
    expect(diffuser.tag).toBe('SD-1');
    expect(diffuser.type).toBe('Supply Diffuser');
    expect(diffuser.manufacturer).toBe('PRICE');
    expect(diffuser.model).toBe('4545');
    expect(diffuser.size).toBe('24x24');
    expect(diffuser.cfm).toBe(350);
    expect(diffuser.neckSize).toBe('12"');
    expect(diffuser.finish).toBe('White');
    expect(diffuser.mounting).toBe('Ceiling');
    expect(diffuser.quantity).toBe(25);
    expect(diffuser.notes).toBe('4-WAY');
  });

  it('should handle diffusers with missing optional fields', async () => {
    const { extractDiffusers } = await import('@/lib/equipment-schedule-extractor');
    const result = await extractDiffusers('project-1');

    const linearSlot = result[2];
    expect(linearSlot.tag).toBe('SD-2');
    expect(linearSlot.neckSize).toBeUndefined();
    expect(linearSlot.cfm).toBe(500);
  });
});

describe('extractEquipmentSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'EQUIPMENT SCHEDULE\nAHU-1',
        pageNumber: 1,
      },
    ]);
  });

  it('should extract both equipment and diffusers', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockDiffusersResponse);

    const result = await extractEquipmentSchedule('project-1');

    expect(result).not.toBeNull();
    expect(result!.equipment).toHaveLength(3);
    expect(result!.diffusers).toHaveLength(3);
  });

  it('should return null when no equipment or diffusers found', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockEmptyResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1');

    expect(result).toBeNull();
  });

  it('should include projectId in schedule', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1');

    expect(result!.projectId).toBe('project-1');
  });

  it('should include documentId when provided', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1', 'doc-1');

    expect(result!.documentId).toBe('doc-1');
  });

  it('should include extractedAt timestamp', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1');

    expect(result!.extractedAt).toBeInstanceOf(Date);
  });

  it('should calculate total equipment count', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1');

    // 1 + 2 + 4 = 7 units
    expect(result!.totalEquipment).toBe(7);
  });

  it('should calculate total diffusers count', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockEmptyResponse)
      .mockResolvedValueOnce(mockDiffusersResponse);

    const result = await extractEquipmentSchedule('project-1');

    // 25 + 15 + 8 = 48 units
    expect(result!.totalDiffusers).toBe(48);
  });

  it('should group equipment by type', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1');

    expect(result!.byType).toEqual({
      'Air Handling Unit': 1,
      'Rooftop Unit': 2,
      'Fan Coil Unit': 4,
    });
  });

  it('should calculate total cooling tons', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1');

    // RTU-1: 5 tons × 2 units = 10 tons
    expect(result!.totalCoolingTons).toBe(10);
  });

  it('should ignore non-ton capacity units in cooling calculation', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                equipmentTag: 'AHU-1',
                equipmentType: 'Air Handler',
                capacity: '5000',
                capacityUnit: 'CFM',
                quantity: 1,
              },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1');

    expect(result!.totalCoolingTons).toBeUndefined();
  });

  it('should handle capacity with text formatting', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                equipmentTag: 'RTU-1',
                equipmentType: 'RTU',
                capacity: '10.5 Tons',
                capacityUnit: 'Tons',
                quantity: 2,
              },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);

    const result = await extractEquipmentSchedule('project-1');

    // 10.5 × 2 = 21 tons
    expect(result!.totalCoolingTons).toBe(21);
  });

  it('should return null on error', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API error'));

    const result = await extractEquipmentSchedule('project-1');

    expect(result).toBeNull();
  });

  it('should extract equipment even if diffusers fail', async () => {
    const { extractEquipmentSchedule } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockRejectedValueOnce(new Error('Diffuser extraction failed'));

    const result = await extractEquipmentSchedule('project-1');

    expect(result).not.toBeNull();
    expect(result!.equipment).toHaveLength(3);
    expect(result!.diffusers).toHaveLength(0);
  });
});

describe('getEquipmentContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      slug: 'test-project',
    });
    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'EQUIPMENT SCHEDULE\nAHU-1',
        pageNumber: 1,
      },
    ]);
  });

  it('should return null when project not found', async () => {
    const { getEquipmentContext } = await import('@/lib/equipment-schedule-extractor');
    prismaMock.project.findUnique.mockResolvedValue(null);

    const context = await getEquipmentContext('nonexistent');

    expect(context).toBeNull();
  });

  it('should return null when no equipment found', async () => {
    const { getEquipmentContext } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockEmptyResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const context = await getEquipmentContext('test-project');

    expect(context).toBeNull();
  });

  it('should include equipment summary header', async () => {
    const { getEquipmentContext } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const context = await getEquipmentContext('test-project');

    expect(context).toContain('MECHANICAL EQUIPMENT SCHEDULE:');
    expect(context).toContain('HVAC EQUIPMENT (7 units');
    expect(context).toContain('10 total tons');
  });

  it('should list equipment with details', async () => {
    const { getEquipmentContext } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const context = await getEquipmentContext('test-project');

    expect(context).toContain('AHU-1: Air Handling Unit');
    expect(context).toContain('10000 CFM');
    expect(context).toContain('TRANE');
    expect(context).toContain('TAM240A300BA');
    expect(context).toContain('480V');
    expect(context).toContain('(serves FLOORS 1-3)');
  });

  it('should include diffusers section', async () => {
    const { getEquipmentContext } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockEmptyResponse)
      .mockResolvedValueOnce(mockDiffusersResponse);

    const context = await getEquipmentContext('test-project');

    expect(context).toContain('DIFFUSERS & GRILLES (48 total):');
    expect(context).toContain('SD-1: Supply Diffuser, 24x24 (Qty: 25)');
    expect(context).toContain('350 CFM');
    expect(context).toContain('PRICE');
  });

  it('should handle equipment without optional fields', async () => {
    const { getEquipmentContext } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                equipmentTag: 'EF-1',
                equipmentType: 'Exhaust Fan',
                quantity: 1,
              },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);

    const context = await getEquipmentContext('test-project');

    expect(context).toContain('EF-1: Exhaust Fan');
    expect(context).not.toContain('undefined');
  });

  it('should return null on database error', async () => {
    const { getEquipmentContext } = await import('@/lib/equipment-schedule-extractor');
    prismaMock.project.findUnique.mockRejectedValue(new Error('Database error'));

    const context = await getEquipmentContext('test-project');

    expect(context).toBeNull();
  });
});

describe('getEquipmentRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'EQUIPMENT SCHEDULE',
        pageNumber: 1,
      },
    ]);
  });

  it('should return empty arrays when no schedule found', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockEmptyResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment).toEqual([]);
    expect(result.diffusers).toEqual([]);
  });

  it('should format equipment as submittal requirements', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockMechanicalEquipmentResponse)
      .mockResolvedValueOnce(mockEmptyResponse);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0]).toMatchObject({
      productName: 'Air Handling Unit AHU-1 - 10000 CFM',
      manufacturer: 'TRANE',
      model: 'TAM240A300BA',
      requiredQty: 1,
      unit: 'EA',
      specSection: '23 73 00',
      tradeCategory: 'mechanical',
      linkedSourceType: 'equipment_schedule',
      linkedSourceIds: ['equip-project-1-0'],
    });
  });

  it('should format diffusers as submittal requirements', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create
      .mockResolvedValueOnce(mockEmptyResponse)
      .mockResolvedValueOnce(mockDiffusersResponse);

    const result = await getEquipmentRequirements('project-1');

    expect(result.diffusers[0]).toMatchObject({
      productName: 'Supply Diffuser - SD-1 (24x24)',
      manufacturer: 'PRICE',
      model: '4545',
      requiredQty: 25,
      unit: 'EA',
      specSection: '23 37 00',
      tradeCategory: 'mechanical',
      linkedSourceType: 'diffuser_schedule',
      linkedSourceIds: ['diff-project-1-0'],
    });
  });

  it('should handle equipment without capacity', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                equipmentTag: 'EF-1',
                equipmentType: 'Exhaust Fan',
                quantity: 1,
              },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].productName).toBe('Exhaust Fan EF-1');
  });
});

describe('getEquipmentSpecSection', () => {
  it('should return 23 73 00 for air handling units', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'AHU-1', equipmentType: 'Air Handling Unit', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 73 00');
  });

  it('should return 23 74 00 for rooftop units', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'RTU-1', equipmentType: 'Rooftop Unit', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 74 00');
  });

  it('should return 23 82 00 for fan coil units', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'FCU-1', equipmentType: 'Fan Coil Unit', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 82 00');
  });

  it('should return 23 36 00 for VAV boxes', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'VAV-1', equipmentType: 'VAV Box', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 36 00');
  });

  it('should return 23 34 00 for exhaust fans', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'EF-1', equipmentType: 'Exhaust Fan', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 34 00');
  });

  it('should return 23 21 00 for pumps', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'P-1', equipmentType: 'Chilled Water Pump', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 21 00');
  });

  it('should return 23 64 00 for chillers', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'CH-1', equipmentType: 'Chiller', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 64 00');
  });

  it('should return 23 52 00 for boilers', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'B-1', equipmentType: 'Boiler', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 52 00');
  });

  it('should return 23 81 00 for split systems', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'MS-1', equipmentType: 'Mini-Split System', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 81 00');
  });

  it('should return 23 00 00 for unknown equipment types', async () => {
    const { getEquipmentRequirements } = await import('@/lib/equipment-schedule-extractor');
    mockOpenAI.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { equipmentTag: 'X-1', equipmentType: 'Unknown Equipment', quantity: 1 },
            ]),
          },
        },
      ],
    });
    mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockEmptyResponse);
    prismaMock.documentChunk.findMany.mockResolvedValue([{ id: '1', content: 'test', pageNumber: 1 }]);

    const result = await getEquipmentRequirements('project-1');

    expect(result.equipment[0].specSection).toBe('23 00 00');
  });
});
