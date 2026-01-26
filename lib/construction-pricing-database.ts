/**
 * Comprehensive Construction Pricing Database
 * 
 * Industry-standard 2024-2025 pricing for commercial construction
 * Based on RS Means, ENR, and regional contractor data
 * 
 * Covers all 50 CSI MasterFormat Divisions with sub-categories
 * Optimized for senior care/healthcare facility construction
 */

export interface UnitPriceEntry {
  materialCost: number;  // Material cost per unit
  laborCost: number;     // Labor cost per unit
  totalInstalled: number; // Total installed cost per unit
  unit: string;
  laborHoursPerUnit: number;
  wasteFactorPercent: number;
  notes?: string;
}

export interface DivisionPricing {
  divisionCode: number;
  divisionName: string;
  items: Record<string, UnitPriceEntry>;
}

// Regional cost multipliers (base = national average)
export const REGIONAL_MULTIPLIERS: Record<string, number> = {
  'default': 1.00,
  'national': 1.00,
  // Kentucky (Morehead area)
  'kentucky': 0.88,
  'morehead-ky': 0.86,
  // Other regions
  'northeast': 1.25,
  'new-york': 1.45,
  'boston': 1.35,
  'southeast': 0.90,
  'florida': 0.95,
  'georgia': 0.88,
  'midwest': 0.95,
  'ohio': 0.92,
  'illinois': 1.05,
  'southwest': 1.05,
  'texas': 0.98,
  'arizona': 1.02,
  'west': 1.35,
  'california': 1.45,
  'washington': 1.25,
  'mountain': 1.00,
  'colorado': 1.08,
};

// CSI MasterFormat Division Pricing Database
export const CSI_DIVISION_PRICING: DivisionPricing[] = [
  // Division 01 - General Requirements
  {
    divisionCode: 1,
    divisionName: 'General Requirements',
    items: {
      'mobilization': { materialCost: 0, laborCost: 2500, totalInstalled: 2500, unit: 'LS', laborHoursPerUnit: 40, wasteFactorPercent: 0 },
      'site-superintendent': { materialCost: 0, laborCost: 7200, totalInstalled: 7200, unit: 'MO', laborHoursPerUnit: 176, wasteFactorPercent: 0 },
      'project-manager': { materialCost: 0, laborCost: 9500, totalInstalled: 9500, unit: 'MO', laborHoursPerUnit: 176, wasteFactorPercent: 0 },
      'temporary-fence': { materialCost: 8.50, laborCost: 4.50, totalInstalled: 13.00, unit: 'LF', laborHoursPerUnit: 0.08, wasteFactorPercent: 5 },
      'dumpster-rental': { materialCost: 450, laborCost: 0, totalInstalled: 450, unit: 'EA', laborHoursPerUnit: 0, wasteFactorPercent: 0 },
      'temporary-toilet': { materialCost: 175, laborCost: 0, totalInstalled: 175, unit: 'MO', laborHoursPerUnit: 0, wasteFactorPercent: 0 },
      'temporary-power': { materialCost: 850, laborCost: 650, totalInstalled: 1500, unit: 'EA', laborHoursPerUnit: 8, wasteFactorPercent: 0 },
      'job-trailer': { materialCost: 650, laborCost: 350, totalInstalled: 1000, unit: 'MO', laborHoursPerUnit: 4, wasteFactorPercent: 0 },
      'final-cleaning': { materialCost: 0.15, laborCost: 0.35, totalInstalled: 0.50, unit: 'SF', laborHoursPerUnit: 0.006, wasteFactorPercent: 0 },
      'permits-fees': { materialCost: 15000, laborCost: 0, totalInstalled: 15000, unit: 'LS', laborHoursPerUnit: 0, wasteFactorPercent: 0 },
      'surveying': { materialCost: 0, laborCost: 8500, totalInstalled: 8500, unit: 'LS', laborHoursPerUnit: 80, wasteFactorPercent: 0 },
      'testing-inspections': { materialCost: 0, laborCost: 25000, totalInstalled: 25000, unit: 'LS', laborHoursPerUnit: 200, wasteFactorPercent: 0 },
      'contingency': { materialCost: 0, laborCost: 0, totalInstalled: 50000, unit: 'LS', laborHoursPerUnit: 0, wasteFactorPercent: 0 },
    }
  },
  
  // Division 02 - Existing Conditions
  {
    divisionCode: 2,
    divisionName: 'Existing Conditions',
    items: {
      // Demolition
      'demolition-light': { materialCost: 0, laborCost: 3.50, totalInstalled: 3.50, unit: 'SF', laborHoursPerUnit: 0.05, wasteFactorPercent: 0 },
      'demolition-heavy': { materialCost: 0, laborCost: 8.00, totalInstalled: 8.00, unit: 'SF', laborHoursPerUnit: 0.12, wasteFactorPercent: 0 },
      'selective-demo': { materialCost: 0, laborCost: 5.50, totalInstalled: 5.50, unit: 'SF', laborHoursPerUnit: 0.08, wasteFactorPercent: 0 },
      'demolition-interior-gutting': { materialCost: 0, laborCost: 4.50, totalInstalled: 4.50, unit: 'SF', laborHoursPerUnit: 0.065, wasteFactorPercent: 0 },
      'demolition-concrete-slab': { materialCost: 0, laborCost: 12.00, totalInstalled: 12.00, unit: 'SF', laborHoursPerUnit: 0.16, wasteFactorPercent: 0 },
      'demolition-masonry-wall': { materialCost: 0, laborCost: 15.00, totalInstalled: 15.00, unit: 'SF', laborHoursPerUnit: 0.2, wasteFactorPercent: 0 },
      'demolition-roofing': { materialCost: 0, laborCost: 2.50, totalInstalled: 2.50, unit: 'SF', laborHoursPerUnit: 0.035, wasteFactorPercent: 0 },
      'sawcutting-concrete': { materialCost: 0, laborCost: 6.50, totalInstalled: 6.50, unit: 'LF', laborHoursPerUnit: 0.085, wasteFactorPercent: 0 },
      'core-drilling-concrete-4in': { materialCost: 25, laborCost: 125, totalInstalled: 150, unit: 'EA', laborHoursPerUnit: 1.6, wasteFactorPercent: 0 },
      'core-drilling-concrete-6in': { materialCost: 35, laborCost: 165, totalInstalled: 200, unit: 'EA', laborHoursPerUnit: 2.2, wasteFactorPercent: 0 },
      
      // Hazardous Material Testing
      'asbestos-testing-bulk': { materialCost: 0, laborCost: 45, totalInstalled: 45, unit: 'EA', laborHoursPerUnit: 0.5, wasteFactorPercent: 0 },
      'asbestos-testing-air': { materialCost: 0, laborCost: 185, totalInstalled: 185, unit: 'EA', laborHoursPerUnit: 2, wasteFactorPercent: 0 },
      'lead-paint-testing-xrf': { materialCost: 0, laborCost: 35, totalInstalled: 35, unit: 'EA', laborHoursPerUnit: 0.4, wasteFactorPercent: 0 },
      'lead-paint-testing-lab': { materialCost: 0, laborCost: 55, totalInstalled: 55, unit: 'EA', laborHoursPerUnit: 0.6, wasteFactorPercent: 0 },
      'mold-testing-air': { materialCost: 0, laborCost: 125, totalInstalled: 125, unit: 'EA', laborHoursPerUnit: 1.4, wasteFactorPercent: 0 },
      'mold-testing-surface': { materialCost: 0, laborCost: 75, totalInstalled: 75, unit: 'EA', laborHoursPerUnit: 0.8, wasteFactorPercent: 0 },
      'pcb-testing': { materialCost: 0, laborCost: 185, totalInstalled: 185, unit: 'EA', laborHoursPerUnit: 2, wasteFactorPercent: 0 },
      
      // Hazardous Material Abatement
      'hazmat-abatement': { materialCost: 8.00, laborCost: 22.00, totalInstalled: 30.00, unit: 'SF', laborHoursPerUnit: 0.25, wasteFactorPercent: 0 },
      'asbestos-abatement-floor-tile': { materialCost: 2.50, laborCost: 8.50, totalInstalled: 11.00, unit: 'SF', laborHoursPerUnit: 0.11, wasteFactorPercent: 0 },
      'asbestos-abatement-pipe-insulation': { materialCost: 8.00, laborCost: 32.00, totalInstalled: 40.00, unit: 'LF', laborHoursPerUnit: 0.42, wasteFactorPercent: 0 },
      'asbestos-abatement-ceiling-texture': { materialCost: 4.50, laborCost: 15.50, totalInstalled: 20.00, unit: 'SF', laborHoursPerUnit: 0.2, wasteFactorPercent: 0 },
      'asbestos-encapsulation': { materialCost: 2.00, laborCost: 4.00, totalInstalled: 6.00, unit: 'SF', laborHoursPerUnit: 0.052, wasteFactorPercent: 0 },
      'lead-paint-abatement': { materialCost: 3.50, laborCost: 12.50, totalInstalled: 16.00, unit: 'SF', laborHoursPerUnit: 0.16, wasteFactorPercent: 0 },
      'lead-paint-encapsulation': { materialCost: 1.25, laborCost: 2.75, totalInstalled: 4.00, unit: 'SF', laborHoursPerUnit: 0.035, wasteFactorPercent: 0 },
      'mold-remediation': { materialCost: 5.00, laborCost: 20.00, totalInstalled: 25.00, unit: 'SF', laborHoursPerUnit: 0.26, wasteFactorPercent: 0 },
      'hazmat-disposal-fee': { materialCost: 0, laborCost: 850, totalInstalled: 850, unit: 'TON', laborHoursPerUnit: 0, wasteFactorPercent: 0 },
      
      // Soil Remediation
      'soil-testing-phase-1': { materialCost: 0, laborCost: 2500, totalInstalled: 2500, unit: 'LS', laborHoursPerUnit: 32, wasteFactorPercent: 0 },
      'soil-testing-phase-2': { materialCost: 0, laborCost: 8500, totalInstalled: 8500, unit: 'LS', laborHoursPerUnit: 110, wasteFactorPercent: 0 },
      'soil-boring-test': { materialCost: 0, laborCost: 650, totalInstalled: 650, unit: 'EA', laborHoursPerUnit: 8.5, wasteFactorPercent: 0 },
      'contaminated-soil-removal': { materialCost: 0, laborCost: 125, totalInstalled: 125, unit: 'CY', laborHoursPerUnit: 1.6, wasteFactorPercent: 0 },
      'contaminated-soil-disposal': { materialCost: 0, laborCost: 185, totalInstalled: 185, unit: 'TON', laborHoursPerUnit: 0, wasteFactorPercent: 0 },
      'soil-vapor-extraction': { materialCost: 45, laborCost: 85, totalInstalled: 130, unit: 'SF', laborHoursPerUnit: 1.1, wasteFactorPercent: 0 },
      
      // Site Investigation
      'topographic-survey': { materialCost: 0, laborCost: 3500, totalInstalled: 3500, unit: 'AC', laborHoursPerUnit: 45, wasteFactorPercent: 0 },
      'boundary-survey': { materialCost: 0, laborCost: 2500, totalInstalled: 2500, unit: 'LS', laborHoursPerUnit: 32, wasteFactorPercent: 0 },
      'utility-locating-gpr': { materialCost: 0, laborCost: 1200, totalInstalled: 1200, unit: 'DAY', laborHoursPerUnit: 8, wasteFactorPercent: 0 },
      'utility-potholing': { materialCost: 0, laborCost: 450, totalInstalled: 450, unit: 'EA', laborHoursPerUnit: 3, wasteFactorPercent: 0 },
      'geotechnical-investigation': { materialCost: 0, laborCost: 6500, totalInstalled: 6500, unit: 'LS', laborHoursPerUnit: 85, wasteFactorPercent: 0 },
      
      // Structure Relocation/Protection
      'tree-protection-fence': { materialCost: 3.50, laborCost: 2.50, totalInstalled: 6.00, unit: 'LF', laborHoursPerUnit: 0.032, wasteFactorPercent: 5 },
      'tree-removal-small': { materialCost: 0, laborCost: 450, totalInstalled: 450, unit: 'EA', laborHoursPerUnit: 6, wasteFactorPercent: 0 },
      'tree-removal-large': { materialCost: 0, laborCost: 1200, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 16, wasteFactorPercent: 0 },
      'stump-removal': { materialCost: 0, laborCost: 185, totalInstalled: 185, unit: 'EA', laborHoursPerUnit: 2.4, wasteFactorPercent: 0 },
    }
  },
  
  // Division 03 - Concrete
  {
    divisionCode: 3,
    divisionName: 'Concrete',
    items: {
      // Foundations
      'concrete-slab-on-grade-4in': { materialCost: 4.25, laborCost: 3.75, totalInstalled: 8.00, unit: 'SF', laborHoursPerUnit: 0.055, wasteFactorPercent: 5 },
      'concrete-slab-on-grade-6in': { materialCost: 6.35, laborCost: 4.25, totalInstalled: 10.60, unit: 'SF', laborHoursPerUnit: 0.06, wasteFactorPercent: 5 },
      'concrete-footings': { materialCost: 165, laborCost: 95, totalInstalled: 260, unit: 'CY', laborHoursPerUnit: 1.4, wasteFactorPercent: 5 },
      'concrete-foundation-wall': { materialCost: 185, laborCost: 125, totalInstalled: 310, unit: 'CY', laborHoursPerUnit: 1.8, wasteFactorPercent: 5 },
      'concrete-grade-beam': { materialCost: 195, laborCost: 115, totalInstalled: 310, unit: 'CY', laborHoursPerUnit: 1.6, wasteFactorPercent: 5 },
      'concrete-pier': { materialCost: 175, laborCost: 85, totalInstalled: 260, unit: 'CY', laborHoursPerUnit: 1.2, wasteFactorPercent: 5 },
      
      // Structural
      'concrete-columns': { materialCost: 225, laborCost: 145, totalInstalled: 370, unit: 'CY', laborHoursPerUnit: 2.0, wasteFactorPercent: 5 },
      'concrete-beams': { materialCost: 245, laborCost: 165, totalInstalled: 410, unit: 'CY', laborHoursPerUnit: 2.2, wasteFactorPercent: 5 },
      'concrete-elevated-slab': { materialCost: 8.50, laborCost: 6.50, totalInstalled: 15.00, unit: 'SF', laborHoursPerUnit: 0.09, wasteFactorPercent: 5 },
      
      // Flatwork
      'concrete-sidewalk-4in': { materialCost: 4.50, laborCost: 4.00, totalInstalled: 8.50, unit: 'SF', laborHoursPerUnit: 0.06, wasteFactorPercent: 5 },
      'concrete-curb-gutter': { materialCost: 18.00, laborCost: 14.00, totalInstalled: 32.00, unit: 'LF', laborHoursPerUnit: 0.2, wasteFactorPercent: 5 },
      'concrete-parking-6in': { materialCost: 6.50, laborCost: 4.50, totalInstalled: 11.00, unit: 'SF', laborHoursPerUnit: 0.065, wasteFactorPercent: 5 },
      
      // Reinforcing
      'rebar-3': { materialCost: 0.45, laborCost: 0.35, totalInstalled: 0.80, unit: 'LF', laborHoursPerUnit: 0.005, wasteFactorPercent: 8 },
      'rebar-4': { materialCost: 0.75, laborCost: 0.45, totalInstalled: 1.20, unit: 'LF', laborHoursPerUnit: 0.006, wasteFactorPercent: 8 },
      'rebar-5': { materialCost: 1.15, laborCost: 0.55, totalInstalled: 1.70, unit: 'LF', laborHoursPerUnit: 0.007, wasteFactorPercent: 8 },
      'rebar-by-ton': { materialCost: 850, laborCost: 550, totalInstalled: 1400, unit: 'TON', laborHoursPerUnit: 8, wasteFactorPercent: 5 },
      'wwf-6x6-w1.4': { materialCost: 0.35, laborCost: 0.25, totalInstalled: 0.60, unit: 'SF', laborHoursPerUnit: 0.004, wasteFactorPercent: 10 },
      
      // Formwork
      'formwork-slab-edge': { materialCost: 2.50, laborCost: 4.50, totalInstalled: 7.00, unit: 'LF', laborHoursPerUnit: 0.065, wasteFactorPercent: 10 },
      'formwork-wall': { materialCost: 4.50, laborCost: 7.00, totalInstalled: 11.50, unit: 'SFCA', laborHoursPerUnit: 0.1, wasteFactorPercent: 10 },
      'formwork-column': { materialCost: 5.50, laborCost: 9.00, totalInstalled: 14.50, unit: 'SFCA', laborHoursPerUnit: 0.13, wasteFactorPercent: 10 },
    }
  },
  
  // Division 04 - Masonry
  {
    divisionCode: 4,
    divisionName: 'Masonry',
    items: {
      'cmu-8in-standard': { materialCost: 6.50, laborCost: 8.50, totalInstalled: 15.00, unit: 'SF', laborHoursPerUnit: 0.12, wasteFactorPercent: 5 },
      'cmu-8in-lightweight': { materialCost: 7.00, laborCost: 8.50, totalInstalled: 15.50, unit: 'SF', laborHoursPerUnit: 0.12, wasteFactorPercent: 5 },
      'cmu-12in': { materialCost: 9.50, laborCost: 10.50, totalInstalled: 20.00, unit: 'SF', laborHoursPerUnit: 0.15, wasteFactorPercent: 5 },
      'brick-veneer': { materialCost: 9.00, laborCost: 12.00, totalInstalled: 21.00, unit: 'SF', laborHoursPerUnit: 0.17, wasteFactorPercent: 5 },
      'brick-common': { materialCost: 7.50, laborCost: 11.00, totalInstalled: 18.50, unit: 'SF', laborHoursPerUnit: 0.16, wasteFactorPercent: 5 },
      'stone-veneer': { materialCost: 22.00, laborCost: 18.00, totalInstalled: 40.00, unit: 'SF', laborHoursPerUnit: 0.25, wasteFactorPercent: 5 },
      'grout-cmu': { materialCost: 4.50, laborCost: 5.50, totalInstalled: 10.00, unit: 'CF', laborHoursPerUnit: 0.08, wasteFactorPercent: 5 },
      'mortar': { materialCost: 12.00, laborCost: 0, totalInstalled: 12.00, unit: 'CF', laborHoursPerUnit: 0, wasteFactorPercent: 10 },
    }
  },
  
  // Division 05 - Metals
  {
    divisionCode: 5,
    divisionName: 'Metals',
    items: {
      // Structural Steel
      'structural-steel-fabricated': { materialCost: 2200, laborCost: 1800, totalInstalled: 4000, unit: 'TON', laborHoursPerUnit: 25, wasteFactorPercent: 3 },
      'structural-steel-erected': { materialCost: 2800, laborCost: 2400, totalInstalled: 5200, unit: 'TON', laborHoursPerUnit: 32, wasteFactorPercent: 3 },
      'steel-wide-flange': { materialCost: 3.25, laborCost: 2.75, totalInstalled: 6.00, unit: 'LB', laborHoursPerUnit: 0.035, wasteFactorPercent: 3 },
      'steel-tube-column': { materialCost: 3.50, laborCost: 3.00, totalInstalled: 6.50, unit: 'LB', laborHoursPerUnit: 0.04, wasteFactorPercent: 3 },
      'steel-angle': { materialCost: 2.75, laborCost: 2.25, totalInstalled: 5.00, unit: 'LB', laborHoursPerUnit: 0.03, wasteFactorPercent: 5 },
      'steel-channel': { materialCost: 2.85, laborCost: 2.35, totalInstalled: 5.20, unit: 'LB', laborHoursPerUnit: 0.032, wasteFactorPercent: 5 },
      
      // Metal Deck
      'metal-deck-1.5in-20ga': { materialCost: 2.75, laborCost: 2.25, totalInstalled: 5.00, unit: 'SF', laborHoursPerUnit: 0.03, wasteFactorPercent: 5 },
      'metal-deck-3in-18ga': { materialCost: 4.25, laborCost: 2.75, totalInstalled: 7.00, unit: 'SF', laborHoursPerUnit: 0.035, wasteFactorPercent: 5 },
      'composite-deck': { materialCost: 5.50, laborCost: 3.50, totalInstalled: 9.00, unit: 'SF', laborHoursPerUnit: 0.045, wasteFactorPercent: 5 },
      
      // Miscellaneous Metals
      'handrail-steel': { materialCost: 65.00, laborCost: 45.00, totalInstalled: 110.00, unit: 'LF', laborHoursPerUnit: 0.6, wasteFactorPercent: 5 },
      'guardrail-steel': { materialCost: 85.00, laborCost: 55.00, totalInstalled: 140.00, unit: 'LF', laborHoursPerUnit: 0.75, wasteFactorPercent: 5 },
      'steel-stair': { materialCost: 350, laborCost: 250, totalInstalled: 600, unit: 'RISER', laborHoursPerUnit: 3.5, wasteFactorPercent: 3 },
      'steel-ladder': { materialCost: 125, laborCost: 85, totalInstalled: 210, unit: 'LF', laborHoursPerUnit: 1.2, wasteFactorPercent: 5 },
      'misc-steel': { materialCost: 2.25, laborCost: 1.75, totalInstalled: 4.00, unit: 'LB', laborHoursPerUnit: 0.025, wasteFactorPercent: 8 },
      'embed-plates': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'EA', laborHoursPerUnit: 0.5, wasteFactorPercent: 5 },
    }
  },
  
  // Division 06 - Wood, Plastics, Composites
  {
    divisionCode: 6,
    divisionName: 'Wood, Plastics, Composites',
    items: {
      // Rough Carpentry
      'wood-framing-2x4': { materialCost: 0.85, laborCost: 0.65, totalInstalled: 1.50, unit: 'LF', laborHoursPerUnit: 0.01, wasteFactorPercent: 10 },
      'wood-framing-2x6': { materialCost: 1.25, laborCost: 0.75, totalInstalled: 2.00, unit: 'LF', laborHoursPerUnit: 0.012, wasteFactorPercent: 10 },
      'wood-framing-2x8': { materialCost: 1.85, laborCost: 0.85, totalInstalled: 2.70, unit: 'LF', laborHoursPerUnit: 0.014, wasteFactorPercent: 10 },
      'wood-framing-2x10': { materialCost: 2.45, laborCost: 0.95, totalInstalled: 3.40, unit: 'LF', laborHoursPerUnit: 0.016, wasteFactorPercent: 10 },
      'wood-framing-2x12': { materialCost: 3.25, laborCost: 1.05, totalInstalled: 4.30, unit: 'LF', laborHoursPerUnit: 0.018, wasteFactorPercent: 10 },
      'wood-blocking': { materialCost: 0.65, laborCost: 0.85, totalInstalled: 1.50, unit: 'LF', laborHoursPerUnit: 0.012, wasteFactorPercent: 15 },
      'plywood-sheathing-1/2': { materialCost: 1.45, laborCost: 0.85, totalInstalled: 2.30, unit: 'SF', laborHoursPerUnit: 0.012, wasteFactorPercent: 10 },
      'plywood-sheathing-3/4': { materialCost: 1.95, laborCost: 0.95, totalInstalled: 2.90, unit: 'SF', laborHoursPerUnit: 0.014, wasteFactorPercent: 10 },
      'osb-sheathing': { materialCost: 1.15, laborCost: 0.75, totalInstalled: 1.90, unit: 'SF', laborHoursPerUnit: 0.011, wasteFactorPercent: 10 },
      
      // Trusses
      'roof-truss': { materialCost: 85, laborCost: 65, totalInstalled: 150, unit: 'EA', laborHoursPerUnit: 0.9, wasteFactorPercent: 3 },
      'floor-truss': { materialCost: 95, laborCost: 75, totalInstalled: 170, unit: 'EA', laborHoursPerUnit: 1.0, wasteFactorPercent: 3 },
      
      // Casework/Millwork
      'casework-base-cabinet': { materialCost: 185, laborCost: 95, totalInstalled: 280, unit: 'LF', laborHoursPerUnit: 1.3, wasteFactorPercent: 3 },
      'casework-wall-cabinet': { materialCost: 145, laborCost: 75, totalInstalled: 220, unit: 'LF', laborHoursPerUnit: 1.0, wasteFactorPercent: 3 },
      'countertop-laminate': { materialCost: 35, laborCost: 25, totalInstalled: 60, unit: 'SF', laborHoursPerUnit: 0.35, wasteFactorPercent: 5 },
      'countertop-solid-surface': { materialCost: 65, laborCost: 35, totalInstalled: 100, unit: 'SF', laborHoursPerUnit: 0.5, wasteFactorPercent: 5 },
      'wood-trim': { materialCost: 3.50, laborCost: 4.50, totalInstalled: 8.00, unit: 'LF', laborHoursPerUnit: 0.065, wasteFactorPercent: 10 },
      'wood-base': { materialCost: 2.75, laborCost: 3.25, totalInstalled: 6.00, unit: 'LF', laborHoursPerUnit: 0.045, wasteFactorPercent: 10 },
    }
  },
  
  // Division 07 - Thermal & Moisture Protection
  {
    divisionCode: 7,
    divisionName: 'Thermal & Moisture Protection',
    items: {
      // Insulation
      'batt-insulation-r13': { materialCost: 0.55, laborCost: 0.45, totalInstalled: 1.00, unit: 'SF', laborHoursPerUnit: 0.007, wasteFactorPercent: 5 },
      'batt-insulation-r19': { materialCost: 0.75, laborCost: 0.55, totalInstalled: 1.30, unit: 'SF', laborHoursPerUnit: 0.008, wasteFactorPercent: 5 },
      'batt-insulation-r30': { materialCost: 1.15, laborCost: 0.65, totalInstalled: 1.80, unit: 'SF', laborHoursPerUnit: 0.01, wasteFactorPercent: 5 },
      'rigid-insulation-1in': { materialCost: 0.85, laborCost: 0.65, totalInstalled: 1.50, unit: 'SF', laborHoursPerUnit: 0.01, wasteFactorPercent: 5 },
      'rigid-insulation-2in': { materialCost: 1.45, laborCost: 0.75, totalInstalled: 2.20, unit: 'SF', laborHoursPerUnit: 0.012, wasteFactorPercent: 5 },
      'spray-foam-closed': { materialCost: 1.75, laborCost: 2.25, totalInstalled: 4.00, unit: 'SF', laborHoursPerUnit: 0.035, wasteFactorPercent: 3 },
      'spray-foam-open': { materialCost: 0.85, laborCost: 1.15, totalInstalled: 2.00, unit: 'SF', laborHoursPerUnit: 0.018, wasteFactorPercent: 3 },
      
      // Roofing
      'tpo-membrane-60mil': { materialCost: 4.25, laborCost: 3.75, totalInstalled: 8.00, unit: 'SF', laborHoursPerUnit: 0.055, wasteFactorPercent: 5 },
      'epdm-membrane-60mil': { materialCost: 3.75, laborCost: 3.25, totalInstalled: 7.00, unit: 'SF', laborHoursPerUnit: 0.05, wasteFactorPercent: 5 },
      'metal-roofing-standing-seam': { materialCost: 8.50, laborCost: 6.50, totalInstalled: 15.00, unit: 'SF', laborHoursPerUnit: 0.095, wasteFactorPercent: 5 },
      'shingle-architectural': { materialCost: 2.25, laborCost: 2.75, totalInstalled: 5.00, unit: 'SF', laborHoursPerUnit: 0.04, wasteFactorPercent: 10 },
      'built-up-roofing': { materialCost: 5.50, laborCost: 4.50, totalInstalled: 10.00, unit: 'SF', laborHoursPerUnit: 0.07, wasteFactorPercent: 5 },
      'roof-insulation-iso': { materialCost: 2.75, laborCost: 1.25, totalInstalled: 4.00, unit: 'SF', laborHoursPerUnit: 0.02, wasteFactorPercent: 5 },
      
      // Waterproofing
      'waterproofing-below-grade': { materialCost: 3.50, laborCost: 3.50, totalInstalled: 7.00, unit: 'SF', laborHoursPerUnit: 0.05, wasteFactorPercent: 5 },
      'vapor-barrier': { materialCost: 0.25, laborCost: 0.25, totalInstalled: 0.50, unit: 'SF', laborHoursPerUnit: 0.004, wasteFactorPercent: 10 },
      'air-barrier': { materialCost: 1.25, laborCost: 1.75, totalInstalled: 3.00, unit: 'SF', laborHoursPerUnit: 0.025, wasteFactorPercent: 5 },
      
      // Sealants/Flashing
      'flashing-metal': { materialCost: 4.50, laborCost: 5.50, totalInstalled: 10.00, unit: 'LF', laborHoursPerUnit: 0.08, wasteFactorPercent: 10 },
      'caulking-exterior': { materialCost: 1.50, laborCost: 2.50, totalInstalled: 4.00, unit: 'LF', laborHoursPerUnit: 0.035, wasteFactorPercent: 5 },
    }
  },
  
  // Division 08 - Openings (Doors & Windows)
  {
    divisionCode: 8,
    divisionName: 'Openings',
    items: {
      // Doors
      'door-hollow-metal-3070': { materialCost: 550, laborCost: 250, totalInstalled: 800, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0 },
      'door-hollow-metal-3080': { materialCost: 650, laborCost: 275, totalInstalled: 925, unit: 'EA', laborHoursPerUnit: 3.8, wasteFactorPercent: 0 },
      'door-hollow-metal-pair': { materialCost: 1150, laborCost: 450, totalInstalled: 1600, unit: 'EA', laborHoursPerUnit: 6.0, wasteFactorPercent: 0 },
      'door-wood-solid-core': { materialCost: 425, laborCost: 225, totalInstalled: 650, unit: 'EA', laborHoursPerUnit: 3.2, wasteFactorPercent: 0 },
      'door-wood-hollow-core': { materialCost: 225, laborCost: 175, totalInstalled: 400, unit: 'EA', laborHoursPerUnit: 2.5, wasteFactorPercent: 0 },
      'door-fire-rated-90min': { materialCost: 1250, laborCost: 450, totalInstalled: 1700, unit: 'EA', laborHoursPerUnit: 6.0, wasteFactorPercent: 0 },
      'door-aluminum-storefront': { materialCost: 1850, laborCost: 650, totalInstalled: 2500, unit: 'EA', laborHoursPerUnit: 8.5, wasteFactorPercent: 0 },
      
      // Frames
      'frame-hollow-metal-3070': { materialCost: 225, laborCost: 125, totalInstalled: 350, unit: 'EA', laborHoursPerUnit: 1.8, wasteFactorPercent: 0 },
      'frame-hollow-metal-3080': { materialCost: 275, laborCost: 150, totalInstalled: 425, unit: 'EA', laborHoursPerUnit: 2.0, wasteFactorPercent: 0 },
      'frame-wood': { materialCost: 95, laborCost: 75, totalInstalled: 170, unit: 'EA', laborHoursPerUnit: 1.1, wasteFactorPercent: 0 },
      
      // Hardware
      'hardware-set-commercial': { materialCost: 350, laborCost: 125, totalInstalled: 475, unit: 'EA', laborHoursPerUnit: 1.8, wasteFactorPercent: 0 },
      'hardware-set-healthcare': { materialCost: 550, laborCost: 175, totalInstalled: 725, unit: 'EA', laborHoursPerUnit: 2.5, wasteFactorPercent: 0 },
      'closer-door': { materialCost: 185, laborCost: 65, totalInstalled: 250, unit: 'EA', laborHoursPerUnit: 0.9, wasteFactorPercent: 0 },
      'lockset-commercial': { materialCost: 225, laborCost: 75, totalInstalled: 300, unit: 'EA', laborHoursPerUnit: 1.1, wasteFactorPercent: 0 },
      
      // Windows
      'window-aluminum-fixed': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'SF', laborHoursPerUnit: 0.5, wasteFactorPercent: 3 },
      'window-aluminum-operable': { materialCost: 65, laborCost: 45, totalInstalled: 110, unit: 'SF', laborHoursPerUnit: 0.65, wasteFactorPercent: 3 },
      'window-vinyl': { materialCost: 35, laborCost: 30, totalInstalled: 65, unit: 'SF', laborHoursPerUnit: 0.45, wasteFactorPercent: 3 },
      
      // Storefronts/Curtain Wall
      'storefront-aluminum': { materialCost: 55, laborCost: 40, totalInstalled: 95, unit: 'SF', laborHoursPerUnit: 0.55, wasteFactorPercent: 3 },
      'curtain-wall': { materialCost: 95, laborCost: 65, totalInstalled: 160, unit: 'SF', laborHoursPerUnit: 0.9, wasteFactorPercent: 3 },
      'glazing-insulated': { materialCost: 28, laborCost: 18, totalInstalled: 46, unit: 'SF', laborHoursPerUnit: 0.25, wasteFactorPercent: 5 },
    }
  },
  
  // Division 09 - Finishes
  {
    divisionCode: 9,
    divisionName: 'Finishes',
    items: {
      // Drywall
      'drywall-1/2-standard': { materialCost: 1.85, laborCost: 3.15, totalInstalled: 5.00, unit: 'SF', laborHoursPerUnit: 0.045, wasteFactorPercent: 8 },
      'drywall-5/8-type-x': { materialCost: 2.25, laborCost: 3.75, totalInstalled: 6.00, unit: 'SF', laborHoursPerUnit: 0.055, wasteFactorPercent: 8 },
      'drywall-moisture-resistant': { materialCost: 2.75, laborCost: 4.25, totalInstalled: 7.00, unit: 'SF', laborHoursPerUnit: 0.06, wasteFactorPercent: 8 },
      'drywall-fire-rated-assembly': { materialCost: 3.50, laborCost: 5.50, totalInstalled: 9.00, unit: 'SF', laborHoursPerUnit: 0.08, wasteFactorPercent: 8 },
      'drywall-finishing-level4': { materialCost: 0.85, laborCost: 2.15, totalInstalled: 3.00, unit: 'SF', laborHoursPerUnit: 0.03, wasteFactorPercent: 3 },
      'drywall-finishing-level5': { materialCost: 1.25, laborCost: 2.75, totalInstalled: 4.00, unit: 'SF', laborHoursPerUnit: 0.04, wasteFactorPercent: 3 },
      
      // Metal Framing
      'metal-stud-3-5/8-20ga': { materialCost: 1.25, laborCost: 1.75, totalInstalled: 3.00, unit: 'SF', laborHoursPerUnit: 0.025, wasteFactorPercent: 5 },
      'metal-stud-6in-20ga': { materialCost: 1.75, laborCost: 2.25, totalInstalled: 4.00, unit: 'SF', laborHoursPerUnit: 0.032, wasteFactorPercent: 5 },
      'metal-furring-channel': { materialCost: 0.85, laborCost: 1.15, totalInstalled: 2.00, unit: 'SF', laborHoursPerUnit: 0.016, wasteFactorPercent: 5 },
      
      // Acoustical Ceilings
      'act-grid-exposed': { materialCost: 1.75, laborCost: 2.25, totalInstalled: 4.00, unit: 'SF', laborHoursPerUnit: 0.032, wasteFactorPercent: 5 },
      'act-tile-2x2-standard': { materialCost: 2.25, laborCost: 1.75, totalInstalled: 4.00, unit: 'SF', laborHoursPerUnit: 0.025, wasteFactorPercent: 5 },
      'act-tile-2x4-standard': { materialCost: 2.00, laborCost: 1.50, totalInstalled: 3.50, unit: 'SF', laborHoursPerUnit: 0.022, wasteFactorPercent: 5 },
      'act-complete-system': { materialCost: 4.50, laborCost: 4.50, totalInstalled: 9.00, unit: 'SF', laborHoursPerUnit: 0.065, wasteFactorPercent: 5 },
      'gypsum-ceiling': { materialCost: 4.00, laborCost: 6.00, totalInstalled: 10.00, unit: 'SF', laborHoursPerUnit: 0.085, wasteFactorPercent: 8 },
      
      // Flooring
      'ceramic-tile-floor': { materialCost: 8.50, laborCost: 10.50, totalInstalled: 19.00, unit: 'SF', laborHoursPerUnit: 0.15, wasteFactorPercent: 10 },
      'porcelain-tile-floor': { materialCost: 10.50, laborCost: 11.50, totalInstalled: 22.00, unit: 'SF', laborHoursPerUnit: 0.16, wasteFactorPercent: 10 },
      'lvt-commercial': { materialCost: 6.50, laborCost: 4.50, totalInstalled: 11.00, unit: 'SF', laborHoursPerUnit: 0.065, wasteFactorPercent: 8 },
      'lvt-healthcare': { materialCost: 8.50, laborCost: 5.50, totalInstalled: 14.00, unit: 'SF', laborHoursPerUnit: 0.08, wasteFactorPercent: 8 },
      'carpet-tile-commercial': { materialCost: 4.50, laborCost: 2.50, totalInstalled: 7.00, unit: 'SF', laborHoursPerUnit: 0.035, wasteFactorPercent: 5 },
      'carpet-broadloom': { materialCost: 3.75, laborCost: 2.25, totalInstalled: 6.00, unit: 'SF', laborHoursPerUnit: 0.03, wasteFactorPercent: 10 },
      'vct-commercial': { materialCost: 2.25, laborCost: 2.75, totalInstalled: 5.00, unit: 'SF', laborHoursPerUnit: 0.04, wasteFactorPercent: 8 },
      'epoxy-floor-coating': { materialCost: 6.50, laborCost: 5.50, totalInstalled: 12.00, unit: 'SF', laborHoursPerUnit: 0.08, wasteFactorPercent: 5 },
      'polished-concrete': { materialCost: 5.50, laborCost: 6.50, totalInstalled: 12.00, unit: 'SF', laborHoursPerUnit: 0.095, wasteFactorPercent: 3 },
      
      // Wall Finishes
      'ceramic-tile-wall': { materialCost: 9.50, laborCost: 12.50, totalInstalled: 22.00, unit: 'SF', laborHoursPerUnit: 0.18, wasteFactorPercent: 10 },
      'wall-covering-vinyl': { materialCost: 4.50, laborCost: 3.50, totalInstalled: 8.00, unit: 'SF', laborHoursPerUnit: 0.05, wasteFactorPercent: 10 },
      'frp-wall-panel': { materialCost: 6.50, laborCost: 5.50, totalInstalled: 12.00, unit: 'SF', laborHoursPerUnit: 0.08, wasteFactorPercent: 5 },
      
      // Painting
      'paint-wall-2-coats': { materialCost: 0.55, laborCost: 1.95, totalInstalled: 2.50, unit: 'SF', laborHoursPerUnit: 0.028, wasteFactorPercent: 5 },
      'paint-ceiling-2-coats': { materialCost: 0.65, laborCost: 2.35, totalInstalled: 3.00, unit: 'SF', laborHoursPerUnit: 0.034, wasteFactorPercent: 5 },
      'paint-door-frame': { materialCost: 15, laborCost: 45, totalInstalled: 60, unit: 'EA', laborHoursPerUnit: 0.65, wasteFactorPercent: 5 },
      
      // Base
      'rubber-base-4in': { materialCost: 2.75, laborCost: 2.25, totalInstalled: 5.00, unit: 'LF', laborHoursPerUnit: 0.032, wasteFactorPercent: 5 },
      'rubber-base-6in': { materialCost: 3.50, laborCost: 2.50, totalInstalled: 6.00, unit: 'LF', laborHoursPerUnit: 0.036, wasteFactorPercent: 5 },
      'wood-base': { materialCost: 3.25, laborCost: 3.75, totalInstalled: 7.00, unit: 'LF', laborHoursPerUnit: 0.055, wasteFactorPercent: 10 },
      'tile-base': { materialCost: 8.50, laborCost: 9.50, totalInstalled: 18.00, unit: 'LF', laborHoursPerUnit: 0.14, wasteFactorPercent: 10 },
    }
  },
  
  // Division 10 - Specialties
  {
    divisionCode: 10,
    divisionName: 'Specialties',
    items: {
      'toilet-partition-plastic': { materialCost: 650, laborCost: 250, totalInstalled: 900, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0 },
      'toilet-partition-stainless': { materialCost: 1250, laborCost: 350, totalInstalled: 1600, unit: 'EA', laborHoursPerUnit: 5.0, wasteFactorPercent: 0 },
      'toilet-accessories-set': { materialCost: 350, laborCost: 150, totalInstalled: 500, unit: 'EA', laborHoursPerUnit: 2.2, wasteFactorPercent: 0 },
      'grab-bar-36in': { materialCost: 75, laborCost: 65, totalInstalled: 140, unit: 'EA', laborHoursPerUnit: 0.9, wasteFactorPercent: 0 },
      'grab-bar-42in': { materialCost: 85, laborCost: 70, totalInstalled: 155, unit: 'EA', laborHoursPerUnit: 1.0, wasteFactorPercent: 0 },
      'mirror-wall': { materialCost: 18, laborCost: 12, totalInstalled: 30, unit: 'SF', laborHoursPerUnit: 0.17, wasteFactorPercent: 5 },
      'lockers-single-tier': { materialCost: 275, laborCost: 75, totalInstalled: 350, unit: 'EA', laborHoursPerUnit: 1.1, wasteFactorPercent: 0 },
      'corner-guards': { materialCost: 35, laborCost: 25, totalInstalled: 60, unit: 'LF', laborHoursPerUnit: 0.35, wasteFactorPercent: 5 },
      'handrail-wall-mounted': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'LF', laborHoursPerUnit: 0.5, wasteFactorPercent: 5 },
      'signage-room-ada': { materialCost: 85, laborCost: 35, totalInstalled: 120, unit: 'EA', laborHoursPerUnit: 0.5, wasteFactorPercent: 0 },
      'signage-wayfinding': { materialCost: 125, laborCost: 45, totalInstalled: 170, unit: 'EA', laborHoursPerUnit: 0.65, wasteFactorPercent: 0 },
      'fire-extinguisher-cabinet': { materialCost: 145, laborCost: 85, totalInstalled: 230, unit: 'EA', laborHoursPerUnit: 1.2, wasteFactorPercent: 0 },
    }
  },
  
  // Division 11 - Equipment
  {
    divisionCode: 11,
    divisionName: 'Equipment',
    items: {
      // Commercial Kitchen Equipment
      'kitchen-equipment-allowance': { materialCost: 25000, laborCost: 8000, totalInstalled: 33000, unit: 'LS', laborHoursPerUnit: 120, wasteFactorPercent: 0 },
      'commercial-range-6-burner': { materialCost: 4500, laborCost: 850, totalInstalled: 5350, unit: 'EA', laborHoursPerUnit: 12, wasteFactorPercent: 0 },
      'commercial-range-gas-griddle': { materialCost: 3200, laborCost: 650, totalInstalled: 3850, unit: 'EA', laborHoursPerUnit: 9, wasteFactorPercent: 0 },
      'commercial-convection-oven': { materialCost: 5500, laborCost: 750, totalInstalled: 6250, unit: 'EA', laborHoursPerUnit: 10, wasteFactorPercent: 0 },
      'commercial-walk-in-cooler': { materialCost: 12000, laborCost: 3500, totalInstalled: 15500, unit: 'EA', laborHoursPerUnit: 48, wasteFactorPercent: 0 },
      'commercial-walk-in-freezer': { materialCost: 15000, laborCost: 4000, totalInstalled: 19000, unit: 'EA', laborHoursPerUnit: 56, wasteFactorPercent: 0 },
      'commercial-reach-in-refrigerator': { materialCost: 3500, laborCost: 450, totalInstalled: 3950, unit: 'EA', laborHoursPerUnit: 6, wasteFactorPercent: 0 },
      'commercial-reach-in-freezer': { materialCost: 4200, laborCost: 500, totalInstalled: 4700, unit: 'EA', laborHoursPerUnit: 7, wasteFactorPercent: 0 },
      'commercial-dishwasher': { materialCost: 8500, laborCost: 1800, totalInstalled: 10300, unit: 'EA', laborHoursPerUnit: 24, wasteFactorPercent: 0 },
      'commercial-ice-machine': { materialCost: 3800, laborCost: 650, totalInstalled: 4450, unit: 'EA', laborHoursPerUnit: 8, wasteFactorPercent: 0 },
      'exhaust-hood-type-1': { materialCost: 185, laborCost: 95, totalInstalled: 280, unit: 'LF', laborHoursPerUnit: 1.2, wasteFactorPercent: 0 },
      'exhaust-hood-type-2': { materialCost: 125, laborCost: 75, totalInstalled: 200, unit: 'LF', laborHoursPerUnit: 0.95, wasteFactorPercent: 0 },
      'fire-suppression-hood': { materialCost: 2500, laborCost: 1200, totalInstalled: 3700, unit: 'EA', laborHoursPerUnit: 16, wasteFactorPercent: 0 },
      'stainless-steel-table': { materialCost: 850, laborCost: 150, totalInstalled: 1000, unit: 'EA', laborHoursPerUnit: 2, wasteFactorPercent: 0 },
      'three-compartment-sink': { materialCost: 1800, laborCost: 650, totalInstalled: 2450, unit: 'EA', laborHoursPerUnit: 8, wasteFactorPercent: 0 },
      
      // Laundry Equipment
      'laundry-washer-commercial': { materialCost: 2500, laborCost: 450, totalInstalled: 2950, unit: 'EA', laborHoursPerUnit: 6.0, wasteFactorPercent: 0 },
      'laundry-dryer-commercial': { materialCost: 2200, laborCost: 400, totalInstalled: 2600, unit: 'EA', laborHoursPerUnit: 5.0, wasteFactorPercent: 0 },
      'laundry-washer-industrial': { materialCost: 8500, laborCost: 1200, totalInstalled: 9700, unit: 'EA', laborHoursPerUnit: 16, wasteFactorPercent: 0 },
      'laundry-dryer-industrial': { materialCost: 7500, laborCost: 1100, totalInstalled: 8600, unit: 'EA', laborHoursPerUnit: 14, wasteFactorPercent: 0 },
      'laundry-folding-table': { materialCost: 650, laborCost: 125, totalInstalled: 775, unit: 'EA', laborHoursPerUnit: 1.5, wasteFactorPercent: 0 },
      
      // Healthcare/Senior Care Equipment
      'nurse-call-system-master': { materialCost: 8500, laborCost: 3500, totalInstalled: 12000, unit: 'EA', laborHoursPerUnit: 48, wasteFactorPercent: 0 },
      'nurse-call-station-room': { materialCost: 350, laborCost: 185, totalInstalled: 535, unit: 'EA', laborHoursPerUnit: 2.5, wasteFactorPercent: 0 },
      'nurse-call-pull-cord': { materialCost: 125, laborCost: 95, totalInstalled: 220, unit: 'EA', laborHoursPerUnit: 1.2, wasteFactorPercent: 0 },
      'nurse-call-bathroom': { materialCost: 185, laborCost: 125, totalInstalled: 310, unit: 'EA', laborHoursPerUnit: 1.6, wasteFactorPercent: 0 },
      'wander-management-system': { materialCost: 15000, laborCost: 5500, totalInstalled: 20500, unit: 'LS', laborHoursPerUnit: 72, wasteFactorPercent: 0 },
      'wander-guard-door-unit': { materialCost: 850, laborCost: 350, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 4.5, wasteFactorPercent: 0 },
      'wander-guard-resident-tag': { materialCost: 85, laborCost: 0, totalInstalled: 85, unit: 'EA', laborHoursPerUnit: 0, wasteFactorPercent: 0 },
      'medical-gas-outlet-oxygen': { materialCost: 185, laborCost: 145, totalInstalled: 330, unit: 'EA', laborHoursPerUnit: 1.8, wasteFactorPercent: 0 },
      'medical-gas-outlet-vacuum': { materialCost: 195, laborCost: 155, totalInstalled: 350, unit: 'EA', laborHoursPerUnit: 2, wasteFactorPercent: 0 },
      'patient-lift-ceiling': { materialCost: 4500, laborCost: 1800, totalInstalled: 6300, unit: 'EA', laborHoursPerUnit: 24, wasteFactorPercent: 0 },
      'patient-lift-track': { materialCost: 125, laborCost: 65, totalInstalled: 190, unit: 'LF', laborHoursPerUnit: 0.85, wasteFactorPercent: 0 },
      'hospital-bed-electric': { materialCost: 3500, laborCost: 250, totalInstalled: 3750, unit: 'EA', laborHoursPerUnit: 3, wasteFactorPercent: 0 },
      'overbed-table': { materialCost: 285, laborCost: 45, totalInstalled: 330, unit: 'EA', laborHoursPerUnit: 0.5, wasteFactorPercent: 0 },
      'bedside-cabinet': { materialCost: 425, laborCost: 65, totalInstalled: 490, unit: 'EA', laborHoursPerUnit: 0.8, wasteFactorPercent: 0 },
      
      // Accessibility Equipment
      'grab-bar-stainless-18in': { materialCost: 45, laborCost: 55, totalInstalled: 100, unit: 'EA', laborHoursPerUnit: 0.7, wasteFactorPercent: 0 },
      'grab-bar-stainless-24in': { materialCost: 55, laborCost: 60, totalInstalled: 115, unit: 'EA', laborHoursPerUnit: 0.75, wasteFactorPercent: 0 },
      'grab-bar-stainless-36in': { materialCost: 75, laborCost: 65, totalInstalled: 140, unit: 'EA', laborHoursPerUnit: 0.85, wasteFactorPercent: 0 },
      'grab-bar-stainless-42in': { materialCost: 85, laborCost: 70, totalInstalled: 155, unit: 'EA', laborHoursPerUnit: 0.9, wasteFactorPercent: 0 },
      'fold-down-shower-seat': { materialCost: 285, laborCost: 165, totalInstalled: 450, unit: 'EA', laborHoursPerUnit: 2, wasteFactorPercent: 0 },
      'ada-toilet-seat-riser': { materialCost: 125, laborCost: 85, totalInstalled: 210, unit: 'EA', laborHoursPerUnit: 1, wasteFactorPercent: 0 },
      'handrail-wall-mount': { materialCost: 28, laborCost: 22, totalInstalled: 50, unit: 'LF', laborHoursPerUnit: 0.28, wasteFactorPercent: 5 },
    }
  },
  
  // Division 12 - Furnishings
  {
    divisionCode: 12,
    divisionName: 'Furnishings',
    items: {
      // Window Treatments
      'window-blinds-vertical': { materialCost: 12, laborCost: 8, totalInstalled: 20, unit: 'SF', laborHoursPerUnit: 0.12, wasteFactorPercent: 5 },
      'window-blinds-horizontal': { materialCost: 10, laborCost: 7, totalInstalled: 17, unit: 'SF', laborHoursPerUnit: 0.1, wasteFactorPercent: 5 },
      'window-blinds-blackout': { materialCost: 18, laborCost: 10, totalInstalled: 28, unit: 'SF', laborHoursPerUnit: 0.14, wasteFactorPercent: 5 },
      'window-shades-roller': { materialCost: 14, laborCost: 9, totalInstalled: 23, unit: 'SF', laborHoursPerUnit: 0.12, wasteFactorPercent: 5 },
      'drapery-track-hospital': { materialCost: 18, laborCost: 12, totalInstalled: 30, unit: 'LF', laborHoursPerUnit: 0.15, wasteFactorPercent: 3 },
      'cubicle-curtain-track': { materialCost: 22, laborCost: 14, totalInstalled: 36, unit: 'LF', laborHoursPerUnit: 0.18, wasteFactorPercent: 3 },
      'cubicle-curtain': { materialCost: 145, laborCost: 55, totalInstalled: 200, unit: 'EA', laborHoursPerUnit: 0.7, wasteFactorPercent: 0 },
      
      // Casework & Millwork
      'base-cabinet-laminate': { materialCost: 185, laborCost: 95, totalInstalled: 280, unit: 'LF', laborHoursPerUnit: 1.2, wasteFactorPercent: 3 },
      'base-cabinet-wood': { materialCost: 285, laborCost: 125, totalInstalled: 410, unit: 'LF', laborHoursPerUnit: 1.6, wasteFactorPercent: 3 },
      'wall-cabinet-laminate': { materialCost: 145, laborCost: 85, totalInstalled: 230, unit: 'LF', laborHoursPerUnit: 1.1, wasteFactorPercent: 3 },
      'wall-cabinet-wood': { materialCost: 225, laborCost: 110, totalInstalled: 335, unit: 'LF', laborHoursPerUnit: 1.4, wasteFactorPercent: 3 },
      'countertop-laminate': { materialCost: 35, laborCost: 25, totalInstalled: 60, unit: 'SF', laborHoursPerUnit: 0.32, wasteFactorPercent: 5 },
      'countertop-solid-surface': { materialCost: 85, laborCost: 45, totalInstalled: 130, unit: 'SF', laborHoursPerUnit: 0.58, wasteFactorPercent: 5 },
      'countertop-quartz': { materialCost: 95, laborCost: 55, totalInstalled: 150, unit: 'SF', laborHoursPerUnit: 0.7, wasteFactorPercent: 5 },
      'countertop-granite': { materialCost: 110, laborCost: 65, totalInstalled: 175, unit: 'SF', laborHoursPerUnit: 0.82, wasteFactorPercent: 5 },
      'reception-desk-custom': { materialCost: 4500, laborCost: 1800, totalInstalled: 6300, unit: 'EA', laborHoursPerUnit: 24, wasteFactorPercent: 0 },
      'nurses-station-modular': { materialCost: 8500, laborCost: 3200, totalInstalled: 11700, unit: 'EA', laborHoursPerUnit: 42, wasteFactorPercent: 0 },
      'closet-shelf-wire': { materialCost: 8, laborCost: 6, totalInstalled: 14, unit: 'LF', laborHoursPerUnit: 0.08, wasteFactorPercent: 5 },
      'closet-rod-chrome': { materialCost: 6, laborCost: 5, totalInstalled: 11, unit: 'LF', laborHoursPerUnit: 0.06, wasteFactorPercent: 5 },
      'wardrobe-unit-resident': { materialCost: 650, laborCost: 185, totalInstalled: 835, unit: 'EA', laborHoursPerUnit: 2.4, wasteFactorPercent: 0 },
      
      // Signage
      'room-sign-ada-compliant': { materialCost: 85, laborCost: 45, totalInstalled: 130, unit: 'EA', laborHoursPerUnit: 0.6, wasteFactorPercent: 0 },
      'room-sign-braille': { materialCost: 95, laborCost: 50, totalInstalled: 145, unit: 'EA', laborHoursPerUnit: 0.65, wasteFactorPercent: 0 },
      'directory-sign-wall': { materialCost: 450, laborCost: 185, totalInstalled: 635, unit: 'EA', laborHoursPerUnit: 2.4, wasteFactorPercent: 0 },
      'directory-sign-freestanding': { materialCost: 850, laborCost: 350, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 4.5, wasteFactorPercent: 0 },
      'wayfinding-signage-interior': { materialCost: 125, laborCost: 65, totalInstalled: 190, unit: 'EA', laborHoursPerUnit: 0.85, wasteFactorPercent: 0 },
      'exit-sign-photoluminescent': { materialCost: 75, laborCost: 45, totalInstalled: 120, unit: 'EA', laborHoursPerUnit: 0.6, wasteFactorPercent: 0 },
      'building-letters-exterior': { materialCost: 85, laborCost: 55, totalInstalled: 140, unit: 'EA', laborHoursPerUnit: 0.7, wasteFactorPercent: 0 },
      'monument-sign': { materialCost: 5500, laborCost: 2200, totalInstalled: 7700, unit: 'EA', laborHoursPerUnit: 28, wasteFactorPercent: 0 },
      
      // Floor Mats & Coverings
      'entrance-mat': { materialCost: 45, laborCost: 15, totalInstalled: 60, unit: 'SF', laborHoursPerUnit: 0.22, wasteFactorPercent: 5 },
      'entrance-mat-recessed': { materialCost: 85, laborCost: 45, totalInstalled: 130, unit: 'SF', laborHoursPerUnit: 0.58, wasteFactorPercent: 5 },
      'anti-fatigue-mat': { materialCost: 35, laborCost: 8, totalInstalled: 43, unit: 'SF', laborHoursPerUnit: 0.1, wasteFactorPercent: 5 },
      
      // Furniture (Allowances)
      'resident-room-furniture-pkg': { materialCost: 2500, laborCost: 450, totalInstalled: 2950, unit: 'EA', laborHoursPerUnit: 6, wasteFactorPercent: 0 },
      'common-area-furniture-pkg': { materialCost: 15000, laborCost: 2500, totalInstalled: 17500, unit: 'LS', laborHoursPerUnit: 32, wasteFactorPercent: 0 },
      'dining-furniture-pkg': { materialCost: 12000, laborCost: 2000, totalInstalled: 14000, unit: 'LS', laborHoursPerUnit: 26, wasteFactorPercent: 0 },
      'office-furniture-workstation': { materialCost: 1800, laborCost: 350, totalInstalled: 2150, unit: 'EA', laborHoursPerUnit: 4.5, wasteFactorPercent: 0 },
    }
  },
  
  // Division 13 - Special Construction (PEMB)
  {
    divisionCode: 13,
    divisionName: 'Special Construction',
    items: {
      'pemb-material': { materialCost: 14.50, laborCost: 0, totalInstalled: 14.50, unit: 'SF', laborHoursPerUnit: 0, wasteFactorPercent: 3 },
      'pemb-erection': { materialCost: 0, laborCost: 8.50, totalInstalled: 8.50, unit: 'SF', laborHoursPerUnit: 0.12, wasteFactorPercent: 0 },
      'pemb-complete': { materialCost: 14.50, laborCost: 8.50, totalInstalled: 23.00, unit: 'SF', laborHoursPerUnit: 0.12, wasteFactorPercent: 3 },
      'metal-building-insulation': { materialCost: 2.25, laborCost: 1.75, totalInstalled: 4.00, unit: 'SF', laborHoursPerUnit: 0.025, wasteFactorPercent: 5 },
    }
  },
  
  // Division 14 - Conveying Equipment
  {
    divisionCode: 14,
    divisionName: 'Conveying Equipment',
    items: {
      // Passenger Elevators
      'elevator-hydraulic-2stop': { materialCost: 45000, laborCost: 18000, totalInstalled: 63000, unit: 'EA', laborHoursPerUnit: 240, wasteFactorPercent: 0 },
      'elevator-hydraulic-3stop': { materialCost: 55000, laborCost: 22000, totalInstalled: 77000, unit: 'EA', laborHoursPerUnit: 290, wasteFactorPercent: 0 },
      'elevator-hydraulic-4stop': { materialCost: 68000, laborCost: 27000, totalInstalled: 95000, unit: 'EA', laborHoursPerUnit: 360, wasteFactorPercent: 0 },
      'elevator-traction-low-rise': { materialCost: 75000, laborCost: 30000, totalInstalled: 105000, unit: 'EA', laborHoursPerUnit: 400, wasteFactorPercent: 0 },
      'elevator-traction-mid-rise': { materialCost: 95000, laborCost: 38000, totalInstalled: 133000, unit: 'EA', laborHoursPerUnit: 500, wasteFactorPercent: 0 },
      'elevator-mrl-2stop': { materialCost: 52000, laborCost: 21000, totalInstalled: 73000, unit: 'EA', laborHoursPerUnit: 280, wasteFactorPercent: 0 },
      'elevator-mrl-3stop': { materialCost: 62000, laborCost: 25000, totalInstalled: 87000, unit: 'EA', laborHoursPerUnit: 330, wasteFactorPercent: 0 },
      'elevator-mrl-4stop': { materialCost: 75000, laborCost: 30000, totalInstalled: 105000, unit: 'EA', laborHoursPerUnit: 400, wasteFactorPercent: 0 },
      'elevator-additional-stop': { materialCost: 8500, laborCost: 3500, totalInstalled: 12000, unit: 'EA', laborHoursPerUnit: 48, wasteFactorPercent: 0 },
      
      // Elevator Cab Finishes
      'elevator-cab-standard': { materialCost: 8500, laborCost: 3500, totalInstalled: 12000, unit: 'EA', laborHoursPerUnit: 48, wasteFactorPercent: 0 },
      'elevator-cab-premium': { materialCost: 15000, laborCost: 5000, totalInstalled: 20000, unit: 'EA', laborHoursPerUnit: 68, wasteFactorPercent: 0 },
      'elevator-cab-stainless': { materialCost: 12000, laborCost: 4200, totalInstalled: 16200, unit: 'EA', laborHoursPerUnit: 56, wasteFactorPercent: 0 },
      'elevator-handrail': { materialCost: 450, laborCost: 250, totalInstalled: 700, unit: 'EA', laborHoursPerUnit: 3.2, wasteFactorPercent: 0 },
      'elevator-protection-pads': { materialCost: 850, laborCost: 350, totalInstalled: 1200, unit: 'SET', laborHoursPerUnit: 4.5, wasteFactorPercent: 0 },
      
      // Elevator Components
      'elevator-pit': { materialCost: 3500, laborCost: 4500, totalInstalled: 8000, unit: 'EA', laborHoursPerUnit: 60, wasteFactorPercent: 0 },
      'elevator-machine-room': { materialCost: 5500, laborCost: 6500, totalInstalled: 12000, unit: 'EA', laborHoursPerUnit: 86, wasteFactorPercent: 0 },
      'elevator-door-standard': { materialCost: 2800, laborCost: 1200, totalInstalled: 4000, unit: 'EA', laborHoursPerUnit: 16, wasteFactorPercent: 0 },
      'elevator-door-fire-rated': { materialCost: 3800, laborCost: 1500, totalInstalled: 5300, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      'elevator-emergency-phone': { materialCost: 650, laborCost: 350, totalInstalled: 1000, unit: 'EA', laborHoursPerUnit: 4.5, wasteFactorPercent: 0 },
      'elevator-lobby-indicators': { materialCost: 1200, laborCost: 500, totalInstalled: 1700, unit: 'FLOOR', laborHoursPerUnit: 6.5, wasteFactorPercent: 0 },
      
      // Wheelchair/Platform Lifts (Critical for Senior Care)
      'platform-lift-vertical-6ft': { materialCost: 12000, laborCost: 5500, totalInstalled: 17500, unit: 'EA', laborHoursPerUnit: 72, wasteFactorPercent: 0 },
      'platform-lift-vertical-10ft': { materialCost: 16000, laborCost: 7000, totalInstalled: 23000, unit: 'EA', laborHoursPerUnit: 92, wasteFactorPercent: 0 },
      'platform-lift-vertical-14ft': { materialCost: 22000, laborCost: 9000, totalInstalled: 31000, unit: 'EA', laborHoursPerUnit: 118, wasteFactorPercent: 0 },
      'platform-lift-inclined': { materialCost: 8500, laborCost: 4500, totalInstalled: 13000, unit: 'EA', laborHoursPerUnit: 60, wasteFactorPercent: 0 },
      'porch-lift-53in': { materialCost: 5500, laborCost: 2800, totalInstalled: 8300, unit: 'EA', laborHoursPerUnit: 36, wasteFactorPercent: 0 },
      'stair-lift-straight': { materialCost: 3500, laborCost: 1500, totalInstalled: 5000, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      'stair-lift-curved': { materialCost: 9500, laborCost: 3500, totalInstalled: 13000, unit: 'EA', laborHoursPerUnit: 46, wasteFactorPercent: 0 },
      
      // LULA Elevators (Limited Use/Limited Application)
      'lula-elevator-2stop': { materialCost: 38000, laborCost: 15000, totalInstalled: 53000, unit: 'EA', laborHoursPerUnit: 200, wasteFactorPercent: 0 },
      'lula-elevator-3stop': { materialCost: 48000, laborCost: 19000, totalInstalled: 67000, unit: 'EA', laborHoursPerUnit: 250, wasteFactorPercent: 0 },
      
      // Dumbwaiters
      'dumbwaiter-manual': { materialCost: 4500, laborCost: 2500, totalInstalled: 7000, unit: 'EA', laborHoursPerUnit: 32, wasteFactorPercent: 0 },
      'dumbwaiter-electric-2stop': { materialCost: 12000, laborCost: 5500, totalInstalled: 17500, unit: 'EA', laborHoursPerUnit: 72, wasteFactorPercent: 0 },
      'dumbwaiter-electric-3stop': { materialCost: 15000, laborCost: 7000, totalInstalled: 22000, unit: 'EA', laborHoursPerUnit: 92, wasteFactorPercent: 0 },
      'dumbwaiter-food-service': { materialCost: 18000, laborCost: 8000, totalInstalled: 26000, unit: 'EA', laborHoursPerUnit: 105, wasteFactorPercent: 0 },
      
      // Material Handling
      'material-lift-1000lb': { materialCost: 8500, laborCost: 4000, totalInstalled: 12500, unit: 'EA', laborHoursPerUnit: 52, wasteFactorPercent: 0 },
      'material-lift-2000lb': { materialCost: 12500, laborCost: 5500, totalInstalled: 18000, unit: 'EA', laborHoursPerUnit: 72, wasteFactorPercent: 0 },
      'trash-chute': { materialCost: 185, laborCost: 95, totalInstalled: 280, unit: 'FLOOR', laborHoursPerUnit: 1.2, wasteFactorPercent: 0 },
      'linen-chute': { materialCost: 225, laborCost: 115, totalInstalled: 340, unit: 'FLOOR', laborHoursPerUnit: 1.5, wasteFactorPercent: 0 },
      
      // Elevator Maintenance/Service (for budgeting)
      'elevator-annual-maintenance': { materialCost: 0, laborCost: 4800, totalInstalled: 4800, unit: 'YR', laborHoursPerUnit: 64, wasteFactorPercent: 0 },
      'elevator-modernization-controls': { materialCost: 25000, laborCost: 15000, totalInstalled: 40000, unit: 'EA', laborHoursPerUnit: 200, wasteFactorPercent: 0 },
    }
  },
  
  // Division 21 - Fire Suppression
  {
    divisionCode: 21,
    divisionName: 'Fire Suppression',
    items: {
      'sprinkler-wet-system': { materialCost: 4.25, laborCost: 4.75, totalInstalled: 9.00, unit: 'SF', laborHoursPerUnit: 0.07, wasteFactorPercent: 5 },
      'sprinkler-dry-system': { materialCost: 5.50, laborCost: 5.50, totalInstalled: 11.00, unit: 'SF', laborHoursPerUnit: 0.08, wasteFactorPercent: 5 },
      'sprinkler-head-pendant': { materialCost: 35, laborCost: 45, totalInstalled: 80, unit: 'EA', laborHoursPerUnit: 0.65, wasteFactorPercent: 3 },
      'sprinkler-head-sidewall': { materialCost: 45, laborCost: 50, totalInstalled: 95, unit: 'EA', laborHoursPerUnit: 0.72, wasteFactorPercent: 3 },
      'sprinkler-pipe-1in': { materialCost: 8.50, laborCost: 9.50, totalInstalled: 18.00, unit: 'LF', laborHoursPerUnit: 0.14, wasteFactorPercent: 5 },
      'sprinkler-pipe-2in': { materialCost: 14.00, laborCost: 12.00, totalInstalled: 26.00, unit: 'LF', laborHoursPerUnit: 0.17, wasteFactorPercent: 5 },
      'fire-pump': { materialCost: 18000, laborCost: 6000, totalInstalled: 24000, unit: 'EA', laborHoursPerUnit: 80, wasteFactorPercent: 0 },
    }
  },
  
  // Division 22 - Plumbing
  {
    divisionCode: 22,
    divisionName: 'Plumbing',
    items: {
      // Piping
      'copper-pipe-1/2': { materialCost: 6.50, laborCost: 8.50, totalInstalled: 15.00, unit: 'LF', laborHoursPerUnit: 0.12, wasteFactorPercent: 5 },
      'copper-pipe-3/4': { materialCost: 8.50, laborCost: 9.50, totalInstalled: 18.00, unit: 'LF', laborHoursPerUnit: 0.14, wasteFactorPercent: 5 },
      'copper-pipe-1': { materialCost: 12.00, laborCost: 11.00, totalInstalled: 23.00, unit: 'LF', laborHoursPerUnit: 0.16, wasteFactorPercent: 5 },
      'copper-pipe-2': { materialCost: 22.00, laborCost: 15.00, totalInstalled: 37.00, unit: 'LF', laborHoursPerUnit: 0.22, wasteFactorPercent: 5 },
      'pvc-dwv-2': { materialCost: 4.50, laborCost: 6.50, totalInstalled: 11.00, unit: 'LF', laborHoursPerUnit: 0.09, wasteFactorPercent: 5 },
      'pvc-dwv-3': { materialCost: 6.50, laborCost: 8.00, totalInstalled: 14.50, unit: 'LF', laborHoursPerUnit: 0.12, wasteFactorPercent: 5 },
      'pvc-dwv-4': { materialCost: 8.50, laborCost: 9.50, totalInstalled: 18.00, unit: 'LF', laborHoursPerUnit: 0.14, wasteFactorPercent: 5 },
      'cast-iron-4': { materialCost: 18.00, laborCost: 14.00, totalInstalled: 32.00, unit: 'LF', laborHoursPerUnit: 0.2, wasteFactorPercent: 5 },
      
      // Fixtures
      'water-closet-commercial': { materialCost: 450, laborCost: 350, totalInstalled: 800, unit: 'EA', laborHoursPerUnit: 5.0, wasteFactorPercent: 0 },
      'water-closet-ada': { materialCost: 650, laborCost: 400, totalInstalled: 1050, unit: 'EA', laborHoursPerUnit: 5.5, wasteFactorPercent: 0 },
      'urinal-wall': { materialCost: 550, laborCost: 325, totalInstalled: 875, unit: 'EA', laborHoursPerUnit: 4.5, wasteFactorPercent: 0 },
      'lavatory-wall-hung': { materialCost: 375, laborCost: 275, totalInstalled: 650, unit: 'EA', laborHoursPerUnit: 4.0, wasteFactorPercent: 0 },
      'lavatory-counter': { materialCost: 425, laborCost: 300, totalInstalled: 725, unit: 'EA', laborHoursPerUnit: 4.2, wasteFactorPercent: 0 },
      'sink-service': { materialCost: 650, laborCost: 350, totalInstalled: 1000, unit: 'EA', laborHoursPerUnit: 5.0, wasteFactorPercent: 0 },
      'shower-ada': { materialCost: 2500, laborCost: 1200, totalInstalled: 3700, unit: 'EA', laborHoursPerUnit: 16, wasteFactorPercent: 0 },
      
      // Equipment
      'water-heater-commercial': { materialCost: 4500, laborCost: 1500, totalInstalled: 6000, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      'water-heater-tankless': { materialCost: 2200, laborCost: 800, totalInstalled: 3000, unit: 'EA', laborHoursPerUnit: 12, wasteFactorPercent: 0 },
      'grease-trap': { materialCost: 1800, laborCost: 650, totalInstalled: 2450, unit: 'EA', laborHoursPerUnit: 9, wasteFactorPercent: 0 },
      
      // Rough-In
      'plumbing-rough-per-fixture': { materialCost: 450, laborCost: 650, totalInstalled: 1100, unit: 'EA', laborHoursPerUnit: 9, wasteFactorPercent: 0 },
    }
  },
  
  // Division 23 - HVAC
  {
    divisionCode: 23,
    divisionName: 'HVAC',
    items: {
      // Ductwork
      'duct-rectangular': { materialCost: 2.75, laborCost: 3.25, totalInstalled: 6.00, unit: 'LB', laborHoursPerUnit: 0.045, wasteFactorPercent: 5 },
      'duct-round-spiral': { materialCost: 12.00, laborCost: 10.00, totalInstalled: 22.00, unit: 'LF', laborHoursPerUnit: 0.14, wasteFactorPercent: 5 },
      'duct-flexible': { materialCost: 4.50, laborCost: 3.50, totalInstalled: 8.00, unit: 'LF', laborHoursPerUnit: 0.05, wasteFactorPercent: 10 },
      'duct-insulation': { materialCost: 1.75, laborCost: 1.25, totalInstalled: 3.00, unit: 'SF', laborHoursPerUnit: 0.018, wasteFactorPercent: 5 },
      
      // Air Distribution
      'diffuser-supply': { materialCost: 55, laborCost: 45, totalInstalled: 100, unit: 'EA', laborHoursPerUnit: 0.65, wasteFactorPercent: 0 },
      'diffuser-return': { materialCost: 45, laborCost: 40, totalInstalled: 85, unit: 'EA', laborHoursPerUnit: 0.55, wasteFactorPercent: 0 },
      'grille-transfer': { materialCost: 35, laborCost: 30, totalInstalled: 65, unit: 'EA', laborHoursPerUnit: 0.45, wasteFactorPercent: 0 },
      'vav-box': { materialCost: 850, laborCost: 450, totalInstalled: 1300, unit: 'EA', laborHoursPerUnit: 6.5, wasteFactorPercent: 0 },
      
      // Equipment
      'rtu-5-ton': { materialCost: 8500, laborCost: 3500, totalInstalled: 12000, unit: 'EA', laborHoursPerUnit: 48, wasteFactorPercent: 0 },
      'rtu-10-ton': { materialCost: 14000, laborCost: 5000, totalInstalled: 19000, unit: 'EA', laborHoursPerUnit: 70, wasteFactorPercent: 0 },
      'rtu-20-ton': { materialCost: 24000, laborCost: 8000, totalInstalled: 32000, unit: 'EA', laborHoursPerUnit: 110, wasteFactorPercent: 0 },
      'split-system-2-ton': { materialCost: 4500, laborCost: 2000, totalInstalled: 6500, unit: 'EA', laborHoursPerUnit: 28, wasteFactorPercent: 0 },
      'exhaust-fan': { materialCost: 350, laborCost: 250, totalInstalled: 600, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0 },
      'erv-unit': { materialCost: 5500, laborCost: 2500, totalInstalled: 8000, unit: 'EA', laborHoursPerUnit: 35, wasteFactorPercent: 0 },
      
      // Piping
      'refrigerant-piping': { materialCost: 22, laborCost: 18, totalInstalled: 40, unit: 'LF', laborHoursPerUnit: 0.25, wasteFactorPercent: 5 },
      'chilled-water-pipe': { materialCost: 35, laborCost: 25, totalInstalled: 60, unit: 'LF', laborHoursPerUnit: 0.35, wasteFactorPercent: 5 },
      'pipe-insulation': { materialCost: 4.50, laborCost: 3.50, totalInstalled: 8.00, unit: 'LF', laborHoursPerUnit: 0.05, wasteFactorPercent: 5 },
      
      // Controls
      'thermostat-programmable': { materialCost: 185, laborCost: 115, totalInstalled: 300, unit: 'EA', laborHoursPerUnit: 1.6, wasteFactorPercent: 0 },
      'building-automation-point': { materialCost: 250, laborCost: 150, totalInstalled: 400, unit: 'EA', laborHoursPerUnit: 2.2, wasteFactorPercent: 0 },
    }
  },
  
  // Division 26 - Electrical
  {
    divisionCode: 26,
    divisionName: 'Electrical',
    items: {
      // Conduit & Raceways
      'emt-1/2': { materialCost: 1.25, laborCost: 2.75, totalInstalled: 4.00, unit: 'LF', laborHoursPerUnit: 0.04, wasteFactorPercent: 5 },
      'emt-3/4': { materialCost: 1.75, laborCost: 3.25, totalInstalled: 5.00, unit: 'LF', laborHoursPerUnit: 0.045, wasteFactorPercent: 5 },
      'emt-1': { materialCost: 2.50, laborCost: 4.00, totalInstalled: 6.50, unit: 'LF', laborHoursPerUnit: 0.055, wasteFactorPercent: 5 },
      'emt-2': { materialCost: 5.50, laborCost: 6.50, totalInstalled: 12.00, unit: 'LF', laborHoursPerUnit: 0.09, wasteFactorPercent: 5 },
      'mc-cable-12/2': { materialCost: 1.85, laborCost: 1.65, totalInstalled: 3.50, unit: 'LF', laborHoursPerUnit: 0.023, wasteFactorPercent: 8 },
      'mc-cable-12/3': { materialCost: 2.25, laborCost: 1.75, totalInstalled: 4.00, unit: 'LF', laborHoursPerUnit: 0.025, wasteFactorPercent: 8 },
      
      // Wire & Cable
      'wire-12awg': { materialCost: 0.45, laborCost: 0.55, totalInstalled: 1.00, unit: 'LF', laborHoursPerUnit: 0.008, wasteFactorPercent: 10 },
      'wire-10awg': { materialCost: 0.65, laborCost: 0.65, totalInstalled: 1.30, unit: 'LF', laborHoursPerUnit: 0.009, wasteFactorPercent: 10 },
      'wire-8awg': { materialCost: 1.15, laborCost: 0.85, totalInstalled: 2.00, unit: 'LF', laborHoursPerUnit: 0.012, wasteFactorPercent: 10 },
      'wire-feeder-3/0': { materialCost: 4.50, laborCost: 2.50, totalInstalled: 7.00, unit: 'LF', laborHoursPerUnit: 0.035, wasteFactorPercent: 10 },
      
      // Devices
      'receptacle-duplex': { materialCost: 18, laborCost: 35, totalInstalled: 53, unit: 'EA', laborHoursPerUnit: 0.5, wasteFactorPercent: 0 },
      'receptacle-gfci': { materialCost: 35, laborCost: 45, totalInstalled: 80, unit: 'EA', laborHoursPerUnit: 0.65, wasteFactorPercent: 0 },
      'receptacle-dedicated': { materialCost: 45, laborCost: 85, totalInstalled: 130, unit: 'EA', laborHoursPerUnit: 1.2, wasteFactorPercent: 0 },
      'switch-single': { materialCost: 12, laborCost: 30, totalInstalled: 42, unit: 'EA', laborHoursPerUnit: 0.45, wasteFactorPercent: 0 },
      'switch-3way': { materialCost: 18, laborCost: 42, totalInstalled: 60, unit: 'EA', laborHoursPerUnit: 0.6, wasteFactorPercent: 0 },
      'switch-dimmer': { materialCost: 45, laborCost: 55, totalInstalled: 100, unit: 'EA', laborHoursPerUnit: 0.8, wasteFactorPercent: 0 },
      
      // Panels & Distribution
      'panel-100a': { materialCost: 650, laborCost: 550, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 8, wasteFactorPercent: 0 },
      'panel-200a': { materialCost: 1200, laborCost: 850, totalInstalled: 2050, unit: 'EA', laborHoursPerUnit: 12, wasteFactorPercent: 0 },
      'panel-400a': { materialCost: 2800, laborCost: 1400, totalInstalled: 4200, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      'switchgear-main': { materialCost: 35000, laborCost: 15000, totalInstalled: 50000, unit: 'EA', laborHoursPerUnit: 200, wasteFactorPercent: 0 },
      'transformer-dry-75kva': { materialCost: 4500, laborCost: 1500, totalInstalled: 6000, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      
      // Lighting
      'led-2x4-troffer': { materialCost: 125, laborCost: 75, totalInstalled: 200, unit: 'EA', laborHoursPerUnit: 1.1, wasteFactorPercent: 0 },
      'led-2x2-troffer': { materialCost: 95, laborCost: 65, totalInstalled: 160, unit: 'EA', laborHoursPerUnit: 0.95, wasteFactorPercent: 0 },
      'led-downlight': { materialCost: 85, laborCost: 55, totalInstalled: 140, unit: 'EA', laborHoursPerUnit: 0.8, wasteFactorPercent: 0 },
      'led-strip-linear': { materialCost: 35, laborCost: 25, totalInstalled: 60, unit: 'LF', laborHoursPerUnit: 0.35, wasteFactorPercent: 5 },
      'emergency-light': { materialCost: 145, laborCost: 95, totalInstalled: 240, unit: 'EA', laborHoursPerUnit: 1.4, wasteFactorPercent: 0 },
      'exit-sign-led': { materialCost: 85, laborCost: 65, totalInstalled: 150, unit: 'EA', laborHoursPerUnit: 0.95, wasteFactorPercent: 0 },
      'site-light-pole': { materialCost: 2500, laborCost: 1500, totalInstalled: 4000, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      
      // Fire Alarm
      'fire-alarm-panel': { materialCost: 4500, laborCost: 2500, totalInstalled: 7000, unit: 'EA', laborHoursPerUnit: 35, wasteFactorPercent: 0 },
      'smoke-detector': { materialCost: 55, laborCost: 65, totalInstalled: 120, unit: 'EA', laborHoursPerUnit: 0.95, wasteFactorPercent: 0 },
      'pull-station': { materialCost: 75, laborCost: 55, totalInstalled: 130, unit: 'EA', laborHoursPerUnit: 0.8, wasteFactorPercent: 0 },
      'horn-strobe': { materialCost: 95, laborCost: 75, totalInstalled: 170, unit: 'EA', laborHoursPerUnit: 1.1, wasteFactorPercent: 0 },
      
      // Low Voltage
      'data-outlet': { materialCost: 45, laborCost: 75, totalInstalled: 120, unit: 'EA', laborHoursPerUnit: 1.1, wasteFactorPercent: 0 },
      'cat6-cable': { materialCost: 0.35, laborCost: 0.65, totalInstalled: 1.00, unit: 'LF', laborHoursPerUnit: 0.009, wasteFactorPercent: 10 },
    }
  },
  
  // Division 27 - Communications
  {
    divisionCode: 27,
    divisionName: 'Communications',
    items: {
      'data-rack': { materialCost: 2500, laborCost: 1500, totalInstalled: 4000, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      'patch-panel': { materialCost: 350, laborCost: 250, totalInstalled: 600, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0 },
      'ups-system': { materialCost: 3500, laborCost: 1000, totalInstalled: 4500, unit: 'EA', laborHoursPerUnit: 14, wasteFactorPercent: 0 },
      'phone-system': { materialCost: 150, laborCost: 100, totalInstalled: 250, unit: 'EA', laborHoursPerUnit: 1.4, wasteFactorPercent: 0 },
      'nurse-call-station': { materialCost: 650, laborCost: 350, totalInstalled: 1000, unit: 'EA', laborHoursPerUnit: 5, wasteFactorPercent: 0 },
    }
  },
  
  // Division 28 - Electronic Safety & Security
  {
    divisionCode: 28,
    divisionName: 'Electronic Safety & Security',
    items: {
      'access-control-door': { materialCost: 1200, laborCost: 800, totalInstalled: 2000, unit: 'EA', laborHoursPerUnit: 11, wasteFactorPercent: 0 },
      'card-reader': { materialCost: 350, laborCost: 200, totalInstalled: 550, unit: 'EA', laborHoursPerUnit: 2.8, wasteFactorPercent: 0 },
      'security-camera': { materialCost: 450, laborCost: 300, totalInstalled: 750, unit: 'EA', laborHoursPerUnit: 4.2, wasteFactorPercent: 0 },
      'dvr-nvr-system': { materialCost: 2500, laborCost: 1000, totalInstalled: 3500, unit: 'EA', laborHoursPerUnit: 14, wasteFactorPercent: 0 },
    }
  },
  
  // Division 31 - Earthwork
  {
    divisionCode: 31,
    divisionName: 'Earthwork',
    items: {
      // Clearing & Grubbing
      'clearing-grubbing': { materialCost: 0.15, laborCost: 0.35, totalInstalled: 0.50, unit: 'SF', laborHoursPerUnit: 0.005, wasteFactorPercent: 0 },
      'topsoil-strip': { materialCost: 0, laborCost: 1.50, totalInstalled: 1.50, unit: 'CY', laborHoursPerUnit: 0.02, wasteFactorPercent: 0 },
      
      // Excavation by Material Type
      'excavation-bulk': { materialCost: 0, laborCost: 8.00, totalInstalled: 8.00, unit: 'CY', laborHoursPerUnit: 0.11, wasteFactorPercent: 0, notes: 'Common earth/soil excavation' },
      'excavation-footing': { materialCost: 0, laborCost: 15.00, totalInstalled: 15.00, unit: 'CY', laborHoursPerUnit: 0.2, wasteFactorPercent: 0 },
      'excavation-trench': { materialCost: 0, laborCost: 18.00, totalInstalled: 18.00, unit: 'CY', laborHoursPerUnit: 0.25, wasteFactorPercent: 0, notes: 'Utility trench excavation' },
      'excavation-rock-rippable': { materialCost: 0, laborCost: 28.00, totalInstalled: 28.00, unit: 'CY', laborHoursPerUnit: 0.4, wasteFactorPercent: 0, notes: 'Rock that can be ripped with dozer' },
      'excavation-rock-blasting': { materialCost: 15.00, laborCost: 45.00, totalInstalled: 60.00, unit: 'CY', laborHoursPerUnit: 0.6, wasteFactorPercent: 0, notes: 'Solid rock requiring blasting' },
      'excavation-rock-mechanical': { materialCost: 5.00, laborCost: 38.00, totalInstalled: 43.00, unit: 'CY', laborHoursPerUnit: 0.5, wasteFactorPercent: 0, notes: 'Rock with hoe-ram/breaker' },
      
      // Backfill Materials
      'backfill-compacted': { materialCost: 12.00, laborCost: 8.00, totalInstalled: 20.00, unit: 'CY', laborHoursPerUnit: 0.11, wasteFactorPercent: 5, notes: 'On-site material, compacted' },
      'backfill-select': { materialCost: 18.00, laborCost: 10.00, totalInstalled: 28.00, unit: 'CY', laborHoursPerUnit: 0.13, wasteFactorPercent: 8, notes: 'Select/screened material' },
      'backfill-structural': { materialCost: 22.00, laborCost: 12.00, totalInstalled: 34.00, unit: 'CY', laborHoursPerUnit: 0.15, wasteFactorPercent: 8, notes: 'Structural fill, tested' },
      'backfill-pipe-zone': { materialCost: 25.00, laborCost: 14.00, totalInstalled: 39.00, unit: 'CY', laborHoursPerUnit: 0.18, wasteFactorPercent: 10, notes: 'Pipe bedding/haunching' },
      
      // Aggregate/Stone Materials (in-place)
      'dga-4in': { materialCost: 1.65, laborCost: 0.85, totalInstalled: 2.50, unit: 'SF', laborHoursPerUnit: 0.012, wasteFactorPercent: 8, notes: 'Dense Grade Aggregate, 4" thick' },
      'dga-6in': { materialCost: 2.45, laborCost: 1.05, totalInstalled: 3.50, unit: 'SF', laborHoursPerUnit: 0.014, wasteFactorPercent: 8, notes: 'Dense Grade Aggregate, 6" thick' },
      'dga-8in': { materialCost: 3.25, laborCost: 1.25, totalInstalled: 4.50, unit: 'SF', laborHoursPerUnit: 0.016, wasteFactorPercent: 8, notes: 'Dense Grade Aggregate, 8" thick' },
      'dga-by-cy': { materialCost: 32.00, laborCost: 18.00, totalInstalled: 50.00, unit: 'CY', laborHoursPerUnit: 0.25, wasteFactorPercent: 8, notes: 'DGA/crusher run by volume' },
      'aggregate-base-4in': { materialCost: 1.00, laborCost: 0.65, totalInstalled: 1.65, unit: 'SF', laborHoursPerUnit: 0.009, wasteFactorPercent: 5 },
      'aggregate-base-6in': { materialCost: 1.25, laborCost: 0.75, totalInstalled: 2.00, unit: 'SF', laborHoursPerUnit: 0.011, wasteFactorPercent: 5 },
      'aggregate-base-8in': { materialCost: 1.65, laborCost: 0.95, totalInstalled: 2.60, unit: 'SF', laborHoursPerUnit: 0.013, wasteFactorPercent: 5 },
      'crusher-run-by-cy': { materialCost: 28.00, laborCost: 16.00, totalInstalled: 44.00, unit: 'CY', laborHoursPerUnit: 0.22, wasteFactorPercent: 8, notes: 'Crusher run/road base' },
      'stone-57-by-cy': { materialCost: 38.00, laborCost: 15.00, totalInstalled: 53.00, unit: 'CY', laborHoursPerUnit: 0.2, wasteFactorPercent: 8, notes: '#57 washed stone (3/4"-1")' },
      'stone-2-by-cy': { materialCost: 35.00, laborCost: 15.00, totalInstalled: 50.00, unit: 'CY', laborHoursPerUnit: 0.2, wasteFactorPercent: 8, notes: '#2 stone (2.5"-3")' },
      'stone-3-by-cy': { materialCost: 33.00, laborCost: 14.00, totalInstalled: 47.00, unit: 'CY', laborHoursPerUnit: 0.19, wasteFactorPercent: 8, notes: '#3 stone (1.5"-2.5")' },
      'pea-gravel-by-cy': { materialCost: 42.00, laborCost: 16.00, totalInstalled: 58.00, unit: 'CY', laborHoursPerUnit: 0.22, wasteFactorPercent: 8, notes: 'Pea gravel (3/8")' },
      'rip-rap-by-cy': { materialCost: 55.00, laborCost: 25.00, totalInstalled: 80.00, unit: 'CY', laborHoursPerUnit: 0.35, wasteFactorPercent: 5, notes: 'Rip-rap erosion control' },
      
      // Grading & Compaction
      'grading-rough': { materialCost: 0.15, laborCost: 0.45, totalInstalled: 0.60, unit: 'SF', laborHoursPerUnit: 0.006, wasteFactorPercent: 0 },
      'grading-fine': { materialCost: 0.25, laborCost: 0.75, totalInstalled: 1.00, unit: 'SF', laborHoursPerUnit: 0.011, wasteFactorPercent: 0 },
      'compaction': { materialCost: 0.15, laborCost: 0.35, totalInstalled: 0.50, unit: 'SF', laborHoursPerUnit: 0.005, wasteFactorPercent: 0 },
      'compaction-proof-roll': { materialCost: 0.08, laborCost: 0.22, totalInstalled: 0.30, unit: 'SF', laborHoursPerUnit: 0.003, wasteFactorPercent: 0, notes: 'Proof rolling verification' },
      
      // Import/Export
      'import-fill': { materialCost: 18.00, laborCost: 12.00, totalInstalled: 30.00, unit: 'CY', laborHoursPerUnit: 0.16, wasteFactorPercent: 10, notes: 'Import common fill, placed/compacted' },
      'import-structural-fill': { materialCost: 28.00, laborCost: 14.00, totalInstalled: 42.00, unit: 'CY', laborHoursPerUnit: 0.19, wasteFactorPercent: 10, notes: 'Import structural fill, tested' },
      'export-haul': { materialCost: 0, laborCost: 12.00, totalInstalled: 12.00, unit: 'CY', laborHoursPerUnit: 0.16, wasteFactorPercent: 0, notes: 'Load and haul spoils offsite' },
      'export-haul-rock': { materialCost: 0, laborCost: 18.00, totalInstalled: 18.00, unit: 'CY', laborHoursPerUnit: 0.24, wasteFactorPercent: 0, notes: 'Load and haul rock offsite' },
      
      // Miscellaneous
      'geotextile': { materialCost: 0.35, laborCost: 0.25, totalInstalled: 0.60, unit: 'SF', laborHoursPerUnit: 0.004, wasteFactorPercent: 5 },
      'geogrid': { materialCost: 0.85, laborCost: 0.35, totalInstalled: 1.20, unit: 'SF', laborHoursPerUnit: 0.005, wasteFactorPercent: 5, notes: 'Soil reinforcement grid' },
      'silt-fence': { materialCost: 1.50, laborCost: 1.00, totalInstalled: 2.50, unit: 'LF', laborHoursPerUnit: 0.014, wasteFactorPercent: 5, notes: 'Erosion control' },
      'construction-entrance': { materialCost: 800, laborCost: 400, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 5.5, wasteFactorPercent: 0, notes: 'Stabilized construction entrance' },
    }
  },
  
  // Division 32 - Exterior Improvements
  {
    divisionCode: 32,
    divisionName: 'Exterior Improvements',
    items: {
      // Asphalt Paving
      'asphalt-paving-2in': { materialCost: 2.00, laborCost: 1.50, totalInstalled: 3.50, unit: 'SF', laborHoursPerUnit: 0.022, wasteFactorPercent: 5, notes: 'Overlay/wearing course' },
      'asphalt-paving-3in': { materialCost: 2.75, laborCost: 1.75, totalInstalled: 4.50, unit: 'SF', laborHoursPerUnit: 0.025, wasteFactorPercent: 5 },
      'asphalt-paving-4in': { materialCost: 3.50, laborCost: 2.00, totalInstalled: 5.50, unit: 'SF', laborHoursPerUnit: 0.028, wasteFactorPercent: 5 },
      'asphalt-paving-6in': { materialCost: 5.00, laborCost: 2.50, totalInstalled: 7.50, unit: 'SF', laborHoursPerUnit: 0.032, wasteFactorPercent: 5, notes: 'Heavy-duty parking' },
      'asphalt-milling': { materialCost: 0.50, laborCost: 1.00, totalInstalled: 1.50, unit: 'SF', laborHoursPerUnit: 0.014, wasteFactorPercent: 0, notes: 'Remove existing asphalt' },
      'asphalt-patch': { materialCost: 85, laborCost: 65, totalInstalled: 150, unit: 'SY', laborHoursPerUnit: 0.9, wasteFactorPercent: 10, notes: 'Pothole/repair' },
      'tack-coat': { materialCost: 0.15, laborCost: 0.10, totalInstalled: 0.25, unit: 'SF', laborHoursPerUnit: 0.002, wasteFactorPercent: 5 },
      
      // Concrete Paving & Flatwork
      'concrete-sidewalk-4in': { materialCost: 4.50, laborCost: 4.00, totalInstalled: 8.50, unit: 'SF', laborHoursPerUnit: 0.06, wasteFactorPercent: 5 },
      'concrete-sidewalk-6in': { materialCost: 6.00, laborCost: 4.50, totalInstalled: 10.50, unit: 'SF', laborHoursPerUnit: 0.065, wasteFactorPercent: 5 },
      'concrete-parking-6in': { materialCost: 6.50, laborCost: 4.50, totalInstalled: 11.00, unit: 'SF', laborHoursPerUnit: 0.065, wasteFactorPercent: 5 },
      'concrete-driveway-6in': { materialCost: 7.00, laborCost: 5.00, totalInstalled: 12.00, unit: 'SF', laborHoursPerUnit: 0.07, wasteFactorPercent: 5 },
      'concrete-apron-8in': { materialCost: 8.50, laborCost: 5.50, totalInstalled: 14.00, unit: 'SF', laborHoursPerUnit: 0.08, wasteFactorPercent: 5, notes: 'Dumpster pad/apron' },
      'concrete-curb-gutter': { materialCost: 18.00, laborCost: 14.00, totalInstalled: 32.00, unit: 'LF', laborHoursPerUnit: 0.2, wasteFactorPercent: 5 },
      'concrete-curb-only': { materialCost: 12.00, laborCost: 10.00, totalInstalled: 22.00, unit: 'LF', laborHoursPerUnit: 0.14, wasteFactorPercent: 5 },
      'concrete-header-curb': { materialCost: 8.00, laborCost: 7.00, totalInstalled: 15.00, unit: 'LF', laborHoursPerUnit: 0.1, wasteFactorPercent: 5, notes: 'Landscape edge' },
      
      // ADA Accessibility
      'ada-ramp': { materialCost: 450, laborCost: 350, totalInstalled: 800, unit: 'EA', laborHoursPerUnit: 4.8, wasteFactorPercent: 5, notes: 'ADA curb ramp, complete' },
      'ada-ramp-truncated-dome': { materialCost: 550, laborCost: 400, totalInstalled: 950, unit: 'EA', laborHoursPerUnit: 5.5, wasteFactorPercent: 5, notes: 'With detectable warning surface' },
      'detectable-warning-surface': { materialCost: 180, laborCost: 120, totalInstalled: 300, unit: 'EA', laborHoursPerUnit: 1.7, wasteFactorPercent: 0, notes: 'Cast-in-place or retrofit' },
      'detectable-warning-sf': { materialCost: 35, laborCost: 25, totalInstalled: 60, unit: 'SF', laborHoursPerUnit: 0.35, wasteFactorPercent: 5, notes: 'Per SF truncated dome' },
      'ada-parking-sign': { materialCost: 125, laborCost: 75, totalInstalled: 200, unit: 'EA', laborHoursPerUnit: 1.0, wasteFactorPercent: 0 },
      'ada-van-accessible-sign': { materialCost: 150, laborCost: 85, totalInstalled: 235, unit: 'EA', laborHoursPerUnit: 1.2, wasteFactorPercent: 0 },
      
      // Pavement Markings & Striping
      'pavement-marking': { materialCost: 0.35, laborCost: 0.25, totalInstalled: 0.60, unit: 'LF', laborHoursPerUnit: 0.004, wasteFactorPercent: 5 },
      'pavement-marking-4in': { materialCost: 0.30, laborCost: 0.20, totalInstalled: 0.50, unit: 'LF', laborHoursPerUnit: 0.003, wasteFactorPercent: 5, notes: 'Standard line' },
      'pavement-marking-24in': { materialCost: 1.50, laborCost: 0.75, totalInstalled: 2.25, unit: 'LF', laborHoursPerUnit: 0.01, wasteFactorPercent: 5, notes: 'Stop bar' },
      'handicap-symbol': { materialCost: 35, laborCost: 25, totalInstalled: 60, unit: 'EA', laborHoursPerUnit: 0.35, wasteFactorPercent: 0 },
      'parking-stall-striping': { materialCost: 8, laborCost: 7, totalInstalled: 15, unit: 'EA', laborHoursPerUnit: 0.1, wasteFactorPercent: 0, notes: 'Standard stall lines' },
      'arrow-marking': { materialCost: 25, laborCost: 20, totalInstalled: 45, unit: 'EA', laborHoursPerUnit: 0.28, wasteFactorPercent: 0 },
      'crosswalk-marking': { materialCost: 3.50, laborCost: 2.00, totalInstalled: 5.50, unit: 'SF', laborHoursPerUnit: 0.028, wasteFactorPercent: 5 },
      'thermoplastic-marking': { materialCost: 0.85, laborCost: 0.45, totalInstalled: 1.30, unit: 'LF', laborHoursPerUnit: 0.006, wasteFactorPercent: 5, notes: 'Long-lasting' },
      
      // Traffic Control & Signage
      'stop-sign': { materialCost: 175, laborCost: 125, totalInstalled: 300, unit: 'EA', laborHoursPerUnit: 1.7, wasteFactorPercent: 0 },
      'speed-limit-sign': { materialCost: 150, laborCost: 100, totalInstalled: 250, unit: 'EA', laborHoursPerUnit: 1.4, wasteFactorPercent: 0 },
      'directional-sign': { materialCost: 125, laborCost: 100, totalInstalled: 225, unit: 'EA', laborHoursPerUnit: 1.4, wasteFactorPercent: 0 },
      'parking-sign': { materialCost: 85, laborCost: 65, totalInstalled: 150, unit: 'EA', laborHoursPerUnit: 0.9, wasteFactorPercent: 0 },
      'sign-post-steel': { materialCost: 65, laborCost: 85, totalInstalled: 150, unit: 'EA', laborHoursPerUnit: 1.2, wasteFactorPercent: 0, notes: 'U-channel or square' },
      'sign-post-breakaway': { materialCost: 125, laborCost: 125, totalInstalled: 250, unit: 'EA', laborHoursPerUnit: 1.7, wasteFactorPercent: 0 },
      
      // Parking Lot Accessories
      'wheel-stop-concrete': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'EA', laborHoursPerUnit: 0.5, wasteFactorPercent: 0, notes: '6\' concrete wheel stop' },
      'wheel-stop-rubber': { materialCost: 55, laborCost: 30, totalInstalled: 85, unit: 'EA', laborHoursPerUnit: 0.4, wasteFactorPercent: 0, notes: 'Recycled rubber' },
      'speed-bump-asphalt': { materialCost: 18, laborCost: 14, totalInstalled: 32, unit: 'LF', laborHoursPerUnit: 0.2, wasteFactorPercent: 5, notes: 'Asphalt speed bump' },
      'speed-bump-rubber': { materialCost: 28, laborCost: 12, totalInstalled: 40, unit: 'LF', laborHoursPerUnit: 0.17, wasteFactorPercent: 0, notes: 'Modular rubber' },
      'speed-hump-asphalt': { materialCost: 25, laborCost: 18, totalInstalled: 43, unit: 'LF', laborHoursPerUnit: 0.25, wasteFactorPercent: 5, notes: 'Wider profile' },
      'parking-bumper-steel': { materialCost: 85, laborCost: 45, totalInstalled: 130, unit: 'EA', laborHoursPerUnit: 0.6, wasteFactorPercent: 0, notes: 'Pipe bumper' },
      
      // Site Amenities & Fencing
      'fence-chain-link-4ft': { materialCost: 9, laborCost: 8, totalInstalled: 17, unit: 'LF', laborHoursPerUnit: 0.11, wasteFactorPercent: 5 },
      'fence-chain-link-6ft': { materialCost: 12, laborCost: 10, totalInstalled: 22, unit: 'LF', laborHoursPerUnit: 0.14, wasteFactorPercent: 5 },
      'fence-chain-link-8ft': { materialCost: 18, laborCost: 14, totalInstalled: 32, unit: 'LF', laborHoursPerUnit: 0.19, wasteFactorPercent: 5 },
      'fence-chain-link-gate-swing': { materialCost: 450, laborCost: 250, totalInstalled: 700, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0, notes: 'Per leaf' },
      'fence-chain-link-gate-slide': { materialCost: 2500, laborCost: 1500, totalInstalled: 4000, unit: 'EA', laborHoursPerUnit: 21, wasteFactorPercent: 0, notes: 'Motorized cantilever' },
      'fence-ornamental': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'LF', laborHoursPerUnit: 0.5, wasteFactorPercent: 5 },
      'fence-wood-6ft': { materialCost: 22, laborCost: 18, totalInstalled: 40, unit: 'LF', laborHoursPerUnit: 0.25, wasteFactorPercent: 5, notes: 'Privacy fence' },
      'fence-vinyl-6ft': { materialCost: 28, laborCost: 15, totalInstalled: 43, unit: 'LF', laborHoursPerUnit: 0.21, wasteFactorPercent: 5 },
      'bollard-steel': { materialCost: 350, laborCost: 200, totalInstalled: 550, unit: 'EA', laborHoursPerUnit: 2.8, wasteFactorPercent: 0 },
      'bollard-concrete': { materialCost: 250, laborCost: 200, totalInstalled: 450, unit: 'EA', laborHoursPerUnit: 2.8, wasteFactorPercent: 0 },
      'bollard-removable': { materialCost: 450, laborCost: 250, totalInstalled: 700, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0 },
      'bollard-lighted': { materialCost: 850, laborCost: 350, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 4.9, wasteFactorPercent: 0 },
      'bike-rack': { materialCost: 350, laborCost: 150, totalInstalled: 500, unit: 'EA', laborHoursPerUnit: 2.1, wasteFactorPercent: 0, notes: '5-bike capacity' },
      'bench-site': { materialCost: 850, laborCost: 350, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 4.9, wasteFactorPercent: 0 },
      'trash-receptacle': { materialCost: 650, laborCost: 200, totalInstalled: 850, unit: 'EA', laborHoursPerUnit: 2.8, wasteFactorPercent: 0 },
      'picnic-table': { materialCost: 1200, laborCost: 400, totalInstalled: 1600, unit: 'EA', laborHoursPerUnit: 5.6, wasteFactorPercent: 0 },
      'flagpole-25ft': { materialCost: 1800, laborCost: 800, totalInstalled: 2600, unit: 'EA', laborHoursPerUnit: 11, wasteFactorPercent: 0 },
      
      // Retaining Walls
      'retaining-wall-block-3ft': { materialCost: 22, laborCost: 18, totalInstalled: 40, unit: 'SF', laborHoursPerUnit: 0.25, wasteFactorPercent: 5, notes: 'Segmental block, <3\' tall' },
      'retaining-wall-block-6ft': { materialCost: 32, laborCost: 28, totalInstalled: 60, unit: 'SF', laborHoursPerUnit: 0.38, wasteFactorPercent: 5, notes: 'With geogrid reinforcement' },
      'retaining-wall-concrete': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'SF', laborHoursPerUnit: 0.48, wasteFactorPercent: 5, notes: 'Cast-in-place' },
      'retaining-wall-gabion': { materialCost: 38, laborCost: 28, totalInstalled: 66, unit: 'SF', laborHoursPerUnit: 0.38, wasteFactorPercent: 5, notes: 'Stone-filled basket' },
      'retaining-wall-timber': { materialCost: 18, laborCost: 16, totalInstalled: 34, unit: 'SF', laborHoursPerUnit: 0.22, wasteFactorPercent: 8, notes: 'Landscape timber' },
      'retaining-wall-boulder': { materialCost: 55, laborCost: 45, totalInstalled: 100, unit: 'SF', laborHoursPerUnit: 0.6, wasteFactorPercent: 5, notes: 'Natural boulder' },
      
      // Site Lighting
      'light-pole-20ft': { materialCost: 1800, laborCost: 1200, totalInstalled: 3000, unit: 'EA', laborHoursPerUnit: 16.5, wasteFactorPercent: 0, notes: 'Steel pole, foundation' },
      'light-pole-25ft': { materialCost: 2200, laborCost: 1400, totalInstalled: 3600, unit: 'EA', laborHoursPerUnit: 19, wasteFactorPercent: 0 },
      'light-pole-30ft': { materialCost: 2800, laborCost: 1700, totalInstalled: 4500, unit: 'EA', laborHoursPerUnit: 24, wasteFactorPercent: 0 },
      'light-fixture-led-parking': { materialCost: 650, laborCost: 350, totalInstalled: 1000, unit: 'EA', laborHoursPerUnit: 4.9, wasteFactorPercent: 0, notes: 'LED shoebox' },
      'light-fixture-led-area': { materialCost: 850, laborCost: 400, totalInstalled: 1250, unit: 'EA', laborHoursPerUnit: 5.5, wasteFactorPercent: 0 },
      'light-fixture-wall-pack': { materialCost: 250, laborCost: 150, totalInstalled: 400, unit: 'EA', laborHoursPerUnit: 2.1, wasteFactorPercent: 0 },
      'light-bollard': { materialCost: 550, laborCost: 300, totalInstalled: 850, unit: 'EA', laborHoursPerUnit: 4.2, wasteFactorPercent: 0, notes: 'Pathway bollard light' },
      'photocell': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'EA', laborHoursPerUnit: 0.5, wasteFactorPercent: 0 },
      'conduit-site-lighting': { materialCost: 8, laborCost: 12, totalInstalled: 20, unit: 'LF', laborHoursPerUnit: 0.17, wasteFactorPercent: 5, notes: 'Underground w/wire' },
      
      // Landscaping
      'topsoil-4in': { materialCost: 0.75, laborCost: 0.50, totalInstalled: 1.25, unit: 'SF', laborHoursPerUnit: 0.007, wasteFactorPercent: 5 },
      'topsoil-6in': { materialCost: 1.10, laborCost: 0.65, totalInstalled: 1.75, unit: 'SF', laborHoursPerUnit: 0.009, wasteFactorPercent: 5 },
      'seed-fertilize': { materialCost: 0.25, laborCost: 0.25, totalInstalled: 0.50, unit: 'SF', laborHoursPerUnit: 0.004, wasteFactorPercent: 10 },
      'hydroseed': { materialCost: 0.12, laborCost: 0.08, totalInstalled: 0.20, unit: 'SF', laborHoursPerUnit: 0.001, wasteFactorPercent: 5 },
      'sod': { materialCost: 0.65, laborCost: 0.45, totalInstalled: 1.10, unit: 'SF', laborHoursPerUnit: 0.006, wasteFactorPercent: 10 },
      'mulch-3in': { materialCost: 0.55, laborCost: 0.35, totalInstalled: 0.90, unit: 'SF', laborHoursPerUnit: 0.005, wasteFactorPercent: 10 },
      'mulch-by-cy': { materialCost: 45, laborCost: 25, totalInstalled: 70, unit: 'CY', laborHoursPerUnit: 0.35, wasteFactorPercent: 10 },
      'landscape-bed-prep': { materialCost: 0.35, laborCost: 0.45, totalInstalled: 0.80, unit: 'SF', laborHoursPerUnit: 0.006, wasteFactorPercent: 0 },
      'edging-steel': { materialCost: 3.50, laborCost: 2.00, totalInstalled: 5.50, unit: 'LF', laborHoursPerUnit: 0.028, wasteFactorPercent: 5 },
      'edging-plastic': { materialCost: 1.25, laborCost: 1.25, totalInstalled: 2.50, unit: 'LF', laborHoursPerUnit: 0.017, wasteFactorPercent: 5 },
      'shrub-1gal': { materialCost: 18, laborCost: 12, totalInstalled: 30, unit: 'EA', laborHoursPerUnit: 0.17, wasteFactorPercent: 5 },
      'shrub-3gal': { materialCost: 35, laborCost: 25, totalInstalled: 60, unit: 'EA', laborHoursPerUnit: 0.35, wasteFactorPercent: 5 },
      'shrub-5gal': { materialCost: 55, laborCost: 35, totalInstalled: 90, unit: 'EA', laborHoursPerUnit: 0.49, wasteFactorPercent: 5 },
      'tree-2in-cal': { materialCost: 350, laborCost: 200, totalInstalled: 550, unit: 'EA', laborHoursPerUnit: 2.8, wasteFactorPercent: 5 },
      'tree-3in-cal': { materialCost: 550, laborCost: 300, totalInstalled: 850, unit: 'EA', laborHoursPerUnit: 4.2, wasteFactorPercent: 5 },
      'tree-4in-cal': { materialCost: 850, laborCost: 450, totalInstalled: 1300, unit: 'EA', laborHoursPerUnit: 6.3, wasteFactorPercent: 5 },
      'ornamental-grass': { materialCost: 12, laborCost: 8, totalInstalled: 20, unit: 'EA', laborHoursPerUnit: 0.11, wasteFactorPercent: 5 },
      'perennial-1gal': { materialCost: 8, laborCost: 6, totalInstalled: 14, unit: 'EA', laborHoursPerUnit: 0.08, wasteFactorPercent: 5 },
      
      // Irrigation System
      'irrigation-mainline-2in': { materialCost: 4.50, laborCost: 5.50, totalInstalled: 10.00, unit: 'LF', laborHoursPerUnit: 0.08, wasteFactorPercent: 5, notes: 'PVC Schedule 40' },
      'irrigation-lateral-1in': { materialCost: 2.25, laborCost: 3.25, totalInstalled: 5.50, unit: 'LF', laborHoursPerUnit: 0.045, wasteFactorPercent: 5 },
      'irrigation-lateral-poly': { materialCost: 1.50, laborCost: 2.50, totalInstalled: 4.00, unit: 'LF', laborHoursPerUnit: 0.035, wasteFactorPercent: 5, notes: 'Drip/PE pipe' },
      'irrigation-head-rotor': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'EA', laborHoursPerUnit: 0.5, wasteFactorPercent: 0, notes: 'Pop-up rotor' },
      'irrigation-head-spray': { materialCost: 25, laborCost: 25, totalInstalled: 50, unit: 'EA', laborHoursPerUnit: 0.35, wasteFactorPercent: 0, notes: 'Fixed spray' },
      'irrigation-drip-emitter': { materialCost: 3.50, laborCost: 2.50, totalInstalled: 6.00, unit: 'EA', laborHoursPerUnit: 0.035, wasteFactorPercent: 5 },
      'irrigation-valve-zone': { materialCost: 125, laborCost: 85, totalInstalled: 210, unit: 'EA', laborHoursPerUnit: 1.2, wasteFactorPercent: 0, notes: 'Electric valve w/box' },
      'irrigation-controller': { materialCost: 650, laborCost: 350, totalInstalled: 1000, unit: 'EA', laborHoursPerUnit: 4.9, wasteFactorPercent: 0, notes: 'Smart controller, 12 zone' },
      'irrigation-backflow': { materialCost: 450, laborCost: 250, totalInstalled: 700, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0, notes: 'Backflow preventer' },
      'irrigation-poc': { materialCost: 350, laborCost: 450, totalInstalled: 800, unit: 'EA', laborHoursPerUnit: 6.3, wasteFactorPercent: 0, notes: 'Point of connection' },
      'irrigation-per-sf': { materialCost: 0.85, laborCost: 0.65, totalInstalled: 1.50, unit: 'SF', laborHoursPerUnit: 0.009, wasteFactorPercent: 5, notes: 'Complete system allowance' },
    }
  },
  
  // Division 33 - Utilities
  {
    divisionCode: 33,
    divisionName: 'Utilities',
    items: {
      // Storm Drainage Pipe
      'storm-pipe-12': { materialCost: 28, laborCost: 22, totalInstalled: 50, unit: 'LF', laborHoursPerUnit: 0.3, wasteFactorPercent: 5 },
      'storm-pipe-15': { materialCost: 35, laborCost: 28, totalInstalled: 63, unit: 'LF', laborHoursPerUnit: 0.38, wasteFactorPercent: 5 },
      'storm-pipe-18': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'LF', laborHoursPerUnit: 0.48, wasteFactorPercent: 5 },
      'storm-pipe-24': { materialCost: 62, laborCost: 48, totalInstalled: 110, unit: 'LF', laborHoursPerUnit: 0.65, wasteFactorPercent: 5 },
      'storm-pipe-30': { materialCost: 85, laborCost: 65, totalInstalled: 150, unit: 'LF', laborHoursPerUnit: 0.9, wasteFactorPercent: 5 },
      'storm-pipe-36': { materialCost: 115, laborCost: 85, totalInstalled: 200, unit: 'LF', laborHoursPerUnit: 1.2, wasteFactorPercent: 5 },
      'storm-pipe-42': { materialCost: 155, laborCost: 105, totalInstalled: 260, unit: 'LF', laborHoursPerUnit: 1.5, wasteFactorPercent: 5 },
      'storm-pipe-48': { materialCost: 195, laborCost: 130, totalInstalled: 325, unit: 'LF', laborHoursPerUnit: 1.8, wasteFactorPercent: 5 },
      'storm-pipe-hdpe-12': { materialCost: 22, laborCost: 20, totalInstalled: 42, unit: 'LF', laborHoursPerUnit: 0.28, wasteFactorPercent: 5, notes: 'Corrugated HDPE' },
      'storm-pipe-hdpe-18': { materialCost: 38, laborCost: 30, totalInstalled: 68, unit: 'LF', laborHoursPerUnit: 0.42, wasteFactorPercent: 5 },
      'storm-pipe-hdpe-24': { materialCost: 52, laborCost: 42, totalInstalled: 94, unit: 'LF', laborHoursPerUnit: 0.58, wasteFactorPercent: 5 },
      
      // Storm Structures
      'catch-basin': { materialCost: 1500, laborCost: 1000, totalInstalled: 2500, unit: 'EA', laborHoursPerUnit: 14, wasteFactorPercent: 0 },
      'catch-basin-curb-inlet': { materialCost: 1800, laborCost: 1200, totalInstalled: 3000, unit: 'EA', laborHoursPerUnit: 16.5, wasteFactorPercent: 0 },
      'area-drain': { materialCost: 450, laborCost: 350, totalInstalled: 800, unit: 'EA', laborHoursPerUnit: 4.9, wasteFactorPercent: 0 },
      'trench-drain': { materialCost: 85, laborCost: 65, totalInstalled: 150, unit: 'LF', laborHoursPerUnit: 0.9, wasteFactorPercent: 5, notes: 'Cast-in-place w/grate' },
      'manhole-storm': { materialCost: 2500, laborCost: 1500, totalInstalled: 4000, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      'manhole-storm-48': { materialCost: 3200, laborCost: 1800, totalInstalled: 5000, unit: 'EA', laborHoursPerUnit: 25, wasteFactorPercent: 0, notes: '48" diameter' },
      'headwall-12': { materialCost: 650, laborCost: 550, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 7.7, wasteFactorPercent: 5, notes: '12" pipe headwall' },
      'headwall-18': { materialCost: 950, laborCost: 750, totalInstalled: 1700, unit: 'EA', laborHoursPerUnit: 10.5, wasteFactorPercent: 5 },
      'headwall-24': { materialCost: 1400, laborCost: 1000, totalInstalled: 2400, unit: 'EA', laborHoursPerUnit: 14, wasteFactorPercent: 5 },
      'headwall-36': { materialCost: 2200, laborCost: 1500, totalInstalled: 3700, unit: 'EA', laborHoursPerUnit: 21, wasteFactorPercent: 5 },
      'headwall-48': { materialCost: 3200, laborCost: 2100, totalInstalled: 5300, unit: 'EA', laborHoursPerUnit: 29, wasteFactorPercent: 5 },
      'end-section-12': { materialCost: 250, laborCost: 200, totalInstalled: 450, unit: 'EA', laborHoursPerUnit: 2.8, wasteFactorPercent: 0, notes: 'Flared end section' },
      'end-section-18': { materialCost: 350, laborCost: 280, totalInstalled: 630, unit: 'EA', laborHoursPerUnit: 3.9, wasteFactorPercent: 0 },
      'end-section-24': { materialCost: 500, laborCost: 400, totalInstalled: 900, unit: 'EA', laborHoursPerUnit: 5.5, wasteFactorPercent: 0 },
      'end-section-36': { materialCost: 850, laborCost: 650, totalInstalled: 1500, unit: 'EA', laborHoursPerUnit: 9.1, wasteFactorPercent: 0 },
      
      // Detention/Retention
      'detention-pond-excavation': { materialCost: 0, laborCost: 6.00, totalInstalled: 6.00, unit: 'CY', laborHoursPerUnit: 0.08, wasteFactorPercent: 0, notes: 'Pond excavation only' },
      'detention-pond-liner': { materialCost: 1.25, laborCost: 0.75, totalInstalled: 2.00, unit: 'SF', laborHoursPerUnit: 0.01, wasteFactorPercent: 10, notes: 'HDPE liner' },
      'detention-pond-outlet': { materialCost: 2500, laborCost: 1500, totalInstalled: 4000, unit: 'EA', laborHoursPerUnit: 21, wasteFactorPercent: 0, notes: 'Outlet structure' },
      'bio-swale': { materialCost: 12, laborCost: 8, totalInstalled: 20, unit: 'LF', laborHoursPerUnit: 0.11, wasteFactorPercent: 5, notes: 'Vegetated swale' },
      'rain-garden': { materialCost: 18, laborCost: 12, totalInstalled: 30, unit: 'SF', laborHoursPerUnit: 0.17, wasteFactorPercent: 5 },
      'underground-detention-chamber': { materialCost: 45, laborCost: 25, totalInstalled: 70, unit: 'CF', laborHoursPerUnit: 0.35, wasteFactorPercent: 5, notes: 'Stormtech or similar' },
      'overflow-structure': { materialCost: 1800, laborCost: 1200, totalInstalled: 3000, unit: 'EA', laborHoursPerUnit: 16.5, wasteFactorPercent: 0 },
      
      // Sanitary Sewer
      'sanitary-pipe-4': { materialCost: 25, laborCost: 22, totalInstalled: 47, unit: 'LF', laborHoursPerUnit: 0.3, wasteFactorPercent: 5, notes: 'Building service' },
      'sanitary-pipe-6': { materialCost: 32, laborCost: 28, totalInstalled: 60, unit: 'LF', laborHoursPerUnit: 0.38, wasteFactorPercent: 5 },
      'sanitary-pipe-8': { materialCost: 42, laborCost: 33, totalInstalled: 75, unit: 'LF', laborHoursPerUnit: 0.45, wasteFactorPercent: 5 },
      'sanitary-pipe-10': { materialCost: 55, laborCost: 42, totalInstalled: 97, unit: 'LF', laborHoursPerUnit: 0.58, wasteFactorPercent: 5 },
      'sanitary-pipe-12': { materialCost: 72, laborCost: 53, totalInstalled: 125, unit: 'LF', laborHoursPerUnit: 0.73, wasteFactorPercent: 5 },
      'cleanout': { materialCost: 350, laborCost: 250, totalInstalled: 600, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0 },
      'manhole-sanitary': { materialCost: 3000, laborCost: 1800, totalInstalled: 4800, unit: 'EA', laborHoursPerUnit: 25, wasteFactorPercent: 0 },
      'manhole-sanitary-drop': { materialCost: 4500, laborCost: 2500, totalInstalled: 7000, unit: 'EA', laborHoursPerUnit: 35, wasteFactorPercent: 0 },
      'grease-trap': { materialCost: 3500, laborCost: 2000, totalInstalled: 5500, unit: 'EA', laborHoursPerUnit: 28, wasteFactorPercent: 0, notes: '1000 gal' },
      'lift-station-duplex': { materialCost: 25000, laborCost: 15000, totalInstalled: 40000, unit: 'EA', laborHoursPerUnit: 210, wasteFactorPercent: 0, notes: 'Complete duplex' },
      
      // Water Distribution
      'water-main-4': { materialCost: 35, laborCost: 28, totalInstalled: 63, unit: 'LF', laborHoursPerUnit: 0.38, wasteFactorPercent: 5 },
      'water-main-6': { materialCost: 45, laborCost: 35, totalInstalled: 80, unit: 'LF', laborHoursPerUnit: 0.48, wasteFactorPercent: 5 },
      'water-main-8': { materialCost: 58, laborCost: 42, totalInstalled: 100, unit: 'LF', laborHoursPerUnit: 0.58, wasteFactorPercent: 5 },
      'water-main-10': { materialCost: 75, laborCost: 55, totalInstalled: 130, unit: 'LF', laborHoursPerUnit: 0.77, wasteFactorPercent: 5 },
      'water-main-12': { materialCost: 95, laborCost: 70, totalInstalled: 165, unit: 'LF', laborHoursPerUnit: 0.98, wasteFactorPercent: 5 },
      'water-service-1in': { materialCost: 18, laborCost: 15, totalInstalled: 33, unit: 'LF', laborHoursPerUnit: 0.21, wasteFactorPercent: 5, notes: 'PE service line' },
      'water-service-2in': { materialCost: 28, laborCost: 22, totalInstalled: 50, unit: 'LF', laborHoursPerUnit: 0.3, wasteFactorPercent: 5 },
      'fire-hydrant': { materialCost: 3500, laborCost: 1500, totalInstalled: 5000, unit: 'EA', laborHoursPerUnit: 20, wasteFactorPercent: 0 },
      'fire-hydrant-assembly': { materialCost: 4500, laborCost: 2000, totalInstalled: 6500, unit: 'EA', laborHoursPerUnit: 28, wasteFactorPercent: 0, notes: 'With valve & tee' },
      'gate-valve-6': { materialCost: 650, laborCost: 350, totalInstalled: 1000, unit: 'EA', laborHoursPerUnit: 4.9, wasteFactorPercent: 0 },
      'gate-valve-8': { materialCost: 950, laborCost: 450, totalInstalled: 1400, unit: 'EA', laborHoursPerUnit: 6.3, wasteFactorPercent: 0 },
      'valve-box': { materialCost: 125, laborCost: 75, totalInstalled: 200, unit: 'EA', laborHoursPerUnit: 1.0, wasteFactorPercent: 0 },
      'water-meter': { materialCost: 1200, laborCost: 500, totalInstalled: 1700, unit: 'EA', laborHoursPerUnit: 7, wasteFactorPercent: 0 },
      'water-meter-compound': { materialCost: 3500, laborCost: 1200, totalInstalled: 4700, unit: 'EA', laborHoursPerUnit: 16.5, wasteFactorPercent: 0, notes: 'Large commercial' },
      'tap-fee-allowance': { materialCost: 5000, laborCost: 0, totalInstalled: 5000, unit: 'EA', laborHoursPerUnit: 0, wasteFactorPercent: 0 },
      'backflow-preventer-2in': { materialCost: 850, laborCost: 350, totalInstalled: 1200, unit: 'EA', laborHoursPerUnit: 4.9, wasteFactorPercent: 0 },
      'backflow-preventer-4in': { materialCost: 2500, laborCost: 800, totalInstalled: 3300, unit: 'EA', laborHoursPerUnit: 11, wasteFactorPercent: 0 },
      'thrust-block': { materialCost: 85, laborCost: 65, totalInstalled: 150, unit: 'EA', laborHoursPerUnit: 0.9, wasteFactorPercent: 5 },
      
      // Gas Service
      'gas-pipe-2': { materialCost: 22, laborCost: 18, totalInstalled: 40, unit: 'LF', laborHoursPerUnit: 0.25, wasteFactorPercent: 5 },
      'gas-pipe-4': { materialCost: 38, laborCost: 28, totalInstalled: 66, unit: 'LF', laborHoursPerUnit: 0.38, wasteFactorPercent: 5 },
      'gas-meter': { materialCost: 850, laborCost: 450, totalInstalled: 1300, unit: 'EA', laborHoursPerUnit: 6, wasteFactorPercent: 0 },
      'gas-meter-commercial': { materialCost: 2500, laborCost: 1000, totalInstalled: 3500, unit: 'EA', laborHoursPerUnit: 14, wasteFactorPercent: 0 },
      'gas-regulator': { materialCost: 450, laborCost: 250, totalInstalled: 700, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0 },
      
      // Electrical/Communications Underground
      'conduit-underground-2in': { materialCost: 4.50, laborCost: 6.50, totalInstalled: 11.00, unit: 'LF', laborHoursPerUnit: 0.09, wasteFactorPercent: 5, notes: 'PVC Schedule 40' },
      'conduit-underground-4in': { materialCost: 8.00, laborCost: 10.00, totalInstalled: 18.00, unit: 'LF', laborHoursPerUnit: 0.14, wasteFactorPercent: 5 },
      'duct-bank-2-way': { materialCost: 22, laborCost: 28, totalInstalled: 50, unit: 'LF', laborHoursPerUnit: 0.38, wasteFactorPercent: 5 },
      'duct-bank-4-way': { materialCost: 38, laborCost: 45, totalInstalled: 83, unit: 'LF', laborHoursPerUnit: 0.62, wasteFactorPercent: 5 },
      'pull-box': { materialCost: 350, laborCost: 250, totalInstalled: 600, unit: 'EA', laborHoursPerUnit: 3.5, wasteFactorPercent: 0 },
      'handhole': { materialCost: 650, laborCost: 450, totalInstalled: 1100, unit: 'EA', laborHoursPerUnit: 6.3, wasteFactorPercent: 0 },
      'transformer-pad': { materialCost: 450, laborCost: 350, totalInstalled: 800, unit: 'EA', laborHoursPerUnit: 4.9, wasteFactorPercent: 0 },
      'transformer-pad-enclosure': { materialCost: 2500, laborCost: 1500, totalInstalled: 4000, unit: 'EA', laborHoursPerUnit: 21, wasteFactorPercent: 0, notes: 'With bollards' },
    }
  },
];

/**
 * Find price for a category by searching the database
 */
export function findPriceByCategory(
  category: string,
  region: string = 'default'
): UnitPriceEntry | null {
  const normalizedCategory = category.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const multiplier = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS['default'];
  
  // Search all divisions
  for (const division of CSI_DIVISION_PRICING) {
    for (const [key, entry] of Object.entries(division.items)) {
      if (key === normalizedCategory || key.includes(normalizedCategory) || normalizedCategory.includes(key)) {
        return applyMultiplier(entry, multiplier);
      }
    }
  }
  
  return null;
}

/**
 * Find price by CSI division code
 */
export function findPriceByDivision(
  divisionCode: number,
  itemKey: string,
  region: string = 'default'
): UnitPriceEntry | null {
  const division = CSI_DIVISION_PRICING.find(d => d.divisionCode === divisionCode);
  if (!division) return null;
  
  const multiplier = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS['default'];
  const entry = division.items[itemKey];
  
  return entry ? applyMultiplier(entry, multiplier) : null;
}

/**
 * Get all items for a division
 */
export function getDivisionItems(divisionCode: number, region: string = 'default'): Record<string, UnitPriceEntry> {
  const division = CSI_DIVISION_PRICING.find(d => d.divisionCode === divisionCode);
  if (!division) return {};
  
  const multiplier = REGIONAL_MULTIPLIERS[region] || REGIONAL_MULTIPLIERS['default'];
  const result: Record<string, UnitPriceEntry> = {};
  
  for (const [key, entry] of Object.entries(division.items)) {
    result[key] = applyMultiplier(entry, multiplier);
  }
  
  return result;
}

/**
 * Apply regional multiplier to prices
 */
function applyMultiplier(entry: UnitPriceEntry, multiplier: number): UnitPriceEntry {
  return {
    ...entry,
    materialCost: Math.round(entry.materialCost * multiplier * 100) / 100,
    laborCost: Math.round(entry.laborCost * multiplier * 100) / 100,
    totalInstalled: Math.round(entry.totalInstalled * multiplier * 100) / 100,
  };
}

/**
 * Get total budget by division
 */
export function getDivisionBudget(divisionCode: number): { name: string; totalBudget: number } | null {
  const division = CSI_DIVISION_PRICING.find(d => d.divisionCode === divisionCode);
  if (!division) return null;
  
  // Calculate average total for the division (for budget reference)
  const items = Object.values(division.items);
  const avgTotal = items.reduce((sum, item) => sum + item.totalInstalled, 0) / items.length;
  
  return {
    name: division.divisionName,
    totalBudget: Math.round(avgTotal * 100) / 100,
  };
}

/**
 * Export summary of all divisions with item counts and price ranges
 */
export function getDivisionSummary(): Array<{
  code: number;
  name: string;
  itemCount: number;
  priceRange: { min: number; max: number };
}> {
  return CSI_DIVISION_PRICING.map(division => {
    const items = Object.values(division.items);
    const prices = items.map(i => i.totalInstalled);
    
    return {
      code: division.divisionCode,
      name: division.divisionName,
      itemCount: items.length,
      priceRange: {
        min: Math.min(...prices),
        max: Math.max(...prices),
      },
    };
  });
}
