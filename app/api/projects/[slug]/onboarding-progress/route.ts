import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[slug]/onboarding-progress
 * Fetch onboarding progress for the current user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get or create onboarding progress
    let progress = await prisma.onboardingProgress.findUnique({
      where: { userId: session.user.id },
    });

    if (!progress) {
      // Create default progress
      progress = await prisma.onboardingProgress.create({
        data: {
          userId: session.user.id,
          projectId: project.id,
          createdProject: true, // They're on the project page, so this is true
          createdProjectAt: new Date(),
        },
      });
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching onboarding progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[slug]/onboarding-progress
 * Update onboarding progress
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;
    const body = await request.json();

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Update data object
    const updateData: any = {};

    // Handle dismissed flag
    if (typeof body.dismissed === 'boolean') {
      updateData.dismissed = body.dismissed;
      if (body.dismissed) {
        updateData.completedAt = new Date();
      }
    }

    // Handle step completions
    const stepFields = [
      'createdProject',
      'uploadedDocuments',
      'processedDocuments',
      'startedFirstChat',
      'finalizedFirstReport',
      'reviewedScheduleUpdates',
    ];

    stepFields.forEach((field) => {
      if (typeof body[field] === 'boolean' && body[field]) {
        updateData[field] = true;
        updateData[`${field}At`] = new Date();
      }
    });

    // Check if all steps are complete
    const allComplete = stepFields.every(
      (field) => body[field] === true || updateData[field] === true
    );
    if (allComplete && !updateData.completedAt) {
      updateData.completedAt = new Date();
    }

    // Upsert progress
    const progress = await prisma.onboardingProgress.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        projectId: project.id,
        ...updateData,
      },
    });

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error updating onboarding progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
