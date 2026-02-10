/**
 * General Notes Parser
 * Parses general notes and keynotes from construction drawing extraction
 * metadata into individual indexed DocumentChunks for precise RAG retrieval.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface NoteClause {
  clauseNumber: string;
  text: string;
  category: 'general' | 'structural' | 'mechanical' | 'electrical' | 'plumbing' | 'fire';
  referencedSpecs: string[];
}

export interface Keynote {
  number: string;
  text: string;
  sheetReference: string;
}

export interface GeneralNotesResult {
  clausesIndexed: number;
  keynotesIndexed: number;
}

/**
 * Parse general notes from extraction metadata into individual indexed clauses.
 * Each clause becomes a separate DocumentChunk for precise RAG retrieval.
 */
export async function parseGeneralNotes(
  documentId: string,
  _projectId: string,
  sheetNumber: string,
  noteClauses: NoteClause[],
  keynotes: Keynote[]
): Promise<GeneralNotesResult> {
  logger.info('GENERAL_NOTES', 'Starting general notes parsing', {
    documentId,
    clauseCount: noteClauses.length,
    keynoteCount: keynotes.length,
  });

  let clausesIndexed = 0;
  let keynotesIndexed = 0;

  // Determine starting chunkIndex by finding the max existing index
  const maxChunk = await prisma.documentChunk.findFirst({
    where: { documentId },
    orderBy: { chunkIndex: 'desc' },
    select: { chunkIndex: true },
  });
  let nextIndex = (maxChunk?.chunkIndex ?? -1) + 1;

  // Index note clauses as individual DocumentChunks
  if (noteClauses.length > 0) {
    const clauseChunks = noteClauses
      .filter(c => c.text && c.text.trim().length > 0)
      .map((clause, i) => ({
        documentId,
        chunkIndex: nextIndex + i,
        sheetNumber,
        content: `[${clause.category.toUpperCase()} NOTE ${clause.clauseNumber}] ${clause.text}`,
        metadata: {
          type: 'general_note',
          clauseNumber: clause.clauseNumber,
          category: clause.category,
          referencedSpecs: clause.referencedSpecs,
          sheetNumber,
        },
      }));

    if (clauseChunks.length > 0) {
      try {
        await prisma.documentChunk.createMany({
          data: clauseChunks,
          skipDuplicates: true,
        });
        clausesIndexed = clauseChunks.length;
        nextIndex += clauseChunks.length;
      } catch (error) {
        logger.warn('GENERAL_NOTES', 'Failed to index note clauses', {
          error: (error as Error).message,
          documentId,
        });
      }
    }
  }

  // Index keynotes as individual DocumentChunks
  if (keynotes.length > 0) {
    // Deduplicate keynotes by number
    const seen = new Set<string>();
    const uniqueKeynotes = keynotes.filter(k => {
      if (!k.number || seen.has(k.number)) return false;
      seen.add(k.number);
      return k.text && k.text.trim().length > 0;
    });

    const keynoteChunks = uniqueKeynotes.map((kn, i) => ({
      documentId,
      chunkIndex: nextIndex + i,
      sheetNumber,
      content: `[KEYNOTE ${kn.number}] ${kn.text}`,
      metadata: {
        type: 'keynote',
        keynoteNumber: kn.number,
        sheetReference: kn.sheetReference,
        sheetNumber,
      },
    }));

    if (keynoteChunks.length > 0) {
      try {
        await prisma.documentChunk.createMany({
          data: keynoteChunks,
          skipDuplicates: true,
        });
        keynotesIndexed = keynoteChunks.length;
      } catch (error) {
        logger.warn('GENERAL_NOTES', 'Failed to index keynotes', {
          error: (error as Error).message,
          documentId,
        });
      }
    }
  }

  logger.info('GENERAL_NOTES', 'General notes parsing complete', {
    documentId,
    clausesIndexed,
    keynotesIndexed,
  });

  return { clausesIndexed, keynotesIndexed };
}
