/**
 * Spec Section Service
 * Manages specification section references and linking for submittals
 */

import { prisma } from './db';

// CSI MasterFormat Division structure
export const CSI_DIVISIONS: Record<string, { title: string; sections: Record<string, string> }> = {
  '01': {
    title: 'General Requirements',
    sections: {
      '01 10 00': 'Summary',
      '01 20 00': 'Price and Payment Procedures',
      '01 30 00': 'Administrative Requirements',
      '01 40 00': 'Quality Requirements',
      '01 50 00': 'Temporary Facilities and Controls',
      '01 60 00': 'Product Requirements',
      '01 70 00': 'Execution and Closeout Requirements',
      '01 73 00': 'Execution',
      '01 77 00': 'Closeout Procedures',
    },
  },
  '03': {
    title: 'Concrete',
    sections: {
      '03 10 00': 'Concrete Forming and Accessories',
      '03 20 00': 'Concrete Reinforcing',
      '03 30 00': 'Cast-in-Place Concrete',
    },
  },
  '04': {
    title: 'Masonry',
    sections: {
      '04 20 00': 'Unit Masonry',
      '04 22 00': 'Concrete Unit Masonry',
    },
  },
  '05': {
    title: 'Metals',
    sections: {
      '05 12 00': 'Structural Steel Framing',
      '05 50 00': 'Metal Fabrications',
    },
  },
  '06': {
    title: 'Wood, Plastics, and Composites',
    sections: {
      '06 10 00': 'Rough Carpentry',
      '06 20 00': 'Finish Carpentry',
      '06 40 00': 'Architectural Woodwork',
    },
  },
  '07': {
    title: 'Thermal and Moisture Protection',
    sections: {
      '07 10 00': 'Dampproofing and Waterproofing',
      '07 21 00': 'Thermal Insulation',
      '07 50 00': 'Membrane Roofing',
      '07 60 00': 'Flashing and Sheet Metal',
      '07 90 00': 'Joint Protection',
    },
  },
  '08': {
    title: 'Openings',
    sections: {
      '08 11 00': 'Metal Doors and Frames',
      '08 14 00': 'Wood Doors',
      '08 31 00': 'Access Doors and Panels',
      '08 41 00': 'Entrances and Storefronts',
      '08 50 00': 'Windows',
      '08 70 00': 'Hardware',
      '08 71 00': 'Door Hardware',
      '08 80 00': 'Glazing',
    },
  },
  '09': {
    title: 'Finishes',
    sections: {
      '09 21 00': 'Gypsum Board Assemblies',
      '09 30 00': 'Tiling',
      '09 51 00': 'Acoustical Ceilings',
      '09 60 00': 'Flooring',
      '09 65 00': 'Resilient Flooring',
      '09 68 00': 'Carpeting',
      '09 91 00': 'Painting',
      '09 96 00': 'High-Performance Coatings',
    },
  },
  '10': {
    title: 'Specialties',
    sections: {
      '10 11 00': 'Visual Display Surfaces',
      '10 14 00': 'Signage',
      '10 21 00': 'Compartments and Cubicles',
      '10 28 00': 'Toilet, Bath, and Laundry Accessories',
      '10 44 00': 'Fire Protection Specialties',
    },
  },
  '11': {
    title: 'Equipment',
    sections: {
      '11 31 00': 'Residential Appliances',
      '11 40 00': 'Foodservice Equipment',
    },
  },
  '12': {
    title: 'Furnishings',
    sections: {
      '12 21 00': 'Window Blinds',
      '12 24 00': 'Window Shades',
      '12 36 00': 'Countertops',
    },
  },
  '21': {
    title: 'Fire Suppression',
    sections: {
      '21 10 00': 'Water-Based Fire-Suppression Systems',
      '21 13 00': 'Fire-Suppression Sprinkler Systems',
    },
  },
  '22': {
    title: 'Plumbing',
    sections: {
      '22 05 00': 'Common Work Results for Plumbing',
      '22 10 00': 'Plumbing Piping and Pumps',
      '22 30 00': 'Plumbing Equipment',
      '22 40 00': 'Plumbing Fixtures',
    },
  },
  '23': {
    title: 'HVAC',
    sections: {
      '23 05 00': 'Common Work Results for HVAC',
      '23 09 00': 'Instrumentation and Control for HVAC',
      '23 20 00': 'HVAC Piping and Pumps',
      '23 30 00': 'HVAC Air Distribution',
      '23 34 00': 'HVAC Fans',
      '23 37 00': 'Air Outlets and Inlets',
      '23 70 00': 'Central HVAC Equipment',
      '23 81 00': 'Decentralized Unitary HVAC Equipment',
    },
  },
  '26': {
    title: 'Electrical',
    sections: {
      '26 05 00': 'Common Work Results for Electrical',
      '26 09 00': 'Instrumentation and Control for Electrical',
      '26 20 00': 'Low-Voltage Electrical Transmission',
      '26 24 00': 'Switchboards and Panelboards',
      '26 27 00': 'Low-Voltage Distribution Equipment',
      '26 28 00': 'Low-Voltage Circuit Protective Devices',
      '26 50 00': 'Lighting',
      '26 51 00': 'Interior Lighting',
      '26 56 00': 'Exterior Lighting',
    },
  },
  '27': {
    title: 'Communications',
    sections: {
      '27 10 00': 'Structured Cabling',
      '27 20 00': 'Data Communications',
      '27 50 00': 'Distributed Audio-Video Communications',
    },
  },
  '28': {
    title: 'Electronic Safety and Security',
    sections: {
      '28 10 00': 'Electronic Access Control and Intrusion Detection',
      '28 20 00': 'Electronic Surveillance',
      '28 30 00': 'Electronic Detection and Alarm',
    },
  },
  '31': {
    title: 'Earthwork',
    sections: {
      '31 10 00': 'Site Clearing',
      '31 20 00': 'Earth Moving',
      '31 23 00': 'Excavation and Fill',
    },
  },
  '32': {
    title: 'Exterior Improvements',
    sections: {
      '32 10 00': 'Bases, Ballasts, and Paving',
      '32 12 00': 'Flexible Paving',
      '32 13 00': 'Rigid Paving',
      '32 30 00': 'Site Improvements',
      '32 90 00': 'Planting',
    },
  },
  '33': {
    title: 'Utilities',
    sections: {
      '33 10 00': 'Water Utilities',
      '33 30 00': 'Sanitary Sewerage Utilities',
      '33 40 00': 'Storm Drainage Utilities',
    },
  },
};

export interface SpecReference {
  id: string;
  specSection: string;
  sectionTitle: string;
  divisionNumber: string;
  divisionTitle: string;
  documentId?: string;
  documentName?: string;
  pageNumber?: number;
  excerpt?: string;
}

/**
 * Parse a spec section number to get division info
 */
export function parseSpecSection(section: string): {
  divisionNumber: string;
  divisionTitle: string;
  sectionTitle: string;
} | null {
  if (!section) return null;
  
  // Normalize section format (remove spaces, ensure format)
  const normalized = section.replace(/\s+/g, ' ').trim();
  const divisionMatch = normalized.match(/^(\d{2})/);
  
  if (!divisionMatch) return null;
  
  const divisionNumber = divisionMatch[1];
  const division = CSI_DIVISIONS[divisionNumber];
  
  if (!division) {
    return {
      divisionNumber,
      divisionTitle: `Division ${divisionNumber}`,
      sectionTitle: normalized,
    };
  }
  
  // Try to find exact section match
  const sectionTitle = division.sections[normalized] || normalized;
  
  return {
    divisionNumber,
    divisionTitle: division.title,
    sectionTitle,
  };
}

/**
 * Get all spec sections for a submittal
 */
export async function getSubmittalSpecSections(submittalId: string): Promise<SpecReference[]> {
  const submittal = await prisma.mEPSubmittal.findUnique({
    where: { id: submittalId },
    include: {
      lineItems: {
        where: { specSection: { not: null } },
        select: { specSection: true },
      },
    },
  });
  
  if (!submittal) return [];
  
  const sections = new Set<string>();
  
  // Add submittal's main spec section
  if (submittal.specSection) {
    sections.add(submittal.specSection);
  }
  
  // Add all line item spec sections
  submittal.lineItems.forEach(item => {
    if (item.specSection) {
      sections.add(item.specSection);
    }
  });
  
  // Convert to SpecReference objects
  const references: SpecReference[] = [];
  
  for (const section of sections) {
    const parsed = parseSpecSection(section);
    if (parsed) {
      references.push({
        id: section,
        specSection: section,
        sectionTitle: parsed.sectionTitle,
        divisionNumber: parsed.divisionNumber,
        divisionTitle: parsed.divisionTitle,
      });
    }
  }
  
  return references.sort((a, b) => a.specSection.localeCompare(b.specSection));
}

/**
 * Search for documents that match a spec section
 */
export async function findDocumentsForSpecSection(
  projectId: string,
  specSection: string
): Promise<{ id: string; name: string; pages: number[] }[]> {
  // Search document chunks for spec section mentions
  const chunks = await prisma.documentChunk.findMany({
    where: {
      Document: { projectId },
      OR: [
        { content: { contains: specSection } },
        { content: { contains: specSection.replace(/ /g, '') } },
      ],
    },
    include: {
      Document: { select: { id: true, name: true } },
    },
  });
  
  // Group by document
  const docMap = new Map<string, { name: string; pages: Set<number> }>();
  
  chunks.forEach(chunk => {
    if (!chunk.Document) return;
    
    if (!docMap.has(chunk.Document.id)) {
      docMap.set(chunk.Document.id, {
        name: chunk.Document.name,
        pages: new Set(),
      });
    }
    
    const meta = chunk.metadata as any;
    if (meta?.pageNumber) {
      docMap.get(chunk.Document.id)!.pages.add(meta.pageNumber);
    }
  });
  
  return Array.from(docMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    pages: Array.from(data.pages).sort((a, b) => a - b),
  }));
}

/**
 * Get suggested spec sections based on submittal type and trade
 */
export function getSuggestedSpecSections(
  submittalType?: string,
  tradeCategory?: string
): { section: string; title: string }[] {
  const suggestions: { section: string; title: string }[] = [];
  
  // Map trade categories to divisions
  const tradeDivisions: Record<string, string[]> = {
    doors: ['08'],
    door_hardware: ['08'],
    windows: ['08'],
    glazing: ['08'],
    finishes: ['09'],
    plumbing: ['22'],
    hvac: ['23'],
    electrical: ['26'],
    fire_protection: ['21'],
    concrete: ['03'],
    masonry: ['04'],
    metals: ['05'],
    wood: ['06'],
    roofing: ['07'],
    earthwork: ['31'],
    sitework: ['32'],
  };
  
  const divisions = tradeDivisions[tradeCategory || ''] || [];
  
  divisions.forEach(div => {
    const division = CSI_DIVISIONS[div];
    if (division) {
      Object.entries(division.sections).forEach(([section, title]) => {
        suggestions.push({ section, title });
      });
    }
  });
  
  return suggestions;
}

/**
 * Update the spec section for a submittal
 */
export async function updateSubmittalSpecSection(
  submittalId: string,
  specSection: string | null
): Promise<boolean> {
  try {
    await prisma.mEPSubmittal.update({
      where: { id: submittalId },
      data: { specSection },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Update the spec section for a line item
 */
export async function updateLineItemSpecSection(
  lineItemId: string,
  specSection: string | null
): Promise<boolean> {
  try {
    await prisma.submittalLineItem.update({
      where: { id: lineItemId },
      data: { specSection },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all unique spec sections used in a project with counts
 */
export async function getProjectSpecSections(projectSlug: string): Promise<{
  specSection: string;
  sectionTitle: string;
  divisionNumber: string;
  divisionTitle: string;
  submittalCount: number;
  lineItemCount: number;
}[]> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });
  
  if (!project) return [];
  
  // Get all submittals with their spec sections
  const submittals = await prisma.mEPSubmittal.findMany({
    where: { projectId: project.id },
    select: {
      specSection: true,
      lineItems: {
        select: { specSection: true },
      },
    },
  });
  
  // Collect all unique spec sections with counts
  const sectionCounts = new Map<string, { submittals: number; lineItems: number }>();
  
  submittals.forEach(s => {
    if (s.specSection) {
      const current = sectionCounts.get(s.specSection) || { submittals: 0, lineItems: 0 };
      current.submittals++;
      sectionCounts.set(s.specSection, current);
    }
    s.lineItems.forEach(li => {
      if (li.specSection) {
        const current = sectionCounts.get(li.specSection) || { submittals: 0, lineItems: 0 };
        current.lineItems++;
        sectionCounts.set(li.specSection, current);
      }
    });
  });
  
  // Convert to result array
  const results = Array.from(sectionCounts.entries()).map(([section, counts]) => {
    const parsed = parseSpecSection(section);
    return {
      specSection: section,
      sectionTitle: parsed?.sectionTitle || section,
      divisionNumber: parsed?.divisionNumber || '',
      divisionTitle: parsed?.divisionTitle || '',
      submittalCount: counts.submittals,
      lineItemCount: counts.lineItems,
    };
  });
  
  return results.sort((a, b) => a.specSection.localeCompare(b.specSection));
}

/**
 * Get all submittals that reference a specific spec section
 */
export async function getSubmittalsForSpecSection(
  projectSlug: string,
  specSection: string
): Promise<{
  id: string;
  submittalNumber: string;
  title: string;
  status: string;
  isDirectMatch: boolean;
  lineItemCount: number;
}[]> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });
  
  if (!project) return [];
  
  // Find submittals with this spec section directly or in line items
  const submittals = await prisma.mEPSubmittal.findMany({
    where: {
      projectId: project.id,
      OR: [
        { specSection },
        { lineItems: { some: { specSection } } },
      ],
    },
    include: {
      lineItems: {
        where: { specSection },
        select: { id: true },
      },
    },
  });
  
  return submittals.map(s => ({
    id: s.id,
    submittalNumber: s.submittalNumber,
    title: s.title,
    status: s.status,
    isDirectMatch: s.specSection === specSection,
    lineItemCount: s.lineItems.length,
  }));
}
