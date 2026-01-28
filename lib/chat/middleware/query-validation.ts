import { NextRequest, NextResponse } from 'next/server';
import type { QueryValidationResult } from '@/types/chat';

/**
 * Validate query request body
 * Extracted from app/api/chat/route.ts lines 104-120
 */
export async function validateQuery(request: NextRequest): Promise<QueryValidationResult> {
  try {
    const body = await request.json();
    const { message, image, imageName, conversationId, projectSlug } = body;

    if (!message && !image) {
      return {
        valid: false,
        error: {
          message: 'Message or image is required',
          status: 400,
        },
      };
    }

    if (!projectSlug) {
      return {
        valid: false,
        error: {
          message: 'Project context is required. Please access chat through a project page.',
          status: 400,
        },
      };
    }

    return {
      valid: true,
      body: {
        message,
        image,
        imageName,
        conversationId,
        projectSlug,
      },
    };
  } catch {
    return {
      valid: false,
      error: {
        message: 'Invalid request body',
        status: 400,
      },
    };
  }
}

/**
 * Create validation error response
 */
export function validationErrorResponse(validation: QueryValidationResult): NextResponse {
  return NextResponse.json(
    { error: validation.error?.message || 'Validation failed' },
    { status: validation.error?.status || 400 }
  );
}
