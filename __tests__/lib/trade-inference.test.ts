import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TRADE_TYPES,
  TRADE_DISPLAY_NAMES,
  inferTradesForSchedule,
  setTaskTrade,
  getTasksNeedingClarification,
  getTaskTradeDisplay,
} from '@/lib/trade-inference';

const mockPrisma = vi.hoisted(() => ({
  scheduleTask: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  subcontractor: {
    findMany: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  schedule: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockCallAbacusLLM = vi.hoisted(() => vi.fn());
vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: mockCallAbacusLLM,
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

describe('trade-inference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TRADE_TYPES constant', () => {
    it('should export valid trade types', () => {
      expect(TRADE_TYPES).toContain('electrical');
      expect(TRADE_TYPES).toContain('plumbing');
      expect(TRADE_TYPES).toContain('hvac_mechanical');
      expect(TRADE_TYPES).toContain('general_contractor');
      expect(TRADE_TYPES.length).toBeGreaterThan(10);
    });
  });

  describe('TRADE_DISPLAY_NAMES constant', () => {
    it('should have display names for all trade types', () => {
      expect(TRADE_DISPLAY_NAMES['electrical']).toBe('Electrical');
      expect(TRADE_DISPLAY_NAMES['plumbing']).toBe('Plumbing');
      expect(TRADE_DISPLAY_NAMES['hvac_mechanical']).toBe('HVAC/Mechanical');
    });
  });

  describe('inferTradesForSchedule', () => {
    const mockScheduleId = 'schedule-123';
    const mockProjectId = 'project-123';

    it('should successfully infer trades for tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          taskId: 'A1000',
          name: 'Install electrical panel',
          description: 'Main service panel installation',
          tradeType: null,
          subcontractorId: null,
          inferredTradeType: null,
        },
      ];

      const mockSubcontractors = [
        {
          id: 'sub-1',
          companyName: 'ABC Electric',
          tradeType: 'electrical',
        },
      ];

      const mockAIResponse = JSON.stringify([
        {
          taskId: 'A1000',
          tradeType: 'electrical',
          confidence: 95,
          reasoning: 'Task explicitly mentions electrical panel installation',
        },
      ]);

      mockPrisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mockPrisma.subcontractor.findMany.mockResolvedValue(mockSubcontractors);
      mockCallAbacusLLM.mockResolvedValue({
        content: mockAIResponse,
        model: 'claude-sonnet-4-20250514',
      });
      mockPrisma.scheduleTask.update.mockResolvedValue(mockTasks[0]);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await inferTradesForSchedule(mockScheduleId, mockProjectId);

      expect(result.updated).toBe(1);
      expect(result.needsClarification).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({
            inferredTradeType: 'electrical',
            tradeInferenceConfidence: 95,
            tradeInferenceSource: 'ai',
            tradeNeedsClarification: false,
            subcontractorId: 'sub-1',
          }),
        })
      );
    });

    it('should flag low confidence inferences for clarification', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          taskId: 'A2000',
          name: 'Miscellaneous work',
          description: '',
          tradeType: null,
          subcontractorId: null,
          inferredTradeType: null,
        },
      ];

      const mockAIResponse = JSON.stringify([
        {
          taskId: 'A2000',
          tradeType: 'general_contractor',
          confidence: 50,
          reasoning: 'Unclear task description',
        },
      ]);

      mockPrisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);
      mockCallAbacusLLM.mockResolvedValue({
        content: mockAIResponse,
        model: 'claude-sonnet-4-20250514',
      });
      mockPrisma.scheduleTask.update.mockResolvedValue(mockTasks[0]);
      mockPrisma.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        name: 'Test Project',
        ownerId: 'user-1',
      });
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await inferTradesForSchedule(mockScheduleId, mockProjectId);

      expect(result.needsClarification).toBe(1);
      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tradeNeedsClarification: true,
            tradeClarificationNote: 'Unclear task description',
          }),
        })
      );
      expect(mockPrisma.notification.create).toHaveBeenCalled();
    });

    it('should skip tasks that already have assignments', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          taskId: 'A1000',
          name: 'Electrical work',
          description: '',
          tradeType: null,
          subcontractorId: 'sub-1',
          inferredTradeType: null,
        },
      ];

      mockPrisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);

      const result = await inferTradesForSchedule(mockScheduleId, mockProjectId);

      expect(result.updated).toBe(0);
      expect(mockCallAbacusLLM).not.toHaveBeenCalled();
    });

    it('should handle batch processing errors gracefully', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          taskId: 'A1000',
          name: 'Work',
          description: '',
          tradeType: null,
          subcontractorId: null,
          inferredTradeType: null,
        },
      ];

      mockPrisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);
      mockCallAbacusLLM.mockRejectedValue(new Error('API error'));

      const result = await inferTradesForSchedule(mockScheduleId, mockProjectId);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('API error');
    });

    it('should handle invalid JSON response from AI', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          taskId: 'A1000',
          name: 'Work',
          description: '',
          tradeType: null,
          subcontractorId: null,
          inferredTradeType: null,
        },
      ];

      mockPrisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);
      mockCallAbacusLLM.mockResolvedValue({
        content: 'Not valid JSON',
        model: 'claude-sonnet-4-20250514',
      });
      mockPrisma.scheduleTask.update.mockResolvedValue(mockTasks[0]);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await inferTradesForSchedule(mockScheduleId, mockProjectId);

      expect(result.updated).toBe(1);
      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inferredTradeType: 'general_contractor',
            tradeInferenceConfidence: 50,
            tradeNeedsClarification: true,
          }),
        })
      );
    });

    it('should normalize trade type variations', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          taskId: 'A1000',
          name: 'Electrical work',
          description: '',
          tradeType: null,
          subcontractorId: null,
          inferredTradeType: null,
        },
      ];

      const mockAIResponse = JSON.stringify([
        {
          taskId: 'A1000',
          tradeType: 'electric', // Variation
          confidence: 90,
          reasoning: 'Clear match',
        },
      ]);

      mockPrisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);
      mockCallAbacusLLM.mockResolvedValue({
        content: mockAIResponse,
        model: 'claude-sonnet-4-20250514',
      });
      mockPrisma.scheduleTask.update.mockResolvedValue(mockTasks[0]);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await inferTradesForSchedule(mockScheduleId, mockProjectId);

      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inferredTradeType: 'electrical',
          }),
        })
      );
    });

    it('should clamp confidence to 0-100 range', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          taskId: 'A1000',
          name: 'Work',
          description: '',
          tradeType: null,
          subcontractorId: null,
          inferredTradeType: null,
        },
      ];

      const mockAIResponse = JSON.stringify([
        {
          taskId: 'A1000',
          tradeType: 'electrical',
          confidence: 150, // Over 100
          reasoning: 'Test',
        },
      ]);

      mockPrisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);
      mockCallAbacusLLM.mockResolvedValue({
        content: mockAIResponse,
        model: 'claude-sonnet-4-20250514',
      });
      mockPrisma.scheduleTask.update.mockResolvedValue(mockTasks[0]);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await inferTradesForSchedule(mockScheduleId, mockProjectId);

      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tradeInferenceConfidence: 100,
          }),
        })
      );
    });
  });

  describe('setTaskTrade', () => {
    it('should manually set trade for a task', async () => {
      const taskId = 'task-1';
      const tradeType = 'electrical';
      const subcontractorId = 'sub-1';

      mockPrisma.scheduleTask.update.mockResolvedValue({
        id: taskId,
        inferredTradeType: tradeType,
      });

      await setTaskTrade(taskId, tradeType, subcontractorId);

      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: taskId },
        data: {
          inferredTradeType: tradeType,
          tradeInferenceConfidence: 100,
          tradeInferenceSource: 'manual',
          tradeNeedsClarification: false,
          tradeClarificationNote: null,
          subcontractorId: subcontractorId,
        },
      });
    });

    it('should handle null subcontractorId', async () => {
      const taskId = 'task-1';
      const tradeType = 'plumbing';

      mockPrisma.scheduleTask.update.mockResolvedValue({});

      await setTaskTrade(taskId, tradeType);

      expect(mockPrisma.scheduleTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subcontractorId: null,
          }),
        })
      );
    });
  });

  describe('getTasksNeedingClarification', () => {
    it('should return tasks needing clarification', async () => {
      const projectId = 'project-123';
      const mockSchedules = [{ id: 'schedule-1' }, { id: 'schedule-2' }];
      const mockTasks = [
        {
          id: 'task-1',
          taskId: 'A1000',
          name: 'Unclear work',
          inferredTradeType: 'general_contractor',
          tradeInferenceConfidence: 45,
          tradeClarificationNote: 'Needs clarification',
        },
      ];

      mockPrisma.schedule.findMany.mockResolvedValue(mockSchedules);
      mockPrisma.scheduleTask.findMany.mockResolvedValue(mockTasks);

      const result = await getTasksNeedingClarification(projectId);

      expect(result).toHaveLength(1);
      expect(result[0].taskId).toBe('A1000');
      expect(mockPrisma.scheduleTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tradeNeedsClarification: true,
          }),
          orderBy: { tradeInferenceConfidence: 'asc' },
        })
      );
    });

    it('should handle projects with no schedules', async () => {
      mockPrisma.schedule.findMany.mockResolvedValue([]);
      mockPrisma.scheduleTask.findMany.mockResolvedValue([]);

      const result = await getTasksNeedingClarification('project-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getTaskTradeDisplay', () => {
    it('should display subcontractor name when assigned', () => {
      const task = {
        subcontractorId: 'sub-1',
        Subcontractor: {
          companyName: 'ABC Electric',
          tradeType: 'electrical',
        },
      };

      const result = getTaskTradeDisplay(task);

      expect(result.displayName).toBe('ABC Electric');
      expect(result.source).toBe('subcontractor');
      expect(result.confidence).toBe(100);
    });

    it('should display inferred trade type when no subcontractor', () => {
      const task = {
        subcontractorId: null,
        Subcontractor: null,
        inferredTradeType: 'plumbing',
        tradeInferenceConfidence: 85,
      };

      const result = getTaskTradeDisplay(task);

      expect(result.displayName).toBe('Plumbing');
      expect(result.source).toBe('inferred');
      expect(result.confidence).toBe(85);
    });

    it('should display manual trade type when set', () => {
      const task = {
        subcontractorId: null,
        Subcontractor: null,
        inferredTradeType: null,
        tradeType: 'hvac_mechanical',
      };

      const result = getTaskTradeDisplay(task);

      expect(result.displayName).toBe('HVAC/Mechanical');
      expect(result.source).toBe('manual');
      expect(result.confidence).toBe(100);
    });

    it('should display Unassigned when no trade info', () => {
      const task = {
        subcontractorId: null,
        Subcontractor: null,
        inferredTradeType: null,
        tradeType: null,
      };

      const result = getTaskTradeDisplay(task);

      expect(result.displayName).toBe('Unassigned');
      expect(result.source).toBe('unknown');
      expect(result.confidence).toBeNull();
    });

    it('should handle unknown trade types gracefully', () => {
      const task = {
        subcontractorId: null,
        Subcontractor: null,
        inferredTradeType: 'unknown_trade',
        tradeInferenceConfidence: 70,
      };

      const result = getTaskTradeDisplay(task);

      expect(result.displayName).toBe('unknown_trade');
      expect(result.source).toBe('inferred');
    });
  });
});
