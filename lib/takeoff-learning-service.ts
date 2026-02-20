/**
 * Phase 9: Takeoff Learning System Service
 * 
 * Collects user feedback and corrections to improve takeoff accuracy over time.
 * Implements pattern recognition, correction tracking, and accuracy improvement algorithms.
 */

import { prisma } from './db';
import { logger } from './logger';

// Types
export interface FeedbackInput {
  takeoffId: string;
  lineItemId?: string;
  userId: string;
  feedbackType: 'accuracy' | 'missing_item' | 'wrong_quantity' | 'wrong_unit' | 'wrong_category' | 'helpful' | 'unhelpful';
  rating?: number;
  comment?: string;
  context?: Record<string, unknown>;
}

export interface CorrectionInput {
  takeoffId: string;
  lineItemId: string;
  userId: string;
  fieldName: string;
  originalValue: string;
  correctedValue: string;
  reason?: string;
}

export interface LearningStats {
  totalFeedback: number;
  totalCorrections: number;
  approvedCorrections: number;
  pendingCorrections: number;
  averageRating: number;
  feedbackByType: Record<string, number>;
  correctionsByField: Record<string, number>;
  accuracyTrend: { date: string; accuracy: number }[];
  learnedPatterns: number;
  patternsByCategory: Record<string, number>;
}

export interface CorrectionSuggestion {
  lineItemId: string;
  itemName: string;
  fieldName: string;
  currentValue: string;
  suggestedValue: string;
  confidence: number;
  reason: string;
  patternId?: string;
}

export interface LearnedPattern {
  id: string;
  category: string;
  patternType: string;
  patternKey: string;
  patternValue: Record<string, unknown>;
  confidence: number;
  usageCount: number;
  source: string;
}

// Common correction patterns by category
const CORRECTION_PATTERNS: Record<string, { quantityMultiplier: number; commonUnits: string[] }> = {
  concrete: { quantityMultiplier: 1.05, commonUnits: ['CY', 'SF', 'LF'] },
  rebar: { quantityMultiplier: 1.10, commonUnits: ['LB', 'TON', 'LF'] },
  structural_steel: { quantityMultiplier: 1.08, commonUnits: ['TON', 'LB', 'LF'] },
  lumber: { quantityMultiplier: 1.15, commonUnits: ['BF', 'LF', 'EA'] },
  insulation: { quantityMultiplier: 1.10, commonUnits: ['SF', 'BF', 'LF'] },
  drywall: { quantityMultiplier: 1.12, commonUnits: ['SF', 'SH', 'LF'] },
  roofing: { quantityMultiplier: 1.10, commonUnits: ['SQ', 'SF', 'LF'] },
  flooring: { quantityMultiplier: 1.10, commonUnits: ['SF', 'SY', 'LF'] },
  painting: { quantityMultiplier: 1.15, commonUnits: ['SF', 'GAL', 'HR'] },
  electrical: { quantityMultiplier: 1.08, commonUnits: ['LF', 'EA', 'HR'] },
  plumbing: { quantityMultiplier: 1.10, commonUnits: ['LF', 'EA', 'HR'] },
  hvac: { quantityMultiplier: 1.08, commonUnits: ['LF', 'EA', 'TON', 'CFM'] },
  doors_windows: { quantityMultiplier: 1.02, commonUnits: ['EA', 'SF', 'UI'] },
  masonry: { quantityMultiplier: 1.08, commonUnits: ['SF', 'EA', 'CY'] },
  excavation: { quantityMultiplier: 1.15, commonUnits: ['CY', 'LCY', 'BCY'] },
  site_work: { quantityMultiplier: 1.12, commonUnits: ['CY', 'SF', 'LF', 'TON'] },
  mep_equipment: { quantityMultiplier: 1.02, commonUnits: ['EA', 'LS'] },
};

// Submit feedback
export async function submitFeedback(input: FeedbackInput): Promise<{ success: boolean; feedbackId?: string; error?: string }> {
  try {
    const feedback = await prisma.takeoffFeedback.create({
      data: {
        takeoffId: input.takeoffId,
        lineItemId: input.lineItemId || null,
        userId: input.userId,
        feedbackType: input.feedbackType,
        rating: input.rating || null,
        comment: input.comment || null,
        context: input.context ? JSON.parse(JSON.stringify(input.context)) : undefined,
      },
    });

    // If it's a negative feedback type, check for patterns
    if (['wrong_quantity', 'wrong_unit', 'wrong_category', 'missing_item'].includes(input.feedbackType)) {
      await analyzeFeedbackPatterns(input.takeoffId);
    }

    return { success: true, feedbackId: feedback.id };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error submitting feedback', error as Error);
    return { success: false, error: String(error) };
  }
}

// Submit correction
export async function submitCorrection(input: CorrectionInput): Promise<{ success: boolean; correctionId?: string; error?: string }> {
  try {
    // Get the line item to validate
    const lineItem = await prisma.takeoffLineItem.findUnique({
      where: { id: input.lineItemId },
    });

    if (!lineItem) {
      return { success: false, error: 'Line item not found' };
    }

    const correction = await prisma.takeoffCorrection.create({
      data: {
        takeoffId: input.takeoffId,
        lineItemId: input.lineItemId,
        userId: input.userId,
        fieldName: input.fieldName,
        originalValue: input.originalValue,
        correctedValue: input.correctedValue,
        reason: input.reason || null,
      },
    });

    return { success: true, correctionId: correction.id };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error submitting correction', error as Error);
    return { success: false, error: String(error) };
  }
}

// Apply correction (updates the line item and optionally creates a pattern)
export async function applyCorrection(
  correctionId: string,
  userId: string,
  createPattern: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const correction = await prisma.takeoffCorrection.findUnique({
      where: { id: correctionId },
    });

    if (!correction) {
      return { success: false, error: 'Correction not found' };
    }

    // Get line item
    const lineItem = await prisma.takeoffLineItem.findUnique({
      where: { id: correction.lineItemId },
    });

    if (!lineItem) {
      return { success: false, error: 'Line item not found' };
    }

    // Update the line item based on field name
    const updateData: Record<string, unknown> = {};
    
    switch (correction.fieldName) {
      case 'quantity':
        updateData.quantity = parseFloat(correction.correctedValue);
        break;
      case 'unit':
        updateData.unit = correction.correctedValue;
        break;
      case 'category':
        updateData.category = correction.correctedValue;
        break;
      case 'itemName':
        updateData.itemName = correction.correctedValue;
        break;
      case 'unitCost':
        updateData.unitCost = parseFloat(correction.correctedValue);
        break;
      default:
        // Handle other fields dynamically
        updateData[correction.fieldName] = correction.correctedValue;
    }

    // Apply the correction to the line item
    await prisma.takeoffLineItem.update({
      where: { id: correction.lineItemId },
      data: updateData,
    });

    // Mark correction as approved
    await prisma.takeoffCorrection.update({
      where: { id: correctionId },
      data: {
        approved: true,
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Create learning pattern if requested
    if (createPattern && correction.fieldName === 'quantity') {
      const originalQty = parseFloat(correction.originalValue);
      const correctedQty = parseFloat(correction.correctedValue);
      
      if (originalQty > 0) {
        const adjustmentFactor = correctedQty / originalQty;
        
        // Find existing pattern or create new one
        const existingPattern = await prisma.takeoffLearningPattern.findFirst({
          where: {
            projectId: null,
            category: lineItem.category,
            patternType: 'quantity_adjustment',
            patternKey: normalizePatternKey(lineItem.itemName),
          },
        });
        
        if (existingPattern) {
          const currentValue = existingPattern.patternValue as { sampleSize?: number } || {};
          await prisma.takeoffLearningPattern.update({
            where: { id: existingPattern.id },
            data: {
              patternValue: {
                adjustmentFactor: adjustmentFactor,
                sampleSize: (currentValue.sampleSize || 1) + 1,
              },
              usageCount: existingPattern.usageCount + 1,
              confidence: Math.min(existingPattern.confidence + 0.05, 1.0),
              lastUsed: new Date(),
            },
          });
        } else {
          await prisma.takeoffLearningPattern.create({
            data: {
              projectId: null,
              category: lineItem.category,
              patternType: 'quantity_adjustment',
              patternKey: normalizePatternKey(lineItem.itemName),
              patternValue: { adjustmentFactor, sampleSize: 1 },
              confidence: 0.6,
              usageCount: 1,
              source: 'user_correction',
            },
          });
        }
      }
    }

    return { success: true };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error applying correction', error as Error);
    return { success: false, error: String(error) };
  }
}

// Get learning statistics
export async function getLearningStats(takeoffId?: string): Promise<LearningStats> {
  try {
    const whereClause = takeoffId ? { takeoffId } : {};

    // Get feedback counts
    const feedbackCounts = await prisma.takeoffFeedback.groupBy({
      by: ['feedbackType'],
      where: whereClause,
      _count: { id: true },
    });

    const feedbackByType: Record<string, number> = {};
    feedbackCounts.forEach((f: { feedbackType: string; _count: { id: number } }) => {
      feedbackByType[f.feedbackType] = f._count.id;
    });

    // Get correction counts by field
    const correctionCounts = await prisma.takeoffCorrection.groupBy({
      by: ['fieldName'],
      where: whereClause,
      _count: { id: true },
    });

    const correctionsByField: Record<string, number> = {};
    correctionCounts.forEach((c: { fieldName: string; _count: { id: number } }) => {
      correctionsByField[c.fieldName] = c._count.id;
    });

    // Get total counts
    const [totalFeedback, totalCorrections, approvedCorrections, pendingCorrections] = await Promise.all([
      prisma.takeoffFeedback.count({ where: whereClause }),
      prisma.takeoffCorrection.count({ where: whereClause }),
      prisma.takeoffCorrection.count({ where: { ...whereClause, approved: true } }),
      prisma.takeoffCorrection.count({ where: { ...whereClause, approved: false } }),
    ]);

    // Get average rating
    const ratingAgg = await prisma.takeoffFeedback.aggregate({
      where: { ...whereClause, rating: { not: null } },
      _avg: { rating: true },
    });

    // Get learned patterns
    const patterns = await prisma.takeoffLearningPattern.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    const patternsByCategory: Record<string, number> = {};
    patterns.forEach((p: { category: string; _count: { id: number } }) => {
      patternsByCategory[p.category] = p._count.id;
    });

    const learnedPatterns = await prisma.takeoffLearningPattern.count();

    // Calculate accuracy trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentFeedback = await prisma.takeoffFeedback.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: thirtyDaysAgo },
        rating: { not: null },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date and calculate average
    const accuracyByDate: Record<string, { sum: number; count: number }> = {};
    recentFeedback.forEach((f: { createdAt: Date; rating: number | null }) => {
      const dateStr = f.createdAt.toISOString().split('T')[0];
      if (!accuracyByDate[dateStr]) {
        accuracyByDate[dateStr] = { sum: 0, count: 0 };
      }
      accuracyByDate[dateStr].sum += f.rating || 0;
      accuracyByDate[dateStr].count += 1;
    });

    const accuracyTrend = Object.entries(accuracyByDate).map(([date, data]) => ({
      date,
      accuracy: data.count > 0 ? (data.sum / data.count) * 20 : 0, // Convert 1-5 to percentage
    }));

    return {
      totalFeedback,
      totalCorrections,
      approvedCorrections,
      pendingCorrections,
      averageRating: ratingAgg._avg.rating || 0,
      feedbackByType,
      correctionsByField,
      accuracyTrend,
      learnedPatterns,
      patternsByCategory,
    };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error getting learning stats', error as Error);
    return {
      totalFeedback: 0,
      totalCorrections: 0,
      approvedCorrections: 0,
      pendingCorrections: 0,
      averageRating: 0,
      feedbackByType: {},
      correctionsByField: {},
      accuracyTrend: [],
      learnedPatterns: 0,
      patternsByCategory: {},
    };
  }
}

// Get pending corrections for review
export async function getPendingCorrections(takeoffId?: string): Promise<{
  corrections: Array<{
    id: string;
    lineItemId: string;
    itemName: string;
    category: string;
    fieldName: string;
    originalValue: string;
    correctedValue: string;
    reason: string | null;
    submittedAt: Date;
    submittedBy: string;
  }>;
}> {
  try {
    const whereClause = takeoffId ? { takeoffId, approved: false } : { approved: false };

    const corrections = await prisma.takeoffCorrection.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    type CorrectionRecord = {
      id: string;
      lineItemId: string;
      userId: string;
      fieldName: string;
      originalValue: string;
      correctedValue: string;
      reason: string | null;
      createdAt: Date;
    };
    
    type LineItemRecord = {
      id: string;
      itemName: string;
      category: string;
    };
    
    // Get line items for context
    const lineItemIds = corrections.map((c: CorrectionRecord) => c.lineItemId);
    const lineItems = await prisma.takeoffLineItem.findMany({
      where: { id: { in: lineItemIds } },
    });

    const lineItemMap = new Map(lineItems.map((li: LineItemRecord) => [li.id, li]));

    // Get users for submitted by
    const userIds = [...new Set(corrections.map((c: CorrectionRecord) => c.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map((u: { id: string; username: string | null }) => [u.id, u.username || 'Unknown']));

    return {
      corrections: corrections.map((c: CorrectionRecord) => {
        const lineItem = lineItemMap.get(c.lineItemId) as LineItemRecord | undefined;
        return {
          id: c.id,
          lineItemId: c.lineItemId,
          itemName: lineItem?.itemName || 'Unknown',
          category: lineItem?.category || 'Unknown',
          fieldName: c.fieldName,
          originalValue: c.originalValue,
          correctedValue: c.correctedValue,
          reason: c.reason,
          submittedAt: c.createdAt,
          submittedBy: userMap.get(c.userId) || 'Unknown',
        };
      }),
    };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error getting pending corrections', error as Error);
    return { corrections: [] };
  }
}

// Generate correction suggestions based on learned patterns
export async function generateSuggestions(takeoffId: string): Promise<CorrectionSuggestion[]> {
  try {
    // Define types for this function
    type PatternRecord = {
      id: string;
      category: string;
      patternType: string;
      patternKey: string;
      patternValue: unknown;
      confidence: number;
      usageCount: number;
    };
    
    type TakeoffItem = {
      id: string;
      itemName: string;
      category: string;
      quantity: number;
      unit: string;
    };
    
    // Get takeoff line items
    const lineItems = await prisma.takeoffLineItem.findMany({
      where: { takeoffId },
    }) as TakeoffItem[];

    // Get relevant patterns
    const categories = [...new Set(lineItems.map((li: TakeoffItem) => li.category))];
    const patterns = await prisma.takeoffLearningPattern.findMany({
      where: {
        category: { in: categories },
        confidence: { gte: 0.5 },
      },
    }) as PatternRecord[];

    const suggestions: CorrectionSuggestion[] = [];

    for (const item of lineItems) {
      // Track if we've already suggested a change for a field on this item
      const suggestedFields = new Set<string>();

      // Check for quantity adjustment patterns
      const qtyPatterns = patterns.filter(
        (p: PatternRecord) => p.category === item.category &&
             p.patternType === 'quantity_adjustment' &&
             matchesPatternKey(item.itemName, p.patternKey)
      );

      for (const pattern of qtyPatterns) {
        const patternValue = pattern.patternValue as { adjustmentFactor?: number };
        if (patternValue.adjustmentFactor && patternValue.adjustmentFactor !== 1) {
          const suggestedQty = item.quantity * patternValue.adjustmentFactor;

          // Only suggest if difference is significant (>5%)
          if (Math.abs(suggestedQty - item.quantity) / item.quantity > 0.05) {
            suggestions.push({
              lineItemId: item.id,
              itemName: item.itemName,
              fieldName: 'quantity',
              currentValue: item.quantity.toString(),
              suggestedValue: suggestedQty.toFixed(2),
              confidence: pattern.confidence,
              reason: `Based on ${pattern.usageCount} previous corrections for similar items`,
              patternId: pattern.id,
            });
            suggestedFields.add('quantity');
          }
        }
      }

      // Check for unit preference patterns
      const unitPatterns = patterns.filter(
        (p: PatternRecord) => p.category === item.category && p.patternType === 'unit_preference'
      );

      for (const pattern of unitPatterns) {
        const patternValue = pattern.patternValue as { preferredUnit?: string };
        if (patternValue.preferredUnit && patternValue.preferredUnit !== item.unit) {
          suggestions.push({
            lineItemId: item.id,
            itemName: item.itemName,
            fieldName: 'unit',
            currentValue: item.unit,
            suggestedValue: patternValue.preferredUnit,
            confidence: pattern.confidence,
            reason: `This category commonly uses ${patternValue.preferredUnit}`,
            patternId: pattern.id,
          });
          suggestedFields.add('unit');
        }
      }

      // Check against category-specific common patterns
      // Only suggest if we haven't already suggested a change for this field from learned patterns
      const categoryPattern = CORRECTION_PATTERNS[item.category.toLowerCase()];
      if (categoryPattern && !suggestedFields.has('unit')) {
        // Suggest common unit if current unit is unusual
        if (!categoryPattern.commonUnits.includes(item.unit.toUpperCase())) {
          suggestions.push({
            lineItemId: item.id,
            itemName: item.itemName,
            fieldName: 'unit',
            currentValue: item.unit,
            suggestedValue: categoryPattern.commonUnits[0],
            confidence: 0.5,
            reason: `"${item.unit}" is unusual for ${item.category}. Common units: ${categoryPattern.commonUnits.join(', ')}`,
          });
        }
      }
    }

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error generating suggestions', error as Error);
    return [];
  }
}

// Analyze feedback patterns to identify common issues
async function analyzeFeedbackPatterns(takeoffId: string): Promise<void> {
  try {
    // Get recent feedback for this takeoff
    const recentFeedback = await prisma.takeoffFeedback.findMany({
      where: {
        takeoffId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
    });

    // Analyze patterns (this is a simplified version)
    const feedbackByType: Record<string, number> = {};
    recentFeedback.forEach(f => {
      feedbackByType[f.feedbackType] = (feedbackByType[f.feedbackType] || 0) + 1;
    });

    // If there's a significant pattern, create a learning pattern
    const totalFeedback = recentFeedback.length;
    if (totalFeedback >= 3) {
      for (const [type, count] of Object.entries(feedbackByType)) {
        if (count / totalFeedback >= 0.5) {
          // More than 50% of feedback is of this type
          logger.info('TAKEOFF_LEARNING', 'Pattern detected', { type, percentOfFeedback: ((count / totalFeedback) * 100).toFixed(0) });
        }
      }
    }
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error analyzing feedback patterns', error as Error);
  }
}

// Get all learned patterns
export async function getLearnedPatterns(category?: string): Promise<LearnedPattern[]> {
  try {
    const whereClause = category ? { category } : {};

    const patterns = await prisma.takeoffLearningPattern.findMany({
      where: whereClause,
      orderBy: [{ confidence: 'desc' }, { usageCount: 'desc' }],
    });

    type PatternDBRecord = {
      id: string;
      category: string;
      patternType: string;
      patternKey: string;
      patternValue: unknown;
      confidence: number;
      usageCount: number;
      source: string;
    };
    
    return patterns.map((p: PatternDBRecord) => ({
      id: p.id,
      category: p.category,
      patternType: p.patternType,
      patternKey: p.patternKey,
      patternValue: p.patternValue as Record<string, unknown>,
      confidence: p.confidence,
      usageCount: p.usageCount,
      source: p.source,
    }));
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error getting learned patterns', error as Error);
    return [];
  }
}

// Delete a pattern
export async function deletePattern(patternId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.takeoffLearningPattern.delete({
      where: { id: patternId },
    });
    return { success: true };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error deleting pattern', error as Error);
    return { success: false, error: String(error) };
  }
}

// Reject a correction
export async function rejectCorrection(correctionId: string, _userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.takeoffCorrection.delete({
      where: { id: correctionId },
    });
    return { success: true };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error rejecting correction', error as Error);
    return { success: false, error: String(error) };
  }
}

// Get recent feedback
export async function getRecentFeedback(takeoffId?: string, limit: number = 20): Promise<Array<{
  id: string;
  feedbackType: string;
  rating: number | null;
  comment: string | null;
  resolved: boolean;
  createdAt: Date;
  submittedBy: string;
}>> {
  try {
    const whereClause = takeoffId ? { takeoffId } : {};

    const feedback = await prisma.takeoffFeedback.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    type FeedbackRecord = {
      id: string;
      userId: string;
      feedbackType: string;
      rating: number | null;
      comment: string | null;
      resolved: boolean;
      createdAt: Date;
    };
    
    // Get users
    const userIds = [...new Set(feedback.map((f: FeedbackRecord) => f.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    const userMap = new Map(users.map((u: { id: string; username: string | null }) => [u.id, u.username || 'Unknown']));

    return feedback.map((f: FeedbackRecord) => ({
      id: f.id,
      feedbackType: f.feedbackType,
      rating: f.rating,
      comment: f.comment,
      resolved: f.resolved,
      createdAt: f.createdAt,
      submittedBy: userMap.get(f.userId) || 'Unknown',
    }));
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error getting recent feedback', error as Error);
    return [];
  }
}

// Resolve feedback
export async function resolveFeedback(feedbackId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.takeoffFeedback.update({
      where: { id: feedbackId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });
    return { success: true };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error resolving feedback', error as Error);
    return { success: false, error: String(error) };
  }
}

// Helper: Normalize pattern key for matching
function normalizePatternKey(itemName: string): string {
  return itemName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50);
}

// Helper: Check if item name matches pattern key
function matchesPatternKey(itemName: string, patternKey: string): boolean {
  const normalizedName = normalizePatternKey(itemName);
  return normalizedName === patternKey || normalizedName.includes(patternKey) || patternKey.includes(normalizedName);
}

// Bulk apply suggestions
export async function bulkApplySuggestions(
  suggestions: Array<{ lineItemId: string; fieldName: string; value: string }>,
  _userId: string
): Promise<{ success: boolean; appliedCount: number; error?: string }> {
  try {
    let appliedCount = 0;

    for (const suggestion of suggestions) {
      const updateData: Record<string, unknown> = {};
      
      switch (suggestion.fieldName) {
        case 'quantity':
          updateData.quantity = parseFloat(suggestion.value);
          break;
        case 'unit':
          updateData.unit = suggestion.value;
          break;
        case 'category':
          updateData.category = suggestion.value;
          break;
        default:
          continue;
      }

      await prisma.takeoffLineItem.update({
        where: { id: suggestion.lineItemId },
        data: updateData,
      });

      appliedCount++;
    }

    return { success: true, appliedCount };
  } catch (error) {
    logger.error('TAKEOFF_LEARNING', 'Error bulk applying suggestions', error as Error);
    return { success: false, appliedCount: 0, error: String(error) };
  }
}

// Export summary for external use
export async function getLearningSystemSummary(takeoffId?: string): Promise<{
  stats: LearningStats;
  pendingCorrections: number;
  suggestions: CorrectionSuggestion[];
  recentFeedback: Array<{ id: string; feedbackType: string; rating: number | null; createdAt: Date }>;
}> {
  const [stats, pending, suggestions, feedback] = await Promise.all([
    getLearningStats(takeoffId),
    getPendingCorrections(takeoffId),
    takeoffId ? generateSuggestions(takeoffId) : Promise.resolve([]),
    getRecentFeedback(takeoffId, 5),
  ]);

  return {
    stats,
    pendingCorrections: pending.corrections.length,
    suggestions,
    recentFeedback: feedback.map(f => ({
      id: f.id,
      feedbackType: f.feedbackType,
      rating: f.rating,
      createdAt: f.createdAt,
    })),
  };
}
