import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl } from '@/lib/s3';
import sizeOf from 'image-size';

// POST /api/projects/[slug]/upload-floor-plan - Upload floor plan image
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify admin/client access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isAdmin = user.role === 'admin' || user.role === 'client';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const isPublic = formData.get('isPublic') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG, JPG, and PDF are allowed' },
        { status: 400 }
      );
    }

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Get image dimensions (if not PDF)
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;

    if (file.type.startsWith('image/')) {
      try {
        const dimensions = sizeOf(buffer);
        imageWidth = dimensions.width || null;
        imageHeight = dimensions.height || null;
      } catch (error) {
        console.error('Error getting image dimensions:', error);
      }
    }

    // Generate S3 presigned URL
    const fileName = `floor-plans/${project.id}/${Date.now()}-${file.name}`;
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      fileName,
      file.type,
      isPublic
    );

    // Upload to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: buffer,
      headers: {
        'Content-Type': file.type
      }
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload to S3');
    }

    return NextResponse.json({
      cloud_storage_path,
      imageWidth,
      imageHeight
    });
  } catch (error) {
    console.error('Error uploading floor plan:', error);
    return NextResponse.json(
      { error: 'Failed to upload floor plan' },
      { status: 500 }
    );
  }
}