/**
 * Dynamic Pricing Service
 * 
 * Uses web search and AI to find current material prices based on:
 * - Material type and specifications
 * - Project location (city, state)
 * - Quantity discounts
 * - Regional pricing variations
 * 
 * Integrates with the construction pricing database to update prices
 * with real-time market data.
 */

import { callAbacusLLM } from './abacus-llm';
import { prisma } from './db';
import { logger } from '@/lib/logger';
import { REGIONAL_MULTIPLIERS, CSI_DIVISION_PRICING, UnitPriceEntry } from './construction-pricing-database';

export interface PriceSearchResult {
  itemId: string;
  itemName: string;
  originalPrice: number;
  suggestedPrice: number;
  priceSource: string;
  priceDate: string;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  webSources?: string[];
}

export interface PriceUpdateSession {
  sessionId: string;
  projectId: string;
  projectLocation: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  itemsToUpdate: PriceSearchResult[];
  totalOriginalCost: number;
  totalSuggestedCost: number;
  costDifference: number;
  searchedAt: Date;
  status: 'searching' | 'ready' | 'applied' | 'cancelled';
}

// Material categories that benefit from web pricing search
const SEARCHABLE_CATEGORIES = [
  'concrete', 'rebar', 'steel', 'lumber', 'drywall', 'roofing',
  'flooring', 'hvac', 'plumbing', 'electrical', 'doors', 'windows',
  'insulation', 'paint', 'tile', 'masonry', 'siding'
];

/**
 * Get regional multiplier based on project location
 */
export function getLocationMultiplier(city?: string, state?: string, zip?: string): number {
  const location = `${city || ''}-${state || ''}`.toLowerCase().replace(/\s+/g, '-');
  
  // Check for exact city-state match
  if (REGIONAL_MULTIPLIERS[location]) {
    return REGIONAL_MULTIPLIERS[location];
  }
  
  // Check for state match
  const stateKey = (state || '').toLowerCase();
  if (REGIONAL_MULTIPLIERS[stateKey]) {
    return REGIONAL_MULTIPLIERS[stateKey];
  }
  
  // Determine region from state
  const stateToRegion: Record<string, string> = {
    // Northeast
    'ny': 'northeast', 'nj': 'northeast', 'pa': 'northeast', 'ct': 'northeast',
    'ma': 'northeast', 'ri': 'northeast', 'vt': 'northeast', 'nh': 'northeast', 'me': 'northeast',
    // Southeast
    'fl': 'southeast', 'ga': 'southeast', 'sc': 'southeast', 'nc': 'southeast',
    'va': 'southeast', 'wv': 'southeast', 'md': 'southeast', 'de': 'southeast',
    'al': 'southeast', 'ms': 'southeast', 'la': 'southeast', 'ar': 'southeast', 'tn': 'southeast',
    // Midwest
    'oh': 'midwest', 'in': 'midwest', 'il': 'midwest', 'mi': 'midwest', 'wi': 'midwest',
    'mn': 'midwest', 'ia': 'midwest', 'mo': 'midwest', 'nd': 'midwest', 'sd': 'midwest',
    'ne': 'midwest', 'ks': 'midwest',
    // Southwest
    'tx': 'southwest', 'ok': 'southwest', 'nm': 'southwest', 'az': 'southwest',
    // West
    'ca': 'west', 'nv': 'west', 'or': 'west', 'wa': 'west', 'hi': 'west', 'ak': 'west',
    // Mountain
    'co': 'mountain', 'ut': 'mountain', 'wy': 'mountain', 'mt': 'mountain', 'id': 'mountain',
    // Kentucky (special case for Morehead project)
    'ky': 'kentucky'
  };
  
  const region = stateToRegion[stateKey] || 'national';
  return REGIONAL_MULTIPLIERS[region] || 1.0;
}

/**
 * Search for current material prices using AI with web search
 */
export async function searchMaterialPrices(
  items: Array<{ id: string; name: string; category: string; unit: string; quantity: number; currentPrice?: number }>,
  location: { city?: string; state?: string; zip?: string }
): Promise<PriceSearchResult[]> {
  const results: PriceSearchResult[] = [];
  const locationMultiplier = getLocationMultiplier(location.city, location.state, location.zip);
  const locationStr = [location.city, location.state, location.zip].filter(Boolean).join(', ') || 'National Average';
  
  // Group items by category for efficient searching
  const itemsByCategory = items.reduce((acc, item) => {
    const cat = item.category.toLowerCase();
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof items>);
  
  // Search prices for each category
  for (const [category, categoryItems] of Object.entries(itemsByCategory)) {
    try {
      // Build a query for the LLM with web search enabled
      const itemNames = categoryItems.map(i => `- ${i.name} (${i.unit})`).join('\n');
      
      const prompt = `You are a construction cost estimating expert. Search for current 2025-2026 material prices in ${locationStr}.

Find current installed/unit prices for these ${category} materials:
${itemNames}

For each item, provide:
1. Current market price per unit (installed cost)
2. Price source (supplier, RSMeans, ENR, etc.)
3. Confidence level (high/medium/low)

Respond in JSON format:
{
  "prices": [
    {
      "itemName": "exact item name",
      "pricePerUnit": 12.50,
      "unit": "SF",
      "source": "RSMeans 2025",
      "confidence": "high",
      "notes": "any relevant notes"
    }
  ],
  "marketTrends": "brief note on current market conditions"
}

Use web search to find the most current pricing data. Consider:
- Supply chain conditions
- Regional labor rates
- Material availability
- Inflation adjustments for 2025`;

      const response = await callAbacusLLM([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        max_tokens: 2000,
      });
      
      // Parse the response
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const prices = parsed.prices || [];
          
          for (const item of categoryItems) {
            const priceInfo = prices.find((p: any) => 
              p.itemName.toLowerCase().includes(item.name.toLowerCase()) ||
              item.name.toLowerCase().includes(p.itemName.toLowerCase())
            );
            
            if (priceInfo) {
              // Apply regional multiplier to the found price
              const adjustedPrice = priceInfo.pricePerUnit * locationMultiplier;
              
              results.push({
                itemId: item.id,
                itemName: item.name,
                originalPrice: item.currentPrice || 0,
                suggestedPrice: Math.round(adjustedPrice * 100) / 100,
                priceSource: `${priceInfo.source} (adjusted for ${locationStr})`,
                priceDate: new Date().toISOString().split('T')[0],
                confidence: priceInfo.confidence || 'medium',
                notes: priceInfo.notes
              });
            } else {
              // Use database fallback with regional adjustment
              const dbPrice = findDatabasePrice(item.name, item.category);
              if (dbPrice) {
                results.push({
                  itemId: item.id,
                  itemName: item.name,
                  originalPrice: item.currentPrice || 0,
                  suggestedPrice: Math.round(dbPrice.totalInstalled * locationMultiplier * 100) / 100,
                  priceSource: `Database (${locationStr} adjusted)`,
                  priceDate: new Date().toISOString().split('T')[0],
                  confidence: 'low',
                  notes: 'Price from internal database - web search did not return specific pricing'
                });
              }
            }
          }
        } catch (parseErr) {
          logger.warn('DYNAMIC_PRICING', 'Failed to parse AI response', { error: String(parseErr) });
        }
      }
    } catch (err) {
      logger.error('DYNAMIC_PRICING', 'Error searching prices', err instanceof Error ? err : undefined, { category });
    }
  }
  
  return results;
}

/**
 * Find price in internal database
 */
function findDatabasePrice(itemName: string, category: string): UnitPriceEntry | null {
  const lowerName = itemName.toLowerCase();
  const lowerCat = category.toLowerCase();
  
  for (const division of CSI_DIVISION_PRICING) {
    for (const [key, entry] of Object.entries(division.items)) {
      if (key.includes(lowerName) || lowerName.includes(key) ||
          division.divisionName.toLowerCase().includes(lowerCat)) {
        return entry;
      }
    }
  }
  
  return null;
}

/**
 * Initialize a price update session for a project
 */
export async function initiatePriceUpdateSession(
  projectSlug: string
): Promise<PriceUpdateSession> {
  // Get project with location
  const project = await prisma.project.findFirst({
    where: { slug: projectSlug }
  });
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  // Get all takeoff line items for the project
  const takeoffs = await prisma.materialTakeoff.findMany({
    where: { projectId: project.id }
  });
  
  // Get line items separately
  const takeoffIds = takeoffs.map(t => t.id);
  const lineItems = await prisma.takeoffLineItem.findMany({
    where: { takeoffId: { in: takeoffIds } }
  });
  
  const allItems = lineItems.map(li => ({
    id: li.id,
    name: li.itemName,
    category: li.category,
    unit: li.unit,
    quantity: li.quantity,
    currentPrice: li.unitCost || undefined
  }));
  
  // Search for updated prices
  const priceResults = await searchMaterialPrices(allItems, {
    city: project.locationCity || undefined,
    state: project.locationState || undefined,
    zip: project.locationZip || undefined
  });
  
  // Calculate totals
  const totalOriginal = priceResults.reduce((sum, r) => {
    const item = allItems.find(i => i.id === r.itemId);
    return sum + (r.originalPrice * (item?.quantity || 0));
  }, 0);
  
  const totalSuggested = priceResults.reduce((sum, r) => {
    const item = allItems.find(i => i.id === r.itemId);
    return sum + (r.suggestedPrice * (item?.quantity || 0));
  }, 0);
  
  return {
    sessionId: `price-update-${Date.now()}`,
    projectId: project.id,
    projectLocation: {
      address: project.projectAddress || undefined,
      city: project.locationCity || undefined,
      state: project.locationState || undefined,
      zip: project.locationZip || undefined
    },
    itemsToUpdate: priceResults,
    totalOriginalCost: totalOriginal,
    totalSuggestedCost: totalSuggested,
    costDifference: totalSuggested - totalOriginal,
    searchedAt: new Date(),
    status: 'ready'
  };
}

/**
 * Apply price updates to takeoff line items
 */
export async function applyPriceUpdates(
  projectId: string,
  updates: Array<{ itemId: string; newPrice: number; priceSource: string }>
): Promise<{ updated: number; failed: number }> {
  let updated = 0;
  let failed = 0;
  
  for (const update of updates) {
    try {
      await prisma.takeoffLineItem.update({
        where: { id: update.itemId },
        data: {
          unitCost: update.newPrice,
          totalCost: undefined, // Will be recalculated
          notes: `Price updated ${new Date().toLocaleDateString()} from ${update.priceSource}`
        }
      });
      
      // Recalculate total cost
      const item = await prisma.takeoffLineItem.findUnique({ where: { id: update.itemId } });
      if (item) {
        await prisma.takeoffLineItem.update({
          where: { id: update.itemId },
          data: {
            totalCost: item.quantity * update.newPrice
          }
        });
      }
      
      updated++;
    } catch (err) {
      logger.error('DYNAMIC_PRICING', 'Failed to update item', err instanceof Error ? err : undefined, { itemId: update.itemId });
      failed++;
    }
  }
  
  return { updated, failed };
}

/**
 * Get price history for an item
 */
export async function getItemPriceHistory(
  itemId: string
): Promise<Array<{ date: Date; price: number; source: string }>> {
  // This would require a price history table - for now return empty
  // In a full implementation, you'd track price changes over time
  return [];
}

/**
 * Export price comparison report
 */
export function generatePriceComparisonReport(session: PriceUpdateSession): string {
  const lines: string[] = [
    '# Price Update Report',
    '',
    `**Project Location:** ${[session.projectLocation.city, session.projectLocation.state, session.projectLocation.zip].filter(Boolean).join(', ') || 'Not specified'}`,
    `**Search Date:** ${session.searchedAt.toLocaleDateString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Items Searched | ${session.itemsToUpdate.length} |`,
    `| Original Total | $${session.totalOriginalCost.toLocaleString()} |`,
    `| Suggested Total | $${session.totalSuggestedCost.toLocaleString()} |`,
    `| Difference | $${session.costDifference.toLocaleString()} (${((session.costDifference / session.totalOriginalCost) * 100).toFixed(1)}%) |`,
    '',
    '## Price Updates',
    '',
    '| Item | Original | Suggested | Change | Source | Confidence |',
    '|------|----------|-----------|--------|--------|------------|'
  ];
  
  for (const item of session.itemsToUpdate) {
    const change = item.suggestedPrice - item.originalPrice;
    const changePercent = item.originalPrice > 0 
      ? ((change / item.originalPrice) * 100).toFixed(1) 
      : 'N/A';
    
    lines.push(
      `| ${item.itemName} | $${item.originalPrice.toFixed(2)} | $${item.suggestedPrice.toFixed(2)} | ${change >= 0 ? '+' : ''}$${change.toFixed(2)} (${changePercent}%) | ${item.priceSource} | ${item.confidence} |`
    );
  }
  
  return lines.join('\n');
}
