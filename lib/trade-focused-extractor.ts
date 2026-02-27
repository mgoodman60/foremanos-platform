/**
 * Trade-Focused Extractor
 * Re-extracts specific disciplines/aspects from document pages with merge logic.
 */
import { prisma } from './db';
import { Prisma } from '@prisma/client';
import { performQualityCheck, type ExtractedData } from './vision-api-quality';
import { logger } from '@/lib/logger';

export interface TradeFocus {
  type: 'trade' | 'aspect';
  name: string;
}

export interface TradeFocusResult {
  pagesProcessed: number;
  fieldsUpdated: number;
  qualityBefore: number;
  qualityAfter: number;
  cost: number;
  mergeReport: { field: string; action: 'added' | 'updated' | 'kept' }[];
}

export async function runTradeFocusedExtraction(
  documentId: string,
  focuses: TradeFocus[],
  options?: { escalateTier?: boolean; pageRange?: { start: number; end: number } }
): Promise<TradeFocusResult> {
  const tradeNames = focuses.filter(f => f.type === 'trade').map(f => f.name);

  // Find matching pages
  const whereClause: Record<string, unknown> = { documentId };
  if (options?.pageRange) {
    whereClause.pageNumber = {
      gte: options.pageRange.start,
      lte: options.pageRange.end,
    };
  }
  if (tradeNames.length > 0) {
    whereClause.discipline = { in: tradeNames };
  }

  const chunks = await prisma.documentChunk.findMany({
    where: whereClause as Record<string, unknown>,
    orderBy: { pageNumber: 'asc' },
  });

  if (chunks.length === 0) {
    return { pagesProcessed: 0, fieldsUpdated: 0, qualityBefore: 0, qualityAfter: 0, cost: 0, mergeReport: [] };
  }

  let totalFieldsUpdated = 0;
  let totalCost = 0;
  const allMergeReport: { field: string; action: 'added' | 'updated' | 'kept' }[] = [];
  const qualityScoresBefore: number[] = [];
  const qualityScoresAfter: number[] = [];

  for (const chunk of chunks) {
    if (!chunk.pageNumber) continue;

    let existingData: ExtractedData;
    try {
      existingData = JSON.parse(chunk.content);
    } catch {
      continue;
    }

    const beforeQuality = performQualityCheck(existingData, chunk.pageNumber);
    qualityScoresBefore.push(beforeQuality.score);

    // For now, trade-focused extraction uses interpretWithFallback for enrichment
    // Full pipeline integration (Gemini/Opus vision re-extraction) is deferred
    // to avoid requiring PDF re-download in this phase
    try {
      const { interpretWithFallback } = await import('./interpretation-service');
      const { getPluginExtractionEnhancement } = await import('@/lib/plugin');

      const discipline = chunk.discipline || tradeNames[0] || 'General';
      const aspectFocuses = focuses.filter(f => f.type === 'aspect').map(f => f.name);
      const focusContext = [
        `TRADE-FOCUSED RE-EXTRACTION for ${discipline}`,
        aspectFocuses.length > 0 ? `Focus aspects: ${aspectFocuses.join(', ')}` : '',
        'Extract MORE detail for the specified trades/aspects.',
        'Return the complete enriched JSON.',
      ].filter(Boolean).join('\n');

      const pluginRef = getPluginExtractionEnhancement(discipline, existingData.drawingType || 'unknown');
      const additionalContext = pluginRef
        ? `${focusContext}\n\nDISCIPLINE REFERENCE:\n${pluginRef.substring(0, 2000)}`
        : focusContext;

      const result = await interpretWithFallback(
        JSON.stringify(existingData),
        chunk.pageNumber,
        { tierPrefix: 'trade-focused', additionalContext }
      );

      totalCost += result.estimatedCost;

      let focusedData: ExtractedData;
      try {
        focusedData = JSON.parse(result.content);
      } catch {
        qualityScoresAfter.push(beforeQuality.score);
        continue;
      }

      // Merge results
      const { merged, report, fieldsUpdated } = mergeExtractionResults(existingData, focusedData);
      totalFieldsUpdated += fieldsUpdated;
      allMergeReport.push(...report);

      const afterQuality = performQualityCheck(merged, chunk.pageNumber);
      qualityScoresAfter.push(afterQuality.score);

      // Update chunk
      const history = (chunk.qualityHistory as unknown[] || []);
      history.push({
        attempt: 'trade-focused',
        score: afterQuality.score,
        provider: result.interpretationProvider,
        timestamp: new Date().toISOString(),
      });

      await prisma.documentChunk.update({
        where: { id: chunk.id },
        data: {
          content: JSON.stringify(merged),
          qualityScore: afterQuality.score,
          qualityPassed: afterQuality.score >= 40,
          qualityHistory: history as unknown as Prisma.InputJsonValue,
        },
      });

    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn('TRADE_FOCUSED', `Failed for page ${chunk.pageNumber}`, { error: errMsg });
      qualityScoresAfter.push(beforeQuality.score);
    }
  }

  const avgBefore = qualityScoresBefore.length > 0
    ? qualityScoresBefore.reduce((a, b) => a + b, 0) / qualityScoresBefore.length
    : 0;
  const avgAfter = qualityScoresAfter.length > 0
    ? qualityScoresAfter.reduce((a, b) => a + b, 0) / qualityScoresAfter.length
    : 0;

  // Update document trade focus tracking
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { tradeFocusRun: true } });
  const existingFocuses = (doc?.tradeFocusRun as string[] || []);
  const newFocuses = [...new Set([...existingFocuses, ...tradeNames])];
  await prisma.document.update({
    where: { id: documentId },
    data: { tradeFocusRun: newFocuses },
  });

  return {
    pagesProcessed: chunks.length,
    fieldsUpdated: totalFieldsUpdated,
    qualityBefore: Math.round(avgBefore),
    qualityAfter: Math.round(avgAfter),
    cost: totalCost,
    mergeReport: allMergeReport,
  };
}

function mergeExtractionResults(
  existing: ExtractedData,
  focused: ExtractedData
): { merged: ExtractedData; report: { field: string; action: 'added' | 'updated' | 'kept' }[]; fieldsUpdated: number } {
  const merged = { ...existing };
  const report: { field: string; action: 'added' | 'updated' | 'kept' }[] = [];
  let fieldsUpdated = 0;

  for (const [key, newValue] of Object.entries(focused)) {
    if (key.startsWith('_')) continue; // Skip internal fields

    const existingValue = (existing as Record<string, unknown>)[key];

    if (existingValue === null || existingValue === undefined || existingValue === '' || existingValue === 'N/A') {
      // Missing -> add
      (merged as Record<string, unknown>)[key] = newValue;
      report.push({ field: key, action: 'added' });
      fieldsUpdated++;
    } else if (Array.isArray(existingValue) && Array.isArray(newValue) && newValue.length > existingValue.length) {
      // Array with more items -> update
      (merged as Record<string, unknown>)[key] = newValue;
      report.push({ field: key, action: 'updated' });
      fieldsUpdated++;
    } else if (typeof existingValue === 'string' && typeof newValue === 'string' && newValue.length > existingValue.length * 1.5) {
      // Significantly more detailed string -> update
      (merged as Record<string, unknown>)[key] = newValue;
      report.push({ field: key, action: 'updated' });
      fieldsUpdated++;
    } else {
      report.push({ field: key, action: 'kept' });
    }
  }

  return { merged, report, fieldsUpdated };
}
