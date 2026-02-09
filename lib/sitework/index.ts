/**
 * Sitework/Exterior Takeoff Extractor - Barrel index
 *
 * CSI Divisions 31 (Earthwork), 32 (Exterior), 33 (Utilities)
 */

import { prisma } from '../db';
import { createScopedLogger } from '../logger';
import { classifyDrawingType } from './drawing-classification';
import { extractByDrawingType, consolidateResults } from './extraction';
import { extractGeotechData, adjustForGeotechConditions } from './geotech-integration';
import { extractFromDWG, extractSiteworkFromProjectModels, parseCADLayerName, convertCADToTakeoff } from './cad-integration';
import { calculateCutFill, calculateTrenchVolume, calculateAsphaltTonnage, calculateAggregateVolume, calculatePipeBedding } from './quantity-derivation';
import { convertUnits, normalizeUnit } from './unit-conversion';
import type { SiteworkExtractionResult } from './extraction';

const log = createScopedLogger('SITEWORK_TAKEOFF');

export * from './patterns';
export * from './unit-conversion';
export * from './drawing-classification';
export * from './extraction';
export * from './quantity-derivation';
export * from './geotech-integration';
export {
  CAD_LAYER_PATTERNS, parseCADLayerName, convertCADToTakeoff, extractFromDWG, extractSiteworkFromProjectModels,
} from './cad-integration';
export type { CADEntity, CADLayerData, CADExtractionResult } from './cad-integration';

/**
 * Main sitework takeoff extraction - orchestrates all phases
 */
export async function extractSiteworkTakeoff(
  documentId: string,
  projectId: string,
  options?: { includeCAD?: boolean; includeGeotech?: boolean; geotechDocumentId?: string; }
): Promise<SiteworkExtractionResult[]> {
  log.info('Starting comprehensive extraction', { documentId });
  let results: SiteworkExtractionResult[] = [];

  try {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error('Document not found');

    const documentChunks = await prisma.documentChunk.findMany({ where: { documentId }, orderBy: { pageNumber: 'asc' } });

    for (const chunk of documentChunks) {
      const metadata = chunk.metadata as any;
      const sheetNumber = metadata?.sheet_number || '';
      const drawingType = classifyDrawingType(sheetNumber, chunk.content);
      log.info('Page classified', { page: chunk.pageNumber, drawingType });
      const pageResults = await extractByDrawingType(drawingType, chunk.content, metadata);
      for (const result of pageResults) {
        result.source = `${result.source}:page${chunk.pageNumber}:${sheetNumber}`;
      }
      results.push(...pageResults);
    }

    if (options?.includeCAD) {
      const cadResults = await extractFromDWG(documentId, projectId);
      results.push(...cadResults);
    }

    if (options?.includeGeotech && options.geotechDocumentId) {
      const geotechDoc = await prisma.document.findUnique({ where: { id: options.geotechDocumentId } });
      if (geotechDoc) {
        const geotechChunks = await prisma.documentChunk.findMany({ where: { documentId: options.geotechDocumentId } });
        const geotechContent = geotechChunks.map((c: any) => c.content).join('\n');
        const geotechData = extractGeotechData(geotechContent);
        results = adjustForGeotechConditions(results, geotechData);
        log.info('Applied geotech adjustments');
      }
    }

    results = consolidateResults(results);
    log.info('Extraction complete', { itemCount: results.length });
    return results;
  } catch (error) {
    log.error('Extraction error', error as Error);
    throw error;
  }
}

export default {
  extractSiteworkTakeoff,
  extractByDrawingType,
  extractFromDWG,
  extractSiteworkFromProjectModels,
  extractGeotechData,
  adjustForGeotechConditions,
  calculateCutFill,
  calculateTrenchVolume,
  calculateAsphaltTonnage,
  calculateAggregateVolume,
  calculatePipeBedding,
  convertUnits,
  normalizeUnit,
  classifyDrawingType,
  parseCADLayerName,
  convertCADToTakeoff,
};
