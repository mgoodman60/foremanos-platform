import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma before imports
const prismaMock = {
  takeoffFeedback: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  takeoffCorrection: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  takeoffLineItem: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  takeoffLearningPattern: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('TakeoffLearningService - submitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should submit feedback successfully', async () => {
    const { submitFeedback } = await import('@/lib/takeoff-learning-service');

    const mockFeedback = {
      id: 'feedback-1',
      takeoffId: 'takeoff-1',
      userId: 'user-1',
      feedbackType: 'helpful',
      rating: 5,
      createdAt: new Date(),
    };

    prismaMock.takeoffFeedback.create.mockResolvedValue(mockFeedback);

    const result = await submitFeedback({
      takeoffId: 'takeoff-1',
      userId: 'user-1',
      feedbackType: 'helpful',
      rating: 5,
      comment: 'Great accuracy!',
    });

    expect(result.success).toBe(true);
    expect(result.feedbackId).toBe('feedback-1');
    expect(prismaMock.takeoffFeedback.create).toHaveBeenCalledWith({
      data: {
        takeoffId: 'takeoff-1',
        lineItemId: null,
        userId: 'user-1',
        feedbackType: 'helpful',
        rating: 5,
        comment: 'Great accuracy!',
        context: undefined,
      },
    });
  });

  it('should submit feedback with lineItemId', async () => {
    const { submitFeedback } = await import('@/lib/takeoff-learning-service');

    const mockFeedback = {
      id: 'feedback-2',
      takeoffId: 'takeoff-1',
      lineItemId: 'item-1',
      userId: 'user-1',
      feedbackType: 'wrong_quantity',
      createdAt: new Date(),
    };

    prismaMock.takeoffFeedback.create.mockResolvedValue(mockFeedback);
    prismaMock.takeoffFeedback.findMany.mockResolvedValue([mockFeedback]);

    const result = await submitFeedback({
      takeoffId: 'takeoff-1',
      lineItemId: 'item-1',
      userId: 'user-1',
      feedbackType: 'wrong_quantity',
    });

    expect(result.success).toBe(true);
    expect(result.feedbackId).toBe('feedback-2');
  });

  it('should submit feedback with context object', async () => {
    const { submitFeedback } = await import('@/lib/takeoff-learning-service');

    const mockFeedback = { id: 'feedback-3' };
    prismaMock.takeoffFeedback.create.mockResolvedValue(mockFeedback);

    const context = { page: 5, section: 'concrete' };
    await submitFeedback({
      takeoffId: 'takeoff-1',
      userId: 'user-1',
      feedbackType: 'accuracy',
      context,
    });

    expect(prismaMock.takeoffFeedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        context: context,
      }),
    });
  });

  it('should trigger pattern analysis for negative feedback types', async () => {
    const { submitFeedback } = await import('@/lib/takeoff-learning-service');

    const mockFeedback = { id: 'feedback-4', feedbackType: 'wrong_quantity' };
    prismaMock.takeoffFeedback.create.mockResolvedValue(mockFeedback);
    prismaMock.takeoffFeedback.findMany.mockResolvedValue([mockFeedback, mockFeedback, mockFeedback]);

    await submitFeedback({
      takeoffId: 'takeoff-1',
      userId: 'user-1',
      feedbackType: 'wrong_quantity',
    });

    expect(prismaMock.takeoffFeedback.findMany).toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    const { submitFeedback } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.create.mockRejectedValue(new Error('Database error'));

    const result = await submitFeedback({
      takeoffId: 'takeoff-1',
      userId: 'user-1',
      feedbackType: 'helpful',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database error');
  });
});

describe('TakeoffLearningService - submitCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should submit correction successfully', async () => {
    const { submitCorrection } = await import('@/lib/takeoff-learning-service');

    const mockLineItem = {
      id: 'item-1',
      itemName: 'Concrete',
      category: 'concrete',
      quantity: 100,
    };

    const mockCorrection = {
      id: 'correction-1',
      takeoffId: 'takeoff-1',
      lineItemId: 'item-1',
      userId: 'user-1',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '105',
    };

    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffCorrection.create.mockResolvedValue(mockCorrection);

    const result = await submitCorrection({
      takeoffId: 'takeoff-1',
      lineItemId: 'item-1',
      userId: 'user-1',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '105',
      reason: 'Measurement error',
    });

    expect(result.success).toBe(true);
    expect(result.correctionId).toBe('correction-1');
    expect(prismaMock.takeoffCorrection.create).toHaveBeenCalledWith({
      data: {
        takeoffId: 'takeoff-1',
        lineItemId: 'item-1',
        userId: 'user-1',
        fieldName: 'quantity',
        originalValue: '100',
        correctedValue: '105',
        reason: 'Measurement error',
      },
    });
  });

  it('should submit correction without reason', async () => {
    const { submitCorrection } = await import('@/lib/takeoff-learning-service');

    const mockLineItem = { id: 'item-1' };
    const mockCorrection = { id: 'correction-2' };

    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffCorrection.create.mockResolvedValue(mockCorrection);

    const result = await submitCorrection({
      takeoffId: 'takeoff-1',
      lineItemId: 'item-1',
      userId: 'user-1',
      fieldName: 'unit',
      originalValue: 'SF',
      correctedValue: 'SY',
    });

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffCorrection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: null,
      }),
    });
  });

  it('should return error when line item not found', async () => {
    const { submitCorrection } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(null);

    const result = await submitCorrection({
      takeoffId: 'takeoff-1',
      lineItemId: 'invalid-item',
      userId: 'user-1',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '105',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Line item not found');
  });

  it('should handle database errors', async () => {
    const { submitCorrection } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLineItem.findUnique.mockRejectedValue(new Error('Database connection lost'));

    const result = await submitCorrection({
      takeoffId: 'takeoff-1',
      lineItemId: 'item-1',
      userId: 'user-1',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '105',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database connection lost');
  });
});

describe('TakeoffLearningService - applyCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply quantity correction successfully', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-1',
      lineItemId: 'item-1',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '105',
    };

    const mockLineItem = {
      id: 'item-1',
      itemName: 'Concrete',
      category: 'concrete',
      quantity: 100,
    };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffLineItem.update.mockResolvedValue({ ...mockLineItem, quantity: 105 });
    prismaMock.takeoffCorrection.update.mockResolvedValue({ ...mockCorrection, approved: true });

    const result = await applyCorrection('correction-1', 'user-1', false);

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 105 },
    });
    expect(prismaMock.takeoffCorrection.update).toHaveBeenCalledWith({
      where: { id: 'correction-1' },
      data: {
        approved: true,
        approvedBy: 'user-1',
        approvedAt: expect.any(Date),
      },
    });
  });

  it('should apply unit correction successfully', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-2',
      lineItemId: 'item-1',
      fieldName: 'unit',
      originalValue: 'SF',
      correctedValue: 'SY',
    };

    const mockLineItem = { id: 'item-1', unit: 'SF' };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffLineItem.update.mockResolvedValue({ ...mockLineItem, unit: 'SY' });
    prismaMock.takeoffCorrection.update.mockResolvedValue({ ...mockCorrection, approved: true });

    const result = await applyCorrection('correction-2', 'user-1', false);

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { unit: 'SY' },
    });
  });

  it('should apply category correction successfully', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-3',
      lineItemId: 'item-1',
      fieldName: 'category',
      originalValue: 'concrete',
      correctedValue: 'structural_steel',
    };

    const mockLineItem = { id: 'item-1', category: 'concrete' };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffLineItem.update.mockResolvedValue(mockLineItem);
    prismaMock.takeoffCorrection.update.mockResolvedValue({ ...mockCorrection, approved: true });

    const result = await applyCorrection('correction-3', 'user-1', false);

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { category: 'structural_steel' },
    });
  });

  it('should apply itemName correction successfully', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-4',
      lineItemId: 'item-1',
      fieldName: 'itemName',
      originalValue: 'Old Name',
      correctedValue: 'New Name',
    };

    const mockLineItem = { id: 'item-1', itemName: 'Old Name' };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffLineItem.update.mockResolvedValue(mockLineItem);
    prismaMock.takeoffCorrection.update.mockResolvedValue({ ...mockCorrection, approved: true });

    const result = await applyCorrection('correction-4', 'user-1', false);

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { itemName: 'New Name' },
    });
  });

  it('should apply unitCost correction successfully', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-5',
      lineItemId: 'item-1',
      fieldName: 'unitCost',
      originalValue: '10.50',
      correctedValue: '12.75',
    };

    const mockLineItem = { id: 'item-1', unitCost: 10.50 };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffLineItem.update.mockResolvedValue(mockLineItem);
    prismaMock.takeoffCorrection.update.mockResolvedValue({ ...mockCorrection, approved: true });

    const result = await applyCorrection('correction-5', 'user-1', false);

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { unitCost: 12.75 },
    });
  });

  it('should create learning pattern when requested', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-6',
      lineItemId: 'item-1',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '110',
    };

    const mockLineItem = {
      id: 'item-1',
      itemName: 'Concrete Slab',
      category: 'concrete',
      quantity: 100,
    };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffLineItem.update.mockResolvedValue(mockLineItem);
    prismaMock.takeoffCorrection.update.mockResolvedValue({ ...mockCorrection, approved: true });
    prismaMock.takeoffLearningPattern.findFirst.mockResolvedValue(null);
    prismaMock.takeoffLearningPattern.create.mockResolvedValue({ id: 'pattern-1' });

    const result = await applyCorrection('correction-6', 'user-1', true);

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLearningPattern.create).toHaveBeenCalledWith({
      data: {
        projectId: null,
        category: 'concrete',
        patternType: 'quantity_adjustment',
        patternKey: 'concrete_slab',
        patternValue: { adjustmentFactor: 1.1, sampleSize: 1 },
        confidence: 0.6,
        usageCount: 1,
        source: 'user_correction',
      },
    });
  });

  it('should update existing learning pattern', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-7',
      lineItemId: 'item-1',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '110',
    };

    const mockLineItem = {
      id: 'item-1',
      itemName: 'Concrete Slab',
      category: 'concrete',
      quantity: 100,
    };

    const existingPattern = {
      id: 'pattern-1',
      category: 'concrete',
      patternType: 'quantity_adjustment',
      patternKey: 'concrete_slab',
      patternValue: { adjustmentFactor: 1.05, sampleSize: 5 },
      confidence: 0.75,
      usageCount: 5,
    };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffLineItem.update.mockResolvedValue(mockLineItem);
    prismaMock.takeoffCorrection.update.mockResolvedValue({ ...mockCorrection, approved: true });
    prismaMock.takeoffLearningPattern.findFirst.mockResolvedValue(existingPattern);
    prismaMock.takeoffLearningPattern.update.mockResolvedValue({ ...existingPattern, usageCount: 6 });

    const result = await applyCorrection('correction-7', 'user-1', true);

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLearningPattern.update).toHaveBeenCalledWith({
      where: { id: 'pattern-1' },
      data: {
        patternValue: { adjustmentFactor: 1.1, sampleSize: 6 },
        usageCount: 6,
        confidence: 0.8,
        lastUsed: expect.any(Date),
      },
    });
  });

  it('should not create pattern for zero original value', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-8',
      lineItemId: 'item-1',
      fieldName: 'quantity',
      originalValue: '0',
      correctedValue: '100',
    };

    const mockLineItem = { id: 'item-1', itemName: 'Test', category: 'concrete' };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(mockLineItem);
    prismaMock.takeoffLineItem.update.mockResolvedValue(mockLineItem);
    prismaMock.takeoffCorrection.update.mockResolvedValue({ ...mockCorrection, approved: true });

    const result = await applyCorrection('correction-8', 'user-1', true);

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLearningPattern.create).not.toHaveBeenCalled();
  });

  it('should return error when correction not found', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(null);

    const result = await applyCorrection('invalid-correction', 'user-1', false);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Correction not found');
  });

  it('should return error when line item not found', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    const mockCorrection = {
      id: 'correction-9',
      lineItemId: 'invalid-item',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '105',
    };

    prismaMock.takeoffCorrection.findUnique.mockResolvedValue(mockCorrection);
    prismaMock.takeoffLineItem.findUnique.mockResolvedValue(null);

    const result = await applyCorrection('correction-9', 'user-1', false);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Line item not found');
  });

  it('should handle database errors', async () => {
    const { applyCorrection } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffCorrection.findUnique.mockRejectedValue(new Error('Database error'));

    const result = await applyCorrection('correction-1', 'user-1', false);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database error');
  });
});

describe('TakeoffLearningService - getLearningStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return learning stats for specific takeoff', async () => {
    const { getLearningStats } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.groupBy.mockResolvedValue([
      { feedbackType: 'helpful', _count: { id: 10 } },
      { feedbackType: 'wrong_quantity', _count: { id: 3 } },
    ]);

    prismaMock.takeoffCorrection.groupBy.mockResolvedValue([
      { fieldName: 'quantity', _count: { id: 5 } },
      { fieldName: 'unit', _count: { id: 2 } },
    ]);

    prismaMock.takeoffFeedback.count.mockResolvedValue(13);
    prismaMock.takeoffCorrection.count
      .mockResolvedValueOnce(7) // totalCorrections
      .mockResolvedValueOnce(5) // approvedCorrections
      .mockResolvedValueOnce(2); // pendingCorrections

    prismaMock.takeoffFeedback.aggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
    });

    prismaMock.takeoffLearningPattern.groupBy.mockResolvedValue([
      { category: 'concrete', _count: { id: 5 } },
      { category: 'rebar', _count: { id: 3 } },
    ]);

    prismaMock.takeoffLearningPattern.count.mockResolvedValue(8);

    prismaMock.takeoffFeedback.findMany.mockResolvedValue([
      {
        createdAt: new Date('2024-01-15'),
        rating: 5,
      },
      {
        createdAt: new Date('2024-01-15'),
        rating: 4,
      },
    ]);

    const stats = await getLearningStats('takeoff-1');

    expect(stats.totalFeedback).toBe(13);
    expect(stats.totalCorrections).toBe(7);
    expect(stats.approvedCorrections).toBe(5);
    expect(stats.pendingCorrections).toBe(2);
    expect(stats.averageRating).toBe(4.5);
    expect(stats.feedbackByType).toEqual({
      helpful: 10,
      wrong_quantity: 3,
    });
    expect(stats.correctionsByField).toEqual({
      quantity: 5,
      unit: 2,
    });
    expect(stats.learnedPatterns).toBe(8);
    expect(stats.patternsByCategory).toEqual({
      concrete: 5,
      rebar: 3,
    });
    expect(stats.accuracyTrend).toHaveLength(1);
  });

  it('should return learning stats for all takeoffs', async () => {
    const { getLearningStats } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.groupBy.mockResolvedValue([]);
    prismaMock.takeoffCorrection.groupBy.mockResolvedValue([]);
    prismaMock.takeoffFeedback.count.mockResolvedValue(50);
    prismaMock.takeoffCorrection.count
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(5);
    prismaMock.takeoffFeedback.aggregate.mockResolvedValue({ _avg: { rating: 4.2 } });
    prismaMock.takeoffLearningPattern.groupBy.mockResolvedValue([]);
    prismaMock.takeoffLearningPattern.count.mockResolvedValue(15);
    prismaMock.takeoffFeedback.findMany.mockResolvedValue([]);

    const stats = await getLearningStats();

    expect(stats.totalFeedback).toBe(50);
    expect(stats.totalCorrections).toBe(30);
    expect(stats.learnedPatterns).toBe(15);
  });

  it('should calculate accuracy trend correctly', async () => {
    const { getLearningStats } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.groupBy.mockResolvedValue([]);
    prismaMock.takeoffCorrection.groupBy.mockResolvedValue([]);
    prismaMock.takeoffFeedback.count.mockResolvedValue(10);
    prismaMock.takeoffCorrection.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    prismaMock.takeoffFeedback.aggregate.mockResolvedValue({ _avg: { rating: 4.0 } });
    prismaMock.takeoffLearningPattern.groupBy.mockResolvedValue([]);
    prismaMock.takeoffLearningPattern.count.mockResolvedValue(5);

    const date1 = new Date('2024-01-15');
    const date2 = new Date('2024-01-16');

    prismaMock.takeoffFeedback.findMany.mockResolvedValue([
      { createdAt: date1, rating: 5 },
      { createdAt: date1, rating: 4 },
      { createdAt: date2, rating: 3 },
    ]);

    const stats = await getLearningStats('takeoff-1');

    expect(stats.accuracyTrend).toHaveLength(2);
    expect(stats.accuracyTrend[0].date).toBe('2024-01-15');
    expect(stats.accuracyTrend[0].accuracy).toBe(90); // (5+4)/2 * 20 = 90
    expect(stats.accuracyTrend[1].date).toBe('2024-01-16');
    expect(stats.accuracyTrend[1].accuracy).toBe(60); // 3 * 20 = 60
  });

  it('should handle null average rating', async () => {
    const { getLearningStats } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.groupBy.mockResolvedValue([]);
    prismaMock.takeoffCorrection.groupBy.mockResolvedValue([]);
    prismaMock.takeoffFeedback.count.mockResolvedValue(0);
    prismaMock.takeoffCorrection.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    prismaMock.takeoffFeedback.aggregate.mockResolvedValue({ _avg: { rating: null } });
    prismaMock.takeoffLearningPattern.groupBy.mockResolvedValue([]);
    prismaMock.takeoffLearningPattern.count.mockResolvedValue(0);
    prismaMock.takeoffFeedback.findMany.mockResolvedValue([]);

    const stats = await getLearningStats('takeoff-1');

    expect(stats.averageRating).toBe(0);
  });

  it('should return default stats on error', async () => {
    const { getLearningStats } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.groupBy.mockRejectedValue(new Error('Database error'));

    const stats = await getLearningStats('takeoff-1');

    expect(stats.totalFeedback).toBe(0);
    expect(stats.totalCorrections).toBe(0);
    expect(stats.averageRating).toBe(0);
    expect(stats.feedbackByType).toEqual({});
    expect(stats.correctionsByField).toEqual({});
  });
});

describe('TakeoffLearningService - getPendingCorrections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get pending corrections for specific takeoff', async () => {
    const { getPendingCorrections } = await import('@/lib/takeoff-learning-service');

    const mockCorrections = [
      {
        id: 'correction-1',
        lineItemId: 'item-1',
        userId: 'user-1',
        fieldName: 'quantity',
        originalValue: '100',
        correctedValue: '105',
        reason: 'Measurement error',
        createdAt: new Date('2024-01-15'),
      },
    ];

    const mockLineItems = [
      {
        id: 'item-1',
        itemName: 'Concrete',
        category: 'concrete',
      },
    ];

    const mockUsers = [
      {
        id: 'user-1',
        username: 'john_doe',
      },
    ];

    prismaMock.takeoffCorrection.findMany.mockResolvedValue(mockCorrections);
    prismaMock.takeoffLineItem.findMany.mockResolvedValue(mockLineItems);
    prismaMock.user.findMany.mockResolvedValue(mockUsers);

    const result = await getPendingCorrections('takeoff-1');

    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0]).toEqual({
      id: 'correction-1',
      lineItemId: 'item-1',
      itemName: 'Concrete',
      category: 'concrete',
      fieldName: 'quantity',
      originalValue: '100',
      correctedValue: '105',
      reason: 'Measurement error',
      submittedAt: mockCorrections[0].createdAt,
      submittedBy: 'john_doe',
    });
  });

  it('should get all pending corrections when no takeoffId provided', async () => {
    const { getPendingCorrections } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffCorrection.findMany.mockResolvedValue([]);
    prismaMock.takeoffLineItem.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await getPendingCorrections();

    expect(prismaMock.takeoffCorrection.findMany).toHaveBeenCalledWith({
      where: { approved: false },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should handle missing line items gracefully', async () => {
    const { getPendingCorrections } = await import('@/lib/takeoff-learning-service');

    const mockCorrections = [
      {
        id: 'correction-1',
        lineItemId: 'missing-item',
        userId: 'user-1',
        fieldName: 'quantity',
        originalValue: '100',
        correctedValue: '105',
        reason: null,
        createdAt: new Date(),
      },
    ];

    prismaMock.takeoffCorrection.findMany.mockResolvedValue(mockCorrections);
    prismaMock.takeoffLineItem.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await getPendingCorrections('takeoff-1');

    expect(result.corrections[0].itemName).toBe('Unknown');
    expect(result.corrections[0].category).toBe('Unknown');
  });

  it('should handle missing users gracefully', async () => {
    const { getPendingCorrections } = await import('@/lib/takeoff-learning-service');

    const mockCorrections = [
      {
        id: 'correction-1',
        lineItemId: 'item-1',
        userId: 'missing-user',
        fieldName: 'quantity',
        originalValue: '100',
        correctedValue: '105',
        reason: null,
        createdAt: new Date(),
      },
    ];

    const mockLineItems = [
      {
        id: 'item-1',
        itemName: 'Concrete',
        category: 'concrete',
      },
    ];

    prismaMock.takeoffCorrection.findMany.mockResolvedValue(mockCorrections);
    prismaMock.takeoffLineItem.findMany.mockResolvedValue(mockLineItems);
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await getPendingCorrections('takeoff-1');

    expect(result.corrections[0].submittedBy).toBe('Unknown');
  });

  it('should return empty array on error', async () => {
    const { getPendingCorrections } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffCorrection.findMany.mockRejectedValue(new Error('Database error'));

    const result = await getPendingCorrections('takeoff-1');

    expect(result.corrections).toEqual([]);
  });
});

describe('TakeoffLearningService - generateSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate quantity adjustment suggestions', async () => {
    const { generateSuggestions } = await import('@/lib/takeoff-learning-service');

    const mockLineItems = [
      {
        id: 'item-1',
        itemName: 'Concrete Slab',
        category: 'concrete',
        quantity: 100,
        unit: 'CY',
      },
    ];

    const mockPatterns = [
      {
        id: 'pattern-1',
        category: 'concrete',
        patternType: 'quantity_adjustment',
        patternKey: 'concrete_slab',
        patternValue: { adjustmentFactor: 1.15 },
        confidence: 0.85,
        usageCount: 10,
      },
    ];

    prismaMock.takeoffLineItem.findMany.mockResolvedValue(mockLineItems);
    prismaMock.takeoffLearningPattern.findMany.mockResolvedValue(mockPatterns);

    const suggestions = await generateSuggestions('takeoff-1');

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual({
      lineItemId: 'item-1',
      itemName: 'Concrete Slab',
      fieldName: 'quantity',
      currentValue: '100',
      suggestedValue: '115.00',
      confidence: 0.85,
      reason: 'Based on 10 previous corrections for similar items',
      patternId: 'pattern-1',
    });
  });

  it('should not suggest when quantity difference is less than 5%', async () => {
    const { generateSuggestions } = await import('@/lib/takeoff-learning-service');

    const mockLineItems = [
      {
        id: 'item-1',
        itemName: 'Concrete',
        category: 'concrete',
        quantity: 100,
        unit: 'CY',
      },
    ];

    const mockPatterns = [
      {
        id: 'pattern-1',
        category: 'concrete',
        patternType: 'quantity_adjustment',
        patternKey: 'concrete',
        patternValue: { adjustmentFactor: 1.03 }, // Only 3% difference
        confidence: 0.85,
        usageCount: 10,
      },
    ];

    prismaMock.takeoffLineItem.findMany.mockResolvedValue(mockLineItems);
    prismaMock.takeoffLearningPattern.findMany.mockResolvedValue(mockPatterns);

    const suggestions = await generateSuggestions('takeoff-1');

    expect(suggestions).toHaveLength(0);
  });

  it('should generate unit preference suggestions', async () => {
    const { generateSuggestions } = await import('@/lib/takeoff-learning-service');

    const mockLineItems = [
      {
        id: 'item-1',
        itemName: 'Concrete',
        category: 'concrete',
        quantity: 100,
        unit: 'CF',
      },
    ];

    const mockPatterns = [
      {
        id: 'pattern-2',
        category: 'concrete',
        patternType: 'unit_preference',
        patternKey: 'concrete',
        patternValue: { preferredUnit: 'CY' },
        confidence: 0.9,
        usageCount: 20,
      },
    ];

    prismaMock.takeoffLineItem.findMany.mockResolvedValue(mockLineItems);
    prismaMock.takeoffLearningPattern.findMany.mockResolvedValue(mockPatterns);

    const suggestions = await generateSuggestions('takeoff-1');

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual({
      lineItemId: 'item-1',
      itemName: 'Concrete',
      fieldName: 'unit',
      currentValue: 'CF',
      suggestedValue: 'CY',
      confidence: 0.9,
      reason: 'This category commonly uses CY',
      patternId: 'pattern-2',
    });
  });

  it('should suggest common units for category', async () => {
    const { generateSuggestions } = await import('@/lib/takeoff-learning-service');

    const mockLineItems = [
      {
        id: 'item-1',
        itemName: 'Concrete',
        category: 'concrete',
        quantity: 100,
        unit: 'METER', // Unusual unit
      },
    ];

    prismaMock.takeoffLineItem.findMany.mockResolvedValue(mockLineItems);
    prismaMock.takeoffLearningPattern.findMany.mockResolvedValue([]);

    const suggestions = await generateSuggestions('takeoff-1');

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].fieldName).toBe('unit');
    expect(suggestions[0].suggestedValue).toBe('CY'); // Common unit for concrete
    expect(suggestions[0].confidence).toBe(0.5);
    expect(suggestions[0].reason).toContain('unusual');
  });

  it('should sort suggestions by confidence', async () => {
    const { generateSuggestions } = await import('@/lib/takeoff-learning-service');

    const mockLineItems = [
      {
        id: 'item-1',
        itemName: 'Item 1',
        category: 'concrete',
        quantity: 100,
        unit: 'CY',
      },
      {
        id: 'item-2',
        itemName: 'Item 2',
        category: 'concrete',
        quantity: 200,
        unit: 'CY',
      },
    ];

    const mockPatterns = [
      {
        id: 'pattern-1',
        category: 'concrete',
        patternType: 'quantity_adjustment',
        patternKey: 'item_1',
        patternValue: { adjustmentFactor: 1.1 },
        confidence: 0.6,
        usageCount: 5,
      },
      {
        id: 'pattern-2',
        category: 'concrete',
        patternType: 'quantity_adjustment',
        patternKey: 'item_2',
        patternValue: { adjustmentFactor: 1.15 },
        confidence: 0.9,
        usageCount: 15,
      },
    ];

    prismaMock.takeoffLineItem.findMany.mockResolvedValue(mockLineItems);
    prismaMock.takeoffLearningPattern.findMany.mockResolvedValue(mockPatterns);

    const suggestions = await generateSuggestions('takeoff-1');

    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(suggestions[1]?.confidence || 0);
  });

  it('should return empty array on error', async () => {
    const { generateSuggestions } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLineItem.findMany.mockRejectedValue(new Error('Database error'));

    const suggestions = await generateSuggestions('takeoff-1');

    expect(suggestions).toEqual([]);
  });
});

describe('TakeoffLearningService - getLearnedPatterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get all learned patterns', async () => {
    const { getLearnedPatterns } = await import('@/lib/takeoff-learning-service');

    const mockPatterns = [
      {
        id: 'pattern-1',
        category: 'concrete',
        patternType: 'quantity_adjustment',
        patternKey: 'concrete_slab',
        patternValue: { adjustmentFactor: 1.1 },
        confidence: 0.85,
        usageCount: 10,
        source: 'user_correction',
      },
      {
        id: 'pattern-2',
        category: 'rebar',
        patternType: 'unit_preference',
        patternKey: 'rebar',
        patternValue: { preferredUnit: 'TON' },
        confidence: 0.9,
        usageCount: 15,
        source: 'user_correction',
      },
    ];

    prismaMock.takeoffLearningPattern.findMany.mockResolvedValue(mockPatterns);

    const patterns = await getLearnedPatterns();

    expect(patterns).toHaveLength(2);
    expect(patterns[0]).toEqual(mockPatterns[0]);
    expect(patterns[1]).toEqual(mockPatterns[1]);
  });

  it('should get patterns for specific category', async () => {
    const { getLearnedPatterns } = await import('@/lib/takeoff-learning-service');

    const mockPatterns = [
      {
        id: 'pattern-1',
        category: 'concrete',
        patternType: 'quantity_adjustment',
        patternKey: 'concrete_slab',
        patternValue: { adjustmentFactor: 1.1 },
        confidence: 0.85,
        usageCount: 10,
        source: 'user_correction',
      },
    ];

    prismaMock.takeoffLearningPattern.findMany.mockResolvedValue(mockPatterns);

    const patterns = await getLearnedPatterns('concrete');

    expect(prismaMock.takeoffLearningPattern.findMany).toHaveBeenCalledWith({
      where: { category: 'concrete' },
      orderBy: [{ confidence: 'desc' }, { usageCount: 'desc' }],
    });
    expect(patterns).toHaveLength(1);
  });

  it('should return empty array on error', async () => {
    const { getLearnedPatterns } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLearningPattern.findMany.mockRejectedValue(new Error('Database error'));

    const patterns = await getLearnedPatterns();

    expect(patterns).toEqual([]);
  });
});

describe('TakeoffLearningService - deletePattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete pattern successfully', async () => {
    const { deletePattern } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLearningPattern.delete.mockResolvedValue({ id: 'pattern-1' });

    const result = await deletePattern('pattern-1');

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffLearningPattern.delete).toHaveBeenCalledWith({
      where: { id: 'pattern-1' },
    });
  });

  it('should handle errors gracefully', async () => {
    const { deletePattern } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLearningPattern.delete.mockRejectedValue(new Error('Pattern not found'));

    const result = await deletePattern('invalid-pattern');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Pattern not found');
  });
});

describe('TakeoffLearningService - rejectCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject correction successfully', async () => {
    const { rejectCorrection } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffCorrection.delete.mockResolvedValue({ id: 'correction-1' });

    const result = await rejectCorrection('correction-1', 'user-1');

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffCorrection.delete).toHaveBeenCalledWith({
      where: { id: 'correction-1' },
    });
  });

  it('should handle errors gracefully', async () => {
    const { rejectCorrection } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffCorrection.delete.mockRejectedValue(new Error('Correction not found'));

    const result = await rejectCorrection('invalid-correction', 'user-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Correction not found');
  });
});

describe('TakeoffLearningService - getRecentFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get recent feedback for specific takeoff', async () => {
    const { getRecentFeedback } = await import('@/lib/takeoff-learning-service');

    const mockFeedback = [
      {
        id: 'feedback-1',
        userId: 'user-1',
        feedbackType: 'helpful',
        rating: 5,
        comment: 'Great!',
        resolved: false,
        createdAt: new Date('2024-01-15'),
      },
    ];

    const mockUsers = [
      {
        id: 'user-1',
        username: 'john_doe',
      },
    ];

    prismaMock.takeoffFeedback.findMany.mockResolvedValue(mockFeedback);
    prismaMock.user.findMany.mockResolvedValue(mockUsers);

    const result = await getRecentFeedback('takeoff-1', 20);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'feedback-1',
      feedbackType: 'helpful',
      rating: 5,
      comment: 'Great!',
      resolved: false,
      createdAt: mockFeedback[0].createdAt,
      submittedBy: 'john_doe',
    });
  });

  it('should get recent feedback with custom limit', async () => {
    const { getRecentFeedback } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    await getRecentFeedback('takeoff-1', 10);

    expect(prismaMock.takeoffFeedback.findMany).toHaveBeenCalledWith({
      where: { takeoffId: 'takeoff-1' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });

  it('should use default limit of 20', async () => {
    const { getRecentFeedback } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    await getRecentFeedback('takeoff-1');

    expect(prismaMock.takeoffFeedback.findMany).toHaveBeenCalledWith({
      where: { takeoffId: 'takeoff-1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  });

  it('should handle missing users gracefully', async () => {
    const { getRecentFeedback } = await import('@/lib/takeoff-learning-service');

    const mockFeedback = [
      {
        id: 'feedback-1',
        userId: 'missing-user',
        feedbackType: 'helpful',
        rating: 5,
        comment: null,
        resolved: false,
        createdAt: new Date(),
      },
    ];

    prismaMock.takeoffFeedback.findMany.mockResolvedValue(mockFeedback);
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await getRecentFeedback('takeoff-1');

    expect(result[0].submittedBy).toBe('Unknown');
  });

  it('should return empty array on error', async () => {
    const { getRecentFeedback } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.findMany.mockRejectedValue(new Error('Database error'));

    const result = await getRecentFeedback('takeoff-1');

    expect(result).toEqual([]);
  });
});

describe('TakeoffLearningService - resolveFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve feedback successfully', async () => {
    const { resolveFeedback } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.update.mockResolvedValue({
      id: 'feedback-1',
      resolved: true,
    });

    const result = await resolveFeedback('feedback-1', 'user-1');

    expect(result.success).toBe(true);
    expect(prismaMock.takeoffFeedback.update).toHaveBeenCalledWith({
      where: { id: 'feedback-1' },
      data: {
        resolved: true,
        resolvedAt: expect.any(Date),
        resolvedBy: 'user-1',
      },
    });
  });

  it('should handle errors gracefully', async () => {
    const { resolveFeedback } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.update.mockRejectedValue(new Error('Feedback not found'));

    const result = await resolveFeedback('invalid-feedback', 'user-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Feedback not found');
  });
});

describe('TakeoffLearningService - bulkApplySuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply multiple quantity suggestions', async () => {
    const { bulkApplySuggestions } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLineItem.update.mockResolvedValue({});

    const suggestions = [
      { lineItemId: 'item-1', fieldName: 'quantity', value: '105' },
      { lineItemId: 'item-2', fieldName: 'quantity', value: '220' },
    ];

    const result = await bulkApplySuggestions(suggestions, 'user-1');

    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(2);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledTimes(2);
  });

  it('should apply unit suggestions', async () => {
    const { bulkApplySuggestions } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLineItem.update.mockResolvedValue({});

    const suggestions = [
      { lineItemId: 'item-1', fieldName: 'unit', value: 'CY' },
    ];

    const result = await bulkApplySuggestions(suggestions, 'user-1');

    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { unit: 'CY' },
    });
  });

  it('should apply category suggestions', async () => {
    const { bulkApplySuggestions } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLineItem.update.mockResolvedValue({});

    const suggestions = [
      { lineItemId: 'item-1', fieldName: 'category', value: 'concrete' },
    ];

    const result = await bulkApplySuggestions(suggestions, 'user-1');

    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { category: 'concrete' },
    });
  });

  it('should skip unsupported field names', async () => {
    const { bulkApplySuggestions } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLineItem.update.mockResolvedValue({});

    const suggestions = [
      { lineItemId: 'item-1', fieldName: 'unsupported', value: 'test' },
      { lineItemId: 'item-2', fieldName: 'quantity', value: '100' },
    ];

    const result = await bulkApplySuggestions(suggestions, 'user-1');

    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
    expect(prismaMock.takeoffLineItem.update).toHaveBeenCalledTimes(1);
  });

  it('should handle database errors', async () => {
    const { bulkApplySuggestions } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffLineItem.update.mockRejectedValue(new Error('Database error'));

    const suggestions = [
      { lineItemId: 'item-1', fieldName: 'quantity', value: '105' },
    ];

    const result = await bulkApplySuggestions(suggestions, 'user-1');

    expect(result.success).toBe(false);
    expect(result.appliedCount).toBe(0);
    expect(result.error).toContain('Database error');
  });
});

describe('TakeoffLearningService - getLearningSystemSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return complete summary with takeoffId', async () => {
    const { getLearningSystemSummary } = await import('@/lib/takeoff-learning-service');

    // Mock getLearningStats
    prismaMock.takeoffFeedback.groupBy.mockResolvedValue([]);
    prismaMock.takeoffCorrection.groupBy.mockResolvedValue([]);
    prismaMock.takeoffFeedback.count.mockResolvedValue(10);
    prismaMock.takeoffCorrection.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    prismaMock.takeoffFeedback.aggregate.mockResolvedValue({ _avg: { rating: 4.5 } });
    prismaMock.takeoffLearningPattern.groupBy.mockResolvedValue([]);
    prismaMock.takeoffLearningPattern.count.mockResolvedValue(8);
    prismaMock.takeoffFeedback.findMany.mockResolvedValue([]);

    // Mock getPendingCorrections
    prismaMock.takeoffCorrection.findMany.mockResolvedValue([
      {
        id: 'correction-1',
        lineItemId: 'item-1',
        userId: 'user-1',
        fieldName: 'quantity',
        originalValue: '100',
        correctedValue: '105',
        reason: null,
        createdAt: new Date(),
      },
    ]);
    prismaMock.takeoffLineItem.findMany.mockResolvedValue([
      { id: 'item-1', itemName: 'Concrete', category: 'concrete' },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'user-1', username: 'john' },
    ]);

    const summary = await getLearningSystemSummary('takeoff-1');

    expect(summary.stats.totalFeedback).toBe(10);
    expect(summary.pendingCorrections).toBe(1);
    expect(summary.suggestions).toEqual([]);
    expect(summary.recentFeedback).toEqual([]);
  });

  it('should return summary without takeoffId', async () => {
    const { getLearningSystemSummary } = await import('@/lib/takeoff-learning-service');

    prismaMock.takeoffFeedback.groupBy.mockResolvedValue([]);
    prismaMock.takeoffCorrection.groupBy.mockResolvedValue([]);
    prismaMock.takeoffFeedback.count.mockResolvedValue(50);
    prismaMock.takeoffCorrection.count
      .mockResolvedValueOnce(25)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5);
    prismaMock.takeoffFeedback.aggregate.mockResolvedValue({ _avg: { rating: 4.2 } });
    prismaMock.takeoffLearningPattern.groupBy.mockResolvedValue([]);
    prismaMock.takeoffLearningPattern.count.mockResolvedValue(15);
    prismaMock.takeoffFeedback.findMany.mockResolvedValue([]);
    prismaMock.takeoffCorrection.findMany.mockResolvedValue([]);
    prismaMock.takeoffLineItem.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);

    const summary = await getLearningSystemSummary();

    expect(summary.stats.totalFeedback).toBe(50);
    expect(summary.pendingCorrections).toBe(0);
    expect(summary.suggestions).toEqual([]); // No suggestions without takeoffId
  });
});
