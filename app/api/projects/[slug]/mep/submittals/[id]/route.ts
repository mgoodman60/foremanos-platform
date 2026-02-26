/**
 * Individual MEP Submittal API
 * GET: Fetch single submittal
 * PATCH: Update submittal (including review)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS');

export async function GET(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const submittal = await prisma.mEPSubmittal.findUnique({
      where: { id: params.id },
      include: {
        system: true,
        equipment: true,
        createdByUser: {
          select: { username: true }
        }
      }
    });

    if (!submittal) {
      return NextResponse.json({ error: 'Submittal not found' }, { status: 404 });
    }

    return NextResponse.json({ submittal });
  } catch (error) {
    logger.error('[MEP Submittal GET Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch submittal' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ slug: string; id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      status,
      reviewComments,
      stampStatus,
      responseDocIds,
      resubmitDue,
      submittedDate,
      // Other fields
      title,
      specSection,
      dueDate,
      documentIds,
    } = body;

    // Build update data
    const updateData: any = {};
    
    if (title) updateData.title = title;
    if (specSection !== undefined) updateData.specSection = specSection;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (documentIds) updateData.documentIds = documentIds;
    
    // Review updates
    if (status) {
      updateData.status = status;
      
      if (status === 'SUBMITTED') {
        updateData.submittedDate = submittedDate ? new Date(submittedDate) : new Date();
      }
      
      if (['APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED'].includes(status)) {
        updateData.reviewedDate = new Date();
        updateData.reviewer = session.user.id;
        
        // Get reviewer name
        const reviewer = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { username: true }
        });
        updateData.reviewerName = reviewer?.username;
      }
      
      if (['APPROVED', 'APPROVED_AS_NOTED'].includes(status)) {
        updateData.approvedDate = new Date();
      }
    }
    
    if (reviewComments !== undefined) updateData.reviewComments = reviewComments;
    if (stampStatus !== undefined) updateData.stampStatus = stampStatus;
    if (responseDocIds) updateData.responseDocIds = responseDocIds;
    if (resubmitDue) updateData.resubmitDue = new Date(resubmitDue);

    const submittal = await prisma.mEPSubmittal.update({
      where: { id: params.id },
      data: updateData,
      include: {
        system: { select: { systemNumber: true, name: true } },
        equipment: { select: { equipmentTag: true, name: true } },
      }
    });

    return NextResponse.json({ submittal });
  } catch (error) {
    logger.error('[MEP Submittal PATCH Error]', error);
    return NextResponse.json(
      { error: 'Failed to update submittal' },
      { status: 500 }
    );
  }
}
