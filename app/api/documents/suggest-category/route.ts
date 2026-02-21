import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { suggestDocumentCategory } from '@/lib/document-categorizer';
import { safeErrorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

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
  } catch (error: any) {
    console.error('[CATEGORY SUGGESTION ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to suggest category' },
      { status: 500 }
    );
  }
}
