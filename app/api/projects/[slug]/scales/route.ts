/**
 * Scales API
 * GET /api/projects/[slug]/scales
 * 
 * Multi-action endpoint for scale operations:
 * - list: Get all scales in project
 * - validate: Check for issues
 * - stats: Get statistics
 * - convert: Convert measurements
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  validateProjectScales,
  getScaleStatistics,
  convertDrawingToRealWorld,
  getSheetScaleData,
  type SheetScaleData,
} from '@/lib/scale-detector';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === 'guest') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    switch (action) {
      case 'list': {
        // Get all scales
        const chunks = await prisma.documentChunk.findMany({
          where: {
            Document: { projectId: project.id },
          },
          select: {
            sheetNumber: true,
            scaleData: true,
            Document: {
              select: {
                name: true,
              },
            },
          },
        });

        // Group by sheet number
        const sheetMap = new Map<string, any>();
        for (const chunk of chunks) {
          if (chunk.sheetNumber && chunk.scaleData && !sheetMap.has(chunk.sheetNumber)) {
            sheetMap.set(chunk.sheetNumber, {
              sheetNumber: chunk.sheetNumber,
              documentName: chunk.Document?.name || "Unknown",
              scaleData: chunk.scaleData,
            });
          }
        }

        const scales = Array.from(sheetMap.values());

        return NextResponse.json({ scales });
      }

      case 'validate': {
        // Validate scales
        const validation = await validateProjectScales(params.slug);
        return NextResponse.json(validation);
      }

      case 'stats': {
        // Get statistics
        const stats = await getScaleStatistics(params.slug);
        return NextResponse.json(stats);
      }

      case 'convert': {
        // Convert measurement
        const measurement = parseFloat(searchParams.get('measurement') || '0');
        const scaleRatio = parseFloat(searchParams.get('scaleRatio') || '48');
        const inputUnit = (searchParams.get('inputUnit') || 'inches') as any;
        const outputUnit = (searchParams.get('outputUnit') || 'feet') as any;

        const result = convertDrawingToRealWorld(
          measurement,
          scaleRatio,
          inputUnit,
          outputUnit
        );

        return NextResponse.json({
          input: { measurement, scaleRatio, inputUnit },
          output: { value: result, unit: outputUnit },
        });
      }

      case 'sheet': {
        // Get scale for specific sheet
        const sheetNumber = searchParams.get('sheetNumber');
        if (!sheetNumber) {
          return NextResponse.json({ error: 'Sheet number required' }, { status: 400 });
        }

        const scaleData = await getSheetScaleData(project.id, sheetNumber);
        if (!scaleData) {
          return NextResponse.json({ error: 'Scale data not found' }, { status: 404 });
        }

        return NextResponse.json({ scaleData });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Scales API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
