import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractRoomsFromDocuments,
  saveExtractedRooms,
} from '@/lib/room-extractor';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  room: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  finishScheduleItem: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockAbacusLLM = vi.hoisted(() => ({
  callAbacusLLM: vi.fn(),
}));

const mockAbbreviations = vi.hoisted(() => ({
  generateAbbreviationContext: vi.fn(),
}));

const mockModelConfig = vi.hoisted(() => ({
  EXTRACTION_MODEL: 'gpt-4o-mini',
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));
vi.mock('@/lib/abacus-llm', () => mockAbacusLLM);
vi.mock('@/lib/construction-abbreviations', () => mockAbbreviations);
vi.mock('@/lib/model-config', () => mockModelConfig);

// Mock CSI divisions (not needed for extraction but imported)
vi.mock('@/lib/csi-divisions', () => ({
  getCSIDivisionByNumber: vi.fn(),
}));

describe('room-extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAbbreviations.generateAbbreviationContext.mockReturnValue('');
  });

  describe('extractRoomsFromDocuments', () => {
    it('should extract rooms from project documents', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: [
              {
                id: 'chunk-1',
                content: 'Room 101 - Office - 150 SF\nRoom 102 - Conference - 300 SF',
              },
            ],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify([
          {
            roomNumber: '101',
            roomType: 'Office',
            floor: '1st Floor',
            area: 150,
            finishItems: [],
          },
          {
            roomNumber: '102',
            roomType: 'Conference',
            floor: '1st Floor',
            area: 300,
            finishItems: [],
          },
        ]),
      });

      const result = await extractRoomsFromDocuments('test-project');

      expect(result.rooms).toHaveLength(2);
      expect(result.rooms[0].roomNumber).toBe('101');
      expect(result.rooms[0].roomType).toBe('Office');
      expect(result.rooms[0].area).toBe(150);
      expect(result.documentsProcessed).toBe(1);
      expect(result.summary).toContain('Successfully extracted');
    });

    it('should throw error if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(extractRoomsFromDocuments('nonexistent')).rejects.toThrow('Project not found');
    });

    it('should return empty result if no processed documents', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await extractRoomsFromDocuments('test-project');

      expect(result.rooms).toHaveLength(0);
      expect(result.documentsProcessed).toBe(0);
      expect(result.summary).toContain('No processed documents');
    });

    it('should skip documents with no chunks', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Empty Doc',
            processed: true,
            deletedAt: null,
            DocumentChunk: [],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await extractRoomsFromDocuments('test-project');

      expect(result.documentsProcessed).toBe(0);
    });

    it('should filter out rooms with unknown type', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: [
              { id: 'chunk-1', content: 'Room data' },
            ],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify([
          {
            roomNumber: '101',
            roomType: 'Office',
            floor: '1st Floor',
          },
          {
            roomNumber: '102',
            roomType: 'Unknown',
            floor: '1st Floor',
          },
          {
            roomNumber: '103',
            roomType: 'TBD',
            floor: '1st Floor',
          },
        ]),
      });

      const result = await extractRoomsFromDocuments('test-project');

      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0].roomNumber).toBe('101');
    });

    it('should parse JSON from markdown code blocks', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: [{ id: 'chunk-1', content: 'Room data' }],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: '```json\n[{"roomNumber":"101","roomType":"Office","floor":"1st Floor"}]\n```',
      });

      const result = await extractRoomsFromDocuments('test-project');

      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0].roomNumber).toBe('101');
    });

    it('should handle LLM response without json marker', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: [{ id: 'chunk-1', content: 'Room data' }],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: '[{"roomNumber":"101","roomType":"Office","floor":"1st Floor"}]',
      });

      const result = await extractRoomsFromDocuments('test-project');

      expect(result.rooms).toHaveLength(1);
    });

    it('should return empty array if JSON parsing fails', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: [{ id: 'chunk-1', content: 'Room data' }],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: 'This is not JSON',
      });

      const result = await extractRoomsFromDocuments('test-project');

      expect(result.rooms).toHaveLength(0);
    });

    it('should throw error on LLM failure', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: [{ id: 'chunk-1', content: 'Room data' }],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockRejectedValue(new Error('LLM API error'));

      await expect(extractRoomsFromDocuments('test-project')).rejects.toThrow('Failed to extract rooms');
    });

    it('should include finish items in extracted rooms', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: [{ id: 'chunk-1', content: 'Room data with finishes' }],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: JSON.stringify([
          {
            roomNumber: '101',
            roomType: 'Office',
            floor: '1st Floor',
            finishItems: [
              {
                category: 'flooring',
                material: 'Carpet Tile',
                manufacturer: 'Mohawk',
                color: 'Gray',
              },
            ],
          },
        ]),
      });

      const result = await extractRoomsFromDocuments('test-project');

      expect(result.rooms[0].finishItems).toBeDefined();
      expect(result.rooms[0].finishItems?.length).toBe(1);
      expect(result.rooms[0].finishItems?.[0].material).toBe('Carpet Tile');
    });

    it('should use EXTRACTION_MODEL from config', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: [{ id: 'chunk-1', content: 'Room data' }],
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: '[]',
      });

      await extractRoomsFromDocuments('test-project');

      expect(mockAbacusLLM.callAbacusLLM).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 16000,
        })
      );
    });

    it('should limit chunks to MAX_CHUNKS', async () => {
      const chunks = Array.from({ length: 200 }, (_, i) => ({
        id: `chunk-${i}`,
        content: `Chunk ${i} content`,
      }));

      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        slug: 'test-project',
        Document: [
          {
            id: 'doc-1',
            name: 'Floor Plan',
            processed: true,
            deletedAt: null,
            DocumentChunk: chunks,
          },
        ],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      mockAbacusLLM.callAbacusLLM.mockResolvedValue({
        content: '[]',
      });

      await extractRoomsFromDocuments('test-project');

      // Should only use first 150 chunks (default MAX_CHUNKS)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          used: 150,
          total: 200,
          max: 150,
        })
      );
    });
  });

  describe('saveExtractedRooms', () => {
    it('should save new rooms to database', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          area: 150,
          notes: 'Corner office',
          finishItems: [],
        },
      ];

      const result = await saveExtractedRooms('test-project', extractedRooms);

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(mockPrisma.room.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            roomNumber: '101',
            type: 'Office',
            area: 150,
            notes: 'Corner office',
          }),
        })
      );
    });

    it('should update existing rooms', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      const existingRoom = {
        id: 'room-1',
        roomNumber: '101',
        type: 'Office',
        area: 150,
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(existingRoom);
      mockPrisma.room.update.mockResolvedValue(existingRoom);

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Conference',
          floor: '1st Floor',
          area: 200,
          finishItems: [],
        },
      ];

      const result = await saveExtractedRooms('test-project', extractedRooms);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: expect.objectContaining({
            type: 'Conference',
            area: 200,
          }),
        })
      );
    });

    it('should save finish items for rooms', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });
      mockPrisma.finishScheduleItem.findFirst.mockResolvedValue(null);
      mockPrisma.finishScheduleItem.create.mockResolvedValue({});

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          finishItems: [
            {
              category: 'flooring' as const,
              material: 'Carpet',
              manufacturer: 'Mohawk',
              color: 'Gray',
            },
          ],
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.finishScheduleItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roomId: 'room-1',
            category: 'flooring',
            material: 'Carpet',
            manufacturer: 'Mohawk',
            color: 'Gray',
          }),
        })
      );
    });

    it('should update existing finish items', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      const existingRoom = {
        id: 'room-1',
        roomNumber: '101',
      };

      const existingFinish = {
        id: 'finish-1',
        roomId: 'room-1',
        category: 'flooring',
        material: 'Carpet',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(existingRoom);
      mockPrisma.room.update.mockResolvedValue(existingRoom);
      mockPrisma.finishScheduleItem.findFirst.mockResolvedValue(existingFinish);
      mockPrisma.finishScheduleItem.update.mockResolvedValue({});

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          finishItems: [
            {
              category: 'flooring' as const,
              material: 'Carpet',
              color: 'Blue',
            },
          ],
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.finishScheduleItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'finish-1' },
          data: expect.objectContaining({
            color: 'Blue',
          }),
        })
      );
    });

    it('should parse CSI division from finish code', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });
      mockPrisma.finishScheduleItem.findFirst.mockResolvedValue(null);
      mockPrisma.finishScheduleItem.create.mockResolvedValue({});

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          finishItems: [
            {
              category: 'flooring' as const,
              material: 'Carpet',
              csiCode: '09 68 00 Carpeting',
            },
          ],
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.finishScheduleItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            csiCode: '09 68 00 Carpeting',
            csiDivision: 9,
          }),
        })
      );
    });

    it('should throw error if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        saveExtractedRooms('nonexistent', [])
      ).rejects.toThrow('Project not found');
    });

    it('should use sourceDocumentId for deduplication', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          finishItems: [],
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms, 'doc-1');

      expect(mockPrisma.room.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            roomNumber: '101',
            sourceDocumentId: 'doc-1',
          }),
        })
      );

      expect(mockPrisma.room.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceDocumentId: 'doc-1',
          }),
        })
      );
    });

    it('should handle rooms without room type', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: '',
          floor: '1st Floor',
          finishItems: [],
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.room.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'Unknown',
          }),
        })
      );
    });

    it('should parse floor number from floor string', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '2nd Floor',
          finishItems: [],
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.room.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            floorNumber: 2,
          }),
        })
      );
    });

    it('should handle multiple rooms and finishes', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });
      mockPrisma.finishScheduleItem.findFirst.mockResolvedValue(null);
      mockPrisma.finishScheduleItem.create.mockResolvedValue({});

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          finishItems: [
            { category: 'flooring' as const, material: 'Carpet' },
            { category: 'walls' as const, material: 'Paint' },
          ],
        },
        {
          roomNumber: '102',
          roomType: 'Conference',
          floor: '1st Floor',
          finishItems: [
            { category: 'flooring' as const, material: 'Hardwood' },
          ],
        },
      ];

      const result = await saveExtractedRooms('test-project', extractedRooms);

      expect(result.created).toBe(2);
      expect(mockPrisma.finishScheduleItem.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty extracted rooms array', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await saveExtractedRooms('test-project', []);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });

    it('should handle rooms without finish items', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.finishScheduleItem.create).not.toHaveBeenCalled();
    });

    it('should handle finish items with minimal data', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });
      mockPrisma.finishScheduleItem.findFirst.mockResolvedValue(null);
      mockPrisma.finishScheduleItem.create.mockResolvedValue({});

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          finishItems: [
            {
              category: 'flooring' as const,
              material: 'Carpet',
            },
          ],
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.finishScheduleItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            material: 'Carpet',
            manufacturer: undefined,
            color: undefined,
          }),
        })
      );
    });

    it('should handle invalid CSI code gracefully', async () => {
      const mockProject = {
        id: 'project-1',
        slug: 'test-project',
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.room.findFirst.mockResolvedValue(null);
      mockPrisma.room.create.mockResolvedValue({
        id: 'room-1',
        roomNumber: '101',
      });
      mockPrisma.finishScheduleItem.findFirst.mockResolvedValue(null);
      mockPrisma.finishScheduleItem.create.mockResolvedValue({});

      const extractedRooms = [
        {
          roomNumber: '101',
          roomType: 'Office',
          floor: '1st Floor',
          finishItems: [
            {
              category: 'flooring' as const,
              material: 'Carpet',
              csiCode: 'Invalid Code',
            },
          ],
        },
      ];

      await saveExtractedRooms('test-project', extractedRooms);

      expect(mockPrisma.finishScheduleItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            csiCode: 'Invalid Code',
            csiDivision: undefined,
          }),
        })
      );
    });
  });
});
