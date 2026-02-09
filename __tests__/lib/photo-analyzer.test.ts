import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks before imports
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  roomPhoto: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockAnalyzeWithMultiProvider = vi.hoisted(() => vi.fn());

// Mock all dependencies
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));
vi.mock('@/lib/vision-api-multi-provider', () => ({
  analyzeWithMultiProvider: mockAnalyzeWithMultiProvider,
}));

// Import after mocks
import {
  analyzePhoto,
  suggestRoomsForPhoto,
  processUploadedPhoto,
  batchProcessPhotos,
  generatePhotoFileName,
  getFileExtension,
  isValidImageType,
  createPhotoMetadata,
  validatePhotoCount,
  generateAIPhotoDescription,
  formatAutoCaption,
  formatClarificationQuestions,
} from '@/lib/photo-analyzer';

describe('photo-analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetch for image URL conversion
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('mock-image-data').buffer),
    } as any);
  });

  describe('analyzePhoto', () => {
    it('should analyze a photo and return structured results', async () => {
      const mockAnalysis = {
        description: 'Concrete foundation with rebar installation',
        tags: ['concrete', 'foundation', 'rebar', 'formwork'],
        ocrText: 'Section A-A',
        confidence: 0.92,
      };

      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify(mockAnalysis),
      });

      const result = await analyzePhoto(
        'https://example.com/photo.jpg',
        'project-slug',
        {
          roomNumber: '101',
          tradeType: 'concrete',
        }
      );

      expect(result.description).toBe(mockAnalysis.description);
      expect(result.tags).toEqual(mockAnalysis.tags);
      expect(result.ocrText).toBe(mockAnalysis.ocrText);
      expect(result.confidence).toBe(mockAnalysis.confidence);
    });

    it('should handle base64 image data', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({ description: 'Test', tags: [], confidence: 0.8 }),
      });

      await analyzePhoto('base64encodeddata', 'project-slug');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockAnalyzeWithMultiProvider).toHaveBeenCalledWith('base64encodeddata', expect.any(String));
    });

    it('should handle data URI format', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({ description: 'Test', tags: [], confidence: 0.8 }),
      });

      await analyzePhoto('data:image/jpeg;base64,actualbase64data', 'project-slug');

      expect(mockAnalyzeWithMultiProvider).toHaveBeenCalledWith('actualbase64data', expect.any(String));
    });

    it('should include context in prompt', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({ description: 'Test', tags: [], confidence: 0.8 }),
      });

      await analyzePhoto('imagedata', 'project-slug', {
        roomNumber: '201',
        tradeType: 'electrical',
        finishType: 'paint',
      });

      const prompt = mockAnalyzeWithMultiProvider.mock.calls[0][1];
      expect(prompt).toContain('Room: 201');
      expect(prompt).toContain('Trade: electrical');
      expect(prompt).toContain('Finish Type: paint');
    });

    it('should handle vision API failure', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const result = await analyzePhoto('imagedata', 'project-slug');

      expect(result.description).toBe('Construction progress photo');
      expect(result.tags).toEqual(['construction']);
      expect(result.confidence).toBe(0.3);
    });

    it('should handle malformed JSON response', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: 'Not a JSON response',
      });

      const result = await analyzePhoto('imagedata', 'project-slug');

      expect(result.confidence).toBe(0.5);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PHOTO_ANALYZER',
        'Could not extract JSON from response',
        expect.any(Object)
      );
    });

    it('should handle fetch error for HTTP URLs', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as any);

      // The function catches the error and returns fallback
      const result = await analyzePhoto('https://example.com/missing.jpg', 'project-slug');

      expect(result.confidence).toBe(0.3);
      expect(result.description).toBe('Construction progress photo');
    });

    it('should parse JSON response correctly', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: '{"description": "Test photo", "tags": ["test"], "confidence": 0.95}',
      });

      const result = await analyzePhoto('imagedata', 'project-slug');

      expect(result.description).toBe('Test photo');
      expect(result.tags).toEqual(['test']);
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('suggestRoomsForPhoto', () => {
    const mockProject = {
      id: 'project-123',
      slug: 'test-project',
      Room: [
        {
          id: 'room-1',
          name: 'Kitchen',
          roomNumber: '101',
          type: 'kitchen',
          floorNumber: 1,
          notes: null,
        },
        {
          id: 'room-2',
          name: 'Bathroom',
          roomNumber: '102',
          type: 'bathroom',
          floorNumber: 1,
          notes: null,
        },
      ],
    };

    beforeEach(() => {
      mockPrisma.project.findUnique.mockResolvedValue(mockProject as any);
    });

    it('should suggest rooms based on photo analysis', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          suggestions: [
            {
              roomId: 'room-1',
              confidence: 0.85,
              reason: 'Cabinet and countertop visible',
            },
          ],
        }),
      });

      const result = await suggestRoomsForPhoto('imagedata', 'test-project', {
        aiDescription: 'Kitchen countertop installation',
        aiTags: 'cabinets, countertop',
      });

      expect(result).toHaveLength(1);
      expect(result[0].roomId).toBe('room-1');
      expect(result[0].confidence).toBe(0.85);
      expect(result[0].roomName).toBe('Kitchen');
    });

    it('should filter out suggestions below confidence threshold', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          suggestions: [
            { roomId: 'room-1', confidence: 0.5, reason: 'Low match' },
            { roomId: 'room-2', confidence: 0.8, reason: 'Good match' },
          ],
        }),
      });

      const result = await suggestRoomsForPhoto('imagedata', 'test-project');

      expect(result).toHaveLength(1);
      expect(result[0].roomId).toBe('room-2');
    });

    it('should return empty array if no rooms in project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        Room: [],
      } as any);

      const result = await suggestRoomsForPhoto('imagedata', 'test-project');

      expect(result).toEqual([]);
    });

    it('should return empty array if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await suggestRoomsForPhoto('imagedata', 'test-project');

      expect(result).toEqual([]);
    });

    it('should limit to top 3 suggestions', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          suggestions: [
            { roomId: 'room-1', confidence: 0.9, reason: 'Match 1' },
            { roomId: 'room-2', confidence: 0.85, reason: 'Match 2' },
            { roomId: 'room-3', confidence: 0.8, reason: 'Match 3' },
            { roomId: 'room-4', confidence: 0.75, reason: 'Match 4' },
          ],
        }),
      });

      // Add more rooms to project
      mockPrisma.project.findUnique.mockResolvedValue({
        ...mockProject,
        Room: [...mockProject.Room, { id: 'room-3' }, { id: 'room-4' }],
      } as any);

      const result = await suggestRoomsForPhoto('imagedata', 'test-project');

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle vision API error gracefully', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const result = await suggestRoomsForPhoto('imagedata', 'test-project');

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('processUploadedPhoto', () => {
    const mockPhoto = {
      id: 'photo-123',
      cloud_storage_path: 'photos/photo-123.jpg',
      caption: null,
      tradeType: 'concrete',
      Room: {
        roomNumber: '101',
      },
    };

    beforeEach(() => {
      mockPrisma.roomPhoto.findUnique.mockResolvedValue(mockPhoto as any);
      mockPrisma.roomPhoto.update.mockResolvedValue({} as any);
    });

    it('should process and update photo with AI analysis', async () => {
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          description: 'Foundation work in progress',
          tags: ['foundation', 'concrete'],
          ocrText: 'Level 1',
          confidence: 0.9,
        }),
      });

      await processUploadedPhoto('photo-123', 'test-project');

      expect(mockPrisma.roomPhoto.update).toHaveBeenCalledWith({
        where: { id: 'photo-123' },
        data: {
          aiDescription: 'Foundation work in progress',
          aiTags: 'foundation, concrete',
          ocrText: 'Level 1',
          caption: 'Foundation work in progress',
          aiGenerated: true,
        },
      });
    });

    it('should preserve user caption if present', async () => {
      mockPrisma.roomPhoto.findUnique.mockResolvedValue({
        ...mockPhoto,
        caption: 'User provided caption',
      } as any);

      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({
          description: 'AI description',
          tags: ['tag'],
          confidence: 0.9,
        }),
      });

      await processUploadedPhoto('photo-123', 'test-project');

      const updateCall = mockPrisma.roomPhoto.update.mock.calls[0][0];
      expect(updateCall.data.caption).toBe('User provided caption');
      expect(updateCall.data.aiGenerated).toBe(false);
    });

    it('should throw error if photo not found', async () => {
      mockPrisma.roomPhoto.findUnique.mockResolvedValue(null);

      await expect(processUploadedPhoto('photo-123', 'test-project')).rejects.toThrow(
        'Photo not found'
      );
    });
  });

  describe('batchProcessPhotos', () => {
    beforeEach(() => {
      mockPrisma.roomPhoto.findUnique.mockResolvedValue({
        id: 'photo-123',
        cloud_storage_path: 'photos/photo.jpg',
        Room: { roomNumber: '101' },
      } as any);
      mockPrisma.roomPhoto.update.mockResolvedValue({} as any);
      mockAnalyzeWithMultiProvider.mockResolvedValue({
        success: true,
        content: JSON.stringify({ description: 'Test', tags: [], confidence: 0.8 }),
      });
    });

    it('should process multiple photos', async () => {
      const result = await batchProcessPhotos(['photo-1', 'photo-2', 'photo-3'], 'test-project');

      expect(result.processed).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should handle individual photo failures', async () => {
      mockPrisma.roomPhoto.findUnique
        .mockResolvedValueOnce({ id: 'photo-1', cloud_storage_path: 'p1.jpg', Room: {} } as any)
        .mockRejectedValueOnce(new Error('Photo 2 not found'))
        .mockResolvedValueOnce({ id: 'photo-3', cloud_storage_path: 'p3.jpg', Room: {} } as any);

      const result = await batchProcessPhotos(['photo-1', 'photo-2', 'photo-3'], 'test-project');

      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
    });
  });

  describe('utility functions', () => {
    describe('generatePhotoFileName', () => {
      it('should generate filename with timestamp and random string', () => {
        const fileName = generatePhotoFileName('original-photo.jpg');

        expect(fileName).toMatch(/^photo-\d+-[a-z0-9]{6}\.jpg$/);
      });

      it('should preserve file extension', () => {
        const fileName = generatePhotoFileName('photo.png');

        expect(fileName).toContain('.png');
      });

      it('should support legacy format with date and sequence', () => {
        const fileName = generatePhotoFileName('2024-01-15', 1, '.jpg');

        expect(fileName).toBe('photo-2024-01-15-1.jpg');
      });
    });

    describe('getFileExtension', () => {
      it('should extract file extension', () => {
        expect(getFileExtension('photo.jpg')).toBe('.jpg');
        expect(getFileExtension('document.pdf')).toBe('.pdf');
        expect(getFileExtension('image.test.png')).toBe('.png');
      });

      it('should return empty string for no extension', () => {
        expect(getFileExtension('noextension')).toBe('');
      });
    });

    describe('isValidImageType', () => {
      it('should validate common image types', () => {
        expect(isValidImageType('image/jpeg')).toBe(true);
        expect(isValidImageType('image/jpg')).toBe(true);
        expect(isValidImageType('image/png')).toBe(true);
        expect(isValidImageType('image/gif')).toBe(true);
        expect(isValidImageType('image/webp')).toBe(true);
        expect(isValidImageType('image/heic')).toBe(true);
      });

      it('should reject invalid types', () => {
        expect(isValidImageType('application/pdf')).toBe(false);
        expect(isValidImageType('text/plain')).toBe(false);
        expect(isValidImageType('video/mp4')).toBe(false);
      });

      it('should be case insensitive', () => {
        expect(isValidImageType('IMAGE/JPEG')).toBe(true);
        expect(isValidImageType('Image/Png')).toBe(true);
      });
    });

    describe('createPhotoMetadata', () => {
      it('should create metadata with new signature', () => {
        const metadata = createPhotoMetadata('photo-123', 'original.jpg', 1024000, 'image/jpeg', {
          caption: 'Test photo',
          location: 'Room 101',
        });

        expect(metadata.id).toBe('photo-123');
        expect(metadata.fileName).toBe('original.jpg');
        expect(metadata.fileSize).toBe(1024000);
        expect(metadata.mimeType).toBe('image/jpeg');
        expect(metadata.caption).toBe('Test photo');
        expect(metadata.location).toBe('Room 101');
      });

      it('should support legacy signature', () => {
        const metadata = createPhotoMetadata(
          'photo-123',
          'original.jpg',
          'generated-name.jpg',
          'cloud/path/photo.jpg',
          { description: 'AI description' },
          'user-123',
          { width: 1920, height: 1080, fileSize: 500000 }
        );

        expect(metadata.id).toBe('photo-123');
        expect(metadata.fileSize).toBe(500000);
        expect(metadata.width).toBe(1920);
        expect(metadata.height).toBe(1080);
        expect(metadata.cloud_storage_path).toBe('cloud/path/photo.jpg');
      });
    });

    describe('validatePhotoCount', () => {
      it('should pass validation when under limit', () => {
        const result = validatePhotoCount(50, 30, 100);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should fail validation when exceeding limit', () => {
        const result = validatePhotoCount(90, 20, 100);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Photo limit exceeded. Maximum 100 photos allowed.');
      });

      it('should use default limit of 100', () => {
        const result = validatePhotoCount(90, 15);

        expect(result.valid).toBe(false);
      });
    });

    describe('generateAIPhotoDescription', () => {
      it('should generate description from analyzePhoto', async () => {
        mockAnalyzeWithMultiProvider.mockResolvedValue({
          success: true,
          content: JSON.stringify({
            description: 'Drywall installation in progress',
            tags: [],
            confidence: 0.9,
          }),
        });

        const description = await generateAIPhotoDescription('imagedata');

        expect(description).toBe('Drywall installation in progress');
      });

      it('should return fallback on error', async () => {
        mockAnalyzeWithMultiProvider.mockRejectedValue(new Error('API error'));

        const description = await generateAIPhotoDescription('imagedata');

        expect(description).toBe('Construction progress photo');
      });
    });

    describe('formatAutoCaption', () => {
      it('should format caption with emoji', () => {
        const caption = formatAutoCaption('Foundation work');

        expect(caption).toBe('📸 Foundation work');
      });
    });

    describe('formatClarificationQuestions', () => {
      it('should return empty array for zero photos', () => {
        const questions = formatClarificationQuestions(0);

        expect(questions).toEqual([]);
      });

      it('should return basic questions for few photos', () => {
        const questions = formatClarificationQuestions(2);

        expect(questions).toHaveLength(2);
        expect(questions[0]).toContain('captions');
        expect(questions[1]).toContain('room or area');
      });

      it('should include organization question for many photos', () => {
        const questions = formatClarificationQuestions(5);

        expect(questions).toHaveLength(3);
        expect(questions[2]).toContain('organize');
      });
    });
  });
});
