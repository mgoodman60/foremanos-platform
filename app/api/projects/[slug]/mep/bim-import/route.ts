/**
 * BIM Import API for MEP
 * POST: Import MEP data from a processed BIM model
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { populateFromBIM } from '@/lib/mep-tracking-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_BIM_IMPORT');

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { modelId, modelUrn } = body;

    if (!modelId && !modelUrn) {
      return NextResponse.json(
        { error: 'Model ID or URN is required' },
        { status: 400 }
      );
    }

    // Get model info
    let autodeskModel;
    if (modelId) {
      autodeskModel = await prisma.autodeskModel.findUnique({
        where: { id: modelId }
      });
    } else {
      autodeskModel = await prisma.autodeskModel.findFirst({
        where: { urn: modelUrn, projectId: project.id }
      });
    }

    if (!autodeskModel) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    if (!autodeskModel.metadata) {
      return NextResponse.json(
        { error: 'Model metadata not yet extracted. Please wait for model processing to complete.' },
        { status: 400 }
      );
    }

    // Parse the extracted metadata
    const bimData = autodeskModel.metadata as any;
    
    // Populate MEP equipment from BIM data
    const result = await populateFromBIM(
      project.id,
      bimData,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      imported: result,
      message: `Imported ${result.systems} systems, ${result.equipment} equipment items, and ${result.calculations} load calculations from BIM model.`
    });
  } catch (error) {
    logger.error('[MEP BIM Import Error]', error);
    return NextResponse.json(
      { error: 'Failed to import from BIM' },
      { status: 500 }
    );
  }
}
