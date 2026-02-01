import { describe, it, expect, beforeEach, vi } from 'vitest';

// =============================================================================
// MOCKS
// =============================================================================

const mocks = vi.hoisted(() => ({
  prisma: {
    verificationToleranceSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    mEPSubmittal: {
      findMany: vi.fn(),
    },
  },
  verifySubmittalQuantities: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// Mock the submittal verification service to avoid circular dependency
vi.mock('@/lib/submittal-verification-service', () => ({
  verifySubmittalQuantities: mocks.verifySubmittalQuantities,
}));

// =============================================================================
// GET TOLERANCE SETTINGS TESTS
// =============================================================================

describe('getToleranceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return default tolerance when no settings exist', async () => {
    const { getToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue(null);

    const settings = await getToleranceSettings('project-1');

    expect(settings).toEqual({
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {},
    });
  });

  it('should return stored tolerance settings when they exist', async () => {
    const { getToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 5,
      shortageAbsolute: 10,
      excessPercent: 20,
      excessAbsolute: 50,
      autoReverifyEnabled: false,
      reverifyOnRequirementChange: false,
      reverifyOnSubmittalChange: true,
      tradeTolerances: { electrical: { shortagePercent: 10 } },
      updatedBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const settings = await getToleranceSettings('project-1');

    expect(settings.shortagePercent).toBe(5);
    expect(settings.shortageAbsolute).toBe(10);
    expect(settings.excessPercent).toBe(20);
    expect(settings.excessAbsolute).toBe(50);
    expect(settings.autoReverifyEnabled).toBe(false);
    expect(settings.reverifyOnRequirementChange).toBe(false);
    expect(settings.reverifyOnSubmittalChange).toBe(true);
    expect(settings.tradeTolerances).toEqual({ electrical: { shortagePercent: 10 } });
  });

  it('should handle null tradeTolerances field', async () => {
    const { getToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 5,
      shortageAbsolute: 10,
      excessPercent: 20,
      excessAbsolute: 50,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: null,
      updatedBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const settings = await getToleranceSettings('project-1');

    expect(settings.tradeTolerances).toEqual({});
  });

  it('should call prisma with correct projectId', async () => {
    const { getToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue(null);

    await getToleranceSettings('project-abc-123');

    expect(mocks.prisma.verificationToleranceSettings.findUnique).toHaveBeenCalledWith({
      where: { projectId: 'project-abc-123' },
    });
  });
});

// =============================================================================
// SAVE TOLERANCE SETTINGS TESTS
// =============================================================================

describe('saveToleranceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new settings with defaults for missing fields', async () => {
    const { saveToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});

    await saveToleranceSettings('project-1', { shortagePercent: 10 }, 'user-1');

    expect(mocks.prisma.verificationToleranceSettings.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: {
        projectId: 'project-1',
        shortagePercent: 10,
        shortageAbsolute: 0,
        excessPercent: 100,
        excessAbsolute: 100,
        autoReverifyEnabled: true,
        reverifyOnRequirementChange: true,
        reverifyOnSubmittalChange: true,
        tradeTolerances: {},
        updatedBy: 'user-1',
      },
      update: {
        shortagePercent: 10,
        updatedBy: 'user-1',
      },
    });
  });

  it('should update existing settings with partial data', async () => {
    const { saveToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});

    await saveToleranceSettings(
      'project-1',
      {
        excessPercent: 30,
        autoReverifyEnabled: false,
      },
      'user-2'
    );

    expect(mocks.prisma.verificationToleranceSettings.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: {
        projectId: 'project-1',
        shortagePercent: 0,
        shortageAbsolute: 0,
        excessPercent: 30,
        excessAbsolute: 100,
        autoReverifyEnabled: false,
        reverifyOnRequirementChange: true,
        reverifyOnSubmittalChange: true,
        tradeTolerances: {},
        updatedBy: 'user-2',
      },
      update: {
        excessPercent: 30,
        autoReverifyEnabled: false,
        updatedBy: 'user-2',
      },
    });
  });

  it('should handle all settings fields', async () => {
    const { saveToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});

    await saveToleranceSettings(
      'project-1',
      {
        shortagePercent: 5,
        shortageAbsolute: 15,
        excessPercent: 25,
        excessAbsolute: 75,
        autoReverifyEnabled: false,
        reverifyOnRequirementChange: false,
        reverifyOnSubmittalChange: false,
        tradeTolerances: { plumbing: { excessPercent: 15 } },
      },
      'user-3'
    );

    expect(mocks.prisma.verificationToleranceSettings.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: {
        projectId: 'project-1',
        shortagePercent: 5,
        shortageAbsolute: 15,
        excessPercent: 25,
        excessAbsolute: 75,
        autoReverifyEnabled: false,
        reverifyOnRequirementChange: false,
        reverifyOnSubmittalChange: false,
        tradeTolerances: { plumbing: { excessPercent: 15 } },
        updatedBy: 'user-3',
      },
      update: {
        shortagePercent: 5,
        shortageAbsolute: 15,
        excessPercent: 25,
        excessAbsolute: 75,
        autoReverifyEnabled: false,
        reverifyOnRequirementChange: false,
        reverifyOnSubmittalChange: false,
        tradeTolerances: { plumbing: { excessPercent: 15 } },
        updatedBy: 'user-3',
      },
    });
  });

  it('should handle save without updatedBy user', async () => {
    const { saveToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});

    await saveToleranceSettings('project-1', { shortagePercent: 7 });

    expect(mocks.prisma.verificationToleranceSettings.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: expect.objectContaining({
        updatedBy: undefined,
      }),
      update: expect.objectContaining({
        updatedBy: undefined,
      }),
    });
  });

  it('should not include undefined fields in update', async () => {
    const { saveToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});

    await saveToleranceSettings('project-1', { shortagePercent: 5 }, 'user-1');

    const updateCall = mocks.prisma.verificationToleranceSettings.upsert.mock.calls[0][0];
    expect(updateCall.update).not.toHaveProperty('shortageAbsolute');
    expect(updateCall.update).not.toHaveProperty('excessPercent');
  });

  it('should handle zero values correctly', async () => {
    const { saveToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});

    await saveToleranceSettings(
      'project-1',
      {
        shortagePercent: 0,
        excessAbsolute: 0,
      },
      'user-1'
    );

    expect(mocks.prisma.verificationToleranceSettings.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: expect.objectContaining({
        shortagePercent: 0,
        excessAbsolute: 0,
      }),
      update: {
        shortagePercent: 0,
        excessAbsolute: 0,
        updatedBy: 'user-1',
      },
    });
  });

  it('should handle boolean false values correctly', async () => {
    const { saveToleranceSettings } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});

    await saveToleranceSettings(
      'project-1',
      {
        autoReverifyEnabled: false,
        reverifyOnRequirementChange: false,
        reverifyOnSubmittalChange: false,
      },
      'user-1'
    );

    expect(mocks.prisma.verificationToleranceSettings.upsert).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      create: expect.objectContaining({
        autoReverifyEnabled: false,
        reverifyOnRequirementChange: false,
        reverifyOnSubmittalChange: false,
      }),
      update: {
        autoReverifyEnabled: false,
        reverifyOnRequirementChange: false,
        reverifyOnSubmittalChange: false,
        updatedBy: 'user-1',
      },
    });
  });
});

// =============================================================================
// APPLY TOLERANCE TESTS
// =============================================================================

describe('applyTolerance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultTolerance = {
    shortagePercent: 0,
    shortageAbsolute: 0,
    excessPercent: 100,
    excessAbsolute: 100,
    autoReverifyEnabled: true,
    reverifyOnRequirementChange: true,
    reverifyOnSubmittalChange: true,
    tradeTolerances: {},
  };

  describe('NO_REQUIREMENT cases', () => {
    it('should return NO_REQUIREMENT when required is zero', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const status = applyTolerance(100, 0, defaultTolerance);

      expect(status).toBe('NO_REQUIREMENT');
    });

    it('should return NO_REQUIREMENT when required is negative', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const status = applyTolerance(50, -10, defaultTolerance);

      expect(status).toBe('NO_REQUIREMENT');
    });
  });

  describe('SUFFICIENT cases', () => {
    it('should return SUFFICIENT when quantities match exactly', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const status = applyTolerance(100, 100, defaultTolerance);

      expect(status).toBe('SUFFICIENT');
    });

    it('should return SUFFICIENT when submitted is within shortage percent tolerance', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 10, // Allow 10% shortage
      };

      // 95 submitted vs 100 required = 5% under (within 10% tolerance)
      const status = applyTolerance(95, 100, tolerance);

      expect(status).toBe('SUFFICIENT');
    });

    it('should return SUFFICIENT when submitted is within shortage absolute tolerance', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortageAbsolute: 10, // Allow 10 units shortage
      };

      // 92 submitted vs 100 required = 8 units under (within 10 unit tolerance)
      const status = applyTolerance(92, 100, tolerance);

      expect(status).toBe('SUFFICIENT');
    });

    it('should return SUFFICIENT when submitted exceeds but within excess threshold', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        excessPercent: 20,
        excessAbsolute: 30,
      };

      // 110 submitted vs 100 required = 10% over (within 20% threshold)
      const status = applyTolerance(110, 100, tolerance);

      expect(status).toBe('SUFFICIENT');
    });

    it('should use OR logic for shortage tolerance (either percent OR absolute)', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 5, // 5% tolerance
        shortageAbsolute: 3, // 3 units tolerance
      };

      // 98 submitted vs 100 required = 2% under and 2 units under
      // Both within their respective tolerances
      const status = applyTolerance(98, 100, tolerance);

      expect(status).toBe('SUFFICIENT');
    });
  });

  describe('INSUFFICIENT cases', () => {
    it('should return INSUFFICIENT when submitted is below required with no tolerance', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const status = applyTolerance(90, 100, defaultTolerance);

      expect(status).toBe('INSUFFICIENT');
    });

    it('should return INSUFFICIENT when shortage exceeds percent tolerance', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 5, // Allow 5% shortage
      };

      // 90 submitted vs 100 required = 10% under (exceeds 5% tolerance)
      const status = applyTolerance(90, 100, tolerance);

      expect(status).toBe('INSUFFICIENT');
    });

    it('should return INSUFFICIENT when shortage exceeds absolute tolerance', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortageAbsolute: 5, // Allow 5 units shortage
      };

      // 90 submitted vs 100 required = 10 units under (exceeds 5 unit tolerance)
      const status = applyTolerance(90, 100, tolerance);

      expect(status).toBe('INSUFFICIENT');
    });

    it('should return INSUFFICIENT when both percent and absolute tolerances are exceeded', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 3,
        shortageAbsolute: 2,
      };

      // 90 submitted vs 100 required = 10% under and 10 units under
      // Both exceed their tolerances
      const status = applyTolerance(90, 100, tolerance);

      expect(status).toBe('INSUFFICIENT');
    });
  });

  describe('EXCESS cases', () => {
    it('should return EXCESS when submitted exceeds both percent and absolute thresholds', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        excessPercent: 10, // 10% excess threshold
        excessAbsolute: 5, // 5 units excess threshold
      };

      // 150 submitted vs 100 required = 50% over and 50 units over
      // Exceeds both thresholds
      const status = applyTolerance(150, 100, tolerance);

      expect(status).toBe('EXCESS');
    });

    it('should return SUFFICIENT when excess percent exceeded but absolute not exceeded', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        excessPercent: 10,
        excessAbsolute: 100, // High absolute threshold
      };

      // 120 submitted vs 100 required = 20% over but only 20 units over
      // Percent exceeded but absolute not exceeded (requires BOTH for EXCESS)
      const status = applyTolerance(120, 100, tolerance);

      expect(status).toBe('SUFFICIENT');
    });

    it('should return SUFFICIENT when excess absolute exceeded but percent not exceeded', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        excessPercent: 200, // High percent threshold
        excessAbsolute: 5,
      };

      // 110 submitted vs 100 required = 10% over and 10 units over
      // Absolute exceeded but percent not exceeded (requires BOTH for EXCESS)
      const status = applyTolerance(110, 100, tolerance);

      expect(status).toBe('SUFFICIENT');
    });
  });

  describe('Trade-specific tolerances', () => {
    it('should use trade-specific shortage percent when available', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 5,
        tradeTolerances: {
          electrical: { shortagePercent: 15 },
        },
      };

      // 90 submitted vs 100 required = 10% under
      // Would fail with 5% tolerance but passes with 15% electrical tolerance
      const status = applyTolerance(90, 100, tolerance, 'electrical');

      expect(status).toBe('SUFFICIENT');
    });

    it('should use trade-specific shortage absolute when available', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortageAbsolute: 3,
        tradeTolerances: {
          plumbing: { shortageAbsolute: 12 },
        },
      };

      // 90 submitted vs 100 required = 10 units under
      // Would fail with 3 unit tolerance but passes with 12 unit plumbing tolerance
      const status = applyTolerance(90, 100, tolerance, 'plumbing');

      expect(status).toBe('SUFFICIENT');
    });

    it('should use trade-specific excess thresholds when available', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        excessPercent: 100,
        excessAbsolute: 100,
        tradeTolerances: {
          hvac: { excessPercent: 10, excessAbsolute: 5 },
        },
      };

      // 120 submitted vs 100 required = 20% over and 20 units over
      // Would pass with default but fails with stricter HVAC thresholds
      const status = applyTolerance(120, 100, tolerance, 'hvac');

      expect(status).toBe('EXCESS');
    });

    it('should fall back to default tolerance when trade not found', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 5,
        tradeTolerances: {
          electrical: { shortagePercent: 15 },
        },
      };

      // 92 submitted vs 100 required = 8% under
      // Uses default 5% (fails), not electrical 15%
      const status = applyTolerance(92, 100, tolerance, 'plumbing');

      expect(status).toBe('INSUFFICIENT');
    });

    it('should partially use trade tolerance when only some values specified', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 5,
        shortageAbsolute: 10,
        tradeTolerances: {
          electrical: { shortagePercent: 15 }, // Only percent specified
        },
      };

      // 92 submitted vs 100 required = 8% under and 8 units under
      // Uses electrical 15% for percent, default 10 for absolute
      const status = applyTolerance(92, 100, tolerance, 'electrical');

      expect(status).toBe('SUFFICIENT');
    });
  });

  describe('Edge cases', () => {
    it('should handle very small quantities', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 10,
      };

      // 9 submitted vs 10 required = 10% under (at threshold)
      const status = applyTolerance(9, 10, tolerance);

      expect(status).toBe('SUFFICIENT');
    });

    it('should handle very large quantities', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        excessPercent: 10,
        excessAbsolute: 1000,
      };

      // 11001 submitted vs 10000 required = 10.01% over and 1001 units over
      // Both exceed thresholds (requires BOTH > for EXCESS)
      const status = applyTolerance(11001, 10000, tolerance);

      expect(status).toBe('EXCESS');
    });

    it('should handle decimal quantities', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const tolerance = {
        ...defaultTolerance,
        shortagePercent: 5,
      };

      // 9.6 submitted vs 10.0 required = 4% under
      const status = applyTolerance(9.6, 10.0, tolerance);

      expect(status).toBe('SUFFICIENT');
    });

    it('should handle zero submitted with positive required', async () => {
      const { applyTolerance } = await import('@/lib/tolerance-service');

      const status = applyTolerance(0, 100, defaultTolerance);

      expect(status).toBe('INSUFFICIENT');
    });
  });
});

// =============================================================================
// TRIGGER AUTO-REVERIFY TESTS
// =============================================================================

describe('triggerAutoReverify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not trigger when auto-reverify is disabled', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: false,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await triggerAutoReverify('project-1', 'submittal-1', 'requirement_change');

    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('Auto-reverify disabled');
    expect(mocks.verifySubmittalQuantities).not.toHaveBeenCalled();
  });

  it('should not trigger on requirement change when reverifyOnRequirementChange is disabled', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: false,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await triggerAutoReverify('project-1', 'submittal-1', 'requirement_change');

    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('Reverify on requirement change disabled');
    expect(mocks.verifySubmittalQuantities).not.toHaveBeenCalled();
  });

  it('should not trigger on submittal change when reverifyOnSubmittalChange is disabled', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: false,
      tradeTolerances: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await triggerAutoReverify('project-1', 'submittal-1', 'submittal_change');

    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('Reverify on submittal change disabled');
    expect(mocks.verifySubmittalQuantities).not.toHaveBeenCalled();
  });

  it('should trigger single submittal reverification when submittalId provided', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mocks.verifySubmittalQuantities.mockResolvedValue({});

    const result = await triggerAutoReverify('project-1', 'submittal-123', 'requirement_change');

    expect(result.triggered).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(mocks.verifySubmittalQuantities).toHaveBeenCalledWith('submittal-123');
    expect(mocks.verifySubmittalQuantities).toHaveBeenCalledTimes(1);
  });

  it('should trigger bulk reverification when submittalId is null', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mocks.prisma.mEPSubmittal.findMany.mockResolvedValue([
      { id: 'submittal-1' },
      { id: 'submittal-2' },
      { id: 'submittal-3' },
    ]);

    mocks.verifySubmittalQuantities.mockResolvedValue({});

    const result = await triggerAutoReverify('project-1', null, 'requirement_change');

    expect(result.triggered).toBe(true);
    expect(mocks.prisma.mEPSubmittal.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        lineItems: { some: {} },
      },
      select: { id: true },
    });
    expect(mocks.verifySubmittalQuantities).toHaveBeenCalledTimes(3);
    expect(mocks.verifySubmittalQuantities).toHaveBeenCalledWith('submittal-1');
    expect(mocks.verifySubmittalQuantities).toHaveBeenCalledWith('submittal-2');
    expect(mocks.verifySubmittalQuantities).toHaveBeenCalledWith('submittal-3');
  });

  it('should trigger for submittal_change reason', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mocks.verifySubmittalQuantities.mockResolvedValue({});

    const result = await triggerAutoReverify('project-1', 'submittal-456', 'submittal_change');

    expect(result.triggered).toBe(true);
    expect(mocks.verifySubmittalQuantities).toHaveBeenCalledWith('submittal-456');
  });

  it('should handle empty submittals array in bulk reverification', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mocks.prisma.mEPSubmittal.findMany.mockResolvedValue([]);

    const result = await triggerAutoReverify('project-1', null, 'requirement_change');

    expect(result.triggered).toBe(true);
    expect(mocks.verifySubmittalQuantities).not.toHaveBeenCalled();
  });

  it('should use default settings when no settings exist', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue(null);
    mocks.verifySubmittalQuantities.mockResolvedValue({});

    const result = await triggerAutoReverify('project-1', 'submittal-789', 'requirement_change');

    // Default settings have autoReverifyEnabled: true and reverifyOnRequirementChange: true
    expect(result.triggered).toBe(true);
    expect(mocks.verifySubmittalQuantities).toHaveBeenCalledWith('submittal-789');
  });

  it('should handle verification errors gracefully', async () => {
    const { triggerAutoReverify } = await import('@/lib/tolerance-service');

    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 0,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {},
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mocks.verifySubmittalQuantities.mockRejectedValue(new Error('Verification failed'));

    await expect(
      triggerAutoReverify('project-1', 'submittal-error', 'requirement_change')
    ).rejects.toThrow('Verification failed');
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle complete workflow: get settings, apply tolerance, save settings', async () => {
    const { getToleranceSettings, applyTolerance, saveToleranceSettings } = await import(
      '@/lib/tolerance-service'
    );

    // Step 1: Get default settings
    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue(null);
    const settings = await getToleranceSettings('project-1');

    expect(settings.shortagePercent).toBe(0);

    // Step 2: Apply tolerance with default settings
    const status = applyTolerance(95, 100, settings);
    expect(status).toBe('INSUFFICIENT');

    // Step 3: Update settings to be more lenient
    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});
    await saveToleranceSettings('project-1', { shortagePercent: 10 }, 'user-1');

    // Step 4: Apply tolerance with new settings
    const newSettings = { ...settings, shortagePercent: 10 };
    const newStatus = applyTolerance(95, 100, newSettings);
    expect(newStatus).toBe('SUFFICIENT');
  });

  it('should handle trade-specific tolerance workflow', async () => {
    const { getToleranceSettings, applyTolerance, saveToleranceSettings } = await import(
      '@/lib/tolerance-service'
    );

    // Save trade-specific tolerances
    mocks.prisma.verificationToleranceSettings.upsert.mockResolvedValue({});
    await saveToleranceSettings(
      'project-1',
      {
        shortagePercent: 5,
        tradeTolerances: {
          electrical: { shortagePercent: 15 },
          plumbing: { shortagePercent: 10, excessAbsolute: 20 },
        },
      },
      'user-1'
    );

    // Retrieve and apply
    mocks.prisma.verificationToleranceSettings.findUnique.mockResolvedValue({
      id: 'settings-1',
      projectId: 'project-1',
      shortagePercent: 5,
      shortageAbsolute: 0,
      excessPercent: 100,
      excessAbsolute: 100,
      autoReverifyEnabled: true,
      reverifyOnRequirementChange: true,
      reverifyOnSubmittalChange: true,
      tradeTolerances: {
        electrical: { shortagePercent: 15 },
        plumbing: { shortagePercent: 10, excessAbsolute: 20 },
      },
      updatedBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const settings = await getToleranceSettings('project-1');

    // 90 submitted vs 100 required = 10% under
    expect(applyTolerance(90, 100, settings)).toBe('INSUFFICIENT'); // Default 5%
    expect(applyTolerance(90, 100, settings, 'electrical')).toBe('SUFFICIENT'); // Electrical 15%
    expect(applyTolerance(90, 100, settings, 'plumbing')).toBe('SUFFICIENT'); // Plumbing 10%
  });
});
