/**
 * Takeoff Memory Service
 * 
 * Provides cached material takeoff data for natural language queries.
 * Integrates with RAG system to answer questions like:
 * - "How much concrete do we need?"
 * - "What's the total rebar quantity?"
 * - "List all electrical materials"
 * - "What's the estimated cost for plumbing?"
 */

import { prisma } from './db';
import { TAKEOFF_CATEGORIES, TakeoffCategory, SubCategory } from './takeoff-categories';

// Query detection keywords organized by intent
export const TAKEOFF_QUERY_PATTERNS = {
  // Quantity queries
  quantity: [
    'how much', 'how many', 'total', 'quantity', 'amount',
    'volume', 'area', 'linear feet', 'sq ft', 'cubic yards',
    'tons', 'pounds', 'count', 'number of'
  ],
  
  // Cost queries  
  cost: [
    'cost', 'price', 'estimate', 'budget', 'expense',
    'how much will', 'total cost', 'unit cost', 'material cost'
  ],
  
  // List/summary queries
  list: [
    'list', 'show', 'what materials', 'all materials',
    'takeoff', 'bill of materials', 'BOM', 'material list'
  ],
  
  // Category-specific queries
  categories: {
    concrete: ['concrete', 'slab', 'footing', 'foundation', 'curb', 'pad', 'beam', 'column'],
    rebar: ['rebar', 'reinforcing', 'steel bar', 'reinforcement', 'wwf', 'wire mesh'],
    masonry: ['masonry', 'cmu', 'block', 'brick', 'grout'],
    steel: ['steel', 'wide flange', 'beam', 'tube', 'angle', 'channel'],
    lumber: ['lumber', 'wood', 'plywood', 'framing', 'stud', 'joist', 'sheathing'],
    hvac: ['hvac', 'duct', 'diffuser', 'vav', 'ahu', 'rtu', 'mechanical'],
    plumbing: ['plumbing', 'pipe', 'fixture', 'drain', 'water', 'sanitary'],
    electrical: ['electrical', 'conduit', 'wire', 'panel', 'receptacle', 'lighting', 'circuit'],
    drywall: ['drywall', 'gypsum', 'sheetrock', 'gyp board'],
    flooring: ['flooring', 'tile', 'carpet', 'lvt', 'vinyl', 'terrazzo'],
    ceiling: ['ceiling', 'act', 'acoustic', 'grid', 'gyp ceiling'],
    walls: ['wall', 'partition', 'finish', 'frp', 'tile'],
    doors_windows: ['door', 'window', 'frame', 'hardware', 'glazing'],
    roofing: ['roof', 'roofing', 'membrane', 'insulation', 'flashing'],
    insulation: ['insulation', 'vapor barrier', 'r-value', 'thermal'],
    earthwork: ['earthwork', 'excavation', 'fill', 'grading', 'backfill'],
    paving: ['paving', 'asphalt', 'concrete paving', 'curb', 'sidewalk'],
    site_utilities: ['utility', 'storm', 'sanitary', 'water main', 'gas', 'underground']
  }
};

export interface TakeoffQueryResult {
  queryType: 'quantity' | 'cost' | 'list' | 'specific' | 'summary';
  matchedCategories: string[];
  items: TakeoffItem[];
  categorySummary: CategorySummary[];
  grandTotals: GrandTotals;
  formattedContext: string;
  confidenceNote: string;
}

export interface TakeoffItem {
  id: string;
  category: string;
  categoryName: string;
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost?: number;
  location?: string;
  sheetNumber?: string;
  confidence: number;
  verified: boolean;
  wasteAdjusted?: number;
  laborHours?: number;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  itemCount: number;
  totalQuantity: number;
  unit: string;
  totalCost: number;
  avgConfidence: number;
  wasteAdjustedQuantity: number;
  estimatedLaborHours: number;
}

export interface GrandTotals {
  totalItems: number;
  totalCost: number;
  totalLaborHours: number;
  avgConfidence: number;
  verifiedCount: number;
  needsReviewCount: number;
}

/**
 * Detect what type of takeoff query the user is asking
 */
export function detectTakeoffQuery(query: string): {
  isTakeoffQuery: boolean;
  queryType: 'quantity' | 'cost' | 'list' | 'specific' | 'summary' | null;
  matchedCategories: string[];
} {
  const queryLower = query.toLowerCase();
  
  // Check for category-specific keywords
  const matchedCategories: string[] = [];
  for (const [categoryId, keywords] of Object.entries(TAKEOFF_QUERY_PATTERNS.categories)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      matchedCategories.push(categoryId);
    }
  }
  
  // Determine query type
  const isQuantityQuery = TAKEOFF_QUERY_PATTERNS.quantity.some(kw => queryLower.includes(kw));
  const isCostQuery = TAKEOFF_QUERY_PATTERNS.cost.some(kw => queryLower.includes(kw));
  const isListQuery = TAKEOFF_QUERY_PATTERNS.list.some(kw => queryLower.includes(kw));
  
  let queryType: 'quantity' | 'cost' | 'list' | 'specific' | 'summary' | null = null;
  
  if (isQuantityQuery && matchedCategories.length > 0) {
    queryType = 'specific';
  } else if (isCostQuery && matchedCategories.length > 0) {
    queryType = 'specific';
  } else if (isQuantityQuery) {
    queryType = 'quantity';
  } else if (isCostQuery) {
    queryType = 'cost';
  } else if (isListQuery) {
    queryType = 'list';
  } else if (matchedCategories.length > 0) {
    queryType = 'specific';
  } else if (queryLower.includes('material') || queryLower.includes('takeoff')) {
    queryType = 'summary';
  }
  
  const isTakeoffQuery = queryType !== null;
  
  return { isTakeoffQuery, queryType, matchedCategories };
}

/**
 * Get category info from TAKEOFF_CATEGORIES
 */
function getCategoryInfo(categoryId: string): { category?: TakeoffCategory; subCategory?: SubCategory } {
  for (const cat of TAKEOFF_CATEGORIES) {
    if (cat.id === categoryId) {
      return { category: cat };
    }
    for (const sub of cat.subCategories) {
      if (sub.id === categoryId || sub.name.toLowerCase() === categoryId.toLowerCase()) {
        return { category: cat, subCategory: sub };
      }
    }
  }
  return {};
}

/**
 * Get waste factor and labor hours for a category
 */
function getWasteAndLabor(categoryId: string, unit: string): { wasteFactor: number; laborHoursPerUnit: number } {
  const { category, subCategory } = getCategoryInfo(categoryId);
  
  if (subCategory) {
    return {
      wasteFactor: 1 + (subCategory.wasteFactorPercent / 100),
      laborHoursPerUnit: subCategory.laborHoursPerUnit
    };
  }
  
  if (category && category.subCategories.length > 0) {
    // Average across subcategories
    const avgWaste = category.subCategories.reduce((sum, s) => sum + s.wasteFactorPercent, 0) / category.subCategories.length;
    const avgLabor = category.subCategories.reduce((sum, s) => sum + s.laborHoursPerUnit, 0) / category.subCategories.length;
    return {
      wasteFactor: 1 + (avgWaste / 100),
      laborHoursPerUnit: avgLabor
    };
  }
  
  // Default values
  return { wasteFactor: 1.05, laborHoursPerUnit: 0.5 };
}

/**
 * Retrieve takeoff data for a project based on query context
 */
export async function getTakeoffContext(
  query: string,
  projectSlug: string
): Promise<TakeoffQueryResult | null> {
  const detection = detectTakeoffQuery(query);
  
  if (!detection.isTakeoffQuery) {
    return null;
  }
  
  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true, name: true }
    });
    
    if (!project) {
      return null;
    }
    
    // Build category filter
    let categoryFilter: any = undefined;
    if (detection.matchedCategories.length > 0) {
      // Match against category ID or name containing the keyword
      categoryFilter = {
        OR: detection.matchedCategories.map(cat => ({
          category: { contains: cat, mode: 'insensitive' as const }
        }))
      };
    }
    
    // Fetch takeoff line items
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { 
        projectId: project.id,
        status: { not: 'deleted' }
      },
      include: {
        TakeoffLineItem: {
          where: categoryFilter,
          orderBy: { category: 'asc' }
        },
        Document: {
          select: { name: true }
        }
      }
    });
    
    // Flatten all line items
    const allItems: TakeoffItem[] = [];
    const categoryMap = new Map<string, CategorySummary>();
    
    for (const takeoff of takeoffs) {
      for (const item of takeoff.TakeoffLineItem) {
        const { category } = getCategoryInfo(item.category);
        const categoryName = category?.name || item.category;
        const { wasteFactor, laborHoursPerUnit } = getWasteAndLabor(item.category, item.unit);
        
        const wasteAdjusted = item.quantity * wasteFactor;
        const laborHours = item.quantity * laborHoursPerUnit;
        
        const takeoffItem: TakeoffItem = {
          id: item.id,
          category: item.category,
          categoryName,
          itemName: item.itemName,
          description: item.description || undefined,
          quantity: item.quantity,
          unit: item.unit,
          unitCost: item.unitCost || undefined,
          totalCost: item.totalCost || undefined,
          location: item.location || undefined,
          sheetNumber: item.sheetNumber || undefined,
          confidence: item.confidence || 0,
          verified: item.verified,
          wasteAdjusted,
          laborHours
        };
        
        allItems.push(takeoffItem);
        
        // Aggregate by category
        const existing = categoryMap.get(item.category) || {
          categoryId: item.category,
          categoryName,
          itemCount: 0,
          totalQuantity: 0,
          unit: item.unit,
          totalCost: 0,
          avgConfidence: 0,
          wasteAdjustedQuantity: 0,
          estimatedLaborHours: 0
        };
        
        existing.itemCount++;
        existing.totalQuantity += item.quantity;
        existing.totalCost += item.totalCost || 0;
        existing.avgConfidence += item.confidence || 0;
        existing.wasteAdjustedQuantity += wasteAdjusted;
        existing.estimatedLaborHours += laborHours;
        
        categoryMap.set(item.category, existing);
      }
    }
    
    // Finalize category summaries
    const categorySummary: CategorySummary[] = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      avgConfidence: cat.itemCount > 0 ? cat.avgConfidence / cat.itemCount : 0
    }));
    
    // Calculate grand totals
    const grandTotals: GrandTotals = {
      totalItems: allItems.length,
      totalCost: allItems.reduce((sum, item) => sum + (item.totalCost || 0), 0),
      totalLaborHours: allItems.reduce((sum, item) => sum + (item.laborHours || 0), 0),
      avgConfidence: allItems.length > 0 
        ? allItems.reduce((sum, item) => sum + item.confidence, 0) / allItems.length 
        : 0,
      verifiedCount: allItems.filter(item => item.verified).length,
      needsReviewCount: allItems.filter(item => !item.verified).length
    };
    
    // Generate confidence note
    let confidenceNote = '';
    if (grandTotals.avgConfidence >= 80) {
      confidenceNote = 'High confidence - most items are AI-extracted with strong pattern matches or manually verified.';
    } else if (grandTotals.avgConfidence >= 60) {
      confidenceNote = 'Moderate confidence - recommend reviewing low-confidence items before using for estimates.';
    } else {
      confidenceNote = 'Low confidence - many items need manual verification. Use quantities as rough estimates only.';
    }
    
    // Format context for AI
    const formattedContext = formatTakeoffForAI(
      detection.queryType!,
      detection.matchedCategories,
      allItems,
      categorySummary,
      grandTotals,
      confidenceNote
    );
    
    return {
      queryType: detection.queryType!,
      matchedCategories: detection.matchedCategories,
      items: allItems,
      categorySummary,
      grandTotals,
      formattedContext,
      confidenceNote
    };
    
  } catch (error) {
    console.error('[TakeoffMemory] Error retrieving takeoff context:', error);
    return null;
  }
}

/**
 * Format takeoff data as structured context for AI
 */
function formatTakeoffForAI(
  queryType: string,
  matchedCategories: string[],
  items: TakeoffItem[],
  categorySummary: CategorySummary[],
  grandTotals: GrandTotals,
  confidenceNote: string
): string {
  const lines: string[] = [];
  
  lines.push('=== MATERIAL TAKEOFF DATA ===');
  lines.push('');
  
  // Grand summary
  lines.push('📊 SUMMARY:');
  lines.push(`• Total Items: ${grandTotals.totalItems}`);
  lines.push(`• Total Estimated Cost: $${grandTotals.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  lines.push(`• Estimated Labor Hours: ${grandTotals.totalLaborHours.toFixed(1)}`);
  lines.push(`• Verified Items: ${grandTotals.verifiedCount} / ${grandTotals.totalItems}`);
  lines.push(`• Average Confidence: ${grandTotals.avgConfidence.toFixed(0)}%`);
  lines.push('');
  
  // Category breakdown
  if (categorySummary.length > 0) {
    lines.push('📁 BY CATEGORY:');
    
    // Sort by total cost descending
    const sortedCategories = [...categorySummary].sort((a, b) => b.totalCost - a.totalCost);
    
    for (const cat of sortedCategories) {
      lines.push(`\n${cat.categoryName.toUpperCase()}:`);
      lines.push(`  • Quantity: ${cat.totalQuantity.toFixed(2)} ${cat.unit}`);
      lines.push(`  • With Waste (${((cat.wasteAdjustedQuantity / cat.totalQuantity - 1) * 100).toFixed(0)}%): ${cat.wasteAdjustedQuantity.toFixed(2)} ${cat.unit}`);
      lines.push(`  • Cost: $${cat.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      lines.push(`  • Items: ${cat.itemCount}`);
      lines.push(`  • Confidence: ${cat.avgConfidence.toFixed(0)}%`);
    }
    lines.push('');
  }
  
  // Detailed items for specific queries (limit to avoid context overflow)
  if ((queryType === 'specific' || queryType === 'list') && items.length > 0) {
    lines.push('📋 DETAILED ITEMS:');
    
    // Group by category for readability
    const itemsByCategory = new Map<string, TakeoffItem[]>();
    for (const item of items) {
      const existing = itemsByCategory.get(item.categoryName) || [];
      existing.push(item);
      itemsByCategory.set(item.categoryName, existing);
    }
    
    for (const [categoryName, catItems] of itemsByCategory) {
      lines.push(`\n${categoryName}:`);
      
      // Limit items per category to prevent context overflow
      const displayItems = catItems.slice(0, 15);
      
      for (const item of displayItems) {
        const costStr = item.unitCost 
          ? `@ $${item.unitCost.toFixed(2)}/${item.unit} = $${(item.totalCost || 0).toFixed(2)}`
          : '';
        const locationStr = item.location ? ` [${item.location}]` : '';
        const sheetStr = item.sheetNumber ? ` (Sheet ${item.sheetNumber})` : '';
        const confidenceIcon = item.confidence >= 80 ? '✓' : item.confidence >= 50 ? '~' : '?';
        
        lines.push(`  ${confidenceIcon} ${item.itemName}: ${item.quantity.toFixed(2)} ${item.unit} ${costStr}${locationStr}${sheetStr}`);
        
        if (item.description) {
          lines.push(`      ${item.description}`);
        }
      }
      
      if (catItems.length > 15) {
        lines.push(`  ... and ${catItems.length - 15} more items`);
      }
    }
    lines.push('');
  }
  
  // Confidence note
  lines.push('⚠️ CONFIDENCE NOTE:');
  lines.push(confidenceNote);
  lines.push('');
  
  // Usage guidelines for AI
  lines.push('💡 USAGE GUIDELINES:');
  lines.push('• Quantities include waste factors where applicable');
  lines.push('• Items marked ✓ are verified, ~ are moderate confidence, ? need review');
  lines.push('• Always mention confidence level when providing quantities');
  lines.push('• Recommend verification for items below 70% confidence');
  lines.push('• Cost estimates are preliminary - actual costs may vary');
  
  return lines.join('\n');
}

/**
 * Quick lookup for specific material quantities
 */
export async function getMaterialQuantity(
  projectSlug: string,
  materialType: string
): Promise<{ quantity: number; unit: string; confidence: number; itemCount: number } | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });
    
    if (!project) return null;
    
    const items = await prisma.takeoffLineItem.findMany({
      where: {
        MaterialTakeoff: {
          projectId: project.id,
          status: { not: 'deleted' }
        },
        OR: [
          { category: { contains: materialType, mode: 'insensitive' } },
          { itemName: { contains: materialType, mode: 'insensitive' } }
        ]
      },
      select: {
        quantity: true,
        unit: true,
        confidence: true
      }
    });
    
    if (items.length === 0) return null;
    
    // Aggregate
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const avgConfidence = items.reduce((sum, item) => sum + (item.confidence || 0), 0) / items.length;
    
    return {
      quantity: totalQty,
      unit: items[0].unit,
      confidence: avgConfidence,
      itemCount: items.length
    };
    
  } catch (error) {
    console.error('[TakeoffMemory] Error getting material quantity:', error);
    return null;
  }
}

/**
 * Get category totals for quick reference
 */
export async function getCategoryTotals(
  projectSlug: string
): Promise<Map<string, { quantity: number; unit: string; cost: number }>> {
  const result = new Map();
  
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });
    
    if (!project) return result;
    
    const items = await prisma.takeoffLineItem.findMany({
      where: {
        MaterialTakeoff: {
          projectId: project.id,
          status: { not: 'deleted' }
        }
      },
      select: {
        category: true,
        quantity: true,
        unit: true,
        totalCost: true
      }
    });
    
    for (const item of items) {
      const existing = result.get(item.category) || { quantity: 0, unit: item.unit, cost: 0 };
      existing.quantity += item.quantity;
      existing.cost += item.totalCost || 0;
      result.set(item.category, existing);
    }
    
  } catch (error) {
    console.error('[TakeoffMemory] Error getting category totals:', error);
  }
  
  return result;
}
