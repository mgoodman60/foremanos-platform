/**
 * Cross-Reference Resolver
 * Resolves cross-references between sheets within a document by scanning
 * symbolData (sectionCuts, detailCallouts, elevationMarkers) and callouts
 * from DocumentChunk metadata, matching them against known sheet numbers,
 * and creating DetailCallout records with an adjacency map.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface CrossReferenceResult {
  totalReferences: number;
  resolvedCount: number;
  unresolvedCount: number;
  adjacencyMap: Record<string, string[]>;
}

interface ParsedReference {
  type: string;
  number: string;
  referenceSheet: string;
  description?: string;
}

/**
 * Resolve cross-references between sheets within a document.
 * Scans all DocumentChunks for the given document, extracts cross-reference
 * markers from symbolData and callouts, resolves them against known sheet
 * numbers, creates DetailCallout records, and stores an adjacency map.
 */
export async function resolveCrossReferences(documentId: string): Promise<CrossReferenceResult> {
  logger.info('CROSS_REF', 'Starting cross-reference resolution', { documentId });

  // Fetch projectId from the document
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { projectId: true },
  });

  if (!document?.projectId) {
    logger.warn('CROSS_REF', 'Document not found or missing projectId', { documentId });
    return { totalReferences: 0, resolvedCount: 0, unresolvedCount: 0, adjacencyMap: {} };
  }

  const projectId = document.projectId;

  // 1. Get all chunks for this document with metadata
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { id: true, sheetNumber: true, metadata: true, pageNumber: true },
  });

  // Build sheet number -> chunk ID lookup
  const sheetToChunkId: Record<string, string> = {};
  for (const chunk of chunks) {
    if (chunk.sheetNumber) {
      sheetToChunkId[chunk.sheetNumber] = chunk.id;
    }
  }

  const knownSheets = new Set(Object.keys(sheetToChunkId));
  const adjacencyMap: Record<string, string[]> = {};
  let totalReferences = 0;
  let resolvedCount = 0;
  let unresolvedCount = 0;

  // 2. Scan each chunk's metadata for cross-references
  for (const chunk of chunks) {
    const meta = chunk.metadata as Record<string, any> | null;
    if (!meta || !chunk.sheetNumber) continue;

    const sourceSheet = chunk.sheetNumber;
    adjacencyMap[sourceSheet] = adjacencyMap[sourceSheet] || [];

    const allRefs = extractReferences(meta);

    // 3. Resolve each reference
    for (const ref of allRefs) {
      totalReferences++;
      const targetSheet = ref.referenceSheet;

      // Try exact match first, then fuzzy
      let resolved = knownSheets.has(targetSheet);
      let matchedSheet = targetSheet;

      if (!resolved) {
        const normalized = targetSheet.replace(/[.\-\s]/g, '').toUpperCase();
        for (const known of knownSheets) {
          const knownNorm = known.replace(/[.\-\s]/g, '').toUpperCase();
          if (knownNorm === normalized) {
            resolved = true;
            matchedSheet = known;
            break;
          }
        }
      }

      if (resolved) {
        resolvedCount++;
        if (!adjacencyMap[sourceSheet].includes(matchedSheet)) {
          adjacencyMap[sourceSheet].push(matchedSheet);
        }

        await upsertDetailCallout({
          projectId,
          documentId,
          sourceSheet,
          matchedSheet,
          ref,
        });
      } else {
        unresolvedCount++;
      }
    }
  }

  // 4. Store adjacency map on Document.sheetIndex
  await storeAdjacencyMap(documentId, adjacencyMap);

  logger.info('CROSS_REF', 'Cross-reference resolution complete', {
    documentId,
    totalReferences,
    resolvedCount,
    unresolvedCount,
  });

  return { totalReferences, resolvedCount, unresolvedCount, adjacencyMap };
}

// Internal helpers

function extractReferences(meta: Record<string, any>): ParsedReference[] {
  const allRefs: ParsedReference[] = [];

  if (meta.symbolData?.sectionCuts) {
    for (const sc of meta.symbolData.sectionCuts) {
      if (sc.referenceSheet) {
        allRefs.push({
          type: 'section',
          number: sc.number || '',
          referenceSheet: sc.referenceSheet,
          description: sc.direction,
        });
      }
    }
  }

  if (meta.symbolData?.detailCallouts) {
    for (const dc of meta.symbolData.detailCallouts) {
      if (dc.referenceSheet) {
        allRefs.push({
          type: 'detail',
          number: dc.number || '',
          referenceSheet: dc.referenceSheet,
        });
      }
    }
  }

  if (meta.symbolData?.elevationMarkers) {
    for (const em of meta.symbolData.elevationMarkers) {
      if (em.referenceSheet) {
        allRefs.push({
          type: 'elevation',
          number: em.number || '',
          referenceSheet: em.referenceSheet,
        });
      }
    }
  }

  if (meta.callouts && Array.isArray(meta.callouts)) {
    for (const callout of meta.callouts) {
      const match = String(callout).match(/(\w+)\s*\/\s*([\w.]+)/);
      if (match) {
        allRefs.push({
          type: 'callout',
          number: match[1],
          referenceSheet: match[2],
        });
      }
    }
  }

  return allRefs;
}

async function upsertDetailCallout(params: {
  projectId: string;
  documentId: string;
  sourceSheet: string;
  matchedSheet: string;
  ref: ParsedReference;
}): Promise<void> {
  const { projectId, documentId, sourceSheet, matchedSheet, ref } = params;
  const number = ref.number || `${ref.type}-${matchedSheet}`;

  try {
    // No compound unique on DetailCallout — use findFirst + create/update
    const existing = await prisma.detailCallout.findFirst({
      where: {
        documentId,
        number,
        type: ref.type,
        sourceSheet,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.detailCallout.update({
        where: { id: existing.id },
        data: {
          sheetReference: matchedSheet,
          description: ref.description || null,
          confidence: 0.9,
        },
      });
    } else {
      await prisma.detailCallout.create({
        data: {
          projectId,
          documentId,
          number,
          type: ref.type,
          sourceSheet,
          sheetReference: matchedSheet,
          description: ref.description || null,
          confidence: 0.9,
        },
      });
    }
  } catch (error) {
    logger.warn('CROSS_REF', 'Failed to upsert DetailCallout', {
      number,
      type: ref.type,
      error: (error as Error).message,
    });
  }
}

async function storeAdjacencyMap(
  documentId: string,
  adjacencyMap: Record<string, string[]>
): Promise<void> {
  try {
    const existingDoc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { sheetIndex: true },
    });

    const currentIndex = (existingDoc?.sheetIndex as Record<string, any>) || {};
    await prisma.document.update({
      where: { id: documentId },
      data: {
        sheetIndex: {
          ...currentIndex,
          crossReferenceMap: adjacencyMap,
        },
      },
    });
  } catch (updateError) {
    logger.warn('CROSS_REF', 'Failed to store adjacency map', {
      documentId,
      error: (updateError as Error).message,
    });
  }
}
