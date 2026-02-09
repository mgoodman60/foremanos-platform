import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Schedule, ScheduleTask, DocumentChunk } from '@prisma/client';

// Hoist mocks before imports
const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
  },
  schedule: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  scheduleTask: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
  },
  projectDataSource: {
    upsert: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockCallAbacusLLM = vi.hoisted(() => vi.fn());
const mockGetFileUrl = vi.hoisted(() => vi.fn());
const mockWithLock = vi.hoisted(() => vi.fn());
const mockIsLocked = vi.hoisted(() => vi.fn());
const mockGenerateAbbreviationContext = vi.hoisted(() => vi.fn());

// Mock all dependencies
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));
vi.mock('@/lib/abacus-llm', () => ({ callAbacusLLM: mockCallAbacusLLM }));
vi.mock('@/lib/s3', () => ({ getFileUrl: mockGetFileUrl }));
vi.mock('@/lib/extraction-lock-service', () => ({
  withLock: mockWithLock,
  isLocked: mockIsLocked,
}));
vi.mock('@/lib/construction-abbreviations', () => ({
  generateAbbreviationContext: mockGenerateAbbreviationContext,
  expandAbbreviationsInText: vi.fn((text: string) => text),
}));

// Mock dynamic import for trade inference
vi.mock('@/lib/trade-inference', () => ({
  inferTradesForSchedule: vi.fn().mockResolvedValue({ updated: 5, needsClarification: 2 }),
}));

// Import after mocks
import {
  extractScheduleWithAI,
  deleteScheduleForDocument
} from '@/lib/schedule-extractor-ai';

describe('schedule-extractor-ai', () => {
  const mockDocument = {
    id: 'doc-123',
    name: 'Construction Schedule.pdf',
    fileName: 'schedule.pdf',
    cloud_storage_path: 'documents/schedule.pdf',
    isPublic: false,
    projectId: 'project-123',
  };

  const mockSchedule: Schedule = {
    id: 'schedule-123',
    name: 'Schedule from Construction Schedule.pdf',
    projectId: 'project-123',
    documentId: 'doc-123',
    startDate: new Date('2024-01-15'),
    endDate: new Date('2024-12-31'),
    createdBy: 'user-123',
    extractedBy: 'ai_vision',
    extractedAt: new Date(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  const mockTasks = [
    {
      taskId: 'A1010',
      name: 'Foundation Forms',
      description: 'Install foundation formwork',
      startDate: '01/15/2024',
      endDate: '01/22/2024',
      duration: 5,
      predecessors: ['A1000'],
      assignedTo: 'ABC Concrete',
      isCritical: true,
      percentComplete: 0,
    },
    {
      taskId: 'A1020',
      name: 'Pour Foundation',
      startDate: '01/23/2024',
      endDate: '01/25/2024',
      duration: 2,
      predecessors: ['A1010'],
      isCritical: true,
      percentComplete: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockPrisma.document.findUnique.mockResolvedValue(mockDocument);
    mockPrisma.schedule.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.schedule.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.schedule.create.mockResolvedValue(mockSchedule);
    mockPrisma.scheduleTask.create.mockResolvedValue({ id: 'task-123' });
    mockPrisma.projectDataSource.upsert.mockResolvedValue({ id: 'ds-123' } as any);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/schedule.pdf');
    mockGenerateAbbreviationContext.mockReturnValue('');

    // Mock withLock to execute the callback immediately
    mockWithLock.mockImplementation(async (type, id, operation, callback) => {
      const result = await callback();
      return { success: true, result, skipped: false };
    });

    // Mock fetch for PDF download
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('mock-pdf').buffer),
    } as any);
  });

  describe('extractScheduleWithAI', () => {
    it('should extract schedule from PDF vision analysis', async () => {
      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(mockTasks),
      });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.scheduleId).toBe('schedule-123');
      expect(result.totalTasks).toBe(2);
      expect(result.criticalPathTasks).toBe(2);
      expect(mockWithLock).toHaveBeenCalledWith(
        'document',
        'doc-123',
        'schedule',
        expect.any(Function),
        expect.any(Object)
      );
    });

    it('should return existing schedule if extraction already in progress', async () => {
      const existingSchedule = {
        ...mockSchedule,
        ScheduleTask: mockTasks.map((t, i) => ({
          id: `task-${i}`,
          scheduleId: 'schedule-123',
          taskId: t.taskId,
          name: t.name,
          startDate: new Date(t.startDate),
          endDate: new Date(t.endDate),
          duration: t.duration,
          isCritical: t.isCritical,
        })),
      };

      mockPrisma.schedule.findFirst.mockResolvedValue(existingSchedule as any);
      mockWithLock.mockResolvedValue({ success: false, skipped: true, result: null });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.scheduleId).toBe('schedule-123');
      expect(result.totalTasks).toBe(2);
    });

    it('should throw error if locked and no existing schedule', async () => {
      mockPrisma.schedule.findFirst.mockResolvedValue(null);
      mockWithLock.mockResolvedValue({ success: false, skipped: true, result: null });

      await expect(
        extractScheduleWithAI('doc-123', 'project-123', 'user-123')
      ).rejects.toThrow('Schedule extraction already in progress');
    });

    it('should delete existing schedules before creating new one', async () => {
      mockPrisma.schedule.deleteMany.mockResolvedValue({ count: 2 });
      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(mockTasks),
      });

      await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(mockPrisma.schedule.deleteMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-123' },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AI_SCHEDULE_EXTRACTOR',
        expect.stringContaining('Deleted existing schedule'),
        { count: 2 }
      );
    });

    it('should handle document not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(
        extractScheduleWithAI('doc-123', 'project-123', 'user-123')
      ).rejects.toThrow('Document not found');
    });

    it('should handle document without cloud storage path', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        ...mockDocument,
        cloud_storage_path: null,
      });

      await expect(
        extractScheduleWithAI('doc-123', 'project-123', 'user-123')
      ).rejects.toThrow('Document has no file path');
    });

    it('should fallback to chunk processing if PDF extraction fails', async () => {
      const mockChunks: DocumentChunk[] = [
        {
          id: 'chunk-1',
          documentId: 'doc-123',
          content: 'Task A1010: Foundation Forms, Start: 01/15/2024, End: 01/22/2024',
          pageNumber: 1,
          chunkIndex: 0,
          metadata: {},
          createdAt: new Date(),
        } as any,
      ];

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks);
      mockCallAbacusLLM
        .mockRejectedValueOnce(new Error('PDF extraction failed'))
        .mockResolvedValueOnce({ content: JSON.stringify(mockTasks) });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.scheduleId).toBe('schedule-123');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AI_SCHEDULE_EXTRACTOR',
        'Direct PDF extraction failed, falling back to chunks',
        expect.any(Object)
      );
    });

    it('should throw error if no chunks available', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([]);
      mockCallAbacusLLM.mockRejectedValue(new Error('PDF extraction failed'));

      await expect(
        extractScheduleWithAI('doc-123', 'project-123', 'user-123')
      ).rejects.toThrow('Document has not been processed for OCR yet');
    });

    it('should throw error if no tasks found', async () => {
      // Need to provide chunks since PDF extraction will fail with empty array
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        { id: 'chunk-1', content: 'content', pageNumber: 1 } as any,
      ]);
      mockCallAbacusLLM
        .mockRejectedValueOnce(new Error('PDF fail'))
        .mockResolvedValueOnce({ content: '[]' });

      await expect(
        extractScheduleWithAI('doc-123', 'project-123', 'user-123')
      ).rejects.toThrow('No schedule tasks found in document');
    });

    it('should deduplicate tasks by taskId', async () => {
      const duplicateTasks = [
        ...mockTasks,
        { ...mockTasks[0], description: 'Updated description' }, // Duplicate with more info
      ];

      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(duplicateTasks),
      });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.totalTasks).toBe(2); // Should deduplicate
      expect(mockLogger.info).toHaveBeenCalledWith(
        'AI_SCHEDULE_EXTRACTOR',
        expect.stringContaining('Found unique tasks'),
        expect.objectContaining({ duplicatesRemoved: 1 })
      );
    });

    it('should parse flexible date formats', async () => {
      const tasksWithVariousDates = [
        { ...mockTasks[0], startDate: '01/15/24', endDate: '01/22/24' },
        { ...mockTasks[1], startDate: '15-Jan-2024', endDate: '25-Jan-2024' },
      ];

      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(tasksWithVariousDates),
      });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.scheduleId).toBe('schedule-123');
      expect(result.totalTasks).toBe(2);
    });

    it('should calculate duration if not provided', async () => {
      const tasksWithoutDuration = mockTasks.map((t) => ({ ...t, duration: undefined }));
      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(tasksWithoutDuration),
      });

      await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      const createCalls = mockPrisma.scheduleTask.create.mock.calls;
      expect(createCalls[0][0].data.duration).toBeGreaterThan(0);
    });

    it('should deactivate existing active schedules', async () => {
      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(mockTasks),
      });

      await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(mockPrisma.schedule.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'project-123', isActive: true },
        data: { isActive: false },
      });
    });

    it('should create ProjectDataSource for schedule feature', async () => {
      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(mockTasks),
      });

      await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(mockPrisma.projectDataSource.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId_featureType: {
              projectId: 'project-123',
              featureType: 'schedule',
            },
          },
          create: expect.objectContaining({
            projectId: 'project-123',
            featureType: 'schedule',
            documentId: 'doc-123',
          }),
        })
      );
    });

    it('should use custom schedule name if provided', async () => {
      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(mockTasks),
      });

      await extractScheduleWithAI('doc-123', 'project-123', 'user-123', 'Q1 2024 Schedule');

      expect(mockPrisma.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Q1 2024 Schedule',
          }),
        })
      );
    });

    it('should handle markdown wrapped JSON response', async () => {
      const jsonContent = JSON.stringify(mockTasks);
      mockCallAbacusLLM.mockResolvedValue({
        content: `\`\`\`json\n${jsonContent}\n\`\`\``,
      });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.scheduleId).toBe('schedule-123');
      expect(result.totalTasks).toBe(2);
    });

    it('should handle plain markdown code blocks', async () => {
      const jsonContent = JSON.stringify(mockTasks);
      mockCallAbacusLLM.mockResolvedValue({
        content: `\`\`\`\n${jsonContent}\n\`\`\``,
      });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.scheduleId).toBe('schedule-123');
    });

    it('should filter out tasks missing required fields', async () => {
      const invalidTasks = [
        mockTasks[0],
        { taskId: 'INVALID', name: '', startDate: '', endDate: '' }, // Missing required fields
        mockTasks[1],
      ];

      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify(invalidTasks),
      });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.totalTasks).toBe(2);
      // The logger.warn is called for date parsing failures, not invalid task skipping
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should process chunks in batches', async () => {
      const mockChunks = Array.from({ length: 25 }, (_, i) => ({
        id: `chunk-${i}`,
        documentId: 'doc-123',
        content: `Page ${i + 1} content`,
        pageNumber: i + 1,
        chunkIndex: i,
        metadata: {},
      }));

      mockPrisma.documentChunk.findMany.mockResolvedValue(mockChunks as any);
      mockCallAbacusLLM
        .mockRejectedValueOnce(new Error('PDF extraction failed'))
        .mockResolvedValue({ content: JSON.stringify([mockTasks[0]]) });

      const result = await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      expect(result.scheduleId).toBe('schedule-123');
      expect(mockCallAbacusLLM).toHaveBeenCalledTimes(4); // 1 failed PDF + 3 batches of 10
    });

    it('should handle LLM parse error gracefully', async () => {
      mockCallAbacusLLM
        .mockRejectedValueOnce(new Error('PDF fail'))
        .mockResolvedValueOnce({ content: 'Not valid JSON' });

      mockPrisma.documentChunk.findMany.mockResolvedValue([
        { id: 'chunk-1', content: 'content', pageNumber: 1 } as any,
      ]);

      await expect(
        extractScheduleWithAI('doc-123', 'project-123', 'user-123')
      ).rejects.toThrow('No schedule tasks found');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AI_SCHEDULE_EXTRACTOR',
        expect.stringContaining('Failed to parse AI response'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should include abbreviation context in prompt', async () => {
      mockGenerateAbbreviationContext.mockReturnValue(
        '\n\nKnown abbreviations: PEMB = Pre-Engineered Metal Building'
      );
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        { id: 'chunk-1', content: 'PEMB installation', pageNumber: 1 } as any,
      ]);
      mockCallAbacusLLM
        .mockRejectedValueOnce(new Error('PDF fail'))
        .mockResolvedValueOnce({ content: JSON.stringify(mockTasks) });

      await extractScheduleWithAI('doc-123', 'project-123', 'user-123');

      const llmCall = mockCallAbacusLLM.mock.calls[1][0];
      expect(llmCall[1].content).toContain('Known abbreviations');
    });
  });

  describe('deleteScheduleForDocument', () => {
    it('should delete all schedules and tasks for a document', async () => {
      const mockSchedules = [
        { id: 'schedule-1' },
        { id: 'schedule-2' },
      ];

      mockPrisma.schedule.findMany.mockResolvedValue(mockSchedules as any);
      mockPrisma.scheduleTask.deleteMany.mockResolvedValue({ count: 10 });
      mockPrisma.schedule.delete.mockResolvedValue({} as any);

      await deleteScheduleForDocument('doc-123');

      expect(mockPrisma.schedule.findMany).toHaveBeenCalledWith({
        where: { documentId: 'doc-123' },
      });
      expect(mockPrisma.scheduleTask.deleteMany).toHaveBeenCalledTimes(2);
      expect(mockPrisma.schedule.delete).toHaveBeenCalledTimes(2);
    });

    it('should handle no existing schedules', async () => {
      mockPrisma.schedule.findMany.mockResolvedValue([]);

      await deleteScheduleForDocument('doc-123');

      expect(mockPrisma.scheduleTask.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.schedule.delete).not.toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      mockPrisma.schedule.findMany.mockRejectedValue(new Error('Database error'));

      await expect(deleteScheduleForDocument('doc-123')).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'AI_SCHEDULE_EXTRACTOR',
        'Error deleting existing schedules',
        expect.any(Error)
      );
    });
  });
});
