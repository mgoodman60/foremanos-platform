import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';

const PUBLIC_API_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/webhooks\//,
  /^\/api\/cron\//,
  /^\/api\/documents\/presigned-url/,
];

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PATTERNS.some(pattern => pattern.test(pathname));
}

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    // Public API routes bypass auth (they have their own auth: CRON_SECRET, webhook signatures, etc.)
    if (isPublicApiRoute(req.nextUrl.pathname)) {
      return NextResponse.next();
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Public API routes are always "authorized" at middleware level
        if (isPublicApiRoute(req.nextUrl.pathname)) {
          return true;
        }
        // All other routes require a valid session token
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/project/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/chat/:path*',
    '/chat',
    '/api/:path*',
  ],
};
