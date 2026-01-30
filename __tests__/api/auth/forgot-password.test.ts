import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies BEFORE importing the route
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
  password: 'hashedpassword',
};

const prismaMock = {
  user: {
    findFirst: vi.fn(),
  },
  passwordResetToken: {
    create: vi.fn().mockResolvedValue({ id: 'prt-1', token: 'test-token' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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

const sendPasswordResetEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/email-service', () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit passes
    checkRateLimitMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Math.floor(Date.now() / 1000) + 300,
    });
    // Default: user exists with password
    prismaMock.user.findFirst.mockResolvedValue(mockUser);
  });

  it('should return 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 300,
      retryAfter: 300,
    });

    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const request = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toContain('Too many attempts');
  });

  it('should return 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const request = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Email is required');
  });

  it('should return 200 for non-existent email (prevents enumeration)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const request = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain('If the email exists');
    // Should NOT have called sendPasswordResetEmail
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it('should return 200 for guest account without password', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...mockUser,
      password: null, // Guest accounts have no password
    });

    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const request = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'guest@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain('If the email exists');
    // Should NOT have created a token or sent email
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it('should invalidate existing reset tokens before creating new one', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const request = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    // Should have invalidated existing tokens
    expect(prismaMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: mockUser.id,
        used: false,
      },
      data: {
        used: true,
      },
    });
  });

  it('should create new PasswordResetToken with 24h expiry', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const request = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    // Should have created a new token
    expect(prismaMock.passwordResetToken.create).toHaveBeenCalled();
    const createCall = prismaMock.passwordResetToken.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe(mockUser.id);
    expect(createCall.data.token).toBeDefined();
    expect(createCall.data.expiresAt).toBeDefined();
    // Expiry should be roughly 24 hours from now
    const expiresAt = new Date(createCall.data.expiresAt);
    const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    expect(hoursUntilExpiry).toBeGreaterThan(23);
    expect(hoursUntilExpiry).toBeLessThanOrEqual(24);
  });

  it('should send password reset email', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const request = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
      mockUser.email,
      mockUser.username,
      expect.any(String), // token
      mockUser.id
    );
  });

  it('should return 500 on database error', async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error('Database connection failed'));

    const { POST } = await import('@/app/api/auth/forgot-password/route');
    const request = new NextRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('error occurred');
  });
});
