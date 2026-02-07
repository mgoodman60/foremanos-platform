import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { validateS3Config } from '@/lib/aws-config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[slug]/logo/presigned
 * Generate presigned URL for uploading project logo
 * Only Project Owner or Admin can upload logo
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const s3Check = validateS3Config();
    if (!s3Check.valid) {
      return NextResponse.json(
        { error: 'File storage is not configured. Please contact your administrator.' },
        { status: 503 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        ownerId: true,
        ProjectMember: {
          where: { userId: user.id },
          select: { role: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check permissions: Only Project Owner or Admin can upload logo
    const isOwner = project.ownerId === user.id;
    const isAdmin = user.role === 'admin';
    const isProjectAdmin = project.ProjectMember.some(
      (member: any) => member.role === 'owner'
    );

    if (!isOwner && !isAdmin && !isProjectAdmin) {
      return NextResponse.json(
        { error: 'Only project owners and admins can upload project logos' },
        { status: 403 }
      );
    }

    // Parse request body
    const { fileName, contentType } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'fileName and contentType are required' },
        { status: 400 }
      );
    }

    // Validate file type (only images allowed)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
      return NextResponse.json(
        { error: 'Only image files (PNG, JPEG, GIF, WebP) are allowed for logos' },
        { status: 400 }
      );
    }

    // Generate presigned URL for public upload (logo should be public)
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      fileName,
      contentType,
      true // isPublic = true for logos
    );

    return NextResponse.json({
      uploadUrl,
      cloud_storage_path,
    });
  } catch (error: any) {
    console.error('[LOGO_PRESIGNED_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
