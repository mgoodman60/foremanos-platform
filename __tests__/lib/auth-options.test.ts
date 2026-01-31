import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

const mockBcrypt = vi.hoisted(() => ({
  compare: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());
const mockSendSignInNotification = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
  compare: mockBcrypt.compare,
}));

vi.mock('@/lib/audit-log', () => ({
  logActivity: mockLogActivity,
}));

vi.mock('@/lib/email-service', () => ({
  sendSignInNotification: mockSendSignInNotification,
}));

import { authOptions } from '@/lib/auth-options';

// Extract callbacks for testing
const credentialsProvider = authOptions.providers[0] as {
  options: {
    authorize: (credentials: Record<string, string> | undefined) => Promise<unknown>;
  };
};
const authorize = credentialsProvider.options.authorize;

const callbacks = authOptions.callbacks!;

describe('auth-options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogActivity.mockResolvedValue(undefined);
    mockSendSignInNotification.mockResolvedValue(undefined);
    mockPrisma.user.update.mockResolvedValue({});
  });

  describe('authorize callback', () => {
    it('should return null when no identifier provided', async () => {
      const result = await authorize({});
      expect(result).toBeNull();
    });

    it('should return null when credentials are undefined', async () => {
      const result = await authorize(undefined);
      expect(result).toBeNull();
    });

    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: '$2a$10$hashedpassword',
        role: 'user',
        approved: true,
        assignedProjectId: null,
        subscriptionTier: 'free',
        Project_User_assignedProjectIdToProject: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await authorize({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        assignedProjectId: undefined,
        subscriptionTier: 'free',
      });
    });

    it('should find user by username', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: '$2a$10$hashedpassword',
        role: 'user',
        approved: true,
        assignedProjectId: 'proj-1',
        subscriptionTier: 'pro',
        Project_User_assignedProjectIdToProject: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await authorize({
        username: 'testuser',
        password: 'password123',
      });

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        assignedProjectId: 'proj-1',
        subscriptionTier: 'pro',
      });
    });

    it('should return null when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await authorize({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(result).toBeNull();
    });

    it('should throw error when user is not approved', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: '$2a$10$hashedpassword',
        role: 'user',
        approved: false,
        assignedProjectId: null,
        subscriptionTier: 'free',
        Project_User_assignedProjectIdToProject: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        authorize({ email: 'test@example.com', password: 'password123' })
      ).rejects.toThrow('Your account is pending approval');
    });

    it('should allow admin login even when not approved', async () => {
      const mockUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        username: 'admin',
        password: '$2a$10$hashedpassword',
        role: 'admin',
        approved: false, // Not approved but admin
        assignedProjectId: null,
        subscriptionTier: 'enterprise',
        Project_User_assignedProjectIdToProject: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await authorize({
        email: 'admin@example.com',
        password: 'password123',
      });

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('role', 'admin');
    });

    it('should allow guest login without password', async () => {
      const mockUser = {
        id: 'guest-1',
        email: null,
        username: 'guest-user',
        password: null, // No password
        role: 'guest',
        approved: true,
        assignedProjectId: 'proj-1',
        subscriptionTier: null,
        Project_User_assignedProjectIdToProject: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await authorize({
        username: 'guest-user',
        password: '',
      });

      expect(result).toEqual({
        id: 'guest-1',
        email: '',
        username: 'guest-user',
        role: 'guest',
        assignedProjectId: 'proj-1',
        subscriptionTier: null,
      });
    });

    it('should return null if guest tries to login with password', async () => {
      const mockUser = {
        id: 'guest-1',
        email: null,
        username: 'guest-user',
        password: null, // No password
        role: 'guest',
        approved: true,
        assignedProjectId: 'proj-1',
        subscriptionTier: null,
        Project_User_assignedProjectIdToProject: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await authorize({
        username: 'guest-user',
        password: 'somepassword', // Password provided but user has none
      });

      expect(result).toBeNull();
    });

    it('should return null if password-protected user provides no password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: '$2a$10$hashedpassword',
        role: 'user',
        approved: true,
        assignedProjectId: null,
        subscriptionTier: 'free',
        Project_User_assignedProjectIdToProject: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await authorize({
        email: 'test@example.com',
        password: '',
      });

      expect(result).toBeNull();
    });

    it('should return null on invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: '$2a$10$hashedpassword',
        role: 'user',
        approved: true,
        assignedProjectId: null,
        subscriptionTier: 'free',
        Project_User_assignedProjectIdToProject: null,
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await authorize({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      expect(result).toBeNull();
    });

    it('should use case-insensitive lookup', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await authorize({
        email: 'TEST@EXAMPLE.COM',
        password: 'password123',
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { equals: 'TEST@EXAMPLE.COM', mode: 'insensitive' } },
            { email: { equals: 'TEST@EXAMPLE.COM', mode: 'insensitive' } },
          ],
        },
        include: {
          Project_User_assignedProjectIdToProject: true,
        },
      });
    });
  });

  describe('redirect callback', () => {
    const baseUrl = 'http://localhost:3000';

    it('should return dashboard URL when no url provided', async () => {
      const result = await callbacks.redirect!({ url: '', baseUrl });
      expect(result).toBe('http://localhost:3000/dashboard');
    });

    it('should prepend baseUrl to relative URLs', async () => {
      const result = await callbacks.redirect!({ url: '/projects', baseUrl });
      expect(result).toBe('http://localhost:3000/projects');
    });

    it('should allow same-origin URLs', async () => {
      const result = await callbacks.redirect!({
        url: 'http://localhost:3000/custom-page',
        baseUrl,
      });
      expect(result).toBe('http://localhost:3000/custom-page');
    });

    it('should redirect external URLs to dashboard', async () => {
      const result = await callbacks.redirect!({
        url: 'https://evil-site.com/malicious',
        baseUrl,
      });
      expect(result).toBe('http://localhost:3000/dashboard');
    });

    it('should handle invalid URLs gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await callbacks.redirect!({
        url: 'not-a-valid-url',
        baseUrl,
      });

      expect(result).toBe('http://localhost:3000/dashboard');
      consoleSpy.mockRestore();
    });
  });

  describe('jwt callback', () => {
    it('should populate token with user data on initial login', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
        assignedProjectId: 'proj-1',
        subscriptionTier: 'pro',
      };

      const token = await callbacks.jwt!({
        token: {} as any,
        user,
        trigger: 'signIn',
        account: null,
        session: undefined,
      } as any);

      expect(token.id).toBe('user-1');
      expect(token.username).toBe('testuser');
      expect(token.role).toBe('user');
      expect(token.Project_User_assignedProjectIdToProjectId).toBe('proj-1');
      expect(token.subscriptionTier).toBe('pro');
      expect(token.loginLogged).toBe(true);
    });

    it('should set loginLogged flag to prevent repeated DB calls', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      };

      // First call
      const token1 = await callbacks.jwt!({
        token: {} as any,
        user,
        trigger: 'signIn',
        account: null,
        session: undefined,
      } as any);

      expect(token1.loginLogged).toBe(true);

      // Second call (token refresh) - user is undefined, token is passed
      const token2 = await callbacks.jwt!({
        token: { ...token1 } as any,
        user: undefined,
        trigger: 'update',
        account: null,
        session: undefined,
      } as any);

      // loginLogged should still be true (preserved from token)
      expect(token2.loginLogged).toBe(true);
    });

    it('should return token unchanged when no user provided', async () => {
      const existingToken = {
        id: 'user-1',
        username: 'testuser',
        role: 'user',
        loginLogged: true,
      };

      const token = await callbacks.jwt!({
        token: existingToken as any,
        user: undefined,
        trigger: 'update',
        account: null,
        session: undefined,
      } as any);

      expect(token).toEqual(existingToken);
    });

    it('should trigger background operations on initial login', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      };

      await callbacks.jwt!({
        token: {} as any,
        user,
        trigger: 'signIn',
        account: null,
        session: undefined,
      } as any);

      // Give promises time to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(mockLogActivity).toHaveBeenCalledWith({
        userId: 'user-1',
        action: 'user_login',
        resource: 'auth',
        details: {
          username: 'testuser',
          role: 'user',
        },
      });
      expect(mockSendSignInNotification).toHaveBeenCalled();
    });

    it('should handle background operation failures gracefully', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('DB error'));
      mockLogActivity.mockRejectedValue(new Error('Log error'));
      mockSendSignInNotification.mockRejectedValue(new Error('Email error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const user = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      };

      // Should not throw
      const token = await callbacks.jwt!({
        token: {} as any,
        user,
        trigger: 'signIn',
        account: null,
        session: undefined,
      } as any);

      expect(token.id).toBe('user-1');

      // Give promises time to reject
      await new Promise((resolve) => setTimeout(resolve, 10));

      consoleSpy.mockRestore();
    });
  });

  describe('session callback', () => {
    it('should populate session with token data', async () => {
      const token = {
        id: 'user-1',
        username: 'testuser',
        role: 'admin',
        Project_User_assignedProjectIdToProjectId: 'proj-1',
        subscriptionTier: 'enterprise',
      };

      const session = {
        user: {
          id: '',
          username: '',
          role: '',
          name: 'Test User',
          email: 'test@example.com',
          image: null,
        },
        expires: '2025-01-01',
      };

      const result = await callbacks.session!({
        session: session as any,
        token: token as any,
        user: undefined as any,
        trigger: 'update',
        newSession: undefined,
      } as any);

      expect((result.user as any).id).toBe('user-1');
      expect((result.user as any).username).toBe('testuser');
      expect((result.user as any).role).toBe('admin');
      expect((result.user as any).assignedProjectId).toBe('proj-1');
      expect((result.user as any).subscriptionTier).toBe('enterprise');
    });

    it('should handle missing token gracefully', async () => {
      const session = {
        user: {
          id: '',
          username: '',
          role: '',
          name: 'Test User',
          email: 'test@example.com',
        },
        expires: '2025-01-01',
      };

      const result = await callbacks.session!({
        session: session as any,
        token: undefined as any,
        user: undefined as any,
        trigger: 'update',
        newSession: undefined,
      } as any);

      // Should return session unchanged when no token
      expect(result).toBeDefined();
    });
  });

  describe('signIn callback', () => {
    it('should always return true', async () => {
      const result = await callbacks.signIn!({
        user: { id: 'user-1' } as any,
        account: null,
        profile: undefined,
        email: undefined,
        credentials: undefined,
      } as any);

      expect(result).toBe(true);
    });
  });

  describe('authOptions configuration', () => {
    it('should use JWT session strategy', () => {
      expect(authOptions.session?.strategy).toBe('jwt');
    });

    it('should have 30 day session max age', () => {
      expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60);
    });

    it('should have correct sign-in page', () => {
      expect(authOptions.pages?.signIn).toBe('/login');
    });

    it('should have correct sign-out page', () => {
      expect(authOptions.pages?.signOut).toBe('/signout');
    });

    it('should redirect errors to login page', () => {
      expect(authOptions.pages?.error).toBe('/login');
    });
  });
});
