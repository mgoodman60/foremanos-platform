import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractBudgetWithAI, importBudgetToProject } from '@/lib/budget-extractor-ai';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_EXTRACT');

/**
 * POST: Extract budget from a document using AI
 */
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { documentId, autoImport = true } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permissions
    const user = session.user as any;
    const canExtract = project.ownerId === user.id || user.role === 'admin';

    if (!canExtract) {
      return NextResponse.json(
        { error: 'Only project owners and admins can extract budgets' },
        { status: 403 }
      );
    }

    // Verify document belongs to this project
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId: project.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found in this project' },
        { status: 404 }
      );
    }

    // Extract budget
    logger.info('Extracting budget from document', { document: document.name });
    const extraction = await extractBudgetWithAI(
      documentId,
      project.id,
      user.id
    );

    // Auto-import if requested
    let importResult: Awaited<ReturnType<typeof importBudgetToProject>> | null = null;
    if (autoImport) {
      importResult = await importBudgetToProject(
        project.id,
        extraction,
        user.id
      );
    }

    // Auto-sync takeoff pricing from the newly imported budget
    let takeoffSyncResult: any = null;
    if (importResult) {
      try {
        logger.info('Auto-syncing takeoff pricing from budget...');
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const syncResponse = await fetch(
          `${baseUrl}/api/projects/${slug}/takeoffs/sync-from-budget`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        if (syncResponse.ok) {
          takeoffSyncResult = await syncResponse.json();
          logger.info('Takeoff sync completed', { pricedItems: takeoffSyncResult.summary?.pricedItems || 0 });
        }
      } catch (syncError) {
        logger.error('Takeoff sync error', syncError);
      }
    }

    return NextResponse.json({
      success: true,
      extraction: {
        totalBudget: extraction.totalBudget,
        contingency: extraction.contingency,
        itemCount: extraction.lineItems.length,
        currency: extraction.currency,
        confidence: extraction.confidence,
        extractionMethod: extraction.extractionMethod,
      },
      lineItems: extraction.lineItems,
      import: importResult,
      takeoffSync: takeoffSyncResult?.success ? {
        itemsSynced: takeoffSyncResult.summary?.pricedItems || 0,
        totalAllocated: takeoffSyncResult.summary?.totalAllocated || 0,
      } : null,
    });
  } catch (error: unknown) {
    logger.error('Extraction error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to extract budget') },
      { status: 500 }
    );
  }
}
