/**
 * Budget Parser for Walker Company Job Cost Category Reports
 * Extracts phase/division data from PDF budget documents
 */

export interface BudgetPhase {
  phaseCode: number;
  phaseName: string;
  lineItems: BudgetLineItem[];
  totalBudget: number;
  totalActual: number;
}

export interface BudgetLineItem {
  categoryNumber: number;
  description: string;
  billedToDate: number;
  actualCost: number;
  budgetedAmount: number;
  percentComplete: number;
  overUnder: number;
  budgetedHours?: number;
  actualHours?: number;
}

export interface ParsedBudget {
  jobNumber: string;
  projectName: string;
  reportDate: string;
  contractAmount: number;
  changeOrders: number;
  revisedContract: number;
  phases: BudgetPhase[];
  totalBudget: number;
  totalActual: number;
  laborBreakdown?: {
    labor: number;
    material: number;
    equipment: number;
    subcontractor: number;
    expense: number;
  };
}

// CSI Division mapping for common construction phases
export const CSI_DIVISION_MAP: Record<number, string> = {
  100: 'General Requirements',
  200: 'Sitework',
  300: 'Concrete',
  400: 'Masonry',
  500: 'Metals',
  600: 'Woods & Plastics',
  700: 'Thermal & Moisture Protection',
  800: 'Doors & Windows',
  900: 'Finishes',
  1000: 'Specialties',
  1100: 'Equipment',
  1200: 'Furnishings',
  1300: 'Special Construction',
  1400: 'Conveying Systems',
  2100: 'Fire Suppression',
  2200: 'Plumbing',
  2300: 'HVAC',
  2600: 'Electrical',
  2700: 'Communications',
  2800: 'Electronic Safety & Security',
  3000: 'Design',
};

// Map takeoff categories to budget phases
export const TAKEOFF_TO_BUDGET_MAP: Record<string, number[]> = {
  // Structural - Concrete (300)
  'Walls': [300, 400, 600],
  'Structural Columns': [300, 500],
  'Structural Framing': [300, 500],
  'Structural Foundations': [300],
  'Floors': [300, 900],
  'Foundation': [300],
  'Footings': [300],
  'Slab': [300],
  'Concrete': [300],
  'Concrete Slab': [300],
  
  // Metals (500)
  'Roofs': [1300], // PEMB for this project
  'Roof': [1300],
  'Railings': [500],
  'Stairs': [500, 600],
  'Steel': [500, 1300],
  'Metal Framing': [500],
  'Structural Steel': [500, 1300],
  
  // Wood & Plastics (600)
  'Wood Framing': [600],
  'Wood Blocking': [600],
  'Casework': [600],
  'Millwork': [600],
  'Cabinets': [600],
  
  // Thermal/Moisture (700)
  'Insulation': [700],
  'Waterproofing': [700],
  'Roofing': [700],
  
  // Doors & Windows (800)
  'Doors': [800],
  'Windows': [800],
  'Ceilings': [900],
  'Curtain Panels': [800],
  'Curtain Wall Mullions': [800],
  'Curtain Walls': [800],
  'Storefronts': [800],
  'Glazing': [800],
  'Door Hardware': [800],
  'Frames': [800],
  
  // Interior Finishes (900)
  'Finishes': [900],
  'Flooring': [900],
  'Paint': [900],
  'Drywall': [900],
  'Gypsum': [900],
  'Tile': [900],
  'Carpet': [900],
  'VCT': [900],
  'LVT': [900],
  'Ceiling Tiles': [900],
  'ACT': [900],
  'Wall Covering': [900],
  
  // Specialties (1000)
  'Specialties': [1000],
  'Toilet Accessories': [1000],
  'Signage': [1000],
  'Lockers': [1000],
  'Fire Extinguishers': [1000],
  
  // Equipment (1100)
  'Equipment': [1100],
  'Kitchen Equipment': [1100],
  
  // Furnishings (1200)
  'Furniture': [1200],
  'Furnishings': [1200],
  
  // Special Construction (1300) - PEMB
  'PEMB': [1300],
  'Pre-Engineered Metal Building': [1300],
  'Metal Building': [1300],
  
  // Fire Suppression (2100)
  'Sprinklers': [2100],
  'Fire Sprinklers': [2100],
  'Fire Suppression': [2100],
  
  // Plumbing (2200/2300 - combined in budget)
  'Plumbing Fixtures': [2300],
  'Plumbing Pipes': [2300],
  'Plumbing': [2300],
  'Piping': [2300],
  'Sanitary': [2300],
  'Domestic Water': [2300],
  
  // HVAC (2300)
  'Mechanical Equipment': [2300],
  'HVAC': [2300],
  'Ducts': [2300],
  'Ductwork': [2300],
  'Air Terminals': [2300],
  'Diffusers': [2300],
  'VAV': [2300],
  'RTU': [2300],
  'AHU': [2300],
  'Split Systems': [2300],
  
  // Electrical (2600)
  'Electrical Equipment': [2600],
  'Electrical Fixtures': [2600],
  'Lighting Fixtures': [2600],
  'Lighting': [2600],
  'Electrical': [2600],
  'Panels': [2600],
  'Switchgear': [2600],
  'Receptacles': [2600],
  'Conduit': [2600],
  'Wire': [2600],
  
  // Fire Alarm/Security (2100/2800)
  'Fire Alarms': [2600], // Often in electrical budget
  'Fire Alarm': [2600],
  'Security': [2600],
  'Access Control': [2600],
  
  // Communications (2700 - often in electrical)
  'Data Devices': [2600],
  'Communication Devices': [2600],
  'Data': [2600],
  'Low Voltage': [2600],
  
  // Site (200)
  'Site': [200],
  'Sitework': [200],
  'Topography': [200],
  'Parking': [200],
  'Planting': [200],
  'Landscaping': [200],
  'Asphalt': [200],
  'Paving': [200],
  'Curb': [200],
  'Sidewalk': [200],
  'Grading': [200],
  'Earthwork': [200],
  'Utilities': [200, 2300],
  
  // General Requirements (100)
  'General': [100],
  'General Conditions': [100],
  'Temporary': [100],
};

/**
 * Parse budget text extracted from Walker Company format PDF
 */
export function parseWalkerBudgetText(text: string): ParsedBudget {
  // Extract header info
  const jobMatch = text.match(/Job:\s*(\d+)/i);
  const projectMatch = text.match(/One Senior Care[^\n]*/i);
  const contractMatch = text.match(/Contract:\s*([\d,]+\.?\d*)/i);
  const changeMatch = text.match(/Change Orders:\s*([\d,]+\.?\d*)/i);
  const revisedMatch = text.match(/Revised:\s*([\d,]+\.?\d*)/i);
  
  const budget: ParsedBudget = {
    jobNumber: jobMatch?.[1] || '',
    projectName: projectMatch?.[0] || 'One Senior Care - Morehead',
    reportDate: new Date().toISOString(),
    contractAmount: parseFloat(contractMatch?.[1]?.replace(/,/g, '') || '0'),
    changeOrders: parseFloat(changeMatch?.[1]?.replace(/,/g, '') || '0'),
    revisedContract: parseFloat(revisedMatch?.[1]?.replace(/,/g, '') || '0'),
    phases: [],
    totalBudget: 0,
    totalActual: 0,
  };
  
  // Parse phases
  const phaseRegex = /Phase:\s*(\d+)\s*-\s*([^\n]+)/gi;
  let match;
  
  while ((match = phaseRegex.exec(text)) !== null) {
    const phaseCode = parseInt(match[1]);
    const phaseName = match[2].trim();
    
    budget.phases.push({
      phaseCode,
      phaseName,
      lineItems: [],
      totalBudget: 0,
      totalActual: 0,
    });
  }
  
  // Parse phase totals from the text
  const phaseTotalRegex = /Phase\s+(\d+)\s+Totals[^\d]*([\d,]+)/gi;
  while ((match = phaseTotalRegex.exec(text)) !== null) {
    const phaseCode = parseInt(match[1]);
    const totalBudget = parseFloat(match[2]?.replace(/,/g, '') || '0');
    
    const phase = budget.phases.find(p => p.phaseCode === phaseCode);
    if (phase) {
      phase.totalBudget = totalBudget;
    }
  }
  
  // Calculate totals
  budget.totalBudget = budget.phases.reduce((sum, p) => sum + p.totalBudget, 0);
  budget.totalActual = budget.phases.reduce((sum, p) => sum + p.totalActual, 0);
  
  return budget;
}

/**
 * Hard-coded budget data from the One Senior Care - Morehead project
 * This represents the parsed Walker Company budget
 */
export const ONE_SENIOR_CARE_BUDGET: ParsedBudget = {
  jobNumber: '825021',
  projectName: 'One Senior Care - Morehead',
  reportDate: '2025-12-11',
  contractAmount: 2985000,
  changeOrders: 0,
  revisedContract: 2985000,
  phases: [
    {
      phaseCode: 100,
      phaseName: 'GENERAL REQUIREMENTS',
      totalBudget: 257900,
      totalActual: 17693,
      lineItems: [
        { categoryNumber: 1, description: 'Mobilization / Demobilization', billedToDate: 0, actualCost: 0, budgetedAmount: 2500, percentComplete: 0, overUnder: -2500 },
        { categoryNumber: 2, description: 'Site Superintendent', billedToDate: 0, actualCost: 0, budgetedAmount: 77400, percentComplete: 0, overUnder: -77400 },
        { categoryNumber: 5, description: 'Temporary Fence', billedToDate: 0, actualCost: 0, budgetedAmount: 5000, percentComplete: 0, overUnder: -5000 },
        { categoryNumber: 6, description: 'Dumpsters', billedToDate: 0, actualCost: 0, budgetedAmount: 6000, percentComplete: 0, overUnder: -6000 },
        { categoryNumber: 7, description: 'Temporary Toilet', billedToDate: 0, actualCost: 0, budgetedAmount: 2400, percentComplete: 0, overUnder: -2400 },
        { categoryNumber: 8, description: 'Temporary Stone', billedToDate: 0, actualCost: 0, budgetedAmount: 1500, percentComplete: 0, overUnder: -1500 },
        { categoryNumber: 9, description: 'Connex / Office Trailer', billedToDate: 0, actualCost: 0, budgetedAmount: 4800, percentComplete: 0, overUnder: -4800 },
        { categoryNumber: 11, description: 'Construction Tools, Supplies', billedToDate: 0, actualCost: 0, budgetedAmount: 4000, percentComplete: 0, overUnder: -4000 },
        { categoryNumber: 12, description: 'Weekly Cleaning', billedToDate: 0, actualCost: 0, budgetedAmount: 4800, percentComplete: 0, overUnder: -4800 },
        { categoryNumber: 13, description: 'Final Cleaning', billedToDate: 0, actualCost: 0, budgetedAmount: 4000, percentComplete: 0, overUnder: -4000 },
        { categoryNumber: 14, description: 'Dewatering', billedToDate: 0, actualCost: 0, budgetedAmount: 2500, percentComplete: 0, overUnder: -2500 },
        { categoryNumber: 16, description: 'Builders Risk', billedToDate: 0, actualCost: 0, budgetedAmount: 8000, percentComplete: 0, overUnder: -8000 },
        { categoryNumber: 18, description: 'Warranty / Punchlist', billedToDate: 0, actualCost: 0, budgetedAmount: 3500, percentComplete: 0, overUnder: -3500 },
        { categoryNumber: 19, description: 'Permits / Fees', billedToDate: 0, actualCost: 4125, budgetedAmount: 2500, percentComplete: 165, overUnder: 1625 },
        { categoryNumber: 20, description: 'Surveying / Staking', billedToDate: 0, actualCost: 0, budgetedAmount: 10000, percentComplete: 0, overUnder: -10000 },
        { categoryNumber: 21, description: 'Special Inspections', billedToDate: 0, actualCost: 0, budgetedAmount: 35000, percentComplete: 0, overUnder: -35000 },
        { categoryNumber: 22, description: 'Geotech', billedToDate: 0, actualCost: 11000, budgetedAmount: 25000, percentComplete: 44, overUnder: -14000 },
        { categoryNumber: 23, description: 'EComm Fee', billedToDate: 0, actualCost: 0, budgetedAmount: 3500, percentComplete: 0, overUnder: -3500 },
        { categoryNumber: 24, description: 'Plans', billedToDate: 0, actualCost: 0, budgetedAmount: 1000, percentComplete: 0, overUnder: -1000 },
        { categoryNumber: 25, description: 'Skid Steer', billedToDate: 0, actualCost: 0, budgetedAmount: 4500, percentComplete: 0, overUnder: -4500 },
        { categoryNumber: 26, description: 'Contingency', billedToDate: 0, actualCost: 2568, budgetedAmount: 50000, percentComplete: 5, overUnder: -47432 },
      ]
    },
    {
      phaseCode: 200,
      phaseName: 'SITEWORK',
      totalBudget: 220000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Sitework / Asphalt Pavement', billedToDate: 0, actualCost: 0, budgetedAmount: 185000, percentComplete: 0, overUnder: -185000 },
        { categoryNumber: 2, description: 'Curb and Gutter', billedToDate: 0, actualCost: 0, budgetedAmount: 25000, percentComplete: 0, overUnder: -25000 },
        { categoryNumber: 3, description: 'Landscaping', billedToDate: 0, actualCost: 0, budgetedAmount: 10000, percentComplete: 0, overUnder: -10000 },
      ]
    },
    {
      phaseCode: 300,
      phaseName: 'CONCRETE',
      totalBudget: 185000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Concrete Work', billedToDate: 0, actualCost: 0, budgetedAmount: 185000, percentComplete: 0, overUnder: -185000 },
      ]
    },
    {
      phaseCode: 500,
      phaseName: 'METALS',
      totalBudget: 10000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Handrailing', billedToDate: 0, actualCost: 0, budgetedAmount: 10000, percentComplete: 0, overUnder: -10000 },
      ]
    },
    {
      phaseCode: 600,
      phaseName: 'WOODS & PLASTICS',
      totalBudget: 60000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Wood Blocking', billedToDate: 0, actualCost: 0, budgetedAmount: 10000, percentComplete: 0, overUnder: -10000 },
        { categoryNumber: 2, description: 'Casework', billedToDate: 0, actualCost: 0, budgetedAmount: 50000, percentComplete: 0, overUnder: -50000 },
      ]
    },
    {
      phaseCode: 800,
      phaseName: 'DOORS & WINDOWS',
      totalBudget: 215800,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Doors, Frames, & Hardware', billedToDate: 0, actualCost: 0, budgetedAmount: 200800, percentComplete: 0, overUnder: -200800 },
        { categoryNumber: 2, description: 'Storefronts, Windows, & Glazing', billedToDate: 0, actualCost: 0, budgetedAmount: 15000, percentComplete: 0, overUnder: -15000 },
      ]
    },
    {
      phaseCode: 900,
      phaseName: 'INTERIOR FINISHES',
      totalBudget: 307000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Interior Finishes', billedToDate: 0, actualCost: 0, budgetedAmount: 307000, percentComplete: 0, overUnder: -307000 },
      ]
    },
    {
      phaseCode: 1000,
      phaseName: 'SPECIALTIES',
      totalBudget: 45000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Division 10 Items', billedToDate: 0, actualCost: 0, budgetedAmount: 45000, percentComplete: 0, overUnder: -45000 },
      ]
    },
    {
      phaseCode: 1300,
      phaseName: 'SPECIAL CONSTRUCTION',
      totalBudget: 362740,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'PEMB Building - Material', billedToDate: 0, actualCost: 0, budgetedAmount: 242740, percentComplete: 0, overUnder: -242740 },
        { categoryNumber: 2, description: 'PEMB Building - Erector', billedToDate: 0, actualCost: 0, budgetedAmount: 120000, percentComplete: 0, overUnder: -120000 },
      ]
    },
    {
      phaseCode: 2300,
      phaseName: 'HVAC / PLUMBING',
      totalBudget: 673000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'HVAC / Plumbing', billedToDate: 0, actualCost: 0, budgetedAmount: 628000, percentComplete: 0, overUnder: -628000 },
        { categoryNumber: 2, description: 'Tap Fees', billedToDate: 0, actualCost: 0, budgetedAmount: 10000, percentComplete: 0, overUnder: -10000 },
        { categoryNumber: 3, description: 'Site Utilities', billedToDate: 0, actualCost: 0, budgetedAmount: 35000, percentComplete: 0, overUnder: -35000 },
      ]
    },
    {
      phaseCode: 2600,
      phaseName: 'ELECTRICAL',
      totalBudget: 300000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Electrical', billedToDate: 0, actualCost: 0, budgetedAmount: 300000, percentComplete: 0, overUnder: -300000 },
      ]
    },
    {
      phaseCode: 3000,
      phaseName: 'DESIGN',
      totalBudget: 135000,
      totalActual: 0,
      lineItems: [
        { categoryNumber: 1, description: 'Architectural / Structural', billedToDate: 0, actualCost: 0, budgetedAmount: 75000, percentComplete: 0, overUnder: -75000 },
        { categoryNumber: 2, description: 'Civil', billedToDate: 0, actualCost: 0, budgetedAmount: 30000, percentComplete: 0, overUnder: -30000 },
        { categoryNumber: 3, description: 'Electrical', billedToDate: 0, actualCost: 0, budgetedAmount: 30000, percentComplete: 0, overUnder: -30000 },
      ]
    },
  ],
  totalBudget: 2771440,
  totalActual: 17693,
  laborBreakdown: {
    labor: 134700,
    material: 450040,
    equipment: 4500,
    subcontractor: 2095000,
    expense: 87200,
  }
};

/**
 * Get budget allocation for a takeoff category
 */
export function getBudgetForCategory(category: string): { phaseCode: number; phaseName: string; budget: number } | null {
  const phaseCodes = TAKEOFF_TO_BUDGET_MAP[category];
  if (!phaseCodes || phaseCodes.length === 0) return null;
  
  // Get the primary phase for this category
  const primaryPhaseCode = phaseCodes[0];
  const phase = ONE_SENIOR_CARE_BUDGET.phases.find(p => p.phaseCode === primaryPhaseCode);
  
  if (!phase) return null;
  
  return {
    phaseCode: phase.phaseCode,
    phaseName: phase.phaseName,
    budget: phase.totalBudget,
  };
}

/**
 * Distribute budget across takeoff items in a category
 */
export function distributeBudgetToItems(
  items: Array<{ id: string; category: string; quantity: number; unit: string }>,
  phaseBudget: number
): Map<string, number> {
  const distribution = new Map<string, number>();
  
  // Calculate total "weight" based on quantity and typical unit costs
  const UNIT_WEIGHTS: Record<string, number> = {
    'EA': 100,
    'SF': 1,
    'SY': 9,
    'LF': 5,
    'CY': 150,
    'GAL': 20,
    'TON': 200,
    'LS': 1000,
  };
  
  let totalWeight = 0;
  const itemWeights = items.map(item => {
    const unitWeight = UNIT_WEIGHTS[item.unit?.toUpperCase()] || 10;
    const weight = item.quantity * unitWeight;
    totalWeight += weight;
    return { id: item.id, weight };
  });
  
  // Distribute budget proportionally
  if (totalWeight > 0) {
    for (const { id, weight } of itemWeights) {
      const allocation = (weight / totalWeight) * phaseBudget;
      distribution.set(id, Math.round(allocation * 100) / 100);
    }
  }
  
  return distribution;
}
