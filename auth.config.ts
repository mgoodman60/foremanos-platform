import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    signOut: '/signout',
    error: '/login',
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },
  callbacks: {
    signIn() {
      return true;
    },
    redirect({ url, baseUrl }) {
      try {
        const defaultUrl = `${baseUrl}/dashboard`;
        if (!url) return defaultUrl;
        if (url.startsWith('/')) return `${baseUrl}${url}`;
        try {
          const urlObj = new URL(url);
          if (urlObj.origin === baseUrl) return url;
        } catch {
          // Invalid URL, fall through
        }
        return defaultUrl;
      } catch {
        return `${baseUrl}/dashboard`;
      }
    },
  },
  providers: [], // Populated in auth.ts
} satisfies NextAuthConfig;
