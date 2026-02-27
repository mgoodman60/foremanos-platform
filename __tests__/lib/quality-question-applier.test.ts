import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  qualityQuestion: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  documentChunk: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockPerformQualityCheck = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/vision-api-quality', () => ({
  performQualityCheck: mockPerformQualityCheck,
}));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

// Import after mocking
import { applyQuestionAnswer } from '@/lib/quality-question-applier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunk(contentJson: object | null = { sheetNumber: '', sheetTitle: 'Floor Plan', scale: '1/4"=1\'-0"' }) {
  return {
    id: 'chunk-1',
    content: contentJson !== null ? JSON.stringify(contentJson) : 'not-json',
    metadata: null,
    qualityScore: 30,
    qualityPassed: false,
  };
}

function makeQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'question-1',
    field: 'sheetNumber',
    pageNumber: 3,
    applied: false,
    chunk: makeChunk(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyQuestionAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default $transaction: execute the array of promises by calling each and
    // returning their results
    mockPrisma.$transaction.mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) {
        return Promise.all(ops);
      }
      if (typeof ops === 'function') {
        return ops(mockPrisma);
      }
      return ops;
    });
  });

  describe('success case — answer updates chunk content', () => {
    it('updates chunk content with the new field value', async () => {
      const question = makeQuestion({ field: 'sheetNumber', pageNumber: 3 });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 30, passed: false, issues: ['Missing sheet number'], suggestions: [] })
        .mockReturnValueOnce({ score: 70, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      const result = await applyQuestionAnswer('question-1', 'A-101', 'user-1');

      expect(result.fieldUpdated).toBe('sheetNumber');
      expect(mockPrisma.documentChunk.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'chunk-1' },
          data: expect.objectContaining({
            qualityScore: 70,
            qualityPassed: true,
          }),
        })
      );
    });

    it('saves the answer text into the chunk content JSON', async () => {
      const question = makeQuestion({ field: 'sheetNumber', pageNumber: 2 });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 25, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 55, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      await applyQuestionAnswer('question-1', 'E-201', 'user-1');

      // The content written to DB should contain the answer
      const updateCall = mockPrisma.documentChunk.update.mock.calls[0][0];
      const parsedContent = JSON.parse(updateCall.data.content);
      expect(parsedContent.sheetNumber).toBe('E-201');
    });
  });

  describe('quality re-scoring', () => {
    it('returns qualityBefore and qualityAfter scores', async () => {
      const question = makeQuestion({ field: 'sheetNumber', pageNumber: 1 });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 30, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 65, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      const result = await applyQuestionAnswer('question-1', 'A-101', 'user-1');

      expect(result.qualityBefore).toBe(30);
      expect(result.qualityAfter).toBe(65);
    });

    it('sets qualityPassed: true when qualityAfter >= 40', async () => {
      const question = makeQuestion({ field: 'sheetNumber', pageNumber: 1 });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 25, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 40, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      await applyQuestionAnswer('question-1', 'A-101', 'user-1');

      const updateCall = mockPrisma.documentChunk.update.mock.calls[0][0];
      expect(updateCall.data.qualityPassed).toBe(true);
    });

    it('sets qualityPassed: false when qualityAfter < 40', async () => {
      const question = makeQuestion({ field: 'sheetNumber', pageNumber: 1 });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 20, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 35, passed: false, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      await applyQuestionAnswer('question-1', 'A-101', 'user-1');

      const updateCall = mockPrisma.documentChunk.update.mock.calls[0][0];
      expect(updateCall.data.qualityPassed).toBe(false);
    });
  });

  describe('question marked as applied in DB', () => {
    it('marks the qualityQuestion as applied with answer and timestamp', async () => {
      const question = makeQuestion({ field: 'discipline', pageNumber: 5 });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 40, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 60, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      await applyQuestionAnswer('question-1', 'Architectural', 'user-42');

      expect(mockPrisma.qualityQuestion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'question-1' },
          data: expect.objectContaining({
            answer: 'Architectural',
            answeredBy: 'user-42',
            applied: true,
            confidenceBefore: 40,
            confidenceAfter: 60,
          }),
        })
      );
    });

    it('sets answeredAt to a Date object', async () => {
      const question = makeQuestion();
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 30, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 50, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      await applyQuestionAnswer('question-1', 'A-101', 'user-1');

      const updateCall = mockPrisma.qualityQuestion.update.mock.calls[0][0];
      expect(updateCall.data.answeredAt).toBeInstanceOf(Date);
    });
  });

  describe('error handling', () => {
    it('throws "Question not found" when question does not exist', async () => {
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(null);

      await expect(applyQuestionAnswer('nonexistent-id', 'A-101', 'user-1'))
        .rejects.toThrow('Question not found');
    });

    it('throws "Chunk not found for question" when question has no chunk', async () => {
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue({
        id: 'question-1',
        field: 'sheetNumber',
        pageNumber: 1,
        applied: false,
        chunk: null,
      });

      await expect(applyQuestionAnswer('question-1', 'A-101', 'user-1'))
        .rejects.toThrow('Chunk not found for question');
    });

    it('throws "Answer already applied" when question.applied is true', async () => {
      const question = makeQuestion({ applied: true });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      await expect(applyQuestionAnswer('question-1', 'A-101', 'user-1'))
        .rejects.toThrow('Answer already applied');
    });

    it('handles chunk content that is not valid JSON by falling back to metadata', async () => {
      const question = makeQuestion();
      // Override chunk with non-JSON content
      question.chunk = {
        id: 'chunk-1',
        content: 'plain text not JSON',
        metadata: { sheetNumber: '', sheetTitle: 'Plan' },
        qualityScore: 20,
        qualityPassed: false,
      };
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 20, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 45, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      // Should not throw
      const result = await applyQuestionAnswer('question-1', 'A-101', 'user-1');
      expect(result.fieldUpdated).toBe('sheetNumber');
    });
  });

  describe('transaction execution', () => {
    it('executes both chunk update and question update in the same $transaction', async () => {
      const question = makeQuestion();
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 30, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 60, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      await applyQuestionAnswer('question-1', 'A-101', 'user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    });
  });

  describe('logging', () => {
    it('logs info after successfully applying an answer', async () => {
      const question = makeQuestion({ field: 'scale', pageNumber: 8 });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 35, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 60, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      await applyQuestionAnswer('question-1', '1/4"=1\'-0"', 'user-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'QUALITY_APPLIER',
        expect.stringContaining('scale'),
        expect.objectContaining({ questionId: 'question-1', pageNumber: 8 })
      );
    });
  });

  describe('nested field paths', () => {
    it('applies answer to nested field using dot notation', async () => {
      const chunkContent = { titleBlock: { date: '' }, sheetNumber: 'A-101' };
      const question = makeQuestion({ field: 'titleBlock.date', chunk: makeChunk(chunkContent) });
      mockPrisma.qualityQuestion.findUnique.mockResolvedValue(question);

      mockPerformQualityCheck
        .mockReturnValueOnce({ score: 40, passed: false, issues: [], suggestions: [] })
        .mockReturnValueOnce({ score: 55, passed: true, issues: [], suggestions: [] });

      mockPrisma.documentChunk.update.mockResolvedValue({});
      mockPrisma.qualityQuestion.update.mockResolvedValue({});

      await applyQuestionAnswer('question-1', '2024-01-15', 'user-1');

      const updateCall = mockPrisma.documentChunk.update.mock.calls[0][0];
      const parsed = JSON.parse(updateCall.data.content);
      expect(parsed.titleBlock.date).toBe('2024-01-15');
    });
  });
});
