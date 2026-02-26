import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { suggestDocumentCategory } from '@/lib/document-categorizer';

import { createLogger } from '@/lib/logger';
const logger = createLogger('DOCUMENTS_SUGGEST_CATEGORY');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, fileType, contentPreview } = body;

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: 'fileName and fileType are required' },
        { status: 400 }
      );
    }

    // Get AI suggestion
    const suggestion = await suggestDocumentCategory(
      fileName,
      fileType,
      contentPreview
    );

    return NextResponse.json({
      suggestedCategory: suggestion.suggestedCategory,
      confidence: suggestion.confidence,
      reasoning: suggestion.reasoning,
    });
  } catch (error: unknown) {
    logger.error('[CATEGORY SUGGESTION ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to suggest category' },
      { status: 500 }
    );
  }
}
