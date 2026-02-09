/**
 * AI-Assisted Takeoff Verification
 *
 * Extracted from lib/rag-enhancements.ts — cross-checks takeoff results
 * for accuracy and completeness.
 */

import type {
  TakeoffResult,
  VerificationResult,
  EnhancedChunk,
} from './types';

/**
 * Verify a takeoff result against source chunks for accuracy
 */
export async function verifyTakeoff(
  takeoff: TakeoffResult,
  chunks: EnhancedChunk[]
): Promise<VerificationResult> {
  const checks: VerificationResult['checks'] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Check 1: Verify all schedule items are included
  const scheduleChunks = chunks.filter(c => c.chunkType === 'schedule_row');
  const scheduleItems = new Set<string>();
  for (const chunk of scheduleChunks) {
    const tagMatches = chunk.content.matchAll(/([A-Z]{2,4}-?\d+)/g);
    for (const match of tagMatches) {
      scheduleItems.add(match[1]);
    }
  }

  const takeoffItems = new Set(takeoff.items.map(i => i.itemTagOrId));
  const missingItems = Array.from(scheduleItems).filter(item => !takeoffItems.has(item));

  if (missingItems.length > 0) {
    checks.push({
      name: 'Schedule Completeness',
      passed: false,
      message: `${missingItems.length} schedule items not included in takeoff: ${missingItems.slice(0, 5).join(', ')}${missingItems.length > 5 ? '...' : ''}`,
      severity: 'warning',
    });
    score -= Math.min(20, missingItems.length * 2);
    suggestions.push(`Review schedules for items: ${missingItems.join(', ')}`);
  } else {
    checks.push({
      name: 'Schedule Completeness',
      passed: true,
      message: 'All schedule items included in takeoff',
      severity: 'info',
    });
  }

  // Check 2: Verify confidence levels
  const lowConfidenceCount = takeoff.items.filter(i => i.confidence === 'low').length;
  if (lowConfidenceCount > takeoff.totalItems * 0.3) {
    checks.push({
      name: 'Confidence Threshold',
      passed: false,
      message: `${lowConfidenceCount} items (${Math.round(lowConfidenceCount/takeoff.totalItems*100)}%) have low confidence`,
      severity: 'warning',
    });
    score -= 15;
    suggestions.push('Review low-confidence items for accuracy');
  } else {
    checks.push({
      name: 'Confidence Threshold',
      passed: true,
      message: `${lowConfidenceCount} items with low confidence (acceptable threshold)`,
      severity: 'info',
    });
  }

  // Check 3: Verify source references
  const itemsWithoutSources = takeoff.items.filter(i => i.sourceRefs.length === 0);
  if (itemsWithoutSources.length > 0) {
    checks.push({
      name: 'Source Traceability',
      passed: false,
      message: `${itemsWithoutSources.length} items missing source references`,
      severity: 'error',
    });
    score -= 10;
    suggestions.push('Add source references to all items');
  } else {
    checks.push({
      name: 'Source Traceability',
      passed: true,
      message: 'All items have source references',
      severity: 'info',
    });
  }

  // Check 4: Verify quantities are reasonable
  for (const item of takeoff.items) {
    if (typeof item.quantity === 'number') {
      if (item.quantity === 0) {
        checks.push({
          name: `Zero Quantity: ${item.itemTagOrId}`,
          passed: false,
          message: `Item ${item.itemTagOrId} has zero quantity`,
          severity: 'warning',
        });
        score -= 2;
      }

      // Check for suspiciously large quantities
      if (item.quantity > 1000 && item.unit !== 'LF' && item.unit !== 'SF') {
        checks.push({
          name: `Large Quantity: ${item.itemTagOrId}`,
          passed: false,
          message: `Item ${item.itemTagOrId} has unusually large quantity (${item.quantity} ${item.unit})`,
          severity: 'warning',
        });
        score -= 2;
        suggestions.push(`Verify quantity for ${item.itemTagOrId}`);
      }
    }
  }

  // Check 5: Verify trade groupings
  const tradeGroups = new Map<string, number>();
  for (const item of takeoff.items) {
    tradeGroups.set(item.trade, (tradeGroups.get(item.trade) || 0) + 1);
  }

  if (tradeGroups.size === 0) {
    checks.push({
      name: 'Trade Classification',
      passed: false,
      message: 'No items classified by trade',
      severity: 'error',
    });
    score -= 20;
  } else {
    checks.push({
      name: 'Trade Classification',
      passed: true,
      message: `Items organized into ${tradeGroups.size} trade categories`,
      severity: 'info',
    });
  }

  // Overall assessment
  const passed = score >= 70 && !checks.some(c => c.severity === 'error');

  if (!passed) {
    suggestions.push('Review and address errors and warnings before finalizing takeoff');
  }

  return {
    passed,
    score: Math.max(0, score),
    checks,
    suggestions,
  };
}
