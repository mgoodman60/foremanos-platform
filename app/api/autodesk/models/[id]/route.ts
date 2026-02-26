/**
 * Autodesk Model API Endpoint
 * Get/Delete individual model
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { deleteObject } from '@/lib/autodesk-oss';
import { deleteManifest } from '@/lib/autodesk-model-derivative';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('autodesk-model');

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const model = await prisma.autodeskModel.findUnique({
      where: { id: params.id },
      include: {
        project: {
          select: { name: true, slug: true },
        },
      },
    });

    if (!model) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 });
    }

    return NextResponse.json({ model });
  } catch (error) {
    logger.error('Failed to fetch model', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch model' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    // Delete from Autodesk OSS
    try {
      await deleteObject(model.objectKey);
    } catch (e) {
      logger.warn('Failed to delete OSS object', { error: e instanceof Error ? e.message : String(e) });
    }

    // Delete manifest/derivatives
    try {
      await deleteManifest(model.urn);
    } catch (e) {
      logger.warn('Failed to delete manifest', { error: e instanceof Error ? e.message : String(e) });
    }

    // Delete from database
    await prisma.autodeskModel.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete model', error as Error);
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    );
  }
}
