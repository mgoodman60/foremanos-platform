import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { prisma } from './lib/db';
import { logActivity } from './lib/audit-log';
import { sendSignInNotification } from './lib/email-service';
import { isTokenRevoked } from './lib/jwt-revocation';
import bcrypt from 'bcryptjs';
import { logger } from './lib/logger';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Accept either username or email field
        const identifier = (credentials?.username || credentials?.email) as string | undefined;

        if (!identifier || typeof identifier !== 'string') {
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
        }

        if (!user) {
          return null;
        }

        // Check if user is approved (admin always approved by default)
        if (!user.approved && user.role !== 'admin') {
          throw new Error('Your account is pending approval');
        }

        const password = credentials.password as string | undefined;

        // Password-less login is ONLY allowed for explicit guest accounts
        if (!user.password) {
          if (user.role !== 'guest') {
            return null;
          }
          if (!password || password === '') {
            return {
              id: user.id,
              email: user.email || '',
              username: user.username,
              role: user.role,
              assignedProjectId: user.assignedProjectId || undefined,
              subscriptionTier: user.subscriptionTier,
            };
          } else {
            return null;
          }
        }

        if (!password || typeof password !== 'string') {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          password,
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
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // On subsequent requests, check if token is revoked
      if (!user && token.sub && token.iat) {
        const revoked = await isTokenRevoked(token.sub, token.iat as number);
        if (revoked) {
          logger.info('AUTH', 'Token revoked, forcing re-authentication', { userId: token.sub });
          return { ...token, revoked: true };
        }
      }

      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role;
        token.Project_User_assignedProjectIdToProjectId = (user as any).assignedProjectId;
        token.subscriptionTier = (user as any).subscriptionTier;

        // CRITICAL FIX: Only run database operations on INITIAL login
        // This prevents connection pool exhaustion from JWT refreshes
        if (!token.loginLogged) {
          token.loginLogged = true;

          // Run all database operations in the background (non-blocking)
          void Promise.all([
            prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            }).catch((error: unknown) => {
              logger.error('AUTH', 'Error updating lastLoginAt', error as Error);
              return null;
            }),

            logActivity({
              userId: user.id,
              action: 'user_login',
              resource: 'auth',
              details: {
                username: (user as any).username,
                role: (user as any).role,
              },
            }).catch((error: unknown) => {
              logger.error('AUTH', 'Error logging activity', error as Error);
              return null;
            }),

            sendSignInNotification(
              user.email || (user as any).username,
              (user as any).username,
              'N/A',
              'N/A'
            ).catch((error: unknown) => {
              logger.error('AUTH', 'Error sending sign-in notification', error as Error);
              return null;
            }),
          ]).catch((error: unknown) => {
            logger.error('AUTH', 'Unexpected Promise.all error', error as Error);
          });
        }
      }
      return token;
    },
    async session({ session, token }) {
      if ((token as any)?.revoked) {
        return { ...session, user: undefined } as any;
      }
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
});
