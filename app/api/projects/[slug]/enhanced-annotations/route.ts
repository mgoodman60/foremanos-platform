import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getAnnotationSummary, searchAnnotations } from '@/lib/annotation-processor';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ENHANCED_ANNOTATIONS');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const _type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const category = searchParams.get('category');

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
      // Get all enhanced annotations for the project
      const annotations = await prisma.enhancedAnnotation.findMany({
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
        const anns = ann.annotations as any;
        const annotationsArray = Array.isArray(anns) ? anns : [];

        return {
          id: ann.id,
          sheetNumber: ann.sheetNumber,
          annotations: annotationsArray,
          confidence: ann.confidence,
          document: ann.Document
        };
      });

      return NextResponse.json({ 
        success: true, 
        sheets 
      });
    }

    if (action === 'stats') {
      const summary = await getAnnotationSummary(project.id);
      
      return NextResponse.json({ 
        success: true, 
        stats: {
          total: summary.totalAnnotations,
          byPriority: summary.byPriority,
          byCategory: summary.byCategory,
          byType: summary.byType,
          critical: summary.criticalAlerts
        }
      });
    }

    if (action === 'search') {
      const results = await searchAnnotations(project.id, {
        priority: priority as any,
        category: category as any
      });
      
      return NextResponse.json({ 
        success: true,
        annotations: results 
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error getting enhanced annotations', error);
    return NextResponse.json({ error: 'Failed to get enhanced annotations' }, { status: 500 });
  }
}
