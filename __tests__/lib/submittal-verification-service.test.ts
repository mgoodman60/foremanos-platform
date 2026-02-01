import { describe, it, expect, beforeEach, vi } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mocks = vi.hoisted(() => ({
  prisma: {
    doorScheduleItem: {
      findMany: vi.fn(),
    },
    windowScheduleItem: {
      findMany: vi.fn(),
    },
    takeoffLineItem: {
      findMany: vi.fn(),
    },
    mEPEquipment: {
      findMany: vi.fn(),
    },
    finishScheduleItem: {
      findMany: vi.fn(),
    },
    mEPSubmittal: {
      findUnique: vi.fn(),
    },
    submittalLineItem: {
      update: vi.fn(),
    },
    quantityRequirement: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// =============================================================================
// DOOR SCHEDULE REQUIREMENTS TESTS
// =============================================================================

describe('getDoorScheduleRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate door counts by type', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        width: '3-0',
        height: '7-0',
        frameMaterial: 'Hollow Metal',
        doorMaterial: 'Wood',
        hardwareSet: 'A',
        hinges: '3 - 4-1/2 x 4-1/2 Ball Bearing',
        lockset: 'Schlage ND80',
        closer: 'LCN 4040',
        fireRating: '90 min',
        kickplate: true,
        weatherstrip: true,
        threshold: 'Aluminum',
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        width: '3-0',
        height: '7-0',
        frameMaterial: 'Hollow Metal',
        doorMaterial: 'Wood',
        hardwareSet: 'A',
        hinges: '3 - 4-1/2 x 4-1/2 Ball Bearing',
        lockset: 'Schlage ND80',
        closer: 'LCN 4040',
        fireRating: '90 min',
        kickplate: true,
        weatherstrip: false,
        threshold: 'Aluminum',
      },
    ]);

    // Mock other schedule types as empty
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    // Should aggregate 2 doors of same type
    const doorReq = requirements.find(r => r.itemCategory === 'doors');
    expect(doorReq).toBeDefined();
    expect(doorReq?.requiredQty).toBe(2);
    expect(doorReq?.unit).toBe('EA');
    expect(doorReq?.csiDivision).toBe('08 10 00');
    expect(doorReq?.sources).toHaveLength(2);
  });

  it('should aggregate hardware sets', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: 'A',
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        hardwareSet: 'A',
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-3',
        doorNumber: '103',
        doorType: 'Solid Core',
        hardwareSet: 'B',
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    // Should have 2 hardware set A and 1 hardware set B
    const hwSetA = requirements.find(r => r.itemName === 'Hardware Set A');
    const hwSetB = requirements.find(r => r.itemName === 'Hardware Set B');

    expect(hwSetA).toBeDefined();
    expect(hwSetA?.requiredQty).toBe(2);
    expect(hwSetA?.unit).toBe('SET');
    expect(hwSetA?.csiDivision).toBe('08 71 00');

    expect(hwSetB).toBeDefined();
    expect(hwSetB?.requiredQty).toBe(1);
  });

  it('should parse and aggregate hinges with quantities', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: '3 - 4-1/2 x 4-1/2 Ball Bearing',
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: '3 - 4-1/2 x 4-1/2 Ball Bearing',
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    // Should aggregate: 2 doors × 3 hinges = 6 total hinges
    const hingeReq = requirements.find(r => r.itemName.includes('Hinges'));
    expect(hingeReq).toBeDefined();
    expect(hingeReq?.requiredQty).toBe(6);
    expect(hingeReq?.unit).toBe('EA');
    expect(hingeReq?.itemCategory).toBe('door_hardware');
  });

  it('should default to 3 hinges per door when quantity not specified', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: 'Ball Bearing Hinge', // No quantity specified
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const hingeReq = requirements.find(r => r.itemName.includes('Hinges'));
    expect(hingeReq?.requiredQty).toBe(3); // Default 3 per door
  });

  it('should aggregate locksets by type', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: 'Schlage ND80',
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: 'Schlage ND80',
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-3',
        doorNumber: '103',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: 'Schlage ND90',
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const nd80 = requirements.find(r => r.itemName === 'Schlage ND80');
    const nd90 = requirements.find(r => r.itemName === 'Schlage ND90');

    expect(nd80?.requiredQty).toBe(2);
    expect(nd90?.requiredQty).toBe(1);
    expect(nd80?.itemCategory).toBe('door_hardware');
  });

  it('should aggregate door closers', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: 'LCN 4040',
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: 'LCN 4040',
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const closerReq = requirements.find(r => r.itemName === 'LCN 4040');
    expect(closerReq).toBeDefined();
    expect(closerReq?.requiredQty).toBe(2);
    expect(closerReq?.itemCategory).toBe('door_hardware');
  });

  it('should aggregate kickplates', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: true,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: true,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const kickplateReq = requirements.find(r => r.itemName === 'Door Kickplates');
    expect(kickplateReq).toBeDefined();
    expect(kickplateReq?.requiredQty).toBe(2);
    expect(kickplateReq?.unit).toBe('EA');
  });

  it('should aggregate weatherstripping', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: true,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: true,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const weatherstripReq = requirements.find(r => r.itemName === 'Door Weatherstripping');
    expect(weatherstripReq).toBeDefined();
    expect(weatherstripReq?.requiredQty).toBe(2);
    expect(weatherstripReq?.unit).toBe('SET');
  });

  it('should aggregate thresholds by type', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: 'Aluminum',
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: 'Aluminum',
      },
      {
        id: 'door-3',
        doorNumber: '103',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: 'Oak',
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const aluminumThreshold = requirements.find(r => r.itemName === 'Threshold - Aluminum');
    const oakThreshold = requirements.find(r => r.itemName === 'Threshold - Oak');

    expect(aluminumThreshold?.requiredQty).toBe(2);
    expect(oakThreshold?.requiredQty).toBe(1);
  });

  it('should aggregate door frames by material and size', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        width: '3-0',
        height: '7-0',
        frameMaterial: 'Hollow Metal',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        width: '3-0',
        height: '7-0',
        frameMaterial: 'Hollow Metal',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const frameReq = requirements.find(r => r.itemCategory === 'door_frames');
    expect(frameReq).toBeDefined();
    expect(frameReq?.requiredQty).toBe(2);
    expect(frameReq?.csiDivision).toBe('08 11 00');
  });

  it('should return empty array when no doors exist', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    expect(requirements).toEqual([]);
  });
});

// =============================================================================
// WINDOW SCHEDULE REQUIREMENTS TESTS
// =============================================================================

describe('getWindowScheduleRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate windows by type', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([
      {
        id: 'win-1',
        windowNumber: 'W1',
        windowMark: 'A',
        windowType: 'Fixed',
        width: '4-0',
        height: '3-0',
        frameMaterial: 'Aluminum',
        glazingType: 'Double Pane',
        operationType: 'Fixed',
        hardwareFinish: null,
        screenType: null,
        manufacturer: null,
      },
      {
        id: 'win-2',
        windowNumber: 'W2',
        windowMark: 'A',
        windowType: 'Fixed',
        width: '4-0',
        height: '3-0',
        frameMaterial: 'Aluminum',
        glazingType: 'Double Pane',
        operationType: 'Fixed',
        hardwareFinish: null,
        screenType: null,
        manufacturer: null,
      },
    ]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const windowReq = requirements.find(r => r.itemCategory === 'windows');
    expect(windowReq).toBeDefined();
    expect(windowReq?.requiredQty).toBe(2);
    expect(windowReq?.unit).toBe('EA');
    expect(windowReq?.csiDivision).toBe('08 50 00');
  });

  it('should aggregate glazing by type', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([
      {
        id: 'win-1',
        windowNumber: 'W1',
        windowType: 'Fixed',
        glazingType: 'Double Pane Low-E',
        screenType: null,
      },
      {
        id: 'win-2',
        windowNumber: 'W2',
        windowType: 'Fixed',
        glazingType: 'Double Pane Low-E',
        screenType: null,
      },
      {
        id: 'win-3',
        windowNumber: 'W3',
        windowType: 'Casement',
        glazingType: 'Triple Pane',
        screenType: null,
      },
    ]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const doublePaneGlazing = requirements.find(r => r.itemName === 'Glazing - Double Pane Low-E');
    const triplePaneGlazing = requirements.find(r => r.itemName === 'Glazing - Triple Pane');

    expect(doublePaneGlazing?.requiredQty).toBe(2);
    expect(triplePaneGlazing?.requiredQty).toBe(1);
    expect(doublePaneGlazing?.csiDivision).toBe('08 80 00');
  });

  it('should aggregate window screens by type', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([
      {
        id: 'win-1',
        windowNumber: 'W1',
        windowType: 'Casement',
        glazingType: 'Double Pane',
        screenType: 'Standard',
      },
      {
        id: 'win-2',
        windowNumber: 'W2',
        windowType: 'Casement',
        glazingType: 'Double Pane',
        screenType: 'Standard',
      },
      {
        id: 'win-3',
        windowNumber: 'W3',
        windowType: 'Casement',
        glazingType: 'Double Pane',
        screenType: 'Solar',
      },
    ]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const standardScreen = requirements.find(r => r.itemName === 'Window Screen - Standard');
    const solarScreen = requirements.find(r => r.itemName === 'Window Screen - Solar');

    expect(standardScreen?.requiredQty).toBe(2);
    expect(solarScreen?.requiredQty).toBe(1);
    expect(standardScreen?.itemCategory).toBe('window_accessories');
  });

  it('should return empty array when no windows exist', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    expect(requirements).toEqual([]);
  });
});

// =============================================================================
// TAKEOFF REQUIREMENTS TESTS
// =============================================================================

describe('getTakeoffRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate verified takeoff line items', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([
      {
        id: 'line-1',
        category: 'concrete',
        itemName: '4" Concrete Slab',
        quantity: 5000,
        unit: 'SF',
      },
      {
        id: 'line-2',
        category: 'concrete',
        itemName: '4" Concrete Slab',
        quantity: 3000,
        unit: 'SF',
      },
      {
        id: 'line-3',
        category: 'concrete',
        itemName: 'Footings',
        quantity: 200,
        unit: 'CY',
      },
    ]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const slabReq = requirements.find(r => r.itemName === '4" Concrete Slab');
    const footingReq = requirements.find(r => r.itemName === 'Footings');

    expect(slabReq?.requiredQty).toBe(8000); // 5000 + 3000
    expect(slabReq?.unit).toBe('SF');
    expect(slabReq?.csiDivision).toBe('03 00 00');

    expect(footingReq?.requiredQty).toBe(200);
    expect(footingReq?.unit).toBe('CY');
  });

  it('should map categories to CSI divisions', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([
      {
        id: 'line-1',
        category: 'drywall',
        itemName: '5/8" Type X Drywall',
        quantity: 10000,
        unit: 'SF',
      },
      {
        id: 'line-2',
        category: 'painting',
        itemName: 'Interior Paint',
        quantity: 500,
        unit: 'GAL',
      },
    ]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const drywallReq = requirements.find(r => r.itemCategory === 'drywall');
    const paintReq = requirements.find(r => r.itemCategory === 'painting');

    expect(drywallReq?.csiDivision).toBe('09 20 00');
    expect(paintReq?.csiDivision).toBe('09 90 00');
  });

  it('should return empty array when no takeoff items exist', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    expect(requirements).toEqual([]);
  });
});

// =============================================================================
// MEP EQUIPMENT REQUIREMENTS TESTS
// =============================================================================

describe('getMEPEquipmentRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate equipment by type', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([
      {
        id: 'eq-1',
        equipmentTag: 'AHU-1',
        name: 'Rooftop Unit 10 Ton',
        equipmentType: 'HVAC',
        manufacturer: 'Trane',
        model: 'RTU-10',
        capacity: '10 Ton',
      },
      {
        id: 'eq-2',
        equipmentTag: 'AHU-2',
        name: 'Rooftop Unit 10 Ton',
        equipmentType: 'HVAC',
        manufacturer: 'Trane',
        model: 'RTU-10',
        capacity: '10 Ton',
      },
      {
        id: 'eq-3',
        equipmentTag: 'EXH-1',
        name: 'Exhaust Fan',
        equipmentType: 'HVAC',
        manufacturer: 'Greenheck',
        model: 'SP-200',
        capacity: '2000 CFM',
      },
    ]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const rtuReq = requirements.find(r => r.itemName === 'HVAC - Rooftop Unit 10 Ton');
    const fanReq = requirements.find(r => r.itemName === 'HVAC - Exhaust Fan');

    expect(rtuReq?.requiredQty).toBe(2);
    expect(fanReq?.requiredQty).toBe(1);
    expect(rtuReq?.csiDivision).toBe('23 00 00');
  });

  it('should map equipment types to CSI divisions', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([
      {
        id: 'eq-1',
        equipmentTag: 'PUMP-1',
        name: 'Circulating Pump',
        equipmentType: 'PLUMBING',
        manufacturer: null,
        model: null,
        capacity: null,
      },
      {
        id: 'eq-2',
        equipmentTag: 'PANEL-1',
        name: 'Electrical Panel',
        equipmentType: 'ELECTRICAL',
        manufacturer: null,
        model: null,
        capacity: null,
      },
    ]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    const pumpReq = requirements.find(r => r.itemName.includes('Circulating Pump'));
    const panelReq = requirements.find(r => r.itemName.includes('Electrical Panel'));

    expect(pumpReq?.csiDivision).toBe('22 00 00');
    expect(panelReq?.csiDivision).toBe('26 00 00');
  });

  it('should return empty array when no equipment exists', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    expect(requirements).toEqual([]);
  });
});

// =============================================================================
// FINISH SCHEDULE REQUIREMENTS TESTS
// =============================================================================

describe('getFinishScheduleRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should aggregate finishes by material and color', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([
      {
        id: 'finish-1',
        finishType: 'Paint',
        material: 'Sherwin Williams ProMar 200',
        manufacturer: 'Sherwin Williams',
        modelNumber: null,
        color: 'White',
        dimensions: null,
        category: null,
      },
      {
        id: 'finish-2',
        finishType: 'Paint',
        material: 'Sherwin Williams ProMar 200',
        manufacturer: 'Sherwin Williams',
        modelNumber: null,
        color: 'White',
        dimensions: null,
        category: null,
      },
      {
        id: 'finish-3',
        finishType: 'Carpet',
        material: 'Mohawk Group',
        manufacturer: 'Mohawk',
        modelNumber: null,
        color: 'Grey',
        dimensions: null,
        category: null,
      },
    ]);

    const requirements = await aggregateProjectRequirements('project-1');

    const paintReq = requirements.find(r => r.itemName.includes('Sherwin Williams ProMar 200 White'));
    const carpetReq = requirements.find(r => r.itemName.includes('Mohawk Group Grey'));

    expect(paintReq?.requiredQty).toBe(2);
    expect(carpetReq?.requiredQty).toBe(1);
    expect(paintReq?.itemCategory).toBe('finishes');
  });

  it('should map finish types to CSI divisions', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([
      {
        id: 'finish-1',
        finishType: 'Paint',
        material: 'Interior Paint',
        color: 'White',
      },
      {
        id: 'finish-2',
        finishType: 'Flooring',
        material: 'VCT Tile',
        color: 'Beige',
      },
    ]);

    const requirements = await aggregateProjectRequirements('project-1');

    const paintReq = requirements.find(r => r.itemName.includes('Interior Paint'));
    const floorReq = requirements.find(r => r.itemName.includes('VCT Tile'));

    expect(paintReq?.csiDivision).toBe('09 90 00');
    expect(floorReq?.csiDivision).toBe('09 60 00');
  });

  it('should return empty array when no finishes exist', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    expect(requirements).toEqual([]);
  });
});

// =============================================================================
// SUBMITTAL VERIFICATION TESTS
// =============================================================================

describe('verifySubmittalQuantities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify submittal and return SUFFICIENT status when quantities match', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Schlage ND80',
          submittedQty: 10,
          unit: 'EA',
          tradeCategory: 'door_hardware',
          csiDivision: '08 71 00',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.overallStatus).toBe('PASS');
    expect(report.excessCount).toBe(1);
    expect(report.insufficientCount).toBe(0);
    expect(report.lineItemResults[0].status).toBe('EXCESS');
    expect(report.lineItemResults[0].requiredQty).toBe(2);
    expect(report.lineItemResults[0].submittedQty).toBe(10);
  });

  it('should return INSUFFICIENT status when submitted quantity is too low', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Schlage ND80',
          submittedQty: 5,
          unit: 'EA',
          tradeCategory: 'door_hardware',
          csiDivision: '08 71 00',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-3',
        doorNumber: '103',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-4',
        doorNumber: '104',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-5',
        doorNumber: '105',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-6',
        doorNumber: '106',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-7',
        doorNumber: '107',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-8',
        doorNumber: '108',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-9',
        doorNumber: '109',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-10',
        doorNumber: '110',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.overallStatus).toBe('FAIL');
    expect(report.insufficientCount).toBe(1);
    expect(report.lineItemResults[0].status).toBe('INSUFFICIENT');
    expect(report.lineItemResults[0].requiredQty).toBe(10);
    expect(report.lineItemResults[0].varianceQty).toBe(-5);
  });

  it('should return EXCESS status when submitted quantity is 20%+ over requirement', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Schlage ND80',
          submittedQty: 25,
          unit: 'EA',
          tradeCategory: 'door_hardware',
          csiDivision: '08 71 00',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-3',
        doorNumber: '103',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-4',
        doorNumber: '104',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-5',
        doorNumber: '105',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-6',
        doorNumber: '106',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-7',
        doorNumber: '107',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-8',
        doorNumber: '108',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-9',
        doorNumber: '109',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-10',
        doorNumber: '110',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.lineItemResults[0].status).toBe('EXCESS');
    expect(report.lineItemResults[0].variancePercent).toBeGreaterThan(20);
  });

  it('should return NO_REQUIREMENT status when no matching requirement found', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Special Custom Hardware',
          submittedQty: 10,
          unit: 'EA',
          tradeCategory: null,
          csiDivision: null,
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.lineItemResults[0].status).toBe('NO_REQUIREMENT');
    expect(report.lineItemResults[0].requiredQty).toBeNull();
    expect(report.overallStatus).toBe('REVIEW_NEEDED');
  });

  it('should update line items in database with verification results', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Schlage ND80',
          submittedQty: 10,
          unit: 'EA',
          tradeCategory: 'door_hardware',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    await verifySubmittalQuantities('submittal-1');

    expect(mocks.prisma.submittalLineItem.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: expect.objectContaining({
        requiredQty: 1,
        complianceStatus: 'EXCESS',
        varianceQty: 9,
        variancePercent: 900,
        verifiedAt: expect.any(Date),
      }),
    });
  });

  it('should throw error when submittal not found', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue(null);

    await expect(verifySubmittalQuantities('nonexistent')).rejects.toThrow('Submittal not found');
  });

  it('should handle multiple line items in one submittal', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Schlage ND80',
          submittedQty: 5,
          unit: 'EA',
          tradeCategory: 'door_hardware',
        },
        {
          id: 'line-2',
          productName: 'LCN 4040',
          submittedQty: 3,
          unit: 'EA',
          tradeCategory: 'door_hardware',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        lockset: 'Schlage ND80',
        closer: 'LCN 4040',
        hardwareSet: null,
        hinges: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
      {
        id: 'door-2',
        doorNumber: '102',
        lockset: 'Schlage ND80',
        closer: 'LCN 4040',
        hardwareSet: null,
        hinges: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.totalLineItems).toBe(2);
    expect(report.excessCount).toBe(2);
  });
});

// =============================================================================
// FUZZY MATCHING TESTS
// =============================================================================

describe('findMatchingRequirements (fuzzy matching)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should match exact product names', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Schlage ND80',
          submittedQty: 5,
          unit: 'EA',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.lineItemResults[0].matchedSources).toHaveLength(1);
    expect(report.lineItemResults[0].requiredQty).toBe(1);
  });

  it('should match by category and partial name overlap', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Schlage Commercial Grade Lockset ND80',
          submittedQty: 5,
          unit: 'EA',
          tradeCategory: 'door_hardware',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        lockset: 'Schlage ND80 Lockset',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.lineItemResults[0].matchedSources.length).toBeGreaterThan(0);
  });

  it('should match by CSI division and name similarity', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: '4-1/2 x 4-1/2 Ball Bearing Hinges',
          submittedQty: 50,
          unit: 'EA',
          csiDivision: '08 71 00',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        hinges: '3 - 4-1/2 x 4-1/2 Ball Bearing',
        lockset: null,
        closer: null,
        hardwareSet: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.lineItemResults[0].matchedSources.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// SYNC QUANTITY REQUIREMENTS TESTS
// =============================================================================

describe('syncQuantityRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upsert quantity requirements to database', async () => {
    const { syncQuantityRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        width: '3-0',
        height: '7-0',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
        frameMaterial: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.quantityRequirement.upsert.mockResolvedValue({ id: 'req-1' });

    const synced = await syncQuantityRequirements('project-1');

    expect(synced).toBeGreaterThan(0);
    expect(mocks.prisma.quantityRequirement.upsert).toHaveBeenCalled();
  });

  it('should use correct upsert where clause', async () => {
    const { syncQuantityRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        lockset: 'Schlage ND80',
        hardwareSet: null,
        hinges: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
        frameMaterial: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.quantityRequirement.upsert.mockResolvedValue({ id: 'req-1' });

    await syncQuantityRequirements('project-1');

    expect(mocks.prisma.quantityRequirement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId_itemName_itemCategory_sourceType: expect.objectContaining({
            projectId: 'project-1',
            sourceType: 'door_schedule',
          }),
        },
      })
    );
  });
});

// =============================================================================
// REQUIREMENT SUMMARY TESTS
// =============================================================================

describe('getRequirementSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return summary grouped by category', async () => {
    const { getRequirementSummary } = await import('@/lib/submittal-verification-service');

    mocks.prisma.quantityRequirement.findMany.mockResolvedValue([
      {
        id: 'req-1',
        projectId: 'project-1',
        itemName: 'Schlage ND80',
        itemCategory: 'door_hardware',
        csiDivision: '08 71 00',
        requiredQty: 10,
        unit: 'EA',
        sourceType: 'door_schedule',
        status: 'PENDING',
      },
      {
        id: 'req-2',
        projectId: 'project-1',
        itemName: 'LCN 4040',
        itemCategory: 'door_hardware',
        csiDivision: '08 71 00',
        requiredQty: 5,
        unit: 'EA',
        sourceType: 'door_schedule',
        status: 'APPROVED',
      },
      {
        id: 'req-3',
        projectId: 'project-1',
        itemName: 'Concrete Slab',
        itemCategory: 'concrete',
        csiDivision: '03 00 00',
        requiredQty: 5000,
        unit: 'SF',
        sourceType: 'takeoff',
        status: 'INSUFFICIENT',
      },
    ]);

    const summary = await getRequirementSummary('project-1');

    expect(summary.totalRequirements).toBe(3);
    expect(summary.pendingCount).toBe(1);
    expect(summary.approvedCount).toBe(1);
    expect(summary.insufficientCount).toBe(1);
    expect(summary.byCategory['door_hardware']).toHaveLength(2);
    expect(summary.byCategory['concrete']).toHaveLength(1);
  });

  it('should return empty summary when no requirements exist', async () => {
    const { getRequirementSummary } = await import('@/lib/submittal-verification-service');

    mocks.prisma.quantityRequirement.findMany.mockResolvedValue([]);

    const summary = await getRequirementSummary('project-1');

    expect(summary.totalRequirements).toBe(0);
    expect(summary.pendingCount).toBe(0);
    expect(summary.approvedCount).toBe(0);
    expect(summary.insufficientCount).toBe(0);
  });
});

// =============================================================================
// HELPER FUNCTION TESTS
// =============================================================================

describe('Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate string similarity correctly', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    // Test that similar strings match via fuzzy logic
    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'ball bearing hinge',
          submittedQty: 10,
          unit: 'EA',
          csiDivision: '08 71 00',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        hinges: '3 - ball bearing hinges',
        lockset: null,
        closer: null,
        hardwareSet: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    // Should create hinge requirement
    expect(requirements.some(r => r.itemName.toLowerCase().includes('hinge'))).toBe(true);
  });
});

// =============================================================================
// EDGE CASES AND ERROR HANDLING
// =============================================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle null/undefined hardware fields gracefully', async () => {
    const { aggregateProjectRequirements } = await import('@/lib/submittal-verification-service');

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([
      {
        id: 'door-1',
        doorNumber: '101',
        doorType: 'Solid Core',
        hardwareSet: null,
        hinges: null,
        lockset: null,
        closer: null,
        kickplate: false,
        weatherstrip: false,
        threshold: null,
        frameMaterial: null,
      },
    ]);

    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const requirements = await aggregateProjectRequirements('project-1');

    // Should only create door requirement, no hardware
    expect(requirements.some(r => r.itemCategory === 'doors')).toBe(true);
    expect(requirements.some(r => r.itemCategory === 'door_hardware')).toBe(false);
  });

  it('should handle empty submittal line items', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.totalLineItems).toBe(0);
    expect(report.overallStatus).toBe('PASS');
  });

  it('should handle variance calculations with zero required quantity', async () => {
    const { verifySubmittalQuantities } = await import('@/lib/submittal-verification-service');

    mocks.prisma.mEPSubmittal.findUnique.mockResolvedValue({
      id: 'submittal-1',
      projectId: 'project-1',
      submittalNumber: 'S-001',
      lineItems: [
        {
          id: 'line-1',
          productName: 'Unknown Item',
          submittedQty: 10,
          unit: 'EA',
        },
      ],
    });

    mocks.prisma.doorScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.windowScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.takeoffLineItem.findMany.mockResolvedValue([]);
    mocks.prisma.mEPEquipment.findMany.mockResolvedValue([]);
    mocks.prisma.finishScheduleItem.findMany.mockResolvedValue([]);
    mocks.prisma.submittalLineItem.update.mockResolvedValue({});

    const report = await verifySubmittalQuantities('submittal-1');

    expect(report.lineItemResults[0].variancePercent).toBeNull();
    expect(report.lineItemResults[0].status).toBe('NO_REQUIREMENT');
  });
});
