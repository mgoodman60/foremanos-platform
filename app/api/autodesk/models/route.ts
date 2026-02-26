/**
 * Autodesk Models List API Endpoint
 * Returns all models for a project
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('AUTODESK_MODELS');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectSlug = searchParams.get('projectSlug');

    if (!projectSlug) {
      return NextResponse.json({ error: 'Project slug required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const rawModels = await prisma.autodeskModel.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        urn: true,
        status: true,
        fileSize: true,
        createdAt: true,
        thumbnailUrl: true,
        metadata: true,
      },
    });

    // Transform models to include extraction status from metadata
    const models = rawModels.map((model: typeof rawModels[number]) => {
      const metadata = model.metadata as Record<string, unknown> || {};
      return {
        id: model.id,
        fileName: model.fileName,
        urn: model.urn,
        status: model.status,
        fileSize: model.fileSize,
        createdAt: model.createdAt,
        thumbnailUrl: model.thumbnailUrl,
        extracted: metadata.extracted || false,
        takeoffId: metadata.takeoffId,
        takeoffItems: metadata.takeoffItems,
        // DWG-specific metadata
        fileType: metadata.fileType,
        totalLayers: metadata.totalLayers,
        totalBlocks: metadata.totalBlocks,
        totalAnnotations: metadata.totalAnnotations,
        layerCategories: metadata.layerCategories,
      };
    });

    return NextResponse.json({ models });
  } catch (error) {
    logger.error('[Autodesk Models] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
