/**
 * Regulatory Documents Caching Service
 * 
 * This service manages the caching and sharing of regulatory documents (ADA, IBC, NFPA, etc.)
 * across multiple projects to avoid reprocessing the same documents.
 * 
 * Key Features:
 * - One-time processing: Process each regulatory standard once, share across all projects
 * - Cost savings: 100% savings after first processing (no re-processing costs)
 * - Smart caching: Checks if document is already processed before starting new processing
 * - Chunk copying: Efficiently copies cached chunks to new projects
 * - Version management: Supports multiple versions of the same standard
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

export interface RegulatoryDocumentInfo {
  type: 'building_code' | 'fire_code' | 'accessibility' | 'energy_code' | 'plumbing_code' | 'electrical_code' | 'mechanical_code';
  standard: string; // e.g., "ADA 2010", "IBC 2021", "NFPA 101 2012"
  version: string;
  jurisdiction?: string;
  filePath: string;
}

/**
 * Predefined regulatory documents available in the system
 */
export const AVAILABLE_REGULATORY_DOCUMENTS: RegulatoryDocumentInfo[] = [
  {
    type: 'accessibility',
    standard: 'ADA 2010 Standards',
    version: '2010',
    jurisdiction: 'Federal',
    filePath: 'public/regulatory-documents/ADA_2010_Standards.pdf',
  },
  {
    type: 'building_code',
    standard: 'IBC 2021',
    version: '2021',
    jurisdiction: 'International',
    filePath: 'public/regulatory-documents/IBC_2021.pdf',
  },
  {
    type: 'fire_code',
    standard: 'NFPA 101 2012',
    version: '2012',
    jurisdiction: 'National',
    filePath: 'public/regulatory-documents/NFPA_101_2012.pdf',
  },
];

/**
 * Check if a regulatory document is already processed and cached
 */
export async function isRegulatoryDocumentCached(
  standard: string,
  version: string
): Promise<{
  cached: boolean;
  regulatoryDocId?: string;
  chunkCount?: number;
  processorType?: string;
}> {
  const regDoc = await prisma.regulatoryDocument.findFirst({
    where: {
      standard,
      version,
      processed: true,
    },
    select: {
      id: true,
      processorType: true,
      _count: { select: { DocumentChunk: true } },
    },
  });

  if (regDoc) {
    return {
      cached: true,
      regulatoryDocId: regDoc.id,
      chunkCount: regDoc._count.DocumentChunk,
      processorType: regDoc.processorType || undefined,
    };
  }

  return { cached: false };
}

/**
 * Link cached regulatory document chunks to a new project
 * 
 * This creates project-specific references to the cached regulatory chunks
 * without duplicating the chunk data.
 */
export async function linkRegulatoryDocumentToProject(
  projectId: string,
  standard: string,
  version: string
): Promise<{
  success: boolean;
  chunksLinked?: number;
  error?: string;
}> {
  try {
    logger.info('REGULATORY_DOCS', `Linking ${standard} ${version} to project`, { projectId });

    // Check if regulatory document exists and is processed
    const regDoc = await prisma.regulatoryDocument.findFirst({
      where: {
        standard,
        version,
        processed: true,
      },
      include: {
        DocumentChunk: {
          select: {
            id: true,
            content: true,
            metadata: true,
            chunkIndex: true,
          },
        },
      },
    });

    if (!regDoc) {
      return {
        success: false,
        error: `Regulatory document ${standard} ${version} not found or not processed`,
      };
    }

    if ((regDoc.DocumentChunk?.length || 0) === 0) {
      return {
        success: false,
        error: `Regulatory document ${standard} ${version} has no chunks`,
      };
    }

    // Check if project already has this regulatory document linked
    const existingLink = await prisma.regulatoryDocument.findFirst({
      where: {
        projectId,
        standard,
        version,
      },
    });

    if (existingLink) {
      logger.info('REGULATORY_DOCS', `Project already has ${standard} ${version} linked`, { projectId });
      return {
        success: true,
        chunksLinked: regDoc.DocumentChunk?.length || 0,
      };
    }

    // Create a new regulatory document entry for this project (reference to cached data)
    const projectRegDoc = await prisma.regulatoryDocument.create({
      data: {
        projectId,
        type: regDoc.type,
        jurisdiction: regDoc.jurisdiction,
        standard: regDoc.standard,
        version: regDoc.version,
        sourceUrl: regDoc.sourceUrl,
        lastUpdated: regDoc.lastUpdated,
        expiresAt: regDoc.expiresAt,
        processed: true,
        processorType: regDoc.processorType,
        processingCost: 0, // No cost for using cached data
        pagesProcessed: regDoc.pagesProcessed,
      },
    });

    // Copy chunks to project-specific regulatory document
    // Note: This creates new chunk records that reference the project's regulatory doc
    const chunkPromises = regDoc.DocumentChunk.map((chunk: any, _index: number) =>
      prisma.documentChunk.create({
        data: {
          content: chunk.content,
          regulatoryDocumentId: projectRegDoc.id,
          chunkIndex: chunk.chunkIndex,
          metadata: chunk.metadata as any, // Cast to any to handle JsonValue type
        },
      })
    );

    await Promise.all(chunkPromises);

    logger.info('REGULATORY_DOCS', `Successfully linked chunks to project`, { chunksLinked: regDoc.DocumentChunk?.length || 0, standard, version, projectId });

    return {
      success: true,
      chunksLinked: regDoc.DocumentChunk?.length || 0,
    };
  } catch (error) {
    logger.error('REGULATORY_DOCS', 'Error linking regulatory document', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get or create a cached regulatory document for a project
 * 
 * This is the main entry point for accessing regulatory documents.
 * It will:
 * 1. Check if the document is cached
 * 2. If cached, link it to the project
 * 3. If not cached, trigger processing
 */
export async function ensureRegulatoryDocumentForProject(
  projectId: string,
  standard: string,
  version: string
): Promise<{
  success: boolean;
  cached: boolean;
  chunksAvailable?: number;
  needsProcessing?: boolean;
  error?: string;
}> {
  try {
    // Check if already cached
    const cacheStatus = await isRegulatoryDocumentCached(standard, version);

    if (cacheStatus.cached) {
      // Link to project
      const linkResult = await linkRegulatoryDocumentToProject(
        projectId,
        standard,
        version
      );

      if (linkResult.success) {
        return {
          success: true,
          cached: true,
          chunksAvailable: linkResult.chunksLinked,
        };
      } else {
        return {
          success: false,
          cached: true,
          error: linkResult.error,
        };
      }
    }

    // Not cached - needs processing
    return {
      success: true,
      cached: false,
      needsProcessing: true,
    };
  } catch (error) {
    logger.error('REGULATORY_DOCS', 'Error ensuring regulatory document', error as Error);
    return {
      success: false,
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all available regulatory documents with their cache status
 */
export async function getRegulatoryDocumentsStatus(): Promise<
  Array<{
    standard: string;
    version: string;
    type: string;
    cached: boolean;
    chunkCount: number;
    processorType?: string;
    processingCost?: number;
    filePath: string;
  }>
> {
  const statuses = await Promise.all(
    AVAILABLE_REGULATORY_DOCUMENTS.map(async (doc) => {
      const cacheStatus = await isRegulatoryDocumentCached(
        doc.standard,
        doc.version
      );

      return {
        standard: doc.standard,
        version: doc.version,
        type: doc.type,
        cached: cacheStatus.cached,
        chunkCount: cacheStatus.chunkCount || 0,
        processorType: cacheStatus.processorType,
        filePath: doc.filePath,
      };
    })
  );

  return statuses;
}

/**
 * Initialize regulatory documents for a project
 * 
 * This links all available cached regulatory documents to a new project.
 * Should be called when a new project is created.
 */
/**
 * Legacy compatibility functions for existing APIs
 * These wrap the new caching system to maintain backward compatibility
 */

/**
 * Get regulatory documents for a project
 */
export async function getProjectRegulatoryDocuments(projectId: string) {
  const documents = await prisma.regulatoryDocument.findMany({
    where: { projectId },
    include: {
      _count: { select: { DocumentChunk: true } },
    },
  });

  return documents.map((doc: any) => ({
    id: doc.id,
    standard: doc.standard,
    version: doc.version,
    type: doc.type,
    jurisdiction: doc.jurisdiction,
    processed: doc.processed,
    pagesProcessed: doc.pagesProcessed,
    processingCost: doc.processingCost,
    chunkCount: doc._count.chunks,
  }));
}

/**
 * Get stats for regulatory documents in a project (alias for compatibility)
 */
export async function getRegulatoryDocumentStats(projectId: string) {
  const documents = await prisma.regulatoryDocument.findMany({
    where: { projectId },
  });

  return {
    total: documents.length,
    processed: documents.filter((d: any) => d.processed).length,
    totalChunks: await prisma.documentChunk.count({
      where: { regulatoryDocumentId: { in: documents.map((d: any) => d.id) } },
    }),
    totalCost: documents.reduce((sum: any, d: any) => sum + (d.processingCost || 0), 0),
  };
}

/**
 * Get applicable regulatory codes for a location
 */
export function getApplicableRegulatoryCodes(_location: {
  state?: string;
  city?: string;
  country?: string;
}) {
  // Return the available cached documents
  return AVAILABLE_REGULATORY_DOCUMENTS.map((doc) => ({
    standard: doc.standard,
    version: doc.version,
    type: doc.type,
    jurisdiction: doc.jurisdiction,
    isFree: true, // All cached documents are "free" to use
  }));
}

/**
 * Get free regulatory codes
 */
export function getFreeRegulatoryCodes(location: {
  state?: string;
  city?: string;
  country?: string;
}) {
  // All cached documents are free
  return getApplicableRegulatoryCodes(location);
}

/**
 * Calculate regulatory processing cost
 */
export function calculateRegulatoryProcessingCost(_codes: any[]) {
  // Since we're using caching, the cost is $0 for already-cached documents
  return {
    estimatedCost: 0,
    message: 'Using cached regulatory documents - no processing cost',
  };
}

/**
 * Create regulatory documents for a project
 */
export async function createRegulatoryDocuments(
  projectId: string,
  codes: Array<{ standard: string; version: string }>
) {
  const results = [];

  for (const code of codes) {
    const result = await ensureRegulatoryDocumentForProject(
      projectId,
      code.standard,
      code.version
    );

    // @ts-expect-error strictNullChecks migration
    results.push({
      standard: code.standard,
      version: code.version,
      success: result.success,
      cached: result.cached,
      alreadyExists: result.cached,
      needsProcessing: result.needsProcessing,
      error: result.error,
    });
  }

  return results;
}

/**
 * Initialize regulatory documents for a project
 * 
 * This links all available cached regulatory documents to a new project.
 * Should be called when a new project is created.
 */
export async function initializeRegulatoryDocumentsForProject(
  projectId: string
): Promise<{
  success: boolean;
  documentsLinked: number;
  documentsNeedingProcessing: number;
  details: Array<{
    standard: string;
    status: 'linked' | 'needs_processing' | 'error';
    error?: string;
  }>;
}> {
  logger.info('REGULATORY_DOCS', 'Initializing regulatory documents for project', { projectId });

  const results = await Promise.all(
    AVAILABLE_REGULATORY_DOCUMENTS.map(async (doc) => {
      const result = await ensureRegulatoryDocumentForProject(
        projectId,
        doc.standard,
        doc.version
      );

      if (result.success && result.cached) {
        return {
          standard: doc.standard,
          status: 'linked' as const,
        };
      } else if (result.needsProcessing) {
        return {
          standard: doc.standard,
          status: 'needs_processing' as const,
        };
      } else {
        return {
          standard: doc.standard,
          status: 'error' as const,
          error: result.error,
        };
      }
    })
  );

  const linked = results.filter((r) => r.status === 'linked').length;
  const needsProcessing = results.filter((r) => r.status === 'needs_processing').length;

  logger.info('REGULATORY_DOCS', 'Initialization complete', { linked, needsProcessing });

  return {
    success: true,
    documentsLinked: linked,
    documentsNeedingProcessing: needsProcessing,
    details: results,
  };
}
