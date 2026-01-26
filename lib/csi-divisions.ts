/**
 * CSI MasterFormat Construction Divisions
 * 
 * Reference data for the 50 primary divisions in CSI MasterFormat 2020.
 * Used for categorizing construction work, documents, submittals, and costs.
 * 
 * Level 1 (Primary Divisions): 50 divisions
 * Format: XX 00 00 - Division Name
 * 
 * This reference is used by:
 * - Room finish schedules (organizing finish types)
 * - Document categorization (tagging by trade/division)
 * - Cost tracking (grouping costs by CSI division)
 * - Submittal organization (routing by trade)
 * - Subcontractor assignment (matching trades to divisions)
 */

export interface CSIDivision {
  code: string;           // "03 00 00"
  number: number;         // 3
  name: string;           // "Concrete"
  description: string;    // Detailed description
  commonTrades: string[]; // Typical subcontractor trades
}

export const CSI_DIVISIONS: CSIDivision[] = [
  {
    code: "00 00 00",
    number: 0,
    name: "Procurement and Contracting Requirements",
    description: "Project procurement, bidding, and contracting procedures",
    commonTrades: ["General Contractor", "Owner", "Architect"]
  },
  {
    code: "01 00 00",
    number: 1,
    name: "General Requirements",
    description: "Administrative, temporary facilities, and general project requirements",
    commonTrades: ["General Contractor", "Project Manager"]
  },
  {
    code: "02 00 00",
    number: 2,
    name: "Existing Conditions",
    description: "Demolition, hazardous materials, site remediation",
    commonTrades: ["Demolition", "Abatement", "Earthwork"]
  },
  {
    code: "03 00 00",
    number: 3,
    name: "Concrete",
    description: "Concrete forming, reinforcement, cast-in-place, precast",
    commonTrades: ["Concrete", "Formwork", "Rebar", "Masonry"]
  },
  {
    code: "04 00 00",
    number: 4,
    name: "Masonry",
    description: "Brick, block, stone, mortar, masonry restoration",
    commonTrades: ["Masonry", "Bricklayer", "Stone Mason"]
  },
  {
    code: "05 00 00",
    number: 5,
    name: "Metals",
    description: "Structural steel, metal fabrications, metal decking",
    commonTrades: ["Steel Erection", "Structural Steel", "Metal Fabrication"]
  },
  {
    code: "06 00 00",
    number: 6,
    name: "Wood, Plastics, and Composites",
    description: "Rough carpentry, finish carpentry, architectural woodwork",
    commonTrades: ["Framing", "Carpentry", "Millwork", "Cabinetry"]
  },
  {
    code: "07 00 00",
    number: 7,
    name: "Thermal and Moisture Protection",
    description: "Waterproofing, insulation, roofing, siding, joint sealants",
    commonTrades: ["Roofing", "Waterproofing", "Insulation", "Siding"]
  },
  {
    code: "08 00 00",
    number: 8,
    name: "Openings",
    description: "Doors, windows, hardware, glazing, entrances",
    commonTrades: ["Doors & Frames", "Windows", "Glazing", "Hardware"]
  },
  {
    code: "09 00 00",
    number: 9,
    name: "Finishes",
    description: "Drywall, plaster, tiling, flooring, painting, wall coverings, ceilings",
    commonTrades: ["Drywall", "Painting", "Flooring", "Tile", "Ceiling", "Carpet"]
  },
  {
    code: "10 00 00",
    number: 10,
    name: "Specialties",
    description: "Toilet accessories, signage, lockers, fire extinguishers",
    commonTrades: ["Specialties", "Signage", "Lockers"]
  },
  {
    code: "11 00 00",
    number: 11,
    name: "Equipment",
    description: "Kitchen equipment, lab equipment, medical equipment",
    commonTrades: ["Kitchen Equipment", "Lab Equipment", "Medical Equipment"]
  },
  {
    code: "12 00 00",
    number: 12,
    name: "Furnishings",
    description: "Furniture, window treatments, artwork, manufactured casework",
    commonTrades: ["Furniture", "Window Treatments", "Casework"]
  },
  {
    code: "13 00 00",
    number: 13,
    name: "Special Construction",
    description: "Special purpose rooms, radiation protection, sound/vibration control",
    commonTrades: ["Special Construction", "Clean Rooms", "Radiation Protection"]
  },
  {
    code: "14 00 00",
    number: 14,
    name: "Conveying Equipment",
    description: "Elevators, escalators, lifts, material handling",
    commonTrades: ["Elevators", "Escalators", "Lifts"]
  },
  {
    code: "21 00 00",
    number: 21,
    name: "Fire Suppression",
    description: "Fire suppression systems, standpipes, fire pumps",
    commonTrades: ["Fire Protection", "Sprinkler", "Fire Alarm"]
  },
  {
    code: "22 00 00",
    number: 22,
    name: "Plumbing",
    description: "Plumbing fixtures, piping, pumps, water treatment",
    commonTrades: ["Plumbing", "Plumber", "HVAC"]
  },
  {
    code: "23 00 00",
    number: 23,
    name: "Heating, Ventilating, and Air Conditioning (HVAC)",
    description: "HVAC equipment, ductwork, controls, testing",
    commonTrades: ["HVAC", "Mechanical", "Sheet Metal"]
  },
  {
    code: "25 00 00",
    number: 25,
    name: "Integrated Automation",
    description: "Building automation, control networks, HVAC controls",
    commonTrades: ["Building Automation", "Controls", "BMS"]
  },
  {
    code: "26 00 00",
    number: 26,
    name: "Electrical",
    description: "Electrical service, distribution, lighting, communications",
    commonTrades: ["Electrical", "Electrician", "Low Voltage"]
  },
  {
    code: "27 00 00",
    number: 27,
    name: "Communications",
    description: "Data networks, telecom, audio-visual, security",
    commonTrades: ["Low Voltage", "Data/Telecom", "Security", "AV"]
  },
  {
    code: "28 00 00",
    number: 28,
    name: "Electronic Safety and Security",
    description: "Fire alarm, security systems, access control",
    commonTrades: ["Fire Alarm", "Security", "Access Control"]
  },
  {
    code: "31 00 00",
    number: 31,
    name: "Earthwork",
    description: "Excavation, grading, soil treatment, trenching",
    commonTrades: ["Excavation", "Grading", "Earthwork", "Sitework"]
  },
  {
    code: "32 00 00",
    number: 32,
    name: "Exterior Improvements",
    description: "Paving, curbs, landscaping, irrigation, site furnishings",
    commonTrades: ["Paving", "Landscaping", "Irrigation", "Hardscape"]
  },
  {
    code: "33 00 00",
    number: 33,
    name: "Utilities",
    description: "Water, sewer, gas, electrical utilities, storm drainage",
    commonTrades: ["Utilities", "Underground", "Civil"]
  },
  {
    code: "34 00 00",
    number: 34,
    name: "Transportation",
    description: "Railways, transportation signaling, road construction",
    commonTrades: ["Transportation", "Rail", "Highway"]
  },
  {
    code: "35 00 00",
    number: 35,
    name: "Waterway and Marine Construction",
    description: "Waterway structures, dams, marine equipment",
    commonTrades: ["Marine", "Waterway", "Dock"]
  },
  {
    code: "40 00 00",
    number: 40,
    name: "Process Integration",
    description: "Process piping, instrumentation, industrial processing",
    commonTrades: ["Process", "Industrial", "Piping"]
  },
  {
    code: "41 00 00",
    number: 41,
    name: "Material Processing and Handling Equipment",
    description: "Bulk material processing, industrial conveyors",
    commonTrades: ["Material Handling", "Industrial Equipment"]
  },
  {
    code: "42 00 00",
    number: 42,
    name: "Process Heating, Cooling, and Drying Equipment",
    description: "Industrial heating/cooling systems",
    commonTrades: ["Process HVAC", "Industrial Mechanical"]
  },
  {
    code: "43 00 00",
    number: 43,
    name: "Process Gas and Liquid Handling, Purification, and Storage",
    description: "Industrial gas/liquid systems",
    commonTrades: ["Process", "Industrial Plumbing"]
  },
  {
    code: "44 00 00",
    number: 44,
    name: "Pollution and Waste Control Equipment",
    description: "Air quality control, water treatment, waste handling",
    commonTrades: ["Environmental", "Waste Control"]
  },
  {
    code: "45 00 00",
    number: 45,
    name: "Industry-Specific Manufacturing Equipment",
    description: "Specialized manufacturing equipment",
    commonTrades: ["Manufacturing", "Industrial Equipment"]
  },
  {
    code: "46 00 00",
    number: 46,
    name: "Water and Wastewater Equipment",
    description: "Water treatment, wastewater systems",
    commonTrades: ["Water Treatment", "Wastewater"]
  },
  {
    code: "48 00 00",
    number: 48,
    name: "Electrical Power Generation",
    description: "Power generation systems, renewable energy",
    commonTrades: ["Power Generation", "Solar", "Renewable Energy"]
  }
];

/**
 * Get CSI division by number
 */
export function getCSIDivisionByNumber(divisionNumber: number): CSIDivision | undefined {
  return CSI_DIVISIONS.find(d => d.number === divisionNumber);
}

/**
 * Get CSI division by code
 */
export function getCSIDivisionByCode(code: string): CSIDivision | undefined {
  return CSI_DIVISIONS.find(d => d.code === code);
}

/**
 * Get CSI divisions by trade name (fuzzy match)
 */
export function getCSIDivisionsByTrade(trade: string): CSIDivision[] {
  const lowerTrade = trade.toLowerCase();
  return CSI_DIVISIONS.filter(d => 
    d.commonTrades.some(t => t.toLowerCase().includes(lowerTrade)) ||
    d.name.toLowerCase().includes(lowerTrade)
  );
}

/**
 * Get finish-related CSI divisions (most common for room finishes)
 */
export function getFinishDivisions(): CSIDivision[] {
  return CSI_DIVISIONS.filter(d => 
    [8, 9, 10, 12].includes(d.number) // Openings, Finishes, Specialties, Furnishings
  );
}

/**
 * Get MEP-related CSI divisions
 */
export function getMEPDivisions(): CSIDivision[] {
  return CSI_DIVISIONS.filter(d => 
    [21, 22, 23, 25, 26, 27, 28].includes(d.number)
  );
}

/**
 * Format CSI code for display (e.g., "09 00 00" or "Division 09")
 */
export function formatCSICode(code: string, format: 'code' | 'division' = 'code'): string {
  const division = getCSIDivisionByCode(code);
  if (!division) return code;
  
  if (format === 'division') {
    return `Division ${String(division.number).padStart(2, '0')}`;
  }
  return division.code;
}

/**
 * Get all division numbers as array (for dropdowns)
 */
export function getCSIDivisionNumbers(): number[] {
  return CSI_DIVISIONS.map(d => d.number);
}

/**
 * Get division options for select dropdowns
 */
export function getCSIDivisionOptions(): Array<{ value: string; label: string }> {
  return CSI_DIVISIONS.map(d => ({
    value: d.code,
    label: `${String(d.number).padStart(2, '0')} - ${d.name}`
  }));
}