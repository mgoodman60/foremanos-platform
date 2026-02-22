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
    const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

    // Forward request ID to API routes via request headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-request-id', requestId);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // Also set on response for clients/monitoring
    response.headers.set('x-request-id', requestId);
    return response;
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
