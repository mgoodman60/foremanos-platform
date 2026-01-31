// Walker Company Budget Phase Configuration
// Based on CSI MasterFormat Divisions

export interface BudgetPhase {
  code: number;
  name: string;
  description: string;
  tradeType?: string;
  defaultItems?: string[];
}

export const BUDGET_PHASES: BudgetPhase[] = [
  {
    code: 100,
    name: 'GENERAL REQUIREMENTS',
    description: 'General conditions, temporary facilities, supervision',
    tradeType: 'general_contractor',
    defaultItems: [
      'Mobilization / Demobilization',
      'Site Superintendent',
      'Lodging',
      'Project Manager',
      'Temporary Fence',
      'Dumpsters',
      'Temporary Toilet',
      'Temporary Stone',
      'Connex / Office Trailer',
      'Temporary Heating / Cooling',
      'Construction Tools, Supplies',
      'Weekly Cleaning',
      'Final Cleaning',
      'Dewatering',
      'Bid Bond',
      'Builders Risk',
      'Construction Signs',
      'Warranty / Punchlist',
      'Permits / Fees',
      'Surveying / Staking',
      'Special Inspections',
      'Geotech',
      'EComm Fee',
      'Plans',
      'Skid Steer',
      'Contingency'
    ]
  },
  {
    code: 200,
    name: 'SITEWORK',
    description: 'Site preparation, earthwork, paving',
    tradeType: 'site_utilities',
    defaultItems: [
      'Sitework / Asphalt Pavement',
      'Curb and Gutter',
      'Landscaping'
    ]
  },
  {
    code: 300,
    name: 'CONCRETE',
    description: 'Concrete formwork, reinforcement, finishing',
    tradeType: 'concrete_masonry',
    defaultItems: [
      'Concrete Foundation',
      'Concrete Flatwork',
      'Concrete Structural'
    ]
  },
  {
    code: 400,
    name: 'MASONRY',
    description: 'Brick, block, stone work',
    tradeType: 'concrete_masonry',
    defaultItems: [
      'Masonry'
    ]
  },
  {
    code: 500,
    name: 'METALS',
    description: 'Structural steel, metal fabrications',
    tradeType: 'structural_steel',
    defaultItems: [
      'Structural Steel',
      'Handrailing',
      'Metal Fabrications',
      'Miscellaneous Metals'
    ]
  },
  {
    code: 600,
    name: 'WOODS & PLASTICS',
    description: 'Rough and finish carpentry, casework',
    tradeType: 'carpentry_framing',
    defaultItems: [
      'Wood Framing',
      'Wood Blocking',
      'Casework',
      'Finish Carpentry'
    ]
  },
  {
    code: 700,
    name: 'THERMAL & MOISTURE PROTECTION',
    description: 'Insulation, roofing, waterproofing',
    tradeType: 'roofing',
    defaultItems: [
      'Insulation',
      'Roofing',
      'Waterproofing',
      'Caulking & Sealants'
    ]
  },
  {
    code: 800,
    name: 'DOORS & WINDOWS',
    description: 'Doors, frames, hardware, glazing',
    tradeType: 'glazing_windows',
    defaultItems: [
      'Doors, Frames, & Hardware',
      'Storefronts, Windows, & Glazing',
      'Overhead Doors'
    ]
  },
  {
    code: 900,
    name: 'INTERIOR FINISHES',
    description: 'Drywall, flooring, painting, ceiling',
    tradeType: 'drywall_finishes',
    defaultItems: [
      'Drywall',
      'Painting',
      'Flooring',
      'Ceiling Tile',
      'Wall Covering'
    ]
  },
  {
    code: 1000,
    name: 'SPECIALTIES',
    description: 'Division 10 specialties, toilet accessories',
    defaultItems: [
      'Division 10 Items',
      'Toilet Accessories',
      'Signage',
      'Fire Extinguishers'
    ]
  },
  {
    code: 1100,
    name: 'EQUIPMENT',
    description: 'Built-in equipment',
    defaultItems: [
      'Kitchen Equipment',
      'Medical Equipment',
      'Loading Dock Equipment'
    ]
  },
  {
    code: 1200,
    name: 'FURNISHINGS',
    description: 'Furniture, window treatments',
    defaultItems: [
      'Furniture',
      'Window Treatments',
      'Artwork'
    ]
  },
  {
    code: 1300,
    name: 'SPECIAL CONSTRUCTION',
    description: 'Pre-engineered buildings, specialty systems',
    defaultItems: [
      'PEMB Building - Material',
      'PEMB Building - Erector',
      'Clean Rooms',
      'Pre-Engineered Systems'
    ]
  },
  {
    code: 1400,
    name: 'CONVEYING SYSTEMS',
    description: 'Elevators, lifts',
    defaultItems: [
      'Elevator',
      'Lifts'
    ]
  },
  {
    code: 2100,
    name: 'FIRE SUPPRESSION',
    description: 'Fire sprinklers, fire protection',
    defaultItems: [
      'Fire Suppression',
      'Fire Alarm'
    ]
  },
  {
    code: 2200,
    name: 'PLUMBING',
    description: 'Plumbing systems, fixtures',
    tradeType: 'plumbing',
    defaultItems: [
      'Plumbing',
      'Plumbing Fixtures',
      'Water Heater'
    ]
  },
  {
    code: 2300,
    name: 'HVAC',
    description: 'Heating, ventilation, air conditioning',
    tradeType: 'hvac_mechanical',
    defaultItems: [
      'HVAC',
      'HVAC Controls',
      'Ductwork',
      'TAB (Testing & Balancing)'
    ]
  },
  {
    code: 2600,
    name: 'ELECTRICAL',
    description: 'Power distribution, lighting, low voltage',
    tradeType: 'electrical',
    defaultItems: [
      'Electrical',
      'Lighting',
      'Low Voltage / Data',
      'Fire Alarm',
      'Security'
    ]
  },
  {
    code: 3000,
    name: 'DESIGN',
    description: 'Architectural, engineering, design fees',
    defaultItems: [
      'Architectural / Structural',
      'Civil',
      'MEP Engineering',
      'Electrical Engineering',
      'Interior Design'
    ]
  },
  {
    code: 3100,
    name: 'SITE UTILITIES',
    description: 'Underground utilities, tap fees',
    tradeType: 'site_utilities',
    defaultItems: [
      'Site Utilities',
      'Tap Fees',
      'Storm Drainage',
      'Sanitary Sewer'
    ]
  }
];

// Get phase by code
export function getPhaseByCode(code: number): BudgetPhase | undefined {
  return BUDGET_PHASES.find(p => p.code === code);
}

// Get phase name by code
export function getPhaseName(code: number): string {
  const phase = getPhaseByCode(code);
  return phase ? `Phase ${code} - ${phase.name}` : `Phase ${code}`;
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Calculate overrun (negative means under budget)
export function calculateOverrun(actual: number, budget: number): number {
  return actual - budget;
}

// Calculate percentage
export function calculatePercentage(actual: number, budget: number): number {
  if (budget === 0) return 0;
  return Math.round((actual / budget) * 100);
}

// Input interface for budget items to be grouped by phase
export interface BudgetItemInput {
  id: string;
  name: string;
  categoryNumber?: number;
  phaseCode?: number;
  phaseName?: string;
  contractAmount?: number;
  billedToDate?: number;
  actualCost?: number;
  budgetedAmount?: number;
  actualHours?: number;
  budgetedHours?: number;
}

// Group budget items by phase
export interface PhaseGroup {
  phaseCode: number;
  phaseName: string;
  items: Array<{
    id: string;
    categoryNumber: number;
    name: string;
    contractAmount: number;
    billedToDate: number;
    actualCost: number;
    budgetedAmount: number;
    percentage: number;
    overrun: number;
    actualHours: number;
    budgetedHours: number;
    hoursPercentage: number;
    hoursOverrun: number;
  }>;
  totals: {
    contractAmount: number;
    billedToDate: number;
    actualCost: number;
    budgetedAmount: number;
    percentage: number;
    overrun: number;
    actualHours: number;
    budgetedHours: number;
    hoursPercentage: number;
    hoursOverrun: number;
  };
}

export function groupBudgetItemsByPhase(items: BudgetItemInput[]): PhaseGroup[] {
  const groups: Map<number, PhaseGroup> = new Map();
  
  // Sort items by phase code, then category number
  const sortedItems = [...items].sort((a, b) => {
    const phaseA = a.phaseCode || 9999;
    const phaseB = b.phaseCode || 9999;
    if (phaseA !== phaseB) return phaseA - phaseB;
    return (a.categoryNumber || 0) - (b.categoryNumber || 0);
  });
  
  for (const item of sortedItems) {
    const phaseCode = item.phaseCode || 0;
    const phaseName = item.phaseName || 'UNCATEGORIZED';
    
    if (!groups.has(phaseCode)) {
      groups.set(phaseCode, {
        phaseCode,
        phaseName,
        items: [],
        totals: {
          contractAmount: 0,
          billedToDate: 0,
          actualCost: 0,
          budgetedAmount: 0,
          percentage: 0,
          overrun: 0,
          actualHours: 0,
          budgetedHours: 0,
          hoursPercentage: 0,
          hoursOverrun: 0
        }
      });
    }
    
    const group = groups.get(phaseCode)!;
    const contractAmount = item.contractAmount || 0;
    const billedToDate = item.billedToDate || 0;
    const actualCost = item.actualCost || 0;
    const budgetedAmount = item.budgetedAmount || 0;
    const actualHours = item.actualHours || 0;
    const budgetedHours = item.budgetedHours || 0;
    
    group.items.push({
      id: item.id,
      categoryNumber: item.categoryNumber || group.items.length + 1,
      name: item.name,
      contractAmount,
      billedToDate,
      actualCost,
      budgetedAmount,
      percentage: calculatePercentage(actualCost, budgetedAmount),
      overrun: calculateOverrun(actualCost, budgetedAmount),
      actualHours,
      budgetedHours,
      hoursPercentage: calculatePercentage(actualHours, budgetedHours),
      hoursOverrun: actualHours - budgetedHours
    });
    
    // Update totals
    group.totals.contractAmount += contractAmount;
    group.totals.billedToDate += billedToDate;
    group.totals.actualCost += actualCost;
    group.totals.budgetedAmount += budgetedAmount;
    group.totals.actualHours += actualHours;
    group.totals.budgetedHours += budgetedHours;
  }
  
  // Calculate percentages for totals
  for (const group of groups.values()) {
    group.totals.percentage = calculatePercentage(group.totals.actualCost, group.totals.budgetedAmount);
    group.totals.overrun = calculateOverrun(group.totals.actualCost, group.totals.budgetedAmount);
    group.totals.hoursPercentage = calculatePercentage(group.totals.actualHours, group.totals.budgetedHours);
    group.totals.hoursOverrun = group.totals.actualHours - group.totals.budgetedHours;
  }
  
  return Array.from(groups.values()).sort((a, b) => a.phaseCode - b.phaseCode);
}
