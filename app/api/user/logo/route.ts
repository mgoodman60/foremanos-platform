import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl, deleteFile } from '@/lib/s3';

// GET - Retrieve current logo info
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email },
      select: {
        companyLogo: true,
        companyLogoUploadedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      companyLogo: user.companyLogo,
      companyLogoUploadedAt: user.companyLogoUploadedAt,
    });
  } catch (error) {
    console.error('Error fetching logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Get presigned URL for logo upload
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { fileName, contentType } = body;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'Missing fileName or contentType' },
        { status: 400 }
      );
    }

    // Validate file type (images only)
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    // Generate presigned URL for public upload (logos should be publicly accessible)
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      fileName,
      contentType,
      true // isPublic
    );

    return NextResponse.json({
      uploadUrl,
      cloud_storage_path,
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Confirm logo upload and update database
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { cloud_storage_path } = body;

    if (!cloud_storage_path) {
      return NextResponse.json(
        { error: 'Missing cloud_storage_path' },
        { status: 400 }
      );
    }

    // Get current user to check for old logo
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user?.email },
      select: { companyLogo: true },
    });

    // Delete old logo if exists
    if (currentUser?.companyLogo) {
      try {
        await deleteFile(currentUser.companyLogo);
      } catch (error) {
        console.error('Error deleting old logo:', error);
        // Continue even if deletion fails
      }
    }

    // Update user with new logo
    const updatedUser = await prisma.user.update({
      where: { email: session.user?.email },
      data: {
        companyLogo: cloud_storage_path,
        companyLogoUploadedAt: new Date(),
      },
      select: {
        companyLogo: true,
        companyLogoUploadedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      companyLogo: updatedUser.companyLogo,
      companyLogoUploadedAt: updatedUser.companyLogoUploadedAt,
    });
  } catch (error) {
    console.error('Error updating logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove company logo
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user?.email },
      select: { companyLogo: true },
    });

    if (!currentUser?.companyLogo) {
      return NextResponse.json(
        { error: 'No logo to delete' },
        { status: 404 }
      );
    }

    // Delete from S3
    try {
      await deleteFile(currentUser.companyLogo);
    } catch (error) {
      console.error('Error deleting logo from S3:', error);
      // Continue to remove from database even if S3 deletion fails
    }

    // Update user to remove logo
    await prisma.user.update({
      where: { email: session.user?.email },
      data: {
        companyLogo: null,
        companyLogoUploadedAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
