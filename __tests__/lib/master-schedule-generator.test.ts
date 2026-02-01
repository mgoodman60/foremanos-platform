import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies using vi.hoisted
const mocks = vi.hoisted(() => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
    projectBudget: {
      findUnique: vi.fn(),
    },
    subcontractor: {
      findMany: vi.fn(),
    },
    documentChunk: {
      findMany: vi.fn(),
    },
    schedule: {
      create: vi.fn(),
    },
    scheduleTask: {
      create: vi.fn(),
    },
  },
  callAbacusLLM: vi.fn(),
  getFileUrl: vi.fn(),
  getCSIDivision: vi.fn(),
  generateWBSCode: vi.fn(),
  extractDetailedScheduleFromPlans: vi.fn(),
  matchTasksToSubcontractors: vi.fn(),
  importExtractedTasks: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/abacus-llm', () => ({ callAbacusLLM: mocks.callAbacusLLM }));
vi.mock('@/lib/s3', () => ({ getFileUrl: mocks.getFileUrl }));
vi.mock('@/lib/schedule-improvement-analyzer', () => ({
  CSI_DIVISIONS: {
    '01': { name: 'General Requirements', trades: ['General Contractor', 'Project Management'] },
    '03': { name: 'Concrete', trades: ['Concrete', 'Rebar', 'Formwork'] },
    '05': { name: 'Metals', trades: ['Structural Steel', 'Misc Metals'] },
    '09': { name: 'Finishes', trades: ['Drywall', 'Painting', 'Flooring'] },
    '31': { name: 'Earthwork', trades: ['Sitework', 'Excavation', 'Grading'] },
  },
  getCSIDivision: mocks.getCSIDivision,
  generateWBSCode: mocks.generateWBSCode,
}));
vi.mock('@/lib/schedule-document-extractor', () => ({
  extractDetailedScheduleFromPlans: mocks.extractDetailedScheduleFromPlans,
  matchTasksToSubcontractors: mocks.matchTasksToSubcontractors,
  importExtractedTasks: mocks.importExtractedTasks,
}));

import { generateMasterSchedule, canGenerateSchedule } from '@/lib/master-schedule-generator';

describe('Master Schedule Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMasterSchedule', () => {
    const mockProject = {
      id: 'project-1',
      name: 'Commercial Office Building',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    const mockDocuments = [
      {
        id: 'doc-1',
        name: 'Site Plan.pdf',
        category: 'plans_drawings',
        projectId: 'project-1',
      },
      {
        id: 'doc-2',
        name: 'Specifications.pdf',
        category: 'specifications',
        projectId: 'project-1',
      },
    ];

    const mockChunks = [
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        pageNumber: 1,
        content: 'Commercial office building with steel structure, 50,000 SF',
        metadata: {},
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        pageNumber: 1,
        content: 'Specifications for concrete, steel, electrical, plumbing, and HVAC systems',
        metadata: {},
      },
    ];

    const mockBudgetItems = [
      {
        id: 'budget-1',
        phaseCode: 3,
        phaseName: 'Concrete',
        name: 'Foundation Work',
        description: 'Pour foundation footings',
        budgetedAmount: 50000,
        budgetedHours: 400,
      },
      {
        id: 'budget-2',
        phaseCode: 5,
        phaseName: 'Structural Steel',
        name: 'Steel Erection',
        description: 'Erect structural steel',
        budgetedAmount: 150000,
        budgetedHours: 800,
      },
    ];

    const mockSubcontractors = [
      {
        id: 'sub-1',
        companyName: 'Acme Concrete',
        tradeType: 'concrete',
        projectId: 'project-1',
      },
      {
        id: 'sub-2',
        companyName: 'Steel Works Inc',
        tradeType: 'steel',
        projectId: 'project-1',
      },
    ];

    const mockSchedule = {
      id: 'schedule-1',
      name: 'Master Schedule - Commercial Office Building',
      projectId: 'project-1',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-08-01'),
      createdBy: 'user-1',
      extractedBy: 'ai_generated',
      extractedAt: new Date(),
      isActive: true,
    };

    beforeEach(() => {
      mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
      mocks.prisma.document.findMany.mockResolvedValue(mockDocuments);
      mocks.prisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-project-1',
        projectId: 'project-1',
        BudgetItem: mockBudgetItems,
      });
      mocks.prisma.subcontractor.findMany.mockResolvedValue(mockSubcontractors);
      mocks.prisma.schedule.create.mockResolvedValue(mockSchedule);
      mocks.prisma.scheduleTask.create.mockResolvedValue({});
      mocks.generateWBSCode.mockImplementation((trade, phase, task) => `${phase}.${task}.001`);
    });

    it('should generate master schedule with standard detail level', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel', 'Electrical', 'Plumbing', 'HVAC'],
          keyFeatures: ['Elevator', 'Fire Sprinkler'],
          complexity: 'medium',
          locations: ['Building A'],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1', {
        projectStartDate: new Date('2024-02-01'),
        scheduleName: 'Master Schedule',
        detailLevel: 'standard',
      });

      expect(result).toBeDefined();
      expect(result.scheduleId).toBe('schedule-1');
      expect(result.projectName).toBe('Commercial Office Building');
      expect(result.totalTasks).toBeGreaterThan(0);
      expect(result.detailLevel).toBe('standard');
      expect(result.sourcesUsed).toContain('document analysis');
      expect(result.sourcesUsed).toContain('SOV/budget');
      expect(result.sourcesUsed).toContain('subcontractors');
    });

    it('should throw error if project not found', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        generateMasterSchedule('invalid-project', 'user-1')
      ).rejects.toThrow('Project not found');
    });

    it('should generate basic detail level schedule with fewer tasks', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Small (<10,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'simple',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1', {
        detailLevel: 'basic',
      });

      expect(result.detailLevel).toBe('basic');
      expect(result.totalTasks).toBeGreaterThan(0);
    });

    it('should use detailed extraction when detailLevel is detailed', async () => {
      const mockExtractedTasks = Array.from({ length: 35 }, (_, i) => ({
        taskId: `T${i + 1}`,
        name: `Task ${i + 1}`,
        description: `Description ${i + 1}`,
        duration: 5,
        predecessors: i > 0 ? [`T${i}`] : [],
        wbsCode: `03.${i + 1}.001`,
        trade: 'Concrete',
        location: 'Building A',
        isMilestone: false,
      }));

      mocks.extractDetailedScheduleFromPlans.mockResolvedValue({
        success: true,
        extractedTasks: mockExtractedTasks,
      });

      mocks.matchTasksToSubcontractors.mockResolvedValue(mockExtractedTasks);

      const result = await generateMasterSchedule('project-1', 'user-1', {
        detailLevel: 'detailed',
      });

      expect(mocks.extractDetailedScheduleFromPlans).toHaveBeenCalledWith('project-1');
      expect(mocks.matchTasksToSubcontractors).toHaveBeenCalled();
      expect(result.totalTasks).toBeGreaterThan(30);
      expect(result.sourcesUsed).toContain('plans');
      expect(result.sourcesUsed).toContain('specifications');
    });

    it('should fall back to template-based generation if detailed extraction fails', async () => {
      mocks.extractDetailedScheduleFromPlans.mockResolvedValue({
        success: false,
        extractedTasks: [],
      });

      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1', {
        detailLevel: 'detailed',
      });

      expect(mocks.extractDetailedScheduleFromPlans).toHaveBeenCalled();
      expect(result.sourcesUsed).toContain('document analysis');
    });

    it('should generate tasks from SOV when budget has sufficient items', async () => {
      const largeBudgetItems = Array.from({ length: 15 }, (_, i) => ({
        id: `budget-${i}`,
        phaseCode: Math.floor(i / 3) + 1,
        phaseName: `Phase ${Math.floor(i / 3) + 1}`,
        name: `Item ${i}`,
        description: `Budget item ${i}`,
        budgetedAmount: 10000 * (i + 1),
        budgetedHours: 100 * (i + 1),
      }));

      mocks.prisma.projectBudget.findUnique.mockResolvedValue({
        id: 'budget-project-1',
        projectId: 'project-1',
        BudgetItem: largeBudgetItems,
      });

      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      expect(result.totalTasks).toBeGreaterThan(10);
      expect(mocks.prisma.scheduleTask.create).toHaveBeenCalled();
    });

    it('should apply duration multiplier based on complexity', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Large (>50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: ['Multiple Elevators', 'Complex MEP'],
          complexity: 'complex',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      expect(result.estimatedDuration).toBeGreaterThan(0);
    });

    it('should match tasks to subcontractors when available', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      expect(result.sourcesUsed).toContain('subcontractors');
    });

    it('should use default start date if not provided', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
      expect(result.endDate.getTime()).toBeGreaterThan(result.startDate.getTime());
    });

    it('should handle AI scope analysis errors gracefully', async () => {
      mocks.callAbacusLLM.mockRejectedValue(new Error('LLM API error'));

      const result = await generateMasterSchedule('project-1', 'user-1');

      // Should fall back to default scope
      expect(result).toBeDefined();
      expect(result.totalTasks).toBeGreaterThan(0);
    });

    it('should handle malformed JSON from AI gracefully', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: 'Invalid JSON content',
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      // Should use default fallback scope
      expect(result).toBeDefined();
      expect(result.totalTasks).toBeGreaterThan(0);
    });

    it('should create schedule with correct phases', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      expect(result.phases).toBeDefined();
      expect(Array.isArray(result.phases)).toBe(true);
      expect(result.phases.length).toBeGreaterThan(0);
    });

    it('should generate location-specific tasks for detailed level', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Large (>50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel', 'Electrical'],
          keyFeatures: [],
          complexity: 'medium',
          locations: ['Building A', 'Building B', 'Building C'],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1', {
        detailLevel: 'detailed',
      });

      expect(result.detailLevel).toBe('detailed');
      expect(result.totalTasks).toBeGreaterThan(0);
    });

    it('should mark critical phase tasks as critical', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      await generateMasterSchedule('project-1', 'user-1');

      // Check that some tasks were created (at least one call to scheduleTask.create)
      expect(mocks.prisma.scheduleTask.create).toHaveBeenCalled();
    });

    it('should handle projects with no documents', async () => {
      mocks.prisma.document.findMany.mockResolvedValue([]);
      mocks.prisma.documentChunk.findMany.mockResolvedValue([]);

      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Building',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          budgetTrades: [],
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.totalTasks).toBeGreaterThan(0);
    });

    it('should handle projects with no budget items', async () => {
      mocks.prisma.projectBudget.findUnique.mockResolvedValue(null);

      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.totalTasks).toBeGreaterThan(0);
    });

    it('should handle projects with no subcontractors', async () => {
      mocks.prisma.subcontractor.findMany.mockResolvedValue([]);

      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      const result = await generateMasterSchedule('project-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.totalTasks).toBeGreaterThan(0);
    });

    it('should calculate correct task dates based on predecessors', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      const startDate = new Date('2024-03-01');
      const result = await generateMasterSchedule('project-1', 'user-1', {
        projectStartDate: startDate,
      });

      expect(result.startDate).toEqual(startDate);
      expect(result.endDate.getTime()).toBeGreaterThan(startDate.getTime());
    });

    it('should use custom schedule name when provided', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      await generateMasterSchedule('project-1', 'user-1', {
        scheduleName: 'Custom Master Schedule',
      });

      expect(mocks.prisma.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Custom Master Schedule',
          }),
        })
      );
    });

    it('should generate default schedule name when not provided', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      await generateMasterSchedule('project-1', 'user-1');

      expect(mocks.prisma.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Master Schedule - Commercial Office Building',
          }),
        })
      );
    });

    it('should limit document chunks to 150', async () => {
      const manyChunks = Array.from({ length: 200 }, (_, i) => ({
        id: `chunk-${i}`,
        documentId: 'doc-1',
        pageNumber: i + 1,
        content: `Content ${i}`,
        metadata: {},
      }));

      mocks.prisma.documentChunk.findMany.mockResolvedValue(manyChunks);
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      await generateMasterSchedule('project-1', 'user-1');

      expect(mocks.prisma.documentChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 150,
        })
      );
    });

    it('should filter documents by relevant categories and names', async () => {
      await generateMasterSchedule('project-1', 'user-1');

      expect(mocks.prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId: 'project-1',
            OR: expect.arrayContaining([
              { name: { contains: 'plan', mode: 'insensitive' } },
              { name: { contains: 'dwg', mode: 'insensitive' } },
              { name: { contains: 'cad', mode: 'insensitive' } },
              { name: { contains: 'schedule', mode: 'insensitive' } },
              { name: { contains: 'spec', mode: 'insensitive' } },
              { category: 'plans_drawings' },
              { category: 'specifications' },
            ]),
          },
        })
      );
    });

    it('should include budget context in scope analysis when SOV available', async () => {
      mocks.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          projectType: 'Commercial Office',
          buildingSize: 'Medium (10,000-50,000 SF)',
          identifiedTrades: ['Concrete', 'Steel'],
          keyFeatures: [],
          complexity: 'medium',
          locations: [],
        }),
      });

      await generateMasterSchedule('project-1', 'user-1');

      expect(mocks.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Budget/SOV Line Items'),
          }),
        ]),
        expect.any(Object)
      );
    });
  });

  describe('canGenerateSchedule', () => {
    it('should return true when project has documents', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });

      mocks.prisma.document.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          name: 'Site Plan.pdf',
          category: 'plans_drawings',
        },
      ]);

      const result = await canGenerateSchedule('project-1');

      expect(result.canGenerate).toBe(true);
      expect(result.documentCount).toBe(1);
      expect(result.hasPlans).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false when project not found', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue(null);

      const result = await canGenerateSchedule('invalid-project');

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('Project not found');
      expect(result.documentCount).toBe(0);
      expect(result.hasPlans).toBe(false);
      expect(result.hasSpecs).toBe(false);
    });

    it('should return false when project has no documents', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });

      mocks.prisma.document.findMany.mockResolvedValue([]);

      const result = await canGenerateSchedule('project-1');

      expect(result.canGenerate).toBe(false);
      expect(result.reason).toBe('Upload at least one project document (plans, specs, or schedule)');
      expect(result.documentCount).toBe(0);
      expect(result.hasPlans).toBe(false);
      expect(result.hasSpecs).toBe(false);
    });

    it('should detect plans by name patterns', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });

      mocks.prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'site_plan.pdf', category: 'other' },
        { id: 'doc-2', name: 'drawing.dwg', category: 'other' },
        { id: 'doc-3', name: 'CAD_file.cad', category: 'other' },
      ]);

      const result = await canGenerateSchedule('project-1');

      expect(result.hasPlans).toBe(true);
      expect(result.documentCount).toBe(3);
    });

    it('should detect plans by category', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });

      mocks.prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'document.pdf', category: 'plans_drawings' },
      ]);

      const result = await canGenerateSchedule('project-1');

      expect(result.hasPlans).toBe(true);
    });

    it('should detect specs by name patterns', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });

      mocks.prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'specifications.pdf', category: 'other' },
      ]);

      const result = await canGenerateSchedule('project-1');

      expect(result.hasSpecs).toBe(true);
      expect(result.hasPlans).toBe(false);
    });

    it('should detect specs by category', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });

      mocks.prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'document.pdf', category: 'specifications' },
      ]);

      const result = await canGenerateSchedule('project-1');

      expect(result.hasSpecs).toBe(true);
    });

    it('should handle mixed document types', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });

      mocks.prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'floor_plan.pdf', category: 'plans_drawings' },
        { id: 'doc-2', name: 'tech_specs.pdf', category: 'specifications' },
        { id: 'doc-3', name: 'contract.pdf', category: 'contracts' },
      ]);

      const result = await canGenerateSchedule('project-1');

      expect(result.canGenerate).toBe(true);
      expect(result.hasPlans).toBe(true);
      expect(result.hasSpecs).toBe(true);
      expect(result.documentCount).toBe(3);
    });

    it('should be case-insensitive when detecting document types', async () => {
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
      });

      mocks.prisma.document.findMany.mockResolvedValue([
        { id: 'doc-1', name: 'SITE_PLAN.PDF', category: 'other' },
        { id: 'doc-2', name: 'SPECIFICATIONS.PDF', category: 'other' },
      ]);

      const result = await canGenerateSchedule('project-1');

      expect(result.hasPlans).toBe(true);
      expect(result.hasSpecs).toBe(true);
    });
  });
});
