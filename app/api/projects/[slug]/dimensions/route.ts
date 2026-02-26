import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSheetDimensions, searchDimensions, getDimensionStats } from '@/lib/dimension-intelligence';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DIMENSIONS');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const sheetNumber = searchParams.get('sheetNumber');
    const type = searchParams.get('type');
    const context = searchParams.get('context');
    const critical = searchParams.get('critical') === 'true';

    const project = await prisma.project.findUnique({ 
      where: { slug },
      include: {
        Document: true
      }
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (action === 'list') {
      // Get all dimension annotations for the project
      const annotations = await prisma.dimensionAnnotation.findMany({
        where: { projectId: project.id },
        include: {
          Document: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { sheetNumber: 'asc' }
      });

      // Transform to sheet-based format for the browser component
      const sheets = annotations.map((ann: any) => {
        const dims = ann.dimensions as any;
        const dimensionsArray = Array.isArray(dims) ? dims : [];

        // Build dimension chains
        const chainMap = new Map<string, any[]>();
        dimensionsArray.forEach((dim: any) => {
          if (dim.chainId) {
            if (!chainMap.has(dim.chainId)) {
              chainMap.set(dim.chainId, []);
            }
            chainMap.get(dim.chainId)!.push(dim);
          }
        });

        const chains: any[] = [];
        chainMap.forEach((dims, chainId) => {
          const total = dims.reduce((sum, d) => sum + d.value, 0);
          chains.push({
            chainId,
            dimensions: dims,
            totalLength: total,
            valid: true
          });
        });

        return {
          id: ann.id,
          sheetNumber: ann.sheetNumber,
          dimensions: dimensionsArray,
          chains,
          confidence: ann.confidence,
          document: ann.Document
        };
      });

      return NextResponse.json({ 
        success: true, 
        sheets 
      });
    }

    if (action === 'sheet' && sheetNumber) {
      const dimensions = await getSheetDimensions(project.id, sheetNumber);
      return NextResponse.json({ dimensions });
    }

    if (action === 'search') {
      const dimensions = await searchDimensions(project.id, { type: type || undefined, context: context || undefined, critical: critical || undefined });
      return NextResponse.json({ dimensions });
    }

    if (action === 'stats') {
      const stats = await getDimensionStats(project.id);
      return NextResponse.json({ 
        success: true, 
        stats 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error getting dimensions', error);
    return NextResponse.json({ error: 'Failed to get dimensions' }, { status: 500 });
  }
}
