/**
 * API Endpoint: Cross-Reference Graph & Navigation
 * 
 * GET /api/projects/[slug]/cross-references
 * 
 * Query parameters:
 * - action: 'graph' | 'from_sheet' | 'to_sheet' | 'validate' | 'stats'
 * - sheet: Sheet number (for from_sheet/to_sheet actions)
 * 
 * Phase B.1 - Document Intelligence Roadmap
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { safeErrorMessage } from '@/lib/api-error';
import {
  buildCalloutGraph,
  findReferencesToSheet,
  findReferencesFromSheet,
  validateCrossReferences,
  getCalloutStats,
} from '@/lib/detail-callout-extractor';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    // Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'graph';
    const sheet = searchParams.get('sheet');

    // Route to appropriate handler
    switch (action) {
      case 'graph':
        return await handleGraphRequest(project.id);

      case 'from_sheet':
        if (!sheet) {
          return NextResponse.json(
            { error: 'Sheet number required' },
            { status: 400 }
          );
        }
        return await handleFromSheetRequest(project.id, sheet);

      case 'to_sheet':
        if (!sheet) {
          return NextResponse.json(
            { error: 'Sheet number required' },
            { status: 400 }
          );
        }
        return await handleToSheetRequest(project.id, sheet);

      case 'validate':
        return await handleValidateRequest(project.id);

      case 'stats':
        return await handleStatsRequest(project.id);

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cross-reference API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to query cross-references',
        details: safeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Get full callout graph
 */
async function handleGraphRequest(projectId: string) {
  const graph = await buildCalloutGraph(projectId);

  // Convert Map to object for JSON serialization
  const nodesArray = Array.from(graph.nodes.entries()).map(
    ([sheetNumber, data]) => ({
      id: sheetNumber,
      name: `Sheet ${sheetNumber}`,
      label: `Sheet ${sheetNumber}`,
      type: 'sheet',
      sheetNumber: data.sheetNumber,
      incomingRefs: data.incomingRefs,
      outgoingRefs: data.outgoingRefs,
      callouts: data.callouts
    })
  );

  // Build references array and referencesByDoc for Plan Navigator
  const references: any[] = [];
  const referencesByDoc: Record<string, any[]> = {};

  for (const edge of graph.edges) {
    const sourceDoc = nodesArray.find((n: any) => n.id === edge.fromSheet);
    const targetDoc = nodesArray.find((n: any) => n.id === edge.toSheet);

    const ref = {
      sourceDocumentId: edge.fromSheet,
      targetDocumentId: edge.toSheet,
      referenceType: edge.calloutType || 'sheet_reference',
      location: `Callout ${edge.calloutNumber}`,
      context: `${edge.calloutType} ${edge.calloutNumber} → ${edge.toSheet}`,
      sourceDoc: sourceDoc ? { id: sourceDoc.id, name: sourceDoc.name, type: sourceDoc.type } : undefined,
      targetDoc: targetDoc ? { id: targetDoc.id, name: targetDoc.name, type: targetDoc.type } : undefined
    };

    references.push(ref);

    // Group by source document
    if (!referencesByDoc[edge.fromSheet]) {
      referencesByDoc[edge.fromSheet] = [];
    }
    referencesByDoc[edge.fromSheet].push(ref);
  }

  // Build stats
  const stats = {
    totalReferences: references.length,
    totalDocuments: nodesArray.length,
    avgRefsPerDoc: nodesArray.length > 0 ? references.length / nodesArray.length : 0
  };

  return NextResponse.json({
    success: true,
    // Original format
    nodes: nodesArray,
    edges: graph.edges,
    totalNodes: nodesArray.length,
    totalEdges: graph.edges.length,
    // Plan Navigator format
    references,
    referencesByDoc,
    graph: {
      nodes: nodesArray.map((n: any) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        outgoingRefs: n.outgoingRefs,
        incomingRefs: n.incomingRefs
      }))
    },
    stats
  });
}

/**
 * Get references FROM a specific sheet
 */
async function handleFromSheetRequest(projectId: string, sheet: string) {
  const references = await findReferencesFromSheet(projectId, sheet);

  return NextResponse.json({
    success: true,
    sheet,
    outgoingReferences: references,
    count: references.length,
  });
}

/**
 * Get references TO a specific sheet
 */
async function handleToSheetRequest(projectId: string, sheet: string) {
  const references = await findReferencesToSheet(projectId, sheet);

  return NextResponse.json({
    success: true,
    sheet,
    incomingReferences: references,
    count: references.length,
  });
}

/**
 * Validate cross-references and find broken links
 */
async function handleValidateRequest(projectId: string) {
  const validation = await validateCrossReferences(projectId);

  return NextResponse.json({
    success: true,
    validation: {
      valid: validation.valid,
      broken: validation.broken,
      orphaned: validation.orphaned,
      totalChecked: validation.valid + validation.broken.length,
      healthScore:
        validation.valid /
        Math.max(1, validation.valid + validation.broken.length),
    },
  });
}

/**
 * Get callout statistics
 */
async function handleStatsRequest(projectId: string) {
  const stats = await getCalloutStats(projectId);

  return NextResponse.json({
    success: true,
    stats,
  });
}
