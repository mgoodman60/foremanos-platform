import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
};

const mockPasswordResetToken = {
  id: 'prt-1',
  userId: 'user-1',
  token: 'valid-reset-token-12345',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  used: false,
  createdAt: new Date(),
  User: mockUser,
};

// Mocks
const prismaMock = {
  passwordResetToken: {
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...mockPasswordResetToken, used: true }),
  },
  user: {
    update: vi.fn().mockResolvedValue(mockUser),
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

const validatePasswordMock = vi.fn();

vi.mock('@/lib/password-validator', () => ({
  validatePassword: validatePasswordMock,
}));

const bcryptHashMock = vi.fn().mockResolvedValue('$2a$10$hashedpassword');

vi.mock('bcryptjs', () => ({
  default: {
    hash: bcryptHashMock,
    compare: vi.fn().mockResolvedValue(true),
  },
  hash: bcryptHashMock,
  compare: vi.fn().mockResolvedValue(true),
}));

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit passes
    checkRateLimitMock.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Math.floor(Date.now() / 1000) + 300,
    });
    // Default: password validation passes
    validatePasswordMock.mockReturnValue({ valid: true });
    // Default: valid token exists
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(mockPasswordResetToken);
  });

  it('should return 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 300,
      retryAfter: 300,
    });

    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'some-token', password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toContain('Too many attempts');
  });

  it('should return 400 when token is missing', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Token and password are required');
  });

  it('should return 400 when password is missing', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'some-token' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Token and password are required');
  });

  it('should return 400 for invalid token (not found)', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue(null);

    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'invalid-token', password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid or expired reset token');
  });

  it('should return 400 for expired token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      ...mockPasswordResetToken,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'expired-token', password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('expired');
  });

  it('should return 400 for already-used token', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      ...mockPasswordResetToken,
      used: true,
    });

    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'used-token', password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('already been used');
  });

  it('should return 400 for weak password', async () => {
    validatePasswordMock.mockReturnValue({
      valid: false,
      error: 'Password must be at least 12 characters',
    });

    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'weak' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('12 characters');
  });

  it('should hash password before storing', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    expect(bcryptHashMock).toHaveBeenCalledWith('NewPassword123!', 10);
  });

  it('should update user password with hashed value', async () => {
    bcryptHashMock.mockResolvedValue('$2a$10$newhash');

    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: mockPasswordResetToken.userId },
      data: { password: '$2a$10$newhash' },
    });
  });

  it('should mark token as used after successful reset', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: mockPasswordResetToken.id },
      data: { used: true },
    });
  });

  it('should return 200 on successful password reset', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route');
    const request = new NextRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'NewPassword123!' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain('Password reset successful');
  });
});
