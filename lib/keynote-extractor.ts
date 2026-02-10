/**
 * Keynote Extractor
 * Extracts and indexes keynote callouts from construction drawing sheets.
 * Keynotes are the numbered bubbles on plan sheets that reference a keynote legend.
 * Each unique keynote becomes a DocumentChunk for RAG retrieval.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface KeynoteCallout {
  number: string;
  text: string;
  sheetReference: string;
}

export interface KeynoteExtractionResult {
  keynotesExtracted: number;
}

/**
 * Extract and index keynote callouts from construction drawing sheets.
 * Deduplicates keynotes by number per document, then creates DocumentChunks
 * for each unique keynote for precise RAG search.
 */
export async function extractKeynotes(
  documentId: string,
  _projectId: string,
  sheetNumber: string,
  keynotes: KeynoteCallout[]
): Promise<KeynoteExtractionResult> {
  logger.info('KEYNOTE_EXTRACTOR', 'Starting keynote extraction', {
    documentId,
    sheetNumber,
    rawCount: keynotes.length,
  });

  if (keynotes.length === 0) {
    return { keynotesExtracted: 0 };
  }

  // Deduplicate keynotes by number
  const seen = new Set<string>();
  const uniqueKeynotes = keynotes.filter(k => {
    if (!k.number || !k.text?.trim() || seen.has(k.number)) return false;
    seen.add(k.number);
    return true;
  });

  if (uniqueKeynotes.length === 0) {
    return { keynotesExtracted: 0 };
  }

  // Determine starting chunkIndex
  const maxChunk = await prisma.documentChunk.findFirst({
    where: { documentId },
    orderBy: { chunkIndex: 'desc' },
    select: { chunkIndex: true },
  });
  const startIndex = (maxChunk?.chunkIndex ?? -1) + 1;

  // Check for existing keynote chunks to avoid re-indexing
  const existingKeynoteChunks = await prisma.documentChunk.findMany({
    where: {
      documentId,
      metadata: {
        path: ['type'],
        equals: 'keynote_callout',
      },
    },
    select: { metadata: true },
  });

  const existingNumbers = new Set<string>();
  for (const chunk of existingKeynoteChunks) {
    const meta = chunk.metadata as Record<string, any> | null;
    if (meta?.keynoteNumber) {
      existingNumbers.add(meta.keynoteNumber);
    }
  }

  // Filter out already-indexed keynotes
  const newKeynotes = uniqueKeynotes.filter(k => !existingNumbers.has(k.number));

  if (newKeynotes.length === 0) {
    logger.info('KEYNOTE_EXTRACTOR', 'All keynotes already indexed', { documentId });
    return { keynotesExtracted: 0 };
  }

  const chunks = newKeynotes.map((kn, i) => ({
    documentId,
    chunkIndex: startIndex + i,
    sheetNumber,
    content: `[KEYNOTE ${kn.number}] ${kn.text}`,
    metadata: {
      type: 'keynote_callout',
      keynoteNumber: kn.number,
      sheetReference: kn.sheetReference,
      sourceSheet: sheetNumber,
    },
  }));

  try {
    await prisma.documentChunk.createMany({
      data: chunks,
      skipDuplicates: true,
    });
  } catch (error) {
    logger.warn('KEYNOTE_EXTRACTOR', 'Failed to create keynote chunks', {
      error: (error as Error).message,
      documentId,
    });
    return { keynotesExtracted: 0 };
  }

  logger.info('KEYNOTE_EXTRACTOR', 'Keynote extraction complete', {
    documentId,
    keynotesExtracted: newKeynotes.length,
    skippedDuplicates: uniqueKeynotes.length - newKeynotes.length,
  });

  return { keynotesExtracted: newKeynotes.length };
}
