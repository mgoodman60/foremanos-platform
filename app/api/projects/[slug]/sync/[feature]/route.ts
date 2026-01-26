import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  syncScaleData,
  syncRoomData,
  syncDoorData,
  syncMEPData,
  syncScheduleData,
  syncDimensionData,
  syncLegendData,
  syncMaterialsData,
} from '@/lib/feature-sync-services';
import { processUploadedBudgetDocument } from '@/lib/budget-auto-sync';
import { determineSourceType, DATA_SOURCE_PRIORITY } from '@/lib/document-intelligence-router';

// POST /api/projects/[slug]/sync/[feature] - Manually sync a specific feature
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; feature: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { feature } = params;
    const body = await request.json().catch(() => ({}));
    const { documentId } = body;

    // Find relevant documents for this feature
    let documents;
    if (documentId) {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
      });
      documents = doc ? [doc] : [];
    } else {
      // Find documents that might contain this feature
      documents = await prisma.document.findMany({
        where: {
          projectId: project.id,
          processed: true,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (documents.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No processed documents found',
      });
    }

    const results: any[] = [];

    for (const doc of documents) {
      const sourceType = determineSourceType(doc.fileName, doc.category) as any;
      
      try {
        let syncResult;
        
        switch (feature) {
          case 'scale':
            syncResult = await syncScaleData(project.id, doc.id, sourceType);
            break;
          case 'rooms':
            syncResult = await syncRoomData(project.id, doc.id, sourceType);
            break;
          case 'doors':
          case 'windows':
            syncResult = await syncDoorData(project.id, doc.id, sourceType);
            break;
          case 'mep_electrical':
          case 'electrical':
            syncResult = await syncMEPData(project.id, doc.id, sourceType, 'mep_electrical');
            break;
          case 'mep_plumbing':
          case 'plumbing':
            syncResult = await syncMEPData(project.id, doc.id, sourceType, 'mep_plumbing');
            break;
          case 'mep_hvac':
          case 'hvac':
            syncResult = await syncMEPData(project.id, doc.id, sourceType, 'mep_hvac');
            break;
          case 'budget':
            syncResult = await processUploadedBudgetDocument(doc.id, project.id);
            break;
          case 'schedule':
            syncResult = await syncScheduleData(project.id, doc.id, sourceType);
            break;
          case 'dimensions':
            syncResult = await syncDimensionData(project.id, doc.id, sourceType);
            break;
          case 'legends':
            syncResult = await syncLegendData(project.id, doc.id, sourceType);
            break;
          case 'materials':
            syncResult = await syncMaterialsData(project.id, doc.id, sourceType);
            break;
          default:
            return NextResponse.json(
              { error: `Unknown feature: ${feature}` },
              { status: 400 }
            );
        }

        results.push({
          documentId: doc.id,
          fileName: doc.fileName,
          sourceType,
          confidence: DATA_SOURCE_PRIORITY[sourceType],
          result: syncResult,
        });
      } catch (error: any) {
        results.push({
          documentId: doc.id,
          fileName: doc.fileName,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      feature,
      documentsProcessed: documents.length,
      results,
    });
  } catch (error: any) {
    console.error(`[Sync ${params.feature} API] Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync feature' },
      { status: 500 }
    );
  }
}

// GET /api/projects/[slug]/sync/[feature] - Get current data source for a feature
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; feature: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const dataSource = await prisma.projectDataSource.findFirst({
      where: {
        projectId: project.id,
        featureType: params.feature,
      },
      include: {
        Document: { select: { id: true, fileName: true } },
      },
    });

    if (!dataSource) {
      return NextResponse.json({
        feature: params.feature,
        hasData: false,
        message: 'No data source found for this feature',
      });
    }

    return NextResponse.json({
      feature: params.feature,
      hasData: true,
      sourceType: dataSource.sourceType,
      confidence: dataSource.confidence,
      document: dataSource.Document,
      extractedAt: dataSource.extractedAt,
      metadata: dataSource.metadata,
    });
  } catch (error) {
    console.error(`[Sync ${params.feature} API] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to get feature status' },
      { status: 500 }
    );
  }
}
