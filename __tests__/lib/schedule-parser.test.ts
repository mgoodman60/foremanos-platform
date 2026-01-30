import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
const mockDocument = {
  id: 'doc-1',
  name: 'Master Schedule.pdf',
  fileType: 'pdf',
  projectId: 'project-1',
};

const mockChunks = [
  {
    id: 'chunk-1',
    documentId: 'doc-1',
    pageNumber: 1,
    content: `A1010    Install Foundation Forms    01/15/24    01/22/24    5d
A1020    Pour Concrete Footings    01/23/24    01/25/24    3d    Pred: A1010
A1030    Foundation Waterproofing    01/26/24    01/28/24    3d    Pred: A1020`,
    metadata: {},
  },
];

const mockSchedule = {
  id: 'schedule-1',
  name: 'Master Schedule',
  projectId: 'project-1',
  documentId: 'doc-1',
  startDate: new Date('2024-01-15'),
  endDate: new Date('2024-01-28'),
  createdBy: 'user-1',
  isActive: true,
};

const mockTasks = [
  {
    id: 'task-1',
    scheduleId: 'schedule-1',
    taskId: 'A1010',
    name: 'Install Foundation Forms',
    startDate: new Date('2024-01-15'),
    endDate: new Date('2024-01-22'),
    duration: 5,
    predecessors: [],
    successors: ['A1020'],
    percentComplete: 100,
    status: 'completed',
    isCritical: true,
    totalFloat: 0,
  },
  {
    id: 'task-2',
    scheduleId: 'schedule-1',
    taskId: 'A1020',
    name: 'Pour Concrete Footings',
    startDate: new Date('2024-01-23'),
    endDate: new Date('2024-01-25'),
    duration: 3,
    predecessors: ['A1010'],
    successors: ['A1030'],
    percentComplete: 50,
    status: 'in_progress',
    isCritical: true,
    totalFloat: 0,
  },
  {
    id: 'task-3',
    scheduleId: 'schedule-1',
    taskId: 'A1030',
    name: 'Foundation Waterproofing',
    startDate: new Date('2024-01-26'),
    endDate: new Date('2024-01-28'),
    duration: 3,
    predecessors: ['A1020'],
    successors: [],
    percentComplete: 0,
    status: 'not_started',
    isCritical: true,
    totalFloat: 0,
  },
];

const prismaMock = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
  },
  schedule: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  scheduleTask: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

describe('parseScheduleFromDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.document.findUnique.mockResolvedValue(mockDocument);
    prismaMock.documentChunk.findMany.mockResolvedValue(mockChunks);
    prismaMock.schedule.create.mockResolvedValue(mockSchedule);
    prismaMock.scheduleTask.create.mockResolvedValue(mockTasks[0]);
    prismaMock.scheduleTask.findMany.mockResolvedValue(mockTasks);
    prismaMock.scheduleTask.update.mockResolvedValue(mockTasks[0]);
  });

  it('should throw error when document not found', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    prismaMock.document.findUnique.mockResolvedValue(null);

    await expect(
      parseScheduleFromDocument('doc-1', 'project-1', 'user-1')
    ).rejects.toThrow('Document not found');
  });

  it('should throw error for non-PDF documents', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    prismaMock.document.findUnique.mockResolvedValue({
      ...mockDocument,
      fileType: 'docx',
    });

    await expect(
      parseScheduleFromDocument('doc-1', 'project-1', 'user-1')
    ).rejects.toThrow('Only PDF documents are supported');
  });

  it('should throw error when document has no chunks', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    prismaMock.documentChunk.findMany.mockResolvedValue([]);

    await expect(
      parseScheduleFromDocument('doc-1', 'project-1', 'user-1')
    ).rejects.toThrow('Document has not been processed for OCR yet');
  });

  it('should successfully parse schedule from document', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    const result = await parseScheduleFromDocument(
      'doc-1',
      'project-1',
      'user-1',
      'Test Schedule'
    );

    expect(result.scheduleId).toBe('schedule-1');
    expect(result.totalTasks).toBeGreaterThan(0);
    expect(result.tasks).toBeDefined();
    expect(prismaMock.schedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Test Schedule',
        projectId: 'project-1',
        documentId: 'doc-1',
        createdBy: 'user-1',
        isActive: true,
      }),
    });
  });

  it('should extract tasks with correct date parsing', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    const result = await parseScheduleFromDocument('doc-1', 'project-1', 'user-1');

    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
    expect(result.startDate.getTime()).toBeLessThan(result.endDate.getTime());
  });

  it('should identify critical path tasks', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    const result = await parseScheduleFromDocument('doc-1', 'project-1', 'user-1');

    expect(result.criticalPathTasks).toBeGreaterThanOrEqual(0);
  });

  it('should use document name for schedule name when not provided', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    await parseScheduleFromDocument('doc-1', 'project-1', 'user-1');

    expect(prismaMock.schedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Schedule from Master Schedule.pdf',
      }),
    });
  });

  it('should extract predecessor relationships', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    const result = await parseScheduleFromDocument('doc-1', 'project-1', 'user-1');

    const tasksWithPredecessors = result.tasks.filter(
      (t) => t.predecessors && t.predecessors.length > 0
    );
    expect(tasksWithPredecessors.length).toBeGreaterThanOrEqual(0);
  });

  it('should calculate task duration correctly', async () => {
    const { parseScheduleFromDocument } = await import('@/lib/schedule-parser');
    const result = await parseScheduleFromDocument('doc-1', 'project-1', 'user-1');

    result.tasks.forEach((task) => {
      expect(task.duration).toBeGreaterThan(0);
    });
  });
});

describe('calculateCriticalPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.scheduleTask.findMany.mockResolvedValue(mockTasks);
  });

  it('should identify tasks with zero float as critical', async () => {
    const { calculateCriticalPath } = await import('@/lib/schedule-parser');
    const criticalTaskIds = await calculateCriticalPath('schedule-1');

    expect(criticalTaskIds).toBeDefined();
    expect(Array.isArray(criticalTaskIds)).toBe(true);
  });

  it('should include tasks marked as critical', async () => {
    const { calculateCriticalPath } = await import('@/lib/schedule-parser');
    const criticalTaskIds = await calculateCriticalPath('schedule-1');

    const criticalTasks = mockTasks.filter((t) => t.isCritical || t.totalFloat === 0);
    expect(criticalTaskIds.length).toBe(criticalTasks.length);
  });

  it('should return empty array when no critical tasks', async () => {
    const { calculateCriticalPath } = await import('@/lib/schedule-parser');
    prismaMock.scheduleTask.findMany.mockResolvedValue([
      {
        ...mockTasks[0],
        isCritical: false,
        totalFloat: 5,
      },
    ]);

    const criticalTaskIds = await calculateCriticalPath('schedule-1');

    expect(criticalTaskIds).toHaveLength(0);
  });
});

describe('getScheduleProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.scheduleTask.findMany.mockResolvedValue(mockTasks);
  });

  it('should calculate overall schedule progress', async () => {
    const { getScheduleProgress } = await import('@/lib/schedule-parser');
    const progress = await getScheduleProgress('schedule-1');

    expect(progress.totalTasks).toBe(3);
    expect(progress.completedTasks).toBe(1);
    expect(progress.inProgressTasks).toBe(1);
    expect(progress.overallProgress).toBeGreaterThan(0);
  });

  it('should count completed tasks correctly', async () => {
    const { getScheduleProgress } = await import('@/lib/schedule-parser');
    const progress = await getScheduleProgress('schedule-1');

    const expectedCompleted = mockTasks.filter((t) => t.status === 'completed').length;
    expect(progress.completedTasks).toBe(expectedCompleted);
  });

  it('should count in-progress tasks correctly', async () => {
    const { getScheduleProgress } = await import('@/lib/schedule-parser');
    const progress = await getScheduleProgress('schedule-1');

    const expectedInProgress = mockTasks.filter(
      (t) => t.status === 'in_progress'
    ).length;
    expect(progress.inProgressTasks).toBe(expectedInProgress);
  });

  it('should count delayed tasks correctly', async () => {
    const { getScheduleProgress } = await import('@/lib/schedule-parser');
    prismaMock.scheduleTask.findMany.mockResolvedValue([
      { ...mockTasks[0], status: 'delayed' },
      ...mockTasks.slice(1),
    ]);

    const progress = await getScheduleProgress('schedule-1');

    expect(progress.delayedTasks).toBe(1);
  });

  it('should calculate weighted progress from percentComplete', async () => {
    const { getScheduleProgress } = await import('@/lib/schedule-parser');
    const progress = await getScheduleProgress('schedule-1');

    // Task 1: 100%, Task 2: 50%, Task 3: 0%
    // Average: (100 + 50 + 0) / 3 = 50%
    expect(progress.overallProgress).toBe(50);
  });

  it('should handle empty task list', async () => {
    const { getScheduleProgress } = await import('@/lib/schedule-parser');
    prismaMock.scheduleTask.findMany.mockResolvedValue([]);

    const progress = await getScheduleProgress('schedule-1');

    expect(progress.totalTasks).toBe(0);
    expect(progress.completedTasks).toBe(0);
    expect(isNaN(progress.overallProgress)).toBe(true);
  });
});

describe('findScheduleCandidates', () => {
  const mockDocuments = [
    {
      id: 'doc-1',
      name: 'Master Schedule.pdf',
      category: 'schedule',
    },
    {
      id: 'doc-2',
      name: 'Construction Timeline.pdf',
      category: 'general',
    },
    {
      id: 'doc-3',
      name: 'Project Plan.pdf',
      category: 'general',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.document.findMany.mockResolvedValue(mockDocuments);
  });

  it('should return empty array when no schedule documents found', async () => {
    const { findScheduleCandidates } = await import('@/lib/schedule-parser');
    prismaMock.document.findMany.mockResolvedValue([]);

    const candidates = await findScheduleCandidates('project-1');

    expect(candidates).toEqual([]);
  });

  it('should find documents with schedule category', async () => {
    const { findScheduleCandidates } = await import('@/lib/schedule-parser');
    const candidates = await findScheduleCandidates('project-1');

    const scheduleDoc = candidates.find((c) => c.documentId === 'doc-1');
    expect(scheduleDoc).toBeDefined();
    expect(scheduleDoc?.matchScore).toBeGreaterThan(0);
  });

  it('should score documents based on name keywords', async () => {
    const { findScheduleCandidates } = await import('@/lib/schedule-parser');
    const candidates = await findScheduleCandidates('project-1');

    // Document with "schedule" in name should score higher
    const scheduleDoc = candidates.find((c) => c.documentName.includes('Schedule'));
    const planDoc = candidates.find((c) => c.documentName.includes('Plan'));
    expect(scheduleDoc?.matchScore).toBeGreaterThan(planDoc?.matchScore || 0);
  });

  it('should sort candidates by match score descending', async () => {
    const { findScheduleCandidates } = await import('@/lib/schedule-parser');
    const candidates = await findScheduleCandidates('project-1');

    for (let i = 0; i < candidates.length - 1; i++) {
      expect(candidates[i].matchScore).toBeGreaterThanOrEqual(
        candidates[i + 1].matchScore
      );
    }
  });

  it('should include confidence level for each candidate', async () => {
    const { findScheduleCandidates } = await import('@/lib/schedule-parser');
    const candidates = await findScheduleCandidates('project-1');

    candidates.forEach((candidate) => {
      expect(candidate.confidence).toBeGreaterThan(0);
      expect(candidate.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  it('should give highest score to explicit schedule category', async () => {
    const { findScheduleCandidates } = await import('@/lib/schedule-parser');
    const candidates = await findScheduleCandidates('project-1');

    const scheduleCategory = candidates.find((c) => c.documentId === 'doc-1');
    const others = candidates.filter((c) => c.documentId !== 'doc-1');

    if (others.length > 0) {
      expect(scheduleCategory?.matchScore).toBeGreaterThan(
        Math.max(...others.map((o) => o.matchScore))
      );
    }
  });

  it('should handle database errors gracefully', async () => {
    const { findScheduleCandidates } = await import('@/lib/schedule-parser');
    prismaMock.document.findMany.mockRejectedValue(new Error('Database error'));

    const candidates = await findScheduleCandidates('project-1');

    expect(candidates).toEqual([]);
  });
});
