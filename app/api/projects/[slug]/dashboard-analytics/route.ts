import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DASHBOARD_ANALYTICS');

export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/dashboard-analytics - Get comprehensive dashboard analytics
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
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
        },
        Document: {
          select: {
            id: true,
            name: true,
            fileType: true,
            processed: true,
            createdAt: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has access
    const userId = session.user.id;
    const userRole = session.user.role;

    const isOwner = project.ownerId === userId;
    const isMember = project.ProjectMember.some((m) => m.userId === userId);

    if (!isOwner && !isMember && userRole !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch rooms
    const rooms = await prisma.room.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        name: true,
        roomNumber: true,
        floorNumber: true,
        status: true,
        createdAt: true
      }
    });

    // Fetch takeoff items
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId: project.id },
      include: {
        TakeoffLineItem: {
          select: {
            id: true,
            quantity: true,
            unit: true,
            unitCost: true,
            totalCost: true,
            verified: true
          }
        }
      }
    });

    // Calculate takeoff metrics
    const allLineItems = takeoffs.flatMap((t) => t.TakeoffLineItem || []);
    const totalCost = allLineItems.reduce((sum: number, item) => sum + (item.totalCost || 0), 0);
    const verifiedItems = allLineItems.filter((item) => item.verified).length;
    const verificationRate = allLineItems.length > 0 ? (verifiedItems / allLineItems.length) * 100 : 0;

    // Group takeoffs by category
    interface CategoryData { count: number; totalCost: number; items: number }
    const categoryBreakdown = takeoffs.reduce<Record<string, CategoryData>>((acc, takeoff) => {
      const category = (takeoff as Record<string, unknown>).category as string || 'Other';
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          totalCost: 0,
          items: 0
        };
      }
      acc[category].count += 1;
      acc[category].items += takeoff.TakeoffLineItem?.length || 0;
      acc[category].totalCost += takeoff.TakeoffLineItem?.reduce((sum: number, item) => sum + (item.totalCost || 0), 0) || 0;
      return acc;
    }, {});

    // Fetch MEP equipment (from chunks metadata)
    const mepChunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          projectId: project.id
        }
      },
      select: {
        metadata: true
      },
      take: 1000 // Limit for performance
    });

    // Extract MEP equipment from metadata
    let hvacCount = 0;
    let electricalCount = 0;
    let plumbingCount = 0;
    let fireCount = 0;

    mepChunks.forEach((chunk) => {
      const metadata = chunk.metadata as Record<string, unknown> | null;
      if (metadata?.mepCallouts) {
        const callouts = Array.isArray(metadata.mepCallouts) ? metadata.mepCallouts : [];
        callouts.forEach((callout: string) => {
          const upper = callout.toUpperCase();
          if (upper.includes('AHU') || upper.includes('RTU') || upper.includes('VAV') || upper.includes('FCU')) {
            hvacCount++;
          } else if (upper.includes('MDP') || upper.includes('LP') || upper.includes('RP') || upper.includes('PANEL')) {
            electricalCount++;
          } else if (upper.includes('WC') || upper.includes('LAV') || upper.includes('UR') || upper.includes('SINK')) {
            plumbingCount++;
          } else if (upper.includes('FACP') || upper.includes('SD') || upper.includes('HS') || upper.includes('SPRINKLER')) {
            fireCount++;
          }
        });
      }
    });

    const totalMEP = hvacCount + electricalCount + plumbingCount + fireCount;

    // Calculate room metrics
    const roomsByFloor = rooms.reduce<Record<string, number>>((acc, room) => {
      const floor = room.floorNumber ? `Floor ${room.floorNumber}` : 'Unknown';
      if (!acc[floor]) {
        acc[floor] = 0;
      }
      acc[floor] += 1;
      return acc;
    }, {});

    const roomsByStatus = rooms.reduce<Record<string, number>>((acc, room) => {
      const status = room.status || 'unknown';
      if (!acc[status]) {
        acc[status] = 0;
      }
      acc[status] += 1;
      return acc;
    }, {});

    // Document metrics
    const processedDocs = project.Document.filter((d) => d.processed).length;
    const processingRate = project.Document.length > 0 ? (processedDocs / project.Document.length) * 100 : 0;

    const pdfDocs = project.Document.filter((d) => d.fileType === 'pdf').length;
    const imageDocs = project.Document.filter((d) => ['jpg', 'jpeg', 'png', 'gif'].includes(d.fileType.toLowerCase())).length;

    // Calculate recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRooms = rooms.filter((r) => new Date(r.createdAt) > sevenDaysAgo).length;
    const recentDocs = project.Document.filter((d) => new Date(d.createdAt) > sevenDaysAgo).length;

    // Build comprehensive analytics
    const analytics = {
      overview: {
        totalDocuments: project.Document.length,
        processedDocuments: processedDocs,
        processingRate: Math.round(processingRate),
        totalRooms: rooms.length,
        totalMEP: totalMEP,
        totalMaterialItems: allLineItems.length,
        totalMaterialCost: totalCost,
        projectMembers: project.ProjectMember.length + 1 // +1 for owner
      },
      Document: {
        total: project.Document.length,
        processed: processedDocs,
        pending: project.Document.length - processedDocs,
        pdf: pdfDocs,
        images: imageDocs,
        other: project.Document.length - pdfDocs - imageDocs
      },
      rooms: {
        total: rooms.length,
        byFloor: roomsByFloor,
        byStatus: roomsByStatus,
        recentlyAdded: recentRooms
      },
      mep: {
        total: totalMEP,
        hvac: hvacCount,
        electrical: electricalCount,
        plumbing: plumbingCount,
        fire: fireCount,
        distribution: {
          HVAC: totalMEP > 0 ? Math.round((hvacCount / totalMEP) * 100) : 0,
          Electrical: totalMEP > 0 ? Math.round((electricalCount / totalMEP) * 100) : 0,
          Plumbing: totalMEP > 0 ? Math.round((plumbingCount / totalMEP) * 100) : 0,
          'Fire Protection': totalMEP > 0 ? Math.round((fireCount / totalMEP) * 100) : 0
        }
      },
      materials: {
        totalItems: allLineItems.length,
        totalCost: totalCost,
        verifiedItems: verifiedItems,
        verificationRate: Math.round(verificationRate),
        categories: Object.keys(categoryBreakdown).length,
        categoryBreakdown: Object.entries(categoryBreakdown)
          .map(([name, data]: [string, CategoryData]) => ({
            name,
            count: data.count,
            items: data.items,
            totalCost: data.totalCost,
            percentage: totalCost > 0 ? Math.round((data.totalCost / totalCost) * 100) : 0
          }))
          .sort((a, b) => b.totalCost - a.totalCost)
          .slice(0, 10) // Top 10 categories
      },
      activity: {
        last7Days: {
          rooms: recentRooms,
          documents: recentDocs
        },
        lastUpdate: project.updatedAt
      },
      health: {
        documentProcessing: processingRate,
        materialVerification: verificationRate,
        dataCompleteness: calculateDataCompleteness({
          hasDocuments: project.Document.length > 0,
          hasRooms: rooms.length > 0,
          hasMEP: totalMEP > 0,
          hasMaterials: allLineItems.length > 0
        })
      }
    };

    return NextResponse.json(analytics);
  } catch (error: unknown) {
    logger.error('Error fetching dashboard analytics', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard analytics', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}

function calculateDataCompleteness(checks: Record<string, boolean>): number {
  const total = Object.keys(checks).length;
  const completed = Object.values(checks).filter(Boolean).length;
  return Math.round((completed / total) * 100);
}
