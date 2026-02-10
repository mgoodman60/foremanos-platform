import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/projects/[slug]/floor-plans/discipline-sheets/route';

// Mock dependencies
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  documentChunk: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}));
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));
const mockSheetParser = vi.hoisted(() => ({
  parseSheetNumber: vi.fn(),
  matchesFloor: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));
vi.mock('@/lib/sheet-number-parser', () => mockSheetParser);

describe('GET /api/projects/[slug]/floor-plans/discipline-sheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if no session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 if session has no email', async () => {
    mockGetServerSession.mockResolvedValue({ user: {} });

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if baseSheet parameter is missing', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('baseSheet parameter is required');
  });

  it('should return 404 if project not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Project not found');
  });

  it('should return 404 if user not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'owner-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should return 403 if user has no access to project', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Test Project',
      ownerId: 'owner-1',
      ProjectMember: [],
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Access denied');
  });

  it('should return 400 if baseSheet format is invalid', async () => {
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
    mockSheetParser.parseSheetNumber.mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=INVALID');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid base sheet number format');
  });

  it('should return matched MEP sheets on same floor', async () => {
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({
      scaleRatio: 0.25,
    });
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        sheetNumber: 'M-101',
        discipline: 'Mechanical',
        scaleRatio: 0.25,
        chunkIndex: 0,
        pageNumber: 1,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        sheetNumber: 'E-101',
        discipline: 'Electrical',
        scaleRatio: 0.125,
        chunkIndex: 0,
        pageNumber: 1,
      },
    ]);
    mockSheetParser.matchesFloor.mockImplementation((a, b) => {
      return a === 'A-101' && (b === 'M-101' || b === 'E-101');
    });

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.baseSheet).toBe('A-101');
    expect(data.baseSheetInfo).toEqual({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    expect(data.baseScaleRatio).toBe(0.25);
    expect(data.sheets).toHaveLength(2);
    expect(data.sheets[0]).toEqual({
      id: 'chunk-1',
      documentId: 'doc-1',
      sheetNumber: 'M-101',
      discipline: 'Mechanical',
      pageNumber: 1,
      scaleRatio: 0.25,
      scaleFactor: 1.0, // 0.25 / 0.25
    });
    expect(data.sheets[1]).toEqual({
      id: 'chunk-2',
      documentId: 'doc-2',
      sheetNumber: 'E-101',
      discipline: 'Electrical',
      pageNumber: 1,
      scaleRatio: 0.125,
      scaleFactor: 2.0, // 0.25 / 0.125
    });
  });

  it('should filter to MEP disciplines only', async () => {
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: 0.25 });

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    await GET(request, { params: { slug: 'test' } });

    expect(mockPrisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          discipline: {
            in: ['Mechanical', 'Electrical', 'Plumbing', 'Fire Protection'],
          },
          drawingType: 'floor_plan',
        }),
      })
    );
  });

  it('should exclude sheets on different floors', async () => {
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: 0.25 });
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        sheetNumber: 'M-101',
        discipline: 'Mechanical',
        scaleRatio: 0.25,
        chunkIndex: 0,
        pageNumber: 1,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        sheetNumber: 'M-201',
        discipline: 'Mechanical',
        scaleRatio: 0.25,
        chunkIndex: 0,
        pageNumber: 1,
      },
    ]);
    mockSheetParser.matchesFloor.mockImplementation((a, b) => {
      return a === 'A-101' && b === 'M-101'; // Only M-101 matches
    });

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sheets).toHaveLength(1);
    expect(data.sheets[0].sheetNumber).toBe('M-101');
  });

  it('should return empty array when no matching sheets', async () => {
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: 0.25 });
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sheets).toHaveLength(0);
    expect(data.total).toBe(0);
  });

  it('should calculate scale factor correctly', async () => {
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: 0.5 }); // base = 0.5
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        sheetNumber: 'M-101',
        discipline: 'Mechanical',
        scaleRatio: 0.25, // MEP = 0.25
        chunkIndex: 0,
        pageNumber: 1,
      },
    ]);
    mockSheetParser.matchesFloor.mockReturnValue(true);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(data.sheets[0].scaleFactor).toBe(2.0); // 0.5 / 0.25
  });

  it('should use default scale factor when scale ratios not available', async () => {
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: null });
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        sheetNumber: 'M-101',
        discipline: 'Mechanical',
        scaleRatio: null,
        chunkIndex: 0,
        pageNumber: 1,
      },
    ]);
    mockSheetParser.matchesFloor.mockReturnValue(true);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(data.baseScaleRatio).toBeNull();
    expect(data.sheets[0].scaleFactor).toBe(1.0); // default
  });

  it('should use pageNumber if available, fallback to chunkIndex', async () => {
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: 0.25 });
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        id: 'chunk-1',
        documentId: 'doc-1',
        sheetNumber: 'M-101',
        discipline: 'Mechanical',
        scaleRatio: 0.25,
        chunkIndex: 5,
        pageNumber: null,
      },
      {
        id: 'chunk-2',
        documentId: 'doc-2',
        sheetNumber: 'E-101',
        discipline: 'Electrical',
        scaleRatio: 0.25,
        chunkIndex: 3,
        pageNumber: 7,
      },
    ]);
    mockSheetParser.matchesFloor.mockReturnValue(true);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(data.sheets[0].pageNumber).toBe(6); // chunkIndex + 1
    expect(data.sheets[1].pageNumber).toBe(7); // pageNumber
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: 0.25 });
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });

    expect(response.status).toBe(200);
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: 0.25 });
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });

    expect(response.status).toBe(200);
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
    mockSheetParser.parseSheetNumber.mockReturnValue({
      discipline: 'A',
      disciplineName: 'Architectural',
      level: '1',
      sequence: '01',
      raw: 'A-101',
    });
    mockPrisma.documentChunk.findFirst.mockResolvedValue({ scaleRatio: 0.25 });
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });

    expect(response.status).toBe(200);
  });

  it('should return 500 on unexpected error', async () => {
    mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });
    mockPrisma.project.findUnique.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/projects/test/floor-plans/discipline-sheets?baseSheet=A-101');
    const response = await GET(request, { params: { slug: 'test' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch discipline sheets');
    expect(data.details).toBe('Database error');
  });
});
