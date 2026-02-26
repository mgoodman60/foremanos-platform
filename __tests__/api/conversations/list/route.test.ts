import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
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
vi.mock('@/auth', () => ({ auth: mockGetServerSession }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createLogger: vi.fn(() => mockLogger),
  createScopedLogger: vi.fn(() => mockLogger),
}));

// Import after mocks
import { GET } from '@/app/api/conversations/list/route';

function createRequest(method: string, url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method });
}

describe('GET /api/conversations/list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    id: 'user-123',
    subscriptionTier: 'pro',
  };

  const mockConversation = {
    id: 'conv-1',
    title: 'Regular Chat',
    conversationType: 'standard',
    isSystemManaged: false,
    isPinned: false,
    dailyReportDate: null,
    isReadOnly: false,
    finalized: false,
    finalizedAt: null,
    lastActivityAt: new Date('2024-02-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-02-01'),
    _count: { ChatMessage: 25 },
    Project: {
      name: 'Test Project',
      slug: 'test-project',
      dailyReportEnabled: true,
    },
  };

  const mockDailyReportConversation = {
    id: 'conv-2',
    title: 'Daily Report Chat - 2024-01-15',
    conversationType: 'daily_report',
    isSystemManaged: true,
    isPinned: false,
    dailyReportDate: new Date('2024-01-15'),
    isReadOnly: false,
    finalized: true,
    finalizedAt: new Date('2024-01-16'),
    lastActivityAt: new Date('2024-01-15'),
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-16'),
    _count: { ChatMessage: 10 },
    Project: {
      name: 'Test Project',
      slug: 'test-project',
      dailyReportEnabled: true,
    },
  };

  it('should return 401 if not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if session user is missing', async () => {
    mockGetServerSession.mockResolvedValue({ user: null });

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 if user not found in database', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should fetch all conversations for user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.conversation.findMany.mockResolvedValue([mockConversation]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0]).toMatchObject({
      id: 'conv-1',
      title: 'Regular Chat',
      messageCount: 25,
      projectName: 'Test Project',
      projectSlug: 'test-project',
      conversationType: 'standard',
      isSystemManaged: false,
      isPinned: false,
    });
  });

  it('should filter by project slug if provided', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      dailyReportEnabled: true,
    });
    mockPrisma.conversation.findMany.mockResolvedValue([mockConversation]);

    const request = createRequest('GET', '/api/conversations/list?projectSlug=test-project');
    await GET(request);

    expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
      where: { slug: 'test-project' },
      select: { id: true, dailyReportEnabled: true },
    });

    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123', projectId: 'proj-1' },
      })
    );
  });

  it('should not filter by project if slug is invalid', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.project.findUnique.mockResolvedValue(null);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const request = createRequest('GET', '/api/conversations/list?projectSlug=invalid');
    await GET(request);

    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123' },
      })
    );
  });

  it('should include daily report conversations for Pro+ users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.conversation.findMany.mockResolvedValue([
      mockConversation,
      mockDailyReportConversation,
    ]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(2);
    expect(data.conversations[1]).toMatchObject({
      conversationType: 'daily_report',
      finalized: true,
      dailyReportDate: expect.any(String),
    });
  });

  it('should exclude daily report conversations if feature disabled', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const disabledDailyReport = {
      ...mockDailyReportConversation,
      Project: {
        ...mockDailyReportConversation.Project,
        dailyReportEnabled: false,
      },
    };

    mockPrisma.conversation.findMany.mockResolvedValue([
      mockConversation,
      disabledDailyReport,
    ]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0].conversationType).toBe('standard');
  });

  it('should exclude daily report conversations for Free tier users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    const freeUser = { ...mockUser, subscriptionTier: 'free' };
    mockPrisma.user.findUnique.mockResolvedValue(freeUser);
    mockPrisma.conversation.findMany.mockResolvedValue([
      mockConversation,
      mockDailyReportConversation,
    ]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(1);
    expect(data.conversations[0].conversationType).toBe('standard');
  });

  it('should exclude daily report conversations for Starter tier users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    const starterUser = { ...mockUser, subscriptionTier: 'starter' };
    mockPrisma.user.findUnique.mockResolvedValue(starterUser);
    mockPrisma.conversation.findMany.mockResolvedValue([
      mockConversation,
      mockDailyReportConversation,
    ]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(1);
  });

  it('should include daily report conversations for Team tier users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    const teamUser = { ...mockUser, subscriptionTier: 'team' };
    mockPrisma.user.findUnique.mockResolvedValue(teamUser);
    mockPrisma.conversation.findMany.mockResolvedValue([
      mockConversation,
      mockDailyReportConversation,
    ]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(2);
  });

  it('should include daily report conversations for Business tier users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    const businessUser = { ...mockUser, subscriptionTier: 'business' };
    mockPrisma.user.findUnique.mockResolvedValue(businessUser);
    mockPrisma.conversation.findMany.mockResolvedValue([
      mockConversation,
      mockDailyReportConversation,
    ]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(2);
  });

  it('should include daily report conversations for Enterprise tier users', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    const enterpriseUser = { ...mockUser, subscriptionTier: 'enterprise' };
    mockPrisma.user.findUnique.mockResolvedValue(enterpriseUser);
    mockPrisma.conversation.findMany.mockResolvedValue([
      mockConversation,
      mockDailyReportConversation,
    ]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(2);
  });

  it('should order conversations by pinned status then updatedAt desc', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const request = createRequest('GET', '/api/conversations/list');
    await GET(request);

    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      })
    );
  });

  it('should limit results to 50 conversations', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const request = createRequest('GET', '/api/conversations/list');
    await GET(request);

    expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it('should return empty list if no conversations', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.conversation.findMany.mockResolvedValue([]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations).toHaveLength(0);
  });

  it('should include finalization fields for daily report conversations', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.conversation.findMany.mockResolvedValue([mockDailyReportConversation]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations[0]).toHaveProperty('finalized', true);
    expect(data.conversations[0]).toHaveProperty('finalizedAt');
    expect(data.conversations[0]).toHaveProperty('lastActivityAt');
  });

  it('should handle conversations without project', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const orphanConversation = {
      ...mockConversation,
      Project: null,
    };

    mockPrisma.conversation.findMany.mockResolvedValue([orphanConversation]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.conversations[0].projectName).toBeUndefined();
    expect(data.conversations[0].projectSlug).toBeUndefined();
  });

  it('should return 500 on database error', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });

  it('should convert dates to ISO strings in response', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.conversation.findMany.mockResolvedValue([mockDailyReportConversation]);

    const request = createRequest('GET', '/api/conversations/list');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(typeof data.conversations[0].createdAt).toBe('string');
    expect(typeof data.conversations[0].updatedAt).toBe('string');
    expect(typeof data.conversations[0].dailyReportDate).toBe('string');
    expect(typeof data.conversations[0].finalizedAt).toBe('string');
    expect(typeof data.conversations[0].lastActivityAt).toBe('string');
  });
});
