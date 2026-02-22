/**
 * MEP Equipment API Endpoint
 * Returns MEP equipment data extracted from BIM model
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractBIMData } from '@/lib/bim-metadata-extractor';
import { safeErrorMessage } from '@/lib/api-error';
import { extractMEPEquipment } from '@/lib/bim-to-takeoff-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('AUTODESK_MODELS_MEP');

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (model.status !== 'ready') {
      return NextResponse.json(
        { error: 'Model is not ready' },
        { status: 400 }
      );
    }

    // Check if we have cached MEP data
    const metadata = model.metadata as any || {};
    if (metadata.mepData) {
      return NextResponse.json(metadata.mepData);
    }

    // Extract fresh BIM data
    logger.info('[MEP API] Extracting MEP data for model ${model.id}');
    const bimData = await extractBIMData(model.urn);
    const mepEquipment = extractMEPEquipment(bimData);

    // Format response
    const mepSummary = {
      mechanical: {
        count: mepEquipment.mechanical.length,
        items: [...new Set(mepEquipment.mechanical.map(e => e.name))].map(name => ({
          name,
          count: mepEquipment.mechanical.filter(e => e.name === name).length,
          elements: mepEquipment.mechanical
            .filter(e => e.name === name)
            .slice(0, 5)
            .map(e => ({
              id: e.dbId,
              level: e.level,
              material: e.material,
              properties: e.dimensions,
            })),
        })),
      },
      electrical: {
        count: mepEquipment.electrical.length,
        items: [...new Set(mepEquipment.electrical.map(e => e.name))].map(name => ({
          name,
          count: mepEquipment.electrical.filter(e => e.name === name).length,
          elements: mepEquipment.electrical
            .filter(e => e.name === name)
            .slice(0, 5)
            .map(e => ({
              id: e.dbId,
              level: e.level,
              properties: e.dimensions,
            })),
        })),
      },
      plumbing: {
        count: mepEquipment.plumbing.length,
        items: [...new Set(mepEquipment.plumbing.map(e => e.name))].map(name => ({
          name,
          count: mepEquipment.plumbing.filter(e => e.name === name).length,
          elements: mepEquipment.plumbing
            .filter(e => e.name === name)
            .slice(0, 5)
            .map(e => ({
              id: e.dbId,
              level: e.level,
              material: e.material,
              properties: e.dimensions,
            })),
        })),
      },
      fireProtection: {
        count: mepEquipment.fireProtection.length,
        items: [...new Set(mepEquipment.fireProtection.map(e => e.name))].map(name => ({
          name,
          count: mepEquipment.fireProtection.filter(e => e.name === name).length,
        })),
      },
      totals: {
        mechanical: mepEquipment.mechanical.length,
        electrical: mepEquipment.electrical.length,
        plumbing: mepEquipment.plumbing.length,
        fireProtection: mepEquipment.fireProtection.length,
        total: mepEquipment.mechanical.length + 
               mepEquipment.electrical.length + 
               mepEquipment.plumbing.length + 
               mepEquipment.fireProtection.length,
      },
    };

    // Cache MEP data
    await prisma.autodeskModel.update({
      where: { id: model.id },
      data: {
        metadata: {
          ...metadata,
          mepData: mepSummary,
          mepExtractedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json(mepSummary);
  } catch (error) {
    logger.error('[MEP API] Error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to get MEP data') },
      { status: 500 }
    );
  }
}
