import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_BULK_VERIFY');

// POST /api/takeoff/[id]/bulk-verify - Bulk verify multiple line items
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { itemIds, verified = true } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds array is required' },
        { status: 400 }
      );
    }

    // Get takeoff with project info
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id },
      include: {
        Project: {
          include: {
            User_Project_ownerIdToUser: true,
            ProjectMember: {
              include: { User: true }
            }
          }
        }
      }
    });

    if (!takeoff) {
      return NextResponse.json({ error: 'Takeoff not found' }, { status: 404 });
    }

    // Verify user has access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = takeoff.Project.ownerId === user.id;
    const isMember = takeoff.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Bulk update the line items
    const result = await prisma.takeoffLineItem.updateMany({
      where: {
        id: { in: itemIds },
        takeoffId: id
      },
      data: {
        verified,
        confidence: verified ? 1.0 : undefined
      }
    });

    return NextResponse.json({
      message: `Successfully ${verified ? 'verified' : 'unverified'} ${result.count} items`,
      count: result.count
    });
  } catch (error: unknown) {
    logger.error('Error bulk verifying line items', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to bulk verify items', details: errMsg },
      { status: 500 }
    );
  }
}
