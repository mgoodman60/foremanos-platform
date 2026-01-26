import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { detectMEPConflicts, type EnhancedChunk } from '@/lib/rag-enhancements';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { chunks, projectSlug } = body as {
      chunks: EnhancedChunk[];
      projectSlug: string;
    };

    if (!chunks || !Array.isArray(chunks) || !projectSlug) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Detect MEP conflicts
    const conflicts = await detectMEPConflicts(chunks, projectSlug);

    return NextResponse.json({ conflicts });
  } catch (error) {
    console.error('Error detecting MEP conflicts:', error);
    return NextResponse.json(
      { error: 'Failed to detect conflicts' },
      { status: 500 }
    );
  }
}
