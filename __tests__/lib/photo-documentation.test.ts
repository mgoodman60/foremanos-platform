import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock prisma with vi.hoisted
const mockPrisma = vi.hoisted(() => ({
  roomPhoto: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock S3 functions with vi.hoisted
const { mockGeneratePresignedUploadUrl, mockGetFileUrl } = vi.hoisted(() => ({
  mockGeneratePresignedUploadUrl: vi.fn(),
  mockGetFileUrl: vi.fn(),
}));

vi.mock('@/lib/s3', () => ({
  generatePresignedUploadUrl: mockGeneratePresignedUploadUrl,
  getFileUrl: mockGetFileUrl,
}));

// Mock Abacus LLM with vi.hoisted
const mockCallAbacusLLM = vi.hoisted(() => vi.fn());

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: mockCallAbacusLLM,
}));

// Import functions after mocks
import {
  initializePhotoUpload,
  finalizePhotoUpload,
  analyzeConstructionPhoto,
  getRoomPhotos,
  getProjectPhotos,
  getPhotosNearLocation,
  getRoomPhotoTimeline,
  deletePhoto,
  type PhotoUploadRequest,
  type PhotoMetadata,
  type PhotoAnalysisResult,
} from '@/lib/photo-documentation';

// ============================================
// Test Helpers
// ============================================

function createMockPhotoMetadata(overrides: Partial<PhotoMetadata> = {}): PhotoMetadata {
  return {
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    accuracy: 5,
    heading: 90,
    capturedAt: new Date('2024-01-15T10:30:00Z'),
    deviceModel: 'iPhone 15 Pro',
    width: 4032,
    height: 3024,
    fileSize: 2048000, // 2MB
    mimeType: 'image/jpeg',
    ...overrides,
  };
}

function createMockPhotoUploadRequest(overrides: Partial<PhotoUploadRequest> = {}): PhotoUploadRequest {
  return {
    projectId: 'project-1',
    roomId: 'room-1',
    fileName: 'photo.jpg',
    contentType: 'image/jpeg',
    metadata: createMockPhotoMetadata(),
    caption: 'Test photo',
    tradeType: 'electrical',
    location: 'Second floor, east wing',
    uploadedById: 'user-1',
    ...overrides,
  };
}

function createMockRoomPhoto(overrides = {}) {
  return {
    id: 'photo-1',
    projectId: 'project-1',
    roomId: 'room-1',
    cloud_storage_path: 'room-photos/project-1/room-1/1705318200000-photo.jpg',
    caption: 'Test photo',
    tradeType: 'electrical',
    location: 'Second floor, east wing',
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 10,
    accuracy: 5,
    heading: 90,
    deviceModel: 'iPhone 15 Pro',
    width: 4032,
    height: 3024,
    fileSize: 2048000,
    mimeType: 'image/jpeg',
    capturedAt: new Date('2024-01-15T10:30:00Z'),
    uploadedById: 'user-1',
    source: 'field',
    aiGenerated: false,
    aiDescription: null,
    aiTags: null,
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
    Room: {
      name: 'Room 101',
      roomNumber: '101',
    },
    User: {
      username: 'testuser',
    },
    ...overrides,
  };
}

// ============================================
// Photo Upload Tests (8 tests)
// ============================================

describe('Photo Documentation - Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize photo upload with presigned URL', async () => {
    const request = createMockPhotoUploadRequest();
    const mockPhoto = createMockRoomPhoto();

    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload?signature=xxx',
      cloud_storage_path: 'room-photos/project-1/room-1/1705318200000-photo.jpg',
    });

    mockPrisma.roomPhoto.create.mockResolvedValue(mockPhoto);

    const result = await initializePhotoUpload(request);

    expect(result).toEqual({
      uploadUrl: 'https://s3.example.com/upload?signature=xxx',
      cloud_storage_path: 'room-photos/project-1/room-1/1705318200000-photo.jpg',
      photoId: 'photo-1',
    });

    expect(mockGeneratePresignedUploadUrl).toHaveBeenCalledWith(
      expect.stringContaining('room-photos/project-1/room-1/'),
      'image/jpeg',
      true
    );

    expect(mockPrisma.roomPhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        roomId: 'room-1',
        caption: 'Test photo',
        tradeType: 'electrical',
        location: 'Second floor, east wing',
        latitude: 37.7749,
        longitude: -122.4194,
        deviceModel: 'iPhone 15 Pro',
        source: 'field',
      }),
    });
  });

  it('should handle photo upload without optional metadata', async () => {
    const request = createMockPhotoUploadRequest({
      metadata: {
        fileSize: 1024000,
        mimeType: 'image/jpeg',
      },
      caption: undefined,
      tradeType: undefined,
      location: undefined,
    });

    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      cloud_storage_path: 'room-photos/project-1/room-1/photo.jpg',
    });

    mockPrisma.roomPhoto.create.mockResolvedValue(createMockRoomPhoto());

    const result = await initializePhotoUpload(request);

    expect(result.photoId).toBeTruthy();
    expect(mockPrisma.roomPhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caption: undefined,
        tradeType: undefined,
        location: undefined,
        latitude: undefined,
        longitude: undefined,
      }),
    });
  });

  it('should use current timestamp if capturedAt is not provided', async () => {
    const request = createMockPhotoUploadRequest({
      metadata: {
        ...createMockPhotoMetadata(),
        capturedAt: undefined,
      },
    });

    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      cloud_storage_path: 'room-photos/project-1/room-1/photo.jpg',
    });

    const beforeTime = new Date();
    mockPrisma.roomPhoto.create.mockResolvedValue(createMockRoomPhoto());

    await initializePhotoUpload(request);
    const afterTime = new Date();

    const createCall = mockPrisma.roomPhoto.create.mock.calls[0][0];
    const capturedAt = createCall.data.capturedAt;

    expect(capturedAt).toBeInstanceOf(Date);
    expect(capturedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(capturedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('should finalize photo upload without AI analysis', async () => {
    const mockPhoto = createMockRoomPhoto();
    mockPrisma.roomPhoto.findUnique.mockResolvedValue(mockPhoto);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const result = await finalizePhotoUpload('photo-1', { analyzeWithAI: false });

    expect(result).toEqual({
      success: true,
      photoUrl: 'https://s3.example.com/photo.jpg',
      analysis: undefined,
    });

    expect(mockPrisma.roomPhoto.findUnique).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
      include: { Room: true, Project: true },
    });

    expect(mockCallAbacusLLM).not.toHaveBeenCalled();
    expect(mockPrisma.roomPhoto.update).not.toHaveBeenCalled();
  });

  it('should finalize photo upload with AI analysis', async () => {
    const mockPhoto = createMockRoomPhoto();
    mockPrisma.roomPhoto.findUnique.mockResolvedValue(mockPhoto);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const mockAnalysis: PhotoAnalysisResult = {
      description: 'Electrical panel installation in progress',
      tags: ['electrical', 'panel', 'rough-in'],
      detectedItems: ['electrical panel', 'conduit', 'wire'],
      constructionPhase: 'Rough-in',
      progressIndicators: ['Panel mounted', 'Conduit installed'],
      qualityNotes: ['Proper spacing observed'],
      safetyObservations: ['No immediate safety concerns'],
    };

    mockCallAbacusLLM.mockResolvedValue({
      content: JSON.stringify(mockAnalysis),
    });

    mockPrisma.roomPhoto.update.mockResolvedValue(mockPhoto);

    const result = await finalizePhotoUpload('photo-1', { analyzeWithAI: true });

    expect(result.success).toBe(true);
    expect(result.analysis).toEqual(mockAnalysis);

    expect(mockCallAbacusLLM).toHaveBeenCalled();
    expect(mockPrisma.roomPhoto.update).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
      data: {
        aiGenerated: false,
        aiDescription: 'Electrical panel installation in progress',
        aiTags: 'electrical, panel, rough-in',
      },
    });
  });

  it('should handle AI analysis failure gracefully during finalization', async () => {
    const mockPhoto = createMockRoomPhoto();
    mockPrisma.roomPhoto.findUnique.mockResolvedValue(mockPhoto);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    mockCallAbacusLLM.mockRejectedValue(new Error('AI service timeout'));
    mockPrisma.roomPhoto.update.mockResolvedValue(mockPhoto);

    const result = await finalizePhotoUpload('photo-1', { analyzeWithAI: true });

    // Should still return success with fallback analysis
    expect(result.success).toBe(true);
    expect(result.analysis).toEqual({
      description: 'Photo uploaded successfully',
      tags: ['construction', 'site-photo'],
      detectedItems: [],
    });

    // Photo should be updated with fallback analysis
    expect(mockPrisma.roomPhoto.update).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
      data: {
        aiGenerated: false,
        aiDescription: 'Photo uploaded successfully',
        aiTags: 'construction, site-photo',
      },
    });
  });

  it('should throw error if photo not found during finalization', async () => {
    mockPrisma.roomPhoto.findUnique.mockResolvedValue(null);

    await expect(finalizePhotoUpload('nonexistent-photo')).rejects.toThrow('Photo not found');
  });

  it('should use "Unknown" room name if room data is missing', async () => {
    const mockPhoto = createMockRoomPhoto({ Room: null });
    mockPrisma.roomPhoto.findUnique.mockResolvedValue(mockPhoto);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    mockCallAbacusLLM.mockResolvedValue({
      content: JSON.stringify({
        description: 'Construction site photo',
        tags: ['construction'],
        detectedItems: [],
      }),
    });

    mockPrisma.roomPhoto.update.mockResolvedValue(mockPhoto);

    await finalizePhotoUpload('photo-1', { analyzeWithAI: true });

    // Should have called AI with "Unknown" room name
    const aiCall = mockCallAbacusLLM.mock.calls[0][0];
    expect(aiCall[0].content).toContain('room "Unknown"');
  });
});

// ============================================
// AI Analysis Tests (5 tests)
// ============================================

describe('Photo Documentation - AI Analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should analyze construction photo with complete results', async () => {
    const mockAnalysis = {
      description: 'Framing work in progress with electrical rough-in',
      tags: ['framing', 'electrical', 'rough-in', 'studs', 'conduit'],
      detectedItems: ['wood studs', 'electrical conduit', 'junction box'],
      constructionPhase: 'Rough-in',
      progressIndicators: ['Framing 80% complete', 'Electrical conduit installed'],
      qualityNotes: ['Proper stud spacing', 'Clean installation'],
      safetyObservations: ['Work area clean', 'No tripping hazards'],
    };

    mockCallAbacusLLM.mockResolvedValue({
      content: JSON.stringify(mockAnalysis),
    });

    const result = await analyzeConstructionPhoto(
      'https://s3.example.com/photo.jpg',
      'Room 101'
    );

    expect(result).toEqual(mockAnalysis);

    expect(mockCallAbacusLLM).toHaveBeenCalledWith(
      [
        {
          role: 'user',
          content: expect.stringContaining('room "Room 101"'),
        },
      ],
      { temperature: 0.3, max_tokens: 1000 }
    );
  });

  it('should handle AI response with JSON embedded in text', async () => {
    const mockAnalysis = {
      description: 'HVAC installation',
      tags: ['hvac', 'mechanical'],
      detectedItems: ['ductwork'],
    };

    mockCallAbacusLLM.mockResolvedValue({
      content: `Here is the analysis:\n\n${JSON.stringify(mockAnalysis)}\n\nEnd of analysis.`,
    });

    const result = await analyzeConstructionPhoto(
      'https://s3.example.com/photo.jpg',
      'Mechanical Room'
    );

    expect(result).toEqual(mockAnalysis);
  });

  it('should return fallback analysis if JSON parsing fails', async () => {
    mockCallAbacusLLM.mockResolvedValue({
      content: 'This is not valid JSON response',
    });

    const result = await analyzeConstructionPhoto(
      'https://s3.example.com/photo.jpg',
      'Room 101'
    );

    expect(result).toEqual({
      description: 'Photo uploaded successfully',
      tags: ['construction', 'site-photo'],
      detectedItems: [],
    });
  });

  it('should return fallback analysis if AI service fails', async () => {
    mockCallAbacusLLM.mockRejectedValue(new Error('AI service unavailable'));

    const result = await analyzeConstructionPhoto(
      'https://s3.example.com/photo.jpg',
      'Room 101'
    );

    expect(result).toEqual({
      description: 'Photo uploaded successfully',
      tags: ['construction', 'site-photo'],
      detectedItems: [],
    });
  });

  it('should include all required fields in analysis prompt', async () => {
    mockCallAbacusLLM.mockResolvedValue({
      content: JSON.stringify({
        description: 'Test',
        tags: [],
        detectedItems: [],
      }),
    });

    await analyzeConstructionPhoto('https://example.com/photo.jpg', 'Test Room');

    const prompt = mockCallAbacusLLM.mock.calls[0][0][0].content;

    expect(prompt).toContain('description');
    expect(prompt).toContain('tags');
    expect(prompt).toContain('detectedItems');
    expect(prompt).toContain('constructionPhase');
    expect(prompt).toContain('progressIndicators');
    expect(prompt).toContain('qualityNotes');
    expect(prompt).toContain('safetyObservations');
  });
});

// ============================================
// Photo Retrieval Tests (12 tests)
// ============================================

describe('Photo Documentation - Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get all photos for a room', async () => {
    const mockPhotos = [
      createMockRoomPhoto({ id: 'photo-1' }),
      createMockRoomPhoto({ id: 'photo-2' }),
    ];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const result = await getRoomPhotos('room-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('url');
    expect(mockPrisma.roomPhoto.findMany).toHaveBeenCalledWith({
      where: { roomId: 'room-1' },
      orderBy: { capturedAt: 'desc' },
      take: 50,
      include: {
        User: { select: { username: true } },
      },
    });
  });

  it('should filter room photos by trade type', async () => {
    const mockPhotos = [createMockRoomPhoto({ tradeType: 'electrical' })];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    await getRoomPhotos('room-1', { tradeType: 'electrical' });

    expect(mockPrisma.roomPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          roomId: 'room-1',
          tradeType: 'electrical',
        },
      })
    );
  });

  it('should filter room photos by date range', async () => {
    const mockPhotos = [createMockRoomPhoto()];
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    await getRoomPhotos('room-1', { startDate, endDate });

    expect(mockPrisma.roomPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          roomId: 'room-1',
          capturedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      })
    );
  });

  it('should limit room photos results', async () => {
    const mockPhotos = [createMockRoomPhoto()];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    await getRoomPhotos('room-1', { limit: 10 });

    expect(mockPrisma.roomPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      })
    );
  });

  it('should get all photos for a project', async () => {
    const mockPhotos = [
      createMockRoomPhoto({ id: 'photo-1' }),
      createMockRoomPhoto({ id: 'photo-2' }),
    ];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockPrisma.roomPhoto.count.mockResolvedValue(2);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const result = await getProjectPhotos('project-1');

    expect(result.photos).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.photos[0]).toHaveProperty('url');

    expect(mockPrisma.roomPhoto.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      orderBy: { capturedAt: 'desc' },
      take: 50,
      skip: 0,
      include: {
        Room: { select: { name: true, roomNumber: true } },
        User: { select: { username: true } },
      },
    });
  });

  it('should filter project photos by multiple criteria', async () => {
    const mockPhotos = [createMockRoomPhoto()];
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockPrisma.roomPhoto.count.mockResolvedValue(1);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    await getProjectPhotos('project-1', {
      roomId: 'room-1',
      tradeType: 'electrical',
      startDate,
      endDate,
      limit: 20,
      offset: 10,
    });

    expect(mockPrisma.roomPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'project-1',
          roomId: 'room-1',
          tradeType: 'electrical',
          capturedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        take: 20,
        skip: 10,
      })
    );
  });

  it('should get photos near a GPS location', async () => {
    const mockPhotos = [
      createMockRoomPhoto({ latitude: 37.7749, longitude: -122.4194 }),
      createMockRoomPhoto({ latitude: 37.7750, longitude: -122.4195 }),
    ];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const result = await getPhotosNearLocation('project-1', 37.7749, -122.4194, 50);

    expect(result).toHaveLength(2);

    const whereClause = mockPrisma.roomPhoto.findMany.mock.calls[0][0].where;
    expect(whereClause.projectId).toBe('project-1');
    expect(whereClause.latitude).toHaveProperty('gte');
    expect(whereClause.latitude).toHaveProperty('lte');
    expect(whereClause.longitude).toHaveProperty('gte');
    expect(whereClause.longitude).toHaveProperty('lte');
  });

  it('should calculate correct GPS delta for location search', async () => {
    mockPrisma.roomPhoto.findMany.mockResolvedValue([]);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const latitude = 37.7749;
    const longitude = -122.4194;
    const radiusMeters = 100;

    await getPhotosNearLocation('project-1', latitude, longitude, radiusMeters);

    const whereClause = mockPrisma.roomPhoto.findMany.mock.calls[0][0].where;

    // Expected deltas
    const latDelta = radiusMeters / 111000;
    const lonDelta = radiusMeters / (111000 * Math.cos((latitude * Math.PI) / 180));

    expect(whereClause.latitude.gte).toBeCloseTo(latitude - latDelta, 5);
    expect(whereClause.latitude.lte).toBeCloseTo(latitude + latDelta, 5);
    expect(whereClause.longitude.gte).toBeCloseTo(longitude - lonDelta, 5);
    expect(whereClause.longitude.lte).toBeCloseTo(longitude + lonDelta, 5);
  });

  it('should use default 50 meter radius for location search', async () => {
    mockPrisma.roomPhoto.findMany.mockResolvedValue([]);

    await getPhotosNearLocation('project-1', 37.7749, -122.4194);

    // Should be called with default radius calculation
    expect(mockPrisma.roomPhoto.findMany).toHaveBeenCalled();
  });

  it('should get room photo timeline grouped by date', async () => {
    const mockPhotos = [
      createMockRoomPhoto({
        id: 'photo-1',
        capturedAt: new Date('2024-01-15T10:00:00Z'),
      }),
      createMockRoomPhoto({
        id: 'photo-2',
        capturedAt: new Date('2024-01-15T14:00:00Z'),
      }),
      createMockRoomPhoto({
        id: 'photo-3',
        capturedAt: new Date('2024-01-16T10:00:00Z'),
      }),
    ];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const result = await getRoomPhotoTimeline('room-1');

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].photos).toHaveLength(2);
    expect(result[1].date).toBe('2024-01-16');
    expect(result[1].photos).toHaveLength(1);

    expect(mockPrisma.roomPhoto.findMany).toHaveBeenCalledWith({
      where: { roomId: 'room-1' },
      orderBy: { capturedAt: 'asc' },
    });
  });

  it('should handle photos with null capturedAt in timeline', async () => {
    const mockPhotos = [
      createMockRoomPhoto({
        id: 'photo-1',
        capturedAt: null,
      }),
    ];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const result = await getRoomPhotoTimeline('room-1');

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('unknown');
  });

  it('should sort timeline entries by date', async () => {
    const mockPhotos = [
      createMockRoomPhoto({
        id: 'photo-1',
        capturedAt: new Date('2024-01-20T10:00:00Z'),
      }),
      createMockRoomPhoto({
        id: 'photo-2',
        capturedAt: new Date('2024-01-10T10:00:00Z'),
      }),
      createMockRoomPhoto({
        id: 'photo-3',
        capturedAt: new Date('2024-01-15T10:00:00Z'),
      }),
    ];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const result = await getRoomPhotoTimeline('room-1');

    expect(result[0].date).toBe('2024-01-10');
    expect(result[1].date).toBe('2024-01-15');
    expect(result[2].date).toBe('2024-01-20');
  });
});

// ============================================
// Photo Deletion Tests (2 tests)
// ============================================

describe('Photo Documentation - Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a photo successfully', async () => {
    mockPrisma.roomPhoto.delete.mockResolvedValue(createMockRoomPhoto());

    const result = await deletePhoto('photo-1');

    expect(result).toBe(true);
    expect(mockPrisma.roomPhoto.delete).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
    });
  });

  it('should return false if photo deletion fails', async () => {
    mockPrisma.roomPhoto.delete.mockRejectedValue(new Error('Photo not found'));

    const result = await deletePhoto('nonexistent-photo');

    expect(result).toBe(false);
  });
});

// ============================================
// Edge Cases and Error Handling Tests (5 tests)
// ============================================

describe('Photo Documentation - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle missing GPS coordinates gracefully', async () => {
    const request = createMockPhotoUploadRequest({
      metadata: {
        latitude: undefined,
        longitude: undefined,
        fileSize: 1024000,
        mimeType: 'image/jpeg',
      },
    });

    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      cloud_storage_path: 'room-photos/project-1/room-1/photo.jpg',
    });

    mockPrisma.roomPhoto.create.mockResolvedValue(createMockRoomPhoto());

    const result = await initializePhotoUpload(request);

    expect(result.photoId).toBeTruthy();
    expect(mockPrisma.roomPhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        latitude: undefined,
        longitude: undefined,
      }),
    });
  });

  it('should handle very large file sizes', async () => {
    const request = createMockPhotoUploadRequest({
      metadata: {
        ...createMockPhotoMetadata(),
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    });

    mockGeneratePresignedUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      cloud_storage_path: 'room-photos/project-1/room-1/large-photo.jpg',
    });

    mockPrisma.roomPhoto.create.mockResolvedValue(createMockRoomPhoto());

    const result = await initializePhotoUpload(request);

    expect(result.photoId).toBeTruthy();
  });

  it('should handle empty result sets for room photos', async () => {
    mockPrisma.roomPhoto.findMany.mockResolvedValue([]);

    const result = await getRoomPhotos('empty-room');

    expect(result).toEqual([]);
  });

  it('should handle empty result sets for project photos', async () => {
    mockPrisma.roomPhoto.findMany.mockResolvedValue([]);
    mockPrisma.roomPhoto.count.mockResolvedValue(0);

    const result = await getProjectPhotos('empty-project');

    expect(result.photos).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should handle timezone differences in photo timeline', async () => {
    const mockPhotos = [
      createMockRoomPhoto({
        id: 'photo-1',
        capturedAt: new Date('2024-01-15T23:59:59Z'),
      }),
      createMockRoomPhoto({
        id: 'photo-2',
        capturedAt: new Date('2024-01-16T00:00:01Z'),
      }),
    ];

    mockPrisma.roomPhoto.findMany.mockResolvedValue(mockPhotos);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');

    const result = await getRoomPhotoTimeline('room-1');

    // Should group by UTC date
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[1].date).toBe('2024-01-16');
  });
});
