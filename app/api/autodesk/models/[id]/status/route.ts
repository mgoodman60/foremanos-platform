/**
 * Autodesk Model Status API Endpoint
 * Checks and updates the translation status of a model
 * Auto-triggers BIM extraction when model becomes ready
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getTranslationStatus } from '@/lib/autodesk-model-derivative';
import { prisma } from '@/lib/db';
import { extractBIMData } from '@/lib/bim-metadata-extractor';
import { importBIMToTakeoff } from '@/lib/bim-to-takeoff-service';
import { indexBIMForRAG } from '@/lib/bim-rag-indexer';
import { createLogger } from '@/lib/logger';

const logger = createLogger('autodesk-status');

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const model = await prisma.autodeskModel.findUnique({
      where: { id: params.id },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // If already complete or failed, return cached status
    if (model.status === 'ready' || model.status === 'failed') {
      const metadata = model.metadata as any || {};
      return NextResponse.json({
        id: model.id,
        status: model.status,
        progress: model.status === 'ready' ? '100%' : '0%',
        urn: model.urn,
        extracted: metadata.extracted || false,
        takeoffId: metadata.takeoffId,
      });
    }

    // Check translation status with Autodesk
    const translationStatus = await getTranslationStatus(model.urn);

    // Map Autodesk status to our status
    let newStatus = model.status;
    if (translationStatus.status === 'success') {
      newStatus = 'ready';
    } else if (translationStatus.status === 'failed' || translationStatus.status === 'timeout') {
      newStatus = 'failed';
    } else if (translationStatus.status === 'inprogress') {
      newStatus = 'processing';
    }

    // Update status in database if changed
    if (newStatus !== model.status) {
      await prisma.autodeskModel.update({
        where: { id: model.id },
        data: { status: newStatus },
      });

      // Auto-trigger extraction when model becomes ready
      if (newStatus === 'ready') {
        logger.info('Model ready, triggering auto-extraction', { modelId: model.id });
        
        // Run extraction in background (don't await to avoid timeout)
        triggerExtraction(model.id, model.urn, model.projectId).catch(err => {
          logger.error('Auto-extraction failed', err as Error, { modelId: model.id });
        });
      }
    }

    return NextResponse.json({
      id: model.id,
      status: newStatus,
      progress: translationStatus.progress,
      urn: model.urn,
      messages: translationStatus.messages,
    });
  } catch (error) {
    logger.error('Status check error', error as Error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

/**
 * Background extraction function
 */
async function triggerExtraction(modelId: string, urn: string, projectId: string) {
  try {
    logger.info('Starting auto-extraction', { modelId });

    // Step 1: Extract BIM metadata
    const bimData = await extractBIMData(urn);

    // Step 2: Import to takeoff
    const takeoffResult = await importBIMToTakeoff(projectId, modelId, bimData);

    // Step 3: Index for RAG
    const ragChunks = await indexBIMForRAG(projectId, modelId, bimData);

    // Update model metadata
    await prisma.autodeskModel.update({
      where: { id: modelId },
      data: {
        metadata: {
          extracted: true,
          extractedAt: new Date().toISOString(),
          totalElements: bimData.totalElements,
          summary: bimData.summary,
          takeoffId: takeoffResult.takeoffId,
          takeoffItems: takeoffResult.importedItems,
          ragChunks,
        },
      },
    });

    logger.info('Auto-extraction complete', { modelId, takeoffItems: takeoffResult.importedItems, ragChunks });
  } catch (error) {
    logger.error('Auto-extraction error', error as Error, { modelId });
    
    // Mark extraction as failed
    await prisma.autodeskModel.update({
      where: { id: modelId },
      data: {
        metadata: {
          extractionFailed: true,
          extractionError: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    });
  }
}
