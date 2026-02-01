import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock dependencies BEFORE importing the module
const mocks = vi.hoisted(() => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
  suggestRoomsForPhoto: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/photo-analyzer', () => ({
  suggestRoomsForPhoto: mocks.suggestRoomsForPhoto,
}));

// Mock global fetch
global.fetch = mocks.fetch as any;

// Import after mocking
import {
  getRoomSuggestionsForPhoto,
  getRoomSuggestionsFromText,
  type RoomSuggestion,
} from '@/lib/room-suggester';

describe('Room Suggester Service', () => {
  const mockProject = {
    id: 'project-1',
    slug: 'test-project',
    name: 'Test Project',
    Room: [
      {
        id: 'room-1',
        name: 'Master Bedroom',
        roomNumber: '101',
        type: 'bedroom',
        floorNumber: 1,
        tradeType: 'finish',
        notes: 'Hardwood flooring',
      },
      {
        id: 'room-2',
        name: 'Kitchen',
        roomNumber: '102',
        type: 'kitchen',
        floorNumber: 1,
        tradeType: 'finish',
        notes: 'Tile backsplash',
      },
      {
        id: 'room-3',
        name: 'Bathroom',
        roomNumber: '103',
        type: 'bathroom',
        floorNumber: 1,
        tradeType: 'plumbing',
        notes: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ABACUSAI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRoomSuggestionsForPhoto', () => {
    it('should delegate to suggestRoomsForPhoto with image URL and project slug', async () => {
      const mockSuggestions: RoomSuggestion[] = [
        {
          roomId: 'room-1',
          roomNumber: '101',
          roomName: 'Master Bedroom',
          confidence: 0.95,
          reason: 'Visible hardwood flooring matches master bedroom',
        },
      ];

      mocks.suggestRoomsForPhoto.mockResolvedValue(mockSuggestions);

      const result = await getRoomSuggestionsForPhoto(
        'https://example.com/photo.jpg',
        'test-project'
      );

      expect(result).toEqual(mockSuggestions);
      expect(mocks.suggestRoomsForPhoto).toHaveBeenCalledWith(
        'https://example.com/photo.jpg',
        'test-project',
        undefined
      );
    });

    it('should pass photo context to suggestRoomsForPhoto when provided', async () => {
      const mockSuggestions: RoomSuggestion[] = [];
      mocks.suggestRoomsForPhoto.mockResolvedValue(mockSuggestions);

      const photoContext = {
        caption: 'Tile work in progress',
        aiDescription: 'Bathroom tile installation',
        aiTags: 'tile, bathroom, ceramic',
      };

      await getRoomSuggestionsForPhoto(
        'https://example.com/photo.jpg',
        'test-project',
        photoContext
      );

      expect(mocks.suggestRoomsForPhoto).toHaveBeenCalledWith(
        'https://example.com/photo.jpg',
        'test-project',
        photoContext
      );
    });

    it('should handle empty suggestions from photo analyzer', async () => {
      mocks.suggestRoomsForPhoto.mockResolvedValue([]);

      const result = await getRoomSuggestionsForPhoto(
        'https://example.com/photo.jpg',
        'test-project'
      );

      expect(result).toEqual([]);
    });

    it('should propagate errors from suggestRoomsForPhoto', async () => {
      mocks.suggestRoomsForPhoto.mockRejectedValue(new Error('API error'));

      await expect(
        getRoomSuggestionsForPhoto('https://example.com/photo.jpg', 'test-project')
      ).rejects.toThrow('API error');
    });
  });

  describe('getRoomSuggestionsFromText', () => {
    beforeEach(() => {
      process.env.ABACUSAI_API_KEY = 'test-api-key';
    });

    describe('Configuration validation', () => {
      it('should throw error when ABACUSAI_API_KEY is not configured', async () => {
        delete process.env.ABACUSAI_API_KEY;

        await expect(
          getRoomSuggestionsFromText('test-project', { description: 'Kitchen tile' })
        ).rejects.toThrow('ABACUSAI_API_KEY not configured');
      });

      it('should throw error when ABACUSAI_API_KEY is empty string', async () => {
        process.env.ABACUSAI_API_KEY = '';

        await expect(
          getRoomSuggestionsFromText('test-project', { description: 'Kitchen tile' })
        ).rejects.toThrow('ABACUSAI_API_KEY not configured');
      });
    });

    describe('Project and room lookup', () => {
      it('should return empty array when project not found', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(null);

        const result = await getRoomSuggestionsFromText('invalid-project', {
          description: 'Kitchen tile',
        });

        expect(result).toEqual([]);
        expect(mocks.prisma.project.findUnique).toHaveBeenCalledWith({
          where: { slug: 'invalid-project' },
          include: {
            Room: {
              select: {
                id: true,
                name: true,
                roomNumber: true,
                type: true,
                floorNumber: true,
                tradeType: true,
                notes: true,
              },
            },
          },
        });
      });

      it('should return empty array when project has no rooms', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          ...mockProject,
          Room: [],
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Kitchen tile',
        });

        expect(result).toEqual([]);
      });
    });

    describe('LLM API integration', () => {
      it('should call LLM API with correct parameters for basic description', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        roomId: 'room-2',
                        confidence: 0.92,
                        reason: 'Kitchen matches description',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        });

        await getRoomSuggestionsFromText('test-project', {
          description: 'Ceramic tile installation',
        });

        expect(mocks.fetch).toHaveBeenCalledWith(
          'https://apps.abacus.ai/v1/chat/completions',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-api-key',
            },
            body: expect.stringContaining('gpt-4o-mini'),
          })
        );

        const callArgs = mocks.fetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);

        expect(body.model).toBe('gpt-4o-mini');
        expect(body.temperature).toBe(0.1);
        expect(body.max_tokens).toBe(500);
        expect(body.messages).toHaveLength(1);
        expect(body.messages[0].role).toBe('user');
        expect(body.messages[0].content).toContain('Ceramic tile installation');
      });

      it('should build context prompt with all provided fields', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              { message: { content: '{"suggestions": []}' } },
            ],
          }),
        });

        await getRoomSuggestionsFromText('test-project', {
          description: 'Tile work',
          tags: 'ceramic, bathroom',
          location: 'First floor',
          tradeType: 'plumbing',
        });

        const callArgs = mocks.fetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        const prompt = body.messages[0].content;

        expect(prompt).toContain('Description: Tile work');
        expect(prompt).toContain('Tags: ceramic, bathroom');
        expect(prompt).toContain('Location: First floor');
        expect(prompt).toContain('Trade Type: plumbing');
      });

      it('should include room list in prompt', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              { message: { content: '{"suggestions": []}' } },
            ],
          }),
        });

        await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        const callArgs = mocks.fetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        const prompt = body.messages[0].content;

        expect(prompt).toContain('Available rooms:');
        expect(prompt).toContain('ID: room-1');
        expect(prompt).toContain('Number: 101');
        expect(prompt).toContain('Name: Master Bedroom');
        expect(prompt).toContain('Type: bedroom');
        expect(prompt).toContain('Floor: 1');
        expect(prompt).toContain('Trade: finish');
      });

      it('should handle rooms with null values in prompt', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          ...mockProject,
          Room: [
            {
              id: 'room-1',
              name: 'Hallway',
              roomNumber: null,
              type: 'hallway',
              floorNumber: null,
              tradeType: null,
              notes: null,
            },
          ],
        });

        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              { message: { content: '{"suggestions": []}' } },
            ],
          }),
        });

        await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        const callArgs = mocks.fetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        const prompt = body.messages[0].content;

        expect(prompt).toContain('Number: N/A');
        expect(prompt).toContain('Floor: N/A');
        expect(prompt).toContain('Trade: N/A');
      });
    });

    describe('Response parsing', () => {
      it('should parse valid JSON response and return suggestions', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        roomId: 'room-2',
                        confidence: 0.92,
                        reason: 'Kitchen matches tile description',
                      },
                      {
                        roomId: 'room-3',
                        confidence: 0.78,
                        reason: 'Bathroom also has tile work',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Ceramic tile installation',
        });

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          roomId: 'room-2',
          roomNumber: '102',
          roomName: 'Kitchen',
          confidence: 0.92,
          reason: 'Kitchen matches tile description',
        });
        expect(result[1]).toEqual({
          roomId: 'room-3',
          roomNumber: '103',
          roomName: 'Bathroom',
          confidence: 0.78,
          reason: 'Bathroom also has tile work',
        });
      });

      it('should filter out suggestions with confidence <= 0.5', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        roomId: 'room-1',
                        confidence: 0.9,
                        reason: 'High confidence match',
                      },
                      {
                        roomId: 'room-2',
                        confidence: 0.5,
                        reason: 'Low confidence match',
                      },
                      {
                        roomId: 'room-3',
                        confidence: 0.3,
                        reason: 'Very low confidence',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toHaveLength(1);
        expect(result[0].roomId).toBe('room-1');
      });

      it('should filter out suggestions for non-existent rooms', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        roomId: 'room-2',
                        confidence: 0.92,
                        reason: 'Valid room',
                      },
                      {
                        roomId: 'room-999',
                        confidence: 0.88,
                        reason: 'Non-existent room',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toHaveLength(1);
        expect(result[0].roomId).toBe('room-2');
      });

      it('should limit results to top 3 suggestions', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      { roomId: 'room-1', confidence: 0.95, reason: 'Match 1' },
                      { roomId: 'room-2', confidence: 0.90, reason: 'Match 2' },
                      { roomId: 'room-3', confidence: 0.85, reason: 'Match 3' },
                      { roomId: 'room-1', confidence: 0.80, reason: 'Match 4' }, // Duplicate ID
                      { roomId: 'room-2', confidence: 0.75, reason: 'Match 5' }, // Duplicate ID
                    ],
                  }),
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toHaveLength(3);
        expect(result[0].confidence).toBe(0.95);
        expect(result[2].confidence).toBe(0.85);
      });

      it('should extract JSON from response with markdown code blocks', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: `Here is the analysis:
\`\`\`json
{
  "suggestions": [
    {
      "roomId": "room-2",
      "confidence": 0.92,
      "reason": "Kitchen match"
    }
  ]
}
\`\`\``,
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toHaveLength(1);
        expect(result[0].roomId).toBe('room-2');
      });

      it('should handle response with no suggestions array', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: '{"other": "data"}',
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });

      it('should handle response with empty suggestions array', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: '{"suggestions": []}',
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });
    });

    describe('Error handling', () => {
      it('should return empty array when LLM API returns non-ok response', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: false,
          statusText: 'Internal Server Error',
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });

      it('should return empty array when response has no content', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {},
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });

      it('should return empty array when response has no choices', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({}),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });

      it('should return empty array when response contains invalid JSON', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'This is not valid JSON',
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });

      it('should return empty array when JSON parsing fails', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: '{"suggestions": [invalid json]}',
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });

      it('should return empty array when fetch throws error', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockRejectedValue(new Error('Network error'));

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });

      it('should return empty array when API returns malformed response', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toEqual([]);
      });
    });

    describe('Edge cases', () => {
      it('should handle empty context object', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              { message: { content: '{"suggestions": []}' } },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {});

        expect(result).toEqual([]);
        expect(mocks.fetch).toHaveBeenCalled();
      });

      it('should handle context with only some fields', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              { message: { content: '{"suggestions": []}' } },
            ],
          }),
        });

        await getRoomSuggestionsFromText('test-project', {
          description: 'Tile work',
          tradeType: 'plumbing',
        });

        const callArgs = mocks.fetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        const prompt = body.messages[0].content;

        expect(prompt).toContain('Description: Tile work');
        expect(prompt).toContain('Trade Type: plumbing');
        expect(prompt).not.toContain('Tags:');
        expect(prompt).not.toContain('Location:');
      });

      it('should handle rooms with very long names and notes', async () => {
        const longName = 'A'.repeat(200);
        const longNotes = 'B'.repeat(500);

        mocks.prisma.project.findUnique.mockResolvedValue({
          ...mockProject,
          Room: [
            {
              id: 'room-1',
              name: longName,
              roomNumber: '101',
              type: 'bedroom',
              floorNumber: 1,
              tradeType: 'finish',
              notes: longNotes,
            },
          ],
        });

        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        roomId: 'room-1',
                        confidence: 0.9,
                        reason: 'Match',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result).toHaveLength(1);
        expect(result[0].roomName).toBe(longName);
      });

      it('should handle special characters in context', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              { message: { content: '{"suggestions": []}' } },
            ],
          }),
        });

        await getRoomSuggestionsFromText('test-project', {
          description: 'Test with "quotes" and \n newlines',
          tags: 'tag1, tag2 & tag3',
        });

        expect(mocks.fetch).toHaveBeenCalled();
      });

      it('should preserve room number null vs empty string', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue({
          ...mockProject,
          Room: [
            {
              id: 'room-1',
              name: 'Room without number',
              roomNumber: null,
              type: 'storage',
              floorNumber: 1,
              tradeType: null,
              notes: null,
            },
          ],
        });

        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        roomId: 'room-1',
                        confidence: 0.9,
                        reason: 'Match',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Test',
        });

        expect(result[0].roomNumber).toBeNull();
      });
    });

    describe('Integration scenarios', () => {
      it('should handle complete workflow with all features', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        roomId: 'room-2',
                        confidence: 0.92,
                        reason: 'Kitchen tile work matches description',
                      },
                      {
                        roomId: 'room-3',
                        confidence: 0.78,
                        reason: 'Bathroom also uses ceramic tile',
                      },
                      {
                        roomId: 'room-1',
                        confidence: 0.45,
                        reason: 'Low confidence match',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Ceramic tile installation',
          tags: 'tile, ceramic, flooring',
          location: 'First floor',
          tradeType: 'finish',
        });

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          roomId: 'room-2',
          roomName: 'Kitchen',
          roomNumber: '102',
          confidence: 0.92,
        });
        expect(result[1]).toMatchObject({
          roomId: 'room-3',
          roomName: 'Bathroom',
          roomNumber: '103',
          confidence: 0.78,
        });
      });

      it('should match trade type in suggestions', async () => {
        mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
        mocks.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    suggestions: [
                      {
                        roomId: 'room-3',
                        confidence: 0.85,
                        reason: 'Plumbing trade matches bathroom',
                      },
                    ],
                  }),
                },
              },
            ],
          }),
        });

        const result = await getRoomSuggestionsFromText('test-project', {
          description: 'Pipe installation',
          tradeType: 'plumbing',
        });

        expect(result).toHaveLength(1);
        expect(result[0].roomId).toBe('room-3');
      });
    });
  });
});
