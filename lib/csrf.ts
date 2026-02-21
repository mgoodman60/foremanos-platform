import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Validate that the CSRF token in the request header matches the cookie.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const cookieBuf = Buffer.from(cookieToken, 'utf8');
    const headerBuf = Buffer.from(headerToken, 'utf8');

    if (cookieBuf.length !== headerBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(cookieBuf, headerBuf);
  } catch {
    return false;
  }
}

/**
 * Set the CSRF cookie on a response. Returns the token value so it can
 * be sent to the client in the response body or a custom header.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

type RouteHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse>;

/**
 * Wrap an API route handler with CSRF validation.
 * - GET/HEAD/OPTIONS requests are passed through (read-only).
 * - POST/PUT/PATCH/DELETE requests must include a valid CSRF token.
 */
export function withCsrf(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    const method = request.method.toUpperCase();

    // Safe methods — skip validation
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return handler(request, context);
    }

    // Mutation methods — validate CSRF token
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        { error: 'Invalid or missing CSRF token' },
        { status: 403 }
      );
    }

    return handler(request, context);
  };
}
