import {
  Building,
  Layers,
  Zap,
  Droplet,
  Wind,
  Flame,
  MapPin,
  Layout,
} from 'lucide-react';
import { DocumentReference } from './types';

// Discipline classification config for organizing sheets
export const DISCIPLINE_CONFIG: Record<string, { icon: any; color: string; patterns: string[] }> = {
  'Architectural': { icon: Building, color: 'text-blue-400', patterns: ['A-', 'A0', 'A1', 'A2', 'ARCH', 'architectural'] },
  'Structural': { icon: Layers, color: 'text-orange-400', patterns: ['S-', 'S0', 'S1', 'STRUCT', 'structural'] },
  'Electrical': { icon: Zap, color: 'text-yellow-400', patterns: ['E-', 'E0', 'E1', 'ELEC', 'electrical'] },
  'Plumbing': { icon: Droplet, color: 'text-cyan-400', patterns: ['P-', 'P0', 'P1', 'PLUMB', 'plumbing'] },
  'Mechanical': { icon: Wind, color: 'text-green-400', patterns: ['M-', 'M0', 'M1', 'MECH', 'mechanical', 'HVAC'] },
  'Fire Protection': { icon: Flame, color: 'text-red-400', patterns: ['FP-', 'FP0', 'FP1', 'FIRE'] },
  'Civil': { icon: MapPin, color: 'text-amber-400', patterns: ['C-', 'C0', 'C1', 'CIVIL', 'SITE', 'GRADING'] },
  'General': { icon: Layout, color: 'text-gray-400', patterns: ['G-', 'G0', 'COVER', 'INDEX', 'TITLE'] },
};

// Extract sheet number from document name (e.g. "A101 - Floor Plan" -> "A101")
export function extractSheetNumber(name: string): string | undefined {
  const match = name.match(/^([A-Z]{1,3}[-]?\d{2,4})/i);
  return match ? match[1].toUpperCase() : undefined;
}

// Classify a document into a discipline based on its name and category
export function classifyDiscipline(name: string, category: string): string {
  const searchText = `${name} ${category}`.toUpperCase();
  for (const [discipline, config] of Object.entries(DISCIPLINE_CONFIG)) {
    if (config.patterns.some(p => searchText.includes(p.toUpperCase()))) {
      return discipline;
    }
  }
  return 'Other';
}

// Generate an intelligent summary for a document based on its type, name, and category
export function generateDocumentSummary(name: string, category: string, discipline: string): string {
  const lowerName = name.toLowerCase();
  const lowerCategory = category.toLowerCase();

  const categoryDescriptions: Record<string, string> = {
    'plans_drawings': 'Construction drawing showing design intent and specifications',
    'budget_cost': 'Financial document for cost tracking and budget management',
    'schedule': 'Project timeline with task sequencing and milestones',
    'specifications': 'Technical requirements and material standards',
    'contracts': 'Legal agreements, project contracts, RFIs, and submittals',
    'daily_reports': 'Project status reports and daily documentation',
    'photos': 'Field photos and visual documentation',
    'other': 'Miscellaneous project documents',
  };

  const disciplineContent: Record<string, string> = {
    'Architectural': 'building layout, dimensions, and finishes',
    'Structural': 'load-bearing elements, foundations, and framing',
    'Electrical': 'power distribution, lighting, and systems',
    'Plumbing': 'water supply, drainage, and fixtures',
    'Mechanical': 'HVAC systems, ventilation, and equipment',
    'Fire Protection': 'fire suppression systems and egress',
    'Civil': 'site grading, utilities, and drainage',
    'General': 'cover sheets, legends, and general notes',
  };

  const nameKeywords: Record<string, string> = {
    'floor plan': 'Room layout and spatial organization',
    'elevation': 'Vertical views showing exterior/interior heights',
    'section': 'Cut-through view revealing internal construction',
    'detail': 'Enlarged view of specific construction assembly',
    'schedule': 'Tabular listing of components and specifications',
    'diagram': 'Schematic showing system connections',
    'site': 'Property boundaries, grading, and site features',
    'foundation': 'Below-grade structural support systems',
    'roof': 'Roofing materials and drainage',
    'reflected ceiling': 'Ceiling layout with lighting and MEP',
    'partition': 'Wall types and locations',
    'door': 'Door sizes, types, and hardware',
    'window': 'Window sizes, types, and glazing',
    'finish': 'Interior finishes and materials',
    'demolition': 'Elements to be removed or modified',
    'grading': 'Site elevations and earthwork',
    'utility': 'Underground services and connections',
    'landscape': 'Planting and hardscape design',
    'conformance': 'Compliance verification documents',
    'budget': 'Cost breakdown and financial tracking',
    'lookahead': 'Short-term schedule planning',
    'critical path': 'Key milestone sequencing',
  };

  for (const [keyword, description] of Object.entries(nameKeywords)) {
    if (lowerName.includes(keyword)) {
      return description;
    }
  }

  for (const [cat, description] of Object.entries(categoryDescriptions)) {
    if (lowerCategory.includes(cat.replace('_', ' ')) || lowerCategory.includes(cat)) {
      if (discipline !== 'Other' && disciplineContent[discipline]) {
        return `${description} - ${disciplineContent[discipline]}`;
      }
      return description;
    }
  }

  if (discipline !== 'Other' && disciplineContent[discipline]) {
    return `Drawing showing ${disciplineContent[discipline]}`;
  }

  return 'Project documentation for reference';
}

// Generate a human-readable summary explaining why a cross-reference matters
export function generateReferenceSummary(ref: DocumentReference): string {
  const refType = ref.referenceType?.toLowerCase() || '';
  const location = ref.location || '';
  const context = ref.context || '';
  const sourceName = ref.sourceDoc?.name || '';
  const targetName = ref.targetDoc?.name || '';
  const contextLower = context.toLowerCase();
  const _locationLower = location.toLowerCase();

  const detailMatch = context.match(/(?:detail|dtl|det)\s*[-#]?\s*(\d+[A-Za-z]?)/i);
  const sectionMatch = context.match(/(?:section|sect|sec)\s*[-#]?\s*([A-Za-z]?\d*)/i);
  const sheetMatch = context.match(/(?:sheet|sht|dwg)\s*[-#]?\s*([A-Za-z]*\d+\.?\d*)/i);
  const elevMatch = context.match(/(?:elevation|elev)\s*[-#]?\s*([A-Za-z]?\d*)/i);
  const noteMatch = context.match(/(?:note|n)\s*[-#]?\s*(\d+)/i);
  const specMatch = context.match(/(?:spec(?:ification)?|section)\s*[-#]?\s*(\d{2,6})/i);

  const getRefDiscipline = (name: string): string => {
    const n = name.toLowerCase();
    if (n.match(/^a[-\d]|arch|floor plan|elevation|reflected/i)) return 'Architectural';
    if (n.match(/^s[-\d]|struct|foundation|framing/i)) return 'Structural';
    if (n.match(/^m[-\d]|mech|hvac|duct/i)) return 'Mechanical';
    if (n.match(/^e[-\d]|elec|power|light/i)) return 'Electrical';
    if (n.match(/^p[-\d]|plumb|sanitary|water/i)) return 'Plumbing';
    if (n.match(/^c[-\d]|civil|site|grading/i)) return 'Civil/Site';
    if (n.match(/^l[-\d]|land|landscape/i)) return 'Landscape';
    if (n.match(/^fp|fire|sprink/i)) return 'Fire Protection';
    return '';
  };

  const targetDiscipline = getRefDiscipline(targetName);
  const sourceDiscipline = getRefDiscipline(sourceName);

  let summary = '';

  if (refType.includes('detail') || detailMatch) {
    const detailNum = detailMatch?.[1] || '';
    if (detailNum) {
      summary = `References Detail ${detailNum} on "${targetName}" for enlarged construction assembly`;
      if (contextLower.includes('wall')) summary += ' at wall condition';
      else if (contextLower.includes('floor')) summary += ' at floor connection';
      else if (contextLower.includes('roof')) summary += ' at roof assembly';
      else if (contextLower.includes('window') || contextLower.includes('door')) summary += ' at opening';
      else if (contextLower.includes('foundation')) summary += ' at foundation';
    } else {
      summary = `Links to enlarged detail on "${targetName}" showing specific construction assembly`;
    }
    return summary;
  }

  if (refType.includes('section') || sectionMatch) {
    const sectionId = sectionMatch?.[1] || '';
    if (sectionId) {
      summary = `References Section ${sectionId} on "${targetName}" showing cut-through view`;
    } else {
      summary = `Links to building section on "${targetName}" for internal construction view`;
    }
    if (contextLower.includes('building')) summary += ' of building envelope';
    else if (contextLower.includes('wall')) summary += ' through wall assembly';
    return summary;
  }

  if (refType.includes('elevation') || elevMatch) {
    const elevId = elevMatch?.[1] || '';
    if (elevId) {
      summary = `References Elevation ${elevId} on "${targetName}" for vertical coordination`;
    } else {
      summary = `Links to elevation view on "${targetName}" showing facade/height relationships`;
    }
    if (contextLower.includes('exterior')) summary += ' (exterior)';
    else if (contextLower.includes('interior')) summary += ' (interior)';
    return summary;
  }

  if (refType.includes('schedule') || contextLower.includes('schedule')) {
    if (contextLower.includes('door')) summary = `References door schedule on "${targetName}" for hardware and sizing specifications`;
    else if (contextLower.includes('window')) summary = `References window schedule on "${targetName}" for glazing and frame specifications`;
    else if (contextLower.includes('finish')) summary = `References finish schedule on "${targetName}" for material and color selections`;
    else if (contextLower.includes('equipment')) summary = `References equipment schedule on "${targetName}" for mechanical specifications`;
    else summary = `Links to specification schedule on "${targetName}" for component data`;
    return summary;
  }

  if (specMatch) {
    summary = `References Specification Section ${specMatch[1]} for technical requirements and material standards`;
    return summary;
  }

  if (refType.includes('note') || noteMatch) {
    const noteNum = noteMatch?.[1] || '';
    if (noteNum) {
      summary = `References Note ${noteNum} for specific construction requirements or clarifications`;
    } else {
      summary = `Links to general notes for construction standards and requirements`;
    }
    return summary;
  }

  if (sheetMatch) {
    summary = `Directs to Sheet ${sheetMatch[1]} ("${targetName}")`;
    if (targetDiscipline) summary += ` for ${targetDiscipline} coordination`;
    return summary;
  }

  if (targetDiscipline && sourceDiscipline && targetDiscipline !== sourceDiscipline) {
    summary = `${sourceDiscipline} to ${targetDiscipline} coordination reference - `;
    if (targetDiscipline === 'Structural') summary += 'verify structural elements, connections, and load paths';
    else if (targetDiscipline === 'Mechanical') summary += 'coordinate HVAC systems, ductwork, and equipment clearances';
    else if (targetDiscipline === 'Electrical') summary += 'verify electrical routing, panel locations, and connections';
    else if (targetDiscipline === 'Plumbing') summary += 'coordinate pipe routing, fixture locations, and drain points';
    else if (targetDiscipline === 'Civil/Site') summary += 'verify site conditions, utilities, and grading';
    else summary += `verify ${targetDiscipline.toLowerCase()} coordination`;
    return summary;
  }

  if (contextLower.includes('see') && targetName) {
    summary = `Directs viewer to "${targetName}" for additional information`;
    if (contextLower.includes('typ')) summary += ' (typical condition at multiple locations)';
    return summary;
  }

  if (contextLower.includes('verify') || contextLower.includes('confirm')) {
    return `Field verification required - refer to "${targetName}" before proceeding`;
  }

  if (contextLower.includes('match') || contextLower.includes('align')) {
    return `Alignment/matching requirement - see "${targetName}" for coordination`;
  }

  if (contextLower.includes('coordinate') || contextLower.includes('coord')) {
    summary = `Trade coordination required with "${targetName}"`;
    if (targetDiscipline) summary += ` (${targetDiscipline})`;
    return summary;
  }

  if (targetName && sourceName) {
    summary = `Cross-reference from "${sourceName}" to "${targetName}"`;
    if (targetDiscipline) summary += ` for ${targetDiscipline.toLowerCase()} coordination`;
    else summary += ' for construction coordination';
    return summary;
  }

  return 'Cross-reference for construction coordination - click to view related documents';
}
