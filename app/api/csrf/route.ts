import { NextResponse } from 'next/server';
import { generateCsrfToken, setCsrfCookie } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * GET /api/csrf — Issue a new CSRF token.
 * Sets the token as an HttpOnly cookie and returns it in the response body
 * so the client can attach it to future mutation requests as X-CSRF-Token.
 */
export async function GET() {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  setCsrfCookie(response, token);
  return response;
}
