import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  project: {
    findMany: vi.fn(),
  },
  document: {
    count: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

const mockWithDatabaseRetry = vi.hoisted(() => vi.fn((fn: () => any, _context: string) => fn()));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Apply mocks
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }));
vi.mock('@/lib/retry-util', () => ({ withDatabaseRetry: mockWithDatabaseRetry }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createLogger: vi.fn(() => mockLogger),
  createScopedLogger: vi.fn(() => mockLogger),
}));

// Import after mocks
import { GET } from '@/app/api/dashboard/route';

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOwnedProject = {
    id: 'proj-1',
    name: 'Owned Project',
    slug: 'owned-project',
    guestUsername: null,
    ownerId: 'user-123',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    _count: {
      Document: 5,
      ProjectMember: 2,
    },
    User_Project_ownerIdToUser: {
      username: 'testowner',
    },
  };

  const mockSharedProject = {
    id: 'proj-2',
    name: 'Shared Project',
    slug: 'shared-project',
    guestUsername: null,
    ownerId: 'other-user',
    status: 'active',
    createdAt: new Date('2024-01-02'),
    _count: {
      Document: 3,
      ProjectMember: 4,
    },
    User_Project_ownerIdToUser: {
      username: 'otherguy',
    },
    ProjectMember: [{ role: 'editor' }],
  };

  it('should return 401 if not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if session user is missing', async () => {
    mockGetServerSession.mockResolvedValue({ user: null });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should fetch owned and shared projects for regular user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockOwnedProject]) // owned
      .mockResolvedValueOnce([mockSharedProject]); // shared

    mockPrisma.document.count.mockResolvedValue(8);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ownedProjects).toHaveLength(1);
    expect(data.sharedProjects).toHaveLength(1);
    expect(data.projects).toHaveLength(2); // backward compatibility
    expect(data.stats.totalProjects).toBe(2);
    expect(data.stats.totalDocuments).toBe(8);

    // Verify owned project structure
    expect(data.ownedProjects[0]).toMatchObject({
      id: 'proj-1',
      name: 'Owned Project',
      slug: 'owned-project',
      documentCount: 5,
      memberCount: 2,
      ownerName: 'testowner',
      isOwner: true,
      memberRole: 'owner',
    });

    // Verify shared project structure
    expect(data.sharedProjects[0]).toMatchObject({
      id: 'proj-2',
      name: 'Shared Project',
      documentCount: 3,
      memberCount: 4,
      ownerName: 'otherguy',
      isOwner: false,
      memberRole: 'editor',
    });
  });

  it('should fetch all projects for admin user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    const allProjects = [mockOwnedProject, mockSharedProject];

    mockPrisma.project.findMany
      .mockResolvedValueOnce([]) // owned (none)
      .mockResolvedValueOnce([]) // shared (none)
      .mockResolvedValueOnce(allProjects); // all projects

    mockPrisma.document.count.mockResolvedValue(8);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.projects).toHaveLength(2);
    expect(mockPrisma.project.findMany).toHaveBeenCalledTimes(3);
  });

  it('should handle projects without owner', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    const projectWithoutOwner = {
      ...mockOwnedProject,
      User_Project_ownerIdToUser: null,
    };

    mockPrisma.project.findMany
      .mockResolvedValueOnce([projectWithoutOwner])
      .mockResolvedValueOnce([]);

    mockPrisma.document.count.mockResolvedValue(5);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ownedProjects[0].ownerName).toBe('Unknown');
  });

  it('should handle empty project list', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    mockPrisma.project.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockPrisma.document.count.mockResolvedValue(0);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ownedProjects).toHaveLength(0);
    expect(data.sharedProjects).toHaveLength(0);
    expect(data.stats.totalProjects).toBe(0);
    expect(data.stats.totalDocuments).toBe(0);
  });

  it('should filter documents count by user projects for non-admin', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    mockPrisma.project.findMany
      .mockResolvedValueOnce([mockOwnedProject])
      .mockResolvedValueOnce([]);

    mockPrisma.document.count.mockResolvedValue(5);

    await GET();

    // Verify document count query for non-admin
    expect(mockPrisma.document.count).toHaveBeenCalledWith({
      where: {
        Project: {
          OR: [
            { ownerId: 'user-123' },
            { ProjectMember: { some: { userId: 'user-123' } } },
          ],
        },
      },
    });
  });

  it('should count all documents for admin user', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.project.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockPrisma.document.count.mockResolvedValue(100);

    await GET();

    // Verify document count query for admin (no filter)
    expect(mockPrisma.document.count).toHaveBeenCalledWith({
      where: {},
    });
  });

  it('should return 503 on database connection error (P1xxx)', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    const dbError = new Error('Connection failed');
    (dbError as any).code = 'P1001';

    mockPrisma.project.findMany.mockRejectedValue(dbError);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toBe('Database connection error. Please try again.');
  });

  it('should return 500 on other errors', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    mockPrisma.project.findMany.mockRejectedValue(new Error('Unexpected error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });

  it('should format dates as ISO strings', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    const testDate = new Date('2024-02-09T10:00:00Z');
    const project = {
      ...mockOwnedProject,
      createdAt: testDate,
    };

    mockPrisma.project.findMany
      .mockResolvedValueOnce([project])
      .mockResolvedValueOnce([]);

    mockPrisma.document.count.mockResolvedValue(0);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ownedProjects[0].createdAt).toBe(testDate.toISOString());
  });

  it('should use withDatabaseRetry for all database calls', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    mockPrisma.project.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    mockPrisma.document.count.mockResolvedValue(0);

    await GET();

    // Session, owned projects, shared projects, document count = 4 calls
    expect(mockWithDatabaseRetry).toHaveBeenCalledTimes(4);
  });
});
