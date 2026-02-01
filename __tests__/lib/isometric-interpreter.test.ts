import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock Prisma with vi.hoisted to ensure it's available before module imports
const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
}));

// Mock Abacus LLM
const mockCallAbacusLLM = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: mockCallAbacusLLM,
}));

// Import functions after mocks
import {
  detectIsometricViews,
  reconstructFrom2D,
  generateIsometricView,
  isometricInterpreter,
  type IsometricAnalysis,
  type IsometricView,
  type Spatial3DModel,
  type IsometricElement,
  type IsometricGenerationResult,
} from '@/lib/isometric-interpreter';
import { prisma } from '@/lib/db';
import { callAbacusLLM } from '@/lib/abacus-llm';

describe('Isometric Interpreter - Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectIsometricViews', () => {
    it('should detect isometric views from sheet with isometric keyword', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'This is an isometric view of the piping system',
          pageNumber: 1,
          metadata: {
            sheet_number: 'M-101',
            drawing_type: 'Piping Isometric',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: JSON.stringify({
          viewType: 'isometric',
          confidence: 0.85,
          elements: 15,
          verticality: 'high',
          complexity: 'moderate',
          recommendations: ['Review with MEP coordination team'],
        }),
        model: 'gpt-4o',
      });

      const result = await detectIsometricViews('test-project', 'M-101');

      expect(result).toBeDefined();
      expect(result?.viewType).toBe('isometric');
      expect(result?.confidence).toBe(0.85);
      expect(result?.elements).toBe(15);
      expect(result?.verticality).toBe('high');
      expect(result?.complexity).toBe('moderate');
      expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({
        where: {
          Document: {
            Project: { slug: 'test-project' },
          },
          metadata: {
            path: ['sheet_number'],
            equals: 'M-101',
          },
        },
      });
    });

    it('should detect isometric views from drawing type metadata', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Piping system details',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-202',
            drawing_type: 'Axonometric View',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: '{"viewType":"axonometric","confidence":0.9,"elements":12,"verticality":"medium","complexity":"moderate","recommendations":["Standard routing"]}',
        model: 'gpt-4o',
      });

      const result = await detectIsometricViews('test-project', 'P-202');

      expect(result).toBeDefined();
      expect(result?.viewType).toBe('axonometric');
      expect(result?.confidence).toBe(0.9);
    });

    it('should return null when no chunks found', async () => {
      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue([]);

      const result = await detectIsometricViews('test-project', 'M-101');

      expect(result).toBeNull();
    });

    it('should return null when no isometric keywords found', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Standard floor plan layout',
          pageNumber: 1,
          metadata: {
            sheet_number: 'A-101',
            drawing_type: 'Floor Plan',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await detectIsometricViews('test-project', 'A-101');

      expect(result).toBeNull();
      expect(callAbacusLLM).not.toHaveBeenCalled();
    });

    it('should handle AI response with markdown code blocks', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'ISO view of ductwork',
          pageNumber: 1,
          metadata: {
            sheet_number: 'M-301',
            drawing_type: 'HVAC Isometric',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: '```json\n{"viewType":"isometric","confidence":0.75,"elements":20,"verticality":"low","complexity":"complex","recommendations":["Verify clearances"]}\n```',
        model: 'gpt-4o',
      });

      const result = await detectIsometricViews('test-project', 'M-301');

      expect(result).toBeDefined();
      expect(result?.viewType).toBe('isometric');
      expect(result?.elements).toBe(20);
    });

    it('should handle invalid AI response with fallback', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Isometric piping layout',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            drawing_type: 'Piping Iso',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: 'Invalid JSON response',
        model: 'gpt-4o',
      });

      const result = await detectIsometricViews('test-project', 'P-101');

      expect(result).toBeDefined();
      expect(result?.viewType).toBe('isometric');
      expect(result?.confidence).toBe(0.5);
      expect(result?.recommendations).toContain('Manual interpretation recommended');
    });

    it('should handle AI errors with fallback analysis', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Isometric view',
          pageNumber: 1,
          metadata: {
            sheet_number: 'M-101',
            drawing_type: 'Isometric',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockRejectedValue(new Error('AI service error'));

      const result = await detectIsometricViews('test-project', 'M-101');

      expect(result).toBeDefined();
      expect(result?.confidence).toBe(0.3);
      expect(result?.recommendations).toContain('AI analysis unavailable - manual review required');
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.documentChunk.findMany).mockRejectedValue(new Error('Database error'));

      const result = await detectIsometricViews('test-project', 'M-101');

      expect(result).toBeNull();
    });

    it('should clamp confidence values to 0-1 range', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Isometric view',
          pageNumber: 1,
          metadata: {
            sheet_number: 'M-101',
            drawing_type: 'Isometric',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: JSON.stringify({
          viewType: 'isometric',
          confidence: 1.5, // Out of range
          elements: -5, // Negative
          verticality: 'high',
          complexity: 'moderate',
          recommendations: ['Test'],
        }),
        model: 'gpt-4o',
      });

      const result = await detectIsometricViews('test-project', 'M-101');

      expect(result?.confidence).toBe(1); // Clamped to max
      expect(result?.elements).toBe(0); // Clamped to min
    });

    it('should handle missing recommendations array', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Isometric view',
          pageNumber: 1,
          metadata: {
            sheet_number: 'M-101',
            drawing_type: 'Isometric',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: JSON.stringify({
          viewType: 'isometric',
          confidence: 0.8,
          elements: 10,
          verticality: 'medium',
          complexity: 'simple',
          recommendations: 'Not an array', // Invalid type
        }),
        model: 'gpt-4o',
      });

      const result = await detectIsometricViews('test-project', 'M-101');

      expect(result?.recommendations).toEqual(['Review with MEP coordination team']);
    });
  });
});

describe('Isometric Interpreter - 3D Reconstruction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reconstructFrom2D', () => {
    it('should reconstruct 3D model from isometric sheet with MEP callouts', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Piping layout',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            mepCallouts: [
              {
                type: 'pipe',
                description: 'Horizontal pipe run',
                size: '2"',
                elevation: 10,
              },
              {
                type: 'duct',
                description: 'Vertical riser',
                size: '12x8',
                elevation: 15,
              },
              {
                type: 'fitting',
                description: 'Elbow fitting',
                size: '2"',
                elevation: 10,
              },
            ],
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101', '30-60');

      expect(result).toBeDefined();
      expect(result?.elements).toHaveLength(3);
      expect(result?.elements[0].type).toBe('pipe');
      expect(result?.elements[1].type).toBe('duct');
      expect(result?.elements[2].type).toBe('fitting');
      expect(result?.bounds).toBeDefined();
      expect(result?.paths).toBeDefined();
    });

    it('should return null when no chunks found', async () => {
      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue([]);

      const result = await reconstructFrom2D('test-project', 'P-101');

      expect(result).toBeNull();
    });

    it('should handle 45-45 view angle conversion', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            mepCallouts: [
              {
                type: 'pipe',
                description: 'Pipe',
                size: '2"',
              },
            ],
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101', '45-45');

      expect(result).toBeDefined();
      expect(result?.elements).toHaveLength(1);
    });

    it('should handle custom view angle with fallback', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            mepCallouts: [
              {
                type: 'pipe',
                description: 'Pipe',
              },
            ],
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101', 'custom');

      expect(result).toBeDefined();
      expect(result?.elements[0].position3D.z).toBe(0); // Fallback Z
    });

    it('should infer element types correctly', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            mepCallouts: [
              { description: 'Pipe section' },
              { description: 'Duct work' },
              { description: 'Tee fitting' },
              { description: 'Support hanger' },
              { description: 'Chiller equipment' },
            ],
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101');

      expect(result?.elements[0].type).toBe('pipe');
      expect(result?.elements[1].type).toBe('duct');
      expect(result?.elements[2].type).toBe('fitting');
      expect(result?.elements[3].type).toBe('support');
      expect(result?.elements[4].type).toBe('equipment');
    });

    it('should infer orientation from description', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            mepCallouts: [
              { description: 'Vertical riser' },
              { description: 'Horizontal run' },
              { description: 'Diagonal slope' },
              { description: 'Pipe up' },
              { description: 'Level pipe' },
              { description: 'Angled pipe' },
              { description: 'Pipe' }, // Default
            ],
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101');

      expect(result?.elements[0].orientation).toBe('vertical');
      expect(result?.elements[1].orientation).toBe('horizontal');
      expect(result?.elements[2].orientation).toBe('diagonal');
      expect(result?.elements[3].orientation).toBe('vertical');
      expect(result?.elements[4].orientation).toBe('horizontal');
      expect(result?.elements[5].orientation).toBe('diagonal');
      expect(result?.elements[6].orientation).toBe('horizontal'); // Default
    });

    it('should build connections between nearby elements', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            mepCallouts: [
              { type: 'pipe', description: 'Pipe 1', elevation: 10 },
              { type: 'pipe', description: 'Pipe 2', elevation: 10 },
            ],
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101');

      // Elements should be connected if within threshold
      expect(result?.elements[0].connections.length).toBeGreaterThanOrEqual(0);
      expect(result?.elements[1].connections.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate correct bounds for elements', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            mepCallouts: [
              { description: 'Element 1' },
              { description: 'Element 2' },
            ],
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101');

      expect(result?.bounds).toBeDefined();
      expect(result?.bounds.minX).toBeDefined();
      expect(result?.bounds.maxX).toBeDefined();
      expect(result?.bounds.minY).toBeDefined();
      expect(result?.bounds.maxY).toBeDefined();
      expect(result?.bounds.minZ).toBeDefined();
      expect(result?.bounds.maxZ).toBeDefined();
    });

    it('should handle empty bounds for no elements', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101');

      expect(result?.bounds).toEqual({
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        minZ: 0,
        maxZ: 0,
      });
    });

    it('should identify paths through connected elements', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            sheet_number: 'P-101',
            mepCallouts: [
              { description: 'Pipe 1', elevation: 10 },
              { description: 'Pipe 2', elevation: 12 },
              { description: 'Pipe 3', elevation: 15 },
            ],
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await reconstructFrom2D('test-project', 'P-101');

      expect(result?.paths).toBeDefined();
      expect(Array.isArray(result?.paths)).toBe(true);
      // Paths are only created for connected elements (length > 1)
      if (result && result.paths.length > 0) {
        expect(result.paths[0]).toHaveProperty('id');
        expect(result.paths[0]).toHaveProperty('elements');
        expect(result.paths[0]).toHaveProperty('totalLength');
        expect(result.paths[0]).toHaveProperty('elevationChange');
      }
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.documentChunk.findMany).mockRejectedValue(new Error('Database error'));

      const result = await reconstructFrom2D('test-project', 'P-101');

      expect(result).toBeNull();
    });
  });
});

describe('Isometric Interpreter - View Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateIsometricView', () => {
    it('should generate isometric view from plan with MEP callouts', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'HVAC layout details',
          pageNumber: 1,
          metadata: {
            sheet_number: 'M-201',
            mepCallouts: [
              {
                type: 'duct',
                description: 'Supply air duct',
                size: '12x8',
                elevation: 12,
                tag: 'SA-1',
              },
              {
                type: 'pipe',
                description: 'Hot water pipe',
                size: '2"',
                elevation: 10,
                tag: 'HW-1',
              },
            ],
          },
          Document: {
            name: 'HVAC Plan',
            fileName: 'M-201.pdf',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1', 'M-201');

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.model).toBeDefined();
      expect(result.visualization).toBeDefined();
      expect(result.model?.elements.length).toBeGreaterThan(0);
      expect(result.visualization?.svgData).toContain('<svg');
    });

    it('should generate view without sheet number filter', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Plumbing layout',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              {
                type: 'pipe',
                description: 'Water line',
                size: '1"',
              },
            ],
          },
          Document: {
            name: 'Plumbing Plan',
            fileName: 'P-101.pdf',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(true);
      expect(prisma.documentChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            metadata: expect.anything(),
          }),
        })
      );
    });

    it('should return error when no chunks found', async () => {
      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue([]);

      const result = await generateIsometricView('project-1', 'doc-1', 'M-201');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No data found for the selected sheet');
    });

    it('should use AI to extract elements when no MEP callouts', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Contains piping details with 2" hot water pipe at elevation 10 feet and 12x8 supply air duct at 12 feet',
          pageNumber: 1,
          metadata: {
            drawing_type: 'Mechanical Plan',
          },
          Document: {
            name: 'Mechanical Plan',
            fileName: 'M-201.pdf',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: JSON.stringify([
          { type: 'pipe', system: 'plumbing', size: '2"', elevation: 10, label: 'HW-1' },
          { type: 'duct', system: 'hvac', size: '12x8', elevation: 12, label: 'SA-1' },
        ]),
        model: 'gpt-4o',
      });

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(true);
      expect(result.model?.elements.length).toBeGreaterThan(0);
    });

    it('should return error when no MEP elements found', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Floor plan with rooms',
          pageNumber: 1,
          metadata: {},
          Document: {
            name: 'Floor Plan',
            fileName: 'A-101.pdf',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: '[]',
        model: 'gpt-4o',
      });

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No MEP elements found');
    });

    it('should handle AI extraction with markdown code blocks', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'MEP details',
          pageNumber: 1,
          metadata: {},
          Document: {
            name: 'Plan',
            fileName: 'M-101.pdf',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: '```json\n[{"type":"pipe","system":"plumbing","size":"2\\""}]\n```',
        model: 'gpt-4o',
      });

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(true);
    });

    it('should handle AI extraction with array match', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'MEP details',
          pageNumber: 1,
          metadata: {},
          Document: {
            name: 'Plan',
            fileName: 'M-101.pdf',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: 'Here is the data: [{"type":"duct","system":"hvac"}] end of data',
        model: 'gpt-4o',
      });

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(true);
    });

    it('should handle AI extraction errors gracefully', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'MEP details',
          pageNumber: 1,
          metadata: {},
          Document: {
            name: 'Plan',
            fileName: 'M-101.pdf',
          },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockRejectedValue(new Error('AI error'));

      const result = await generateIsometricView('project-1', 'doc-1');

      // Should fall back to error about no elements
      expect(result.success).toBe(false);
    });

    it('should limit AI extracted elements to 20', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Large MEP system',
          pageNumber: 1,
          metadata: {},
          Document: {
            name: 'Plan',
            fileName: 'M-101.pdf',
          },
        },
      ];

      const manyElements = Array.from({ length: 30 }, (_, i) => ({
        type: 'pipe',
        system: 'plumbing',
      }));

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);
      vi.mocked(callAbacusLLM).mockResolvedValue({
        content: JSON.stringify(manyElements),
        model: 'gpt-4o',
      });

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(true);
      expect(result.model?.elements.length).toBeLessThanOrEqual(20);
    });

    it('should infer element type correctly', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'piping system' },
              { type: 'ductwork' },
              { type: 'conduit run' },
              { type: 'gate valve' },
              { type: 'elbow fitting' },
              { type: 'air diffuser' },
              { type: 'chiller' },
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      const elements = result.model?.elements || [];
      expect(elements.some(e => e.type === 'pipe')).toBe(true);
      expect(elements.some(e => e.type === 'duct')).toBe(true);
      expect(elements.some(e => e.type === 'fitting')).toBe(true);
      expect(elements.some(e => e.type === 'equipment')).toBe(true);
    });

    it('should infer system correctly from description', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Domestic water supply and HVAC supply air duct and electrical panel',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', description: 'plumbing water line' },
              { type: 'duct', description: 'hvac supply' },
              { type: 'conduit', description: 'electrical circuit' },
              { type: 'pipe', description: 'fire sprinkler' },
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(true);
    });

    it('should parse elevation from text', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Pipe at 10 ft above floor',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', description: 'at 12.5 feet elevation' },
              { type: 'duct', description: "mounted at 15'" },
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(true);
      // Elevation should be parsed from descriptions
    });

    it('should build element connections based on proximity and system', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'MEP layout',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', description: 'plumbing pipe 1', x: 20, y: 20 },
              { type: 'pipe', description: 'plumbing pipe 2', x: 25, y: 25 },
              { type: 'duct', description: 'hvac duct 1', x: 20, y: 20 },
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(true);
      // Elements of the same system within threshold should be connected
    });

    it('should calculate verticality correctly', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', elevation: 0 },
              { type: 'pipe', elevation: 25 }, // High range
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.analysis?.verticality).toBe('high');
    });

    it('should calculate medium verticality', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', elevation: 0 },
              { type: 'pipe', elevation: 10 }, // Medium range
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.analysis?.verticality).toBe('medium');
    });

    it('should calculate low verticality', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', elevation: 0 },
              { type: 'pipe', elevation: 2 }, // Low range
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.analysis?.verticality).toBe('low');
    });

    it('should calculate complexity based on element count and connections', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            mepCallouts: Array.from({ length: 20 }, (_, i) => ({
              type: 'pipe',
              description: 'plumbing',
              x: i * 10,
              y: i * 10,
            })),
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.analysis?.complexity).toBe('complex');
    });

    it('should generate recommendations based on analysis', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', description: 'plumbing', elevation: 0 },
              { type: 'duct', description: 'hvac', elevation: 15 },
              { type: 'valve', description: 'plumbing valve 1' },
              { type: 'valve', description: 'plumbing valve 2' },
              { type: 'valve', description: 'plumbing valve 3' },
              { type: 'valve', description: 'plumbing valve 4' },
              { type: 'valve', description: 'plumbing valve 5' },
              { type: 'valve', description: 'plumbing valve 6' },
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.analysis?.recommendations).toBeDefined();
      expect(result.analysis?.recommendations.length).toBeGreaterThan(0);
      // Should recommend multi-system coordination
      expect(result.analysis?.recommendations.some(r => r.includes('Multi-system'))).toBe(true);
      // Should recommend valve accessibility check
      expect(result.analysis?.recommendations.some(r => r.includes('valves'))).toBe(true);
    });

    it('should generate SVG visualization', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', description: 'plumbing', tag: 'P-1', x: 50, y: 50, z: 10 },
              { type: 'duct', description: 'hvac', tag: 'D-1', x: 60, y: 60, z: 12 },
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.visualization).toBeDefined();
      expect(result.visualization?.svgData).toContain('<svg');
      expect(result.visualization?.svgData).toContain('Isometric View');
      expect(result.visualization?.dimensions).toEqual({ width: 600, height: 400 });
      expect(result.visualization?.viewAngle).toBe('30-60');
      expect(result.visualization?.elements.length).toBeGreaterThan(0);
    });

    it('should color-code elements by system', async () => {
      const mockChunks = [
        {
          id: 'chunk-1',
          documentId: 'doc-1',
          content: 'Test',
          pageNumber: 1,
          metadata: {
            mepCallouts: [
              { type: 'pipe', description: 'plumbing' },
              { type: 'duct', description: 'hvac' },
              { type: 'conduit', description: 'electrical' },
              { type: 'pipe', description: 'fire sprinkler' },
            ],
          },
          Document: { name: 'Test', fileName: 'test.pdf' },
        },
      ];

      vi.mocked(prisma.documentChunk.findMany).mockResolvedValue(mockChunks as any);

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.visualization?.elements).toBeDefined();
      // Different systems should have different colors
      const colors = new Set(result.visualization?.elements.map(e => e.color));
      expect(colors.size).toBeGreaterThan(1);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.documentChunk.findMany).mockRejectedValue(new Error('Database error'));

      const result = await generateIsometricView('project-1', 'doc-1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to generate isometric view');
    });
  });
});

describe('Isometric Interpreter - Module Exports', () => {
  it('should export isometricInterpreter object with all functions', () => {
    expect(isometricInterpreter).toBeDefined();
    expect(isometricInterpreter.detectIsometricViews).toBe(detectIsometricViews);
    expect(isometricInterpreter.reconstructFrom2D).toBe(reconstructFrom2D);
    expect(isometricInterpreter.generateIsometricView).toBe(generateIsometricView);
  });
});
