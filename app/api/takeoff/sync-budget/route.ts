import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { TAKEOFF_TO_BUDGET_MAP, ONE_SENIOR_CARE_BUDGET } from '@/lib/budget-parser';

/**
 * Find matching phase for a category using fuzzy matching
 */
function findPhaseForCategory(category: string): number | null {
  // Exact match first
  if (TAKEOFF_TO_BUDGET_MAP[category]) {
    return TAKEOFF_TO_BUDGET_MAP[category][0];
  }
  
  // Normalize category for matching
  const normalized = category.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Try to find partial match
  for (const [key, phases] of Object.entries(TAKEOFF_TO_BUDGET_MAP)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check if category contains key or key contains category
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return phases[0];
    }
  }
  
  // Default mappings based on common patterns
  const lowerCategory = category.toLowerCase();
  
  if (lowerCategory.includes('wall') || lowerCategory.includes('partition')) {
    return 300; // Concrete/structural
  }
  if (lowerCategory.includes('door') || lowerCategory.includes('window') || lowerCategory.includes('frame')) {
    return 800; // Doors & Windows
  }
  if (lowerCategory.includes('floor') || lowerCategory.includes('ceiling') || lowerCategory.includes('finish') || lowerCategory.includes('paint')) {
    return 900; // Finishes
  }
  if (lowerCategory.includes('pipe') || lowerCategory.includes('plumb') || lowerCategory.includes('hvac') || lowerCategory.includes('duct') || lowerCategory.includes('mechanical')) {
    return 2300; // HVAC/Plumbing
  }
  if (lowerCategory.includes('electric') || lowerCategory.includes('light') || lowerCategory.includes('panel') || lowerCategory.includes('conduit') || lowerCategory.includes('wire')) {
    return 2600; // Electrical
  }
  if (lowerCategory.includes('site') || lowerCategory.includes('grade') || lowerCategory.includes('pave') || lowerCategory.includes('curb')) {
    return 200; // Sitework
  }
  if (lowerCategory.includes('roof') || lowerCategory.includes('metal') || lowerCategory.includes('steel')) {
    return 1300; // PEMB / Special Construction
  }
  if (lowerCategory.includes('casework') || lowerCategory.includes('cabinet') || lowerCategory.includes('millwork') || lowerCategory.includes('wood')) {
    return 600; // Woods & Plastics
  }
  if (lowerCategory.includes('sprinkler') || lowerCategory.includes('fire')) {
    return 2100; // Fire Suppression
  }
  
  return null;
}

/**
 * Sync takeoff items with budget allocations
 * Maps BIM categories to CSI divisions and applies proportional costs
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }
    
    // Get all takeoff items for this project
    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId },
      include: {
        TakeoffLineItem: true,
      },
    });
    
    if (takeoffs.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No takeoffs found for this project',
      });
    }
    
    // Flatten all line items
    const allItems = takeoffs.flatMap(t => t.TakeoffLineItem);
    
    // Group items by their budget phase
    const itemsByPhase: Record<number, typeof allItems> = {};
    const unmappedItems: typeof allItems = [];
    
    for (const item of allItems) {
      const category = item.bimCategory || item.category;
      const phaseCode = findPhaseForCategory(category);
      
      if (phaseCode) {
        if (!itemsByPhase[phaseCode]) {
          itemsByPhase[phaseCode] = [];
        }
        itemsByPhase[phaseCode].push(item);
      } else {
        unmappedItems.push(item);
      }
    }
    
    // Calculate unit costs based on budget allocations
    const updates: Array<{ id: string; unitCost: number; totalCost: number; phaseCode: number }> = [];
    
    for (const [phaseCodeStr, items] of Object.entries(itemsByPhase)) {
      const phaseCode = parseInt(phaseCodeStr);
      const phase = ONE_SENIOR_CARE_BUDGET.phases.find(p => p.phaseCode === phaseCode);
      
      if (!phase || phase.totalBudget === 0) continue;
      
      // Calculate total "weight" for distribution
      const UNIT_WEIGHTS: Record<string, number> = {
        'EA': 100,
        'SF': 1,
        'SY': 9,
        'LF': 5,
        'CY': 150,
        'GAL': 20,
        'TON': 200,
        'LS': 1000,
        'CF': 0.5,
      };
      
      let totalWeight = 0;
      const itemWeights = items.map(item => {
        const unitWeight = UNIT_WEIGHTS[item.unit?.toUpperCase()] || 10;
        const weight = (item.quantity || 1) * unitWeight;
        totalWeight += weight;
        return { item, weight };
      });
      
      // Distribute phase budget across items
      if (totalWeight > 0) {
        for (const { item, weight } of itemWeights) {
          const allocation = (weight / totalWeight) * phase.totalBudget;
          const unitCost = item.quantity > 0 ? allocation / item.quantity : allocation;
          
          updates.push({
            id: item.id,
            unitCost: Math.round(unitCost * 100) / 100,
            totalCost: Math.round(allocation * 100) / 100,
            phaseCode,
          });
        }
      }
    }
    
    // Apply updates to database
    let updatedCount = 0;
    for (const update of updates) {
      await prisma.takeoffLineItem.update({
        where: { id: update.id },
        data: {
          unitCost: update.unitCost,
          totalCost: update.totalCost,
          notes: `Budget Phase ${update.phaseCode}`,
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
    
    // Summary by phase
    const phaseSummary = Object.entries(itemsByPhase).map(([code, items]) => {
      const phase = ONE_SENIOR_CARE_BUDGET.phases.find(p => p.phaseCode === parseInt(code));
      const phaseUpdates = updates.filter(u => u.phaseCode === parseInt(code));
      const allocatedTotal = phaseUpdates.reduce((sum, u) => sum + u.totalCost, 0);
      
      return {
        phaseCode: parseInt(code),
        phaseName: phase?.phaseName || 'Unknown',
        budgetAmount: phase?.totalBudget || 0,
        allocatedAmount: allocatedTotal,
        itemCount: items.length,
      };
    });
    
    const totalAllocated = updates.reduce((sum, u) => sum + u.totalCost, 0);
    
    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} items with budget-based pricing`,
      summary: {
        totalItems: allItems.length,
        pricedItems: updatedCount,
        unmappedItems: unmappedItems.length,
        totalBudget: ONE_SENIOR_CARE_BUDGET.totalBudget,
        totalAllocated,
        coveragePercent: Math.round((totalAllocated / ONE_SENIOR_CARE_BUDGET.totalBudget) * 100),
      },
      phases: phaseSummary,
      unmappedCategories: [...new Set(unmappedItems.map(i => i.bimCategory || i.category))],
    });
  } catch (error) {
    console.error('[Takeoff Budget Sync Error]', error);
    return NextResponse.json(
      { error: 'Failed to sync budget to takeoff' },
      { status: 500 }
    );
  }
}
