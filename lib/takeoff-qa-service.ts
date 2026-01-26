/**
 * Takeoff Quality Assurance Service
 * 
 * Provides confidence scoring, verification workflows, and accuracy tracking
 * for material takeoff line items.
 */

import { prisma } from './db';

// Types
export interface ConfidenceFactors {
  sourceQuality: number;      // 0-100: Quality of source document
  extractionMethod: number;   // 0-100: Reliability of extraction method
  valueReasonableness: number; // 0-100: How reasonable the value is
  unitConsistency: number;    // 0-100: Unit appropriateness for category
  dimensionMatch: number;     // 0-100: Match with drawing dimensions
  historicalMatch: number;    // 0-100: Match with historical data
}

export interface QAMetrics {
  totalItems: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  lowConfidenceCount: number;
  averageConfidence: number;
  accuracyRate: number;
  verificationRate: number;
}

export interface VerificationResult {
  itemId: string;
  previousStatus: string;
  newStatus: string;
  previousConfidence: number;
  newConfidence: number;
  verifiedBy: string;
  notes: string | null;
}

export interface QAIssue {
  itemId: string;
  itemName: string;
  category: string;
  issueType: 'low_confidence' | 'outlier' | 'missing_unit' | 'duplicate_suspect' | 'calculation_error';
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestedAction: string;
  confidence: number;
}

// Confidence scoring weights
const CONFIDENCE_WEIGHTS: Record<keyof ConfidenceFactors, number> = {
  sourceQuality: 0.20,
  extractionMethod: 0.25,
  valueReasonableness: 0.20,
  unitConsistency: 0.15,
  dimensionMatch: 0.10,
  historicalMatch: 0.10
};

// Expected ranges by category (for reasonableness checks)
const CATEGORY_RANGES: Record<string, { minPerUnit: number; maxPerUnit: number; typicalUnits: string[] }> = {
  'Concrete': { minPerUnit: 0.5, maxPerUnit: 10000, typicalUnits: ['CY', 'CF', 'SF'] },
  'Rebar': { minPerUnit: 10, maxPerUnit: 100000, typicalUnits: ['LB', 'TON', 'LF'] },
  'Structural Steel': { minPerUnit: 100, maxPerUnit: 500000, typicalUnits: ['LB', 'TON', 'LF', 'EA'] },
  'Lumber': { minPerUnit: 10, maxPerUnit: 50000, typicalUnits: ['BF', 'LF', 'EA'] },
  'Electrical': { minPerUnit: 1, maxPerUnit: 10000, typicalUnits: ['LF', 'EA', 'SET'] },
  'Plumbing': { minPerUnit: 1, maxPerUnit: 5000, typicalUnits: ['LF', 'EA', 'SET'] },
  'HVAC': { minPerUnit: 1, maxPerUnit: 500, typicalUnits: ['EA', 'LF', 'TON', 'CFM'] },
  'Drywall': { minPerUnit: 100, maxPerUnit: 100000, typicalUnits: ['SF', 'SHT'] },
  'Roofing': { minPerUnit: 100, maxPerUnit: 50000, typicalUnits: ['SF', 'SQ'] },
  'Flooring': { minPerUnit: 100, maxPerUnit: 50000, typicalUnits: ['SF', 'SY'] },
  'Insulation': { minPerUnit: 100, maxPerUnit: 50000, typicalUnits: ['SF', 'BF', 'LF'] },
  'Doors': { minPerUnit: 1, maxPerUnit: 500, typicalUnits: ['EA', 'SET'] },
  'Windows': { minPerUnit: 1, maxPerUnit: 500, typicalUnits: ['EA', 'SF'] },
  'Paint': { minPerUnit: 100, maxPerUnit: 100000, typicalUnits: ['SF', 'GAL'] },
  'Masonry': { minPerUnit: 100, maxPerUnit: 50000, typicalUnits: ['SF', 'EA', 'CY'] },
  'Excavation': { minPerUnit: 10, maxPerUnit: 50000, typicalUnits: ['CY', 'LF', 'SF'] },
  'Sitework': { minPerUnit: 100, maxPerUnit: 100000, typicalUnits: ['SF', 'SY', 'CY', 'LF'] }
};

/**
 * Calculate confidence score based on multiple factors
 */
export function calculateConfidence(factors: Partial<ConfidenceFactors>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(CONFIDENCE_WEIGHTS)) {
    const factorKey = key as keyof ConfidenceFactors;
    if (factors[factorKey] !== undefined) {
      weightedSum += (factors[factorKey] || 0) * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Analyze a line item and compute detailed confidence breakdown
 */
export function analyzeItemConfidence(
  item: {
    category: string;
    quantity: number;
    unit: string;
    itemName: string;
    extractedFrom?: string | null;
    calculationMethod?: string | null;
  }
): { confidence: number; breakdown: ConfidenceFactors; issues: string[] } {
  const issues: string[] = [];
  const breakdown: ConfidenceFactors = {
    sourceQuality: 70,
    extractionMethod: 70,
    valueReasonableness: 70,
    unitConsistency: 70,
    dimensionMatch: 70,
    historicalMatch: 70
  };

  // Source quality based on extraction source
  if (item.extractedFrom) {
    if (item.extractedFrom.includes('manual')) {
      breakdown.sourceQuality = 95;
    } else if (item.extractedFrom.includes('schedule')) {
      breakdown.sourceQuality = 85;
    } else if (item.extractedFrom.includes('ai') || item.extractedFrom.includes('ocr')) {
      breakdown.sourceQuality = 70;
    }
  }

  // Extraction method confidence
  if (item.calculationMethod) {
    if (item.calculationMethod.includes('measured')) {
      breakdown.extractionMethod = 90;
    } else if (item.calculationMethod.includes('counted')) {
      breakdown.extractionMethod = 85;
    } else if (item.calculationMethod.includes('estimated')) {
      breakdown.extractionMethod = 60;
      issues.push('Quantity was estimated, not measured');
    }
  }

  // Value reasonableness check
  const categoryRange = CATEGORY_RANGES[item.category];
  if (categoryRange) {
    if (item.quantity < categoryRange.minPerUnit) {
      breakdown.valueReasonableness = 40;
      issues.push(`Quantity ${item.quantity} seems unusually low for ${item.category}`);
    } else if (item.quantity > categoryRange.maxPerUnit) {
      breakdown.valueReasonableness = 50;
      issues.push(`Quantity ${item.quantity} seems unusually high for ${item.category}`);
    } else {
      breakdown.valueReasonableness = 85;
    }
  }

  // Unit consistency check
  if (categoryRange?.typicalUnits) {
    const unitUpper = item.unit.toUpperCase();
    if (categoryRange.typicalUnits.includes(unitUpper)) {
      breakdown.unitConsistency = 95;
    } else {
      breakdown.unitConsistency = 50;
      issues.push(`Unit '${item.unit}' is unusual for ${item.category}. Expected: ${categoryRange.typicalUnits.join(', ')}`);
    }
  }

  // Check for missing or zero quantities
  if (item.quantity <= 0) {
    breakdown.valueReasonableness = 10;
    issues.push('Quantity is zero or negative');
  }

  // Check item name quality
  if (item.itemName.length < 3) {
    breakdown.sourceQuality -= 20;
    issues.push('Item name is too short or unclear');
  }

  const confidence = calculateConfidence(breakdown);

  return { confidence, breakdown, issues };
}

/**
 * Get QA metrics for a takeoff
 */
export async function getTakeoffQAMetrics(takeoffId: string): Promise<QAMetrics> {
  const items = await prisma.takeoffLineItem.findMany({
    where: { takeoffId },
    select: {
      id: true,
      confidence: true,
      verified: true,
      verificationStatus: true
    }
  });

  const totalItems = items.length;
  if (totalItems === 0) {
    return {
      totalItems: 0,
      verifiedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      lowConfidenceCount: 0,
      averageConfidence: 0,
      accuracyRate: 0,
      verificationRate: 0
    };
  }

  const verifiedCount = items.filter(i => i.verified || i.verificationStatus === 'auto_approved').length;
  const pendingCount = items.filter(i => i.verificationStatus === 'needs_review').length;
  const rejectedCount = items.filter(i => i.verificationStatus === 'rejected').length;
  const lowConfidenceCount = items.filter(i => (i.confidence || 0) < 60).length;
  const averageConfidence = items.reduce((sum, i) => sum + (i.confidence || 0), 0) / totalItems;

  return {
    totalItems,
    verifiedCount,
    pendingCount,
    rejectedCount,
    lowConfidenceCount,
    averageConfidence: Math.round(averageConfidence),
    accuracyRate: totalItems > 0 ? Math.round((verifiedCount / totalItems) * 100) : 0,
    verificationRate: totalItems > 0 ? Math.round(((verifiedCount + rejectedCount) / totalItems) * 100) : 0
  };
}

/**
 * Identify QA issues in a takeoff
 */
export async function identifyQAIssues(takeoffId: string): Promise<QAIssue[]> {
  const issues: QAIssue[] = [];

  const items = await prisma.takeoffLineItem.findMany({
    where: { takeoffId },
    select: {
      id: true,
      itemName: true,
      category: true,
      quantity: true,
      unit: true,
      confidence: true,
      verificationStatus: true,
      calculationMethod: true
    }
  });

  // Group items by category for outlier detection
  const categoryGroups = new Map<string, typeof items>();
  for (const item of items) {
    const existing = categoryGroups.get(item.category) || [];
    existing.push(item);
    categoryGroups.set(item.category, existing);
  }

  for (const item of items) {
    // Low confidence items
    if ((item.confidence || 0) < 50) {
      issues.push({
        itemId: item.id,
        itemName: item.itemName,
        category: item.category,
        issueType: 'low_confidence',
        severity: (item.confidence || 0) < 30 ? 'high' : 'medium',
        description: `Confidence score is only ${Math.round(item.confidence || 0)}%`,
        suggestedAction: 'Review source document and verify quantity manually',
        confidence: item.confidence || 0
      });
    }

    // Missing or unusual units
    if (!item.unit || item.unit === 'UNKNOWN' || item.unit === 'EA' && item.quantity > 1000) {
      issues.push({
        itemId: item.id,
        itemName: item.itemName,
        category: item.category,
        issueType: 'missing_unit',
        severity: 'medium',
        description: `Unit '${item.unit}' may be incorrect or missing`,
        suggestedAction: 'Verify unit of measure from source document',
        confidence: item.confidence || 0
      });
    }

    // Check for outliers within category
    const categoryItems = categoryGroups.get(item.category) || [];
    if (categoryItems.length > 2) {
      const quantities = categoryItems.map(i => i.quantity);
      const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length;
      const stdDev = Math.sqrt(quantities.reduce((sum, q) => sum + Math.pow(q - avg, 2), 0) / quantities.length);
      
      if (Math.abs(item.quantity - avg) > 2.5 * stdDev && stdDev > 0) {
        issues.push({
          itemId: item.id,
          itemName: item.itemName,
          category: item.category,
          issueType: 'outlier',
          severity: Math.abs(item.quantity - avg) > 3 * stdDev ? 'high' : 'medium',
          description: `Quantity ${item.quantity} is significantly different from category average (${Math.round(avg)})`,
          suggestedAction: 'Verify this quantity is correct or update if data entry error',
          confidence: item.confidence || 0
        });
      }
    }

    // Zero or negative quantities
    if (item.quantity <= 0) {
      issues.push({
        itemId: item.id,
        itemName: item.itemName,
        category: item.category,
        issueType: 'calculation_error',
        severity: 'high',
        description: 'Quantity is zero or negative',
        suggestedAction: 'Review calculation or remove item',
        confidence: item.confidence || 0
      });
    }
  }

  // Check for potential duplicates
  const nameMap = new Map<string, typeof items>();
  for (const item of items) {
    const normalizedName = item.itemName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = nameMap.get(normalizedName);
    if (existing && existing.length > 0) {
      const firstItem = existing[0];
      if (firstItem.category === item.category && firstItem.unit === item.unit) {
        issues.push({
          itemId: item.id,
          itemName: item.itemName,
          category: item.category,
          issueType: 'duplicate_suspect',
          severity: 'low',
          description: `May be a duplicate of "${firstItem.itemName}"`,
          suggestedAction: 'Consider merging with similar item',
          confidence: item.confidence || 0
        });
      }
    }
    const existingItems = nameMap.get(normalizedName) || [];
    existingItems.push(item);
    nameMap.set(normalizedName, existingItems);
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return issues;
}

/**
 * Verify a line item
 */
export async function verifyLineItem(
  itemId: string,
  userId: string,
  options: {
    approved: boolean;
    adjustedQuantity?: number;
    adjustedUnit?: string;
    notes?: string;
  }
): Promise<VerificationResult> {
  const item = await prisma.takeoffLineItem.findUnique({
    where: { id: itemId }
  });

  if (!item) {
    throw new Error('Line item not found');
  }

  const previousStatus = item.verificationStatus || 'needs_review';
  const previousConfidence = item.confidence || 0;

  const updateData: Record<string, unknown> = {
    verified: options.approved,
    verificationStatus: options.approved ? 'auto_approved' : 'rejected',
    updatedAt: new Date()
  };

  if (options.approved) {
    // Boost confidence for verified items
    updateData.confidence = Math.min(100, previousConfidence + 15);
  } else {
    updateData.confidence = Math.max(0, previousConfidence - 20);
  }

  if (options.adjustedQuantity !== undefined) {
    updateData.quantity = options.adjustedQuantity;
    if (item.unitCost) {
      updateData.totalCost = options.adjustedQuantity * item.unitCost;
    }
  }

  if (options.adjustedUnit) {
    updateData.unit = options.adjustedUnit;
  }

  if (options.notes) {
    updateData.notes = options.notes;
  }

  await prisma.takeoffLineItem.update({
    where: { id: itemId },
    data: updateData
  });

  return {
    itemId,
    previousStatus,
    newStatus: updateData.verificationStatus as string,
    previousConfidence,
    newConfidence: updateData.confidence as number,
    verifiedBy: userId,
    notes: options.notes || null
  };
}

/**
 * Bulk verify items by confidence threshold
 */
export async function bulkAutoApprove(
  takeoffId: string,
  confidenceThreshold: number = 85
): Promise<{ approvedCount: number; items: string[] }> {
  const items = await prisma.takeoffLineItem.findMany({
    where: {
      takeoffId,
      verificationStatus: 'needs_review',
      confidence: { gte: confidenceThreshold }
    },
    select: { id: true }
  });

  if (items.length === 0) {
    return { approvedCount: 0, items: [] };
  }

  await prisma.takeoffLineItem.updateMany({
    where: {
      id: { in: items.map(i => i.id) }
    },
    data: {
      verified: true,
      verificationStatus: 'auto_approved',
      updatedAt: new Date()
    }
  });

  return {
    approvedCount: items.length,
    items: items.map(i => i.id)
  };
}

/**
 * Recalculate confidence scores for all items in a takeoff
 */
export async function recalculateConfidenceScores(takeoffId: string): Promise<{
  updated: number;
  averageBefore: number;
  averageAfter: number;
}> {
  const items = await prisma.takeoffLineItem.findMany({
    where: { takeoffId }
  });

  if (items.length === 0) {
    return { updated: 0, averageBefore: 0, averageAfter: 0 };
  }

  const averageBefore = items.reduce((sum, i) => sum + (i.confidence || 0), 0) / items.length;

  let totalNewConfidence = 0;
  for (const item of items) {
    const analysis = analyzeItemConfidence({
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      itemName: item.itemName,
      extractedFrom: item.extractedFrom,
      calculationMethod: item.calculationMethod
    });

    await prisma.takeoffLineItem.update({
      where: { id: item.id },
      data: {
        confidence: analysis.confidence,
        confidenceBreakdown: analysis.breakdown as unknown as Record<string, number>,
        verificationStatus: analysis.confidence >= 85 ? 'auto_approved' :
                           analysis.confidence >= 50 ? 'needs_review' : 'low_confidence'
      }
    });

    totalNewConfidence += analysis.confidence;
  }

  const averageAfter = totalNewConfidence / items.length;

  return {
    updated: items.length,
    averageBefore: Math.round(averageBefore),
    averageAfter: Math.round(averageAfter)
  };
}

/**
 * Get verification history for a takeoff
 */
export async function getVerificationStats(projectId: string): Promise<{
  totalTakeoffs: number;
  totalItems: number;
  verifiedItems: number;
  pendingItems: number;
  rejectedItems: number;
  averageConfidence: number;
  byCategory: Array<{
    category: string;
    count: number;
    verified: number;
    avgConfidence: number;
  }>;
}> {
  const takeoffs = await prisma.materialTakeoff.findMany({
    where: { projectId },
    include: {
      TakeoffLineItem: {
        select: {
          id: true,
          category: true,
          confidence: true,
          verified: true,
          verificationStatus: true
        }
      }
    }
  });

  const allItems = takeoffs.flatMap(t => t.TakeoffLineItem);
  const totalItems = allItems.length;

  if (totalItems === 0) {
    return {
      totalTakeoffs: takeoffs.length,
      totalItems: 0,
      verifiedItems: 0,
      pendingItems: 0,
      rejectedItems: 0,
      averageConfidence: 0,
      byCategory: []
    };
  }

  const verifiedItems = allItems.filter(i => i.verified || i.verificationStatus === 'auto_approved').length;
  const pendingItems = allItems.filter(i => i.verificationStatus === 'needs_review').length;
  const rejectedItems = allItems.filter(i => i.verificationStatus === 'rejected').length;
  const averageConfidence = allItems.reduce((sum, i) => sum + (i.confidence || 0), 0) / totalItems;

  // Group by category
  const categoryMap = new Map<string, { count: number; verified: number; totalConfidence: number }>();
  for (const item of allItems) {
    const existing = categoryMap.get(item.category) || { count: 0, verified: 0, totalConfidence: 0 };
    existing.count++;
    if (item.verified || item.verificationStatus === 'auto_approved') {
      existing.verified++;
    }
    existing.totalConfidence += item.confidence || 0;
    categoryMap.set(item.category, existing);
  }

  const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    count: data.count,
    verified: data.verified,
    avgConfidence: Math.round(data.totalConfidence / data.count)
  })).sort((a, b) => b.count - a.count);

  return {
    totalTakeoffs: takeoffs.length,
    totalItems,
    verifiedItems,
    pendingItems,
    rejectedItems,
    averageConfidence: Math.round(averageConfidence),
    byCategory
  };
}
