import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_TAKEOFFS_REGENERATE');

/**
 * POST /api/projects/[slug]/takeoffs/regenerate
 * Regenerate takeoff by re-extracting quantities from all project documents
 */
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all processed documents
    const documents = await prisma.document.findMany({
      where: {
        projectId: project.id,
        processed: true,
        deletedAt: null,
        OR: [
          { fileType: 'pdf' },
          { fileType: { contains: 'pdf' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!documents.length) {
      return NextResponse.json({
        success: false,
        message: 'No processed documents found for takeoff extraction',
      });
    }

    // Track extraction results
    const results: {
      documentId: string;
      documentName: string;
      status: 'success' | 'failed' | 'skipped';
      itemsExtracted?: number;
      error?: string;
    }[] = [];

    let totalNewItems = 0;

    // Find or create the main automatic takeoff
    let mainTakeoff = await prisma.materialTakeoff.findFirst({
      where: {
        projectId: project.id,
        name: { contains: 'Automatic Takeoff' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!mainTakeoff) {
      const user = session.user as any;
      mainTakeoff = await prisma.materialTakeoff.create({
        data: {
          name: `Automatic Takeoff - ${new Date().toLocaleDateString()}`,
          description: 'Auto-generated from project documents',
          status: 'in_progress',
          Project: { connect: { id: project.id } },
          User: { connect: { id: user.id } },
        },
      });
    }

    // Process each document
    for (const doc of documents) {
      try {
        // Skip non-plan documents - check category and name
        const isPlan = doc.category === 'plans_drawings' ||
          doc.name?.toLowerCase().includes('plan') ||
          doc.name?.toLowerCase().includes('drawing') ||
          doc.name?.toLowerCase().includes('sheet') ||
          doc.name?.toLowerCase().includes('conformance');

        if (!isPlan && doc.category !== 'budget_cost') {
          results.push({
            documentId: doc.id,
            documentName: doc.name,
            status: 'skipped',
            error: 'Not a plan document',
          });
          continue;
        }

        // Call the existing extract-quantities API
        const extractResponse = await fetch(
          `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/documents/${doc.id}/extract-quantities`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              takeoffId: mainTakeoff.id,
              projectId: project.id,
            }),
          }
        );

        if (extractResponse.ok) {
          const extractData = await extractResponse.json();
          results.push({
            documentId: doc.id,
            documentName: doc.name,
            status: 'success',
            itemsExtracted: extractData.itemsCreated || 0,
          });
          totalNewItems += extractData.itemsCreated || 0;
        } else {
          results.push({
            documentId: doc.id,
            documentName: doc.name,
            status: 'failed',
            error: 'Extraction failed',
          });
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        results.push({
          documentId: doc.id,
          documentName: doc.name,
          status: 'failed',
          error: errMsg,
        });
      }
    }

    // Update takeoff status and totals
    const lineItems = await prisma.takeoffLineItem.findMany({
      where: { takeoffId: mainTakeoff.id },
    });

    const totalCost = lineItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

    await prisma.materialTakeoff.update({
      where: { id: mainTakeoff.id },
      data: {
        totalCost,
        status: 'completed',
        updatedAt: new Date(),
      },
    });

    // Try to sync with budget if available
    let budgetSyncResult = null;
    try {
      const syncResponse = await fetch(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/projects/${params.slug}/takeoffs/sync-from-budget`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      if (syncResponse.ok) {
        budgetSyncResult = await syncResponse.json();
      }
    } catch (e) {
      logger.info('Budget sync skipped', { e });
    }

    return NextResponse.json({
      success: true,
      message: `Regenerated takeoff from ${documents.length} documents`,
      takeoff: {
        id: mainTakeoff.id,
        name: mainTakeoff.name,
        totalItems: lineItems.length,
        totalCost,
      },
      extraction: {
        documentsProcessed: documents.length,
        newItemsExtracted: totalNewItems,
        results,
      },
      budgetSync: budgetSyncResult?.success ? {
        itemsSynced: budgetSyncResult.summary?.pricedItems || 0,
        totalAllocated: budgetSyncResult.summary?.totalAllocated || 0,
      } : null,
    });
  } catch (error: unknown) {
    logger.error('[Takeoff Regenerate Error]', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errMsg || 'Failed to regenerate takeoff' },
      { status: 500 }
    );
  }
}
