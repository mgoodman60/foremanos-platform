import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

/**
 * POST /api/projects/[slug]/takeoffs/sync-from-budget
 * Sync takeoff item pricing from the actual budget data in the database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get budget items from database
    const budget = await prisma.projectBudget.findUnique({
      where: { projectId: project.id },
      include: {
        BudgetItem: true,
      },
    });

    if (!budget || !budget.BudgetItem.length) {
      return NextResponse.json({
        success: false,
        message: 'No budget data found. Please upload and extract a budget document first.',
      });
    }

    // Get all takeoff items
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId: project.id },
      include: {
        TakeoffLineItem: true,
      },
    });

    if (!takeoffs.length) {
      return NextResponse.json({
        success: false,
        message: 'No takeoff items found to sync.',
      });
    }

    const allItems = takeoffs.flatMap(t => t.TakeoffLineItem);

    // Build category-to-budget mapping using fuzzy matching
    const categoryMappings = buildCategoryBudgetMapping(budget.BudgetItem);

    // Track updates
    const updates: Array<{ id: string; unitCost: number; totalCost: number; budgetItemName: string }> = [];
    const itemsByBudgetItem: Record<string, typeof allItems> = {};

    // Group items by matched budget item
    for (const item of allItems) {
      const category = (item.bimCategory || item.category || '').toLowerCase();
      const matchedBudgetItem = findBestBudgetMatch(category, item.itemName || '', budget.BudgetItem, categoryMappings);

      if (matchedBudgetItem) {
        if (!itemsByBudgetItem[matchedBudgetItem.id]) {
          itemsByBudgetItem[matchedBudgetItem.id] = [];
        }
        itemsByBudgetItem[matchedBudgetItem.id].push(item);
      }
    }

    // Distribute budget amounts across matched items
    for (const [budgetItemId, items] of Object.entries(itemsByBudgetItem)) {
      const budgetItem = budget.BudgetItem.find(b => b.id === budgetItemId);
      if (!budgetItem || !budgetItem.budgetedAmount) continue;

      // Calculate weighted distribution based on quantities
      const UNIT_WEIGHTS: Record<string, number> = {
        'EA': 100, 'SF': 1, 'SY': 9, 'LF': 5, 'CY': 150,
        'GAL': 20, 'TON': 200, 'LS': 1000, 'CF': 0.5,
      };

      let totalWeight = 0;
      const itemWeights = items.map(item => {
        const unitWeight = UNIT_WEIGHTS[item.unit?.toUpperCase() || ''] || 10;
        const weight = (item.quantity || 1) * unitWeight;
        totalWeight += weight;
        return { item, weight };
      });

      if (totalWeight > 0) {
        for (const { item, weight } of itemWeights) {
          const allocation = (weight / totalWeight) * budgetItem.budgetedAmount;
          const unitCost = item.quantity > 0 ? allocation / item.quantity : allocation;

          updates.push({
            id: item.id,
            unitCost: Math.round(unitCost * 100) / 100,
            totalCost: Math.round(allocation * 100) / 100,
            budgetItemName: budgetItem.name,
          });
        }
      }
    }

    // Apply updates
    let updatedCount = 0;
    for (const update of updates) {
      await prisma.takeoffLineItem.update({
        where: { id: update.id },
        data: {
          unitCost: update.unitCost,
          totalCost: update.totalCost,
          notes: `Synced from: ${update.budgetItemName}`,
        },
      });
      updatedCount++;
    }

    // Update takeoff totals
    for (const takeoff of takeoffs) {
      const lineItems = await prisma.takeoffLineItem.findMany({
        where: { takeoffId: takeoff.id },
      });
      const totalCost = lineItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);
      await prisma.materialTakeoff.update({
        where: { id: takeoff.id },
        data: { totalCost },
      });
    }

    const totalAllocated = updates.reduce((sum, u) => sum + u.totalCost, 0);
    const unmappedItems = allItems.filter(item => !updates.find(u => u.id === item.id));

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} items with budget-based pricing`,
      summary: {
        totalItems: allItems.length,
        pricedItems: updatedCount,
        unmappedItems: unmappedItems.length,
        budgetTotal: budget.totalBudget,
        totalAllocated,
        coveragePercent: budget.totalBudget > 0 ? Math.round((totalAllocated / budget.totalBudget) * 100) : 0,
      },
      budgetItemsUsed: Object.keys(itemsByBudgetItem).length,
      unmappedCategories: [...new Set(unmappedItems.map(i => i.bimCategory || i.category))].slice(0, 10),
    });
  } catch (error) {
    console.error('[Takeoff Budget Sync Error]', error);
    return NextResponse.json(
      { error: 'Failed to sync budget to takeoff' },
      { status: 500 }
    );
  }
}

// Build category mapping from budget items
function buildCategoryBudgetMapping(_budgetItems: any[]): Record<string, string[]> {
  const mapping: Record<string, string[]> = {
    // CSI Division mappings
    'electrical': ['Electrical', 'electrical', 'lighting', 'power'],
    'plumbing': ['Plumbing', 'HVAC / Plumbing', 'hvac/plumbing', 'hvac', 'mechanical'],
    'hvac': ['HVAC', 'HVAC / Plumbing', 'mechanical'],
    'concrete': ['Concrete', 'slab', 'footing', 'foundation'],
    'doors': ['Doors', 'Doors, Frames, & Hardware', 'hardware', 'frames'],
    'windows': ['Windows', 'Doors, Frames, & Hardware', 'glazing'],
    'doors & windows': ['Doors, Frames, & Hardware', 'doors', 'windows'],
    'flooring': ['Interior Finishes', 'finishes', 'floor', 'tile', 'carpet', 'lvt'],
    'ceiling': ['Interior Finishes', 'finishes', 'act', 'acoustic'],
    'walls': ['Interior Finishes', 'finishes', 'drywall', 'partition'],
    'base': ['Interior Finishes', 'finishes', 'base', 'trim'],
    'sitework': ['Sitework', 'Sitework / Asphalt Pavement', 'site', 'paving', 'grading'],
    'site': ['Sitework', 'Sitework / Asphalt Pavement'],
    'roofing': ['Roofing', 'roof', 'metal'],
    'specialties': ['Division 10 Items', 'division 10', 'specialties', 'toilet accessories'],
    'casework': ['Casework', 'casework', 'cabinets', 'millwork'],
    'metals': ['Structural', 'metals', 'steel'],
    'woods & plastics': ['Casework', 'woods', 'plastics', 'millwork'],
    '01 - general requirements': ['General Requirements', 'general', 'mobilization'],
    'general': ['General Requirements', 'general'],
  };
  return mapping;
}

// Find best budget item match for a takeoff item
function findBestBudgetMatch(
  category: string,
  itemName: string,
  budgetItems: any[],
  categoryMappings: Record<string, string[]>
): any | null {
  const searchTerms = categoryMappings[category] || [category];
  const combinedSearch = [...searchTerms, category, itemName.toLowerCase()];

  // Score each budget item
  let bestMatch: any = null;
  let bestScore = 0;

  for (const budgetItem of budgetItems) {
    const budgetName = budgetItem.name.toLowerCase();
    const budgetPhase = (budgetItem.phaseName || '').toLowerCase();
    let score = 0;

    for (const term of combinedSearch) {
      if (budgetName.includes(term.toLowerCase())) score += 10;
      if (budgetPhase.includes(term.toLowerCase())) score += 5;
      if (term.toLowerCase().includes(budgetName.split(' ')[0])) score += 3;
    }

    // Exact category match bonus
    if (budgetName === category || budgetPhase === category) score += 20;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = budgetItem;
    }
  }

  return bestScore >= 5 ? bestMatch : null;
}
