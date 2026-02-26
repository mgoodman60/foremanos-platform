import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
}));

const mockGetServerSession = vi.hoisted(() => vi.fn());

const mockBcryptHash = vi.hoisted(() => vi.fn());

const mockSendWelcomeEmail = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Apply mocks
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/auth', () => ({ auth: mockGetServerSession }));
vi.mock('bcryptjs', () => ({ default: { hash: mockBcryptHash } }));
vi.mock('@/lib/email-service', () => ({ sendWelcomeEmail: mockSendWelcomeEmail }));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createLogger: vi.fn(() => mockLogger),
  createScopedLogger: vi.fn(() => mockLogger),
}));

// Import after mocks
import { GET, POST } from '@/app/api/admin/users/route';

function createRequest(method: string, url: string, body?: object): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    ...(body ? {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    } : {}),
  });
}

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUsers = [
    {
      id: 'user-1',
      email: 'user1@example.com',
      username: 'user1',
      role: 'client',
      approved: true,
      subscriptionTier: 'pro',
      createdAt: new Date('2024-01-01'),
      lastLoginAt: new Date('2024-02-01'),
      _count: {
        Project_Project_ownerIdToUser: 3,
        ChatMessage: 150,
      },
    },
    {
      id: 'user-2',
      email: 'user2@example.com',
      username: 'user2',
      role: 'admin',
      approved: true,
      subscriptionTier: 'enterprise',
      createdAt: new Date('2024-01-15'),
      lastLoginAt: null,
      _count: {
        Project_Project_ownerIdToUser: 0,
        ChatMessage: 50,
      },
    },
  ];

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

  it('should return all users for admin', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findMany.mockResolvedValue(mockUsers);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toHaveLength(2);
    expect(data.users[0]).toMatchObject({
      id: 'user-1',
      email: 'user1@example.com',
      username: 'user1',
      role: 'client',
      approved: true,
      subscriptionTier: 'pro',
    });
  });

  it('should order users by createdAt desc', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      select: expect.any(Object),
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should include user counts', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findMany.mockResolvedValue(mockUsers);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users[0]._count).toMatchObject({
      Project_Project_ownerIdToUser: 3,
      ChatMessage: 150,
    });
  });

  it('should return 500 on database error', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findMany.mockRejectedValue(new Error('Database error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});

describe('POST /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBcryptHash.mockResolvedValue('hashed_password');
    mockSendWelcomeEmail.mockResolvedValue(undefined);
  });

  it('should return 401 if not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthenticated');
  });

  it('should return 403 if user is not admin', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-123', role: 'client' },
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Forbidden. Only admins can create users.');
  });

  it('should return 400 if email is missing', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    const request = createRequest('POST', '/api/admin/users', {});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 400 if email format is invalid', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'invalid-email',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid email format');
  });

  it('should return 409 if user email already exists', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'existing-user',
      email: 'test@example.com',
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('User with this email already exists');
  });

  it('should return 409 if username is taken', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce({ id: 'existing', username: 'testuser' }); // username check

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
      username: 'testuser',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Username already taken. Please provide a different username.');
  });

  it('should return 400 if role is invalid', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
      role: 'superuser',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid role. Must be admin, client, or guest.');
  });

  it('should return 400 if subscription tier is invalid', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
      subscriptionTier: 'platinum',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid subscription tier');
  });

  it('should create user with defaults', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.user.email).toBe('test@example.com');
    expect(data.user.username).toBe('test');
    expect(data.message).toBe('User created successfully');
  });

  it('should generate username from email if not provided', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'john.doe@example.com',
      username: 'john.doe',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'john.doe@example.com',
    });
    await POST(request);

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.username).toBe('john.doe');
  });

  it('should hash password', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
      password: 'MyP@ssw0rd',
    });
    await POST(request);

    expect(mockBcryptHash).toHaveBeenCalledWith('MyP@ssw0rd', 10);
    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.password).toBe('hashed_password');
  });

  it('should generate secure password if not provided', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(mockBcryptHash).toHaveBeenCalled();
    expect(data.credentials.password).toBeTruthy();
    expect(data.credentials.password).not.toBe('(custom password set)');
  });

  it('should create user with custom role and tier', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'admin@example.com',
      username: 'newadmin',
      role: 'admin',
      approved: true,
      subscriptionTier: 'enterprise',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'admin@example.com',
      username: 'newadmin',
      role: 'admin',
      subscriptionTier: 'enterprise',
    });
    await POST(request);

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.role).toBe('admin');
    expect(createCall.data.subscriptionTier).toBe('enterprise');
  });

  it('should log activity after user creation', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
    });
    await POST(request);

    expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        action: 'admin_created_user',
        details: 'Admin created new user: test@example.com (client)',
        ipAddress: expect.any(String),
        userAgent: expect.any(String),
      },
    });
  });

  it('should send welcome email if requested', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
      sendWelcomeEmail: true,
    });
    await POST(request);

    expect(mockSendWelcomeEmail).toHaveBeenCalledWith('test@example.com', 'test', 'new-user');
  });

  it('should not send welcome email if disabled', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
      sendWelcomeEmail: false,
    });
    await POST(request);

    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('should not fail if welcome email fails', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    mockSendWelcomeEmail.mockRejectedValue(new Error('Email service down'));

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
      sendWelcomeEmail: true,
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it('should normalize email to lowercase', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'TEST@EXAMPLE.COM',
    });
    await POST(request);

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.email).toBe('test@example.com');
  });

  it('should return 500 on database error', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });

  it('should auto-verify email if auto-approved', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    });

    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      username: 'test',
      role: 'client',
      approved: true,
      subscriptionTier: 'free',
      createdAt: new Date(),
    });

    const request = createRequest('POST', '/api/admin/users', {
      email: 'test@example.com',
      autoApprove: true,
    });
    await POST(request);

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.data.approved).toBe(true);
    expect(createCall.data.emailVerified).toBe(true);
  });
});
