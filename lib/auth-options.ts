import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './db';
import { logActivity } from './audit-log';
import { sendSignInNotification } from './email-service';
import bcrypt from 'bcryptjs';
import { logger } from './logger';

export const authOptions: NextAuthOptions = {
  // No adapter needed for JWT-only sessions (reduces DB load by 90%)
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Accept either username or email field
        const identifier = credentials?.username || credentials?.email;
        
        if (!identifier) {
          return null;
        }

        // Find user by username or email (case-insensitive)
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: identifier, mode: 'insensitive' } },
              { email: { equals: identifier, mode: 'insensitive' } },
            ],
          },
          include: {
            Project_User_assignedProjectIdToProject: true,
          },
        });

        // Fallback: try namespaced PIN lookup (user types "Job123", stored as "{ownerId}_Job123")
        if (!user) {
          const namespacedUsers = await prisma.user.findMany({
            where: { username: { endsWith: `_${identifier}` } },
            include: {
              Project_User_assignedProjectIdToProject: true,
            },
          });
          if (namespacedUsers.length === 1) {
            user = namespacedUsers[0];
          }
          // If 0 or 2+ matches, user stays null (handled below)
        }

        if (!user) {
          return null;
        }

        // Check if user is approved (admin always approved by default)
        if (!user.approved && user.role !== 'admin') {
          throw new Error('Your account is pending approval');
        }

        // Password-less login is ONLY allowed for explicit guest accounts
        // Security: Requires both null password AND guest role to prevent
        // accidental access if a non-guest user's password is cleared
        if (!user.password) {
          if (user.role !== 'guest') {
            // Non-guest users must have a password - reject login
            return null;
          }
          // Guest account: allow login without password
          if (!credentials.password || credentials.password === '') {
            return {
              id: user.id,
              email: user.email || '',
              username: user.username,
              role: user.role,
              assignedProjectId: user.assignedProjectId || undefined,
              subscriptionTier: user.subscriptionTier,
            };
          } else {
            // Password provided but guest user has no password set
            return null;
          }
        }

        // For accounts with passwords, validate it
        if (!credentials.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email || '',
          username: user.username,
          role: user.role,
          assignedProjectId: user.assignedProjectId || undefined,
          subscriptionTier: user.subscriptionTier,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    // JWT strategy allows multiple concurrent sessions for the same user
    // No session limit - users can be logged in from multiple devices/browsers simultaneously
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,     // Update session every 24 hours
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    signOut: '/signout',
    error: '/login', // Redirect errors back to login page
  },
  callbacks: {
    async signIn({ user: __user }) {
      // Always allow sign in - we handle approval checks in authorize()
      return true;
    },
    async redirect({ url, baseUrl }) {
      // Enhanced redirect logic with comprehensive handling
      try {
        // Default to dashboard
        const defaultUrl = `${baseUrl}/dashboard`;
        
        // If url is not provided or empty, use default
        if (!url) {
          return defaultUrl;
        }
        
        // If url is relative, prepend baseUrl
        if (url.startsWith('/')) {
          return `${baseUrl}${url}`;
        }
        
        // If url is from same origin, allow it
        try {
          const urlObj = new URL(url);
          if (urlObj.origin === baseUrl) {
            return url;
          }
        } catch (e) {
          // Invalid URL, fall through to default
          logger.warn('AUTH', 'Invalid URL in redirect', { url });
        }
        
        // For any other case (external URLs, etc.), redirect to dashboard
        return defaultUrl;
      } catch (error) {
        logger.error('AUTH', 'Redirect error', error as Error);
        // Fallback to a safe default
        return `${baseUrl}/dashboard`;
      }
    },
    async jwt({ token, user, trigger: __trigger }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.Project_User_assignedProjectIdToProjectId = user.assignedProjectId;
        token.subscriptionTier = user.subscriptionTier;
        
        // CRITICAL FIX: Only run database operations on INITIAL login (when user object is present)
        // This prevents connection pool exhaustion from JWT refreshes
        // Mark that we've logged this session
        if (!token.loginLogged) {
          token.loginLogged = true;
          
          // Run all database operations in the background (non-blocking)
          // This prevents the JWT callback from being delayed by slow DB operations
          // Using void to explicitly mark as fire-and-forget pattern
          void Promise.all([
            prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            }).catch((error: unknown) => {
              logger.error('AUTH', 'Error updating lastLoginAt', error as Error);
              return null; // Return value to ensure Promise.all doesn't reject
            }),

            logActivity({
              userId: user.id,
              action: 'user_login',
              resource: 'auth',
              details: {
                username: user.username,
                role: user.role,
              },
            }).catch((error: unknown) => {
              logger.error('AUTH', 'Error logging activity', error as Error);
              return null;
            }),

            sendSignInNotification(
              user.email || user.username,
              user.username,
              'N/A', // IP address not available in JWT callback
              'N/A'  // User agent not available in JWT callback
            ).catch((error: unknown) => {
              logger.error('AUTH', 'Error sending sign-in notification', error as Error);
              return null;
            }),
          ]).catch((error: unknown) => {
            // This should never fire if individual catches return values,
            // but log if it does for debugging unexpected errors
            logger.error('AUTH', 'Unexpected Promise.all error', error as Error);
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.role = token.role as string;
        session.user.assignedProjectId = token.Project_User_assignedProjectIdToProjectId as string | undefined;
        session.user.subscriptionTier = token.subscriptionTier as string | undefined;
      }
      return session;
    },
  },
};
