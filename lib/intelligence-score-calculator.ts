/**
 * Intelligence Score Calculator
 * Calculates comprehensive intelligence quality scores based on extraction,
 * classification, enrichment, and pipeline coverage metrics.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Types
export interface IntelligenceMetrics {
  totalSheets: number;
  averageConfidence: number;
  lowConfidenceSheetCount: number;
  roomsExtracted: number;
  fixturesExtracted: number;
  dimensionsExtracted: number;
  crossReferencesResolved: number;
  totalCrossReferences: number;
  drawingTypesClassified: number;
  averageClassificationConfidence: number;
  doorScheduleItems: number;
  windowScheduleItems: number;
  materialTakeoffItems: number;
  documentsProcessed: number;
  documentsTotal: number;
}

export interface IntelligenceChecklistItem {
  id: string;
  category: 'extraction' | 'classification' | 'enrichment' | 'coverage';
  label: string;
  status: 'complete' | 'partial' | 'missing';
  currentValue: number | string;
  targetValue: number | string;
  actionLabel?: string;
  actionHref?: string;
  weight: number;
}

export interface IntelligenceScoreResult {
  overall: number;
  extractionQuality: number;
  entityCompleteness: number;
  classificationAccuracy: number;
  enrichmentSuccess: number;
  pipelineCoverage: number;
  checklist: IntelligenceChecklistItem[];
}

/**
 * Calculate intelligence scores from project metrics
 */
export function calculateIntelligenceScore(metrics: IntelligenceMetrics): IntelligenceScoreResult {
  const extractionQuality = calculateExtractionQuality(metrics);
  const entityCompleteness = calculateEntityCompleteness(metrics);
  const classificationAccuracy = calculateClassificationAccuracy(metrics);
  const enrichmentSuccess = calculateEnrichmentSuccess(metrics);
  const pipelineCoverage = calculatePipelineCoverage(metrics);

  const overall = Math.round(
    extractionQuality * 0.30 +
    entityCompleteness * 0.25 +
    classificationAccuracy * 0.15 +
    enrichmentSuccess * 0.15 +
    pipelineCoverage * 0.15
  );

  const scores: Omit<IntelligenceScoreResult, 'checklist'> = {
    overall,
    extractionQuality,
    entityCompleteness,
    classificationAccuracy,
    enrichmentSuccess,
    pipelineCoverage,
  };

  const checklist = buildChecklist(metrics, scores);

  return { ...scores, checklist };
}

/**
 * Fetch intelligence metrics for a project from the database
 */
export async function getProjectIntelligenceMetrics(projectId: string): Promise<IntelligenceMetrics> {
  const results = await Promise.allSettled([
    // 0: DocumentChunks with metadata for sheet numbers and confidence
    prisma.documentChunk.findMany({
      where: { Document: { projectId } },
      select: {
        metadata: true,
        sheetNumber: true,
        drawingTypeConfidence: true,
      },
      take: 5000,
    }),
    // 1: Room count
    prisma.room.count({ where: { projectId } }),
    // 2: DimensionAnnotation count
    prisma.dimensionAnnotation.count({ where: { projectId } }),
    // 3: DetailCallout count (total cross-references)
    prisma.detailCallout.count({ where: { projectId } }),
    // 4: DetailCallout resolved (those with non-null sourceLocation)
    prisma.detailCallout.count({
      where: { projectId, sourceLocation: { not: null } },
    }),
    // 5: DrawingType records with confidence
    prisma.drawingType.findMany({
      where: { projectId },
      select: { confidence: true },
    }),
    // 6: DoorScheduleItem count
    prisma.doorScheduleItem.count({ where: { projectId } }),
    // 7: WindowScheduleItem count
    prisma.windowScheduleItem.count({ where: { projectId } }),
    // 8: TakeoffLineItem count via MaterialTakeoff
    prisma.takeoffLineItem.count({
      where: { MaterialTakeoff: { projectId } },
    }),
    // 9: Documents processed
    prisma.document.count({ where: { projectId, processed: true } }),
    // 10: Documents total
    prisma.document.count({ where: { projectId } }),
  ]);

  const getValue = <T>(index: number, fallback: T): T => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      return result.value as T;
    }
    logger.warn('INTELLIGENCE_SCORE', `Query ${index} failed`, {
      reason: result.reason?.message || String(result.reason),
    });
    return fallback;
  };

  // Process chunks for sheet/confidence data
  const chunks = getValue<Array<{ metadata: any; sheetNumber: string | null; drawingTypeConfidence: number | null }>>(0, []);
  const sheetNumbers = new Set<string>();
  let totalConfidence = 0;
  let confidenceCount = 0;
  let lowConfidenceCount = 0;
  const fixtureSheets = new Set<string>();

  for (const chunk of chunks) {
    if (chunk.sheetNumber) {
      sheetNumbers.add(chunk.sheetNumber);
    }

    const metadata = chunk.metadata as Record<string, unknown> | null;
    if (metadata) {
      const confidence = typeof metadata.confidence === 'number'
        ? metadata.confidence
        : chunk.drawingTypeConfidence ?? null;

      if (confidence !== null) {
        totalConfidence += confidence;
        confidenceCount++;
        if (confidence < 0.5) {
          lowConfidenceCount++;
        }
      }

      // Count fixture references from metadata
      const fixtures = metadata.plumbingFixtures || metadata.electricalDevices;
      if (fixtures && Array.isArray(fixtures) && fixtures.length > 0) {
        fixtureSheets.add(chunk.sheetNumber || chunk.metadata?.sheet_number || 'unknown');
      }
    }
  }

  const drawingTypes = getValue<Array<{ confidence: number }>>(5, []);
  const avgClassificationConfidence = drawingTypes.length > 0
    ? drawingTypes.reduce((sum, dt) => sum + dt.confidence, 0) / drawingTypes.length
    : 0;

  return {
    totalSheets: sheetNumbers.size,
    averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    lowConfidenceSheetCount: lowConfidenceCount,
    roomsExtracted: getValue<number>(1, 0),
    fixturesExtracted: fixtureSheets.size,
    dimensionsExtracted: getValue<number>(2, 0),
    crossReferencesResolved: getValue<number>(4, 0),
    totalCrossReferences: getValue<number>(3, 0),
    drawingTypesClassified: drawingTypes.length,
    averageClassificationConfidence: avgClassificationConfidence,
    doorScheduleItems: getValue<number>(6, 0),
    windowScheduleItems: getValue<number>(7, 0),
    materialTakeoffItems: getValue<number>(8, 0),
    documentsProcessed: getValue<number>(9, 0),
    documentsTotal: getValue<number>(10, 0),
  };
}

// Internal scoring functions

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Extraction Quality (30% weight)
 * Based on average confidence with penalties for low-confidence sheets
 */
function calculateExtractionQuality(metrics: IntelligenceMetrics): number {
  if (metrics.totalSheets === 0) return 0;

  let score = metrics.averageConfidence * 100;

  const lowConfidenceRatio = metrics.totalSheets > 0
    ? metrics.lowConfidenceSheetCount / metrics.totalSheets
    : 0;

  if (lowConfidenceRatio > 0.5) {
    score -= 40;
  } else if (lowConfidenceRatio > 0.2) {
    score -= 20;
  }

  return clamp(Math.round(score), 0, 100);
}

/**
 * Entity Completeness (25% weight)
 * Rooms, fixtures, dimensions, and cross-reference resolution
 */
function calculateEntityCompleteness(metrics: IntelligenceMetrics): number {
  let score = 0;

  // Rooms: up to 40 points
  if (metrics.roomsExtracted > 0) {
    score += Math.min(40, 20 + Math.min(20, metrics.roomsExtracted));
  }

  // Fixtures: up to 20 points
  if (metrics.fixturesExtracted > 0) {
    score += Math.min(20, 10 + Math.min(10, metrics.fixturesExtracted));
  }

  // Dimensions: up to 20 points
  if (metrics.dimensionsExtracted > 0) {
    score += Math.min(20, 10 + Math.min(10, metrics.dimensionsExtracted));
  }

  // Cross-reference resolution rate: up to 20 points
  if (metrics.totalCrossReferences > 0) {
    const resolutionRate = metrics.crossReferencesResolved / metrics.totalCrossReferences;
    score += Math.round(resolutionRate * 20);
  }

  return clamp(Math.round(score), 0, 100);
}

/**
 * Classification Accuracy (15% weight)
 * Based on drawing type classification confidence
 */
function calculateClassificationAccuracy(metrics: IntelligenceMetrics): number {
  if (metrics.drawingTypesClassified === 0) return 0;
  return clamp(Math.round(metrics.averageClassificationConfidence * 100), 0, 100);
}

/**
 * Enrichment Success (15% weight)
 * +20 for each enrichment pipeline that produced results
 */
function calculateEnrichmentSuccess(metrics: IntelligenceMetrics): number {
  let score = 0;

  if (metrics.doorScheduleItems > 0) score += 20;
  if (metrics.windowScheduleItems > 0) score += 20;
  if (metrics.materialTakeoffItems > 0) score += 20;
  if (metrics.drawingTypesClassified > 0) score += 20;
  if (metrics.totalSheets > 10) score += 20;

  return clamp(score, 0, 100);
}

/**
 * Pipeline Coverage (15% weight)
 * Percentage of documents that have been processed
 */
function calculatePipelineCoverage(metrics: IntelligenceMetrics): number {
  if (metrics.documentsTotal === 0) return 0;
  return clamp(
    Math.round((metrics.documentsProcessed / metrics.documentsTotal) * 100),
    0,
    100
  );
}

/**
 * Build actionable checklist items from metrics and scores
 */
function buildChecklist(
  metrics: IntelligenceMetrics,
  scores: Omit<IntelligenceScoreResult, 'checklist'>
): IntelligenceChecklistItem[] {
  const items: IntelligenceChecklistItem[] = [];

  // 1. Upload construction drawings
  items.push({
    id: 'upload-drawings',
    category: 'coverage',
    label: 'Upload construction drawings',
    status: metrics.totalSheets === 0 ? 'missing' : metrics.totalSheets < 5 ? 'partial' : 'complete',
    currentValue: metrics.totalSheets,
    targetValue: '5+',
    actionLabel: 'Upload drawings',
    actionHref: 'documents',
    weight: 15,
  });

  // 2. Process all documents
  items.push({
    id: 'process-documents',
    category: 'coverage',
    label: 'Process all documents',
    status: metrics.documentsTotal === 0
      ? 'missing'
      : scores.pipelineCoverage >= 100
        ? 'complete'
        : 'partial',
    currentValue: metrics.documentsProcessed,
    targetValue: metrics.documentsTotal,
    actionLabel: 'View processing queue',
    actionHref: 'documents',
    weight: 15,
  });

  // 3. Extraction confidence
  items.push({
    id: 'extraction-confidence',
    category: 'extraction',
    label: 'Improve extraction confidence',
    status: metrics.totalSheets === 0
      ? 'missing'
      : metrics.averageConfidence >= 0.7
        ? 'complete'
        : 'partial',
    currentValue: `${Math.round(metrics.averageConfidence * 100)}%`,
    targetValue: '70%+',
    actionLabel: 'Re-process low confidence sheets',
    actionHref: 'documents',
    weight: 12,
  });

  // 4. Room data
  items.push({
    id: 'extract-rooms',
    category: 'extraction',
    label: 'Extract room data',
    status: metrics.roomsExtracted === 0 ? 'missing' : 'complete',
    currentValue: metrics.roomsExtracted,
    targetValue: '1+',
    actionLabel: 'Upload floor plans',
    actionHref: 'documents',
    weight: 12,
  });

  // 5. Fixtures
  items.push({
    id: 'extract-fixtures',
    category: 'extraction',
    label: 'Extract fixtures',
    status: metrics.fixturesExtracted === 0 ? 'missing' : 'complete',
    currentValue: metrics.fixturesExtracted,
    targetValue: '1+',
    actionLabel: 'Upload MEP drawings',
    actionHref: 'documents',
    weight: 10,
  });

  // 6. Cross-references
  const resolutionRate = metrics.totalCrossReferences > 0
    ? metrics.crossReferencesResolved / metrics.totalCrossReferences
    : 0;
  items.push({
    id: 'resolve-cross-refs',
    category: 'enrichment',
    label: 'Resolve cross-references',
    status: metrics.totalCrossReferences === 0
      ? 'missing'
      : resolutionRate >= 0.5
        ? 'complete'
        : 'partial',
    currentValue: metrics.crossReferencesResolved,
    targetValue: metrics.totalCrossReferences,
    actionLabel: 'Upload referenced sheets',
    actionHref: 'documents',
    weight: 10,
  });

  // 7. Drawing type classification
  items.push({
    id: 'classify-drawings',
    category: 'classification',
    label: 'Classify drawing types',
    status: metrics.drawingTypesClassified === 0 ? 'missing' : 'complete',
    currentValue: metrics.drawingTypesClassified,
    targetValue: '1+',
    actionLabel: 'Process drawings',
    actionHref: 'documents',
    weight: 10,
  });

  // 8. Material takeoffs
  items.push({
    id: 'generate-takeoffs',
    category: 'enrichment',
    label: 'Generate material takeoffs',
    status: metrics.materialTakeoffItems === 0 ? 'missing' : 'complete',
    currentValue: metrics.materialTakeoffItems,
    targetValue: '1+',
    actionLabel: 'Run quantity calculator',
    actionHref: 'documents',
    weight: 8,
  });

  // 9. Door/window schedules
  const hasSchedules = metrics.doorScheduleItems > 0 || metrics.windowScheduleItems > 0;
  items.push({
    id: 'extract-schedules',
    category: 'enrichment',
    label: 'Extract door/window schedules',
    status: metrics.doorScheduleItems === 0 && metrics.windowScheduleItems === 0
      ? 'missing'
      : metrics.doorScheduleItems > 0 && metrics.windowScheduleItems > 0
        ? 'complete'
        : 'partial',
    currentValue: `${metrics.doorScheduleItems}D / ${metrics.windowScheduleItems}W`,
    targetValue: '1+ each',
    actionLabel: 'Upload schedule drawings',
    actionHref: 'documents',
    weight: 8,
  });

  return items;
}
