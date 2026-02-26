/**
 * Tests for Window Schedule Extractor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractedWindow, WindowScheduleExtractionResult } from '@/lib/window-schedule-extractor';

// Mocks
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  room: {
    findFirst: vi.fn(),
  },
  windowScheduleItem: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  document: {
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
}));

const mockCallAbacusLLM = vi.hoisted(() => vi.fn());

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: mockCallAbacusLLM,
}));

// Import after mocks
import {
  extractWindowScheduleFromText,
  storeWindowScheduleData,
  getWindowScheduleContext,
  processWindowScheduleForProject,
} from '@/lib/window-schedule-extractor';

describe('Window Schedule Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractWindowScheduleFromText', () => {
    it('should extract window schedule data from text using LLM', async () => {
      const documentText = `Window Schedule
      W-1: Fixed Aluminum Window, 4'-0" x 5'-0", Room 101`;

      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          windows: [
            {
              windowNumber: 'W-1',
              windowMark: 'A',
              windowType: 'FIXED ALUMINUM WINDOW',
              roomNumber: '101',
              elevation: 'NORTH',
              width: "4'-0\"",
              height: "5'-0\"",
              frameMaterial: 'ALUMINUM',
              glazingType: 'INSULATED',
              operationType: 'FIXED',
              egressCompliant: false,
            },
          ],
          windowTypes: { A: 'FIXED ALUMINUM FRAME' },
          glassTypes: { '1': '1" INSULATED LOW-E' },
        }),
      });

      const result = await extractWindowScheduleFromText(documentText, 'A-1.1');

      expect(result.windows).toHaveLength(1);
      expect(result.windows[0]).toMatchObject({
        windowNumber: 'W-1',
        windowType: 'FIXED ALUMINUM WINDOW',
        roomNumber: '101',
        sourceSheet: 'A-1.1',
      });
      expect(result.windowTypes).toHaveProperty('A');
      expect(result.glassTypes).toHaveProperty('1');
    });

    it('should handle invalid JSON response gracefully', async () => {
      mockCallAbacusLLM.mockResolvedValueOnce({
        content: 'Invalid response without JSON',
      });

      const result = await extractWindowScheduleFromText('Some text');

      expect(result).toEqual({
        windows: [],
        windowTypes: {},
        glassTypes: {},
        extractedAt: expect.any(Date),
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'WINDOW_SCHEDULE',
        'No valid JSON found in LLM response'
      );
    });

    it('should handle LLM errors gracefully', async () => {
      mockCallAbacusLLM.mockRejectedValueOnce(new Error('API timeout'));

      const result = await extractWindowScheduleFromText('Window data');

      expect(result).toEqual({
        windows: [],
        windowTypes: {},
        glassTypes: {},
        extractedAt: expect.any(Date),
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'WINDOW_SCHEDULE',
        'Extraction failed',
        expect.any(Error)
      );
    });

    it('should limit document text to 15000 characters', async () => {
      const longText = 'x'.repeat(20000);

      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify({ windows: [], windowTypes: {}, glassTypes: {} }),
      });

      await extractWindowScheduleFromText(longText);

      const callArgs = mockCallAbacusLLM.mock.calls[0][0];
      const promptContent = callArgs[0].content;
      expect(promptContent).toContain('x'.repeat(15000));
      expect(promptContent).not.toContain('x'.repeat(16000));
    });

    it('should add source sheet to all extracted windows', async () => {
      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          windows: [
            { windowNumber: 'W-1', windowType: 'FIXED' },
            { windowNumber: 'W-2', windowType: 'CASEMENT' },
          ],
          windowTypes: {},
          glassTypes: {},
        }),
      });

      const result = await extractWindowScheduleFromText('Window data', 'A-2.5');

      expect(result.windows).toHaveLength(2);
      expect(result.windows[0].sourceSheet).toBe('A-2.5');
      expect(result.windows[1].sourceSheet).toBe('A-2.5');
    });

    it('should handle missing windows array in response', async () => {
      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          windowTypes: { A: 'Fixed' },
          glassTypes: {},
        }),
      });

      const result = await extractWindowScheduleFromText('Window data');

      expect(result.windows).toEqual([]);
      expect(result.windowTypes).toHaveProperty('A');
    });
  });

  describe('storeWindowScheduleData', () => {
    it('should upsert window schedule items to database', async () => {
      const extractionResult: WindowScheduleExtractionResult = {
        windows: [
          {
            windowNumber: 'W-1',
            windowMark: 'A',
            windowType: 'FIXED ALUMINUM',
            roomNumber: '101',
            width: "4'-0\"",
            height: "5'-0\"",
            frameMaterial: 'ALUMINUM',
            glazingType: 'INSULATED',
            operationType: 'FIXED',
            egressCompliant: false,
          },
        ],
        windowTypes: {},
        glassTypes: {},
        extractedAt: new Date(),
      };

      mockPrisma.room.findFirst.mockResolvedValueOnce({
        id: 'room-id',
        roomNumber: '101',
      });
      mockPrisma.windowScheduleItem.upsert.mockResolvedValueOnce({});

      const result = await storeWindowScheduleData('project-id', extractionResult, 'doc-id');

      expect(result).toEqual({
        created: 1,
        updated: 0,
        errors: [],
      });

      expect(mockPrisma.windowScheduleItem.upsert).toHaveBeenCalledWith({
        where: {
          projectId_windowNumber: {
            projectId: 'project-id',
            windowNumber: 'W-1',
          },
        },
        create: expect.objectContaining({
          projectId: 'project-id',
          roomId: 'room-id',
          windowNumber: 'W-1',
          windowType: 'FIXED ALUMINUM',
          sourceDocumentId: 'doc-id',
        }),
        update: expect.objectContaining({
          roomId: 'room-id',
          windowType: 'FIXED ALUMINUM',
        }),
      });
    });

    it('should find room by room number', async () => {
      const extractionResult: WindowScheduleExtractionResult = {
        windows: [
          {
            windowNumber: 'W-1',
            windowType: 'FIXED',
            roomNumber: '205',
          },
        ],
        windowTypes: {},
        glassTypes: {},
        extractedAt: new Date(),
      };

      mockPrisma.room.findFirst.mockResolvedValueOnce({
        id: 'room-205-id',
      });
      mockPrisma.windowScheduleItem.upsert.mockResolvedValueOnce({});

      await storeWindowScheduleData('project-id', extractionResult);

      expect(mockPrisma.room.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-id',
          OR: [
            { roomNumber: '205' },
            { name: { contains: '205' } },
          ],
        },
      });
    });

    it('should handle windows without room numbers', async () => {
      const extractionResult: WindowScheduleExtractionResult = {
        windows: [
          {
            windowNumber: 'W-1',
            windowType: 'FIXED',
          },
        ],
        windowTypes: {},
        glassTypes: {},
        extractedAt: new Date(),
      };

      mockPrisma.windowScheduleItem.upsert.mockResolvedValueOnce({});

      await storeWindowScheduleData('project-id', extractionResult);

      expect(mockPrisma.room.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.windowScheduleItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            roomId: undefined,
          }),
        })
      );
    });

    it('should handle upsert errors for individual windows', async () => {
      const extractionResult: WindowScheduleExtractionResult = {
        windows: [
          { windowNumber: 'W-1', windowType: 'FIXED' },
          { windowNumber: 'W-2', windowType: 'CASEMENT' },
        ],
        windowTypes: {},
        glassTypes: {},
        extractedAt: new Date(),
      };

      mockPrisma.windowScheduleItem.upsert
        .mockRejectedValueOnce(new Error('Database constraint violation'))
        .mockResolvedValueOnce({});

      const result = await storeWindowScheduleData('project-id', extractionResult);

      expect(result).toEqual({
        created: 1,
        updated: 0,
        errors: expect.arrayContaining([
          expect.stringContaining('Failed to store window W-1'),
        ]),
      });
    });

    it('should store all window properties', async () => {
      const extractionResult: WindowScheduleExtractionResult = {
        windows: [
          {
            windowNumber: 'W-1',
            windowMark: 'A',
            windowType: 'CASEMENT',
            roomNumber: '101',
            elevation: 'SOUTH',
            width: "3'-0\"",
            height: "4'-0\"",
            roughOpeningW: "3'-2\"",
            roughOpeningH: "4'-2\"",
            sillHeight: "3'-0\"",
            headHeight: "7'-0\"",
            frameMaterial: 'VINYL',
            frameFinish: 'WHITE',
            glazingType: 'INSULATED',
            glassType: 'LOW-E',
            glassThickness: '1"',
            uValue: 0.30,
            shgc: 0.25,
            operationType: 'CASEMENT',
            hardwareFinish: 'BRONZE',
            screenType: 'FULL',
            // @ts-expect-error strictNullChecks migration
            fireRating: null,
            egressCompliant: true,
            manufacturer: 'ANDERSEN',
            modelNumber: '400 SERIES',
            notes: 'See detail 3/A5.1',
            sourceSheet: 'A-3.2',
          },
        ],
        windowTypes: {},
        glassTypes: {},
        extractedAt: new Date(),
      };

      mockPrisma.windowScheduleItem.upsert.mockResolvedValueOnce({});

      await storeWindowScheduleData('project-id', extractionResult);

      expect(mockPrisma.windowScheduleItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            windowNumber: 'W-1',
            windowMark: 'A',
            windowType: 'CASEMENT',
            elevation: 'SOUTH',
            uValue: 0.30,
            shgc: 0.25,
            egressCompliant: true,
            manufacturer: 'ANDERSEN',
            sourceSheetNumber: 'A-3.2',
          }),
        })
      );
    });

    it('should log successful storage', async () => {
      const extractionResult: WindowScheduleExtractionResult = {
        windows: [
          { windowNumber: 'W-1', windowType: 'FIXED' },
        ],
        windowTypes: {},
        glassTypes: {},
        extractedAt: new Date(),
      };

      mockPrisma.windowScheduleItem.upsert.mockResolvedValueOnce({});

      await storeWindowScheduleData('project-123', extractionResult);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'WINDOW_SCHEDULE',
        'Stored windows for project',
        { created: 1, projectId: 'project-123' }
      );
    });
  });

  describe('getWindowScheduleContext', () => {
    it('should build window schedule context for RAG queries', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });
      mockPrisma.windowScheduleItem.findMany.mockResolvedValueOnce([
        {
          windowNumber: 'W-1',
          windowType: 'FIXED ALUMINUM',
          width: "4'-0\"",
          height: "5'-0\"",
          operationType: 'FIXED',
          glazingType: 'INSULATED',
          roomNumber: '101',
          egressCompliant: false,
          manufacturer: 'KAWNEER',
        },
        {
          windowNumber: 'W-2',
          windowType: 'CASEMENT',
          width: "3'-0\"",
          height: "4'-0\"",
          operationType: 'CASEMENT',
          glazingType: 'INSULATED',
          roomNumber: '102',
          egressCompliant: true,
          manufacturer: 'ANDERSEN',
        },
      ]);

      const context = await getWindowScheduleContext('test-project');

      expect(context).toContain('WINDOW SCHEDULE (2 windows)');
      expect(context).toContain('Operation Type Summary:');
      expect(context).toContain('FIXED: 1 windows');
      expect(context).toContain('CASEMENT: 1 windows');
      expect(context).toContain('Glazing Type Summary:');
      expect(context).toContain('INSULATED: 2 windows');
      expect(context).toContain('Window Details:');
      expect(context).toContain('W-1: FIXED ALUMINUM (4\'-0" x 5\'-0") [FIXED] @ Room 101 - KAWNEER');
      expect(context).toContain('W-2: CASEMENT (3\'-0" x 4\'-0") [CASEMENT] @ Room 102 [EGRESS] - ANDERSEN');
    });

    it('should return null when project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce(null);

      const context = await getWindowScheduleContext('nonexistent-project');

      expect(context).toBeNull();
    });

    it('should return null when no windows exist', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });
      mockPrisma.windowScheduleItem.findMany.mockResolvedValueOnce([]);

      const context = await getWindowScheduleContext('test-project');

      expect(context).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.project.findUnique.mockRejectedValueOnce(new Error('Database error'));

      const context = await getWindowScheduleContext('test-project');

      expect(context).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'WINDOW_SCHEDULE',
        'Failed to get context',
        expect.any(Error)
      );
    });

    it('should group windows by operation type correctly', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });
      mockPrisma.windowScheduleItem.findMany.mockResolvedValueOnce([
        { windowNumber: 'W-1', windowType: 'FIXED', operationType: 'FIXED' },
        { windowNumber: 'W-2', windowType: 'FIXED', operationType: 'FIXED' },
        { windowNumber: 'W-3', windowType: 'CASEMENT', operationType: 'CASEMENT' },
        { windowNumber: 'W-4', windowType: 'SLIDING', operationType: null },
      ]);

      const context = await getWindowScheduleContext('test-project');

      expect(context).toContain('FIXED: 2 windows');
      expect(context).toContain('CASEMENT: 1 windows');
      expect(context).toContain('Unspecified: 1 windows');
    });

    it('should group windows by glazing type correctly', async () => {
      mockPrisma.project.findUnique.mockResolvedValueOnce({ id: 'project-id' });
      mockPrisma.windowScheduleItem.findMany.mockResolvedValueOnce([
        { windowNumber: 'W-1', windowType: 'FIXED', glazingType: 'INSULATED' },
        { windowNumber: 'W-2', windowType: 'FIXED', glazingType: 'INSULATED' },
        { windowNumber: 'W-3', windowType: 'FIXED', glazingType: 'TEMPERED' },
      ]);

      const context = await getWindowScheduleContext('test-project');

      expect(context).toContain('INSULATED: 2 windows');
      expect(context).toContain('TEMPERED: 1 windows');
    });
  });

  describe('processWindowScheduleForProject', () => {
    it('should process window schedules from project documents', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          name: 'Window Schedule',
          DocumentChunk: [
            {
              content: 'Window W-1: Fixed Aluminum, 4x5',
              sheetNumber: 'A-1.1',
            },
          ],
        },
      ]);

      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          windows: [
            {
              windowNumber: 'W-1',
              windowType: 'FIXED ALUMINUM',
            },
          ],
          windowTypes: {},
          glassTypes: {},
        }),
      });

      mockPrisma.windowScheduleItem.upsert.mockResolvedValueOnce({});

      const result = await processWindowScheduleForProject('project-id');

      expect(result).toEqual({
        success: true,
        windowsExtracted: 1,
        errors: [],
      });
    });

    it('should filter documents by window-related content', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([]);

      await processWindowScheduleForProject('project-id');

      const whereClause = mockPrisma.document.findMany.mock.calls[0][0].where;
      expect(whereClause).toMatchObject({
        projectId: 'project-id',
        deletedAt: null,
        OR: expect.arrayContaining([
          { name: { contains: 'window', mode: 'insensitive' } },
          { name: { contains: 'schedule', mode: 'insensitive' } },
          { category: 'ARCHITECTURAL' },
        ]),
      });
    });

    it('should filter to specific document when documentId provided', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([]);

      await processWindowScheduleForProject('project-id', 'doc-123');

      const whereClause = mockPrisma.document.findMany.mock.calls[0][0].where;
      expect(whereClause.id).toBe('doc-123');
    });

    it('should skip documents with no relevant chunks', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          name: 'Window Plan',
          DocumentChunk: [],
        },
        {
          id: 'doc-2',
          name: 'Window Schedule',
          DocumentChunk: [
            {
              content: 'Window data',
              sheetNumber: 'A-1.1',
            },
          ],
        },
      ]);

      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          windows: [{ windowNumber: 'W-1', windowType: 'FIXED' }],
          windowTypes: {},
          glassTypes: {},
        }),
      });

      mockPrisma.windowScheduleItem.upsert.mockResolvedValueOnce({});

      const result = await processWindowScheduleForProject('project-id');

      expect(mockCallAbacusLLM).toHaveBeenCalledTimes(1); // Only for doc-2
      expect(result.windowsExtracted).toBe(1);
    });

    it('should handle extraction errors and continue processing', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          name: 'Window Plan',
          DocumentChunk: [{ content: 'Window data', sheetNumber: 'A-1.1' }],
        },
      ]);

      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          windows: [{ windowNumber: 'W-1', windowType: 'FIXED' }],
          windowTypes: {},
          glassTypes: {},
        }),
      });

      mockPrisma.windowScheduleItem.upsert.mockRejectedValueOnce(new Error('DB error'));

      const result = await processWindowScheduleForProject('project-id');

      expect(result.success).toBe(false);
      expect(result.windowsExtracted).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle database query errors gracefully', async () => {
      mockPrisma.document.findMany.mockRejectedValueOnce(new Error('Database connection error'));

      const result = await processWindowScheduleForProject('project-id');

      expect(result).toEqual({
        success: false,
        windowsExtracted: 0,
        errors: expect.arrayContaining([
          expect.stringContaining('Database connection error'),
        ]),
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WINDOW_SCHEDULE',
        'Processing failed',
        expect.any(Error)
      );
    });

    it('should combine multiple chunks from same document', async () => {
      mockPrisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc-1',
          name: 'Window Schedule',
          DocumentChunk: [
            { content: 'Window W-1 data', sheetNumber: 'A-1.1' },
            { content: 'Window W-2 data', sheetNumber: 'A-1.2' },
          ],
        },
      ]);

      mockCallAbacusLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          windows: [],
          windowTypes: {},
          glassTypes: {},
        }),
      });

      await processWindowScheduleForProject('project-id');

      const callArgs = mockCallAbacusLLM.mock.calls[0][0];
      const promptContent = callArgs[0].content;
      expect(promptContent).toContain('Window W-1 data');
      expect(promptContent).toContain('Window W-2 data');
    });
  });
});
