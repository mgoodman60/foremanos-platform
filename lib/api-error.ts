/**
 * Standardized API Error Response Utility
 * Provides consistent error formatting across all API routes
 */

import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export function apiError(message: string, status: number, code?: ApiErrorCode) {
  return NextResponse.json(
    { error: message, code: code || 'UNKNOWN_ERROR' },
    { status }
  );
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Returns a safe error message string — detailed in development, generic in production.
 * Use this instead of returning raw `error.message` to API clients.
 */
export function safeErrorMessage(error: unknown, fallback = 'Internal server error'): string {
  if (process.env.NODE_ENV === 'development') {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
  }
  return fallback;
}
