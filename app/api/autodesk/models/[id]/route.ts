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
    console.error('[Autodesk Model] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch model' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    // Delete from Autodesk OSS
    try {
      await deleteObject(model.objectKey);
    } catch (e) {
      console.warn('[Autodesk Model] Failed to delete OSS object:', e);
    }

    // Delete manifest/derivatives
    try {
      await deleteManifest(model.urn);
    } catch (e) {
      console.warn('[Autodesk Model] Failed to delete manifest:', e);
    }

    // Delete from database
    await prisma.autodeskModel.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Autodesk Model Delete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    );
  }
}
