/**
 * RAG Retrieval Strategies for Construction Document Analysis
 *
 * Extracted from lib/rag-enhancements.ts — two-pass retrieval,
 * cross-reference bundling, and MEP-specific retrieval ordering.
 */

import { prisma } from '../db';
import type { EnhancedChunk } from './types';
import { classifyQueryIntent, extractIdentifiers, extractKeywords } from './query-classification';

/**
 * Two-pass retrieval: Precision pass (exact identifiers) + Context pass (supporting chunks)
 */
export async function twoPassRetrieval(
  query: string,
  projectSlug: string,
  userRole: 'admin' | 'client' | 'guest' | 'pending',
  limit: number = 12
): Promise<{ chunks: EnhancedChunk[]; retrievalLog: string[] }> {
  const log: string[] = [];

  // Identify query intent
  const intent = classifyQueryIntent(query);
  log.push(`Query intent: ${intent.type}, notes=${intent.requiresNotes}, crossRef=${intent.requiresCrossRef}`);

  const precisionChunks: EnhancedChunk[] = [];
  const contextChunks: EnhancedChunk[] = [];

  // Get project ID
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });

  if (!project) {
    log.push('Project not found');
    return { chunks: [], retrievalLog: log };
  }

  // Base where clause for access control
  const baseWhere: any = {
    projectId: project.id,
    processed: true,
  };

  if (userRole === 'guest') {
    baseWhere.accessLevel = 'guest';
  } else if (userRole === 'client') {
    baseWhere.accessLevel = { in: ['client', 'guest'] };
  }

  // PASS 1: Precision retrieval for exact identifiers
  const identifiers = extractIdentifiers(query);
  log.push(`Extracted identifiers: ${identifiers.join(', ') || 'none'}`);

  if (identifiers.length > 0) {
    const precisionQuery = await prisma.document.findMany({
      where: baseWhere,
      include: {
        DocumentChunk: {
          where: {
            OR: identifiers.map(id => ({
              content: { contains: id, mode: 'insensitive' },
            })),
          },
          take: 10,
        },
      },
    });

    for (const doc of precisionQuery) {
      for (const chunk of doc.DocumentChunk) {
        // @ts-expect-error strictNullChecks migration
        precisionChunks.push({
          ...chunk,
          metadata: {
            ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
            documentName: doc.name,
          },
          retrievalMethod: 'precision',
        });
      }
    }
    log.push(`Precision pass: ${precisionChunks.length} chunks`);
  }

  // PASS 2: Notes-first approach for requirement queries
  if (intent.requiresNotes) {
    const notesQuery = await prisma.document.findMany({
      where: baseWhere,
      include: {
        DocumentChunk: {
          where: {
            OR: [
              { content: { contains: 'GENERAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'STRUCTURAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'ARCHITECTURAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'MECHANICAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'ELECTRICAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'PLUMBING NOTES', mode: 'insensitive' } },
              { content: { contains: 'SHALL', mode: 'insensitive' } },
              { content: { contains: 'REQUIRED', mode: 'insensitive' } },
            ],
          },
          take: 8,
        },
      },
    });

    for (const doc of notesQuery) {
      for (const chunk of doc.DocumentChunk) {
        // @ts-expect-error strictNullChecks migration
        contextChunks.push({
          ...chunk,
          metadata: {
            ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
            documentName: doc.name,
          },
          retrievalMethod: 'notes_first',
        });
      }
    }
    log.push(`Notes-first pass: ${contextChunks.length} chunks`);
  }

  // PASS 3: Context retrieval with keyword matching
  const keywords = extractKeywords(query);
  const contextQuery = await prisma.document.findMany({
    where: baseWhere,
    include: {
      DocumentChunk: {
        where: {
          OR: keywords.slice(0, 5).map(kw => ({
            content: { contains: kw, mode: 'insensitive' },
          })),
        },
        take: limit - precisionChunks.length - contextChunks.length,
      },
    },
  });

  // Build Set of existing chunk IDs for O(1) duplicate checking
  const existingChunkIds = new Set<string>();
  precisionChunks.forEach(c => existingChunkIds.add(c.id));
  contextChunks.forEach(c => existingChunkIds.add(c.id));

  for (const doc of contextQuery) {
    for (const chunk of doc.DocumentChunk) {
      // Avoid duplicates using Set lookup (O(1) instead of O(N))
      if (!existingChunkIds.has(chunk.id)) {
        // @ts-expect-error strictNullChecks migration
        contextChunks.push({
          ...chunk,
          metadata: {
            ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
            documentName: doc.name,
          },
          retrievalMethod: 'context',
        });
        existingChunkIds.add(chunk.id);
      }
    }
  }
  log.push(`Context pass: ${contextChunks.length} total context chunks`);

  // Combine with preference for precision chunks
  const allChunks = [...precisionChunks, ...contextChunks].slice(0, limit);
  log.push(`Final retrieval: ${allChunks.length} chunks (${precisionChunks.length} precision, ${contextChunks.length - (allChunks.length - precisionChunks.length)} context)`);

  return { chunks: allChunks, retrievalLog: log };
}

/**
 * Cross-reference bundling: Find related chunks (e.g., door tag -> schedule, detail callout -> detail sheet)
 */
export async function bundleCrossReferences(
  chunks: EnhancedChunk[],
  projectSlug: string
): Promise<{ enrichedChunks: EnhancedChunk[]; crossRefLog: string[] }> {
  const log: string[] = [];
  const enrichedChunks: EnhancedChunk[] = [...chunks];

  // Get project ID
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });

  if (!project) {
    return { enrichedChunks, crossRefLog: ['Project not found'] };
  }

  // Extract cross-reference hints from existing chunks
  const crossRefs = new Set<string>();

  for (const chunk of chunks) {
    const content = chunk.content;

    // Look for door/window references
    const doorMatches = content.match(/\b[DW]-?\d{1,3}\b/gi);
    if (doorMatches) {
      doorMatches.forEach(m => crossRefs.add(m));
    }

    // Look for detail callouts
    const detailMatches = content.match(/\b\d+\/[A-Z]-?\d{1,3}\b/gi);
    if (detailMatches) {
      detailMatches.forEach(m => crossRefs.add(m));
    }

    // Look for "See schedule" references
    if (/see (door|window|fixture|equipment|panel) schedule/i.test(content)) {
      crossRefs.add('SCHEDULE');
    }
  }

  log.push(`Found ${crossRefs.size} cross-reference hints`);

  // Fetch cross-referenced chunks
  if (crossRefs.size > 0) {
    const crossRefChunks = await prisma.document.findMany({
      where: {
        projectId: project.id,
        processed: true,
      },
      include: {
        DocumentChunk: {
          where: {
            OR: Array.from(crossRefs).map(ref => ({
              content: { contains: ref, mode: 'insensitive' },
            })),
          },
          take: 5,
        },
      },
    });

    // Build Set of existing chunk IDs for O(1) duplicate checking
    const enrichedChunkIds = new Set(enrichedChunks.map(c => c.id));

    for (const doc of crossRefChunks) {
      for (const chunk of doc.DocumentChunk) {
        // Avoid duplicates using Set lookup (O(1) instead of O(N))
        if (!enrichedChunkIds.has(chunk.id)) {
          // @ts-expect-error strictNullChecks migration
          enrichedChunks.push({
            ...chunk,
            metadata: {
              ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
              documentName: doc.name,
            },
            retrievalMethod: 'cross_reference',
          });
          enrichedChunkIds.add(chunk.id);
        }
      }
    }

    log.push(`Added ${enrichedChunks.length - chunks.length} cross-referenced chunks`);
  }

  return { enrichedChunks, crossRefLog: log };
}

/**
 * MEP-Specific Retrieval Order:
 * 1) Applicable schedule row (equipment, fixture, panel, lighting)
 * 2) System keynotes and general notes
 * 3) Plan view containing the relevant tag or symbol
 * 4) Riser, isometric, or one-line diagram
 * 5) Spec references (if provided)
 */
export async function mepRetrievalOrder(
  chunks: EnhancedChunk[],
  projectSlug: string,
  mepTrade: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm',
  identifiers: string[]
): Promise<{ orderedChunks: EnhancedChunk[]; mepLog: string[] }> {
  const log: string[] = [];
  const orderedChunks: EnhancedChunk[] = [];
  const chunkIds = new Set<string>();

  log.push(`MEP Trade: ${mepTrade}, Identifiers: ${identifiers.join(', ')}`);

  // Helper function to add unique chunks
  const addChunk = (chunk: EnhancedChunk, source: string) => {
    if (!chunkIds.has(chunk.id)) {
      orderedChunks.push({ ...chunk, sourceReference: source });
      chunkIds.add(chunk.id);
    }
  };

  // PRIORITY 1: Schedule rows
  const scheduleChunks = chunks.filter(c =>
    /\b(schedule|legend|symbol|key)\b/i.test(c.content) &&
    identifiers.some(id => new RegExp(id, 'i').test(c.content))
  );
  scheduleChunks.forEach(c => addChunk(c, 'MEP Schedule'));
  log.push(`Schedules: ${scheduleChunks.length} chunks`);

  // PRIORITY 2: System keynotes and general notes
  const notePatterns = [
    /\b(MECHANICAL|ELECTRICAL|PLUMBING|FIRE ALARM)\s+(GENERAL\s+)?NOTES\b/i,
    /\bKEY\s*NOTES\b/i,
    /\bSYSTEM\s+NOTES\b/i,
  ];
  const noteChunks = chunks.filter(c =>
    notePatterns.some(p => p.test(c.content))
  );
  noteChunks.forEach(c => addChunk(c, 'MEP Notes'));
  log.push(`Notes: ${noteChunks.length} chunks`);

  // PRIORITY 3: Plan view with equipment tags
  const planChunks = chunks.filter(c =>
    /\b(PLAN|LAYOUT|FLOOR)\b/i.test(c.content) &&
    identifiers.some(id => new RegExp(id, 'i').test(c.content))
  );
  planChunks.forEach(c => addChunk(c, 'MEP Plan View'));
  log.push(`Plan Views: ${planChunks.length} chunks`);

  // PRIORITY 4: Diagrams (riser, one-line, isometric, schematic)
  const diagramPatterns = [
    /\b(RISER|ISOMETRIC|ONE-LINE|SCHEMATIC|DIAGRAM)\b/i,
  ];
  const diagramChunks = chunks.filter(c =>
    diagramPatterns.some(p => p.test(c.content))
  );
  diagramChunks.forEach(c => addChunk(c, 'MEP Diagram'));
  log.push(`Diagrams: ${diagramChunks.length} chunks`);

  // PRIORITY 5: Spec references
  const specChunks = chunks.filter(c =>
    /\b(SPEC|SPECIFICATION|DIVISION\s+\d{2})\b/i.test(c.content)
  );
  specChunks.forEach(c => addChunk(c, 'MEP Specifications'));
  log.push(`Specs: ${specChunks.length} chunks`);

  // Add remaining chunks not captured
  chunks.forEach(c => {
    if (!chunkIds.has(c.id)) {
      orderedChunks.push({ ...c, sourceReference: 'Additional Context' });
    }
  });

  log.push(`Total ordered: ${orderedChunks.length} chunks`);
  return { orderedChunks, mepLog: log };
}
