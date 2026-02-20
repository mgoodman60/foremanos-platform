import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl, deleteFile } from '@/lib/s3';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[slug]/logo
 * Get current project logo URL
 */
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        logoUrl: true,
        logoUploadedAt: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      logoUrl: project.logoUrl,
      logoUploadedAt: project.logoUploadedAt,
    });
  } catch (error) {
    console.error('Error fetching project logo:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logo' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[slug]/logo
 * Generate presigned URL for logo upload
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

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the project with member info
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

    // Check if user is admin or project owner
    const isOwner = project.ownerId === user.id;
    const isAdmin = project.ProjectMember[0]?.role === 'admin';

    if (!isOwner && !isAdmin && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only project owners and admins can upload logos' },
        { status: 403 }
      );
    }

    const { fileName, contentType } = await request.json();

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'Missing fileName or contentType' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, and SVG are allowed.' },
        { status: 400 }
      );
    }

    // Generate presigned URL for public upload
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      `project-logos/${project.id}/${fileName}`,
      contentType,
      true // Public logo
    );

    return NextResponse.json({ uploadUrl, cloud_storage_path });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[slug]/logo
 * Remove project logo
 * Only Project Owner or Admin can delete logo
 */
export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        logoUrl: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user is admin or project owner
    const isOwner = project.ownerId === user.id;

    if (!isOwner && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only project owners and admins can delete logos' },
        { status: 403 }
      );
    }

    // Delete old logo from S3 if exists
    if (project.logoUrl) {
      try {
        await deleteFile(project.logoUrl);
      } catch (error) {
        console.error('Error deleting old logo from S3:', error);
        // Continue even if S3 deletion fails
      }
    }

    // Update project record
    await prisma.project.update({
      where: { id: project.id },
      data: {
        logoUrl: null,
        logoUploadedBy: null,
        logoUploadedAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting logo:', error);
    return NextResponse.json(
      { error: 'Failed to delete logo' },
      { status: 500 }
    );
  }
}
