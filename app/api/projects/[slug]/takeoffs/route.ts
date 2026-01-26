import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/projects/[slug]/takeoffs - List all material takeoffs for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project and verify access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: {
          include: { User: true }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has access (owner or member)
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all material takeoffs for the project
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId: project.id },
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
        TakeoffLineItem: true,
        _count: {
          select: { TakeoffLineItem: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total quantities per category for each takeoff and normalize property names
    const takeoffsWithSummary = takeoffs.map((takeoff: any) => ({
      id: takeoff.id,
      name: takeoff.name,
      description: takeoff.description,
      status: takeoff.status,
      totalCost: takeoff.totalCost,
      costUnit: takeoff.costUnit,
      extractedBy: takeoff.extractedBy,
      approvedBy: takeoff.approvedBy,
      approvedAt: takeoff.approvedAt,
      createdAt: takeoff.createdAt,
      updatedAt: takeoff.updatedAt,
      // Normalize relation names for frontend
      creator: takeoff.User,
      document: takeoff.Document,
      lineItems: takeoff.TakeoffLineItem,
      _count: {
        lineItems: takeoff._count?.TakeoffLineItem || takeoff.TakeoffLineItem?.length || 0
      },
      summary: {
        totalItems: takeoff.TakeoffLineItem.length,
        totalCost: takeoff.TakeoffLineItem.reduce((sum: number, item: any) => sum + (item.totalCost || 0), 0),
        categories: [...new Set(takeoff.TakeoffLineItem.map((item: any) => item.category))]
      }
    }));

    return NextResponse.json({ takeoffs: takeoffsWithSummary });
  } catch (error: any) {
    console.error('Error fetching takeoffs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch takeoffs', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/projects/[slug]/takeoffs - Create a new material takeoff
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
    const body = await request.json();
    const { name, description, documentId, lineItems } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get project and verify access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: {
          include: { User: true }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has access (owner, member, or admin)
    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify document exists if provided
    if (documentId) {
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      });

      if (!document || document.projectId !== project.id) {
        return NextResponse.json({ error: 'Invalid document' }, { status: 400 });
      }
    }

    // Create takeoff with optional line items
    const takeoff = await prisma.materialTakeoff.create({
      data: {
        name,
        description,
        projectId: project.id,
        createdBy: user.id,
        documentId: documentId || null,
        extractedBy: 'manual',
        TakeoffLineItem: lineItems ? {
          create: lineItems.map((item: any) => ({
            category: item.category,
            itemName: item.itemName,
            description: item.description,
            quantity: parseFloat(item.quantity),
            unit: item.unit,
            unitCost: item.unitCost ? parseFloat(item.unitCost) : null,
            totalCost: item.unitCost ? parseFloat(item.quantity) * parseFloat(item.unitCost) : null,
            location: item.location,
            sheetNumber: item.sheetNumber,
            gridLocation: item.gridLocation,
            notes: item.notes
          }))
        } : undefined
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
      ...takeoff,
      creator: takeoff.User,
      document: takeoff.Document,
      lineItems: takeoff.TakeoffLineItem,
      _count: {
        lineItems: takeoff.TakeoffLineItem.length
      }
    };

    return NextResponse.json({ takeoff: normalizedTakeoff }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating takeoff:', error);
    return NextResponse.json(
      { error: 'Failed to create takeoff', details: error.message },
      { status: 500 }
    );
  }
}
