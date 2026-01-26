import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { resumeFailedProcessing } from '@/lib/document-processing-queue';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const documentId = params.id;

    // Verify document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, name: true },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Resume processing
    await resumeFailedProcessing(documentId);

    return NextResponse.json({
      success: true,
      message: `Processing resumed for ${document.name}`,
    });
  } catch (error: any) {
    console.error('[RESUME PROCESSING] Error:', error);
    return NextResponse.json(
      { error: 'Failed to resume processing' },
      { status: 500 }
    );
  }
}
