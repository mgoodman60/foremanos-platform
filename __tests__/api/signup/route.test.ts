import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  username: 'testuser',
};

const mockNewUser = {
  id: 'new-user-1',
  email: 'newuser@example.com',
  username: 'newuser',
  role: 'pending',
  subscriptionTier: 'free',
  approved: false,
  emailVerified: false,
};

// Mocks
const prismaMock = {
  user: {
    findFirst: vi.fn(),
    create: vi.fn().mockResolvedValue(mockNewUser),
    delete: vi.fn().mockResolvedValue(mockNewUser),
  },
};

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

const checkRateLimitMock = vi.fn();
const getClientIpMock = vi.fn().mockReturnValue('127.0.0.1');
const getRateLimitIdentifierMock = vi.fn().mockReturnValue('user-1:127.0.0.1');
const createRateLimitHeadersMock = vi.fn().mockReturnValue({
  'X-RateLimit-Limit': '5',
  'X-RateLimit-Remaining': '4',
});

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  getRateLimitIdentifier: getRateLimitIdentifierMock,
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

const sendEmailVerificationMock = vi.fn().mockResolvedValue(undefined);
const sendNewSignupNotificationMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/email-service', () => ({
  sendEmailVerification: sendEmailVerificationMock,
  sendNewSignupNotification: sendNewSignupNotificationMock,
}));

const logActivityMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/audit-log', () => ({
  logActivity: logActivityMock,
}));

const checkoutSessionsCreateMock = vi.fn().mockResolvedValue({
  id: 'cs_test123',
  url: 'https://checkout.stripe.com/test',
});

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: checkoutSessionsCreateMock,
      },
    },
  },
  STRIPE_PRICE_IDS: {
    starter_monthly: 'price_starter_monthly',
    starter_annual: 'price_starter_annual',
    pro_monthly: 'price_pro_monthly',
    pro_annual: 'price_pro_annual',
    team_monthly: 'price_team_monthly',
    business_monthly: 'price_business_monthly',
    enterprise_monthly: 'price_enterprise_monthly',
  },
}));

describe('POST /api/signup', () => {
  const validSignupData = {
    email: 'newuser@example.com',
    username: 'newuser',
    password: 'SecurePassword123!',
    confirmPassword: 'SecurePassword123!',
  };

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
    // Default: no existing user
    prismaMock.user.findFirst.mockResolvedValue(null);
    // Default: user creation succeeds
    prismaMock.user.create.mockResolvedValue(mockNewUser);
  });

  it('should return 429 when rate limit exceeded', async () => {
    checkRateLimitMock.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 300,
      retryAfter: 300,
    });

    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify(validSignupData),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error).toContain('Too many signup attempts');
  });

  it('should return 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        username: 'newuser',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Email, username, and password are required');
  });

  it('should return 400 when password is missing', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@example.com',
        username: 'newuser',
        confirmPassword: 'SecurePassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Email, username, and password are required');
  });

  it('should return 400 when passwords do not match', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...validSignupData,
        confirmPassword: 'DifferentPassword123!',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Passwords do not match');
  });

  it('should return 400 for weak password', async () => {
    validatePasswordMock.mockReturnValue({
      valid: false,
      error: 'Password must be at least 12 characters',
    });

    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...validSignupData,
        password: 'weak',
        confirmPassword: 'weak',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('12 characters');
  });

  it('should return 400 for existing email', async () => {
    prismaMock.user.findFirst.mockResolvedValue(mockUser);

    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify(validSignupData),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('already exists');
  });

  it('should hash password correctly', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify(validSignupData),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    expect(bcryptHashMock).toHaveBeenCalledWith(validSignupData.password, 10);
  });

  it('should create user with correct defaults for free tier', async () => {
    bcryptHashMock.mockResolvedValue('$2a$10$hashedpassword');

    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify(validSignupData),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: validSignupData.email,
        username: validSignupData.username,
        password: '$2a$10$hashedpassword',
        subscriptionTier: 'free',
        role: 'pending',
        approved: false,
        emailVerified: false,
        emailVerificationToken: expect.any(String),
        emailVerificationExpires: expect.any(Date),
      }),
    });
  });

  it('should send verification email for free tier signup', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify(validSignupData),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(sendEmailVerificationMock).toHaveBeenCalledWith(
      'newuser@example.com',
      'newuser',
      expect.any(String) // verification token
    );
  });

  it('should send admin notification about new signup', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify(validSignupData),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    expect(sendNewSignupNotificationMock).toHaveBeenCalled();
  });

  it('should log signup activity', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify(validSignupData),
      headers: { 'Content-Type': 'application/json' },
    });
    await POST(request);

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_signup',
        resource: 'user',
      })
    );
  });

  it('should return 201 with user data and requiresEmailVerification for free tier', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify(validSignupData),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.requiresEmailVerification).toBe(true);
    expect(data.User).toBeDefined();
    expect(data.User.email).toBe(validSignupData.email);
    expect(data.User.username).toBe(validSignupData.username);
    expect(data.User.tier).toBe('free');
  });

  it('should create Stripe checkout session for paid tier signup', async () => {
    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...validSignupData,
        selectedTier: 'pro',
        billingPeriod: 'monthly',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(checkoutSessionsCreateMock).toHaveBeenCalled();
    const data = await response.json();
    expect(data.requiresPayment).toBe(true);
    expect(data.checkoutUrl).toBeDefined();
  });

  it('should rollback user creation if Stripe checkout fails', async () => {
    checkoutSessionsCreateMock.mockRejectedValue(new Error('Stripe error'));

    const { POST } = await import('@/app/api/signup/route');
    const request = new NextRequest('http://localhost/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...validSignupData,
        selectedTier: 'pro',
        billingPeriod: 'monthly',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(prismaMock.user.delete).toHaveBeenCalled();
    const data = await response.json();
    expect(data.error).toContain('Failed to create payment session');
  });
});
