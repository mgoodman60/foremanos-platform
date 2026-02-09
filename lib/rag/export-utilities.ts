/**
 * CSV/Excel Export and Visualization Utilities for Takeoff Results
 *
 * Extracted from lib/rag-enhancements.ts — CSV generation,
 * highlight metadata, and duct/pipe length calculation.
 */

import type {
  TakeoffResult,
  ExportOptions,
  HighlightRegion,
  LengthCalculation,
  EnhancedChunk,
} from './types';

/**
 * Generate CSV export from takeoff results
 */
export function generateTakeoffCSV(
  takeoff: TakeoffResult,
  options: ExportOptions = { format: 'csv', includeRollups: true, includeMetadata: true }
): string {
  const lines: string[] = [];

  // Header with metadata
  if (options.includeMetadata) {
    lines.push(`Project: ${takeoff.projectName}`);
    lines.push(`Generated: ${takeoff.generatedDate}`);
    lines.push(`Requested By: ${takeoff.requestedBy}`);
    lines.push(`Scope: ${takeoff.scope}`);
    lines.push('');
    lines.push(`Total Items: ${takeoff.totalItems}`);
    lines.push(`Counted: ${takeoff.countedItems}, Measured: ${takeoff.measuredItems}, Not Quantified: ${takeoff.notQuantifiedItems}`);
    lines.push('');
  }

  // Column headers
  lines.push([
    'Trade',
    'System',
    'Item Type',
    'Item Tag/ID',
    'Description',
    'Quantity',
    'Unit',
    'Size/Rating',
    'Method',
    'Source References',
    'Exclusions/Notes',
    'Confidence',
    'Confidence Basis'
  ].join(','));

  // Data rows
  for (const item of takeoff.items) {
    lines.push([
      csvEscape(item.trade),
      csvEscape(item.system),
      csvEscape(item.itemType),
      csvEscape(item.itemTagOrId),
      csvEscape(item.description),
      item.quantity.toString(),
      csvEscape(item.unit),
      csvEscape(item.sizeOrRating),
      csvEscape(item.method),
      csvEscape(item.sourceRefs.join('; ')),
      csvEscape(item.exclusionsOrNotes),
      item.confidence.toUpperCase(),
      csvEscape(item.confidenceBasis)
    ].join(','));
  }

  // Rollups section
  if (options.includeRollups && takeoff.rollups && takeoff.rollups.length > 0) {
    lines.push('');
    lines.push('ROLLUP SUMMARY');
    lines.push([
      'Trade',
      'System',
      'Group By',
      'Group Value',
      'Total Quantity',
      'Unit',
      'Item Count',
      'Confidence'
    ].join(','));

    for (const rollup of takeoff.rollups) {
      lines.push([
        csvEscape(rollup.trade),
        csvEscape(rollup.system || ''),
        csvEscape(rollup.groupBy),
        csvEscape(rollup.groupValue),
        rollup.totalQuantity.toString(),
        csvEscape(rollup.unit),
        rollup.itemCount.toString(),
        rollup.confidence.toUpperCase()
      ].join(','));
    }
  }

  // Warnings and disclaimers
  if (takeoff.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS');
    for (const warning of takeoff.warnings) {
      lines.push(csvEscape(warning));
    }
  }

  if (takeoff.disclaimers.length > 0) {
    lines.push('');
    lines.push('DISCLAIMERS');
    for (const disclaimer of takeoff.disclaimers) {
      lines.push(csvEscape(disclaimer));
    }
  }

  return lines.join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Visual Takeoff Highlighting
 * Generates metadata for highlighting items on plan sheets
 */
export function generateHighlightMetadata(
  takeoff: TakeoffResult,
  chunks: EnhancedChunk[]
): HighlightRegion[] {
  const regions: HighlightRegion[] = [];

  for (const item of takeoff.items) {
    // Find source chunks for this item
    const sourceChunks = chunks.filter(c =>
      item.sourceRefs.some(ref => c.sourceReference?.includes(ref))
    );

    for (const chunk of sourceChunks) {
      // Determine color by trade
      let color = '#3B82F6'; // blue default
      if (item.trade === 'hvac') color = '#EF4444'; // red
      else if (item.trade === 'plumbing') color = '#10B981'; // green
      else if (item.trade === 'electrical') color = '#F59E0B'; // amber
      else if (item.trade === 'fire_alarm') color = '#8B5CF6'; // purple

      regions.push({
        itemId: item.itemTagOrId,
        sheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        pageNumber: chunk.pageNumber || 0,
        color,
        label: `${item.itemTagOrId}: ${item.description}`,
        category: item.trade,
      });
    }
  }

  return regions;
}

/**
 * Automatic Duct/Pipe Length Calculation
 * Calculates lengths from scaled plan sheets
 */
export async function calculateDuctPipeLength(
  chunks: EnhancedChunk[],
  systemType: 'duct' | 'pipe',
  tag?: string
): Promise<LengthCalculation[]> {
  const calculations: LengthCalculation[] = [];

  // Find chunks with routing information
  const routingChunks = chunks.filter(c =>
    c.metadata?.scale &&
    (c.content.match(/routing|run|from.*to/i) || c.chunkType === 'detail_callout')
  );

  for (const chunk of routingChunks) {
    // Extract scale
    const scale = chunk.metadata.scale;
    if (!scale) continue;

    // Try to extract routing segments
    const routeMatches = chunk.content.matchAll(/(?:from|at)\s+([A-Z0-9-]+).*?(?:to|\u2192)\s+([A-Z0-9-]+)/gi);
    const segments: LengthCalculation['segments'] = [];

    for (const match of routeMatches) {
      const from = match[1];
      const to = match[2];

      // Try to extract length if explicitly stated
      const lengthMatch = chunk.content.match(new RegExp(`${from}.*?${to}.*?(\\d+)['"]?`, 'i'));
      if (lengthMatch) {
        const length = parseInt(lengthMatch[1]);
        segments.push({
          from,
          to,
          length,
          sheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }

    if (segments.length > 0) {
      const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);

      calculations.push({
        system: systemType === 'duct' ? 'HVAC' : 'Plumbing',
        tag: tag || 'Unknown',
        calculatedLength: totalLength,
        unit: 'LF',
        method: 'additive',
        confidence: segments.length > 1 ? 'high' : 'medium',
        segments,
        notes: [
          `Calculated from ${segments.length} segments`,
          `Scale: ${scale}`,
          `Verify actual routing in field`
        ],
      });
    }
  }

  return calculations;
}
