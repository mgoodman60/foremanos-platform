import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PUBLIC_API_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/webhooks\//,
  /^\/api\/cron\//,
  /^\/api\/documents\/presigned-url/,
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public API routes bypass auth
  if (PUBLIC_API_PATTERNS.some(p => p.test(pathname))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    // For API routes, return 401 instead of redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Request ID injection (preserved from v4)
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  return response;
});

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
