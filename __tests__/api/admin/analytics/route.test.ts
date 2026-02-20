import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  project: {
    findMany: vi.fn(),
  },
  chatMessage: {
    groupBy: vi.fn(),
  },
  conversation: {
    findMany: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Apply mocks
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

// Import after mocks
import { GET } from '@/app/api/admin/analytics/route';

function createRequest(method: string, url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method });
}

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProject1 = {
    id: 'proj-1',
    name: 'Project Alpha',
    slug: 'project-alpha',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    User_Project_ownerIdToUser: {
      username: 'owner1',
      email: 'owner1@example.com',
    },
    _count: {
      Document: 5,
      ProjectMember: 3,
    },
  };

  const mockProject2 = {
    id: 'proj-2',
    name: 'Project Beta',
    slug: 'project-beta',
    status: 'completed',
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2024-01-20'),
    User_Project_ownerIdToUser: {
      username: 'owner2',
      email: 'owner2@example.com',
    },
    _count: {
      Document: 10,
      ProjectMember: 5,
    },
  };

  it('should return 401 if not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthenticated');
  });

  it('should return 403 if user is not admin', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden');
  });

  it('should return analytics data for admin user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([mockProject1, mockProject2]);

    mockPrisma.chatMessage.groupBy.mockResolvedValue([
      { conversationId: 'conv-1', _count: { id: 25 } },
      { conversationId: 'conv-2', _count: { id: 15 } },
    ]);

    mockPrisma.conversation.findMany.mockResolvedValue([
      { id: 'conv-1', projectId: 'proj-1' },
      { id: 'conv-2', projectId: 'proj-2' },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.analytics).toHaveLength(2);

    // Verify first project analytics
    expect(data.analytics[0]).toMatchObject({
      id: 'proj-1',
      name: 'Project Alpha',
      slug: 'project-alpha',
      status: 'active',
      messageCount: 25,
    });

    // Verify second project analytics
    expect(data.analytics[1]).toMatchObject({
      id: 'proj-2',
      name: 'Project Beta',
      slug: 'project-beta',
      status: 'completed',
      messageCount: 15,
    });
  });

  it('should return zero message count for projects without conversations', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([mockProject1]);
    mockPrisma.chatMessage.groupBy.mockResolvedValue([]);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.analytics[0].messageCount).toBe(0);
  });

  it('should aggregate message counts from multiple conversations', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([mockProject1]);

    // Two conversations for same project
    mockPrisma.chatMessage.groupBy.mockResolvedValue([
      { conversationId: 'conv-1', _count: { id: 10 } },
      { conversationId: 'conv-2', _count: { id: 5 } },
      { conversationId: 'conv-3', _count: { id: 8 } },
    ]);

    mockPrisma.conversation.findMany.mockResolvedValue([
      { id: 'conv-1', projectId: 'proj-1' },
      { id: 'conv-2', projectId: 'proj-1' }, // same project
      { id: 'conv-3', projectId: 'proj-2' }, // different project
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.analytics[0].messageCount).toBe(15); // 10 + 5
  });

  it('should handle empty projects list', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([]);
    mockPrisma.chatMessage.groupBy.mockResolvedValue([]);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.analytics).toHaveLength(0);
  });

  it('should order projects by updatedAt desc', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([mockProject2, mockProject1]);
    mockPrisma.chatMessage.groupBy.mockResolvedValue([]);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
      select: expect.any(Object),
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('should include project counts in analytics', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([mockProject1]);
    mockPrisma.chatMessage.groupBy.mockResolvedValue([]);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.analytics[0]._count).toMatchObject({
      Document: 5,
      ProjectMember: 3,
    });
  });

  it('should include owner information', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([mockProject1]);
    mockPrisma.chatMessage.groupBy.mockResolvedValue([]);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.analytics[0].User_Project_ownerIdToUser).toMatchObject({
      username: 'owner1',
      email: 'owner1@example.com',
    });
  });

  it('should handle conversations without project mapping', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([mockProject1]);

    mockPrisma.chatMessage.groupBy.mockResolvedValue([
      { conversationId: 'conv-orphan', _count: { id: 10 } },
    ]);

    // Conversation doesn't exist
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    // Orphan messages shouldn't crash, just not counted
    expect(data.analytics[0].messageCount).toBe(0);
  });

  it('should return 500 on database error', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockRejectedValue(new Error('Database error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });

  it('should query conversation IDs from message counts', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany.mockResolvedValue([mockProject1]);

    const messageGroups = [
      { conversationId: 'conv-1', _count: { id: 5 } },
      { conversationId: 'conv-2', _count: { id: 10 } },
    ];
    mockPrisma.chatMessage.groupBy.mockResolvedValue(messageGroups);

    mockPrisma.conversation.findMany.mockResolvedValue([
      { id: 'conv-1', projectId: 'proj-1' },
      { id: 'conv-2', projectId: 'proj-1' },
    ]);

    await GET();

    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['conv-1', 'conv-2'] } },
      select: { id: true, projectId: true },
    });
  });
});
