import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  extractDailyReportData,
  processTemplateById,
  getTemplatesForType,
} from '@/lib/template-processor';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_EXPORT_WITH_TEMPLATE');

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/[id]/export-with-template
 * Get available templates for this conversation type
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        userId: true,
        conversationType: true,
        projectId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get templates for this type
    const templates = await getTemplatesForType(
      conversation.projectId,
      conversation.conversationType
    );

    return NextResponse.json({ templates });
  } catch (error) {
    logger.error('Error fetching templates', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations/[id]/export-with-template
 * Export conversation using a template
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: {
        userId: true,
        conversationType: true,
        projectId: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Extract data based on conversation type
    let templateData: any;

    switch (conversation.conversationType) {
      case 'daily_report':
        templateData = await extractDailyReportData(id);
        break;

      // Add more cases for other types
      case 'schedule':
      case 'budget':
      case 'rfi':
      default:
        return NextResponse.json(
          { error: `Template export not yet supported for type: ${conversation.conversationType}` },
          { status: 400 }
        );
    }

    // Process template with data
    const { buffer, filename, contentType } = await processTemplateById(
      templateId,
      templateData
    );

    // Return the processed document
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    logger.error('Error exporting with template', error);
    return NextResponse.json(
      {
        error: 'Failed to export with template',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
