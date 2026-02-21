import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractQuantitiesFromDocument } from '@/lib/takeoff-extractor';
import { safeErrorMessage } from '@/lib/api-error';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

// POST /api/documents/[id]/extract-quantities - Extract material quantities from a document
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(`api:${session.user.email}`, RATE_LIMITS.UPLOAD);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = params;
    const body = await request.json();
    const { takeoffName } = body;

    // Get document with project info
    const document = await prisma.document.findUnique({
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

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.Project) {
      return NextResponse.json({ error: 'Document must belong to a project' }, { status: 400 });
    }

    // Verify user has access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = document.Project.ownerId === user.id;
    const isMember = document.Project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if document has been processed for OCR
    if (!document.processed) {
      return NextResponse.json(
        { error: 'Document must be processed for OCR before quantity extraction' },
        { status: 400 }
      );
    }

    console.log(`[EXTRACT_QUANTITIES] Starting extraction for document ${document.name}`);

    // Extract quantities
    const result = await extractQuantitiesFromDocument(
      id,
      document.Project.id,
      user.id,
      takeoffName
    );

    console.log(`[EXTRACT_QUANTITIES] Extraction complete: ${result.totalItems} items found`);

    // Get the created takeoff with full details
    const takeoff = await prisma.materialTakeoff.findUnique({
      where: { id: result.takeoffId },
      include: {
        TakeoffLineItem: true,
        Document: {
          select: {
            id: true,
            name: true,
            fileName: true
          }
        },
        User: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json({
      message: 'Quantity extraction completed',
      takeoff,
      summary: {
        totalItems: result.totalItems,
        totalCost: result.totalCost,
        categories: result.categories.map(c => c.category),
        processingCost: result.processingCost,
        pagesProcessed: result.pagesProcessed
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('[EXTRACT_QUANTITIES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to extract quantities', details: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}
