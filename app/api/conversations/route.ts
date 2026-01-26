import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/retry-util';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await withDatabaseRetry(
      () => getServerSession(authOptions),
      'Get server session (conversations)'
    );
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    const conversations = await withDatabaseRetry(
      () => prisma.conversation.findMany({
        where: {
          userId: session.user.id,
          ...(projectId && { projectId }),
        },
        include: {
          _count: {
            select: { ChatMessage: true },
          },
          Project: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      'Fetch conversations'
    );

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error('[API] Error fetching conversations:', error);
    
    // Return more specific error messages
    if (error?.code?.startsWith('P1')) {
      return NextResponse.json({ 
        error: 'Database connection error. Please try again.' 
      }, { status: 503 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
