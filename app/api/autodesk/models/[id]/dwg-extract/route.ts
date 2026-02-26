/**
 * DWG Extraction API Endpoint
 * Extracts metadata from translated DWG files for RAG indexing
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractDWGMetadata, generateDWGSearchContent, DWGExtractionResult } from '@/lib/dwg-metadata-extractor';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('AUTODESK_MODELS_DWG_EXTRACT');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get model from database
    const model = await prisma.autodeskModel.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, slug: true, name: true }
        }
      }
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    // Check if it's a DWG/DXF file
    const fileName = model.fileName.toLowerCase();
    const isDWG = fileName.endsWith('.dwg') || fileName.endsWith('.dxf');
    
    if (!isDWG) {
      return NextResponse.json(
        { error: 'This endpoint is for DWG/DXF files only. Use /extract for BIM models.' },
        { status: 400 }
      );
    }

    // Check if model is ready for extraction
    if (model.status !== 'complete') {
      return NextResponse.json(
        { error: `Model translation not complete. Current status: ${model.status}` },
        { status: 400 }
      );
    }

    logger.info('[DWG Extract API] Starting extraction for model', { detail: model.fileName });

    // Extract DWG metadata
    const dwgData = await extractDWGMetadata(model.urn, model.fileName);

    // Generate searchable content for RAG
    const searchChunks = generateDWGSearchContent(dwgData);

    // Store DWG data in Autodesk model record
    // (We store searchable content in extractedMetadata rather than DocumentChunk
    // since DWG models don't have a corresponding Document record)
    // Store search chunks in metadata for RAG queries
    const searchableData = {
      ...dwgData,
      searchChunks: searchChunks,
    };

    // Update model with extraction data
    await prisma.autodeskModel.update({
      where: { id: model.id },
      data: {
        extractedMetadata: searchableData as any,
        lastExtractedAt: new Date(),
      },
    });

    logger.info('Extraction complete', {
      layers: dwgData.layers.length,
      blocks: dwgData.blocks.length,
      annotations: dwgData.textAnnotations.length,
      searchChunks: searchChunks.length,
    });

    return NextResponse.json({
      success: true,
      modelId: model.id,
      fileName: model.fileName,
      extraction: {
        layers: dwgData.layers.length,
        blocks: dwgData.blocks.length,
        annotations: dwgData.textAnnotations.length,
        categories: dwgData.layerCategories,
      },
      searchChunksCreated: searchChunks.length,
      summary: dwgData.summary,
    });

  } catch (error) {
    logger.error('[DWG Extract API] Error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Extraction failed') },
      { status: 500 }
    );
  }
}

/**
 * GET - Retrieve existing DWG extraction data
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const model = await prisma.autodeskModel.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        extractedMetadata: true,
        lastExtractedAt: true,
        status: true,
      },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    if (!model.extractedMetadata) {
      return NextResponse.json(
        { 
          message: 'No extraction data available. POST to this endpoint to extract.',
          modelId: model.id,
          status: model.status,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      modelId: model.id,
      fileName: model.fileName,
      extractedAt: model.lastExtractedAt,
      data: model.extractedMetadata as unknown as DWGExtractionResult,
    });

  } catch (error) {
    logger.error('[DWG Extract API] GET Error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to get extraction data') },
      { status: 500 }
    );
  }
}
