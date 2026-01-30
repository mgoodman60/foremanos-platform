import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock data
const mockUserWithVerificationToken = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  emailVerified: false,
  approved: false,
  role: 'pending',
  emailVerificationToken: 'valid-verification-token-12345',
  emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
};

// Mocks
const prismaMock = {
  user: {
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({
      ...mockUserWithVerificationToken,
      emailVerified: true,
      approved: true,
      role: 'client',
    }),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

const checkRateLimitMock = vi.fn();
const getClientIpMock = vi.fn().mockReturnValue('127.0.0.1');
const createRateLimitHeadersMock = vi.fn().mockReturnValue({
  'X-RateLimit-Limit': '5',
  'X-RateLimit-Remaining': '4',
});

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  createRateLimitHeaders: createRateLimitHeadersMock,
  RATE_LIMITS: {
    AUTH: { maxRequests: 5, windowSeconds: 300 },
  },
}));

const logActivityMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/audit-log', () => ({
  logActivity: logActivityMock,
}));

function createVerifyEmailRequest(token: string | null): NextRequest {
  const url = token
    ? `http://localhost/api/auth/verify-email?token=${token}`
    : 'http://localhost/api/auth/verify-email';
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit passes
    checkRateLimitMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Math.floor(Date.now() / 1000) + 300,
    });
    // Default: user with valid token found
    prismaMock.user.findFirst.mockResolvedValue(mockUserWithVerificationToken);
  });

  it('should return 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 300,
      retryAfter: 300,
    });

    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('some-token');
    const response = await GET(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toContain('Too many attempts');
  });

  it('should return 400 when token is missing', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest(null);
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Verification token is required');
  });

  it('should return 400 for invalid token (not found)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('invalid-token');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid or expired verification token');
  });

  it('should return 400 for expired token', async () => {
    // User with expired token won't be found by the query (gt: new Date())
    prismaMock.user.findFirst.mockResolvedValue(null);

    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('expired-token');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid or expired verification token');
  });

  it('should update user emailVerified to true', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('valid-token');
    await GET(request);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: mockUserWithVerificationToken.id },
      data: expect.objectContaining({
        emailVerified: true,
      }),
    });
  });

  it('should approve user and set role to client', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('valid-token');
    await GET(request);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: mockUserWithVerificationToken.id },
      data: expect.objectContaining({
        approved: true,
        role: 'client',
      }),
    });
  });

  it('should clear verification token after use', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('valid-token');
    await GET(request);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: mockUserWithVerificationToken.id },
      data: expect.objectContaining({
        emailVerificationToken: null,
        emailVerificationExpires: null,
      }),
    });
  });

  it('should log verification activity', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('valid-token');
    await GET(request);

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserWithVerificationToken.id,
        action: 'email_verified',
        resource: 'user',
        resourceId: mockUserWithVerificationToken.id,
      })
    );
  });

  it('should return 200 with user data on successful verification', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('valid-token');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('Email verified successfully');
    expect(data.User).toBeDefined();
    expect(data.User.email).toBe(mockUserWithVerificationToken.email);
    expect(data.User.username).toBe(mockUserWithVerificationToken.username);
  });

  it('should return 500 on database error', async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error('Database connection failed'));

    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = createVerifyEmailRequest('valid-token');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Internal server error');
  });
});
