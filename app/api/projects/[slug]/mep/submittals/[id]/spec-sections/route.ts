/**
 * Spec Sections API for Submittals
 * GET - Fetch spec sections for a submittal
 * PUT - Update submittal spec section
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  getSubmittalSpecSections,
  findDocumentsForSpecSection,
  updateSubmittalSpecSection,
} from '@/lib/spec-section-service';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submittal = await prisma.mEPSubmittal.findUnique({
      where: { id: params.id },
      select: { id: true, projectId: true, specSection: true },
    });

    if (!submittal) {
      return NextResponse.json({ error: 'Submittal not found' }, { status: 404 });
    }

    // Get all related spec sections
    const specSections = await getSubmittalSpecSections(params.id);

    // Find linked documents for main spec section
    let linkedDocuments: { id: string; name: string; pages: number[] }[] = [];
    if (submittal.specSection) {
      linkedDocuments = await findDocumentsForSpecSection(
        submittal.projectId,
        submittal.specSection
      );
    }

    return NextResponse.json({
      specSections,
      linkedDocuments,
      currentSpecSection: submittal.specSection,
    });
  } catch (error) {
    console.error('Error fetching spec sections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spec sections' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { specSection } = body;

    const success = await updateSubmittalSpecSection(params.id, specSection);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update spec section' },
        { status: 500 }
      );
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: 'SPEC_SECTION_UPDATED',
        resource: 'submittal',
        resourceId: params.id,
        userId: session.user.id,
        details: {
          specSection,
        },
      },
    });

    return NextResponse.json({ success: true, specSection });
  } catch (error) {
    console.error('Error updating spec section:', error);
    return NextResponse.json(
      { error: 'Failed to update spec section' },
      { status: 500 }
    );
  }
}
