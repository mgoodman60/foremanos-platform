/**
 * Presentation Board Logo Upload API
 * Generate presigned URLs for logo uploads to presentation boards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';
import { generatePresignedUploadUrl } from '@/lib/s3';

const log = createScopedLogger('PRESENTATION_API');

const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const VALID_SLOTS = ['company', 'client', 'partner1', 'partner2'];

function getExtension(contentType: string): string {
  switch (contentType) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/svg+xml': return 'svg';
    default: return 'bin';
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ slug: string; id: string }> }
) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        ownerId: true,
        ProjectMember: { select: { userId: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === session.user.id;
    const isMember = project.ProjectMember.some(
      (m: { userId: string }) => m.userId === session.user.id
    );
    const isAdmin = session.user.role === 'admin';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify the board exists and belongs to this project
    const board = await prisma.presentationBoard.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true },
    });

    if (!board || board.projectId !== project.id) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const body = await request.json();
    const { fileName, contentType, slot } = body;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'fileName and contentType are required' },
        { status: 400 }
      );
    }

    if (!slot || !VALID_SLOTS.includes(slot)) {
      return NextResponse.json(
        { error: 'Invalid slot. Must be one of: ' + VALID_SLOTS.join(', ') },
        { status: 400 }
      );
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type. Only PNG, JPEG, and SVG are allowed.' },
        { status: 400 }
      );
    }

    const ext = getExtension(contentType);
    const key = `presentation-logos/${project.id}/${params.id}/${slot}-${Date.now()}.${ext}`;

    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      key,
      contentType
    );

    log.info('Presigned URL generated for logo upload', { boardId: params.id, slot });

    return NextResponse.json({ uploadUrl, key: cloud_storage_path });
  } catch (error) {
    log.error('Failed to generate logo upload URL', error as Error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
