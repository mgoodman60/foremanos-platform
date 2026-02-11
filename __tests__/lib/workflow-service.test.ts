import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectType, TradeType } from '@prisma/client';

const mockPrisma = vi.hoisted(() => ({
  workflowTemplate: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  workflowResponse: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  userReportingPattern: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
  },
  document: {
    findMany: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

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

// Import after mocks
import {
  getWorkflowById,
  getWorkflowTemplate,
  getAvailableWorkflows,
  createWorkflowTemplate,
  saveWorkflowResponse,
  getWorkflowResponses,
  updateReportingPattern,
  getReportingPattern,
  getNextSteps,
  getNextStepsForWorkflow,
  getScheduleContext,
  getTradeDisplayName,
} from '@/lib/workflow-service';

describe('workflow-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWorkflowById', () => {
    it('should fetch workflow template by ID with steps', async () => {
      const mockTemplate = {
        id: 'workflow-123',
        name: 'Daily Report Workflow',
        WorkflowStep: [
          { id: 'step1', question: 'Weather conditions?', order: 1 },
          { id: 'step2', question: 'Crew size?', order: 2 },
        ],
      };

      mockPrisma.workflowTemplate.findUnique.mockResolvedValueOnce(mockTemplate);

      const result = await getWorkflowById('workflow-123');

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.workflowTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'workflow-123' },
        include: {
          WorkflowStep: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should return null if workflow not found', async () => {
      mockPrisma.workflowTemplate.findUnique.mockResolvedValueOnce(null);

      const result = await getWorkflowById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors and return null', async () => {
      mockPrisma.workflowTemplate.findUnique.mockRejectedValueOnce(new Error('Database error'));

      const result = await getWorkflowById('workflow-123');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getWorkflowTemplate', () => {
    it('should fetch workflow template by project type and trade', async () => {
      const mockTemplate = {
        id: 'workflow-123',
        name: 'Commercial Construction',
        projectType: 'new_construction' as ProjectType,
        tradeType: 'general_contractor' as TradeType,
        isActive: true,
        WorkflowStep: [],
      };

      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce(mockTemplate);

      const result = await getWorkflowTemplate('new_construction', 'general_contractor');

      expect(result).toEqual(mockTemplate);
      expect(mockPrisma.workflowTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          projectType: 'new_construction',
          tradeType: 'general_contractor',
          isActive: true,
        },
        include: {
          WorkflowStep: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should return null if no matching template found', async () => {
      mockPrisma.workflowTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await getWorkflowTemplate('renovation', 'electrical');

      expect(result).toBeNull();
    });
  });

  describe('getAvailableWorkflows', () => {
    it('should fetch all active workflows for a project type', async () => {
      const mockTemplates = [
        {
          id: 'workflow-1',
          name: 'General Contractor Workflow',
          projectType: 'new_construction',
          priority: 10,
          WorkflowStep: [{ id: 'step1' }, { id: 'step2' }],
        },
        {
          id: 'workflow-2',
          name: 'Electrical Workflow',
          projectType: 'new_construction',
          priority: 5,
          WorkflowStep: [{ id: 'step3' }],
        },
      ];

      mockPrisma.workflowTemplate.findMany.mockResolvedValueOnce(mockTemplates);

      const result = await getAvailableWorkflows('new_construction');

      expect(result).toHaveLength(2);
      expect(mockPrisma.workflowTemplate.findMany).toHaveBeenCalledWith({
        where: {
          projectType: 'new_construction',
          isActive: true,
        },
        include: {
          WorkflowStep: {
            orderBy: { order: 'asc' },
            take: 3,
          },
        },
        orderBy: { priority: 'desc' },
      });
    });

    it('should return empty array on error', async () => {
      mockPrisma.workflowTemplate.findMany.mockRejectedValueOnce(new Error('Database error'));

      const result = await getAvailableWorkflows('new_construction');

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createWorkflowTemplate', () => {
    it('should create workflow template with steps', async () => {
      const mockData = {
        name: 'New Workflow',
        description: 'Test workflow',
        projectType: 'new_construction' as ProjectType,
        tradeType: 'general_contractor' as TradeType,
        steps: [
          {
            question: 'What is the weather?',
            order: 1,
            stepType: 'select' as const,
            options: ['Sunny', 'Rainy'],
            isRequired: true,
          },
          {
            question: 'Crew size?',
            order: 2,
            stepType: 'number' as const,
            isRequired: true,
          },
        ],
      };

      const mockCreated = {
        id: 'workflow-123',
        ...mockData,
        WorkflowStep: mockData.steps,
      };

      mockPrisma.workflowTemplate.create.mockResolvedValueOnce(mockCreated);

      const result = await createWorkflowTemplate(mockData);

      expect(result.id).toBe('workflow-123');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'WORKFLOW',
        'Created template',
        expect.objectContaining({ name: 'New Workflow' })
      );
    });

    it('should handle optional step fields', async () => {
      const mockData = {
        name: 'Simple Workflow',
        projectType: 'renovation' as ProjectType,
        tradeType: 'plumbing' as TradeType,
        steps: [
          {
            question: 'Basic question?',
            order: 1,
            stepType: 'yes_no' as const,
          },
        ],
      };

      mockPrisma.workflowTemplate.create.mockResolvedValueOnce({
        id: 'workflow-123',
        ...mockData,
      });

      const result = await createWorkflowTemplate(mockData);

      expect(result).toBeDefined();
    });

    it('should throw error on creation failure', async () => {
      mockPrisma.workflowTemplate.create.mockRejectedValueOnce(new Error('Database error'));

      const mockData = {
        name: 'Test',
        projectType: 'new_construction' as ProjectType,
        tradeType: 'general_contractor' as TradeType,
        steps: [],
      };

      await expect(createWorkflowTemplate(mockData)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('saveWorkflowResponse', () => {
    it('should save workflow response with all fields', async () => {
      const mockResponse = {
        id: 'response-123',
        conversationId: 'conv-123',
        workflowId: 'workflow-123',
        stepId: 'step-123',
        response: 'Sunny',
        responseData: { temperature: 75 },
        timeToRespond: 1500,
      };

      mockPrisma.workflowResponse.create.mockResolvedValueOnce(mockResponse);

      const result = await saveWorkflowResponse(
        'conv-123',
        'workflow-123',
        'step-123',
        'Sunny',
        { temperature: 75 },
        1500
      );

      expect(result).toEqual(mockResponse);
      expect(mockPrisma.workflowResponse.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv-123',
          workflowId: 'workflow-123',
          stepId: 'step-123',
          response: 'Sunny',
          responseData: { temperature: 75 },
          timeToRespond: 1500,
        },
      });
    });

    it('should save response without optional fields', async () => {
      const mockResponse = {
        id: 'response-123',
        conversationId: 'conv-123',
        workflowId: 'workflow-123',
        stepId: 'step-123',
        response: 'Yes',
      };

      mockPrisma.workflowResponse.create.mockResolvedValueOnce(mockResponse);

      const result = await saveWorkflowResponse(
        'conv-123',
        'workflow-123',
        'step-123',
        'Yes'
      );

      expect(result).toBeDefined();
    });

    it('should return null on error', async () => {
      mockPrisma.workflowResponse.create.mockRejectedValueOnce(new Error('Database error'));

      const result = await saveWorkflowResponse('conv-123', 'workflow-123', 'step-123', 'Yes');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getWorkflowResponses', () => {
    it('should fetch all responses for a conversation', async () => {
      const mockResponses = [
        {
          id: 'response-1',
          conversationId: 'conv-123',
          response: 'Sunny',
          WorkflowStep: { question: 'Weather?' },
          WorkflowTemplate: { name: 'Daily Report' },
        },
        {
          id: 'response-2',
          conversationId: 'conv-123',
          response: '5',
          WorkflowStep: { question: 'Crew size?' },
          WorkflowTemplate: { name: 'Daily Report' },
        },
      ];

      mockPrisma.workflowResponse.findMany.mockResolvedValueOnce(mockResponses);

      const result = await getWorkflowResponses('conv-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.workflowResponse.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-123' },
        include: {
          WorkflowStep: true,
          WorkflowTemplate: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return empty array on error', async () => {
      mockPrisma.workflowResponse.findMany.mockRejectedValueOnce(new Error('Database error'));

      const result = await getWorkflowResponses('conv-123');

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('updateReportingPattern', () => {
    it('should create new reporting pattern', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-123',
        projectId: 'project-123',
        preferredTradeType: 'electrical' as TradeType,
        reportingStyle: 'detailed',
        reportsCompleted: 1,
        workflowsUsed: 1,
      };

      mockPrisma.userReportingPattern.upsert.mockResolvedValueOnce(mockPattern);

      const result = await updateReportingPattern('user-123', 'project-123', {
        preferredTradeType: 'electrical',
        reportingStyle: 'detailed',
        commonKeywords: ['wire', 'conduit'],
      });

      expect(result).toEqual(mockPattern);
      expect(mockPrisma.userReportingPattern.upsert).toHaveBeenCalledWith({
        where: {
          userId_projectId: {
            userId: 'user-123',
            projectId: 'project-123',
          },
        },
        create: expect.objectContaining({
          userId: 'user-123',
          projectId: 'project-123',
          preferredTradeType: 'electrical',
          reportsCompleted: 1,
        }),
        update: expect.objectContaining({
          preferredTradeType: 'electrical',
          reportsCompleted: { increment: 1 },
        }),
      });
    });

    it('should update existing reporting pattern', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-123',
        projectId: 'project-123',
        reportsCompleted: 5,
        workflowsUsed: 3,
      };

      mockPrisma.userReportingPattern.upsert.mockResolvedValueOnce(mockPattern);

      const result = await updateReportingPattern('user-123', 'project-123', {
        preferredQuestions: ['weather', 'crew'],
      });

      expect(result).toBeDefined();
    });

    it('should return null on error', async () => {
      mockPrisma.userReportingPattern.upsert.mockRejectedValueOnce(new Error('Database error'));

      const result = await updateReportingPattern('user-123', 'project-123', {});

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getReportingPattern', () => {
    it('should fetch reporting pattern for user and project', async () => {
      const mockPattern = {
        id: 'pattern-123',
        userId: 'user-123',
        projectId: 'project-123',
        preferredTradeType: 'plumbing' as TradeType,
        reportsCompleted: 10,
      };

      mockPrisma.userReportingPattern.findUnique.mockResolvedValueOnce(mockPattern);

      const result = await getReportingPattern('user-123', 'project-123');

      expect(result).toEqual(mockPattern);
      expect(mockPrisma.userReportingPattern.findUnique).toHaveBeenCalledWith({
        where: {
          userId_projectId: {
            userId: 'user-123',
            projectId: 'project-123',
          },
        },
      });
    });

    it('should return null if pattern not found', async () => {
      mockPrisma.userReportingPattern.findUnique.mockResolvedValueOnce(null);

      const result = await getReportingPattern('user-123', 'project-123');

      expect(result).toBeNull();
    });
  });

  describe('getNextSteps', () => {
    it('should return uncompleted steps', () => {
      const allSteps = [
        { id: 'step1', order: 1, question: 'Q1' },
        { id: 'step2', order: 2, question: 'Q2' },
        { id: 'step3', order: 3, question: 'Q3' },
      ];

      const completedResponses = [{ stepId: 'step1', response: 'A1' }];

      const result = getNextSteps(allSteps, completedResponses);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('step2');
      expect(result[1].id).toBe('step3');
    });

    it('should apply conditional logic', () => {
      const allSteps = [
        { id: 'step1', order: 1, question: 'Was there a delay?' },
        {
          id: 'step2',
          order: 2,
          question: 'What caused the delay?',
          conditionalOn: 'step1',
          conditionalValue: 'Yes',
        },
        { id: 'step3', order: 3, question: 'Work performed?' },
      ];

      const completedResponses = [{ stepId: 'step1', response: 'No' }];

      const result = getNextSteps(allSteps, completedResponses);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('step3');
    });

    it('should include conditional step when condition met', () => {
      const allSteps = [
        { id: 'step1', order: 1, question: 'Was there a delay?' },
        {
          id: 'step2',
          order: 2,
          question: 'What caused the delay?',
          conditionalOn: 'step1',
          conditionalValue: 'Yes',
        },
      ];

      const completedResponses = [{ stepId: 'step1', response: 'Yes' }];

      const result = getNextSteps(allSteps, completedResponses);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('step2');
    });

    it('should limit results to 5 steps', () => {
      const allSteps = Array.from({ length: 10 }, (_, i) => ({
        id: `step${i + 1}`,
        order: i + 1,
        question: `Q${i + 1}`,
      }));

      const completedResponses: any[] = [];

      const result = getNextSteps(allSteps, completedResponses);

      expect(result).toHaveLength(5);
    });
  });

  describe('getNextStepsForWorkflow', () => {
    it('should fetch workflow and return next steps', async () => {
      const mockWorkflow = {
        id: 'workflow-123',
        WorkflowStep: [
          { id: 'step1', order: 1, question: 'Q1' },
          { id: 'step2', order: 2, question: 'Q2' },
          { id: 'step3', order: 3, question: 'Q3' },
        ],
      };

      mockPrisma.workflowTemplate.findUnique.mockResolvedValueOnce(mockWorkflow);

      const result = await getNextStepsForWorkflow('workflow-123', { step1: 'A1' });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('step2');
    });

    it('should return empty array if workflow not found', async () => {
      mockPrisma.workflowTemplate.findUnique.mockResolvedValueOnce(null);

      const result = await getNextStepsForWorkflow('nonexistent', {});

      expect(result).toEqual([]);
    });
  });

  describe('getScheduleContext', () => {
    it('should fetch schedule context from document chunks', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([
        { id: 'doc-123', name: 'Project Schedule' },
      ]);

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          content: 'Foundation work scheduled for week 1-2',
          metadata: { activities: 'Foundation, excavation' },
        },
        {
          content: 'Framing scheduled for week 3-4',
          metadata: null,
        },
      ]);

      const result = await getScheduleContext('project-123', 'foundation');

      expect(result).toContain('Scheduled: Foundation, excavation');
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-123',
          OR: [
            { category: 'schedule' },
            { name: { contains: 'schedule', mode: 'insensitive' } },
          ],
        },
        take: 1,
      });
    });

    it('should return null if no schedule documents found', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([]);

      const result = await getScheduleContext('project-123', 'foundation');

      expect(result).toBeNull();
    });

    it('should return null if no matching chunks found', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([
        { id: 'doc-123', name: 'Project Schedule' },
      ]);

      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([]);

      const result = await getScheduleContext('project-123', 'foundation');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.document.findMany.mockRejectedValueOnce(new Error('Database error'));

      const result = await getScheduleContext('project-123', 'foundation');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getTradeDisplayName', () => {
    it('should return display name for each trade type', () => {
      expect(getTradeDisplayName('general_contractor')).toBe('General Contractor / Superintendent');
      expect(getTradeDisplayName('concrete_masonry')).toBe('Concrete & Masonry');
      expect(getTradeDisplayName('carpentry_framing')).toBe('Carpentry & Framing');
      expect(getTradeDisplayName('electrical')).toBe('Electrical');
      expect(getTradeDisplayName('plumbing')).toBe('Plumbing');
      expect(getTradeDisplayName('hvac_mechanical')).toBe('HVAC & Mechanical');
      expect(getTradeDisplayName('drywall_finishes')).toBe('Drywall & Finishes');
      expect(getTradeDisplayName('site_utilities')).toBe('Site Utilities');
      expect(getTradeDisplayName('structural_steel')).toBe('Structural Steel');
      expect(getTradeDisplayName('roofing')).toBe('Roofing');
      expect(getTradeDisplayName('glazing_windows')).toBe('Glazing & Windows');
      expect(getTradeDisplayName('painting_coating')).toBe('Painting & Coating');
      expect(getTradeDisplayName('flooring')).toBe('Flooring');
    });
  });
});
