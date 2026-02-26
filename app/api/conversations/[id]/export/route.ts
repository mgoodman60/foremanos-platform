import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_EXPORT');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        ChatMessage: {
          orderBy: { createdAt: 'asc' },
        },
        Project: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check ownership
    if (conversation.userId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Format conversation as text
    let exportText = `ForemanOS Conversation Export\n`;
    exportText += `Project: ${conversation.Project?.name || 'Unknown'}\n`;
    exportText += `Date: ${new Date(conversation.createdAt).toLocaleString()}\n`;
    exportText += `\n${'='.repeat(80)}\n\n`;

    conversation.ChatMessage.forEach((msg: any) => {
      const timestamp = new Date(msg.createdAt).toLocaleString();
      exportText += `[${timestamp}] ${msg.role.toUpperCase()}:\n${msg.content}\n\n`;
    });

    return new NextResponse(exportText, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="conversation-${params.id}.txt"`,
      },
    });
  } catch (error) {
    logger.error('Error exporting conversation', error);
    return NextResponse.json(
      { error: 'Failed to export conversation' },
      { status: 500 }
    );
  }
}
