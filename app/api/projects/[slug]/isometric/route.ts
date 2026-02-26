/**
 * Isometric View Analysis API
 * Analyzes isometric drawings and provides 3D reconstruction insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { detectIsometricViews, reconstructFrom2D, generateIsometricView } from '@/lib/isometric-interpreter';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_ISOMETRIC');

// Sheet categories suitable for isometric views (MEP-related)
const ISOMETRIC_SHEET_PREFIXES = ['M', 'P', 'E', 'FP', 'H', 'HVAC', 'MECH', 'PLMB', 'ELEC', 'FIRE'];
const ISOMETRIC_SHEET_KEYWORDS = [
  'mechanical', 'plumbing', 'electrical', 'hvac', 'fire protection',
  'piping', 'ductwork', 'riser', 'isometric', 'iso', 'diagram',
  'schematic', 'single line', 'one line'
];

// Document categories to exclude from isometric views
const EXCLUDED_CATEGORIES = ['budget', 'schedule', 'specification', 'submittal', 'contract', 'permit'];

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const sheetNumber = searchParams.get('sheet');
    const documentId = searchParams.get('documentId');
    const action = searchParams.get('action') || 'detect';

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectMember: {
          where: { User: { email: session.user?.email } }
        }
      }
    });

    if (!project || project.ProjectMember.length === 0) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Action: Get list of sheets suitable for isometric views
    if (action === 'list-sheets') {
      const sheets = await getIsometricCompatibleSheets(project.id);
      return NextResponse.json({ success: true, sheets });
    }

    // Action: Generate isometric view from a plan sheet
    if (action === 'generate') {
      if (!documentId) {
        return NextResponse.json(
          { error: 'Document ID is required for generating isometric views' },
          { status: 400 }
        );
      }

      const result = await generateIsometricView(project.id, documentId, sheetNumber || undefined);
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          message: result.message || 'Unable to generate isometric view'
        });
      }

      return NextResponse.json({
        success: true,
        analysis: result.analysis,
        model: result.model,
        visualization: result.visualization
      });
    }

    // Legacy actions require sheet number
    if (!sheetNumber) {
      return NextResponse.json(
        { error: 'Sheet number is required' },
        { status: 400 }
      );
    }

    if (action === 'detect') {
      const analysis = await detectIsometricViews(slug, sheetNumber);
      
      if (!analysis) {
        return NextResponse.json({
          success: false,
          message: 'No isometric views detected on this sheet'
        });
      }

      return NextResponse.json({
        success: true,
        analysis
      });
    } else if (action === 'reconstruct') {
      const model = await reconstructFrom2D(slug, sheetNumber);
      
      if (!model) {
        return NextResponse.json({
          success: false,
          message: 'Unable to reconstruct 3D model from this sheet'
        });
      }

      return NextResponse.json({
        success: true,
        model
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use: list-sheets, generate, detect, or reconstruct' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Isometric analysis error', error);
    return NextResponse.json(
      { error: 'Failed to analyze isometric view' },
      { status: 500 }
    );
  }
}

/**
 * Get sheets that are suitable for isometric view generation
 * Includes MEP plans, diagrams, and existing isometric views
 */
async function getIsometricCompatibleSheets(projectId: string): Promise<Array<{
  id: string;
  documentId: string;
  documentName: string;
  sheetNumber: string | null;
  sheetName: string | null;
  discipline: string;
  isIsometric: boolean;
  pageNumber?: number;
}>> {
  try {
    // Get all documents with their chunks (which contain sheet info)
    const documents = await prisma.document.findMany({
      where: {
        projectId,
        deletedAt: null,
        processed: true,
        category: {
          notIn: EXCLUDED_CATEGORIES as any[]
        }
      },
      select: {
        id: true,
        name: true,
        fileName: true,
        category: true,
        DocumentChunk: {
          select: {
            id: true,
            metadata: true,
            content: true
          },
          distinct: ['metadata']
        }
      }
    });

    const sheets: Array<{
      id: string;
      documentId: string;
      documentName: string;
      sheetNumber: string | null;
      sheetName: string | null;
      discipline: string;
      isIsometric: boolean;
      pageNumber?: number;
    }> = [];

    const seenSheets = new Set<string>();

    for (const doc of documents) {
      // Check document name/category for MEP indicators
      const docNameLower = (doc.name || doc.fileName || '').toLowerCase();
      const isMEPDocument = ISOMETRIC_SHEET_KEYWORDS.some(kw => docNameLower.includes(kw));
      
      // Extract sheets from document chunks
      for (const chunk of doc.DocumentChunk) {
        const metadata = chunk.metadata as any;
        const sheetNumber = metadata?.sheet_number || metadata?.sheetNumber;
        const sheetName = metadata?.sheet_name || metadata?.sheetName || metadata?.title;
        const pageNumber = metadata?.page_number || metadata?.pageNumber;
        const drawingType = (metadata?.drawing_type || '').toLowerCase();
        const content = (chunk.content || '').toLowerCase().substring(0, 500);

        // Skip if no sheet identifier
        if (!sheetNumber && !pageNumber) continue;

        // Create unique key for deduplication
        const sheetKey = `${doc.id}-${sheetNumber || pageNumber}`;
        if (seenSheets.has(sheetKey)) continue;
        seenSheets.add(sheetKey);

        // Determine discipline from sheet number prefix
        const discipline = classifyDiscipline(sheetNumber || '', docNameLower, drawingType);

        // Check if this is already an isometric view
        const isIsometric = ISOMETRIC_SHEET_KEYWORDS.some(kw => 
          drawingType.includes(kw) || content.includes(kw)
        );

        // Include if it's MEP-related or already isometric
        const sheetPrefix = (sheetNumber || '').toUpperCase().replace(/[^A-Z]/g, '');
        const isMEPSheet = ISOMETRIC_SHEET_PREFIXES.some(prefix => 
          sheetPrefix.startsWith(prefix)
        );

        if (isMEPSheet || isMEPDocument || isIsometric || discipline !== 'other') {
          sheets.push({
            id: chunk.id,
            documentId: doc.id,
            documentName: doc.name || doc.fileName || 'Unknown',
            sheetNumber: sheetNumber || null,
            sheetName: sheetName || null,
            discipline,
            isIsometric,
            pageNumber: pageNumber ? parseInt(pageNumber) : undefined
          });
        }
      }
    }

    // Sort by discipline, then sheet number
    return sheets.sort((a, b) => {
      const disciplineOrder = ['mechanical', 'plumbing', 'electrical', 'fire_protection', 'hvac', 'other'];
      const aOrder = disciplineOrder.indexOf(a.discipline);
      const bOrder = disciplineOrder.indexOf(b.discipline);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.sheetNumber || '').localeCompare(b.sheetNumber || '');
    });
  } catch (error) {
    logger.error('Error fetching isometric-compatible sheets', error);
    return [];
  }
}

/**
 * Classify sheet discipline based on sheet number and document info
 */
function classifyDiscipline(sheetNumber: string, docName: string, drawingType: string): string {
  const combined = `${sheetNumber} ${docName} ${drawingType}`.toLowerCase();
  const prefix = sheetNumber.toUpperCase().replace(/[^A-Z]/g, '');

  if (prefix.startsWith('M') || combined.includes('mechanical') || combined.includes('hvac')) {
    return 'mechanical';
  }
  if (prefix.startsWith('P') || combined.includes('plumbing')) {
    return 'plumbing';
  }
  if (prefix.startsWith('E') || combined.includes('electrical')) {
    return 'electrical';
  }
  if (prefix.startsWith('FP') || combined.includes('fire') || combined.includes('sprinkler')) {
    return 'fire_protection';
  }
  if (prefix.startsWith('H') || combined.includes('hvac')) {
    return 'hvac';
  }

  return 'other';
}
