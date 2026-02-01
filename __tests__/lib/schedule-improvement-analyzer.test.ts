import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies BEFORE importing the module
const mocks = vi.hoisted(() => ({
  prisma: {
    schedule: {
      findUnique: vi.fn(),
    },
    scheduleTask: {
      findMany: vi.fn(),
    },
    subcontractor: {
      findMany: vi.fn(),
    },
    projectBudget: {
      findUnique: vi.fn(),
    },
  },
  callAbacusLLM: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/abacus-llm', () => ({ callAbacusLLM: mocks.callAbacusLLM }));

// Import after mocks are set up
import {
  analyzeScheduleForImprovements,
  getCSIDivision,
  generateWBSCode,
  CSI_DIVISIONS,
  type ScheduleAnalysisResult,
  type ScheduleImprovementRecommendation,
} from '@/lib/schedule-improvement-analyzer';

describe('Schedule Improvement Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // analyzeScheduleForImprovements() - Main Function
  // ============================================

  describe('analyzeScheduleForImprovements()', () => {
    const mockSchedule = {
      id: 'schedule-1',
      projectId: 'project-1',
      name: 'Master Schedule',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      Project: {
        id: 'project-1',
        name: 'Test Construction Project',
      },
    };

    const mockTasks = [
      {
        id: 'task-1',
        scheduleId: 'schedule-1',
        taskId: 'A1010',
        name: 'Mobilization',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        duration: 5,
        predecessors: [],
        assignedTo: 'General Contractor',
        isCritical: true,
        wbsCode: '01.01.001',
        location: null,
      },
      {
        id: 'task-2',
        scheduleId: 'schedule-1',
        taskId: 'A1020',
        name: 'Concrete Foundation',
        startDate: new Date('2024-01-06'),
        endDate: new Date('2024-01-20'),
        duration: 15,
        predecessors: ['A1010'],
        assignedTo: 'Concrete',
        isCritical: true,
        wbsCode: '03.01.001',
        location: 'Foundation',
      },
      {
        id: 'task-3',
        scheduleId: 'schedule-1',
        taskId: 'A1030',
        name: 'Framing',
        startDate: new Date('2024-01-21'),
        endDate: new Date('2024-02-10'),
        duration: 21,
        predecessors: ['A1020'],
        assignedTo: 'Carpentry',
        isCritical: false,
        wbsCode: '06.01.001',
        location: 'Level 1',
      },
    ];

    const mockSubcontractors = [
      {
        id: 'sub-1',
        projectId: 'project-1',
        tradeType: 'Concrete',
        companyName: 'ABC Concrete',
      },
      {
        id: 'sub-2',
        projectId: 'project-1',
        tradeType: 'Carpentry',
        companyName: 'XYZ Carpentry',
      },
    ];

    const mockBudgetItems = [
      {
        id: 'budget-1',
        budgetedAmount: 50000,
        phaseName: 'Concrete',
        name: 'Foundation Work',
        description: 'Concrete foundation',
      },
      {
        id: 'budget-2',
        budgetedAmount: 75000,
        phaseName: 'Framing',
        name: 'Framing Work',
        description: 'Wood framing',
      },
    ];

    it('should successfully analyze a schedule with recommendations', async () => {
      mocks.prisma.schedule.findUnique.mockResolvedValue(mockSchedule);
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue(mockSubcontractors);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: mockBudgetItems,
      });
      mocks.callAbacusLLM.mockResolvedValue({
        content: 'Schedule has 3 tasks with good sequencing.',
      });

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result).toBeDefined();
      expect(result.scheduleId).toBe('schedule-1');
      expect(result.projectName).toBe('Test Construction Project');
      expect(result.overallHealth).toBe('fair'); // 'fair' because budget item 'Framing' doesn't match 'Carpentry' trade
      expect(result.healthScore).toBeGreaterThan(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      expect(result.summary).toContain('Schedule has 3 tasks');
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.metrics.totalTasks).toBe(3);
      expect(result.metrics.criticalPathLength).toBe(20); // 5 + 15
    });

    it('should throw error if schedule not found', async () => {
      mocks.prisma.schedule.findUnique.mockResolvedValue(null);

      await expect(analyzeScheduleForImprovements('nonexistent')).rejects.toThrow('Schedule not found');
    });

    it('should handle schedule with no project name', async () => {
      const scheduleNoProject = { ...mockSchedule, Project: null };
      mocks.prisma.schedule.findUnique.mockResolvedValue(scheduleNoProject);
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({ content: 'Analysis complete' });

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result.projectName).toBe('Unknown Project');
    });

    it('should handle empty task list', async () => {
      mocks.prisma.schedule.findUnique.mockResolvedValue(mockSchedule);
      mocks.prisma.scheduleTask.findMany.mockResolvedValue([]);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result.metrics.totalTasks).toBe(0);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.summary).toContain('0 recommendations');
    });

    it('should limit recommendations to top 20', async () => {
      // Create many tasks to generate lots of recommendations
      const manyTasks = Array.from({ length: 50 }, (_, i) => ({
        id: `task-${i}`,
        scheduleId: 'schedule-1',
        taskId: `A${i}`,
        name: `Task ${i}`,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-02'),
        duration: 1,
        predecessors: [],
        assignedTo: null, // Unassigned to trigger recommendations
        isCritical: i % 2 === 0,
        wbsCode: `01.01.${i.toString().padStart(3, '0')}`,
        location: null,
      }));

      mocks.prisma.schedule.findUnique.mockResolvedValue(mockSchedule);
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(manyTasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({ content: 'Many tasks analyzed' });

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result.recommendations.length).toBeLessThanOrEqual(20);
    });

    it('should calculate health score correctly based on recommendations', async () => {
      mocks.prisma.schedule.findUnique.mockResolvedValue(mockSchedule);
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue(mockSubcontractors);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(100);
      if (result.healthScore >= 80) {
        expect(result.overallHealth).toBe('good');
      } else if (result.healthScore >= 60) {
        expect(result.overallHealth).toBe('fair');
      } else {
        expect(result.overallHealth).toBe('poor');
      }
    });

    it('should use fallback summary when AI fails', async () => {
      mocks.prisma.schedule.findUnique.mockResolvedValue(mockSchedule);
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.callAbacusLLM.mockRejectedValue(new Error('AI service unavailable'));

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result.summary).toContain('recommendations');
      expect(result.summary).toContain('days');
    });

    it('should handle AI returning no content', async () => {
      mocks.prisma.schedule.findUnique.mockResolvedValue(mockSchedule);
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(mockTasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);
      mocks.callAbacusLLM.mockResolvedValue({ content: null });

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result.summary).toBeTruthy();
      expect(result.summary).toContain('recommendations');
    });
  });

  // ============================================
  // Sequencing Analysis Tests
  // ============================================

  describe('Sequencing Analysis', () => {
    it('should detect parallel opportunities in same phase', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Task 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
          location: 'Zone 1',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Task 2',
          startDate: new Date('2024-01-06'),
          endDate: new Date('2024-01-10'),
          duration: 5,
          predecessors: ['A1'],
          assignedTo: 'Trade B',
          isCritical: false,
          wbsCode: '01.01.002',
          location: 'Zone 2',
        },
        {
          id: 'task-3',
          scheduleId: 'schedule-1',
          taskId: 'A3',
          name: 'Task 3',
          startDate: new Date('2024-01-11'),
          endDate: new Date('2024-01-15'),
          duration: 5,
          predecessors: ['A2'],
          assignedTo: 'Trade C',
          isCritical: false,
          wbsCode: '01.01.003',
          location: 'Zone 3',
        },
        {
          id: 'task-4',
          scheduleId: 'schedule-1',
          taskId: 'A4',
          name: 'Task 4',
          startDate: new Date('2024-01-16'),
          endDate: new Date('2024-01-20'),
          duration: 5,
          predecessors: ['A3'],
          assignedTo: 'Trade D',
          isCritical: false,
          wbsCode: '01.01.004',
          location: 'Zone 4',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-20'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const sequencingRecs = result.recommendations.filter(r => r.category === 'sequencing');
      expect(sequencingRecs.length).toBeGreaterThan(0);
      const parallelRec = sequencingRecs.find(r => r.title.includes('Parallel opportunity'));
      expect(parallelRec).toBeDefined();
    });

    it('should suggest start-to-start relationships for long tasks', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Long Task 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-15'),
          duration: 15,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
          location: 'Zone 1',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Long Task 2',
          startDate: new Date('2024-01-16'),
          endDate: new Date('2024-01-30'),
          duration: 15,
          predecessors: ['A1'],
          assignedTo: 'Trade B',
          isCritical: false,
          wbsCode: '01.01.002',
          location: 'Zone 2',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-30'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const ssRecs = result.recommendations.filter(
        r => r.category === 'sequencing' && r.title.includes('SS relationship')
      );
      expect(ssRecs.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Resource Conflict Tests
  // ============================================

  describe('Resource Conflict Analysis', () => {
    it('should detect overlapping tasks for same trade', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Electrical Work Zone 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
          predecessors: [],
          assignedTo: 'Electrical',
          isCritical: false,
          wbsCode: '26.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Electrical Work Zone 2',
          startDate: new Date('2024-01-05'),
          endDate: new Date('2024-01-15'),
          duration: 11,
          predecessors: [],
          assignedTo: 'Electrical',
          isCritical: false,
          wbsCode: '26.01.002',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-15'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const resourceRecs = result.recommendations.filter(r => r.category === 'resource');
      const conflictRec = resourceRecs.find(r => r.title.includes('Resource conflict'));
      expect(conflictRec).toBeDefined();
      expect(conflictRec?.affectedTasks).toContain('Electrical Work Zone 1');
      expect(conflictRec?.affectedTasks).toContain('Electrical Work Zone 2');
    });

    it('should detect multiple unassigned tasks', async () => {
      // Create tasks with staggered dates to avoid resource conflicts
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        scheduleId: 'schedule-1',
        taskId: `A${i}`,
        name: `Unassigned Task ${i}`,
        startDate: new Date(2024, 0, 1 + i * 2), // Stagger by 2 days each
        endDate: new Date(2024, 0, 2 + i * 2),
        duration: 1,
        predecessors: [],
        assignedTo: null,
        isCritical: false,
        wbsCode: `01.01.${i.toString().padStart(3, '0')}`,
      }));

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-21'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const unassignedRec = result.recommendations.find(
        r => r.category === 'resource' && r.title.includes('unassigned tasks')
      );
      expect(unassignedRec).toBeDefined();
    });

    it('should detect missing subcontractor records', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Plumbing Work',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Plumbing',
          isCritical: false,
          wbsCode: '22.01.001',
        },
      ];

      const subs = [
        {
          id: 'sub-1',
          projectId: 'project-1',
          tradeType: 'Electrical',
          companyName: 'ABC Electric',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue(subs);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const missingSubRec = result.recommendations.find(
        r => r.category === 'resource' && r.title.includes('Missing subcontractor records')
      );
      expect(missingSubRec).toBeDefined();
    });
  });

  // ============================================
  // Duration Analysis Tests
  // ============================================

  describe('Duration Analysis', () => {
    it('should flag short critical tasks', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Critical Short Task',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-01'),
          duration: 1,
          predecessors: [],
          assignedTo: 'General Contractor',
          isCritical: true,
          wbsCode: '01.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-01'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const shortCriticalRec = result.recommendations.find(
        r => r.category === 'duration' && r.title.includes('Short critical task')
      );
      expect(shortCriticalRec).toBeDefined();
    });

    it('should flag long tasks that need breakdown', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Very Long Task',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-02-01'),
          duration: 31,
          predecessors: [],
          assignedTo: 'General Contractor',
          isCritical: false,
          wbsCode: '01.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-02-01'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const longTaskRec = result.recommendations.find(
        r => r.category === 'duration' && r.title.includes('Long task')
      );
      expect(longTaskRec).toBeDefined();
    });

    it('should detect budget items missing from schedule', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Framing',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-10'),
          duration: 10,
          predecessors: [],
          assignedTo: 'Carpentry',
          isCritical: false,
          wbsCode: '06.01.001',
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          budgetedAmount: 100000,
          phaseName: 'Plumbing',
          name: 'Plumbing Work',
          description: 'Major plumbing scope',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-10'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        totalBudget: 100000,
        BudgetItem: budgetItems,
      });

      const result = await analyzeScheduleForImprovements('schedule-1');

      const missingBudgetRec = result.recommendations.find(
        r => r.category === 'duration' && r.title.includes('Budget items missing from schedule')
      );
      expect(missingBudgetRec).toBeDefined();
    });
  });

  // ============================================
  // Dependency Analysis Tests
  // ============================================

  describe('Dependency Analysis', () => {
    it('should detect open-ended tasks without successors', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Open Task 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Open Task 2',
          startDate: new Date('2024-01-06'),
          endDate: new Date('2024-01-10'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade B',
          isCritical: false,
          wbsCode: '01.01.002',
        },
        {
          id: 'task-3',
          scheduleId: 'schedule-1',
          taskId: 'A3',
          name: 'Open Task 3',
          startDate: new Date('2024-01-11'),
          endDate: new Date('2024-01-15'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade C',
          isCritical: false,
          wbsCode: '01.01.003',
        },
        {
          id: 'task-4',
          scheduleId: 'schedule-1',
          taskId: 'A4',
          name: 'Open Task 4',
          startDate: new Date('2024-01-16'),
          endDate: new Date('2024-01-20'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade D',
          isCritical: false,
          wbsCode: '01.01.004',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-20'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const openEndedRec = result.recommendations.find(
        r => r.category === 'dependency' && r.title.includes('Open-ended tasks')
      );
      expect(openEndedRec).toBeDefined();
    });

    it('should detect dangling tasks without predecessors', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Dangling Task 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Dangling Task 2',
          startDate: new Date('2024-01-06'),
          endDate: new Date('2024-01-10'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade B',
          isCritical: false,
          wbsCode: '01.01.002',
        },
        {
          id: 'task-3',
          scheduleId: 'schedule-1',
          taskId: 'A3',
          name: 'Dangling Task 3',
          startDate: new Date('2024-01-11'),
          endDate: new Date('2024-01-15'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade C',
          isCritical: false,
          wbsCode: '01.01.003',
        },
        {
          id: 'task-4',
          scheduleId: 'schedule-1',
          taskId: 'A4',
          name: 'Dangling Task 4',
          startDate: new Date('2024-01-16'),
          endDate: new Date('2024-01-20'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade D',
          isCritical: false,
          wbsCode: '01.01.004',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-20'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const danglingRec = result.recommendations.find(
        r => r.category === 'dependency' && r.title.includes('Tasks without predecessors')
      );
      expect(danglingRec).toBeDefined();
    });

    it('should not flag mobilization or start tasks as dangling', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Mobilization',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'General Contractor',
          isCritical: true,
          wbsCode: '01.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Project Start',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-01'),
          duration: 1,
          predecessors: [],
          assignedTo: 'General Contractor',
          isCritical: true,
          wbsCode: '01.01.002',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const danglingRec = result.recommendations.find(
        r => r.category === 'dependency' && r.title.includes('Tasks without predecessors')
      );
      expect(danglingRec).toBeUndefined();
    });

    it('should detect circular dependencies', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Task A',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: ['A3'],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Task B',
          startDate: new Date('2024-01-06'),
          endDate: new Date('2024-01-10'),
          duration: 5,
          predecessors: ['A1'],
          assignedTo: 'Trade B',
          isCritical: false,
          wbsCode: '01.01.002',
        },
        {
          id: 'task-3',
          scheduleId: 'schedule-1',
          taskId: 'A3',
          name: 'Task C',
          startDate: new Date('2024-01-11'),
          endDate: new Date('2024-01-15'),
          duration: 5,
          predecessors: ['A2'],
          assignedTo: 'Trade C',
          isCritical: false,
          wbsCode: '01.01.003',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-15'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const circularRec = result.recommendations.find(
        r => r.category === 'dependency' && r.title.includes('circular dependency')
      );
      expect(circularRec).toBeDefined();
    });
  });

  // ============================================
  // Risk Factor Analysis Tests
  // ============================================

  describe('Risk Factor Analysis', () => {
    it('should flag high critical path concentration', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Critical Task 1',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: true,
          wbsCode: '01.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Critical Task 2',
          startDate: new Date('2024-01-06'),
          endDate: new Date('2024-01-10'),
          duration: 5,
          predecessors: ['A1'],
          assignedTo: 'Trade B',
          isCritical: true,
          wbsCode: '01.01.002',
        },
        {
          id: 'task-3',
          scheduleId: 'schedule-1',
          taskId: 'A3',
          name: 'Non-Critical Task',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade C',
          isCritical: false,
          wbsCode: '01.01.003',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-10'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const criticalPathRec = result.recommendations.find(
        r => r.category === 'risk' && r.title.includes('critical path concentration')
      );
      expect(criticalPathRec).toBeDefined();
    });

    it('should detect back-loaded schedules', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Early Task',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
        },
        // Tasks in second half (after Jul 2 midpoint) to trigger back-loaded detection
        // Use different trades to avoid resource conflicts
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `task-late-${i}`,
          scheduleId: 'schedule-1',
          taskId: `L${i}`,
          name: `Late Task ${i}`,
          startDate: new Date('2024-09-15'),
          endDate: new Date('2024-09-20'),
          duration: 5,
          predecessors: [],
          assignedTo: `Trade ${String.fromCharCode(66 + i)}`, // Trade B, C, D, etc.
          isCritical: false,
          wbsCode: `01.02.${i.toString().padStart(3, '0')}`,
        })),
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const backloadedRec = result.recommendations.find(
        r => r.category === 'risk' && r.title.includes('Back-loaded schedule')
      );
      expect(backloadedRec).toBeDefined();
    });

    it('should detect compressed finishes schedule', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Foundation',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-31'),
          duration: 90,
          predecessors: [],
          assignedTo: 'Concrete',
          isCritical: false,
          wbsCode: '03.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Painting',
          startDate: new Date('2024-04-01'),
          endDate: new Date('2024-04-02'),
          duration: 2,
          predecessors: ['A1'],
          assignedTo: 'Painting',
          isCritical: false,
          wbsCode: '09.01.001',
        },
        {
          id: 'task-3',
          scheduleId: 'schedule-1',
          taskId: 'A3',
          name: 'Flooring',
          startDate: new Date('2024-04-03'),
          endDate: new Date('2024-04-04'),
          duration: 2,
          predecessors: ['A2'],
          assignedTo: 'Flooring',
          isCritical: false,
          wbsCode: '09.02.001',
        },
        {
          id: 'task-4',
          scheduleId: 'schedule-1',
          taskId: 'A4',
          name: 'Ceiling',
          startDate: new Date('2024-04-05'),
          endDate: new Date('2024-04-06'),
          duration: 2,
          predecessors: ['A3'],
          assignedTo: 'Acoustical',
          isCritical: false,
          wbsCode: '09.03.001',
        },
        {
          id: 'task-5',
          scheduleId: 'schedule-1',
          taskId: 'A5',
          name: 'Drywall Finish',
          startDate: new Date('2024-04-07'),
          endDate: new Date('2024-04-08'),
          duration: 2,
          predecessors: ['A4'],
          assignedTo: 'Drywall',
          isCritical: false,
          wbsCode: '09.04.001',
        },
        {
          id: 'task-6',
          scheduleId: 'schedule-1',
          taskId: 'A6',
          name: 'Final Paint',
          startDate: new Date('2024-04-09'),
          endDate: new Date('2024-04-10'),
          duration: 2,
          predecessors: ['A5'],
          assignedTo: 'Painting',
          isCritical: false,
          wbsCode: '09.01.002',
        },
        {
          id: 'task-7',
          scheduleId: 'schedule-1',
          taskId: 'A7',
          name: 'Floor Tile Finish',
          startDate: new Date('2024-04-11'),
          endDate: new Date('2024-04-12'),
          duration: 2,
          predecessors: ['A6'],
          assignedTo: 'Tile',
          isCritical: false,
          wbsCode: '09.05.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-04-12'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const compressedFinishesRec = result.recommendations.find(
        r => r.category === 'risk' && r.title.includes('Compressed finishes')
      );
      expect(compressedFinishesRec).toBeDefined();
    });
  });

  // ============================================
  // Weather Risk Analysis Tests
  // ============================================

  describe('Weather Risk Analysis', () => {
    it('should flag winter concrete work', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Concrete Pour Foundation',
          startDate: new Date('2024-12-15'),
          endDate: new Date('2024-12-20'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Concrete',
          isCritical: false,
          wbsCode: '03.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-12-15'),
        endDate: new Date('2024-12-20'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const winterConcreteRec = result.recommendations.find(
        r => r.category === 'weather' && r.title.includes('Winter concrete')
      );
      expect(winterConcreteRec).toBeDefined();
      expect(winterConcreteRec?.priority).toBe('high');
    });

    it('should flag winter sitework', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Site Grading and Excavation',
          startDate: new Date('2024-01-15'),
          endDate: new Date('2024-01-25'),
          duration: 10,
          predecessors: [],
          assignedTo: 'Sitework',
          isCritical: false,
          wbsCode: '31.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-25'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const winterSiteworkRec = result.recommendations.find(
        r => r.category === 'weather' && r.title.includes('Winter sitework')
      );
      expect(winterSiteworkRec).toBeDefined();
      expect(winterSiteworkRec?.priority).toBe('medium');
    });

    it('should flag spring roofing work', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Roof Installation',
          startDate: new Date('2024-04-15'),
          endDate: new Date('2024-04-25'),
          duration: 10,
          predecessors: [],
          assignedTo: 'Roofing',
          isCritical: false,
          wbsCode: '07.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-04-15'),
        endDate: new Date('2024-04-25'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      const springRoofingRec = result.recommendations.find(
        r => r.category === 'weather' && r.title.includes('Spring roofing')
      );
      expect(springRoofingRec).toBeDefined();
      expect(springRoofingRec?.priority).toBe('low');
    });

    it('should calculate weather risk days in metrics', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Concrete Work',
          startDate: new Date('2024-12-15'),
          endDate: new Date('2024-12-20'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Concrete',
          isCritical: false,
          wbsCode: '03.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Excavation',
          startDate: new Date('2024-01-10'),
          endDate: new Date('2024-01-20'),
          duration: 10,
          predecessors: [],
          assignedTo: 'Sitework',
          isCritical: false,
          wbsCode: '31.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-10'),
        endDate: new Date('2024-12-20'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result.metrics.weatherRiskDays).toBeGreaterThan(0);
    });
  });

  // ============================================
  // CSI Division Helper Tests
  // ============================================

  describe('getCSIDivision()', () => {
    it('should return correct CSI division for concrete', () => {
      expect(getCSIDivision('Concrete')).toBe('03');
      expect(getCSIDivision('concrete work')).toBe('03');
      expect(getCSIDivision('CONCRETE')).toBe('03');
    });

    it('should return correct CSI division for electrical', () => {
      expect(getCSIDivision('Electrical')).toBe('26');
      expect(getCSIDivision('electrical work')).toBe('26');
      expect(getCSIDivision('Lighting')).toBe('26');
    });

    it('should return correct CSI division for plumbing', () => {
      expect(getCSIDivision('Plumbing')).toBe('22');
      expect(getCSIDivision('plumbing fixtures')).toBe('22');
    });

    it('should return correct CSI division for HVAC', () => {
      expect(getCSIDivision('HVAC')).toBe('23');
      expect(getCSIDivision('Mechanical')).toBe('23');
      expect(getCSIDivision('hvac systems')).toBe('23');
    });

    it('should return correct CSI division for roofing', () => {
      expect(getCSIDivision('Roofing')).toBe('07');
      expect(getCSIDivision('roofing work')).toBe('07'); // Contains 'roofing'
    });

    it('should return correct CSI division for drywall', () => {
      expect(getCSIDivision('Drywall')).toBe('09');
      expect(getCSIDivision('drywall installation')).toBe('09');
    });

    it('should return correct CSI division for sitework', () => {
      expect(getCSIDivision('Sitework')).toBe('31');
      expect(getCSIDivision('Excavation')).toBe('31');
      expect(getCSIDivision('Grading')).toBe('31');
    });

    it('should default to General Requirements for unknown trades', () => {
      expect(getCSIDivision('Unknown Trade')).toBe('01');
      expect(getCSIDivision('Custom Work')).toBe('01');
      expect(getCSIDivision('')).toBe('01');
    });

    it('should be case-insensitive', () => {
      expect(getCSIDivision('ELECTRICAL')).toBe('26');
      expect(getCSIDivision('electrical')).toBe('26');
      expect(getCSIDivision('Electrical')).toBe('26');
    });
  });

  // ============================================
  // WBS Code Generation Tests
  // ============================================

  describe('generateWBSCode()', () => {
    it('should generate correct WBS code format', () => {
      const code = generateWBSCode('Concrete', 1, 1);
      expect(code).toBe('03.01.001');
    });

    it('should pad phase and sequence with zeros', () => {
      const code = generateWBSCode('Electrical', 5, 25);
      expect(code).toBe('26.05.025');
    });

    it('should handle large sequence numbers', () => {
      const code = generateWBSCode('Plumbing', 10, 999);
      expect(code).toBe('22.10.999');
    });

    it('should work with single-digit phase and sequence', () => {
      const code = generateWBSCode('HVAC', 1, 1);
      expect(code).toBe('23.01.001');
    });

    it('should use correct CSI division for trade', () => {
      expect(generateWBSCode('Sitework', 1, 1)).toBe('31.01.001');
      expect(generateWBSCode('Roofing', 2, 3)).toBe('07.02.003');
      expect(generateWBSCode('Drywall', 3, 10)).toBe('09.03.010');
    });

    it('should default to 01 for unknown trades', () => {
      const code = generateWBSCode('Unknown', 1, 1);
      expect(code).toBe('01.01.001');
    });
  });

  // ============================================
  // CSI_DIVISIONS Constant Tests
  // ============================================

  describe('CSI_DIVISIONS constant', () => {
    it('should contain all standard CSI divisions', () => {
      expect(CSI_DIVISIONS['01']).toBeDefined();
      expect(CSI_DIVISIONS['01'].name).toBe('General Requirements');

      expect(CSI_DIVISIONS['03']).toBeDefined();
      expect(CSI_DIVISIONS['03'].name).toBe('Concrete');

      expect(CSI_DIVISIONS['26']).toBeDefined();
      expect(CSI_DIVISIONS['26'].name).toBe('Electrical');
    });

    it('should have trade arrays for each division', () => {
      expect(Array.isArray(CSI_DIVISIONS['03'].trades)).toBe(true);
      expect(CSI_DIVISIONS['03'].trades).toContain('Concrete');

      expect(Array.isArray(CSI_DIVISIONS['26'].trades)).toBe(true);
      expect(CSI_DIVISIONS['26'].trades).toContain('Electrical');
    });

    it('should include MEP divisions', () => {
      expect(CSI_DIVISIONS['21']).toBeDefined(); // Fire Suppression
      expect(CSI_DIVISIONS['22']).toBeDefined(); // Plumbing
      expect(CSI_DIVISIONS['23']).toBeDefined(); // HVAC
      expect(CSI_DIVISIONS['26']).toBeDefined(); // Electrical
    });

    it('should include sitework divisions', () => {
      expect(CSI_DIVISIONS['31']).toBeDefined(); // Earthwork
      expect(CSI_DIVISIONS['32']).toBeDefined(); // Exterior Improvements
      expect(CSI_DIVISIONS['33']).toBeDefined(); // Utilities
    });

    it('should include finishes division', () => {
      expect(CSI_DIVISIONS['09']).toBeDefined();
      expect(CSI_DIVISIONS['09'].name).toBe('Finishes');
      expect(CSI_DIVISIONS['09'].trades).toContain('Drywall');
      expect(CSI_DIVISIONS['09'].trades).toContain('Painting');
      expect(CSI_DIVISIONS['09'].trades).toContain('Flooring');
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should handle tasks with null dates gracefully', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Task with null dates',
          startDate: null,
          endDate: null,
          duration: 0,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result).toBeDefined();
      expect(result.metrics.totalTasks).toBe(1);
    });

    it('should handle tasks with zero duration', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Milestone',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-01'),
          duration: 0,
          predecessors: [],
          assignedTo: null,
          isCritical: false,
          wbsCode: '01.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-01'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result).toBeDefined();
    });

    it('should handle empty subcontractor list', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Task',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Electrical',
          isCritical: false,
          wbsCode: '26.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result.recommendations.some(r => r.category === 'resource')).toBe(true);
    });

    it('should handle null budget items', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Task',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-01-05'),
          duration: 5,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-05'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-1',
        projectId: 'project-1',
        BudgetItem: null,
      });

      const result = await analyzeScheduleForImprovements('schedule-1');

      expect(result).toBeDefined();
    });

    it('should sort recommendations by priority', async () => {
      const tasks = [
        {
          id: 'task-1',
          scheduleId: 'schedule-1',
          taskId: 'A1',
          name: 'Critical Short Task',
          startDate: new Date('2024-12-15'),
          endDate: new Date('2024-12-15'),
          duration: 1,
          predecessors: [],
          assignedTo: 'Concrete',
          isCritical: true,
          wbsCode: '03.01.001',
        },
        {
          id: 'task-2',
          scheduleId: 'schedule-1',
          taskId: 'A2',
          name: 'Long Task',
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-02-01'),
          duration: 31,
          predecessors: [],
          assignedTo: 'Trade A',
          isCritical: false,
          wbsCode: '01.01.001',
        },
      ];

      mocks.prisma.schedule.findUnique.mockResolvedValue({
        id: 'schedule-1',
        projectId: 'project-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        Project: { name: 'Test' },
      });
      mocks.prisma.scheduleTask.findMany.mockResolvedValue(tasks);
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      const result = await analyzeScheduleForImprovements('schedule-1');

      // Check that high priority comes before medium/low
      const priorities = result.recommendations.map(r => r.priority);
      let lastPriorityValue = -1;
      const priorityValues = { high: 0, medium: 1, low: 2 };

      priorities.forEach(priority => {
        const value = priorityValues[priority];
        expect(value).toBeGreaterThanOrEqual(lastPriorityValue);
        lastPriorityValue = value;
      });
    });
  });
});
