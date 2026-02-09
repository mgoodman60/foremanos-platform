import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectUnknownSymbol,
  getCustomSymbols,
  getSymbolById,
  applyLearningFeedback,
  learnFromDocuments,
  type CustomSymbol,
  type LearningFeedback
} from '@/lib/adaptive-symbol-learning';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn()
  },
  customSymbol: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn()
  },
  documentChunk: {
    findMany: vi.fn()
  }
}));

const mockCallAbacusLLM = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/abacus-llm', () => ({ callAbacusLLM: mockCallAbacusLLM }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger)
}));

describe('adaptive-symbol-learning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectUnknownSymbol', () => {
    it('should return existing symbol if found with high confidence', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([
        {
          id: 'sym1',
          projectId,
          name: 'Custom Valve Symbol',
          description: 'Special valve type',
          category: 'plumbing',
          aliases: ['valve-cv1', 'custom valve'],
          confidence: 0.9,
          usageCount: 10,
          learnedFrom: 'Sheet P-101',
          contextInfo: {},
          confirmedBy: 'user@example.com',
          updatedAt: new Date()
        }
      ]);

      const result = await detectUnknownSymbol(
        'test-project',
        'custom valve',
        'Found in plumbing plans sheet P-101'
      );

      expect(result.symbol).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.isNew).toBe(false);
      expect(mockCallAbacusLLM).not.toHaveBeenCalled();
    });

    it('should use AI to analyze new unknown symbol', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([]);
      mockPrisma.customSymbol.upsert.mockResolvedValue({
        id: 'new-sym',
        projectId,
        name: 'Unknown Device',
        category: 'custom'
      });

      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          name: 'Unknown Device',
          category: 'custom',
          description: 'Unidentified equipment',
          confidence: 0.6,
          suggestion: 'Verify with project team'
        })
      });

      const result = await detectUnknownSymbol(
        'test-project',
        'strange symbol X',
        'Found on mechanical plans'
      );

      expect(mockCallAbacusLLM).toHaveBeenCalled();
      expect(result.symbol).toBeDefined();
      expect(result.isNew).toBe(true);
      expect(result.suggestion).toBeDefined();
    });

    it('should handle AI response with markdown code blocks', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([]);
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      mockCallAbacusLLM.mockResolvedValue({
        content: '```json\n{"name":"Test Symbol","category":"electrical","description":"A test","confidence":0.75,"suggestion":"Review"}\n```'
      });

      const result = await detectUnknownSymbol('test-project', 'test', 'context');

      expect(result.symbol).toBeDefined();
      expect(result.confidence).toBe(0.75);
    });

    it('should handle AI JSON parsing errors gracefully', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([]);
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      mockCallAbacusLLM.mockResolvedValue({
        content: 'This is not valid JSON at all'
      });

      const result = await detectUnknownSymbol('test-project', 'test', 'context');

      expect(result.symbol).toBeDefined();
      expect(result.confidence).toBeLessThan(0.5); // Fallback low confidence
    });

    it('should handle AI analysis errors', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([]);

      mockCallAbacusLLM.mockRejectedValue(new Error('AI service unavailable'));

      const result = await detectUnknownSymbol('test-project', 'test', 'context');

      expect(mockLogger.error).toHaveBeenCalled();
      expect(result.confidence).toBeLessThanOrEqual(0.1); // May have fallback confidence
    });

    it('should include alternatives when similar symbol found', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([
        {
          id: 'sym1',
          projectId,
          name: 'Similar Symbol',
          description: 'Similar to what we are looking for',
          category: 'electrical',
          aliases: ['sim-symbol'],
          confidence: 0.65,
          usageCount: 5,
          learnedFrom: 'context',
          contextInfo: {}
        }
      ]);
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          name: 'New Symbol',
          category: 'electrical',
          description: 'desc',
          confidence: 0.7,
          suggestion: 'review'
        })
      });

      const result = await detectUnknownSymbol('test-project', 'similar', 'electrical context');

      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    it('should store visual description if provided', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([]);
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          name: 'Circle with X',
          category: 'custom',
          description: 'desc',
          confidence: 0.7,
          suggestion: 'verify'
        })
      });

      await detectUnknownSymbol(
        'test-project',
        'unknown',
        'context',
        'Circle with X inside'
      );

      const llmCall = mockCallAbacusLLM.mock.calls[0][0];
      expect(llmCall[0].content).toContain('Circle with X inside');
    });
  });

  describe('getCustomSymbols', () => {
    it('should return all symbols for a project', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([
        {
          id: 'sym1',
          projectId,
          name: 'Symbol 1',
          description: 'desc1',
          category: 'electrical',
          aliases: ['s1'],
          confidence: 0.8,
          usageCount: 10,
          learnedFrom: 'context',
          contextInfo: {},
          updatedAt: new Date()
        },
        {
          id: 'sym2',
          projectId,
          name: 'Symbol 2',
          description: 'desc2',
          category: 'plumbing',
          aliases: ['s2'],
          confidence: 0.9,
          usageCount: 5,
          learnedFrom: 'context',
          contextInfo: {},
          updatedAt: new Date()
        }
      ]);

      const result = await getCustomSymbols('test-project');

      expect(result.length).toBe(2);
      expect(result[0].category).toBeDefined();
    });

    it('should filter symbols by category', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([
        {
          id: 'sym1',
          projectId,
          name: 'Symbol 1',
          category: 'electrical',
          description: 'desc',
          aliases: [],
          confidence: 0.8,
          usageCount: 10,
          learnedFrom: 'context',
          contextInfo: {},
          updatedAt: new Date()
        }
      ]);

      const result = await getCustomSymbols('test-project', 'electrical');

      expect(result.length).toBe(1);
      expect(result[0].category).toBe('electrical');
    });

    it('should return empty array for non-existent project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await getCustomSymbols('non-existent');

      expect(result).toEqual([]);
    });

    it('should map Prisma model fields to CustomSymbol interface', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([
        {
          id: 'sym1',
          projectId,
          name: 'Test Symbol',
          description: 'description',
          category: 'electrical',
          aliases: ['alias1', 'alias2'],
          confidence: 0.85,
          usageCount: 15,
          learnedFrom: 'Sheet E-101',
          standardMatch: 'IEEE-315',
          contextInfo: { additionalData: 'value' },
          confirmedBy: 'user@example.com',
          updatedAt: new Date()
        }
      ]);

      const result = await getCustomSymbols('test-project');

      expect(result[0]).toMatchObject({
        id: 'sym1',
        projectSlug: 'test-project',
        name: 'Test Symbol',
        category: 'electrical',
        confidence: 0.85,
        occurrences: 15
      });
      expect(result[0].confirmedBy).toBe('user@example.com');
      expect(result[0].metadata?.standardReference).toBe('IEEE-315');
    });
  });

  describe('getSymbolById', () => {
    it('should return symbol by ID', async () => {
      mockPrisma.customSymbol.findUnique.mockResolvedValue({
        id: 'sym1',
        projectId: 'proj1',
        name: 'Test Symbol',
        description: 'desc',
        category: 'electrical',
        aliases: ['t1'],
        confidence: 0.8,
        usageCount: 10,
        learnedFrom: 'context',
        contextInfo: {},
        updatedAt: new Date(),
        Project: { slug: 'test-project' }
      });

      const result = await getSymbolById('sym1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('sym1');
      expect(result!.projectSlug).toBe('test-project');
    });

    it('should return null for non-existent symbol', async () => {
      mockPrisma.customSymbol.findUnique.mockResolvedValue(null);

      const result = await getSymbolById('non-existent');

      expect(result).toBeNull();
    });

    it('should include confirmed metadata if present', async () => {
      mockPrisma.customSymbol.findUnique.mockResolvedValue({
        id: 'sym1',
        projectId: 'proj1',
        name: 'Confirmed Symbol',
        description: 'desc',
        category: 'electrical',
        aliases: [],
        confidence: 0.95,
        usageCount: 20,
        learnedFrom: 'context',
        contextInfo: {},
        confirmedBy: 'expert@example.com',
        updatedAt: new Date('2024-01-15'),
        Project: { slug: 'test-project' }
      });

      const result = await getSymbolById('sym1');

      expect(result!.confirmedBy).toBe('expert@example.com');
      expect(result!.confirmedAt).toBeDefined();
    });
  });

  describe('applyLearningFeedback', () => {
    it('should increase confidence for correct feedback', async () => {
      const symbol: CustomSymbol = {
        id: 'sym1',
        projectSlug: 'test-project',
        symbolId: 'sym1',
        name: 'Test Symbol',
        category: 'electrical',
        description: 'desc',
        visualPattern: 'pattern',
        contexts: ['context'],
        aliases: ['alias'],
        confidence: 0.7,
        occurrences: 5
      };

      mockPrisma.customSymbol.findUnique.mockResolvedValue({
        id: 'sym1',
        projectId: 'proj1',
        name: 'Test Symbol',
        description: 'desc',
        category: 'electrical',
        aliases: ['alias'],
        confidence: 0.7,
        usageCount: 5,
        learnedFrom: 'context',
        contextInfo: {},
        updatedAt: new Date(),
        Project: { slug: 'test-project' }
      });

      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1', slug: 'test-project' });
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      const feedback: LearningFeedback = {
        symbolId: 'sym1',
        isCorrect: true,
        userEmail: 'user@example.com',
        timestamp: new Date()
      };

      const result = await applyLearningFeedback(feedback);

      expect(result).toBe(true);
      expect(mockPrisma.customSymbol.upsert).toHaveBeenCalled();
    });

    it('should decrease confidence for incorrect feedback', async () => {
      mockPrisma.customSymbol.findUnique.mockResolvedValue({
        id: 'sym1',
        projectId: 'proj1',
        name: 'Test Symbol',
        description: 'desc',
        category: 'electrical',
        aliases: ['alias'],
        confidence: 0.8,
        usageCount: 5,
        learnedFrom: 'context',
        contextInfo: {},
        updatedAt: new Date(),
        Project: { slug: 'test-project' }
      });

      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1', slug: 'test-project' });
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      const feedback: LearningFeedback = {
        symbolId: 'sym1',
        isCorrect: false,
        userEmail: 'user@example.com',
        timestamp: new Date()
      };

      const result = await applyLearningFeedback(feedback);

      expect(result).toBe(true);
    });

    it('should update symbol with corrections', async () => {
      mockPrisma.customSymbol.findUnique.mockResolvedValue({
        id: 'sym1',
        projectId: 'proj1',
        name: 'Wrong Name',
        description: 'desc',
        category: 'wrong_category',
        aliases: ['alias'],
        confidence: 0.8,
        usageCount: 5,
        learnedFrom: 'context',
        contextInfo: {},
        updatedAt: new Date(),
        Project: { slug: 'test-project' }
      });

      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1', slug: 'test-project' });
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      const feedback: LearningFeedback = {
        symbolId: 'sym1',
        isCorrect: false,
        correctName: 'Correct Name',
        correctCategory: 'electrical',
        userEmail: 'user@example.com',
        timestamp: new Date()
      };

      const result = await applyLearningFeedback(feedback);

      expect(result).toBe(true);
      expect(mockPrisma.customSymbol.upsert).toHaveBeenCalled();
    });

    it('should return false for non-existent symbol', async () => {
      mockPrisma.customSymbol.findUnique.mockResolvedValue(null);

      const feedback: LearningFeedback = {
        symbolId: 'non-existent',
        isCorrect: true,
        userEmail: 'user@example.com',
        timestamp: new Date()
      };

      const result = await applyLearningFeedback(feedback);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.customSymbol.findUnique.mockRejectedValue(new Error('Database error'));

      const feedback: LearningFeedback = {
        symbolId: 'sym1',
        isCorrect: true,
        userEmail: 'user@example.com',
        timestamp: new Date()
      };

      const result = await applyLearningFeedback(feedback);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('learnFromDocuments', () => {
    it('should learn from document chunk metadata', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk1',
          content: 'Some content',
          metadata: {
            structuralCallouts: [
              { description: 'Custom beam symbol', visualDescription: 'W-shaped' }
            ],
            mepCallouts: [
              { description: 'Special valve', visualDescription: 'Circular with cross' }
            ]
          }
        }
      ]);

      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1', slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([]);
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          name: 'Test',
          category: 'structural',
          description: 'desc',
          confidence: 0.7,
          suggestion: 'review'
        })
      });

      const result = await learnFromDocuments('test-project');

      expect(result.symbolsLearned).toBeGreaterThan(0);
      expect(result.categoriesFound.size).toBeGreaterThan(0);
    });

    it('should handle empty document chunks', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([]);

      const result = await learnFromDocuments('test-project');

      expect(result.symbolsLearned).toBe(0);
      expect(result.categoriesFound.size).toBe(0);
      expect(result.confidence).toBe(0);
    });

    it('should handle chunks with missing metadata', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk1',
          content: 'Some content',
          metadata: null
        }
      ]);

      const result = await learnFromDocuments('test-project');

      expect(result.symbolsLearned).toBe(0);
    });

    it('should calculate average confidence', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValue([
        {
          id: 'chunk1',
          content: 'content',
          metadata: {
            structuralCallouts: [{ description: 'symbol1' }, { description: 'symbol2' }]
          }
        }
      ]);

      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj1', slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([]);
      mockPrisma.customSymbol.upsert.mockResolvedValue({});

      mockCallAbacusLLM.mockResolvedValue({
        content: JSON.stringify({
          name: 'Test',
          category: 'custom',
          description: 'desc',
          confidence: 0.8,
          suggestion: 'review'
        })
      });

      const result = await learnFromDocuments('test-project');

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle learning errors gracefully', async () => {
      mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('Database error'));

      const result = await learnFromDocuments('test-project');

      expect(result.symbolsLearned).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('similarity matching', () => {
    it('should score name similarity', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([
        {
          id: 'sym1',
          projectId,
          name: 'Butterfly Valve',
          description: 'desc',
          category: 'plumbing',
          aliases: ['BV', 'butterfly'],
          confidence: 0.8,
          usageCount: 10,
          learnedFrom: 'context',
          contextInfo: {},
          updatedAt: new Date()
        }
      ]);

      const result = await detectUnknownSymbol('test-project', 'butterfly', 'valve context');

      // Should match existing symbol due to name similarity
      expect(result.isNew).toBe(false);
    });

    it('should boost score for confirmed symbols', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([
        {
          id: 'sym1',
          projectId,
          name: 'Test Symbol',
          description: 'desc',
          category: 'electrical',
          aliases: ['test'],
          confidence: 0.7,
          usageCount: 5,
          learnedFrom: 'context',
          contextInfo: {},
          confirmedBy: 'expert@example.com', // Confirmed
          updatedAt: new Date()
        }
      ]);

      const result = await detectUnknownSymbol('test-project', 'test', 'electrical context');

      // Confirmed symbols should have higher confidence match
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should boost score for frequently used symbols', async () => {
      const projectId = 'proj1';
      mockPrisma.project.findUnique.mockResolvedValue({ id: projectId, slug: 'test-project' });
      mockPrisma.customSymbol.findMany.mockResolvedValue([
        {
          id: 'sym1',
          projectId,
          name: 'Common Symbol',
          description: 'desc',
          category: 'electrical',
          aliases: ['common'],
          confidence: 0.7,
          usageCount: 15, // Frequently used
          learnedFrom: 'context',
          contextInfo: {},
          updatedAt: new Date()
        }
      ]);

      const result = await detectUnknownSymbol('test-project', 'common', 'context');

      // Frequently used symbols should have boost
      expect(result.isNew).toBe(false);
    });
  });
});
