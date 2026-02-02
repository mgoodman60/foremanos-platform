import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies using vi.hoisted pattern
const mocks = vi.hoisted(() => ({
  prisma: {
    chatMessage: {
      findMany: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
    },
    projectBudget: {
      findUnique: vi.fn(),
    },
    budgetItem: {
      update: vi.fn(),
    },
    procurement: {
      count: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mocks.prisma,
}));

vi.mock('openai', () => ({
  default: vi.fn(() => mocks.openai),
}));

describe('Material Extraction Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractMaterialsFromReport', () => {
    it('should extract materials from conversation messages successfully', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'We received 20 CY of concrete from ABC Supply today',
          response: 'I have logged the concrete delivery.',
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          message: '100 LF of copper pipe delivered',
          response: 'Noted the plumbing materials.',
          createdAt: new Date('2024-01-15'),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [
                  {
                    materialName: 'Concrete',
                    supplier: 'ABC Supply',
                    quantity: 20,
                    unit: 'cy',
                    unitCost: 150,
                    totalCost: 3000,
                    tradeType: 'CONCRETE',
                    deliveryNotes: 'Delivered on schedule',
                    confidence: 0.95,
                  },
                  {
                    materialName: 'Copper Pipe',
                    supplier: null,
                    quantity: 100,
                    unit: 'lf',
                    unitCost: 25,
                    totalCost: 2500,
                    tradeType: 'PLUMBING',
                    deliveryNotes: null,
                    confidence: 0.9,
                  },
                ],
                totalMaterialCost: 5500,
                extractionConfidence: 0.92,
              }),
            },
          },
        ],
      });

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).not.toBeNull();
      expect(result?.materials).toHaveLength(2);
      expect(result?.totalMaterialCost).toBe(5500);
      expect(result?.extractionConfidence).toBe(0.92);
      expect(result?.materials[0].materialName).toBe('Concrete');
      expect(result?.materials[0].tradeType).toBe('CONCRETE');
      expect(result?.materials[1].materialName).toBe('Copper Pipe');
      expect(result?.materials[1].tradeType).toBe('PLUMBING');
    });

    it('should return null when no messages exist', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
      expect(mocks.openai.chat.completions.create).not.toHaveBeenCalled();
    });

    it('should return null when AI response has no content', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'Test message',
          response: 'Response',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
    });

    it('should return null when AI response has no valid JSON', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'Test message',
          response: 'Response',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This is not valid JSON content without any braces',
            },
          },
        ],
      });

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
    });

    it('should merge existing deliveries from conversation metadata', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'We received concrete',
          response: 'Logged',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [
          {
            material: 'Rebar',
            supplier: 'Steel Co',
            quantity: 500,
            unit: 'lf',
            unitCost: 2,
            totalCost: 1000,
            tradeType: 'CONCRETE',
            notes: 'Manual entry',
          },
        ],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [
                  {
                    materialName: 'Concrete',
                    supplier: 'ABC Supply',
                    quantity: 20,
                    unit: 'cy',
                    unitCost: 150,
                    totalCost: 3000,
                    tradeType: 'CONCRETE',
                    deliveryNotes: null,
                    confidence: 0.95,
                  },
                ],
                totalMaterialCost: 3000,
                extractionConfidence: 0.95,
              }),
            },
          },
        ],
      });

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).not.toBeNull();
      expect(result?.materials).toHaveLength(2);
      expect(result?.materials.find(m => m.materialName === 'Rebar')).toBeDefined();
      expect(result?.materials.find(m => m.materialName === 'Concrete')).toBeDefined();
      expect(result?.totalMaterialCost).toBe(4000); // 3000 + 1000
    });

    it('should not duplicate materials when already in extracted results', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'Concrete delivered',
          response: 'Logged',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [
          {
            material: 'Concrete',
            supplier: 'ABC Supply',
            quantity: 20,
            unit: 'cy',
            totalCost: 3000,
          },
        ],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [
                  {
                    materialName: 'Concrete',
                    supplier: 'ABC Supply',
                    quantity: 20,
                    unit: 'cy',
                    totalCost: 3000,
                    tradeType: 'CONCRETE',
                    confidence: 0.95,
                  },
                ],
                totalMaterialCost: 3000,
                extractionConfidence: 0.95,
              }),
            },
          },
        ],
      });

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).not.toBeNull();
      expect(result?.materials).toHaveLength(1); // No duplicate
      expect(result?.totalMaterialCost).toBe(3000);
    });

    it('should handle error gracefully and return null', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockRejectedValue(new Error('Database error'));

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).toBeNull();
    });

    it('should handle conversation with null materialDeliveries field', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'Test',
          response: 'Response',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: null,
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [],
                totalMaterialCost: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).not.toBeNull();
      expect(result?.materials).toHaveLength(0);
    });

    it('should use correct OpenAI configuration', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      process.env.OPENAI_API_KEY = 'test-api-key';

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'Test',
          response: 'Response',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [],
                totalMaterialCost: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      await extractMaterialsFromReport('conv-1', 'project-1');

      expect(mocks.openai.chat.completions.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        temperature: 0.1,
        max_tokens: 2000,
      });
    });
  });

  describe('saveMaterialEntries', () => {
    it('should save material entries with high confidence', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'budget-item-1',
            name: 'Concrete Work',
            tradeType: 'CONCRETE',
            isActive: true,
          },
        ],
      });

      mocks.prisma.procurement.count.mockResolvedValue(5);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'budget-item-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Concrete',
            supplier: 'ABC Supply',
            quantity: 20,
            unit: 'cy',
            unitCost: 150,
            totalCost: 3000,
            tradeType: 'CONCRETE',
            deliveryNotes: 'On time delivery',
            confidence: 0.95,
          },
        ],
        totalMaterialCost: 3000,
        extractionConfidence: 0.95,
      };

      const result = await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15'),
        'user-1'
      );

      expect(result.savedCount).toBe(1);
      expect(result.linkedToBudget).toBe(1);
      expect(result.totalMaterialCost).toBe(3000);
      expect(mocks.prisma.procurement.create).toHaveBeenCalled();
      expect(mocks.prisma.budgetItem.update).toHaveBeenCalledWith({
        where: { id: 'budget-item-1' },
        data: { actualCost: { increment: 3000 } },
      });
    });

    it('should skip materials with low confidence (<0.5)', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      const materialData = {
        materials: [
          {
            materialName: 'Unknown Material',
            supplier: null,
            quantity: 1,
            unit: 'ea',
            unitCost: null,
            totalCost: 100,
            tradeType: 'GENERAL',
            deliveryNotes: null,
            confidence: 0.3,
          },
        ],
        totalMaterialCost: 100,
        extractionConfidence: 0.3,
      };

      const result = await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(result.savedCount).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalMaterialCost).toBe(0);
      expect(mocks.prisma.procurement.create).not.toHaveBeenCalled();
    });

    it('should not update budget for materials with confidence <0.7', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'budget-item-1',
            name: 'Electrical',
            tradeType: 'ELECTRICAL',
            isActive: true,
          },
        ],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Wire',
            supplier: null,
            quantity: 100,
            unit: 'lf',
            unitCost: null,
            totalCost: 500,
            tradeType: 'ELECTRICAL',
            deliveryNotes: null,
            confidence: 0.6,
          },
        ],
        totalMaterialCost: 500,
        extractionConfidence: 0.6,
      };

      const result = await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(result.savedCount).toBe(1);
      expect(result.linkedToBudget).toBe(0);
      expect(mocks.prisma.budgetItem.update).not.toHaveBeenCalled();
    });

    it('should generate unique procurement numbers', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(42);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Test Material',
            supplier: 'Vendor',
            quantity: 10,
            unit: 'ea',
            unitCost: 50,
            totalCost: 500,
            tradeType: 'GENERAL',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 500,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            procurementNumber: expect.stringMatching(/^MAT-\d{8}-0043$/),
          }),
        })
      );
    });

    it('should use system user when createdBy not provided', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-system',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Test Material',
            supplier: 'Vendor',
            quantity: 10,
            unit: 'ea',
            unitCost: null,
            totalCost: 500,
            tradeType: 'GENERAL',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 500,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdByUser: { connect: { id: 'admin-system' } },
          }),
        })
      );
    });

    it('should use "system" as fallback when no admin exists', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue(null);

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Test Material',
            supplier: 'Vendor',
            quantity: 10,
            unit: 'ea',
            unitCost: null,
            totalCost: 500,
            tradeType: 'GENERAL',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 500,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdByUser: { connect: { id: 'system' } },
          }),
        })
      );
    });

    it('should map HVAC trade to EQUIPMENT procurement type', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'HVAC Unit',
            supplier: 'HVAC Supply',
            quantity: 1,
            unit: 'ea',
            unitCost: 5000,
            totalCost: 5000,
            tradeType: 'HVAC',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 5000,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemType: 'EQUIPMENT',
          }),
        })
      );
    });

    it('should map non-HVAC trades to MATERIAL procurement type', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Concrete',
            supplier: 'Concrete Co',
            quantity: 20,
            unit: 'cy',
            unitCost: 150,
            totalCost: 3000,
            tradeType: 'CONCRETE',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 3000,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemType: 'MATERIAL',
          }),
        })
      );
    });

    it('should handle procurement creation errors gracefully', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockRejectedValue(new Error('Database error'));

      const materialData = {
        materials: [
          {
            materialName: 'Test Material',
            supplier: 'Vendor',
            quantity: 10,
            unit: 'ea',
            unitCost: null,
            totalCost: 500,
            tradeType: 'GENERAL',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 500,
        extractionConfidence: 0.9,
      };

      const result = await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(result.savedCount).toBe(0);
      expect(result.linkedToBudget).toBe(0);
    });

    it('should match budget item by trade type', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'budget-item-plumbing',
            name: 'Plumbing Work',
            tradeType: 'PLUMBING',
            isActive: true,
          },
        ],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'budget-item-plumbing' });

      const materialData = {
        materials: [
          {
            materialName: 'Copper Pipe',
            supplier: 'Plumbing Supply',
            quantity: 100,
            unit: 'lf',
            unitCost: 25,
            totalCost: 2500,
            tradeType: 'PLUMBING',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 2500,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            budgetItem: { connect: { id: 'budget-item-plumbing' } },
          }),
        })
      );
    });

    it('should match budget item by material name in description', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'budget-item-1',
            name: 'Materials',
            description: 'Includes concrete and rebar',
            tradeType: 'GENERAL',
            isActive: true,
          },
        ],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'budget-item-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Concrete',
            supplier: 'Concrete Co',
            quantity: 20,
            unit: 'cy',
            unitCost: 150,
            totalCost: 3000,
            tradeType: null,
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 3000,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            budgetItem: { connect: { id: 'budget-item-1' } },
          }),
        })
      );
    });

    it('should create procurement without budget link when no match found', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Unknown Material',
            supplier: 'Unknown Vendor',
            quantity: 10,
            unit: 'ea',
            unitCost: null,
            totalCost: 500,
            tradeType: 'GENERAL',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 500,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            budgetItem: expect.anything(),
          }),
        })
      );
    });
  });

  describe('processMaterialsFromDailyReport', () => {
    it('should process materials successfully', async () => {
      const { processMaterialsFromDailyReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'Concrete delivered',
          response: 'Logged',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [
                  {
                    materialName: 'Concrete',
                    supplier: 'ABC Supply',
                    quantity: 20,
                    unit: 'cy',
                    unitCost: 150,
                    totalCost: 3000,
                    tradeType: 'CONCRETE',
                    deliveryNotes: null,
                    confidence: 0.95,
                  },
                ],
                totalMaterialCost: 3000,
                extractionConfidence: 0.95,
              }),
            },
          },
        ],
      });

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'budget-item-1',
            name: 'Concrete Work',
            tradeType: 'CONCRETE',
            isActive: true,
          },
        ],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });
      mocks.prisma.budgetItem.update.mockResolvedValue({ id: 'budget-item-1' });

      const result = await processMaterialsFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(1);
      expect(result.linkedToBudget).toBe(1);
      expect(result.totalMaterialCost).toBe(3000);
    });

    it('should return success with zero entries when no materials found', async () => {
      const { processMaterialsFromDailyReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'No materials today',
          response: 'Ok',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [],
                totalMaterialCost: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      const result = await processMaterialsFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalMaterialCost).toBe(0);
    });

    it('should return success with zero entries when extraction returns null', async () => {
      const { processMaterialsFromDailyReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await processMaterialsFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalMaterialCost).toBe(0);
    });

    it('should return success with zero entries when extraction errors (error caught internally)', async () => {
      const { processMaterialsFromDailyReport } = await import('@/lib/material-extraction-service');

      // When extractMaterialsFromReport encounters an error, it catches it and returns null
      // processMaterialsFromDailyReport then treats this as "no materials found" and returns success: true
      mocks.prisma.chatMessage.findMany.mockRejectedValue(new Error('Database error'));

      const result = await processMaterialsFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(true);
      expect(result.entriesSaved).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalMaterialCost).toBe(0);
    });

    it('should return failure when saveMaterialEntries throws error', async () => {
      const { processMaterialsFromDailyReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'Concrete delivered',
          response: 'Logged',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [
                  {
                    materialName: 'Concrete',
                    supplier: 'ABC Supply',
                    quantity: 20,
                    unit: 'cy',
                    totalCost: 3000,
                    tradeType: 'CONCRETE',
                    confidence: 0.95,
                  },
                ],
                totalMaterialCost: 3000,
                extractionConfidence: 0.95,
              }),
            },
          },
        ],
      });

      // Make saveMaterialEntries throw by making user lookup fail catastrophically
      mocks.prisma.user.findFirst.mockImplementation(() => {
        throw new Error('Unhandled database error in saveMaterialEntries');
      });

      const result = await processMaterialsFromDailyReport(
        'conv-1',
        'project-1',
        new Date('2024-01-15')
      );

      expect(result.success).toBe(false);
      expect(result.entriesSaved).toBe(0);
      expect(result.linkedToBudget).toBe(0);
      expect(result.totalMaterialCost).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle materials with missing optional fields', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Generic Material',
            supplier: null,
            quantity: 1,
            unit: 'ea',
            unitCost: null,
            totalCost: 100,
            tradeType: null,
            deliveryNotes: null,
            confidence: 0.8,
          },
        ],
        totalMaterialCost: 100,
        extractionConfidence: 0.8,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vendorName: 'Unknown Vendor',
            quotedCost: undefined,
            notes: expect.stringContaining('confidence: 80%'),
          }),
        })
      );
    });

    it('should handle inactive budget items', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [
          {
            id: 'budget-item-1',
            name: 'Concrete Work',
            tradeType: 'CONCRETE',
            isActive: false, // Inactive
          },
        ],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Concrete',
            supplier: 'ABC Supply',
            quantity: 20,
            unit: 'cy',
            unitCost: 150,
            totalCost: 3000,
            tradeType: 'CONCRETE',
            deliveryNotes: null,
            confidence: 0.95,
          },
        ],
        totalMaterialCost: 3000,
        extractionConfidence: 0.95,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      // Should not link to inactive budget item
      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            budgetItem: expect.anything(),
          }),
        })
      );
    });

    it('should calculate quoted cost from unit cost and quantity', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Lumber',
            supplier: 'Lumber Yard',
            quantity: 100,
            unit: 'lf',
            unitCost: 5,
            totalCost: 500,
            tradeType: 'FRAMING',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 500,
        extractionConfidence: 0.9,
      };

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        new Date('2024-01-15')
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quotedCost: 500, // 100 * 5
          }),
        })
      );
    });

    it('should set procurement status to RECEIVED', async () => {
      const { saveMaterialEntries } = await import('@/lib/material-extraction-service');

      mocks.prisma.user.findFirst.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: [],
      });

      mocks.prisma.procurement.count.mockResolvedValue(0);
      mocks.prisma.procurement.create.mockResolvedValue({ id: 'proc-1' });

      const materialData = {
        materials: [
          {
            materialName: 'Test Material',
            supplier: 'Vendor',
            quantity: 10,
            unit: 'ea',
            unitCost: null,
            totalCost: 500,
            tradeType: 'GENERAL',
            deliveryNotes: null,
            confidence: 0.9,
          },
        ],
        totalMaterialCost: 500,
        extractionConfidence: 0.9,
      };

      const reportDate = new Date('2024-01-15');

      await saveMaterialEntries(
        'project-1',
        'conv-1',
        materialData,
        reportDate
      );

      expect(mocks.prisma.procurement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RECEIVED',
            actualDelivery: reportDate,
          }),
        })
      );
    });

    it('should handle materials from conversation with "sub" field instead of "supplier"', async () => {
      const { extractMaterialsFromReport } = await import('@/lib/material-extraction-service');

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          message: 'Test',
          response: 'Response',
          createdAt: new Date(),
        },
      ]);

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        materialDeliveries: [
          {
            material: 'Drywall',
            sub: 'Drywall Subcontractor', // Using "sub" instead of "supplier"
            quantity: 100,
            unit: 'sf',
            totalCost: 1500,
          },
        ],
      });

      mocks.openai.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                materials: [],
                totalMaterialCost: 0,
                extractionConfidence: 0,
              }),
            },
          },
        ],
      });

      const result = await extractMaterialsFromReport('conv-1', 'project-1');

      expect(result).not.toBeNull();
      expect(result?.materials).toHaveLength(1);
      expect(result?.materials[0].supplier).toBe('Drywall Subcontractor');
    });
  });
});
