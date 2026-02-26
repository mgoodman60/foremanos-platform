import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFileUrl } from '@/lib/s3';
import { logger } from '@/lib/logger';
import { safeErrorMessage } from '@/lib/api-error';

// GET /api/projects/[slug]/floor-plans - List all floor plans
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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
    const userId = session.user.id;
    const userRole = session.user.role;

    const isOwner = project.ownerId === userId;
    const isMember = project.ProjectMember.some((m: any) => m.userId === userId);

    if (!isOwner && !isMember && userRole !== 'admin') {
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

    // Generate signed URLs for floor plan images
    const floorPlansWithUrls = await Promise.all(
      floorPlans.map(async (fp) => ({
        ...fp,
        imageUrl: fp.cloud_storage_path ? await getFileUrl(fp.cloud_storage_path, fp.isPublic || false) : null,
      }))
    );

    return NextResponse.json({ floorPlans: floorPlansWithUrls });
  } catch (error: unknown) {
    logger.error('FLOOR_PLANS_API', 'Error fetching floor plans', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch floor plans', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}

// POST /api/projects/[slug]/floor-plans - Create floor plan
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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
    const userId = session.user.id;
    const userRole = session.user.role;

    const isOwner = project.ownerId === userId;
    const isAdmin = userRole === 'admin' || userRole === 'client';

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
  } catch (error: unknown) {
    logger.error('FLOOR_PLANS_API', 'Error creating floor plan', error as Error);
    return NextResponse.json(
      { error: 'Failed to create floor plan', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}