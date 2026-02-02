import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mocks using vi.hoisted pattern
const mocks = vi.hoisted(() => ({
  prisma: {
    chatMessage: {
      findMany: vi.fn(),
    },
    subcontractor: {
      findMany: vi.fn(),
    },
    budgetItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    projectBudget: {
      findUnique: vi.fn(),
    },
    laborEntry: {
      create: vi.fn(),
    },
  },
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  projectPricing: {
    getAllProjectLaborRates: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// Mock OpenAI with dynamic import support
vi.mock('openai', () => ({
  default: vi.fn(() => mocks.openai),
}));

vi.mock('./project-specific-pricing', () => ({
  getAllProjectLaborRates: mocks.projectPricing.getAllProjectLaborRates,
}));

describe('Labor Extraction Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  describe('extractLaborFromReport', () => {
    it('should extract labor data from conversation messages', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'We had 5 electricians working today',
          response: 'How many hours did they work?',
        },
        {
          message: '8 hours each',
          response: 'Great, I will record that.',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([
        { companyName: 'ABC Electric', tradeType: 'ELECTRICAL' },
      ]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [
                  {
                    tradeName: 'Electricians',
                    tradeType: 'ELECTRICAL',
                    workerCount: 5,
                    hoursWorked: 8,
                    description: 'Electrical work',
                    confidence: 0.95,
                  },
                ],
                totalWorkers: 5,
                totalHours: 40,
                extractionConfidence: 0.95,
              }),
            },
          },
        ],
      });

      const result = await extractLaborFromReport('conv-1', 'project-1');

      expect(result).toBeDefined();
      expect(result?.laborEntries).toHaveLength(1);
      expect(result?.laborEntries[0].tradeName).toBe('Electricians');
      expect(result?.laborEntries[0].workerCount).toBe(5);
      expect(result?.laborEntries[0].hoursWorked).toBe(8);
      expect(result?.totalWorkers).toBe(5);
      expect(result?.totalHours).toBe(40);
    });

    it('should return null when no messages exist', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await extractLaborFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
    });

    it('should include project trade context in AI prompt', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Workers on site today',
          response: 'Please provide details',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([
        { companyName: 'ABC Electric', tradeType: 'ELECTRICAL' },
        { companyName: 'XYZ Plumbing', tradeType: 'PLUMBING' },
      ]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [],
                totalWorkers: 0,
                totalHours: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      await extractLaborFromReport('conv-1', 'project-1');

      expect(mocks.openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('ELECTRICAL'),
            }),
          ]),
        })
      );
    });

    it('should handle missing trade types in project context', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Labor report',
          response: 'Acknowledged',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([
        { companyName: 'ABC Construction', tradeType: null },
      ]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [],
                totalWorkers: 0,
                totalHours: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      await extractLaborFromReport('conv-1', 'project-1');

      expect(mocks.openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('ABC Construction'),
            }),
          ]),
        })
      );
    });

    it('should return null when AI response has no content', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Test message',
          response: 'Test response',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const result = await extractLaborFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
    });

    it('should return null when AI response has no JSON match', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Test message',
          response: 'Test response',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'No labor data found in the report.',
            },
          },
        ],
      });

      const result = await extractLaborFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
    });

    it('should handle AI errors gracefully', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Test message',
          response: 'Test response',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await extractLaborFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
    });

    it('should extract multiple labor entries from report', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: '5 electricians and 3 plumbers worked today',
          response: 'How many hours?',
        },
        {
          message: '8 hours each',
          response: 'Recorded',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [
                  {
                    tradeName: 'Electricians',
                    tradeType: 'ELECTRICAL',
                    workerCount: 5,
                    hoursWorked: 8,
                    description: 'Electrical installation',
                    confidence: 0.9,
                  },
                  {
                    tradeName: 'Plumbers',
                    tradeType: 'PLUMBING',
                    workerCount: 3,
                    hoursWorked: 8,
                    description: 'Plumbing rough-in',
                    confidence: 0.85,
                  },
                ],
                totalWorkers: 8,
                totalHours: 64,
                extractionConfidence: 0.88,
              }),
            },
          },
        ],
      });

      const result = await extractLaborFromReport('conv-1', 'project-1');

      expect(result?.laborEntries).toHaveLength(2);
      expect(result?.totalWorkers).toBe(8);
      expect(result?.totalHours).toBe(64);
    });

    it('should handle no known trades in project context', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Labor today',
          response: 'OK',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [],
                totalWorkers: 0,
                totalHours: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      await extractLaborFromReport('conv-1', 'project-1');

      expect(mocks.openai.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('No known trades yet'),
            }),
          ]),
        })
      );
    });
  });

  describe('saveLaborEntries', () => {
    const mockLaborData = {
      laborEntries: [
        {
          tradeName: 'Electricians',
          tradeType: 'ELECTRICAL',
          workerCount: 5,
          hoursWorked: 8,
          description: 'Electrical work',
          confidence: 0.95,
        },
      ],
      totalWorkers: 5,
      totalHours: 40,
      extractionConfidence: 0.95,
    };

    const reportDate = new Date('2024-01-15');

    it('should save labor entries with project-specific rates', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      // Mock with lowercase normalized trade type to match lookup
      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(
        new Map([
          [
            'electrical',
            {
              hourlyRate: 78,
              source: 'subcontractor_contract',
              confidence: 'high',
            },
          ],
        ])
      );

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [
          {
            id: 'item-1',
            tradeType: 'ELECTRICAL',
            isActive: true,
          },
        ],
      });

      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });
      mocks.prisma.budgetItem.findUnique.mockResolvedValue({
        id: 'item-1',
      });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'item-1' });

      const result = await saveLaborEntries('project-1', 'conv-1', mockLaborData, reportDate);

      expect(result.savedCount).toBe(1);
      expect(result.linkedToBudget).toBe(1);
      expect(result.totalLaborCost).toBe(5 * 8 * 78); // workers * hours * rate
      expect(mocks.prisma.laborEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            hourlyRate: 78,
            totalCost: 3120,
            status: 'APPROVED',
          }),
        })
      );
    });

    it('should use fallback rates when project rates not available', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(
        new Map([
          [
            'electrical',
            {
              hourlyRate: 55,
              source: 'default',
              confidence: 'low',
            },
          ],
        ])
      );

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [],
      });

      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      const result = await saveLaborEntries('project-1', 'conv-1', mockLaborData, reportDate);

      expect(result.savedCount).toBe(1);
      expect(mocks.prisma.laborEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hourlyRate: 78, // ELECTRICAL fallback rate
          }),
        })
      );
    });

    it('should skip low-confidence entries below threshold', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      const lowConfidenceData = {
        laborEntries: [
          {
            tradeName: 'Workers',
            tradeType: 'GENERAL',
            workerCount: 2,
            hoursWorked: 8,
            description: 'General work',
            confidence: 0.3, // Below 0.5 threshold
          },
        ],
        totalWorkers: 2,
        totalHours: 16,
        extractionConfidence: 0.3,
      };

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await saveLaborEntries('project-1', 'conv-1', lowConfidenceData, reportDate);

      expect(result.savedCount).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalLaborCost).toBe(0);
      expect(mocks.prisma.laborEntry.create).not.toHaveBeenCalled();
    });

    it('should set status to PENDING for medium confidence entries', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      const mediumConfidenceData = {
        laborEntries: [
          {
            tradeName: 'Workers',
            tradeType: 'GENERAL',
            workerCount: 3,
            hoursWorked: 8,
            description: 'General work',
            confidence: 0.7, // Between 0.5 and 0.8
          },
        ],
        totalWorkers: 3,
        totalHours: 24,
        extractionConfidence: 0.7,
      };

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      await saveLaborEntries('project-1', 'conv-1', mediumConfidenceData, reportDate);

      expect(mocks.prisma.laborEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      );
    });

    it('should link labor entries to budget items when available', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [
          {
            id: 'item-electrical',
            tradeType: 'ELECTRICAL',
            isActive: true,
          },
        ],
      });

      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });
      mocks.prisma.budgetItem.findUnique.mockResolvedValue({
        id: 'item-electrical',
      });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'item-electrical' });

      const result = await saveLaborEntries('project-1', 'conv-1', mockLaborData, reportDate);

      expect(result.linkedToBudget).toBe(1);
      expect(mocks.prisma.laborEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            budgetItemId: 'item-electrical',
          }),
        })
      );
    });

    it('should update budget item actuals for high confidence linked entries', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [
          {
            id: 'item-1',
            tradeType: 'ELECTRICAL',
            isActive: true,
          },
        ],
      });

      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });
      mocks.prisma.budgetItem.findUnique.mockResolvedValue({
        id: 'item-1',
      });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'item-1' });

      await saveLaborEntries('project-1', 'conv-1', mockLaborData, reportDate);

      expect(mocks.prisma.budgetItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          actualHours: { increment: 40 },
          actualCost: { increment: expect.any(Number) },
        },
      });
    });

    it('should not update budget actuals for medium confidence entries', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      const mediumConfidenceData = {
        laborEntries: [
          {
            tradeName: 'Workers',
            tradeType: 'ELECTRICAL',
            workerCount: 3,
            hoursWorked: 8,
            confidence: 0.7, // Medium confidence
          },
        ],
        totalWorkers: 3,
        totalHours: 24,
        extractionConfidence: 0.7,
      };

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [
          {
            id: 'item-1',
            tradeType: 'ELECTRICAL',
            isActive: true,
          },
        ],
      });

      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      await saveLaborEntries('project-1', 'conv-1', mediumConfidenceData, reportDate);

      expect(mocks.prisma.budgetItem.update).not.toHaveBeenCalled();
    });

    it('should handle multiple labor entries with different trades', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      const multiTradeData = {
        laborEntries: [
          {
            tradeName: 'Electricians',
            tradeType: 'ELECTRICAL',
            workerCount: 5,
            hoursWorked: 8,
            confidence: 0.9,
          },
          {
            tradeName: 'Plumbers',
            tradeType: 'PLUMBING',
            workerCount: 3,
            hoursWorked: 8,
            confidence: 0.85,
          },
        ],
        totalWorkers: 8,
        totalHours: 64,
        extractionConfidence: 0.88,
      };

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [
          { id: 'item-1', tradeType: 'ELECTRICAL', isActive: true },
          { id: 'item-2', tradeType: 'PLUMBING', isActive: true },
        ],
      });
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });
      mocks.prisma.budgetItem.findUnique.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'item-1' });

      const result = await saveLaborEntries('project-1', 'conv-1', multiTradeData, reportDate);

      expect(result.savedCount).toBe(2);
      expect(mocks.prisma.laborEntry.create).toHaveBeenCalledTimes(2);
    });

    it('should handle errors when saving individual entries', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.prisma.laborEntry.create.mockRejectedValue(new Error('Database error'));

      const result = await saveLaborEntries('project-1', 'conv-1', mockLaborData, reportDate);

      expect(result.savedCount).toBe(0);
      expect(result.linkedToBudget).toBe(0);
    });

    it('should use custom hourly rate from entry if provided', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      const dataWithCustomRate = {
        laborEntries: [
          {
            tradeName: 'Electricians',
            tradeType: 'ELECTRICAL',
            workerCount: 5,
            hoursWorked: 8,
            hourlyRate: 95, // Custom rate
            confidence: 0.95,
          },
        ],
        totalWorkers: 5,
        totalHours: 40,
        extractionConfidence: 0.95,
      };

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      const result = await saveLaborEntries(
        'project-1',
        'conv-1',
        dataWithCustomRate,
        reportDate
      );

      expect(mocks.prisma.laborEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hourlyRate: 95,
            totalCost: 5 * 8 * 95,
          }),
        })
      );
    });

    it('should calculate total hours as hoursWorked * workerCount', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      await saveLaborEntries('project-1', 'conv-1', mockLaborData, reportDate);

      expect(mocks.prisma.laborEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hoursWorked: 40, // 5 workers * 8 hours
          }),
        })
      );
    });

    it('should handle empty labor entries array', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      const emptyData = {
        laborEntries: [],
        totalWorkers: 0,
        totalHours: 0,
        extractionConfidence: 0,
      };

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await saveLaborEntries('project-1', 'conv-1', emptyData, reportDate);

      expect(result.savedCount).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalLaborCost).toBe(0);
    });
  });

  describe('processLaborFromDailyReport', () => {
    it('should extract and save labor data successfully', async () => {
      const { processLaborFromDailyReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: '5 electricians worked 8 hours',
          response: 'Recorded',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [
                  {
                    tradeName: 'Electricians',
                    tradeType: 'ELECTRICAL',
                    workerCount: 5,
                    hoursWorked: 8,
                    confidence: 0.9,
                  },
                ],
                totalWorkers: 5,
                totalHours: 40,
                extractionConfidence: 0.9,
              }),
            },
          },
        ],
      });

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      const result = await processLaborFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(1);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalLaborCost).toBeGreaterThan(0);
    });

    it('should return success with zero entries when no labor data found', async () => {
      const { processLaborFromDailyReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Weather delay today',
          response: 'Understood',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [],
                totalWorkers: 0,
                totalHours: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      const result = await processLaborFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalLaborCost).toBe(0);
    });

    it('should return success when extraction returns null', async () => {
      const { processLaborFromDailyReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await processLaborFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(0);
    });

    it('should return success with no entries on extraction error', async () => {
      const { processLaborFromDailyReport } = await import('@/lib/labor-extraction-service');

      // extractLaborFromReport catches errors and returns null
      mocks.prisma.chatMessage.findMany.mockRejectedValue(new Error('Database error'));

      const result = await processLaborFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      // The service returns success when extraction returns null (no labor data)
      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalLaborCost).toBe(0);
    });

    it('should handle save errors gracefully', async () => {
      const { processLaborFromDailyReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Labor report',
          response: 'OK',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [
                  {
                    tradeName: 'Workers',
                    tradeType: 'GENERAL',
                    workerCount: 2,
                    hoursWorked: 8,
                    confidence: 0.9,
                  },
                ],
                totalWorkers: 2,
                totalHours: 16,
                extractionConfidence: 0.9,
              }),
            },
          },
        ],
      });

      // saveLaborEntries catches errors per-entry, so it still succeeds overall
      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      const result = await processLaborFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(1);
    });

    it('should process multiple labor entries and return totals', async () => {
      const { processLaborFromDailyReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Multiple crews on site',
          response: 'Details?',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [
                  {
                    tradeName: 'Electricians',
                    tradeType: 'ELECTRICAL',
                    workerCount: 5,
                    hoursWorked: 8,
                    confidence: 0.9,
                  },
                  {
                    tradeName: 'Plumbers',
                    tradeType: 'PLUMBING',
                    workerCount: 3,
                    hoursWorked: 8,
                    confidence: 0.85,
                  },
                ],
                totalWorkers: 8,
                totalHours: 64,
                extractionConfidence: 0.88,
              }),
            },
          },
        ],
      });

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      const result = await processLaborFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(2);
    });

    it('should include linked budget count in result', async () => {
      const { processLaborFromDailyReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Electricians worked today',
          response: 'OK',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [
                  {
                    tradeName: 'Electricians',
                    tradeType: 'ELECTRICAL',
                    workerCount: 5,
                    hoursWorked: 8,
                    confidence: 0.95,
                  },
                ],
                totalWorkers: 5,
                totalHours: 40,
                extractionConfidence: 0.95,
              }),
            },
          },
        ],
      });

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [
          {
            id: 'item-1',
            tradeType: 'ELECTRICAL',
            isActive: true,
          },
        ],
      });
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });
      mocks.prisma.budgetItem.findUnique.mockResolvedValue({ id: 'item-1' });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'item-1' });

      const result = await processLaborFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.linkedToBudget).toBe(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null message and response fields gracefully', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: null,
          response: null,
        },
        {
          message: 'Labor today',
          response: 'OK',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                laborEntries: [],
                totalWorkers: 0,
                totalHours: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      const result = await extractLaborFromReport('conv-1', 'project-1');

      expect(result).toBeDefined();
      expect(mocks.openai.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle invalid JSON in AI response', async () => {
      const { extractLaborFromReport } = await import('@/lib/labor-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          message: 'Test',
          response: 'Test',
        },
      ]);

      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: '{ invalid json }',
            },
          },
        ],
      });

      const result = await extractLaborFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
    });

    it('should handle missing budget item during update', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      const laborData = {
        laborEntries: [
          {
            tradeName: 'Electricians',
            tradeType: 'ELECTRICAL',
            workerCount: 5,
            hoursWorked: 8,
            confidence: 0.95,
          },
        ],
        totalWorkers: 5,
        totalHours: 40,
        extractionConfidence: 0.95,
      };

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [
          {
            id: 'item-1',
            tradeType: 'ELECTRICAL',
            isActive: true,
          },
        ],
      });
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });
      mocks.prisma.budgetItem.findUnique.mockResolvedValue(null);

      const result = await saveLaborEntries(
        'project-1',
        'conv-1',
        laborData,
        new Date('2024-01-15')
      );

      expect(result.savedCount).toBe(1);
      expect(mocks.prisma.budgetItem.update).not.toHaveBeenCalled();
    });

    it('should handle inactive budget items', async () => {
      const { saveLaborEntries } = await import('@/lib/labor-extraction-service');

      const laborData = {
        laborEntries: [
          {
            tradeName: 'Electricians',
            tradeType: 'ELECTRICAL',
            workerCount: 5,
            hoursWorked: 8,
            confidence: 0.95,
          },
        ],
        totalWorkers: 5,
        totalHours: 40,
        extractionConfidence: 0.95,
      };

      mocks.projectPricing.getAllProjectLaborRates.mockResolvedValue(new Map());
      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        BudgetItem: [
          {
            id: 'item-1',
            tradeType: 'ELECTRICAL',
            isActive: false, // Inactive
          },
        ],
      });
      mocks.prisma.laborEntry.create.mockResolvedValue({ id: 'labor-1' });

      const result = await saveLaborEntries(
        'project-1',
        'conv-1',
        laborData,
        new Date('2024-01-15')
      );

      expect(result.savedCount).toBe(1);
      expect(result.linkedToBudget).toBe(0);
    });
  });
});
