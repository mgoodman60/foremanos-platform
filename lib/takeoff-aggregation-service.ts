/**
 * Multi-Plan Takeoff Aggregation Service
 * 
 * Consolidates material takeoffs across multiple drawing sheets
 * into unified material lists with intelligent merging.
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { logger } from './logger';

// Types
interface AggregatedLineItem {
  id: string;
  itemName: string;
  description: string | null;
  category: string;
  totalQuantity: number;
  unit: string;
  unitCost: number | null;
  totalCost: number | null;
  sources: SourceReference[];
  mergedCount: number;
  confidence: number;
  tradeType: string | null;
  csiCode: string | null;
}

interface SourceReference {
  takeoffId: string;
  takeoffName: string;
  lineItemId: string;
  sheetNumber: string | null;
  documentName: string | null;
  quantity: number;
  location: string | null;
}

interface CategorySummary {
  category: string;
  itemCount: number;
  totalQuantity: number;
  totalCost: number;
  units: string[];
}

interface TradeBreakdown {
  trade: string;
  itemCount: number;
  totalCost: number;
  categories: string[];
}

interface AggregationResult {
  aggregationId: string;
  name: string;
  totalItems: number;
  totalCost: number;
  duplicatesMerged: number;
  aggregatedItems: AggregatedLineItem[];
  categorySummary: CategorySummary[];
  tradeBreakdown: TradeBreakdown[];
  sourceSheets: string[];
  sourceTakeoffs: string[];
}

// Trade type inference from category/item name
const TRADE_MAPPINGS: Record<string, string[]> = {
  'Electrical': ['electrical', 'wire', 'conduit', 'panel', 'outlet', 'switch', 'lighting', 'fixture', 'circuit', 'breaker'],
  'Plumbing': ['plumbing', 'pipe', 'valve', 'faucet', 'toilet', 'sink', 'drain', 'water', 'sewer', 'pvc', 'copper'],
  'HVAC': ['hvac', 'duct', 'diffuser', 'register', 'thermostat', 'furnace', 'air handler', 'condenser', 'vav', 'ahu'],
  'Structural Steel': ['steel', 'beam', 'column', 'joist', 'girder', 'angle', 'channel', 'hss', 'w-shape'],
  'Concrete': ['concrete', 'rebar', 'form', 'foundation', 'slab', 'footing', 'pier', 'cmu', 'masonry'],
  'Framing': ['framing', 'stud', 'lumber', 'plywood', 'osb', 'sheathing', 'joist', 'rafter', 'truss'],
  'Drywall': ['drywall', 'gypsum', 'sheetrock', 'gyp bd', 'tape', 'mud', 'joint compound'],
  'Roofing': ['roof', 'shingle', 'membrane', 'flashing', 'gutter', 'downspout', 'epdm', 'tpo'],
  'Flooring': ['flooring', 'tile', 'carpet', 'vinyl', 'hardwood', 'laminate', 'lvt', 'epoxy'],
  'Painting': ['paint', 'primer', 'stain', 'finish', 'coating'],
  'Insulation': ['insulation', 'batt', 'blown', 'spray foam', 'rigid', 'fiberglass'],
  'Fire Protection': ['fire', 'sprinkler', 'extinguisher', 'alarm', 'suppression'],
  'Doors & Windows': ['door', 'window', 'frame', 'hardware', 'glazing', 'storefront']
};

// CSI Division mappings
const CSI_MAPPINGS: Record<string, string> = {
  'Concrete': '03',
  'Masonry': '04',
  'Metals': '05',
  'Structural Steel': '05',
  'Framing': '06',
  'Thermal Protection': '07',
  'Roofing': '07',
  'Insulation': '07',
  'Doors & Windows': '08',
  'Finishes': '09',
  'Drywall': '09',
  'Flooring': '09',
  'Painting': '09',
  'Specialties': '10',
  'Equipment': '11',
  'Furnishings': '12',
  'Fire Protection': '21',
  'Plumbing': '22',
  'HVAC': '23',
  'Electrical': '26'
};

/**
 * Infer trade type from category and item name
 */
function inferTradeType(category: string, itemName: string): string | null {
  const searchText = `${category} ${itemName}`.toLowerCase();
  
  for (const [trade, keywords] of Object.entries(TRADE_MAPPINGS)) {
    if (keywords.some(kw => searchText.includes(kw))) {
      return trade;
    }
  }
  
  return null;
}

/**
 * Get CSI code from trade type
 */
function getCSICode(trade: string | null): string | null {
  if (!trade) return null;
  return CSI_MAPPINGS[trade] || null;
}

/**
 * Normalize item names for comparison
 */
function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two items can be merged
 */
function canMergeItems(item1: { itemName: string; category: string; unit: string }, 
                       item2: { itemName: string; category: string; unit: string }): boolean {
  // Must have same category and unit
  if (item1.category !== item2.category) return false;
  if (item1.unit !== item2.unit) return false;
  
  // Check name similarity
  const name1 = normalizeItemName(item1.itemName);
  const name2 = normalizeItemName(item2.itemName);
  
  // Exact match
  if (name1 === name2) return true;
  
  // One contains the other
  if (name1.includes(name2) || name2.includes(name1)) return true;
  
  // High word overlap
  const words1 = new Set(name1.split(' '));
  const words2 = new Set(name2.split(' '));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  const similarity = intersection.size / union.size;
  
  return similarity > 0.7;
}

/**
 * Get available sheets from project takeoffs
 */
export async function getAvailableSheets(projectId: string): Promise<{
  sheets: { sheetNumber: string; documentName: string | null; itemCount: number }[];
  takeoffs: { id: string; name: string; documentName: string | null; itemCount: number }[];
}> {
  const takeoffs = await prisma.materialTakeoff.findMany({
    where: { projectId },
    include: {
      Document: { select: { name: true, fileName: true } },
      TakeoffLineItem: {
        select: { sheetNumber: true }
      }
    }
  });

  // Collect unique sheets
  const sheetMap = new Map<string, { documentName: string | null; itemCount: number }>();
  
  for (const takeoff of takeoffs) {
    for (const item of takeoff.TakeoffLineItem) {
      const sheet = item.sheetNumber || 'Unknown';
      const existing = sheetMap.get(sheet);
      if (existing) {
        existing.itemCount++;
      } else {
        sheetMap.set(sheet, {
          documentName: takeoff.Document?.name || takeoff.Document?.fileName || null,
          itemCount: 1
        });
      }
    }
  }

  const sheets = Array.from(sheetMap.entries()).map(([sheetNumber, data]) => ({
    sheetNumber,
    documentName: data.documentName,
    itemCount: data.itemCount
  })).sort((a, b) => a.sheetNumber.localeCompare(b.sheetNumber));

  const takeoffSummary = takeoffs.map((t: typeof takeoffs[0]) => ({
    id: t.id,
    name: t.name,
    documentName: t.Document?.name || t.Document?.fileName || null,
    itemCount: t.TakeoffLineItem.length
  }));

  return { sheets, takeoffs: takeoffSummary };
}

/**
 * Aggregate takeoffs from multiple sheets into a unified list
 */
export async function aggregateTakeoffs(
  projectId: string,
  userId: string,
  options: {
    name: string;
    description?: string;
    sheetNumbers?: string[];  // Filter by specific sheets
    takeoffIds?: string[];    // Or filter by specific takeoffs
    mergeStrategy: 'smart' | 'sum_all' | 'keep_separate';
    includeUnverified?: boolean;
  }
): Promise<AggregationResult> {
  const { name, description, sheetNumbers, takeoffIds, mergeStrategy, includeUnverified = false } = options;

  // Build where clause
  const whereClause: Record<string, unknown> = { projectId };
  if (takeoffIds && takeoffIds.length > 0) {
    whereClause.id = { in: takeoffIds };
  }

  // Fetch takeoffs with line items
  const takeoffs = await prisma.materialTakeoff.findMany({
    where: whereClause,
    include: {
      Document: { select: { id: true, name: true, fileName: true } },
      TakeoffLineItem: true
    }
  });

  if (takeoffs.length === 0) {
    throw new Error('No takeoffs found for aggregation');
  }

  // Collect all line items with source tracking
  const allItems: Array<{
    item: typeof takeoffs[0]['TakeoffLineItem'][0];
    takeoff: typeof takeoffs[0];
  }> = [];

  for (const takeoff of takeoffs) {
    for (const item of takeoff.TakeoffLineItem) {
      // Filter by sheet if specified
      if (sheetNumbers && sheetNumbers.length > 0) {
        if (!item.sheetNumber || !sheetNumbers.includes(item.sheetNumber)) {
          continue;
        }
      }
      
      // Filter by verification status
      if (!includeUnverified && item.verificationStatus === 'rejected') {
        continue;
      }
      
      allItems.push({ item, takeoff });
    }
  }

  // Aggregate based on strategy
  const aggregatedMap = new Map<string, AggregatedLineItem>();
  let duplicatesMerged = 0;

  for (const { item, takeoff } of allItems) {
    const tradeType = inferTradeType(item.category, item.itemName);
    const csiCode = getCSICode(tradeType);
    
    // Create source reference
    const source: SourceReference = {
      takeoffId: takeoff.id,
      takeoffName: takeoff.name,
      lineItemId: item.id,
      sheetNumber: item.sheetNumber,
      documentName: takeoff.Document?.name || takeoff.Document?.fileName || null,
      quantity: item.quantity,
      location: item.location
    };

    if (mergeStrategy === 'keep_separate') {
      // Each item stays separate
      const key = `${item.id}`;
      aggregatedMap.set(key, {
        id: item.id,
        itemName: item.itemName,
        description: item.description,
        category: item.category,
        totalQuantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        sources: [source],
        mergedCount: 1,
        confidence: item.confidence || 0,
        tradeType,
        csiCode
      });
    } else {
      // Smart merge or sum all - find matching items
      let foundMatch = false;
      
      for (const [key, existing] of aggregatedMap.entries()) {
        const shouldMerge = mergeStrategy === 'sum_all' 
          ? (existing.itemName === item.itemName && existing.category === item.category && existing.unit === item.unit)
          : canMergeItems(existing, item);
          
        if (shouldMerge) {
          // Merge quantities
          existing.totalQuantity += item.quantity;
          existing.sources.push(source);
          existing.mergedCount++;
          
          // Average confidence
          existing.confidence = existing.sources.reduce((sum, s) => {
            const sourceItem = allItems.find(ai => ai.item.id === s.lineItemId);
            return sum + (sourceItem?.item.confidence || 0);
          }, 0) / existing.sources.length;
          
          // Recalculate total cost if unit cost exists
          if (existing.unitCost) {
            existing.totalCost = existing.totalQuantity * existing.unitCost;
          }
          
          duplicatesMerged++;
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        // New unique item
        const key = `${item.category}-${normalizeItemName(item.itemName)}-${item.unit}`;
        aggregatedMap.set(key, {
          id: item.id,
          itemName: item.itemName,
          description: item.description,
          category: item.category,
          totalQuantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          sources: [source],
          mergedCount: 1,
          confidence: item.confidence || 0,
          tradeType,
          csiCode
        });
      }
    }
  }

  const aggregatedItems = Array.from(aggregatedMap.values());

  // Calculate category summary
  const categoryMap = new Map<string, CategorySummary>();
  for (const item of aggregatedItems) {
    const existing = categoryMap.get(item.category);
    if (existing) {
      existing.itemCount++;
      existing.totalQuantity += item.totalQuantity;
      existing.totalCost += item.totalCost || 0;
      if (!existing.units.includes(item.unit)) {
        existing.units.push(item.unit);
      }
    } else {
      categoryMap.set(item.category, {
        category: item.category,
        itemCount: 1,
        totalQuantity: item.totalQuantity,
        totalCost: item.totalCost || 0,
        units: [item.unit]
      });
    }
  }
  const categorySummary = Array.from(categoryMap.values())
    .sort((a, b) => b.totalCost - a.totalCost);

  // Calculate trade breakdown
  const tradeMap = new Map<string, TradeBreakdown>();
  for (const item of aggregatedItems) {
    const trade = item.tradeType || 'Other';
    const existing = tradeMap.get(trade);
    if (existing) {
      existing.itemCount++;
      existing.totalCost += item.totalCost || 0;
      if (!existing.categories.includes(item.category)) {
        existing.categories.push(item.category);
      }
    } else {
      tradeMap.set(trade, {
        trade,
        itemCount: 1,
        totalCost: item.totalCost || 0,
        categories: [item.category]
      });
    }
  }
  const tradeBreakdown = Array.from(tradeMap.values())
    .sort((a, b) => b.totalCost - a.totalCost);

  // Collect source sheets
  const sourceSheets = [...new Set(allItems
    .map(ai => ai.item.sheetNumber)
    .filter((s): s is string => s !== null))];

  const sourceTakeoffIds = Array.from(new Set(takeoffs.map((t: { id: string }) => t.id))) as string[];

  // Calculate totals
  const totalCost = aggregatedItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

  // Save aggregation to database
  const aggregation = await prisma.takeoffAggregation.create({
    data: {
      projectId,
      name,
      description,
      sourceSheets,
      sourceTakeoffs: sourceTakeoffIds,
      totalItems: aggregatedItems.length,
      totalQuantity: aggregatedItems.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalCost,
      aggregatedData: JSON.parse(JSON.stringify(aggregatedItems)),
      categorySummary: JSON.parse(JSON.stringify(categorySummary)),
      tradeBreakdown: JSON.parse(JSON.stringify(tradeBreakdown)),
      duplicatesMerged,
      createdBy: userId
    }
  });

  return {
    aggregationId: aggregation.id,
    name,
    totalItems: aggregatedItems.length,
    totalCost,
    duplicatesMerged,
    aggregatedItems,
    categorySummary,
    tradeBreakdown,
    sourceSheets,
    sourceTakeoffs: sourceTakeoffIds
  };
}

/**
 * Use AI to enhance aggregation with better item matching
 */
export async function enhanceAggregationWithAI(
  aggregationId: string
): Promise<{ enhancedItems: number; mergesSuggested: number }> {
  const aggregation = await prisma.takeoffAggregation.findUnique({
    where: { id: aggregationId }
  });

  if (!aggregation || !aggregation.aggregatedData) {
    throw new Error('Aggregation not found');
  }

  const items = aggregation.aggregatedData as unknown as AggregatedLineItem[];

  // Prepare items for AI analysis
  const itemsForAnalysis = items.slice(0, 100).map(item => ({
    id: item.id,
    name: item.itemName,
    category: item.category,
    quantity: item.totalQuantity,
    unit: item.unit,
    sources: item.sources.length
  }));

  const prompt = `Analyze these construction material takeoff items and identify potential duplicates or items that should be merged:

${JSON.stringify(itemsForAnalysis, null, 2)}

Return a JSON object with:
1. "mergeSuggestions": Array of { itemIds: string[], reason: string, suggestedName: string }
2. "categoryCorrections": Array of { itemId: string, currentCategory: string, suggestedCategory: string, reason: string }
3. "tradeAssignments": Array of { itemId: string, trade: string, confidence: number }

Only suggest merges for items that are clearly the same material.`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-5.2' }
    );
    const content = response.content;
    
    // Parse AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { enhancedItems: 0, mergesSuggested: 0 };
    }

    const analysis = JSON.parse(jsonMatch[0]);
    const mergeSuggestions = analysis.mergeSuggestions || [];
    
    // Store suggestions but don't auto-apply
    await prisma.takeoffAggregation.update({
      where: { id: aggregationId },
      data: {
        aggregatedData: {
          ...aggregation.aggregatedData as object,
          aiSuggestions: analysis
        }
      }
    });

    return {
      enhancedItems: (analysis.categoryCorrections?.length || 0) + (analysis.tradeAssignments?.length || 0),
      mergesSuggested: mergeSuggestions.length
    };
  } catch (error) {
    logger.error('TAKEOFF_AGGREGATION', 'AI enhancement error', error as Error);
    return { enhancedItems: 0, mergesSuggested: 0 };
  }
}

/**
 * Get aggregation by ID with full details
 */
export async function getAggregation(aggregationId: string): Promise<AggregationResult | null> {
  const aggregation = await prisma.takeoffAggregation.findUnique({
    where: { id: aggregationId },
    include: {
      User: { select: { id: true, username: true, email: true } },
      Project: { select: { id: true, name: true, slug: true } }
    }
  });

  if (!aggregation) return null;

  return {
    aggregationId: aggregation.id,
    name: aggregation.name,
    totalItems: aggregation.totalItems,
    totalCost: aggregation.totalCost || 0,
    duplicatesMerged: aggregation.duplicatesMerged,
    aggregatedItems: (aggregation.aggregatedData as unknown as AggregatedLineItem[]) || [],
    categorySummary: (aggregation.categorySummary as unknown as CategorySummary[]) || [],
    tradeBreakdown: (aggregation.tradeBreakdown as unknown as TradeBreakdown[]) || [],
    sourceSheets: (aggregation.sourceSheets as unknown as string[]) || [],
    sourceTakeoffs: (aggregation.sourceTakeoffs as unknown as string[]) || []
  };
}

/**
 * Export aggregation to CSV format
 */
export function exportAggregationToCSV(aggregation: AggregationResult): string {
  const headers = [
    'Item Name',
    'Description',
    'Category',
    'Trade',
    'CSI Code',
    'Quantity',
    'Unit',
    'Unit Cost',
    'Total Cost',
    'Sources',
    'Merged Count',
    'Confidence'
  ];

  const rows = aggregation.aggregatedItems.map(item => [
    item.itemName,
    item.description || '',
    item.category,
    item.tradeType || '',
    item.csiCode || '',
    item.totalQuantity.toFixed(2),
    item.unit,
    item.unitCost?.toFixed(2) || '',
    item.totalCost?.toFixed(2) || '',
    item.sources.map(s => s.sheetNumber || 'Unknown').join('; '),
    item.mergedCount.toString(),
    (item.confidence * 100).toFixed(0) + '%'
  ]);

  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  return [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');
}

/**
 * List all aggregations for a project
 */
export async function listAggregations(projectId: string) {
  return prisma.takeoffAggregation.findMany({
    where: { projectId },
    include: {
      User: { select: { id: true, username: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

/**
 * Delete an aggregation
 */
export async function deleteAggregation(aggregationId: string) {
  return prisma.takeoffAggregation.delete({
    where: { id: aggregationId }
  });
}

/**
 * Update aggregation status
 */
export async function updateAggregationStatus(
  aggregationId: string,
  status: 'draft' | 'finalized' | 'approved',
  userId?: string
) {
  const data: Record<string, unknown> = { status };
  
  if (status === 'approved' && userId) {
    data.approvedBy = userId;
    data.approvedAt = new Date();
  }

  return prisma.takeoffAggregation.update({
    where: { id: aggregationId },
    data
  });
}
