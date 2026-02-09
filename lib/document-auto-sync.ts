/**
 * Document Auto-Sync Orchestrator
 * Main entry point for automatic document processing and feature updates
 */

import { prisma } from '@/lib/db';
import {
  getExtractableFeatures,
  determineSourceType,
  shouldOverrideExisting,
  DATA_SOURCE_PRIORITY,
  FeatureType,
  DataSourceType,
} from './document-intelligence-router';
import {
  syncScaleData,
  syncRoomData,
  syncDoorData,
  syncMEPData,
  syncScheduleData,
  syncDimensionData,
  syncLegendData,
  syncMaterialsData,
} from './feature-sync-services';
import { processUploadedBudgetDocument } from './budget-auto-sync';
import { compareRevisions } from './revision-comparator';
import { logger } from '@/lib/logger';

export interface FeatureSyncResult {
  extracted?: boolean;
  skipped?: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface SyncResult {
  documentId: string;
  fileName: string;
  sourceType: string;
  confidence: number;
  featuresProcessed: string[];
  featuresSkipped: string[];
  results: Record<string, FeatureSyncResult>;
  errors: string[];
}

/**
 * Process a newly uploaded document and sync all extractable features
 */
export async function processDocumentForSync(
  documentId: string,
  projectId: string
): Promise<SyncResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, fileName: true, category: true },
  });

  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  const sourceType = determineSourceType(document.fileName, document.category);
  const confidence = DATA_SOURCE_PRIORITY[sourceType];
  const features = getExtractableFeatures(document.category, document.fileName);

  console.log(`[Auto-Sync] Processing ${document.fileName} (${sourceType}, confidence: ${confidence})`);
  console.log(`[Auto-Sync] Extractable features: ${features.join(', ')}`);

  const result: SyncResult = {
    documentId,
    fileName: document.fileName,
    sourceType,
    confidence,
    featuresProcessed: [],
    featuresSkipped: [],
    results: {},
    errors: [],
  };

  for (const feature of features) {
    try {
      // Check if we should process this feature
      const { shouldOverride, existingSource, existingConfidence } = 
        await shouldOverrideExisting(projectId, feature, sourceType);

      if (!shouldOverride) {
        console.log(`[Auto-Sync] Skipping ${feature}: existing ${existingSource} (${existingConfidence}) is higher confidence than ${sourceType} (${confidence})`);
        result.featuresSkipped.push(`${feature} (existing: ${existingSource})`);
        continue;
      }

      console.log(`[Auto-Sync] Processing ${feature}...`);
      
      // Route to appropriate sync service
      const syncResult = await syncFeature(feature, projectId, documentId, sourceType);
      result.results[feature] = syncResult;
      result.featuresProcessed.push(feature);
      
      console.log(`[Auto-Sync] ${feature} complete:`, syncResult);
    } catch (error: unknown) {
      console.error(`[Auto-Sync] Error processing ${feature}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${feature}: ${message}`);
    }
  }

  // Run revision comparison (non-blocking) for plans/drawings documents
  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { category: true },
    });
    if (doc?.category === 'plans_drawings') {
      const comparison = await compareRevisions(documentId, projectId);
      if (comparison.hasOverlap) {
        logger.info('AUTO_SYNC', 'Revision comparison detected overlapping sheets', {
          documentId,
          overlappingSheets: comparison.overlappingSheets.length,
          diffs: comparison.diffs.length,
        });
      }
    }
  } catch (revError) {
    logger.warn('AUTO_SYNC', 'Revision comparison failed (non-blocking)', {
      documentId,
      error: (revError as Error).message,
    });
  }

  return result;
}

/**
 * Route feature to appropriate sync service
 */
async function syncFeature(
  feature: FeatureType,
  projectId: string,
  documentId: string,
  sourceType: DataSourceType
): Promise<FeatureSyncResult> {
  switch (feature) {
    case 'scale':
      return syncScaleData(projectId, documentId, sourceType);

    case 'rooms':
      return syncRoomData(projectId, documentId, sourceType);

    case 'doors':
      return syncDoorData(projectId, documentId, sourceType);

    case 'windows':
      // Windows use same extraction as doors
      return syncDoorData(projectId, documentId, sourceType);

    case 'mep_electrical':
      return syncMEPData(projectId, documentId, sourceType, 'mep_electrical');

    case 'mep_plumbing':
      return syncMEPData(projectId, documentId, sourceType, 'mep_plumbing');

    case 'mep_hvac':
      return syncMEPData(projectId, documentId, sourceType, 'mep_hvac');

    case 'budget':
      return processUploadedBudgetDocument(documentId, projectId);

    case 'schedule':
      return syncScheduleData(projectId, documentId, sourceType);

    case 'dimensions':
      return syncDimensionData(projectId, documentId, sourceType);

    case 'legends':
      return syncLegendData(projectId, documentId, sourceType);

    case 'title_blocks':
      // Title blocks are extracted during document processing
      return { extracted: true };

    case 'materials':
      return syncMaterialsData(projectId, documentId, sourceType);

    default:
      console.warn(`[Auto-Sync] No sync handler for feature: ${feature}`);
      return { skipped: true, reason: 'No handler' };
  }
}

/**
 * Manually trigger sync for all documents in a project
 */
export async function syncAllProjectDocuments(
  projectId: string
): Promise<{ processed: number; results: SyncResult[] }> {
  const documents = await prisma.document.findMany({
    where: {
      projectId,
      processed: true,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  const results: SyncResult[] = [];
  
  for (const doc of documents) {
    try {
      const result = await processDocumentForSync(doc.id, projectId);
      results.push(result);
    } catch (error: unknown) {
      console.error(`[Auto-Sync] Error processing ${doc.fileName}:`, error);
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        documentId: doc.id,
        fileName: doc.fileName,
        sourceType: 'unknown',
        confidence: 0,
        featuresProcessed: [],
        featuresSkipped: [],
        results: {},
        errors: [message],
      });
    }
  }

  return { processed: documents.length, results };
}

/**
 * Handle document deletion: re-sync affected features from next-best available source
 * This should be called BEFORE deleting ProjectDataSource records
 */
export async function handleDocumentDeletion(
  documentId: string,
  projectId: string
): Promise<{
  featuresAffected: string[];
  featuresResynced: string[];
  featuresCleared: string[];
  errors: string[];
}> {
  const result = {
    featuresAffected: [] as string[],
    featuresResynced: [] as string[],
    featuresCleared: [] as string[],
    errors: [] as string[],
  };

  try {
    // Find all features that were sourced from this document
    const affectedSources = await prisma.projectDataSource.findMany({
      where: { documentId, projectId },
      select: { featureType: true, sourceType: true, confidence: true },
    });

    if (affectedSources.length === 0) {
      console.log(`[Auto-Sync] No data sources found for deleted document ${documentId}`);
      return result;
    }

    result.featuresAffected = affectedSources.map(s => s.featureType);
    console.log(`[Auto-Sync] Document deletion affects features: ${result.featuresAffected.join(', ')}`);

    // Get all remaining documents in the project
    const remainingDocs = await prisma.document.findMany({
      where: {
        projectId,
        processed: true,
        deletedAt: null,
        id: { not: documentId }, // Exclude the document being deleted
      },
      select: { id: true, fileName: true, category: true },
    });

    // For each affected feature, find the next-best source and re-sync
    for (const affected of affectedSources) {
      const feature = affected.featureType as FeatureType;
      
      try {
        // Find documents that can provide this feature, sorted by priority
        const candidateDocs = remainingDocs
          .map(doc => ({
            ...doc,
            sourceType: determineSourceType(doc.fileName, doc.category),
            features: getExtractableFeatures(doc.category, doc.fileName),
          }))
          .filter(doc => doc.features.includes(feature))
          .sort((a, b) => DATA_SOURCE_PRIORITY[b.sourceType] - DATA_SOURCE_PRIORITY[a.sourceType]);

        if (candidateDocs.length > 0) {
          const nextBest = candidateDocs[0];
          console.log(`[Auto-Sync] Re-syncing ${feature} from ${nextBest.fileName} (${nextBest.sourceType})`);
          
          // Delete the old data source first
          await prisma.projectDataSource.deleteMany({
            where: { projectId, featureType: feature, documentId },
          });
          
          // Sync from the next-best document
          await syncFeature(feature, projectId, nextBest.id, nextBest.sourceType);
          result.featuresResynced.push(feature);
        } else {
          console.log(`[Auto-Sync] No alternative source for ${feature}, clearing data`);
          
          // Delete the data source and clear related project data
          await prisma.projectDataSource.deleteMany({
            where: { projectId, featureType: feature, documentId },
          });
          
          // Clear feature-specific data if needed
          await clearFeatureData(projectId, feature);
          result.featuresCleared.push(feature);
        }
      } catch (error: unknown) {
        console.error(`[Auto-Sync] Error re-syncing ${feature}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`${feature}: ${message}`);
      }
    }

    console.log(`[Auto-Sync] Document deletion complete: resynced ${result.featuresResynced.length}, cleared ${result.featuresCleared.length}`);
  } catch (error: unknown) {
    console.error(`[Auto-Sync] Error handling document deletion:`, error);
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
  }

  return result;
}

/**
 * Clear feature-specific data when no source remains
 */
async function clearFeatureData(projectId: string, feature: FeatureType): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) return;

  switch (feature) {
    case 'schedule':
      // Mark schedules as inactive or clear task counts
      await prisma.schedule.updateMany({
        where: { projectId },
        data: { isActive: false },
      });
      console.log(`[Auto-Sync] Deactivated schedules for project ${projectId}`);
      break;

    case 'budget':
      // Clear budget actuals but keep structure
      // Note: We don't delete budget items as they may have manual entries
      console.log(`[Auto-Sync] Budget source removed - manual entries preserved`);
      break;

    case 'rooms':
      // Clear room count from project if tracked there
      console.log(`[Auto-Sync] Room data source cleared`);
      break;

    case 'mep_electrical':
    case 'mep_plumbing':
    case 'mep_hvac':
      console.log(`[Auto-Sync] MEP ${feature} data source cleared`);
      break;

    default:
      console.log(`[Auto-Sync] Feature ${feature} data source cleared (no additional cleanup needed)`);
  }
}

export async function getProjectSyncStatus(projectId: string): Promise<{
  features: Record<string, {
    hasData: boolean;
    sourceType: string | null;
    confidence: number;
    documentName: string | null;
    extractedAt: Date | null;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    sourceType: string;
    confidence: number;
    features: string[];
  }>;
}> {
  const dataSources = await prisma.projectDataSource.findMany({
    where: { projectId },
    include: {
      Document: { select: { fileName: true } },
    },
  });

  const documents = await prisma.document.findMany({
    where: { projectId, processed: true, deletedAt: null },
    select: { id: true, fileName: true, category: true },
  });

  // Build feature status
  const featureTypes: FeatureType[] = [
    'scale', 'dimensions', 'rooms', 'doors', 'windows',
    'mep_electrical', 'mep_plumbing', 'mep_hvac',
    'budget', 'schedule', 'legends', 'title_blocks', 'materials'
  ];

  const features: Record<string, {
    hasData: boolean;
    sourceType: string | null;
    confidence: number;
    documentName: string | null;
    extractedAt: Date | null;
  }> = {};
  for (const ft of featureTypes) {
    const source = dataSources.find(ds => ds.featureType === ft);
    features[ft] = {
      hasData: !!source,
      sourceType: source?.sourceType || null,
      confidence: source?.confidence || 0,
      documentName: source?.Document?.fileName || null,
      extractedAt: source?.extractedAt || null,
    };
  }

  // Build document list with extractable features
  const docList = documents.map(doc => {
    const sourceType = determineSourceType(doc.fileName, doc.category);
    return {
      id: doc.id,
      fileName: doc.fileName,
      sourceType,
      confidence: DATA_SOURCE_PRIORITY[sourceType],
      features: getExtractableFeatures(doc.category, doc.fileName),
    };
  });

  return { features, documents: docList };
}
