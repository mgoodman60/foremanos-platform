import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { checkCompliance, type EnhancedChunk } from '@/lib/rag-enhancements';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { chunks, projectSlug, scope } = body as {
      chunks: EnhancedChunk[];
      projectSlug: string;
      scope?: string[];
    };

    if (!chunks || !Array.isArray(chunks) || !projectSlug) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Check compliance
    const complianceReport = await checkCompliance(chunks, projectSlug, scope);

    return NextResponse.json({ report: complianceReport });
  } catch (error) {
    console.error('Error checking compliance:', error);
    return NextResponse.json(
      { error: 'Failed to check compliance' },
      { status: 500 }
    );
  }
}
