// Webhooks API Route
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  getProjectWebhooks,
  saveWebhook,
  deleteWebhook,
  updateWebhook,
  testWebhook,
  getWebhookLogs,
  WebhookEvent
} from '@/lib/webhook-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_WEBHOOKS');

// Get webhooks for a project
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const includeLogs = url.searchParams.get('includeLogs') === 'true';

    const webhooks = await getProjectWebhooks(project.id);
    const response: { webhooks: unknown[]; logs?: unknown[] } = { webhooks };

    if (includeLogs) {
      response.logs = await getWebhookLogs(project.id);
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('[Webhooks API] Error', error);
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

// Create or test webhook
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, url, events, secret, isActive } = body;

    // Test webhook endpoint
    if (action === 'test') {
      const testConfig = {
        id: 'test',
        url,
        events: [] as WebhookEvent[],
        secret,
        isActive: true
      };
      const result = await testWebhook(testConfig);
      return NextResponse.json(result);
    }

    // Create new webhook
    if (!url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'URL and events array required' },
        { status: 400 }
      );
    }

    const webhook = await saveWebhook(project.id, {
      url,
      events: events as WebhookEvent[],
      secret,
      isActive: isActive !== false
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    logger.error('[Webhooks API] Error', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

// Update webhook
export async function PATCH(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { webhookId, ...updates } = await request.json();

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
    }

    const webhook = await updateWebhook(project.id, webhookId, updates);

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ webhook });
  } catch (error) {
    logger.error('[Webhooks API] Error', error);
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

// Delete webhook
export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const webhookId = url.searchParams.get('webhookId');

    if (!webhookId) {
      return NextResponse.json({ error: 'Webhook ID required' }, { status: 400 });
    }

    await deleteWebhook(project.id, webhookId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Webhooks API] Error', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
