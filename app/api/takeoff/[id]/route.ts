import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/takeoff/[id] - Get a specific material takeoff with line items
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get takeoff with all related data
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        Document: {
          select: {
            id: true,
            name: true,
            fileName: true,
            fileType: true
          }
        },
        TakeoffLineItem: {
          orderBy: { createdAt: 'asc' }
        },
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

    // Verify user has access to the project
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

    // Calculate summary statistics
    const summary = {
      totalItems: takeoff.TakeoffLineItem.length,
      totalCost: takeoff.TakeoffLineItem.reduce((sum: number, item: any) => sum + (item.totalCost || 0), 0),
      categories: [...new Set(takeoff.TakeoffLineItem.map((item: any) => item.category))],
      locationCount: new Set(takeoff.TakeoffLineItem.filter((item: any) => item.location).map((item: any) => item.location)).size,
      verifiedItems: takeoff.TakeoffLineItem.filter((item: any) => item.verified).length,
      unverifiedItems: takeoff.TakeoffLineItem.filter((item: any) => !item.verified).length
    };

    // Normalize property names for frontend
    const normalizedTakeoff = {
      ...takeoff,
      creator: takeoff.User,
      document: takeoff.Document,
      lineItems: takeoff.TakeoffLineItem,
      project: takeoff.Project,
      _count: {
        lineItems: takeoff.TakeoffLineItem.length
      },
      summary
    };

    return NextResponse.json({ takeoff: normalizedTakeoff, project: takeoff.Project });
  } catch (error: any) {
    console.error('Error fetching takeoff:', error);
    return NextResponse.json(
      { error: 'Failed to fetch takeoff', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/takeoff/[id] - Update a material takeoff
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, status, documentId } = body;

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

    // Update takeoff
    const updated = await prisma.materialTakeoff.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        status: status || undefined,
        documentId: documentId !== undefined ? documentId : undefined
      },
      include: {
        User: {
          select: {
            id: true,
            email: true,
            username: true
          }
        },
        Document: {
          select: {
            id: true,
            name: true,
            fileName: true
          }
        },
        TakeoffLineItem: true
      }
    });

    // Normalize property names for frontend
    const normalizedTakeoff = {
      ...updated,
      creator: updated.User,
      document: updated.Document,
      lineItems: updated.TakeoffLineItem,
      _count: {
        lineItems: updated.TakeoffLineItem.length
      }
    };

    return NextResponse.json({ takeoff: normalizedTakeoff });
  } catch (error: any) {
    console.error('Error updating takeoff:', error);
    return NextResponse.json(
      { error: 'Failed to update takeoff', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/takeoff/[id] - Delete a material takeoff
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

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

    // Verify user has access (owner or admin only)
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = takeoff.Project.ownerId === user.id;
    const isCreator = takeoff.createdBy === user.id;

    if (!isOwner && !isCreator && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied - only owner or creator can delete' }, { status: 403 });
    }

    // Delete takeoff (cascade will delete line items)
    await prisma.materialTakeoff.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Takeoff deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting takeoff:', error);
    return NextResponse.json(
      { error: 'Failed to delete takeoff', details: error.message },
      { status: 500 }
    );
  }
}
