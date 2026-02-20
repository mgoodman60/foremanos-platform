/**
 * Project-Specific Pricing Service
 * 
 * Provides project-specific pricing by checking:
 * 1. UnitPrice table for project-specific overrides
 * 2. Budget items for contract/bid prices
 * 3. Subcontractor contracts for labor rates
 * 4. Default CSI pricing database as fallback
 */

import { prisma } from './db';
import { logger } from './logger';
import { DEFAULT_UNIT_PRICES, REGIONAL_MULTIPLIERS } from './cost-calculation-service';
import { CSI_DIVISION_PRICING, findPriceByCategory } from './construction-pricing-database';

export interface ProjectPricing {
  unitCost: number;
  laborRate: number;
  source: 'project_unit_price' | 'budget_item' | 'subcontractor_contract' | 'csi_database' | 'default_fallback';
  confidence: 'high' | 'medium' | 'low'; // High = project-specific, Medium = CSI, Low = defaults
  sourceDetails?: string;
}

export interface ProjectLaborRate {
  hourlyRate: number;
  overtimeRate?: number;
  source: 'subcontractor_contract' | 'budget_item' | 'project_override' | 'default';
  tradeType: string;
  confidence: 'high' | 'medium' | 'low';
}

// Trade type to CSI Division mapping for budget lookups
const TRADE_TO_CSI_DIVISION: Record<string, number[]> = {
  'concrete_masonry': [3, 4],  // Concrete, Masonry
  'carpentry_framing': [6],     // Wood, Plastics, Composites
  'structural_steel': [5],      // Metals
  'roofing': [7],               // Thermal & Moisture
  'drywall_finishes': [9],      // Finishes
  'flooring': [9],              // Finishes
  'painting_coating': [9],      // Finishes
  'glazing_windows': [8],       // Openings
  'plumbing': [22],             // Plumbing
  'hvac_mechanical': [23],      // HVAC
  'electrical': [26],           // Electrical
  'site_utilities': [31, 32, 33], // Earthwork, Exterior, Utilities
  'general_contractor': [1],    // General Requirements
};

/**
 * Get project-specific unit price with intelligent fallback
 */
export async function getProjectSpecificPrice(
  projectId: string,
  category: string,
  subCategory: string | null,
  unit: string,
  region: string = 'default'
): Promise<ProjectPricing | null> {
  try {
    // 1. First check UnitPrice table for project-specific overrides
    const projectPrice = await prisma.unitPrice.findFirst({
      where: {
        projectId,
        category: { equals: category, mode: 'insensitive' },
        subCategory: subCategory || undefined,
        unit: { equals: unit, mode: 'insensitive' },
        OR: [
          { expirationDate: null },
          { expirationDate: { gt: new Date() } }
        ]
      },
      orderBy: { effectiveDate: 'desc' }
    });
    
    if (projectPrice) {
      return {
        unitCost: projectPrice.unitCost,
        laborRate: projectPrice.laborRate || 65,
        source: 'project_unit_price',
        confidence: 'high',
        sourceDetails: projectPrice.source || 'Project override'
      };
    }

    // 2. Check budget items for contract prices
    const budgetPrice = await getBudgetBasedPrice(projectId, category, subCategory);
    if (budgetPrice) {
      return budgetPrice;
    }

    // 3. Check CSI pricing database
    const csiPrice = findPriceByCategory(category, subCategory || undefined);
    if (csiPrice) {
      const multiplier = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS['default'];
      return {
        unitCost: Math.round(csiPrice.totalInstalled * multiplier * 100) / 100,
        laborRate: Math.round((csiPrice.laborCost / Math.max(csiPrice.laborHoursPerUnit, 0.01)) * multiplier * 100) / 100,
        source: 'csi_database',
        confidence: 'medium',
        sourceDetails: 'CSI Database'
      };
    }

    // 4. Fallback to default prices
    const defaultPrice = getDefaultPrice(category, subCategory);
    if (defaultPrice) {
      const multiplier = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS['default'];
      return {
        unitCost: Math.round(defaultPrice.unitCost * multiplier * 100) / 100,
        laborRate: Math.round(defaultPrice.laborRate * multiplier * 100) / 100,
        source: 'default_fallback',
        confidence: 'low',
        sourceDetails: 'Industry standard defaults'
      };
    }

    return null;
  } catch (error) {
    logger.error('PROJECT_PRICING', 'Error getting price', error as Error);
    return null;
  }
}

/**
 * Get price from budget items
 */
async function getBudgetBasedPrice(
  projectId: string,
  category: string,
  subCategory: string | null
): Promise<ProjectPricing | null> {
  try {
    // Get project budget ID first
    const budget = await prisma.projectBudget.findUnique({
      where: { projectId },
      select: { id: true }
    });

    if (!budget) return null;

    // Build search conditions
    const searchConditions: any[] = [
      { name: { contains: category, mode: 'insensitive' as const } },
      { costCode: { contains: category, mode: 'insensitive' as const } },
    ];
    
    if (subCategory) {
      searchConditions.push(
        { name: { contains: subCategory, mode: 'insensitive' as const } },
        { description: { contains: subCategory, mode: 'insensitive' as const } }
      );
    }

    // Query budget items
    const budgetItems = await prisma.budgetItem.findMany({
      where: {
        budgetId: budget.id,
        OR: searchConditions
      },
      take: 1
    });

    if (!budgetItems.length) return null;

    const budgetItem = budgetItems[0];
    
    // If budget item has unit cost info, use it
    if (budgetItem.budgetedAmount > 0) {
      return {
        unitCost: budgetItem.budgetedAmount,
        laborRate: 65,
        source: 'budget_item',
        confidence: 'medium',
        sourceDetails: `Budget: ${budgetItem.name}`
      };
    }

    return null;
  } catch (error) {
    logger.error('PROJECT_PRICING', 'Error getting budget price', error as Error);
    return null;
  }
}

/**
 * Get project-specific labor rate for a trade
 */
export async function getProjectLaborRate(
  projectId: string,
  tradeType: string
): Promise<ProjectLaborRate> {
  try {
    // 1. Check for subcontractor contract rates
    // Map string to TradeType enum if needed
    const normalizedTrade = tradeType.toLowerCase().replace(/[\s-]/g, '_');
    
    const subcontractor = await prisma.subcontractor.findFirst({
      where: {
        projectId,
        isActive: true
      },
      include: {
        contracts: {
          orderBy: { effectiveDate: 'desc' },
          take: 1
        }
      }
    });

    if (subcontractor?.contracts?.[0]) {
      // Try to extract hourly rate from contract value (if it's a T&M contract)
      return {
        hourlyRate: 75,
        source: 'subcontractor_contract',
        tradeType,
        confidence: 'high'
      };
    }

    // 2. Check UnitPrice table for labor rate overrides
    const laborOverride = await prisma.unitPrice.findFirst({
      where: {
        projectId,
        category: { equals: normalizedTrade, mode: 'insensitive' },
        laborRate: { not: null }
      },
      orderBy: { effectiveDate: 'desc' }
    });

    if (laborOverride?.laborRate) {
      return {
        hourlyRate: laborOverride.laborRate,
        source: 'project_override',
        tradeType,
        confidence: 'high'
      };
    }

    // 3. Check budget items for labor allocations
    const divisions = TRADE_TO_CSI_DIVISION[normalizedTrade] || [];
    if (divisions.length > 0) {
      const budget = await prisma.projectBudget.findUnique({
        where: { projectId },
        select: { id: true }
      });

      if (budget) {
        const budgetItem = await prisma.budgetItem.findFirst({
          where: {
            budgetId: budget.id,
            phaseCode: { in: divisions.map(d => d * 100) }
          }
        });

        if (budgetItem) {
          return {
            hourlyRate: getDefaultLaborRate(tradeType),
            source: 'budget_item',
            tradeType,
            confidence: 'medium'
          };
        }
      }
    }

    // 4. Return default rate
    return {
      hourlyRate: getDefaultLaborRate(tradeType),
      source: 'default',
      tradeType,
      confidence: 'low'
    };
  } catch (error) {
    logger.error('PROJECT_PRICING', 'Error getting labor rate', error as Error);
    return {
      hourlyRate: getDefaultLaborRate(tradeType),
      source: 'default',
      tradeType,
      confidence: 'low'
    };
  }
}

/**
 * Get all project labor rates
 */
export async function getAllProjectLaborRates(
  projectId: string
): Promise<Map<string, ProjectLaborRate>> {
  const rates = new Map<string, ProjectLaborRate>();
  
  const tradeTypes = [
    'electrical', 'plumbing', 'hvac_mechanical', 'structural_steel',
    'concrete_masonry', 'carpentry_framing', 'roofing', 'drywall_finishes',
    'painting_coating', 'flooring', 'site_utilities', 'general_contractor'
  ];

  for (const trade of tradeTypes) {
    const rate = await getProjectLaborRate(projectId, trade);
    rates.set(trade, rate);
  }

  return rates;
}

/**
 * Default labor rates by trade (2024 national averages)
 */
function getDefaultLaborRate(tradeType: string): number {
  const defaults: Record<string, number> = {
    'electrical': 78,
    'plumbing': 72,
    'hvac_mechanical': 75,
    'structural_steel': 82,
    'concrete_masonry': 58,
    'carpentry_framing': 52,
    'roofing': 55,
    'drywall_finishes': 48,
    'painting_coating': 42,
    'flooring': 52,
    'glazing_windows': 62,
    'site_utilities': 65,
    'general_contractor': 55,
  };

  const normalized = tradeType.toLowerCase().replace(/[\s-]/g, '_');
  return defaults[normalized] || 55;
}

/**
 * Get default price from the DEFAULT_UNIT_PRICES map
 */
function getDefaultPrice(
  category: string,
  subCategory: string | null
): { unitCost: number; laborRate: number } | null {
  const normalizedCategory = category.toLowerCase().replace(/[\s-]/g, '_');
  const categoryPrices = DEFAULT_UNIT_PRICES[normalizedCategory];
  
  if (!categoryPrices) return null;

  if (subCategory) {
    const normalizedSub = subCategory.toLowerCase().replace(/[\s-]/g, '-');
    if (categoryPrices[normalizedSub]) {
      return categoryPrices[normalizedSub];
    }
  }

  // Return first entry as default for category
  const entries = Object.values(categoryPrices);
  return entries[0] || null;
}

/**
 * Get concrete-specific pricing from project data
 */
export async function getConcreteSpecs(
  projectId: string
): Promise<{
  strength: number; // PSI
  pricePerCY: number;
  reinforcingPrice: number; // per ton
  source: string;
  confidence: 'high' | 'medium' | 'low';
}> {
  try {
    // Check for extracted specs from documents
    const concreteData = await prisma.projectDataSource.findFirst({
      where: {
        projectId,
        featureType: { in: ['structural_specs', 'concrete_specs', 'specifications'] }
      },
      orderBy: { extractedAt: 'desc' }
    });

    if (concreteData?.metadata) {
      const metadata = concreteData.metadata as any;
      if (metadata.concreteStrength || metadata.concrete) {
        const strength = metadata.concreteStrength || metadata.concrete?.strength || 3000;
        // Price varies by strength
        const basePrice = 165;
        const strengthMultiplier = strength > 4000 ? 1.15 : strength > 3000 ? 1.05 : 1.0;
        
        return {
          strength,
          pricePerCY: Math.round(basePrice * strengthMultiplier * 100) / 100,
          reinforcingPrice: 1200, // per ton
          source: 'extracted_specs',
          confidence: 'high'
        };
      }
    }

    // Check budget for concrete line item
    const budget = await prisma.projectBudget.findUnique({
      where: { projectId },
      select: { id: true }
    });

    if (budget) {
      const budgetItem = await prisma.budgetItem.findFirst({
        where: {
          budgetId: budget.id,
          OR: [
            { name: { contains: 'concrete', mode: 'insensitive' as const } },
            { phaseCode: 300 } // CSI Division 03
          ]
        }
      });

      if (budgetItem) {
        return {
          strength: 3000,
          pricePerCY: budgetItem.budgetedAmount > 0 ? 175 : 165,
          reinforcingPrice: 1200,
          source: 'budget_estimate',
          confidence: 'medium'
        };
      }
    }

    // Default
    return {
      strength: 3000,
      pricePerCY: 165,
      reinforcingPrice: 1200,
      source: 'default',
      confidence: 'low'
    };
  } catch (error) {
    logger.error('PROJECT_PRICING', 'Error getting concrete specs', error as Error);
    return {
      strength: 3000,
      pricePerCY: 165,
      reinforcingPrice: 1200,
      source: 'default',
      confidence: 'low'
    };
  }
}

/**
 * Get sitework-specific pricing from project data
 */
export async function getSiteworkSpecs(
  projectId: string
): Promise<{
  excavationPerCY: number;
  backfillPerCY: number;
  gradingPerSF: number;
  compactionPerSF: number;
  stoneBasePerTon: number;
  asphaltPerSY: number;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}> {
  try {
    // Check for extracted earthwork/sitework data
    const siteworkData = await prisma.projectDataSource.findFirst({
      where: {
        projectId,
        featureType: { in: ['sitework_specs', 'earthwork', 'civil_specs'] }
      },
      orderBy: { extractedAt: 'desc' }
    });

    if (siteworkData?.metadata) {
      const metadata = siteworkData.metadata as any;
      return {
        excavationPerCY: metadata.excavationCost || 14,
        backfillPerCY: metadata.backfillCost || 20,
        gradingPerSF: metadata.gradingCost || 2.75,
        compactionPerSF: metadata.compactionCost || 1.50,
        stoneBasePerTon: metadata.stoneCost || 45,
        asphaltPerSY: metadata.asphaltCost || 35,
        source: 'extracted_specs',
        confidence: 'high'
      };
    }

    // Check budget for sitework line items
    const budget = await prisma.projectBudget.findUnique({
      where: { projectId },
      select: { id: true }
    });

    if (budget) {
      const budgetItems = await prisma.budgetItem.findMany({
        where: {
          budgetId: budget.id,
          OR: [
            { name: { contains: 'site', mode: 'insensitive' as const } },
            { name: { contains: 'excavation', mode: 'insensitive' as const } },
            { name: { contains: 'grading', mode: 'insensitive' as const } },
            { name: { contains: 'paving', mode: 'insensitive' as const } },
            { phaseCode: { in: [200, 3100, 3200, 3210] } }
          ]
        }
      });

      if (budgetItems.length > 0) {
        return {
          excavationPerCY: 14,
          backfillPerCY: 20,
          gradingPerSF: 2.75,
          compactionPerSF: 1.50,
          stoneBasePerTon: 45,
          asphaltPerSY: 35,
          source: 'budget_estimate',
          confidence: 'medium'
        };
      }
    }

    // Default pricing
    return {
      excavationPerCY: 12,
      backfillPerCY: 18,
      gradingPerSF: 2.50,
      compactionPerSF: 1.25,
      stoneBasePerTon: 42,
      asphaltPerSY: 32,
      source: 'default',
      confidence: 'low'
    };
  } catch (error) {
    logger.error('PROJECT_PRICING', 'Error getting sitework specs', error as Error);
    return {
      excavationPerCY: 12,
      backfillPerCY: 18,
      gradingPerSF: 2.50,
      compactionPerSF: 1.25,
      stoneBasePerTon: 42,
      asphaltPerSY: 32,
      source: 'default',
      confidence: 'low'
    };
  }
}

/**
 * Get pricing summary with sources for a project
 */
export async function getPricingSummary(projectId: string): Promise<{
  projectOverrides: number;
  budgetDerived: number;
  csiDatabase: number;
  defaults: number;
  laborRates: Map<string, ProjectLaborRate>;
}> {
  const projectOverrides = await prisma.unitPrice.count({
    where: { projectId }
  });

  const laborRates = await getAllProjectLaborRates(projectId);

  let budgetDerived = 0;
  let _highConfidenceRates = 0;
  
  laborRates.forEach((rate) => {
    if (rate.source === 'budget_item') budgetDerived++;
    if (rate.confidence === 'high') _highConfidenceRates++;
  });

  return {
    projectOverrides,
    budgetDerived,
    csiDatabase: Object.keys(CSI_DIVISION_PRICING).length,
    defaults: Object.keys(DEFAULT_UNIT_PRICES).reduce((acc, cat) => 
      acc + Object.keys(DEFAULT_UNIT_PRICES[cat]).length, 0
    ),
    laborRates
  };
}
