/**
 * BIM Extraction API Endpoint
 * Triggers extraction of BIM data from a processed model
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractBIMData } from '@/lib/bim-metadata-extractor';
import { safeErrorMessage } from '@/lib/api-error';
import { importBIMToTakeoff } from '@/lib/bim-to-takeoff-service';
import { indexBIMForRAG } from '@/lib/bim-rag-indexer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('AUTODESK_MODELS_EXTRACT');

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const model = await prisma.autodeskModel.findUnique({
      where: { id: params.id },
      include: { project: true },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    if (model.status !== 'ready') {
      return NextResponse.json(
        { error: 'Model is not ready for extraction' },
        { status: 400 }
      );
    }

    logger.info('[BIM Extract API] Starting extraction for model', { modelId: model.id });

    // Step 1: Extract BIM metadata from Autodesk
    const bimData = await extractBIMData(model.urn);

    // Step 2: Import to takeoff system
    const takeoffResult = await importBIMToTakeoff(
      model.projectId,
      model.id,
      bimData
    );

    // Step 3: Index for RAG/chat
    const ragChunks = await indexBIMForRAG(
      model.projectId,
      model.id,
      bimData
    );

    // Update model metadata
    await prisma.autodeskModel.update({
      where: { id: model.id },
      data: {
        metadata: {
          ...(model.metadata as object || {}),
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

    logger.info('[BIM Extract API] Extraction complete for model', { modelId: model.id });

    return NextResponse.json({
      success: true,
      extraction: {
        totalElements: bimData.totalElements,
        summary: bimData.summary,
        categories: bimData.categories,
      },
      takeoff: {
        id: takeoffResult.takeoffId,
        importedItems: takeoffResult.importedItems,
        skippedItems: takeoffResult.skippedItems,
        categories: takeoffResult.categories,
      },
      rag: {
        indexedChunks: ragChunks,
      },
    });
  } catch (error) {
    logger.error('[BIM Extract API] Error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Extraction failed') },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const model = await prisma.autodeskModel.findUnique({
      where: { id: params.id },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    const metadata = model.metadata as any || {};

    return NextResponse.json({
      extracted: metadata.extracted || false,
      extractedAt: metadata.extractedAt,
      totalElements: metadata.totalElements,
      summary: metadata.summary,
      takeoffId: metadata.takeoffId,
      takeoffItems: metadata.takeoffItems,
      ragChunks: metadata.ragChunks,
    });
  } catch (error) {
    logger.error('[BIM Extract API] Error', error);
    return NextResponse.json(
      { error: 'Failed to get extraction status' },
      { status: 500 }
    );
  }
}
