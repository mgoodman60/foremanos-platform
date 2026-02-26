import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/projects/[slug]/rooms/bulk-update-hotspots/route';

// Mock dependencies
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  room: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mockGetServerSession }));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

describe('POST /api/projects/[slug]/rooms/bulk-update-hotspots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({ placements: [] }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if session has no email', async () => {
    mockGetServerSession.mockResolvedValue({ user: {} });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({ placements: [] }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if placements is not an array', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({ placements: 'not-an-array' }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('placements must be a non-empty array');
  });

  it('should return 400 if placements is empty array', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({ placements: [] }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('placements must be a non-empty array');
  });

  it('should return 400 if placement missing roomId', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Each placement must have a valid roomId');
  });

  it('should return 400 if placement has invalid roomId type', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 123,
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Each placement must have a valid roomId');
  });

  it('should return 400 if placement missing floorPlanId', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Each placement must have a valid floorPlanId');
  });

  it('should return 400 if hotspot coordinates are not numbers', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: '10',
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('hotspotX, hotspotY, hotspotWidth, and hotspotHeight must be numbers');
  });

  it('should return 400 if hotspot coordinates out of bounds (negative)', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: -10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Hotspot coordinates and dimensions must be between 0 and 100 (percentage)');
  });

  it('should return 400 if hotspot coordinates out of bounds (>100)', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 101,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Hotspot coordinates and dimensions must be between 0 and 100 (percentage)');
  });

  it('should return 404 if project not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'nonexistent' } } as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Project not found');
  });

  it('should return 404 if user not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'owner-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should return 403 if user has no access to project', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      ownerId: 'owner-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Access denied');
  });

  it('should allow access for project owner', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room-1', roomNumber: '101', name: 'Office' },
    ]);
    mockPrisma.$transaction.mockResolvedValue([
      { id: 'room-1', roomNumber: '101' },
    ]);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should allow access for admin user', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'owner-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'admin',
    });
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room-1', roomNumber: '101', name: 'Office' },
    ]);
    mockPrisma.$transaction.mockResolvedValue([
      { id: 'room-1', roomNumber: '101' },
    ]);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should allow access for project member', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'member@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'owner-1',
      ProjectMember: [
        { userId: 'user-1', User: { id: 'user-1', email: 'member@example.com' } },
      ],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room-1', roomNumber: '101', name: 'Office' },
    ]);
    mockPrisma.$transaction.mockResolvedValue([
      { id: 'room-1', roomNumber: '101' },
    ]);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 400 if some rooms do not belong to project', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    // Return fewer rooms than requested
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room-1', roomNumber: '101', name: 'Office' },
    ]);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
          {
            roomId: 'room-2',
            hotspotX: 30,
            hotspotY: 40,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Some rooms do not exist or do not belong to this project');
  });

  it('should successfully update multiple rooms', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room-1', roomNumber: '101', name: 'Office' },
      { id: 'room-2', roomNumber: '102', name: 'Conference' },
    ]);
    mockPrisma.$transaction.mockResolvedValue([
      { id: 'room-1', roomNumber: '101' },
      { id: 'room-2', roomNumber: '102' },
    ]);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
          {
            roomId: 'room-2',
            hotspotX: 30,
            hotspotY: 40,
            hotspotWidth: 8,
            hotspotHeight: 6,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.updated).toBe(2);
    expect(data.message).toContain('Successfully updated hotspot coordinates for 2 rooms');
    expect(data.rooms).toHaveLength(2);
    expect(data.rooms[0]).toEqual({
      id: 'room-1',
      roomNumber: '101',
      name: 'Office',
    });
  });

  it('should call $transaction with correct update operations', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'user-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });
    mockPrisma.room.findMany.mockResolvedValue([
      { id: 'room-1', roomNumber: '101', name: 'Office' },
    ]);
    mockPrisma.$transaction.mockResolvedValue([
      { id: 'room-1', roomNumber: '101' },
    ]);

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 15.5,
            hotspotY: 25.3,
            hotspotWidth: 7.2,
            hotspotHeight: 9.1,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    await POST(request, { params: { slug: 'test' } } as any);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const transactionArg = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionArg).toHaveLength(1);
  });

  it('should return 500 on unexpected error', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost/api/projects/test/rooms/bulk-update-hotspots', {
      method: 'POST',
      body: JSON.stringify({
        placements: [
          {
            roomId: 'room-1',
            hotspotX: 10,
            hotspotY: 20,
            hotspotWidth: 5,
            hotspotHeight: 5,
            floorPlanId: 'floor-1',
          },
        ],
      }),
    });

    const response = await POST(request, { params: { slug: 'test' } } as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to bulk update room hotspots');
    expect(data.details).toBe('Database connection failed');
  });
});
