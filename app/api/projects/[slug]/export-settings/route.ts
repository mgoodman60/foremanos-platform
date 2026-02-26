import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXPORT_SETTINGS');

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    const project = await prisma.project.findUnique({
      where: { slug },
      select: { exportSettings: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ settings: project.exportSettings || null });
  } catch (error) {
    logger.error('Error fetching export settings', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { settings } = await req.json();

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { userId: session.user.id },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is owner or member
    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.length > 0;
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update export settings
    await prisma.project.update({
      where: { slug },
      data: { exportSettings: settings },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error saving export settings', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
