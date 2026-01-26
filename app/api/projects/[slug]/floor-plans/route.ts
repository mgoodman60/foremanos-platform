import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/projects/[slug]/floor-plans - List all floor plans
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
    const { searchParams } = new URL(request.url);
    const floor = searchParams.get('floor');
    const building = searchParams.get('building');
    const activeOnly = searchParams.get('active') === 'true';

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

    // Verify access
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

    // Build filter
    const where: any = {
      projectId: project.id
    };

    if (floor) where.floor = floor;
    if (building) where.building = building;
    if (activeOnly) where.isActive = true;

    // Get floor plans
    const floorPlans = await prisma.floorPlan.findMany({
      where,
      orderBy: [
        { floor: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({ floorPlans });
  } catch (error) {
    console.error('Error fetching floor plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch floor plans' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[slug]/floor-plans - Create floor plan
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

    // If this floor plan is marked as active, deactivate others for the same floor/building
    if (body.isActive) {
      const deactivateWhere: any = {
        projectId: project.id,
        isActive: true
      };
      
      if (body.floor) deactivateWhere.floor = body.floor;
      if (body.building) deactivateWhere.building = body.building;

      await prisma.floorPlan.updateMany({
        where: deactivateWhere,
        data: { isActive: false }
      });
    }

    // Create floor plan
    const floorPlan = await prisma.floorPlan.create({
      data: {
        projectId: project.id,
        name: body.name,
        floor: body.floor || null,
        building: body.building || null,
        cloud_storage_path: body.cloud_storage_path,
        isPublic: body.isPublic || false,
        imageWidth: body.imageWidth || null,
        imageHeight: body.imageHeight || null,
        sourceDocumentId: body.sourceDocumentId || null,
        sourceSheetNumber: body.sourceSheetNumber || null,
        scale: body.scale || null,
        description: body.description || null,
        isActive: body.isActive !== undefined ? body.isActive : true
      }
    });

    return NextResponse.json({ floorPlan }, { status: 201 });
  } catch (error) {
    console.error('Error creating floor plan:', error);
    return NextResponse.json(
      { error: 'Failed to create floor plan' },
      { status: 500 }
    );
  }
}