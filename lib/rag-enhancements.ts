/**
 * RAG System Enhancements for Construction Document Analysis
 * 
 * This module implements enhanced protocols for OCR validation, retrieval precision,
 * cross-referencing, and measurement sourcing as specified in the advanced guidelines.
 * 
 * Key Enhancements:
 * 1. Two-pass retrieval (precision + context)
 * 2. Notes-first approach for requirement queries
 * 3. Cross-reference bundling
 * 4. Measurement hierarchy and sourcing
 * 5. OCR validation and legibility checking
 * 6. Self-check validation protocols
 */

import { prisma } from './db';

export interface EnhancedChunk {
  id: string;
  content: string;
  documentId: string | null;
  regulatoryDocumentId?: string | null;
  pageNumber: number | null;
  metadata: any;
  isRegulatory?: boolean;
  chunkType?: 'page_overview' | 'detail_callout' | 'zone_area' | 'room_space' | 'schedule_row' | 'note' | 'legend';
  retrievalMethod?: 'precision' | 'context' | 'notes_first' | 'cross_reference';
  sourceReference?: string;
}

export interface MeasurementInfo {
  value: string;
  unit: string;
  method: 'explicit' | 'scaled' | 'unavailable';
  source: string;
  isLegible: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Material Takeoff Interfaces
 */
export interface TakeoffItem {
  trade: string;
  system: string;
  itemType: string;
  itemTagOrId: string;
  description: string;
  quantity: number | string;
  unit: string;
  sizeOrRating: string;
  method: 'counted' | 'dimensioned' | 'scaled' | 'not_quantified';
  sourceRefs: string[];
  exclusionsOrNotes: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceBasis: string;
}

export interface TakeoffRollup {
  trade: string;
  system?: string;
  groupBy: 'trade' | 'system' | 'size' | 'area' | 'item_type';
  groupValue: string;
  totalQuantity: number;
  unit: string;
  itemCount: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceBasis: string;
  items: TakeoffItem[];
}

export interface TakeoffResult {
  projectName: string;
  generatedDate: string;
  requestedBy: string;
  scope: string;
  items: TakeoffItem[];
  rollups?: TakeoffRollup[];
  warnings: string[];
  disclaimers: string[];
  totalItems: number;
  countedItems: number;
  measuredItems: number;
  notQuantifiedItems: number;
}

/**
 * MEP Entity Registries for trade-specific recognition
 */
export const MEP_ENTITIES = {
  // HVAC equipment and devices
  hvac: {
    equipment: ['AHU', 'RTU', 'VAV', 'FCU', 'MAU', 'ERV', 'HRV', 'DOAS', 'MAU', 'CUH', 'UH', 'HX'],
    devices: ['EF', 'IF', 'RF', 'SF', 'RA', 'SA', 'EA', 'OA', 'TD', 'RD', 'SD', 'ED', 'GD'],
    patterns: [
      /\b(AHU|RTU|VAV|FCU|MAU|ERV|HRV|DOAS|CUH|UH|HX)-?\d+[A-Z]?\b/gi,
      /\b(EF|IF|RF|SF)-\d+\b/gi,
      /\b(TD|RD|SD|ED|GD)-\d+\b/gi,
    ]
  },
  
  // Plumbing systems and fixtures
  plumbing: {
    systems: ['CWS', 'HWS', 'HWR', 'SAN', 'VTR', 'ST', 'RWL', 'CW', 'HW', 'DS', 'V', 'G'],
    fixtures: ['WC', 'LAV', 'UR', 'DF', 'FD', 'SH', 'BT', 'HB', 'MOP', 'EWC', 'CO'],
    patterns: [
      /\b(CWS|HWS|HWR|SAN|VTR|ST|RWL)-?\d*\b/gi,
      /\b(WC|LAV|UR|DF|FD|SH|BT|HB|MOP|EWC|CO)-?\d+[A-Z]?\b/gi,
      /\b\d+"?\s*(CWS|HWS|SAN|VTR|ST|G)\b/gi, // pipe sizes
    ]
  },
  
  // Electrical identifiers
  electrical: {
    panels: ['MDP', 'MSB', 'SB', 'RP', 'LP', 'DP', 'PP', 'EM', 'LT', 'PNL'],
    devices: ['SW', 'REC', 'GFI', 'GFCI', 'WP', 'J-BOX', 'JB', 'TS', 'DS'],
    lighting: ['A', 'B', 'C', 'D', 'E', 'F', 'EXIT', 'EM'], // lighting type tags
    patterns: [
      /\b(MDP|MSB|SB|RP|LP|DP|PP|EM|LT|PNL)-?\d+[A-Z]?\b/gi,
      /\bPanel\s+[A-Z0-9-]+\b/gi,
      /\bCkt\s*#?\d+[A-Z]?\b/gi, // circuit numbers
      /\b\d+\/\d+\b/g, // circuit numbers like 1/3, 2/4
      /\b\d+"?\s*(EMT|RGC|PVC|MC|AC)\b/gi, // conduit sizes
    ]
  },
  
  // Fire alarm and low voltage
  fireAlarm: {
    devices: ['FACU', 'FACP', 'NAC', 'SLC', 'ANN', 'HS', 'PS', 'SD', 'PD', 'DUCT', 'WF'],
    patterns: [
      /\b(FACU|FACP|NAC|SLC|ANN|HS|PS|SD|PD|DUCT|WF)-?\d+[A-Z]?\b/gi,
      /\b[A-Z]{2,4}-\d{3,4}\b/gi, // device addresses like SD-0101
    ]
  }
};

/**
 * Identify query type to determine retrieval strategy
 */
export function classifyQueryIntent(query: string): {
  type: 'requirement' | 'measurement' | 'counting' | 'location' | 'room_specific' | 'mep' | 'takeoff' | 'general';
  requiresNotes: boolean;
  requiresCrossRef: boolean;
  requiresRegulatory: boolean;
  mepTrade?: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm';
  roomNumber?: string;
  isTakeoff?: boolean;
  takeoffScope?: string;
} {
  const queryLower = query.toLowerCase();
  
  // Takeoff queries (material takeoffs, estimates, quantities)
  const takeoffPatterns = [
    'takeoff',
    'take off',
    'material list',
    'quantity list',
    'count all',
    'list all',
    'how many total',
    'quantity of',
    'quantities',
    'estimate',
    'rollup',
    'material quantities',
    'export.*quantities',
    'estimator',
  ];
  
  const isTakeoff = takeoffPatterns.some(p => {
    if (p.includes('.*')) {
      return new RegExp(p, 'i').test(query);
    }
    return queryLower.includes(p);
  });
  
  // Extract takeoff scope if present
  let takeoffScope = 'general';
  if (isTakeoff) {
    if (/\b(hvac|mechanical|air|duct)\b/i.test(query)) {
      takeoffScope = 'hvac';
    } else if (/\b(plumbing|fixture|pipe|water)\b/i.test(query)) {
      takeoffScope = 'plumbing';
    } else if (/\b(electrical|power|lighting|panel|circuit)\b/i.test(query)) {
      takeoffScope = 'electrical';
    } else if (/\b(fire alarm|fa|smoke detector)\b/i.test(query)) {
      takeoffScope = 'fire_alarm';
    } else if (/\b(door|window|finish)\b/i.test(query)) {
      takeoffScope = 'architectural';
    } else if (/\b(structural|steel|concrete|rebar)\b/i.test(query)) {
      takeoffScope = 'structural';
    }
  }
  
  // Room-specific queries (ROOM 103, RM-103, etc.)
  const roomPattern = /\b(?:room|rm|space)\s*[:-]?\s*(\d{1,4}[A-Z]?|\d+[A-Z]+-\d+)\b/i;
  const roomMatch = query.match(roomPattern);
  const isRoomSpecific = roomMatch !== null;
  const roomNumber = roomMatch ? roomMatch[1].toUpperCase() : undefined;
  
  // Requirement queries (SHALL, REQUIRED, STANDARD, CODE)
  const requirementPatterns = [
    'what is required',
    'what standard',
    'what code',
    'requirement for',
    'shall',
    'must',
    'specification',
    'complian',
    'ada',
    'ibc',
    'nfpa',
  ];
  
  const isRequirement = requirementPatterns.some(p => queryLower.includes(p));
  
  // Measurement queries (including room-specific measurements like sqft)
  const measurementPatterns = [
    'how wide',
    'how deep',
    'how tall',
    'what dimension',
    'what size',
    'thickness',
    'clearance',
    'spacing',
    'height',
    'width',
    'depth',
    'distance',
    'sqft',
    'square feet',
    'area',
    'sf',
  ];
  
  const isMeasurement = measurementPatterns.some(p => queryLower.includes(p));
  
  // Counting queries
  const countingPatterns = [
    'how many',
    'count',
    'number of',
    'total',
    'quantity',
  ];
  
  const isCounting = countingPatterns.some(p => queryLower.includes(p));
  
  // Location queries (WHERE, WHAT SHEET)
  const locationPatterns = [
    'where',
    'what sheet',
    'which drawing',
    'location',
    'find',
    'show me',
    'locate',
  ];
  
  const isLocation = locationPatterns.some(p => queryLower.includes(p));
  
  // MEP queries (trade-specific)
  const mepPatterns = {
    hvac: [
      'hvac', 'ahu', 'rtu', 'vav', 'air handler', 'rooftop unit', 'fan coil', 
      'make-up air', 'erv', 'hrv', 'ductwork', 'supply air', 'return air', 
      'exhaust', 'ventilation', 'cfm', 'air flow'
    ],
    plumbing: [
      'plumbing', 'water', 'waste', 'vent', 'drain', 'sanitary', 'storm',
      'fixture', 'wc', 'lav', 'urinal', 'sink', 'shower', 'hws', 'cws',
      'hot water', 'cold water', 'pipe size', 'gpm'
    ],
    electrical: [
      'electrical', 'power', 'panel', 'circuit', 'breaker', 'voltage', 
      'amperage', 'receptacle', 'switch', 'lighting', 'conduit', 'feeder',
      'branch circuit', 'gfci', 'watts', 'kva'
    ],
    fire_alarm: [
      'fire alarm', 'smoke detector', 'heat detector', 'pull station',
      'horn strobe', 'notification', 'facp', 'facu', 'nac', 'slc'
    ]
  };
  
  let mepTrade: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm' | undefined = undefined;
  let isMEP = false;
  
  for (const [trade, patterns] of Object.entries(mepPatterns)) {
    if (patterns.some(p => queryLower.includes(p))) {
      mepTrade = trade as any;
      isMEP = true;
      break;
    }
  }
  
  // Regulatory references
  const hasRegulatoryRef = /\b(ada|ibc|nfpa|astm|asce|aci)\b/i.test(query);
  
  // Determine if cross-referencing is needed
  const crossRefIndicators = [
    'detail',
    'schedule',
    'door',
    'window',
    'fixture',
    'panel',
    'see drawing',
    'typical',
    'room',
    'equipment',
    'riser',
    'one-line',
  ];
  const needsCrossRef = crossRefIndicators.some(p => queryLower.includes(p)) || isRoomSpecific || isMEP;
  
  // Determine primary type
  let type: 'requirement' | 'measurement' | 'counting' | 'location' | 'room_specific' | 'mep' | 'takeoff' | 'general' = 'general';
  
  if (isTakeoff) {
    type = 'takeoff';
  } else if (isMEP) {
    type = 'mep';
  } else if (isRoomSpecific) {
    type = 'room_specific';
  } else if (isRequirement) {
    type = 'requirement';
  } else if (isMeasurement) {
    type = 'measurement';
  } else if (isCounting) {
    type = 'counting';
  } else if (isLocation) {
    type = 'location';
  }
  
  return {
    type,
    requiresNotes: isRequirement || isMEP || isTakeoff, // Takeoffs also need notes and schedules
    requiresCrossRef: needsCrossRef || isTakeoff, // Takeoffs always need cross-refs
    requiresRegulatory: hasRegulatoryRef,
    mepTrade,
    roomNumber,
    isTakeoff,
    takeoffScope,
  };
}

/**
 * Two-pass retrieval: Precision pass (exact identifiers) + Context pass (supporting chunks)
 */
export async function twoPassRetrieval(
  query: string,
  projectSlug: string,
  userRole: 'admin' | 'client' | 'guest' | 'pending',
  limit: number = 12
): Promise<{ chunks: EnhancedChunk[]; retrievalLog: string[] }> {
  const log: string[] = [];
  
  // Identify query intent
  const intent = classifyQueryIntent(query);
  log.push(`Query intent: ${intent.type}, notes=${intent.requiresNotes}, crossRef=${intent.requiresCrossRef}`);
  
  const precisionChunks: EnhancedChunk[] = [];
  const contextChunks: EnhancedChunk[] = [];
  
  // Get project ID
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });
  
  if (!project) {
    log.push('Project not found');
    return { chunks: [], retrievalLog: log };
  }
  
  // Base where clause for access control
  const baseWhere: any = {
    projectId: project.id,
    processed: true,
  };
  
  if (userRole === 'guest') {
    baseWhere.accessLevel = 'guest';
  } else if (userRole === 'client') {
    baseWhere.accessLevel = { in: ['client', 'guest'] };
  }
  
  // PASS 1: Precision retrieval for exact identifiers
  const identifiers = extractIdentifiers(query);
  log.push(`Extracted identifiers: ${identifiers.join(', ') || 'none'}`);
  
  if (identifiers.length > 0) {
    const precisionQuery = await prisma.document.findMany({
      where: baseWhere,
      include: {
        DocumentChunk: {
          where: {
            OR: identifiers.map(id => ({
              content: { contains: id, mode: 'insensitive' },
            })),
          },
          take: 10,
        },
      },
    });
    
    for (const doc of precisionQuery) {
      for (const chunk of doc.DocumentChunk) {
        precisionChunks.push({
          ...chunk,
          metadata: {
            ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
            documentName: doc.name,
          },
          retrievalMethod: 'precision',
        });
      }
    }
    log.push(`Precision pass: ${precisionChunks.length} chunks`);
  }
  
  // PASS 2: Notes-first approach for requirement queries
  if (intent.requiresNotes) {
    const notesQuery = await prisma.document.findMany({
      where: baseWhere,
      include: {
        DocumentChunk: {
          where: {
            OR: [
              { content: { contains: 'GENERAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'STRUCTURAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'ARCHITECTURAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'MECHANICAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'ELECTRICAL NOTES', mode: 'insensitive' } },
              { content: { contains: 'PLUMBING NOTES', mode: 'insensitive' } },
              { content: { contains: 'SHALL', mode: 'insensitive' } },
              { content: { contains: 'REQUIRED', mode: 'insensitive' } },
            ],
          },
          take: 8,
        },
      },
    });
    
    for (const doc of notesQuery) {
      for (const chunk of doc.DocumentChunk) {
        contextChunks.push({
          ...chunk,
          metadata: {
            ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
            documentName: doc.name,
          },
          retrievalMethod: 'notes_first',
        });
      }
    }
    log.push(`Notes-first pass: ${contextChunks.length} chunks`);
  }
  
  // PASS 3: Context retrieval with keyword matching
  const keywords = extractKeywords(query);
  const contextQuery = await prisma.document.findMany({
    where: baseWhere,
    include: {
      DocumentChunk: {
        where: {
          OR: keywords.slice(0, 5).map(kw => ({
            content: { contains: kw, mode: 'insensitive' },
          })),
        },
        take: limit - precisionChunks.length - contextChunks.length,
      },
    },
  });
  
  for (const doc of contextQuery) {
    for (const chunk of doc.DocumentChunk) {
      // Avoid duplicates
      const isDuplicate = [...precisionChunks, ...contextChunks].some(c => c.id === chunk.id);
      if (!isDuplicate) {
        contextChunks.push({
          ...chunk,
          metadata: {
            ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
            documentName: doc.name,
          },
          retrievalMethod: 'context',
        });
      }
    }
  }
  log.push(`Context pass: ${contextChunks.length} total context chunks`);
  
  // Combine with preference for precision chunks
  const allChunks = [...precisionChunks, ...contextChunks].slice(0, limit);
  log.push(`Final retrieval: ${allChunks.length} chunks (${precisionChunks.length} precision, ${contextChunks.length - (allChunks.length - precisionChunks.length)} context)`);
  
  return { chunks: allChunks, retrievalLog: log };
}

/**
 * Extract identifiers from query (sheet numbers, detail tags, door marks, etc.)
 */
function extractIdentifiers(query: string): string[] {
  const identifiers: string[] = [];
  
  // Room numbers (Room 103, RM-103, etc.)
  const roomPattern = /\b(?:room|rm|space)\s*[:-]?\s*(\d{1,4}[A-Z]?|\d+[A-Z]+-\d+)\b/gi;
  let roomMatch;
  while ((roomMatch = roomPattern.exec(query)) !== null) {
    identifiers.push(roomMatch[1].toUpperCase());
    identifiers.push(`ROOM ${roomMatch[1].toUpperCase()}`);
    identifiers.push(`RM ${roomMatch[1].toUpperCase()}`);
  }
  
  // Sheet numbers (S-001, A-101, M-201, etc.)
  const sheetPattern = /\b[A-Z]-?\d{1,3}\b/gi;
  const sheets = query.match(sheetPattern);
  if (sheets) identifiers.push(...sheets);
  
  // Detail tags (3/A401, 5/S102, etc.)
  const detailPattern = /\b\d+\/[A-Z]-?\d{1,3}\b/gi;
  const details = query.match(detailPattern);
  if (details) identifiers.push(...details);
  
  // Door/window marks (D-101, W-201, etc.)
  const markPattern = /\b[DW]-?\d{1,3}\b/gi;
  const marks = query.match(markPattern);
  if (marks) identifiers.push(...marks);
  
  // Panel IDs (RP-1, LP-2A, etc.)
  const panelPattern = /\b[A-Z]{1,3}P-?\d+[A-Z]?\b/gi;
  const panels = query.match(panelPattern);
  if (panels) identifiers.push(...panels);
  
  // Standards (ADA 2010, IBC 2021, etc.)
  const standardPattern = /\b(ADA|IBC|NFPA|ASTM|ASCE|ACI)\s*\d{4}\b/gi;
  const standards = query.match(standardPattern);
  if (standards) identifiers.push(...standards);
  
  // MEP ENTITIES - HVAC
  for (const pattern of MEP_ENTITIES.hvac.patterns) {
    const matches = query.match(pattern);
    if (matches) identifiers.push(...matches);
  }
  
  // MEP ENTITIES - Plumbing
  for (const pattern of MEP_ENTITIES.plumbing.patterns) {
    const matches = query.match(pattern);
    if (matches) identifiers.push(...matches);
  }
  
  // MEP ENTITIES - Electrical
  for (const pattern of MEP_ENTITIES.electrical.patterns) {
    const matches = query.match(pattern);
    if (matches) identifiers.push(...matches);
  }
  
  // MEP ENTITIES - Fire Alarm
  for (const pattern of MEP_ENTITIES.fireAlarm.patterns) {
    const matches = query.match(pattern);
    if (matches) identifiers.push(...matches);
  }
  
  return identifiers;
}

/**
 * Simple keyword extraction (reused from main rag.ts)
 */
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with',
    'to', 'for', 'of', 'as', 'by', 'from', 'what', 'how', 'when', 'where', 'who',
  ]);
  
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => {
      const cleaned = word.replace(/[^a-z0-9]/g, '');
      return cleaned.length > 2 && !stopWords.has(cleaned);
    });
}

/**
 * Cross-reference bundling: Find related chunks (e.g., door tag → schedule, detail callout → detail sheet)
 */
export async function bundleCrossReferences(
  chunks: EnhancedChunk[],
  projectSlug: string
): Promise<{ enrichedChunks: EnhancedChunk[]; crossRefLog: string[] }> {
  const log: string[] = [];
  const enrichedChunks: EnhancedChunk[] = [...chunks];
  
  // Get project ID
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });
  
  if (!project) {
    return { enrichedChunks, crossRefLog: ['Project not found'] };
  }
  
  // Extract cross-reference hints from existing chunks
  const crossRefs = new Set<string>();
  
  for (const chunk of chunks) {
    const content = chunk.content;
    
    // Look for door/window references
    const doorMatches = content.match(/\b[DW]-?\d{1,3}\b/gi);
    if (doorMatches) {
      doorMatches.forEach(m => crossRefs.add(m));
    }
    
    // Look for detail callouts
    const detailMatches = content.match(/\b\d+\/[A-Z]-?\d{1,3}\b/gi);
    if (detailMatches) {
      detailMatches.forEach(m => crossRefs.add(m));
    }
    
    // Look for "See schedule" references
    if (/see (door|window|fixture|equipment|panel) schedule/i.test(content)) {
      crossRefs.add('SCHEDULE');
    }
  }
  
  log.push(`Found ${crossRefs.size} cross-reference hints`);
  
  // Fetch cross-referenced chunks
  if (crossRefs.size > 0) {
    const crossRefChunks = await prisma.document.findMany({
      where: {
        projectId: project.id,
        processed: true,
      },
      include: {
        DocumentChunk: {
          where: {
            OR: Array.from(crossRefs).map(ref => ({
              content: { contains: ref, mode: 'insensitive' },
            })),
          },
          take: 5,
        },
      },
    });
    
    for (const doc of crossRefChunks) {
      for (const chunk of doc.DocumentChunk) {
        // Avoid duplicates
        const isDuplicate = enrichedChunks.some(c => c.id === chunk.id);
        if (!isDuplicate) {
          enrichedChunks.push({
            ...chunk,
            metadata: {
              ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
              documentName: doc.name,
            },
            retrievalMethod: 'cross_reference',
          });
        }
      }
    }
    
    log.push(`Added ${enrichedChunks.length - chunks.length} cross-referenced chunks`);
  }
  
  return { enrichedChunks, crossRefLog: log };
}

/**
 * MEP-Specific Retrieval Order:
 * 1) Applicable schedule row (equipment, fixture, panel, lighting)
 * 2) System keynotes and general notes
 * 3) Plan view containing the relevant tag or symbol
 * 4) Riser, isometric, or one-line diagram
 * 5) Spec references (if provided)
 */
export async function mepRetrievalOrder(
  chunks: EnhancedChunk[],
  projectSlug: string,
  mepTrade: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm',
  identifiers: string[]
): Promise<{ orderedChunks: EnhancedChunk[]; mepLog: string[] }> {
  const log: string[] = [];
  const orderedChunks: EnhancedChunk[] = [];
  const chunkIds = new Set<string>();
  
  log.push(`MEP Trade: ${mepTrade}, Identifiers: ${identifiers.join(', ')}`);
  
  // Helper function to add unique chunks
  const addChunk = (chunk: EnhancedChunk, source: string) => {
    if (!chunkIds.has(chunk.id)) {
      orderedChunks.push({ ...chunk, sourceReference: source });
      chunkIds.add(chunk.id);
    }
  };
  
  // PRIORITY 1: Schedule rows
  const scheduleChunks = chunks.filter(c => 
    /\b(schedule|legend|symbol|key)\b/i.test(c.content) &&
    identifiers.some(id => new RegExp(id, 'i').test(c.content))
  );
  scheduleChunks.forEach(c => addChunk(c, 'MEP Schedule'));
  log.push(`Schedules: ${scheduleChunks.length} chunks`);
  
  // PRIORITY 2: System keynotes and general notes
  const notePatterns = [
    /\b(MECHANICAL|ELECTRICAL|PLUMBING|FIRE ALARM)\s+(GENERAL\s+)?NOTES\b/i,
    /\bKEY\s*NOTES\b/i,
    /\bSYSTEM\s+NOTES\b/i,
  ];
  const noteChunks = chunks.filter(c => 
    notePatterns.some(p => p.test(c.content))
  );
  noteChunks.forEach(c => addChunk(c, 'MEP Notes'));
  log.push(`Notes: ${noteChunks.length} chunks`);
  
  // PRIORITY 3: Plan view with equipment tags
  const planChunks = chunks.filter(c => 
    /\b(PLAN|LAYOUT|FLOOR)\b/i.test(c.content) &&
    identifiers.some(id => new RegExp(id, 'i').test(c.content))
  );
  planChunks.forEach(c => addChunk(c, 'MEP Plan View'));
  log.push(`Plan Views: ${planChunks.length} chunks`);
  
  // PRIORITY 4: Diagrams (riser, one-line, isometric, schematic)
  const diagramPatterns = [
    /\b(RISER|ISOMETRIC|ONE-LINE|SCHEMATIC|DIAGRAM)\b/i,
  ];
  const diagramChunks = chunks.filter(c => 
    diagramPatterns.some(p => p.test(c.content))
  );
  diagramChunks.forEach(c => addChunk(c, 'MEP Diagram'));
  log.push(`Diagrams: ${diagramChunks.length} chunks`);
  
  // PRIORITY 5: Spec references
  const specChunks = chunks.filter(c => 
    /\b(SPEC|SPECIFICATION|DIVISION\s+\d{2})\b/i.test(c.content)
  );
  specChunks.forEach(c => addChunk(c, 'MEP Specifications'));
  log.push(`Specs: ${specChunks.length} chunks`);
  
  // Add remaining chunks not captured
  chunks.forEach(c => {
    if (!chunkIds.has(c.id)) {
      orderedChunks.push({ ...c, sourceReference: 'Additional Context' });
    }
  });
  
  log.push(`Total ordered: ${orderedChunks.length} chunks`);
  return { orderedChunks, mepLog: log };
}


/**
 * Extract measurement information with hierarchy: explicit > scaled > unavailable
 */
export function extractMeasurement(chunk: EnhancedChunk, query: string): MeasurementInfo | null {
  const content = chunk.content;
  const queryLower = query.toLowerCase();
  
  // Priority 1: Explicit written dimensions
  const dimensionPatterns = [
    // Standard formats: 12'-6", 3'-0", 18"
    /\b\d+'-\d+"\b/g,
    /\b\d+"\b/g,
    /\b\d+'-\d+\b/g,
    // Decimal formats: 12.5 ft, 3.75 inches
    /\b\d+\.\d+\s*(ft|feet|in|inch|inches)\b/gi,
    // Spacing: #4 @ 12" O.C.
    /#\d+\s*@\s*\d+"\s*O\.?C\.?/gi,
    // Clearances: min. 36" clear
    /min\.?\s*\d+"\s*clear/gi,
  ];
  
  for (const pattern of dimensionPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return {
        value: matches[0],
        unit: extractUnit(matches[0]),
        method: 'explicit',
        source: `${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}`,
        isLegible: true,
        confidence: 'high',
      };
    }
  }
  
  // Priority 2: Scaled measurements (only if scale is available)
  const hasScale = chunk.metadata?.scale && !chunk.metadata?.scale.includes('NTS');
  if (hasScale) {
    // Check if chunk mentions scaled elements
    if (/\b(measured|scaled|calculated)\b/i.test(content)) {
      return {
        value: 'Available via scale measurement',
        unit: 'varies',
        method: 'scaled',
        source: `${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}, Scale: ${chunk.metadata?.scale}`,
        isLegible: true,
        confidence: 'medium',
      };
    }
  }
  
  // Priority 3: Not available
  return {
    value: 'Not specified in provided documents',
    unit: 'N/A',
    method: 'unavailable',
    source: `Searched ${chunk.metadata?.documentName || 'Unknown'}`,
    isLegible: false,
    confidence: 'low',
  };
}

function extractUnit(measurement: string): string {
  if (measurement.includes("'") || /ft|feet/i.test(measurement)) return 'feet';
  if (measurement.includes('"') || /in|inch/i.test(measurement)) return 'inches';
  if (/o\.?c/i.test(measurement)) return 'on center';
  return 'unknown';
}

/**
 * Validate OCR content for legibility and completeness
 */
export function validateOCR(chunk: EnhancedChunk): {
  isLegible: boolean;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
} {
  const content = chunk.content;
  const issues: string[] = [];
  
  // Check for common OCR errors
  const suspiciousPatterns = [
    // Excessive special characters
    /[^a-zA-Z0-9\s,.;:'"-/()]{5,}/,
    // Garbled text (alternating case with no spaces)
    /[a-z][A-Z][a-z][A-Z][a-z]{5,}/,
    // Excessive whitespace
    /\s{10,}/,
    // Nonsense words
    /\b[bcdfghjklmnpqrstvwxyz]{7,}\b/i,
  ];
  
  let suspiciousCount = 0;
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      suspiciousCount++;
    }
  }
  
  if (suspiciousCount >= 2) {
    issues.push('Content contains multiple OCR error patterns');
  }
  
  // Check for truncated content
  if (content.length < 50 && chunk.pageNumber) {
    issues.push('Content appears truncated or incomplete');
  }
  
  // Check for missing critical sections
  const metadata = chunk.metadata || {};
  if (metadata.chunkType === 'page_overview' && content.length < 200) {
    issues.push('Page overview unusually short, may be incomplete');
  }
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (issues.length === 1) confidence = 'medium';
  if (issues.length >= 2) confidence = 'low';
  
  const isLegible = confidence !== 'low';
  
  return { isLegible, confidence, issues };
}

/**
 * Self-check validation before generating response
 */
export function validateBeforeResponse(
  query: string,
  chunks: EnhancedChunk[],
  proposedAnswer: string
): ValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Check 1: Do we have any chunks?
  if (chunks.length === 0) {
    issues.push('No document chunks retrieved for this query');
  }
  
  // Check 2: Are chunks legible?
  const illegibleChunks = chunks.filter(c => {
    const validation = validateOCR(c);
    return !validation.isLegible;
  });
  
  if (illegibleChunks.length > 0) {
    warnings.push(`${illegibleChunks.length} chunks have low OCR confidence`);
  }
  
  // Check 3: Does answer contain unreadable text claims?
  if (/not legible|illegible|unclear|unreadable/i.test(proposedAnswer)) {
    // This is OK if we genuinely can't read it
    if (illegibleChunks.length === 0) {
      warnings.push('Answer claims text is illegible, but OCR validation passed');
    }
  }
  
  // Check 4: Does answer make assumptions?
  const assumptionIndicators = [
    'typically',
    'usually',
    'generally',
    'assumed',
    'likely',
    'probably',
    'may be',
    'could be',
    'standard practice',
  ];
  
  const hasAssumptions = assumptionIndicators.some(ind => 
    proposedAnswer.toLowerCase().includes(ind)
  );
  
  if (hasAssumptions && chunks.length < 3) {
    warnings.push('Answer contains assumptions with limited document evidence');
  }
  
  // Check 5: Are sources traceable?
  const hasSources = /\[(.*?)\]|Source:|Page \d+|Sheet [A-Z]-\d+/i.test(proposedAnswer);
  if (!hasSources && chunks.length > 0) {
    warnings.push('Answer lacks source citations despite available chunks');
  }
  
  // Check 6: Measurement queries should include sourcing
  const intent = classifyQueryIntent(query);
  if (intent.type === 'measurement') {
    const hasMeasurementSource = /explicit|scaled|measured|Source:/i.test(proposedAnswer);
    if (!hasMeasurementSource) {
      warnings.push('Measurement query answer lacks measurement sourcing information');
    }
  }
  
  const passed = issues.length === 0;
  
  return { passed, issues, warnings };
}

/**
 * Generate enhanced context with validation markers
 */
export function generateEnhancedContext(
  chunks: EnhancedChunk[],
  query: string
): string {
  const intent = classifyQueryIntent(query);
  let context = '';
  
  // Add protocol header
  context += '=== DOCUMENT RETRIEVAL PROTOCOL ===\n';
  context += `Query Type: ${intent.type.toUpperCase()}\n`;
  if (intent.mepTrade) {
    context += `MEP Trade: ${intent.mepTrade.toUpperCase()}\n`;
  }
  if (intent.roomNumber) {
    context += `Room Number: ${intent.roomNumber}\n`;
  }
  context += `Notes-First Required: ${intent.requiresNotes}\n`;
  context += `Cross-Reference Required: ${intent.requiresCrossRef}\n`;
  context += `Regulatory Check Required: ${intent.requiresRegulatory}\n\n`;
  
  // Add validation instructions
  context += '=== RESPONSE GUIDELINES ===\n';
  context += '1. Do NOT make assumptions about content not explicitly shown\n';
  context += '2. If text is unclear or unreadable, state: "Not legible in provided documents"\n';
  context += '3. For measurements: Report value, unit, method (explicit/scaled), and source\n';
  context += '4. For requirements: Prioritize General Notes and mandatory language (SHALL, REQUIRED)\n';
  context += '5. Always cite sources with document name and page/sheet number\n';
  context += '6. Flag any discrepancies between documents\n';
  
  // Add MEP-specific instructions
  if (intent.type === 'mep') {
    context += '\n=== MEP-SPECIFIC INSTRUCTIONS ===\n';
    context += '1. Link device tags ↔ circuit/pipe/duct ↔ schedules ↔ diagrams (where available)\n';
    context += '2. For diagrams (one-lines/risers): Treat as non-scale unless explicitly shown\n';
    context += '3. Do NOT infer routing, continuity, or connections beyond what is explicitly shown\n';
    context += '4. For abbreviations: Use project legend first; if missing, ask user\n';
    context += '5. For codes: Only reference codes explicitly cited in plans/specs\n';
    context += '6. Use non-authoritative compliance language (e.g., "appears consistent with...")\n';
    context += '7. For electrical: Report panel → circuit → device linkage only if documented\n';
    context += '8. For schedule dates: Compare to current date (December 20, 2025) if available\n';
  }
  
  // Add TAKEOFF-specific instructions
  if (intent.type === 'takeoff' || intent.isTakeoff) {
    context += '\n=== MATERIAL TAKEOFF INSTRUCTIONS ===\n';
    context += '⚠️ CRITICAL TAKEOFF RULES:\n';
    context += '1. Count/measure ONLY items explicitly shown, tagged, or scheduled\n';
    context += '2. Do NOT infer: routing, spacing, drops, concealed scope, or standard practices\n';
    context += '3. No waste factor unless explicitly requested by user\n';
    context += '4. Separate quantities into: Counted | Measured | Not Quantified\n\n';
    context += 'TRADE-SPECIFIC TAKEOFF RULES:\n';
    context += '• HVAC: Count equipment/devices from schedules. Measure ductwork ONLY if routing clearly shown and scaled.\n';
    context += '• Plumbing: Count fixtures from schedules. Measure piping ONLY if routing clearly shown and scaled.\n';
    context += '• Electrical: Count panels/devices/lighting. Measure conduit ONLY if explicitly shown and scaled.\n';
    context += '• Fire Alarm: Count devices/panels ONLY. Do NOT estimate cable/loop lengths.\n\n';
    context += 'CONFIDENCE SCORING:\n';
    context += '• HIGH: Schedule-based counts or explicitly dimensioned items\n';
    context += '• MEDIUM: Scaled quantities with visible scale or multiple sources\n';
    context += '• LOW: Partial documents, unreadable areas, or missing schedules\n\n';
    context += 'REQUIRED FIELDS FOR EACH ITEM:\n';
    context += 'Trade | System | Item_Type | Item_Tag_or_ID | Description | Quantity | Unit | Size_or_Rating |\n';
    context += 'Method (Counted/Dimensioned/Scaled/Not_Quantified) | Source_Refs | Exclusions_or_Notes |\n';
    context += 'Confidence | Confidence_Basis\n\n';
    context += 'WARNINGS TO FLAG:\n';
    context += '• "By Others" / NIC / Owner-furnished items\n';
    context += '• Potential duplicate counts across views\n';
    context += '• Non-IFC or early design status (SD/DD/90%)\n\n';
    context += 'OUTPUT STANDARD DISCLAIMERS:\n';
    context += '1. "Quantities based solely on provided documents and exclude unshown or inferred scope"\n';
    context += '2. "No waste factor applied - add appropriate overage per company standards"\n';
    context += '3. "Counts include only explicitly tagged or scheduled items"\n';
  }
  context += '\n';
  
  // Group chunks by retrieval method
  const precisionChunks = chunks.filter(c => c.retrievalMethod === 'precision');
  const notesChunks = chunks.filter(c => c.retrievalMethod === 'notes_first');
  const crossRefChunks = chunks.filter(c => c.retrievalMethod === 'cross_reference');
  const contextChunks = chunks.filter(c => c.retrievalMethod === 'context');
  
  // Add precision chunks first (highest priority)
  if (precisionChunks.length > 0) {
    context += '=== PRECISION MATCHES (Exact Identifiers) ===\n';
    precisionChunks.forEach((chunk, i) => {
      const validation = validateOCR(chunk);
      context += `\n[Precision Match ${i + 1}]\n`;
      context += `Source: ${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}\n`;
      context += `OCR Confidence: ${validation.confidence.toUpperCase()}\n`;
      if (!validation.isLegible) {
        context += `⚠️ WARNING: Low OCR confidence - ${validation.issues.join(', ')}\n`;
      }
      context += `Content:\n${chunk.content}\n`;
      context += `---\n`;
    });
  }
  
  // Add notes chunks (for requirement queries)
  if (notesChunks.length > 0) {
    context += '\n=== GENERAL/KEYED NOTES (Requirements & Standards) ===\n';
    notesChunks.forEach((chunk, i) => {
      const validation = validateOCR(chunk);
      context += `\n[Note Section ${i + 1}]\n`;
      context += `Source: ${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}\n`;
      context += `OCR Confidence: ${validation.confidence.toUpperCase()}\n`;
      context += `Content:\n${chunk.content}\n`;
      context += `---\n`;
    });
  }
  
  // Add cross-referenced chunks
  if (crossRefChunks.length > 0) {
    context += '\n=== CROSS-REFERENCED CONTENT (Schedules, Details, Tags) ===\n';
    crossRefChunks.forEach((chunk, i) => {
      const validation = validateOCR(chunk);
      context += `\n[Cross-Reference ${i + 1}]\n`;
      context += `Source: ${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}\n`;
      context += `OCR Confidence: ${validation.confidence.toUpperCase()}\n`;
      context += `Content:\n${chunk.content}\n`;
      context += `---\n`;
    });
  }
  
  // Add context chunks
  if (contextChunks.length > 0) {
    context += '\n=== SUPPORTING CONTEXT ===\n';
    contextChunks.forEach((chunk, i) => {
      const validation = validateOCR(chunk);
      context += `\n[Context ${i + 1}]\n`;
      context += `Source: ${chunk.metadata?.documentName || 'Unknown'}, Page ${chunk.pageNumber || 'N/A'}\n`;
      context += `OCR Confidence: ${validation.confidence.toUpperCase()}\n`;
      context += `Content:\n${chunk.content}\n`;
      context += `---\n`;
    });
  }
  
  return context;
}
/**
 * Material Takeoff Functions
 * These functions extract quantifiable items from construction documents
 * following strict rules: count/measure only what's explicitly shown
 */

/**
 * Extract takeoff items from document chunks
 * Only counts/measures items explicitly shown in schedules, tags, or drawings
 */
export function extractTakeoffItems(
  chunks: EnhancedChunk[],
  scope: string,
  query: string
): TakeoffItem[] {
  const items: TakeoffItem[] = [];
  
  // Extract from schedules first (highest confidence)
  const scheduleChunks = chunks.filter(c => 
    /\b(schedule|legend|symbol)\b/i.test(c.content)
  );
  
  for (const chunk of scheduleChunks) {
    const scheduleItems = extractFromSchedule(chunk, scope);
    items.push(...scheduleItems);
  }
  
  // Extract from plan views (tags and labels)
  const planChunks = chunks.filter(c => 
    /\b(plan|layout|floor)\b/i.test(c.content) &&
    !scheduleChunks.includes(c)
  );
  
  for (const chunk of planChunks) {
    const planItems = extractFromPlan(chunk, scope, items);
    items.push(...planItems);
  }
  
  return items;
}

/**
 * Extract items from schedule chunks
 */
function extractFromSchedule(chunk: EnhancedChunk, scope: string): TakeoffItem[] {
  const items: TakeoffItem[] = [];
  const content = chunk.content;
  const docName = chunk.metadata?.documentName || 'Unknown';
  const pageNum = chunk.pageNumber || 'N/A';
  
  // Determine trade based on scope and chunk content
  let trade = scope.toUpperCase();
  if (trade === 'GENERAL') {
    if (/\b(hvac|mechanical|air)\b/i.test(content)) trade = 'HVAC';
    else if (/\b(plumb|fixture|water)\b/i.test(content)) trade = 'PLUMBING';
    else if (/\b(electrical|power|panel)\b/i.test(content)) trade = 'ELECTRICAL';
    else if (/\b(fire alarm|fa)\b/i.test(content)) trade = 'FIRE ALARM';
    else if (/\b(door|window)\b/i.test(content)) trade = 'ARCHITECTURAL';
  }
  
  // Extract equipment from HVAC schedules
  if (scope === 'hvac' || /\b(hvac|mechanical|equipment schedule)\b/i.test(content)) {
    // Pattern: AHU-1, RTU-2, VAV-103, etc.
    const equipMatches = content.matchAll(/\b(AHU|RTU|VAV|FCU|MAU|ERV|HRV)-?\d+[A-Z]?\b/gi);
    for (const match of equipMatches) {
      const tag = match[0];
      
      // Try to extract specs from same line
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));
      const description = tagLine ? tagLine.trim() : `${match[1]} Unit`;
      
      items.push({
        trade: 'HVAC',
        system: match[1],
        itemType: 'Equipment',
        itemTagOrId: tag,
        description,
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from equipment schedule',
        confidence: 'high',
        confidenceBasis: 'Explicitly listed in equipment schedule',
      });
    }
    
    // Extract air devices
    const deviceMatches = content.matchAll(/\b(EF|IF|RF|SF|TD|RD|SD)-?\d+\b/gi);
    for (const match of deviceMatches) {
      const tag = match[0];
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));
      
      items.push({
        trade: 'HVAC',
        system: 'Air Distribution',
        itemType: 'Device',
        itemTagOrId: tag,
        description: `${match[1]} - ${getDeviceDescription(match[1])}`,
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from schedule/legend',
        confidence: 'high',
        confidenceBasis: 'Explicitly tagged in documents',
      });
    }
  }
  
  // Extract plumbing fixtures
  if (scope === 'plumbing' || /\b(plumb|fixture schedule)\b/i.test(content)) {
    const fixtureMatches = content.matchAll(/\b(WC|LAV|UR|DF|FD|SH|BT)-?\d+[A-Z]?\b/gi);
    for (const match of fixtureMatches) {
      const tag = match[0];
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));
      
      items.push({
        trade: 'PLUMBING',
        system: 'Fixtures',
        itemType: getFixtureType(match[1]),
        itemTagOrId: tag,
        description: `${getFixtureDescription(match[1])}`,
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from fixture schedule',
        confidence: 'high',
        confidenceBasis: 'Explicitly listed in fixture schedule',
      });
    }
  }
  
  // Extract electrical panels and devices
  if (scope === 'electrical' || /\b(electrical|panel schedule)\b/i.test(content)) {
    // Panels
    const panelMatches = content.matchAll(/\b(MDP|MSB|SB|RP|LP|DP|PP|EM|LT|PNL)-?\d+[A-Z]?\b/gi);
    for (const match of panelMatches) {
      const tag = match[0];
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));
      
      items.push({
        trade: 'ELECTRICAL',
        system: 'Power Distribution',
        itemType: 'Panel',
        itemTagOrId: tag,
        description: `${getPanelDescription(match[1])}`,
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from panel schedule',
        confidence: 'high',
        confidenceBasis: 'Explicitly listed in panel schedule',
      });
    }
    
    // Receptacles and switches (count occurrences)
    const recCount = (content.match(/\bREC-?\d+\b/gi) || []).length;
    if (recCount > 0) {
      items.push({
        trade: 'ELECTRICAL',
        system: 'Branch Circuits',
        itemType: 'Receptacle',
        itemTagOrId: 'REC-*',
        description: 'Receptacles (all types)',
        quantity: recCount,
        unit: 'EA',
        sizeOrRating: '120V typical',
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from plan views and schedules',
        confidence: 'high',
        confidenceBasis: `${recCount} receptacle tags found in documents`,
      });
    }
  }
  
  // Extract fire alarm devices
  if (scope === 'fire_alarm' || /\b(fire alarm|device schedule)\b/i.test(content)) {
    const deviceMatches = content.matchAll(/\b(SD|HS|PS|PD|DUCT|WF)-?\d+[A-Z]?\b/gi);
    for (const match of deviceMatches) {
      const tag = match[0];
      const lines = content.split('\n');
      const tagLine = lines.find(l => l.includes(tag));
      
      items.push({
        trade: 'FIRE ALARM',
        system: 'Detection & Notification',
        itemType: getFADeviceType(match[1]),
        itemTagOrId: tag,
        description: getFADeviceDescription(match[1]),
        quantity: 1,
        unit: 'EA',
        sizeOrRating: extractSizeFromLine(tagLine || ''),
        method: 'counted',
        sourceRefs: [`${docName}, Page ${pageNum}`],
        exclusionsOrNotes: 'Counted from device schedule',
        confidence: 'high',
        confidenceBasis: 'Explicitly listed in fire alarm schedule',
      });
    }
  }
  
  return items;
}

/**
 * Extract items from plan views (only if tagged)
 */
function extractFromPlan(chunk: EnhancedChunk, scope: string, existingItems: TakeoffItem[]): TakeoffItem[] {
  const items: TakeoffItem[] = [];
  const content = chunk.content;
  const docName = chunk.metadata?.documentName || 'Unknown';
  const pageNum = chunk.pageNumber || 'N/A';
  
  // Only count items that are explicitly tagged but not already in schedules
  const existingTags = new Set(existingItems.map(i => i.itemTagOrId));
  
  // This function intentionally does NOT measure ductwork, piping, or conduit
  // unless routing is clearly dimensioned and scaled - which requires explicit user request
  
  return items;
}

/**
 * Calculate confidence score for a takeoff item
 */
function calculateItemConfidence(
  item: TakeoffItem,
  chunks: EnhancedChunk[]
): { confidence: 'high' | 'medium' | 'low'; basis: string } {
  // High confidence: Schedule-based or explicitly dimensioned
  if (item.method === 'counted' && item.sourceRefs.some(r => /schedule/i.test(r))) {
    return {
      confidence: 'high',
      basis: 'Counted from schedule or equipment list',
    };
  }
  
  if (item.method === 'dimensioned' && item.sourceRefs.length >= 2) {
    return {
      confidence: 'high',
      basis: 'Explicitly dimensioned with multiple source confirmations',
    };
  }
  
  // Medium confidence: Scaled with visible scale
  if (item.method === 'scaled' && item.sourceRefs.some(r => /scale/i.test(r))) {
    return {
      confidence: 'medium',
      basis: 'Scaled measurement with documented scale',
    };
  }
  
  // Low confidence: Incomplete data
  if (item.method === 'not_quantified') {
    return {
      confidence: 'low',
      basis: 'Insufficient information to quantify',
    };
  }
  
  return {
    confidence: 'medium',
    basis: 'Single source or partial documentation',
  };
}

/**
 * Generate rollups by grouping criteria
 */
export function generateRollups(
  items: TakeoffItem[],
  groupBy: 'trade' | 'system' | 'size' | 'item_type'
): TakeoffRollup[] {
  const rollups: TakeoffRollup[] = [];
  const groups = new Map<string, TakeoffItem[]>();
  
  // Group items
  for (const item of items) {
    let key: string;
    switch (groupBy) {
      case 'trade':
        key = item.trade;
        break;
      case 'system':
        key = `${item.trade}:${item.system}`;
        break;
      case 'size':
        key = `${item.itemType}:${item.sizeOrRating}`;
        break;
      case 'item_type':
        key = item.itemType;
        break;
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }
  
  // Create rollups
  for (const [key, groupItems] of groups) {
    const totalQty = groupItems.reduce((sum, item) => {
      return sum + (typeof item.quantity === 'number' ? item.quantity : 0);
    }, 0);
    
    // Inherit lowest confidence
    const lowestConfidence = groupItems.reduce((lowest, item) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[item.confidence] < confidenceOrder[lowest] ? item.confidence : lowest;
    }, 'high' as 'high' | 'medium' | 'low');
    
    const [groupValue, system] = key.includes(':') ? key.split(':') : [key, undefined];
    
    rollups.push({
      trade: groupItems[0].trade,
      system,
      groupBy,
      groupValue,
      totalQuantity: totalQty,
      unit: groupItems[0].unit,
      itemCount: groupItems.length,
      confidence: lowestConfidence,
      confidenceBasis: `Rolled up from ${groupItems.length} line items`,
      items: groupItems,
    });
  }
  
  return rollups;
}

/**
 * Generate estimator-ready export format
 */
export function generateTakeoffExport(
  items: TakeoffItem[],
  projectName: string,
  userName: string,
  scope: string,
  includeRollups: boolean = false
): TakeoffResult {
  const warnings: string[] = [];
  const disclaimers: string[] = [];
  
  // Count items by method
  const countedItems = items.filter(i => i.method === 'counted').length;
  const measuredItems = items.filter(i => i.method === 'dimensioned' || i.method === 'scaled').length;
  const notQuantifiedItems = items.filter(i => i.method === 'not_quantified').length;
  
  // Add standard disclaimers
  disclaimers.push(
    'ESTIMATOR NOTE: Quantities are based solely on provided documents and exclude unshown or inferred scope.'
  );
  disclaimers.push(
    'No waste factor has been applied. Add appropriate waste/overage per your company standards.'
  );
  disclaimers.push(
    'Counts include only explicitly tagged or scheduled items. Verify against full document set.'
  );
  
  // Detect potential issues
  if (notQuantifiedItems > 0) {
    warnings.push(
      `${notQuantifiedItems} item(s) could not be quantified due to insufficient information.`
    );
  }
  
  // Check for "By Others" references
  const byOthersItems = items.filter(i => 
    /\b(by others|n\.?i\.?c|owner[ -]furnished)\b/i.test(i.exclusionsOrNotes)
  );
  if (byOthersItems.length > 0) {
    warnings.push(
      `${byOthersItems.length} item(s) flagged as "By Others" or NIC. Verify scope boundaries.`
    );
  }
  
  const result: TakeoffResult = {
    projectName,
    generatedDate: new Date().toISOString(),
    requestedBy: userName,
    scope: scope.toUpperCase(),
    items,
    warnings,
    disclaimers,
    totalItems: items.length,
    countedItems,
    measuredItems,
    notQuantifiedItems,
  };
  
  if (includeRollups) {
    result.rollups = [
      ...generateRollups(items, 'trade'),
      ...generateRollups(items, 'system'),
    ];
  }
  
  return result;
}

/**
 * Helper functions for descriptions
 */
function getDeviceDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    'EF': 'Exhaust Fan',
    'IF': 'Inline Fan',
    'RF': 'Return Fan',
    'SF': 'Supply Fan',
    'TD': 'Transfer Duct',
    'RD': 'Return Diffuser',
    'SD': 'Supply Diffuser',
    'ED': 'Exhaust Damper',
    'GD': 'Grille Diffuser',
  };
  return descriptions[tag.toUpperCase()] || tag;
}

function getFixtureType(tag: string): string {
  const types: Record<string, string> = {
    'WC': 'Water Closet',
    'LAV': 'Lavatory',
    'UR': 'Urinal',
    'DF': 'Drinking Fountain',
    'FD': 'Floor Drain',
    'SH': 'Shower',
    'BT': 'Bathtub',
  };
  return types[tag.toUpperCase()] || 'Fixture';
}

function getFixtureDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    'WC': 'Water Closet (Toilet)',
    'LAV': 'Lavatory (Sink)',
    'UR': 'Urinal',
    'DF': 'Drinking Fountain',
    'FD': 'Floor Drain',
    'SH': 'Shower',
    'BT': 'Bathtub',
    'HB': 'Hose Bibb',
    'MOP': 'Mop Sink',
  };
  return descriptions[tag.toUpperCase()] || tag;
}

function getPanelDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    'MDP': 'Main Distribution Panel',
    'MSB': 'Main Switchboard',
    'SB': 'Switchboard',
    'RP': 'Receptacle Panel',
    'LP': 'Lighting Panel',
    'DP': 'Distribution Panel',
    'PP': 'Power Panel',
    'EM': 'Emergency Panel',
    'LT': 'Lighting Panel',
    'PNL': 'Panel',
  };
  return descriptions[tag.toUpperCase()] || `${tag} Panel`;
}

function getFADeviceType(tag: string): string {
  const types: Record<string, string> = {
    'SD': 'Smoke Detector',
    'HS': 'Horn/Strobe',
    'PS': 'Pull Station',
    'PD': 'Photoelectric Detector',
    'DUCT': 'Duct Detector',
    'WF': 'Water Flow',
  };
  return types[tag.toUpperCase()] || 'Device';
}

function getFADeviceDescription(tag: string): string {
  const descriptions: Record<string, string> = {
    'SD': 'Smoke Detector',
    'HS': 'Horn/Strobe (Notification)',
    'PS': 'Manual Pull Station',
    'PD': 'Photoelectric Smoke Detector',
    'DUCT': 'Duct Smoke Detector',
    'WF': 'Water Flow Switch',
  };
  return descriptions[tag.toUpperCase()] || tag;
}

function extractSizeFromLine(line: string): string {
  // Try to extract size/rating from line
  // CFM for HVAC
  const cfmMatch = line.match(/\b(\d+,?\d*)\s*CFM\b/i);
  if (cfmMatch) return `${cfmMatch[1]} CFM`;
  
  // GPM for plumbing
  const gpmMatch = line.match(/\b(\d+\.?\d*)\s*GPM\b/i);
  if (gpmMatch) return `${gpmMatch[1]} GPM`;
  
  // Amperage for electrical
  const ampMatch = line.match(/\b(\d+)\s*A(MP)?\b/i);
  if (ampMatch) return `${ampMatch[1]}A`;
  
  // Voltage
  const voltMatch = line.match(/\b(\d+)\s*V(OLT)?\b/i);
  if (voltMatch) return `${voltMatch[1]}V`;
  
  // HP
  const hpMatch = line.match(/\b(\d+\.?\d*)\s*HP\b/i);
  if (hpMatch) return `${hpMatch[1]} HP`;
  
  return 'See Schedule';
}

// ============================================================================
// FUTURE ENHANCEMENTS - PHASE 2
// ============================================================================

/**
 * Symbol Legend Parsing
 * Automatically extracts and parses symbol legends from MEP drawings
 */
export interface SymbolLegendItem {
  symbol: string;
  description: string;
  trade: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm';
  category: string;
  size?: string;
  sourceSheet: string;
}

export interface SymbolLegend {
  symbols: SymbolLegendItem[];
  sheet: string;
  trade: string;
  lastUpdated: Date;
}

export async function parseSymbolLegend(
  chunks: EnhancedChunk[],
  trade?: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm'
): Promise<SymbolLegend | null> {
  // Find legend chunks
  const legendChunks = chunks.filter(c => 
    c.chunkType === 'legend' || 
    c.content.toLowerCase().includes('legend') ||
    c.content.toLowerCase().includes('symbol') ||
    c.content.toLowerCase().includes('abbreviation')
  );

  if (legendChunks.length === 0) {
    return null;
  }

  const symbols: SymbolLegendItem[] = [];
  
  for (const chunk of legendChunks) {
    const lines = chunk.content.split('\n');
    let currentTrade = trade;
    
    // Detect trade from content if not specified
    if (!currentTrade) {
      if (chunk.content.match(/hvac|mechanical|air/i)) currentTrade = 'hvac';
      else if (chunk.content.match(/plumbing|water|drainage/i)) currentTrade = 'plumbing';
      else if (chunk.content.match(/electrical|power|lighting/i)) currentTrade = 'electrical';
      else if (chunk.content.match(/fire alarm|detection|notification/i)) currentTrade = 'fire_alarm';
    }

    for (const line of lines) {
      // Pattern: SYMBOL - DESCRIPTION or SYMBOL: DESCRIPTION
      const match = line.match(/^([A-Z0-9-]+)\s*[-:]\s*(.+)$/);
      if (match && currentTrade) {
        const [, symbol, description] = match;
        symbols.push({
          symbol: symbol.trim(),
          description: description.trim(),
          trade: currentTrade,
          category: categorizeSymbol(symbol, description),
          sourceSheet: `Sheet ${chunk.pageNumber || 'Unknown'}`,
        });
      }
    }
  }

  if (symbols.length === 0) {
    return null;
  }

  return {
    symbols,
    sheet: legendChunks[0].sourceReference || 'Unknown',
    trade: trade || 'multiple',
    lastUpdated: new Date(),
  };
}

function categorizeSymbol(symbol: string, description: string): string {
  const desc = description.toLowerCase();
  
  // HVAC categories
  if (desc.match(/supply|return|exhaust|fan/)) return 'ductwork';
  if (desc.match(/diffuser|grille|register/)) return 'air_distribution';
  if (desc.match(/unit|equipment|ahu|rtu/)) return 'equipment';
  
  // Plumbing categories
  if (desc.match(/water|domestic|cold|hot/)) return 'water_distribution';
  if (desc.match(/waste|drain|sanitary|vent/)) return 'drainage';
  if (desc.match(/fixture|toilet|sink|fountain/)) return 'fixtures';
  
  // Electrical categories
  if (desc.match(/panel|board|mcc/)) return 'distribution';
  if (desc.match(/receptacle|outlet/)) return 'devices';
  if (desc.match(/light|fixture|luminaire/)) return 'lighting';
  if (desc.match(/switch/)) return 'controls';
  
  // Fire Alarm categories
  if (desc.match(/detector|smoke|heat/)) return 'detection';
  if (desc.match(/horn|strobe|speaker/)) return 'notification';
  if (desc.match(/pull|manual/)) return 'manual_initiation';
  
  return 'other';
}

/**
 * MEP Coordination Conflict Detection
 * Detects potential clashes and coordination issues between MEP systems
 */
export interface CoordinationConflict {
  type: 'clash' | 'clearance' | 'access' | 'sequencing' | 'load';
  severity: 'critical' | 'major' | 'minor';
  systems: string[];
  location: string;
  description: string;
  recommendations: string[];
  sourceSheets: string[];
}

export async function detectMEPConflicts(
  chunks: EnhancedChunk[],
  projectSlug: string
): Promise<CoordinationConflict[]> {
  const conflicts: CoordinationConflict[] = [];

  // Detect vertical clearance issues
  const ceilingHeights = extractCeilingHeights(chunks);
  const equipmentLocations = extractEquipmentLocations(chunks);
  
  for (const equipment of equipmentLocations) {
    const room = equipment.room;
    const ceiling = ceilingHeights.find(c => c.room === room);
    
    if (ceiling && equipment.height && equipment.height >= ceiling.height) {
      conflicts.push({
        type: 'clearance',
        severity: 'critical',
        systems: [equipment.system],
        location: room,
        description: `${equipment.tag} (height: ${equipment.height}') exceeds ceiling height (${ceiling.height}')`,
        recommendations: [
          'Verify equipment clearances',
          'Consider alternate location or soffit',
          'Coordinate with architectural team'
        ],
        sourceSheets: [equipment.sourceSheet, ceiling.sourceSheet],
      });
    }
  }

  // Detect electrical load conflicts
  const panelLoads = calculatePanelLoads(chunks);
  for (const panel of panelLoads) {
    if (panel.calculatedLoad > panel.ratedCapacity * 0.8) {
      conflicts.push({
        type: 'load',
        severity: panel.calculatedLoad > panel.ratedCapacity ? 'critical' : 'major',
        systems: ['electrical'],
        location: panel.location,
        description: `Panel ${panel.id}: Calculated load (${panel.calculatedLoad}A) ${
          panel.calculatedLoad > panel.ratedCapacity ? 'exceeds' : 'approaches'
        } rated capacity (${panel.ratedCapacity}A)`,
        recommendations: [
          'Review circuit loading',
          'Consider load balancing',
          'Verify feeder sizing',
          panel.calculatedLoad > panel.ratedCapacity ? 'Upsize panel or redistribute loads' : 'Monitor for future loads'
        ],
        sourceSheets: [panel.sourceSheet],
      });
    }
  }

  // Detect access clearance issues
  const accessRequirements = extractAccessRequirements(chunks);
  for (const req of accessRequirements) {
    if (req.actualClearance && req.actualClearance < req.requiredClearance) {
      conflicts.push({
        type: 'access',
        severity: req.actualClearance < req.requiredClearance * 0.5 ? 'critical' : 'major',
        systems: [req.system],
        location: req.location,
        description: `${req.equipment}: Insufficient access clearance (${req.actualClearance}" available, ${req.requiredClearance}" required)`,
        recommendations: [
          'Verify code requirements',
          'Relocate equipment if possible',
          'Coordinate with other trades',
          'Document with RFI if needed'
        ],
        sourceSheets: [req.sourceSheet],
      });
    }
  }

  // Detect plumbing drainage conflicts
  const drainageIssues = detectDrainageIssues(chunks);
  conflicts.push(...drainageIssues);

  return conflicts;
}

// Helper functions for conflict detection
function extractCeilingHeights(chunks: EnhancedChunk[]): Array<{room: string; height: number; sourceSheet: string}> {
  const heights: Array<{room: string; height: number; sourceSheet: string}> = [];
  
  for (const chunk of chunks) {
    const matches = chunk.content.matchAll(/(?:Room|Space)\s+([A-Z0-9-]+).*?(?:Ceiling|CLG).*?(\d+)['"]?\s*(?:-|–)\s*(\d+)['"]?/gi);
    for (const match of matches) {
      const room = match[1];
      const height = parseInt(match[2]) + (parseInt(match[3]) / 12);
      heights.push({
        room,
        height,
        sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
      });
    }
  }
  
  return heights;
}

function extractEquipmentLocations(chunks: EnhancedChunk[]): Array<{
  tag: string;
  system: string;
  room: string;
  height?: number;
  sourceSheet: string;
}> {
  const equipment: Array<{tag: string; system: string; room: string; height?: number; sourceSheet: string}> = [];
  
  for (const chunk of chunks) {
    // Extract equipment tags with room locations
    const matches = chunk.content.matchAll(/([A-Z]{2,4}-\d+).*?(?:in|at|room)\s+([A-Z0-9-]+)/gi);
    for (const match of matches) {
      const tag = match[1];
      const room = match[2];
      
      // Determine system from tag prefix
      let system = 'unknown';
      if (tag.match(/^(AHU|RTU|VAV|FCU)/)) system = 'hvac';
      else if (tag.match(/^(WH|HWH|P-)/)) system = 'plumbing';
      else if (tag.match(/^(LP|PP|DP)/)) system = 'electrical';
      
      equipment.push({
        tag,
        system,
        room,
        sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
      });
    }
  }
  
  return equipment;
}

function calculatePanelLoads(chunks: EnhancedChunk[]): Array<{
  id: string;
  location: string;
  ratedCapacity: number;
  calculatedLoad: number;
  sourceSheet: string;
}> {
  const panels: Array<{id: string; location: string; ratedCapacity: number; calculatedLoad: number; sourceSheet: string}> = [];
  
  for (const chunk of chunks) {
    // Find panel schedules
    if (chunk.content.match(/panel\s+schedule/i)) {
      const panelMatch = chunk.content.match(/Panel\s+([A-Z0-9-]+)/i);
      const capacityMatch = chunk.content.match(/(\d+)A.*?(?:Main|Bus)/i);
      
      if (panelMatch && capacityMatch) {
        const id = panelMatch[1];
        const capacity = parseInt(capacityMatch[1]);
        
        // Calculate load from circuit list
        const circuits = chunk.content.matchAll(/(\d+(?:\.\d+)?)\s*(?:A|Amp)/gi);
        let totalLoad = 0;
        for (const circuit of circuits) {
          totalLoad += parseFloat(circuit[1]);
        }
        
        panels.push({
          id,
          location: 'See Plans',
          ratedCapacity: capacity,
          calculatedLoad: totalLoad,
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }
  
  return panels;
}

function extractAccessRequirements(chunks: EnhancedChunk[]): Array<{
  equipment: string;
  system: string;
  location: string;
  requiredClearance: number;
  actualClearance?: number;
  sourceSheet: string;
}> {
  // Simplified implementation - real version would parse notes and details
  return [];
}

function detectDrainageIssues(chunks: EnhancedChunk[]): CoordinationConflict[] {
  const issues: CoordinationConflict[] = [];
  
  for (const chunk of chunks) {
    // Check for insufficient slope
    const slopeMatch = chunk.content.match(/slope.*?(\d+\.?\d*)\s*["']?\s*per\s*(?:foot|ft)/i);
    if (slopeMatch) {
      const slope = parseFloat(slopeMatch[1]);
      if (slope < 0.25) {  // Minimum 1/4" per foot
        issues.push({
          type: 'sequencing',
          severity: 'major',
          systems: ['plumbing'],
          location: 'See Plumbing Plans',
          description: `Insufficient drainage slope: ${slope}" per foot (minimum 1/4" required)`,
          recommendations: [
            'Increase pipe slope to minimum 1/4" per foot',
            'Verify with plumbing code requirements',
            'Coordinate with structural for adequate depth'
          ],
          sourceSheets: [chunk.sourceReference || `Page ${chunk.pageNumber}`],
        });
      }
    }
  }
  
  return issues;
}

/**
 * Enhanced Diagram Understanding
 * Improved interpretation of one-lines, risers, and flow diagrams
 */
export interface DiagramElement {
  type: 'equipment' | 'connection' | 'label' | 'annotation';
  id: string;
  description: string;
  connections: string[];
  properties: Record<string, string>;
  location?: {
    x?: number;
    y?: number;
    floor?: string;
  };
}

export interface DiagramAnalysis {
  diagramType: 'one_line' | 'riser' | 'flow' | 'schematic' | 'logic';
  trade: string;
  elements: DiagramElement[];
  systemFlow: string[];
  notes: string[];
  sourceSheet: string;
}

export async function analyzeDiagram(
  chunk: EnhancedChunk,
  diagramType?: string
): Promise<DiagramAnalysis | null> {
  const content = chunk.content.toLowerCase();
  
  // Determine diagram type
  let type: DiagramAnalysis['diagramType'] = 'schematic';
  if (content.includes('one line') || content.includes('one-line')) type = 'one_line';
  else if (content.includes('riser')) type = 'riser';
  else if (content.includes('flow')) type = 'flow';
  else if (content.includes('logic') || content.includes('sequence')) type = 'logic';
  
  // Determine trade
  let trade = 'unknown';
  if (content.match(/electrical|power|panel/)) trade = 'electrical';
  else if (content.match(/plumbing|water|gas/)) trade = 'plumbing';
  else if (content.match(/hvac|mechanical|air/)) trade = 'hvac';
  else if (content.match(/fire alarm|detection/)) trade = 'fire_alarm';
  
  const elements: DiagramElement[] = [];
  const systemFlow: string[] = [];
  const notes: string[] = [];
  
  // Parse diagram elements from content
  const lines = chunk.content.split('\n');
  for (const line of lines) {
    // Extract equipment tags
    const equipmentMatch = line.match(/([A-Z]{2,4}-?\d+)/);
    if (equipmentMatch) {
      elements.push({
        type: 'equipment',
        id: equipmentMatch[1],
        description: line.trim(),
        connections: [],
        properties: extractProperties(line),
      });
    }
    
    // Extract notes (lines starting with numbers or bullets)
    if (line.match(/^\d+\.|^[-•*]/)) {
      notes.push(line.replace(/^\d+\.|^[-•*]/, '').trim());
    }
    
    // Extract flow sequence
    if (line.includes('→') || line.includes('->') || line.includes('to')) {
      systemFlow.push(line.trim());
    }
  }
  
  // Parse connections between elements
  for (let i = 0; i < elements.length - 1; i++) {
    // Simple heuristic: elements mentioned close together are likely connected
    const thisElement = elements[i];
    const nextElement = elements[i + 1];
    
    thisElement.connections.push(nextElement.id);
  }
  
  return {
    diagramType: type,
    trade,
    elements,
    systemFlow,
    notes,
    sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
  };
}

function extractProperties(line: string): Record<string, string> {
  const properties: Record<string, string> = {};
  
  // Extract voltage
  const voltMatch = line.match(/(\d+)V/);
  if (voltMatch) properties.voltage = voltMatch[1] + 'V';
  
  // Extract amperage
  const ampMatch = line.match(/(\d+)A/);
  if (ampMatch) properties.amperage = ampMatch[1] + 'A';
  
  // Extract size
  const sizeMatch = line.match(/(\d+\.?\d*)\s*["']/);
  if (sizeMatch) properties.size = sizeMatch[1] + '"';
  
  // Extract CFM
  const cfmMatch = line.match(/(\d+,?\d*)\s*CFM/i);
  if (cfmMatch) properties.cfm = cfmMatch[1] + ' CFM';
  
  // Extract GPM
  const gpmMatch = line.match(/(\d+\.?\d*)\s*GPM/i);
  if (gpmMatch) properties.gpm = gpmMatch[1] + ' GPM';
  
  return properties;
}

/**
 * Code Library Integration
 * Integration with building codes (IBC, NEC, IPC, IMC, NFPA, ADA)
 */
export interface CodeReference {
  standard: string; // 'IBC', 'NEC', 'IPC', 'IMC', 'NFPA', 'ADA'
  version: string;
  section: string;
  title: string;
  text: string;
  applicability: string[];
  keywords: string[];
}

export interface CodeLibrary {
  standards: Map<string, CodeReference[]>;
  lastUpdated: Date;
}

export async function loadCodeLibrary(projectSlug: string): Promise<CodeLibrary> {
  // Load regulatory documents from database
  const regulatoryDocs = await prisma.regulatoryDocument.findMany({
    where: {
      Project: { slug: projectSlug },
      processed: true,
    },
    include: {
      DocumentChunk: true,
    },
  });

  const standards = new Map<string, CodeReference[]>();

  for (const doc of regulatoryDocs) {
    const refs: CodeReference[] = [];
    
    for (const chunk of doc.DocumentChunk) {
      // Parse code section from chunk
      const sectionMatch = chunk.content.match(/(?:Section|§)\s*(\d+(?:\.\d+)*)/i);
      if (sectionMatch) {
        const section = sectionMatch[1];
        
        // Extract title (usually next line or in bold)
        const lines = chunk.content.split('\n');
        let title = '';
        for (let i = 0; i < lines.length && i < 3; i++) {
          if (lines[i].trim().length > 0 && lines[i].trim().length < 100) {
            title = lines[i].trim();
            break;
          }
        }
        
        refs.push({
          standard: doc.type.toUpperCase(),
          version: doc.version || 'Latest',
          section,
          title,
          text: chunk.content,
          applicability: extractApplicability(chunk.content),
          keywords: extractCodeKeywords(chunk.content),
        });
      }
    }
    
    if (refs.length > 0) {
      standards.set(doc.type.toUpperCase(), refs);
    }
  }

  return {
    standards,
    lastUpdated: new Date(),
  };
}

function extractApplicability(text: string): string[] {
  const applicability: string[] = [];
  
  if (text.match(/commercial|business|mercantile/i)) applicability.push('commercial');
  if (text.match(/residential|dwelling|apartment/i)) applicability.push('residential');
  if (text.match(/institutional|educational|healthcare/i)) applicability.push('institutional');
  if (text.match(/assembly|theater|restaurant/i)) applicability.push('assembly');
  if (text.match(/industrial|factory|storage/i)) applicability.push('industrial');
  
  return applicability;
}

function extractCodeKeywords(text: string): string[] {
  const keywords: string[] = [];
  const keywordPatterns = [
    'accessibility', 'egress', 'fire', 'sprinkler', 'exit', 'door', 'stair',
    'corridor', 'occupancy', 'load', 'height', 'area', 'width', 'clearance',
    'handrail', 'guard', 'ramp', 'elevator', 'restroom', 'parking',
    'electrical', 'panel', 'circuit', 'grounding', 'wiring', 'receptacle',
    'plumbing', 'fixture', 'water', 'drainage', 'vent', 'trap',
    'mechanical', 'ventilation', 'exhaust', 'duct', 'hvac'
  ];
  
  for (const keyword of keywordPatterns) {
    if (text.toLowerCase().includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords;
}

export async function findRelevantCodes(
  query: string,
  projectSlug: string,
  maxResults: number = 5
): Promise<CodeReference[]> {
  const codeLibrary = await loadCodeLibrary(projectSlug);
  const allRefs: CodeReference[] = [];
  
  // Collect all code references
  for (const refs of codeLibrary.standards.values()) {
    allRefs.push(...refs);
  }
  
  // Score and rank references
  const scored = allRefs.map(ref => {
    let score = 0;
    const queryLower = query.toLowerCase();
    
    // Title match (highest weight)
    if (ref.title.toLowerCase().includes(queryLower)) score += 10;
    
    // Keyword match
    for (const keyword of ref.keywords) {
      if (queryLower.includes(keyword)) score += 3;
    }
    
    // Text content match
    if (ref.text.toLowerCase().includes(queryLower)) score += 2;
    
    // Section number match
    if (queryLower.match(/\d{3,4}/) && ref.section.includes(queryLower.match(/\d{3,4}/)![0])) {
      score += 8;
    }
    
    return { ref, score };
  });
  
  // Sort by score and return top results
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.ref);
}

/**
 * Automated Compliance Checking
 * Checks project documents against applicable building codes
 */
export interface ComplianceIssue {
  severity: 'violation' | 'warning' | 'recommendation';
  code: string; // e.g., "IBC 1010.1.1"
  requirement: string;
  finding: string;
  location: string;
  recommendation: string;
  sourceSheet: string;
}

export interface ComplianceReport {
  projectName: string;
  checkDate: Date;
  codesChecked: string[];
  issues: ComplianceIssue[];
  summary: {
    violations: number;
    warnings: number;
    recommendations: number;
    compliant: number;
    totalChecks: number;
  };
}

export async function checkCompliance(
  chunks: EnhancedChunk[],
  projectSlug: string,
  scope?: string[]
): Promise<ComplianceReport> {
  const issues: ComplianceIssue[] = [];
  const codeLibrary = await loadCodeLibrary(projectSlug);
  const codesChecked: string[] = [];

  // Check egress requirements
  if (!scope || scope.includes('egress')) {
    const egressIssues = await checkEgressCompliance(chunks, codeLibrary);
    issues.push(...egressIssues);
    codesChecked.push('IBC - Egress');
  }

  // Check accessibility requirements
  if (!scope || scope.includes('accessibility')) {
    const accessibilityIssues = await checkAccessibilityCompliance(chunks, codeLibrary);
    issues.push(...accessibilityIssues);
    codesChecked.push('ADA - Accessibility');
  }

  // Check electrical requirements
  if (!scope || scope.includes('electrical')) {
    const electricalIssues = await checkElectricalCompliance(chunks, codeLibrary);
    issues.push(...electricalIssues);
    codesChecked.push('NEC - Electrical');
  }

  // Check plumbing requirements
  if (!scope || scope.includes('plumbing')) {
    const plumbingIssues = await checkPlumbingCompliance(chunks, codeLibrary);
    issues.push(...plumbingIssues);
    codesChecked.push('IPC - Plumbing');
  }

  // Check mechanical requirements
  if (!scope || scope.includes('mechanical')) {
    const mechanicalIssues = await checkMechanicalCompliance(chunks, codeLibrary);
    issues.push(...mechanicalIssues);
    codesChecked.push('IMC - Mechanical');
  }

  // Calculate summary
  const summary = {
    violations: issues.filter(i => i.severity === 'violation').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    recommendations: issues.filter(i => i.severity === 'recommendation').length,
    compliant: 0, // Would need to track successful checks
    totalChecks: issues.length,
  };

  return {
    projectName: projectSlug,
    checkDate: new Date(),
    codesChecked,
    issues,
    summary,
  };
}

async function checkEgressCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];
  
  // Check door widths
  for (const chunk of chunks) {
    const doorMatches = chunk.content.matchAll(/door.*?(\d+)["']?\s*(?:x|\u00d7)\s*(\d+)["']?/gi);
    for (const match of doorMatches) {
      const width = parseInt(match[1]);
      if (width < 32) {
        issues.push({
          severity: 'violation',
          code: 'IBC 1010.1.1',
          requirement: 'Minimum door width of 32 inches clear',
          finding: `Door width ${width}" is less than required 32" minimum`,
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Increase door width to minimum 32" clear or verify if exception applies',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }
  
  // Check corridor widths
  for (const chunk of chunks) {
    const corridorMatches = chunk.content.matchAll(/corridor.*?(\d+)["']?\s*(?:wide|width)/gi);
    for (const match of corridorMatches) {
      const width = parseInt(match[1]);
      if (width < 44) {
        issues.push({
          severity: width < 36 ? 'violation' : 'warning',
          code: 'IBC 1020.2',
          requirement: 'Minimum corridor width of 44 inches',
          finding: `Corridor width ${width}" is less than required 44" minimum`,
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Increase corridor width to 44" minimum or verify occupancy classification',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }
  
  return issues;
}

async function checkAccessibilityCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];
  
  // Check restroom accessibility
  for (const chunk of chunks) {
    if (chunk.content.match(/restroom|toilet|lavatory/i)) {
      // Check for accessible fixture counts
      const accessibleMatches = chunk.content.match(/accessible|ADA/i);
      if (!accessibleMatches) {
        issues.push({
          severity: 'warning',
          code: 'ADA 213.2',
          requirement: 'Accessible fixtures required in restrooms',
          finding: 'No accessible fixtures noted in restroom',
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Verify accessible fixture provisions or add ADA notation',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
      
      // Check clearances
      const clearanceMatch = chunk.content.match(/clearance.*?(\d+)["']?\s*x\s*(\d+)["']?/i);
      if (clearanceMatch) {
        const clear1 = parseInt(clearanceMatch[1]);
        const clear2 = parseInt(clearanceMatch[2]);
        if (clear1 < 60 || clear2 < 60) {
          issues.push({
            severity: 'violation',
            code: 'ADA 305.3',
            requirement: 'Minimum 60" turning space required',
            finding: `Clearance ${clear1}" x ${clear2}" is less than required 60" minimum`,
            location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
            recommendation: 'Increase clearance to 60" x 60" minimum or provide T-turn space',
            sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          });
        }
      }
    }
  }
  
  return issues;
}

async function checkElectricalCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];
  
  // Check GFCI requirements
  for (const chunk of chunks) {
    if (chunk.content.match(/restroom|bathroom|kitchen|outdoor/i)) {
      if (!chunk.content.match(/GFCI|ground fault/i)) {
        issues.push({
          severity: 'warning',
          code: 'NEC 210.8',
          requirement: 'GFCI protection required in wet locations',
          finding: 'No GFCI notation in area requiring ground fault protection',
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Verify GFCI protection or add notation to plans',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }
  
  // Check receptacle spacing
  for (const chunk of chunks) {
    const spacingMatch = chunk.content.match(/receptacle.*?(\d+)['"]?\s*(?:o\.?c\.?|on center|spacing)/i);
    if (spacingMatch) {
      const spacing = parseInt(spacingMatch[1]);
      if (spacing > 144) { // 12 feet
        issues.push({
          severity: 'violation',
          code: 'NEC 210.52',
          requirement: 'Maximum 12 feet spacing for receptacles along walls',
          finding: `Receptacle spacing of ${spacing}" exceeds 144" (12') maximum`,
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Reduce receptacle spacing to 12\' maximum or provide additional outlets',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }
  
  return issues;
}

async function checkPlumbingCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];
  
  // Check fixture unit calculations
  for (const chunk of chunks) {
    if (chunk.content.match(/fixture unit|DFU|WFU/i)) {
      // This would require complex calculation - simplified for demo
      const fuMatch = chunk.content.match(/(\d+)\s*(?:DFU|fixture units?)/i);
      if (fuMatch) {
        const fu = parseInt(fuMatch[1]);
        if (fu > 200) {
          issues.push({
            severity: 'recommendation',
            code: 'IPC 702.1',
            requirement: 'Verify drain sizing for fixture unit load',
            finding: `High fixture unit count (${fu} DFU) - verify drain sizing`,
            location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
            recommendation: 'Review IPC Table 702.1 to confirm adequate drain sizing',
            sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          });
        }
      }
    }
  }
  
  return issues;
}

async function checkMechanicalCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];
  
  // Check ventilation rates
  for (const chunk of chunks) {
    const ventMatch = chunk.content.match(/ventilation.*?(\d+)\s*CFM\s*per\s*person/i);
    if (ventMatch) {
      const cfmPerPerson = parseInt(ventMatch[1]);
      if (cfmPerPerson < 15) {
        issues.push({
          severity: 'warning',
          code: 'IMC 403.3',
          requirement: 'Minimum 15 CFM per person outdoor air',
          finding: `Ventilation rate of ${cfmPerPerson} CFM/person is less than 15 CFM/person minimum`,
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Increase outdoor air ventilation rate to meet IMC requirements',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }
  
  return issues;
}

/**
 * CSV/Excel Export for Takeoff Results
 * Generates exportable files from takeoff data
 */
export interface ExportOptions {
  format: 'csv' | 'excel';
  includeRollups: boolean;
  includeMetadata: boolean;
  groupBy?: 'trade' | 'system' | 'area';
}

export function generateTakeoffCSV(
  takeoff: TakeoffResult,
  options: ExportOptions = { format: 'csv', includeRollups: true, includeMetadata: true }
): string {
  const lines: string[] = [];
  
  // Header with metadata
  if (options.includeMetadata) {
    lines.push(`Project: ${takeoff.projectName}`);
    lines.push(`Generated: ${takeoff.generatedDate}`);
    lines.push(`Requested By: ${takeoff.requestedBy}`);
    lines.push(`Scope: ${takeoff.scope}`);
    lines.push('');
    lines.push(`Total Items: ${takeoff.totalItems}`);
    lines.push(`Counted: ${takeoff.countedItems}, Measured: ${takeoff.measuredItems}, Not Quantified: ${takeoff.notQuantifiedItems}`);
    lines.push('');
  }
  
  // Column headers
  lines.push([
    'Trade',
    'System',
    'Item Type',
    'Item Tag/ID',
    'Description',
    'Quantity',
    'Unit',
    'Size/Rating',
    'Method',
    'Source References',
    'Exclusions/Notes',
    'Confidence',
    'Confidence Basis'
  ].join(','));
  
  // Data rows
  for (const item of takeoff.items) {
    lines.push([
      csvEscape(item.trade),
      csvEscape(item.system),
      csvEscape(item.itemType),
      csvEscape(item.itemTagOrId),
      csvEscape(item.description),
      item.quantity.toString(),
      csvEscape(item.unit),
      csvEscape(item.sizeOrRating),
      csvEscape(item.method),
      csvEscape(item.sourceRefs.join('; ')),
      csvEscape(item.exclusionsOrNotes),
      item.confidence.toUpperCase(),
      csvEscape(item.confidenceBasis)
    ].join(','));
  }
  
  // Rollups section
  if (options.includeRollups && takeoff.rollups && takeoff.rollups.length > 0) {
    lines.push('');
    lines.push('ROLLUP SUMMARY');
    lines.push([
      'Trade',
      'System',
      'Group By',
      'Group Value',
      'Total Quantity',
      'Unit',
      'Item Count',
      'Confidence'
    ].join(','));
    
    for (const rollup of takeoff.rollups) {
      lines.push([
        csvEscape(rollup.trade),
        csvEscape(rollup.system || ''),
        csvEscape(rollup.groupBy),
        csvEscape(rollup.groupValue),
        rollup.totalQuantity.toString(),
        csvEscape(rollup.unit),
        rollup.itemCount.toString(),
        rollup.confidence.toUpperCase()
      ].join(','));
    }
  }
  
  // Warnings and disclaimers
  if (takeoff.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS');
    for (const warning of takeoff.warnings) {
      lines.push(csvEscape(warning));
    }
  }
  
  if (takeoff.disclaimers.length > 0) {
    lines.push('');
    lines.push('DISCLAIMERS');
    for (const disclaimer of takeoff.disclaimers) {
      lines.push(csvEscape(disclaimer));
    }
  }
  
  return lines.join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Visual Takeoff Highlighting
 * Generates metadata for highlighting items on plan sheets
 */
export interface HighlightRegion {
  itemId: string;
  sheet: string;
  pageNumber: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color: string;
  label: string;
  category: string;
}

export function generateHighlightMetadata(
  takeoff: TakeoffResult,
  chunks: EnhancedChunk[]
): HighlightRegion[] {
  const regions: HighlightRegion[] = [];
  
  for (const item of takeoff.items) {
    // Find source chunks for this item
    const sourceChunks = chunks.filter(c =>
      item.sourceRefs.some(ref => c.sourceReference?.includes(ref))
    );
    
    for (const chunk of sourceChunks) {
      // Determine color by trade
      let color = '#3B82F6'; // blue default
      if (item.trade === 'hvac') color = '#EF4444'; // red
      else if (item.trade === 'plumbing') color = '#10B981'; // green
      else if (item.trade === 'electrical') color = '#F59E0B'; // amber
      else if (item.trade === 'fire_alarm') color = '#8B5CF6'; // purple
      
      regions.push({
        itemId: item.itemTagOrId,
        sheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        pageNumber: chunk.pageNumber || 0,
        color,
        label: `${item.itemTagOrId}: ${item.description}`,
        category: item.trade,
      });
    }
  }
  
  return regions;
}

/**
 * Automatic Duct/Pipe Length Calculation
 * Calculates lengths from scaled plan sheets
 */
export interface LengthCalculation {
  system: string;
  tag: string;
  calculatedLength: number;
  unit: string;
  method: 'scaled' | 'additive' | 'estimated';
  confidence: 'high' | 'medium' | 'low';
  segments: Array<{
    from: string;
    to: string;
    length: number;
    sheet: string;
  }>;
  notes: string[];
}

export async function calculateDuctPipeLength(
  chunks: EnhancedChunk[],
  systemType: 'duct' | 'pipe',
  tag?: string
): Promise<LengthCalculation[]> {
  const calculations: LengthCalculation[] = [];
  
  // Find chunks with routing information
  const routingChunks = chunks.filter(c =>
    c.metadata?.scale && 
    (c.content.match(/routing|run|from.*to/i) || c.chunkType === 'detail_callout')
  );
  
  for (const chunk of routingChunks) {
    // Extract scale
    const scale = chunk.metadata.scale;
    if (!scale) continue;
    
    // Try to extract routing segments
    const routeMatches = chunk.content.matchAll(/(?:from|at)\s+([A-Z0-9-]+).*?(?:to|→)\s+([A-Z0-9-]+)/gi);
    const segments: LengthCalculation['segments'] = [];
    
    for (const match of routeMatches) {
      const from = match[1];
      const to = match[2];
      
      // Try to extract length if explicitly stated
      const lengthMatch = chunk.content.match(new RegExp(`${from}.*?${to}.*?(\\d+)['"]?`, 'i'));
      if (lengthMatch) {
        const length = parseInt(lengthMatch[1]);
        segments.push({
          from,
          to,
          length,
          sheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
    
    if (segments.length > 0) {
      const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
      
      calculations.push({
        system: systemType === 'duct' ? 'HVAC' : 'Plumbing',
        tag: tag || 'Unknown',
        calculatedLength: totalLength,
        unit: 'LF',
        method: 'additive',
        confidence: segments.length > 1 ? 'high' : 'medium',
        segments,
        notes: [
          `Calculated from ${segments.length} segments`,
          `Scale: ${scale}`,
          `Verify actual routing in field`
        ],
      });
    }
  }
  
  return calculations;
}

/**
 * AI-Assisted Verification
 * Cross-checks takeoff results for accuracy and completeness
 */
export interface VerificationResult {
  passed: boolean;
  score: number; // 0-100
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  suggestions: string[];
}

export async function verifyTakeoff(
  takeoff: TakeoffResult,
  chunks: EnhancedChunk[]
): Promise<VerificationResult> {
  const checks: VerificationResult['checks'] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  // Check 1: Verify all schedule items are included
  const scheduleChunks = chunks.filter(c => c.chunkType === 'schedule_row');
  const scheduleItems = new Set<string>();
  for (const chunk of scheduleChunks) {
    const tagMatches = chunk.content.matchAll(/([A-Z]{2,4}-?\d+)/g);
    for (const match of tagMatches) {
      scheduleItems.add(match[1]);
    }
  }
  
  const takeoffItems = new Set(takeoff.items.map(i => i.itemTagOrId));
  const missingItems = Array.from(scheduleItems).filter(item => !takeoffItems.has(item));
  
  if (missingItems.length > 0) {
    checks.push({
      name: 'Schedule Completeness',
      passed: false,
      message: `${missingItems.length} schedule items not included in takeoff: ${missingItems.slice(0, 5).join(', ')}${missingItems.length > 5 ? '...' : ''}`,
      severity: 'warning',
    });
    score -= Math.min(20, missingItems.length * 2);
    suggestions.push(`Review schedules for items: ${missingItems.join(', ')}`);
  } else {
    checks.push({
      name: 'Schedule Completeness',
      passed: true,
      message: 'All schedule items included in takeoff',
      severity: 'info',
    });
  }
  
  // Check 2: Verify confidence levels
  const lowConfidenceCount = takeoff.items.filter(i => i.confidence === 'low').length;
  if (lowConfidenceCount > takeoff.totalItems * 0.3) {
    checks.push({
      name: 'Confidence Threshold',
      passed: false,
      message: `${lowConfidenceCount} items (${Math.round(lowConfidenceCount/takeoff.totalItems*100)}%) have low confidence`,
      severity: 'warning',
    });
    score -= 15;
    suggestions.push('Review low-confidence items for accuracy');
  } else {
    checks.push({
      name: 'Confidence Threshold',
      passed: true,
      message: `${lowConfidenceCount} items with low confidence (acceptable threshold)`,
      severity: 'info',
    });
  }
  
  // Check 3: Verify source references
  const itemsWithoutSources = takeoff.items.filter(i => i.sourceRefs.length === 0);
  if (itemsWithoutSources.length > 0) {
    checks.push({
      name: 'Source Traceability',
      passed: false,
      message: `${itemsWithoutSources.length} items missing source references`,
      severity: 'error',
    });
    score -= 10;
    suggestions.push('Add source references to all items');
  } else {
    checks.push({
      name: 'Source Traceability',
      passed: true,
      message: 'All items have source references',
      severity: 'info',
    });
  }
  
  // Check 4: Verify quantities are reasonable
  for (const item of takeoff.items) {
    if (typeof item.quantity === 'number') {
      if (item.quantity === 0) {
        checks.push({
          name: `Zero Quantity: ${item.itemTagOrId}`,
          passed: false,
          message: `Item ${item.itemTagOrId} has zero quantity`,
          severity: 'warning',
        });
        score -= 2;
      }
      
      // Check for suspiciously large quantities
      if (item.quantity > 1000 && item.unit !== 'LF' && item.unit !== 'SF') {
        checks.push({
          name: `Large Quantity: ${item.itemTagOrId}`,
          passed: false,
          message: `Item ${item.itemTagOrId} has unusually large quantity (${item.quantity} ${item.unit})`,
          severity: 'warning',
        });
        score -= 2;
        suggestions.push(`Verify quantity for ${item.itemTagOrId}`);
      }
    }
  }
  
  // Check 5: Verify trade groupings
  const tradeGroups = new Map<string, number>();
  for (const item of takeoff.items) {
    tradeGroups.set(item.trade, (tradeGroups.get(item.trade) || 0) + 1);
  }
  
  if (tradeGroups.size === 0) {
    checks.push({
      name: 'Trade Classification',
      passed: false,
      message: 'No items classified by trade',
      severity: 'error',
    });
    score -= 20;
  } else {
    checks.push({
      name: 'Trade Classification',
      passed: true,
      message: `Items organized into ${tradeGroups.size} trade categories`,
      severity: 'info',
    });
  }
  
  // Overall assessment
  const passed = score >= 70 && !checks.some(c => c.severity === 'error');
  
  if (!passed) {
    suggestions.push('Review and address errors and warnings before finalizing takeoff');
  }
  
  return {
    passed,
    score: Math.max(0, score),
    checks,
    suggestions,
  };
}

// ============================================================================
// PHASE 3A: ENHANCED VISION & UNDERSTANDING - QUICK WINS
// ============================================================================

/**
 * ========================================
 * 1. MULTI-SCALE DETECTION AND HANDLING
 * ========================================
 */

export interface ScaleInfo {
  scale: string;                    // e.g., "1/4\" = 1'-0\"", "1:100"
  scaleType: 'architectural' | 'engineering' | 'metric' | 'graphic' | 'unknown';
  scaleFactor: number;              // numerical conversion factor
  applicableArea?: {                // area where this scale applies
    sheetArea: string;              // e.g., "Detail A", "Plan View", "Entire Sheet"
    gridBounds?: string[];          // e.g., ["A.1", "C.5"]
    confidence: 'high' | 'medium' | 'low';
  };
  source: 'title_block' | 'detail_callout' | 'scale_bar' | 'inferred';
  confidence: 'high' | 'medium' | 'low';
}

export interface MultiScaleDocument {
  documentId: string;
  sheetNumber: string;
  defaultScale: ScaleInfo;
  additionalScales: ScaleInfo[];
  scaleWarnings: string[];
}

/**
 * Extract and parse all scales from a document chunk
 */
export function detectMultipleScales(chunk: EnhancedChunk): MultiScaleDocument {
  const metadata = chunk.metadata || {};
  const content = chunk.content.toLowerCase();
  const scales: ScaleInfo[] = [];
  const warnings: string[] = [];

  // Common scale patterns
  const patterns = {
    architectural: /(\d+\/\d+)"\s*=\s*(\d+)'?-?(\d+)"?|scale:\s*(\d+\/\d+)"/gi,
    engineering: /1"\s*=\s*(\d+)'|scale:\s*1\s*=\s*(\d+)/gi,
    metric: /1:(\d+)|scale\s*1:(\d+)/gi,
    detail: /detail[:\s]+.*?(\d+\/\d+)"/gi,
    graphic: /graphic\s*scale|bar\s*scale/gi,
  };

  // Extract architectural scales (e.g., 1/4" = 1'-0")
  let match;
  while ((match = patterns.architectural.exec(content)) !== null) {
    const numerator = match[1] ? parseInt(match[1].split('/')[0]) : 1;
    const denominator = match[1] ? parseInt(match[1].split('/')[1]) : 4;
    const feet = match[2] ? parseInt(match[2]) : 1;
    const inches = match[3] ? parseInt(match[3]) : 0;
    
    const scaleFactor = (feet * 12 + inches) / (numerator / denominator);
    
    scales.push({
      scale: match[0],
      scaleType: 'architectural',
      scaleFactor,
      source: content.includes('detail') ? 'detail_callout' : 'title_block',
      confidence: 'high',
    });
  }

  // Extract engineering scales (e.g., 1" = 40')
  patterns.engineering.lastIndex = 0;
  while ((match = patterns.engineering.exec(content)) !== null) {
    const feet = match[1] ? parseInt(match[1]) : parseInt(match[2] || '1');
    const scaleFactor = feet * 12;
    
    scales.push({
      scale: match[0],
      scaleType: 'engineering',
      scaleFactor,
      source: 'title_block',
      confidence: 'high',
    });
  }

  // Extract metric scales (e.g., 1:100)
  patterns.metric.lastIndex = 0;
  while ((match = patterns.metric.exec(content)) !== null) {
    const ratio = parseInt(match[1] || match[2] || '100');
    
    scales.push({
      scale: match[0],
      scaleType: 'metric',
      scaleFactor: ratio,
      source: 'title_block',
      confidence: 'high',
    });
  }

  // Check for graphic scale bars in metadata
  if (metadata.scale_bars || patterns.graphic.test(content)) {
    scales.push({
      scale: 'Graphic Scale Bar',
      scaleType: 'graphic',
      scaleFactor: 0, // Will be calculated from visual analysis
      source: 'scale_bar',
      confidence: 'medium',
    });
  }

  // Validate and warn about inconsistencies
  if (scales.length > 1) {
    const uniqueFactors = new Set(scales.map(s => s.scaleFactor));
    if (uniqueFactors.size > 1) {
      warnings.push(`Multiple different scales detected (${scales.length} scales). Verify which applies to your query area.`);
    }
  }

  // Default scale fallback
  const defaultScale: ScaleInfo = scales.length > 0 
    ? scales[0] 
    : {
        scale: 'Not specified',
        scaleType: 'unknown',
        scaleFactor: 1,
        source: 'title_block',
        confidence: 'low',
      };

  // Extract additional scales (excluding default)
  const additionalScales = scales.slice(1);

  return {
    documentId: chunk.documentId || '',
    sheetNumber: metadata.sheet_number || 'Unknown',
    defaultScale,
    additionalScales,
    scaleWarnings: warnings,
  };
}

/**
 * Infer scale from known dimensions (e.g., door widths, room sizes)
 */
export function inferScaleFromDimensions(chunk: EnhancedChunk): ScaleInfo | null {
  const content = chunk.content.toLowerCase();
  const metadata = chunk.metadata || {};

  // Known standard dimensions
  const standardDimensions = [
    { pattern: /door.*?(\d+)\s*x\s*(\d+)/i, expected: [36, 80], type: 'door' }, // 3'x6'8" door
    { pattern: /(\d+)\s*x\s*(\d+).*?door/i, expected: [36, 80], type: 'door' },
    { pattern: /parking\s*space.*?(\d+)\s*x\s*(\d+)/i, expected: [108, 216], type: 'parking' }, // 9'x18' parking
    { pattern: /corridor.*?(\d+)['"]?/i, expected: [48], type: 'corridor' }, // 4' corridor
  ];

  for (const std of standardDimensions) {
    const match = std.pattern.exec(content);
    if (match) {
      // Extract measured value from drawing
      const measuredValue = parseInt(match[1]);
      
      // Calculate scale factor
      const expectedValue = std.expected[0];
      const inferredFactor = expectedValue / measuredValue;

      if (inferredFactor > 0.1 && inferredFactor < 1000) { // Sanity check
        return {
          scale: `Inferred from ${std.type}: ~1:${Math.round(inferredFactor)}`,
          scaleType: 'architectural',
          scaleFactor: inferredFactor,
          source: 'inferred',
          confidence: 'medium',
        };
      }
    }
  }

  return null;
}

/**
 * ========================================
 * 2. SCALE BAR AUTO-DETECTION
 * ========================================
 */

export interface ScaleBar {
  detected: boolean;
  units: string[];                  // e.g., ["0", "10", "20", "40 FT"]
  pixelWidth?: number;              // visual width of scale bar
  realWorldDistance?: number;       // corresponding real distance
  scaleFactor?: number;             // calculated conversion factor
  location: string;                 // where on sheet (e.g., "bottom right")
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detect and extract scale bars from document visuals
 */
export function detectScaleBar(chunk: EnhancedChunk): ScaleBar {
  const content = chunk.content.toLowerCase();
  const metadata = chunk.metadata || {};

  // Check for scale bar indicators
  const scaleBarPatterns = [
    /scale[:\s]+0\s+(\d+)\s+(\d+)\s+(\d+)/i,
    /graphic\s*scale.*?(\d+)\s*ft/i,
    /(\d+)\s*'?\s*0\s*'?\s*(\d+)\s*'?\s*(\d+)\s*'?/i,
    /bar\s*scale.*?(\d+)/i,
  ];

  const units: string[] = [];
  let realWorldDistance = 0;
  let detected = false;

  for (const pattern of scaleBarPatterns) {
    const match = pattern.exec(content);
    if (match) {
      detected = true;
      
      // Extract units from match
      if (match[1]) units.push('0');
      if (match[1]) units.push(match[1]);
      if (match[2]) units.push(match[2]);
      if (match[3]) units.push(match[3]);

      // Calculate max distance
      const values = [match[1], match[2], match[3]].filter(Boolean).map(v => parseInt(v!));
      realWorldDistance = Math.max(...values, realWorldDistance);
      
      break;
    }
  }

  // Check metadata for scale bar information
  if (metadata.scale_bar || metadata.graphic_scale) {
    detected = true;
    units.push('Detected in visual analysis');
  }

  // Determine location (usually bottom right or bottom center)
  const location = content.includes('title block') 
    ? 'bottom right' 
    : content.includes('north arrow') 
      ? 'bottom center' 
      : 'unknown';

  return {
    detected,
    units,
    realWorldDistance: realWorldDistance > 0 ? realWorldDistance : undefined,
    scaleFactor: realWorldDistance > 0 ? realWorldDistance / 100 : undefined, // Estimate
    location,
    confidence: detected && realWorldDistance > 0 ? 'high' : detected ? 'medium' : 'low',
  };
}

/**
 * Calculate dimensions using scale bar calibration
 */
export function calculateWithScaleBar(
  scaleBar: ScaleBar,
  visualMeasurement: number
): { value: number; unit: string; confidence: 'high' | 'medium' | 'low' } {
  if (!scaleBar.detected || !scaleBar.scaleFactor) {
    return {
      value: visualMeasurement,
      unit: 'unknown',
      confidence: 'low',
    };
  }

  const realValue = visualMeasurement * scaleBar.scaleFactor;

  return {
    value: realValue,
    unit: 'feet',
    confidence: scaleBar.confidence,
  };
}

/**
 * ========================================
 * 3. ABBREVIATION EXPANSION DICTIONARY
 * ========================================
 */

export interface AbbreviationDictionary {
  [key: string]: {
    expansion: string;
    category: 'general' | 'hvac' | 'plumbing' | 'electrical' | 'structural' | 'architectural';
    context?: string;
    alternatives?: string[];
  };
}

/**
 * Comprehensive construction abbreviation dictionary
 */
export const CONSTRUCTION_ABBREVIATIONS: AbbreviationDictionary = {
  // General Construction
  'typ': { expansion: 'typical', category: 'general' },
  'sim': { expansion: 'similar', category: 'general' },
  'ea': { expansion: 'each', category: 'general' },
  'nts': { expansion: 'not to scale', category: 'general' },
  'sht': { expansion: 'sheet', category: 'general' },
  'dwg': { expansion: 'drawing', category: 'general' },
  'det': { expansion: 'detail', category: 'general' },
  'elev': { expansion: 'elevation', category: 'general' },
  'sect': { expansion: 'section', category: 'general' },
  'pln': { expansion: 'plan', category: 'general' },
  
  // Architectural
  'clg': { expansion: 'ceiling', category: 'architectural' },
  'flr': { expansion: 'floor', category: 'architectural' },
  'rm': { expansion: 'room', category: 'architectural' },
  'cor': { expansion: 'corridor', category: 'architectural' },
  'occ': { expansion: 'occupancy', category: 'architectural' },
  'aff': { expansion: 'above finished floor', category: 'architectural' },
  'ffl': { expansion: 'finished floor level', category: 'architectural' },
  'ffh': { expansion: 'finished floor height', category: 'architectural' },
  'thk': { expansion: 'thick', category: 'architectural' },
  'wd': { expansion: 'wood', category: 'architectural' },
  'gyp': { expansion: 'gypsum', category: 'architectural' },
  'gwd': { expansion: 'gypsum wallboard', category: 'architectural' },
  'cmul': { expansion: 'concrete masonry unit', category: 'architectural' },
  
  // HVAC
  'ahu': { expansion: 'air handling unit', category: 'hvac' },
  'rtu': { expansion: 'rooftop unit', category: 'hvac' },
  'vav': { expansion: 'variable air volume', category: 'hvac' },
  'fcu': { expansion: 'fan coil unit', category: 'hvac' },
  'mau': { expansion: 'makeup air unit', category: 'hvac' },
  'erv': { expansion: 'energy recovery ventilator', category: 'hvac' },
  'hrv': { expansion: 'heat recovery ventilator', category: 'hvac' },
  'doas': { expansion: 'dedicated outdoor air system', category: 'hvac' },
  'cuh': { expansion: 'cabinet unit heater', category: 'hvac' },
  'ef': { expansion: 'exhaust fan', category: 'hvac' },
  'sf': { expansion: 'supply fan', category: 'hvac' },
  'rf': { expansion: 'return fan', category: 'hvac' },
  'cfm': { expansion: 'cubic feet per minute', category: 'hvac' },
  'fpm': { expansion: 'feet per minute', category: 'hvac' },
  'mbh': { expansion: 'thousand BTU per hour', category: 'hvac' },
  
  // Plumbing
  'wh': { expansion: 'water heater', category: 'plumbing' },
  'hwh': { expansion: 'hot water heater', category: 'plumbing' },
  'dhw': { expansion: 'domestic hot water', category: 'plumbing' },
  'cw': { expansion: 'cold water', category: 'plumbing' },
  'hw': { expansion: 'hot water', category: 'plumbing' },
  'hwr': { expansion: 'hot water return', category: 'plumbing' },
  'co': { expansion: 'cleanout', category: 'plumbing' },
  'fco': { expansion: 'floor cleanout', category: 'plumbing' },
  'wco': { expansion: 'wall cleanout', category: 'plumbing' },
  'fd': { expansion: 'floor drain', category: 'plumbing' },
  'ro': { expansion: 'roof drain', category: 'plumbing' },
  'lav': { expansion: 'lavatory', category: 'plumbing' },
  'wc': { expansion: 'water closet', category: 'plumbing' },
  'ur': { expansion: 'urinal', category: 'plumbing' },
  'df': { expansion: 'drinking fountain', category: 'plumbing' },
  'gpm': { expansion: 'gallons per minute', category: 'plumbing' },
  'psi': { expansion: 'pounds per square inch', category: 'plumbing' },
  
  // Electrical
  'mcc': { expansion: 'motor control center', category: 'electrical' },
  'xfmr': { expansion: 'transformer', category: 'electrical' },
  'swbd': { expansion: 'switchboard', category: 'electrical' },
  'mlp': { expansion: 'main lighting panel', category: 'electrical' },
  'pdp': { expansion: 'power distribution panel', category: 'electrical' },
  'gfci': { expansion: 'ground fault circuit interrupter', category: 'electrical' },
  'afci': { expansion: 'arc fault circuit interrupter', category: 'electrical' },
  'oc': { expansion: 'on center', category: 'electrical' },
  'kva': { expansion: 'kilovolt-ampere', category: 'electrical' },
  'kw': { expansion: 'kilowatt', category: 'electrical' },
  'hp': { expansion: 'horsepower', category: 'electrical' },
  'emg': { expansion: 'emergency', category: 'electrical' },
  
  // Structural
  'conc': { expansion: 'concrete', category: 'structural' },
  'reinf': { expansion: 'reinforcing', category: 'structural' },
  'rebar': { expansion: 'reinforcing bar', category: 'structural' },
  'wwf': { expansion: 'welded wire fabric', category: 'structural' },
  'stl': { expansion: 'steel', category: 'structural' },
  'ftg': { expansion: 'footing', category: 'structural' },
  'fdn': { expansion: 'foundation', category: 'structural' },
  'col': { expansion: 'column', category: 'structural' },
  'bm': { expansion: 'beam', category: 'structural' },
  'jst': { expansion: 'joist', category: 'structural' },
  'plt': { expansion: 'plate', category: 'structural' },
};

/**
 * Build project-specific abbreviation dictionary from document context
 */
export async function buildProjectAbbreviationDictionary(
  projectSlug: string
): Promise<AbbreviationDictionary> {
  const customDict: AbbreviationDictionary = { ...CONSTRUCTION_ABBREVIATIONS };

  // Fetch all document chunks for the project
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        include: {
          DocumentChunk: {
            take: 100, // Sample first 100 chunks
          },
        },
      },
    },
  });

  if (!project) return customDict;

  // Extract abbreviations from legend sheets and notes
  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk) {
      const content = chunk.content.toLowerCase();
      
      // Look for abbreviation definitions (e.g., "AHU - Air Handling Unit")
      const abbrevPatterns = [
        /([A-Z]{2,6})\s*[-–—:]\s*([A-Za-z\s]{5,50})/g,
        /\(([A-Z]{2,6})\)\s*=\s*([A-Za-z\s]{5,50})/g,
        /([A-Z]{2,6})\s*means\s*([A-Za-z\s]{5,50})/gi,
      ];

      for (const pattern of abbrevPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const abbrev = match[1].toLowerCase();
          const expansion = match[2].trim();
          
          // Only add if not already in dictionary
          if (!customDict[abbrev] && expansion.length > 3) {
            customDict[abbrev] = {
              expansion,
              category: 'general',
              context: `Found in ${doc.fileName}`,
            };
          }
        }
      }
    }
  }

  return customDict;
}

/**
 * Expand abbreviations in text
 */
export function expandAbbreviations(
  text: string,
  dictionary: AbbreviationDictionary = CONSTRUCTION_ABBREVIATIONS,
  includeOriginal: boolean = true
): string {
  let expanded = text;
  const words = text.split(/\b/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    if (dictionary[word]) {
      const entry = dictionary[word];
      words[i] = includeOriginal 
        ? `${words[i]} (${entry.expansion})`
        : entry.expansion;
    }
  }

  return words.join('');
}

/**
 * ========================================
 * 4. GRID-BASED SPATIAL REFERENCING
 * ========================================
 */

export interface GridReference {
  gridId: string;                   // e.g., "A.1", "3/B", "C-4"
  gridType: 'structural' | 'area' | 'room' | 'detail';
  coordinates?: {
    x: string;                      // horizontal grid line (e.g., "A", "1")
    y: string;                      // vertical grid line (e.g., "3", "B")
  };
  description?: string;             // e.g., "Between grids A and B"
  confidence: 'high' | 'medium' | 'low';
}

export interface SpatialLocation {
  gridReferences: GridReference[];
  roomNumber?: string;
  areaDescription?: string;
  relativePosition?: string;        // e.g., "north wall", "center of room"
  dimensions?: {
    width?: string;
    length?: string;
    height?: string;
  };
}

/**
 * Extract grid references from content
 */
export function extractGridReferences(chunk: EnhancedChunk): GridReference[] {
  const content = chunk.content;
  const metadata = chunk.metadata || {};
  const gridRefs: GridReference[] = [];

  // Common grid patterns
  const patterns = [
    // Letter-Number format: A.1, A-1, A/1, A1
    /\b([A-Z])[\.\-\/]?(\d+)\b/g,
    // Number-Letter format: 1.A, 1-A, 1/A, 1A
    /\b(\d+)[\.\-\/]?([A-Z])\b/g,
    // Between grids: "between grids A and B"
    /between\s+grids?\s+([A-Z\d])\s+and\s+([A-Z\d])/gi,
    // At grid: "at grid A.1"
    /at\s+grid\s+([A-Z])[\.\-\/]?(\d+)/gi,
    // Grid line references
    /grid\s+line\s+([A-Z\d]+)/gi,
  ];

  // Extract standard grid references
  let match;
  patterns[0].lastIndex = 0;
  while ((match = patterns[0].exec(content)) !== null) {
    gridRefs.push({
      gridId: `${match[1]}.${match[2]}`,
      gridType: 'structural',
      coordinates: {
        x: match[1],
        y: match[2],
      },
      confidence: 'high',
    });
  }

  patterns[1].lastIndex = 0;
  while ((match = patterns[1].exec(content)) !== null) {
    gridRefs.push({
      gridId: `${match[2]}.${match[1]}`,
      gridType: 'structural',
      coordinates: {
        x: match[2],
        y: match[1],
      },
      confidence: 'high',
    });
  }

  // Check metadata for grid information
  if (metadata.grid_lines) {
    const gridLines = Array.isArray(metadata.grid_lines) 
      ? metadata.grid_lines 
      : [metadata.grid_lines];
      
    for (const grid of gridLines) {
      if (typeof grid === 'string') {
        gridRefs.push({
          gridId: grid,
          gridType: 'structural',
          confidence: 'high',
        });
      }
    }
  }

  // Remove duplicates
  const uniqueRefs = Array.from(
    new Map(gridRefs.map(ref => [ref.gridId, ref])).values()
  );

  return uniqueRefs;
}

/**
 * Calculate spatial relationships between grid references
 */
export function calculateGridDistance(
  grid1: GridReference,
  grid2: GridReference
): { distance: number; direction: string; confidence: 'high' | 'medium' | 'low' } {
  if (!grid1.coordinates || !grid2.coordinates) {
    return { distance: 0, direction: 'unknown', confidence: 'low' };
  }

  // Calculate letter distance (A-Z)
  const letterDist = Math.abs(
    grid1.coordinates.x.charCodeAt(0) - grid2.coordinates.x.charCodeAt(0)
  );

  // Calculate number distance
  const numberDist = Math.abs(
    parseInt(grid1.coordinates.y) - parseInt(grid2.coordinates.y)
  );

  // Determine direction
  let direction = '';
  if (letterDist > 0) {
    direction += grid1.coordinates.x < grid2.coordinates.x ? 'east' : 'west';
  }
  if (numberDist > 0) {
    if (direction) direction += '-';
    direction += parseInt(grid1.coordinates.y) < parseInt(grid2.coordinates.y) ? 'north' : 'south';
  }

  // Calculate Manhattan distance (grid squares)
  const distance = letterDist + numberDist;

  return {
    distance,
    direction: direction || 'same location',
    confidence: 'high',
  };
}

/**
 * Find all elements within a grid area
 */
export async function findElementsInGridArea(
  projectSlug: string,
  gridArea: { from: string; to: string }
): Promise<EnhancedChunk[]> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        include: {
          DocumentChunk: true,
        },
      },
    },
  });

  if (!project) return [];

  const chunks: EnhancedChunk[] = [];
  
  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk) {
      const gridRefs = extractGridReferences(chunk as EnhancedChunk);
      
      // Check if any grid reference falls within the specified area
      for (const ref of gridRefs) {
        if (isGridInArea(ref.gridId, gridArea)) {
          chunks.push(chunk as EnhancedChunk);
          break;
        }
      }
    }
  }

  return chunks;
}

/**
 * Helper: Check if a grid reference is within an area
 */
function isGridInArea(gridId: string, area: { from: string; to: string }): boolean {
  // Parse grid coordinates
  const parseGrid = (grid: string) => {
    const match = /([A-Z])[\.\-\/]?(\d+)/.exec(grid);
    if (!match) return null;
    return { letter: match[1], number: parseInt(match[2]) };
  };

  const grid = parseGrid(gridId);
  const from = parseGrid(area.from);
  const to = parseGrid(area.to);

  if (!grid || !from || !to) return false;

  // Check if within bounds
  const letterInRange = grid.letter >= from.letter && grid.letter <= to.letter;
  const numberInRange = grid.number >= from.number && grid.number <= to.number;

  return letterInRange && numberInRange;
}

/**
 * Generate spatial context from grid references
 */
export function generateSpatialContext(
  gridRefs: GridReference[],
  roomNumber?: string
): string {
  if (gridRefs.length === 0 && !roomNumber) {
    return 'Location not specified';
  }

  const parts: string[] = [];

  if (roomNumber) {
    parts.push(`Room ${roomNumber}`);
  }

  if (gridRefs.length > 0) {
    const gridIds = gridRefs.map(ref => ref.gridId).join(', ');
    parts.push(`Grid location: ${gridIds}`);
  }

  if (gridRefs.length >= 2) {
    const distance = calculateGridDistance(gridRefs[0], gridRefs[1]);
    parts.push(`(${distance.distance} grid squares ${distance.direction})`);
  }

  return parts.join(' • ');
}

// ============================================================================


// ============================================================================
// PHASE 3C: ADVANCED FEATURES
// ============================================================================

/**
 * ========================================
 * 1. SYSTEM TOPOLOGY RECONSTRUCTION
 * ========================================
 */

export interface SystemNode {
  id: string;                       // Equipment/device ID
  type: 'equipment' | 'device' | 'junction' | 'endpoint';
  name: string;
  properties: {
    [key: string]: string | number;
  };
  location?: {
    gridRef?: string;
    room?: string;
    floor?: string;
  };
}

export interface SystemConnection {
  from: string;                     // Source node ID
  to: string;                       // Target node ID
  connectionType: 'supply' | 'return' | 'power' | 'control' | 'data' | 'drain' | 'vent';
  properties?: {
    size?: string;
    capacity?: string;
    material?: string;
  };
  confidence: 'high' | 'medium' | 'low';
}

export interface SystemTopology {
  systemName: string;
  systemType: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm';
  nodes: SystemNode[];
  connections: SystemConnection[];
  flow: string[];                   // Ordered sequence of node IDs showing flow path
  warnings: string[];
}

/**
 * Reconstruct system topology from MEP documents
 */
export async function reconstructSystemTopology(
  projectSlug: string,
  systemType: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm'
): Promise<SystemTopology> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        include: {
          DocumentChunk: true,
        },
      },
    },
  });

  if (!project) {
    return {
      systemName: 'Unknown',
      systemType,
      nodes: [],
      connections: [],
      flow: [],
      warnings: ['Project not found'],
    };
  }

  const nodes: SystemNode[] = [];
  const connections: SystemConnection[] = [];
  const warnings: string[] = [];

  // Extract nodes (equipment/devices) from chunks
  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk) {
      const content = chunk.content.toLowerCase();
      const metadata = chunk.metadata || {};

      // Detect equipment based on system type
      let equipmentPatterns: RegExp[] = [];
      let devicePatterns: RegExp[] = [];

      switch (systemType) {
        case 'hvac':
          equipmentPatterns = [
            /ahu[-\s]?(\d+)/gi,
            /rtu[-\s]?(\d+)/gi,
            /vav[-\s]?(\d+)/gi,
            /fcu[-\s]?(\d+)/gi,
          ];
          devicePatterns = [
            /ef[-\s]?(\d+)/gi,
            /sf[-\s]?(\d+)/gi,
            /td[-\s]?(\d+)/gi,
          ];
          break;
        case 'plumbing':
          equipmentPatterns = [
            /wh[-\s]?(\d+)/gi,
            /hwh[-\s]?(\d+)/gi,
            /pump[-\s]?(\d+)/gi,
          ];
          devicePatterns = [
            /fd[-\s]?(\d+)/gi,
            /co[-\s]?(\d+)/gi,
          ];
          break;
        case 'electrical':
          equipmentPatterns = [
            /panel\s+([a-z\d-]+)/gi,
            /mcc[-\s]?(\d+)/gi,
            /xfmr[-\s]?(\d+)/gi,
          ];
          devicePatterns = [
            /circuit\s+(\d+)/gi,
          ];
          break;
        case 'fire_alarm':
          equipmentPatterns = [
            /facp[-\s]?(\d+)/gi,
            /panel\s+([a-z\d-]+)/gi,
          ];
          devicePatterns = [
            /smoke\s*det.*?(\d+)/gi,
            /horn.*?(\d+)/gi,
            /pull\s*station.*?(\d+)/gi,
          ];
          break;
      }

      // Extract equipment nodes
      for (const pattern of equipmentPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const id = match[0];
          if (!nodes.find(n => n.id === id)) {
            const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as any : {};
            const gridRefs = Array.isArray(meta.grid_references) ? meta.grid_references : [];
            const roomNum = typeof meta.room_number === 'string' ? meta.room_number : undefined;
            nodes.push({
              id,
              type: 'equipment',
              name: id,
              properties: {},
              location: {
                gridRef: gridRefs[0],
                room: roomNum,
              },
            });
          }
        }
      }

      // Extract device nodes
      for (const pattern of devicePatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const id = match[0];
          if (!nodes.find(n => n.id === id)) {
            const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as any : {};
            const gridRefs = Array.isArray(meta.grid_references) ? meta.grid_references : [];
            const roomNum = typeof meta.room_number === 'string' ? meta.room_number : undefined;
            nodes.push({
              id,
              type: 'device',
              name: id,
              properties: {},
              location: {
                gridRef: gridRefs[0],
                room: roomNum,
              },
            });
          }
        }
      }
      // Extract connections from text patterns
      const connectionPatterns = [
        /(\S+)\s+(?:serves|supplies|feeds|connects to)\s+(\S+)/gi,
        /(\S+)\s+→\s+(\S+)/gi,
        /from\s+(\S+)\s+to\s+(\S+)/gi,
      ];

      for (const pattern of connectionPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const from = match[1];
          const to = match[2];
          
          // Only add if both nodes exist
          if (nodes.find(n => n.id.toLowerCase() === from.toLowerCase()) &&
              nodes.find(n => n.id.toLowerCase() === to.toLowerCase())) {
            connections.push({
              from,
              to,
              connectionType: 'supply', // Default, can be refined
              confidence: 'medium',
            });
          }
        }
      }
    }
  }

  // Build flow sequence using topological sort
  const flow = buildFlowSequence(nodes, connections);

  // Validate topology
  if (nodes.length === 0) {
    warnings.push('No equipment or devices found for this system type');
  }
  if (connections.length === 0 && nodes.length > 1) {
    warnings.push('No connections found between equipment');
  }

  return {
    systemName: `${systemType.toUpperCase()} System`,
    systemType,
    nodes,
    connections,
    flow,
    warnings,
  };
}

/**
 * Build flow sequence from connections using topological sort
 */
function buildFlowSequence(nodes: SystemNode[], connections: SystemConnection[]): string[] {
  const flow: string[] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();

  // Calculate in-degrees
  nodes.forEach(node => inDegree.set(node.id, 0));
  connections.forEach(conn => {
    inDegree.set(conn.to, (inDegree.get(conn.to) || 0) + 1);
  });

  // Find starting nodes (in-degree = 0)
  const queue: string[] = [];
  nodes.forEach(node => {
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id);
    }
  });

  // Topological sort
  while (queue.length > 0) {
    const current = queue.shift()!;
    flow.push(current);
    visited.add(current);

    // Find all nodes connected from current
    connections
      .filter(conn => conn.from === current)
      .forEach(conn => {
        const newDegree = (inDegree.get(conn.to) || 0) - 1;
        inDegree.set(conn.to, newDegree);
        if (newDegree === 0 && !visited.has(conn.to)) {
          queue.push(conn.to);
        }
      });
  }

  return flow;
}

/**
 * ========================================
 * 2. 3D ISOMETRIC VIEW INTERPRETATION
 * ========================================
 */

export interface IsometricElement {
  id: string;
  elementType: 'pipe' | 'duct' | 'conduit' | 'fitting' | 'equipment' | 'support';
  geometry: {
    startPoint?: { x: number; y: number; z: number };
    endPoint?: { x: number; y: number; z: number };
    orientation?: 'horizontal' | 'vertical' | 'angled';
    elevation?: number;
  };
  properties: {
    size?: string;
    material?: string;
    slope?: string;
  };
  connections: string[];           // IDs of connected elements
}

export interface IsometricView {
  viewName: string;
  discipline: 'plumbing' | 'hvac' | 'electrical' | 'structural';
  elements: IsometricElement[];
  spatialHierarchy: {
    level: number;
    elements: string[];
  }[];
  warnings: string[];
}

/**
 * Interpret isometric/3D views from construction documents
 */
export function interpretIsometricView(chunk: EnhancedChunk): IsometricView {
  const content = chunk.content.toLowerCase();
  const metadata = chunk.metadata || {};
  const elements: IsometricElement[] = [];
  const warnings: string[] = [];

  // Detect if this is an isometric view
  const isIsometric = /isometric|iso\s+view|3d\s+view|axonometric/i.test(content);
  
  if (!isIsometric) {
    warnings.push('Document does not appear to be an isometric view');
  }

  // Extract discipline
  let discipline: 'plumbing' | 'hvac' | 'electrical' | 'structural' = 'plumbing';
  if (/hvac|duct|air/i.test(content)) discipline = 'hvac';
  else if (/electrical|conduit|wire/i.test(content)) discipline = 'electrical';
  else if (/structural|beam|column/i.test(content)) discipline = 'structural';

  // Extract vertical elements (pipes/ducts rising)
  const verticalPatterns = [
    /(\S+)\s+(?:rises|vertical|up)\s+(?:to\s+)?(?:el\.?|elevation)?\s*(\d+)/gi,
    /(\S+)\s+@\s*el\.?\s*(\d+)/gi,
  ];

  for (const pattern of verticalPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const id = match[1];
      const elevation = parseInt(match[2]);
      
      elements.push({
        id,
        elementType: discipline === 'hvac' ? 'duct' : 'pipe',
        geometry: {
          orientation: 'vertical',
          elevation,
        },
        properties: {},
        connections: [],
      });
    }
  }

  // Extract horizontal elements with slopes
  const horizontalPatterns = [
    /(\S+)\s+(?:slope|slopes)\s+(\d+\.?\d*)\s*%/gi,
    /(\d+)"?\s+(pipe|duct|conduit)/gi,
  ];

  for (const pattern of horizontalPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const id = match[1] || `${match[1]}-${match[2]}`;
      const slope = match[2];
      
      elements.push({
        id,
        elementType: discipline === 'hvac' ? 'duct' : 'pipe',
        geometry: {
          orientation: 'horizontal',
        },
        properties: {
          slope: slope ? `${slope}%` : undefined,
        },
        connections: [],
      });
    }
  }

  // Extract fittings and connections
  const fittingPatterns = [
    /(\d+)°?\s+(elbow|tee|wye|reducer|coupling)/gi,
    /(elbow|tee|wye)\s+@\s+(\S+)/gi,
  ];

  for (const pattern of fittingPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const fittingType = match[2] || match[1];
      const id = `fitting-${fittingType}-${elements.length}`;
      
      elements.push({
        id,
        elementType: 'fitting',
        geometry: {},
        properties: {},
        connections: [],
      });
    }
  }

  // Build spatial hierarchy (group by elevation)
  const spatialHierarchy: { level: number; elements: string[] }[] = [];
  const elevationMap = new Map<number, string[]>();

  elements.forEach(el => {
    if (el.geometry.elevation) {
      const existing = elevationMap.get(el.geometry.elevation) || [];
      existing.push(el.id);
      elevationMap.set(el.geometry.elevation, existing);
    }
  });

  Array.from(elevationMap.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([level, elementIds]) => {
      spatialHierarchy.push({ level, elements: elementIds });
    });

  return {
    viewName: metadata.sheet_number || 'Unknown',
    discipline,
    elements,
    spatialHierarchy,
    warnings,
  };
}

/**
 * Extract 3D spatial relationships from isometric views
 */
export function extractSpatialRelationships(iso: IsometricView): {
  above: Map<string, string[]>;
  below: Map<string, string[]>;
  adjacent: Map<string, string[]>;
} {
  const above = new Map<string, string[]>();
  const below = new Map<string, string[]>();
  const adjacent = new Map<string, string[]>();

  // Build elevation index
  const elevationIndex = new Map<string, number>();
  iso.elements.forEach(el => {
    if (el.geometry.elevation !== undefined) {
      elevationIndex.set(el.id, el.geometry.elevation);
    }
  });

  // Calculate relationships
  iso.elements.forEach(el1 => {
    const elev1 = elevationIndex.get(el1.id);
    if (elev1 === undefined) return;

    iso.elements.forEach(el2 => {
      if (el1.id === el2.id) return;
      
      const elev2 = elevationIndex.get(el2.id);
      if (elev2 === undefined) return;

      if (elev1 > elev2) {
        // el1 is above el2
        const aboveList = above.get(el1.id) || [];
        aboveList.push(el2.id);
        above.set(el1.id, aboveList);

        const belowList = below.get(el2.id) || [];
        belowList.push(el1.id);
        below.set(el2.id, belowList);
      } else if (Math.abs(elev1 - elev2) < 1) {
        // Same elevation - adjacent
        const adjList1 = adjacent.get(el1.id) || [];
        adjList1.push(el2.id);
        adjacent.set(el1.id, adjList1);
      }
    });
  });

  return { above, below, adjacent };
}

/**
 * ========================================
 * 3. ADVANCED CONFLICT DETECTION
 * ========================================
 */

export interface AdvancedConflict {
  conflictId: string;
  severity: 'critical' | 'major' | 'minor' | 'warning';
  conflictType: 
    | 'spatial_clash'
    | 'code_violation'
    | 'clearance_issue'
    | 'access_problem'
    | 'load_conflict'
    | 'incompatible_materials'
    | 'coordination_gap';
  location: {
    gridRef?: string;
    room?: string;
    floor?: string;
    elevation?: number;
  };
  description: string;
  affectedSystems: string[];
  affectedElements: string[];
  codeReference?: string;
  recommendations: string[];
  estimatedCost?: {
    min: number;
    max: number;
    currency: string;
  };
}

/**
 * Advanced multi-discipline conflict detection
 */
export async function detectAdvancedConflicts(
  projectSlug: string,
  focusArea?: { from: string; to: string }
): Promise<AdvancedConflict[]> {
  const conflicts: AdvancedConflict[] = [];

  // Get all MEP topologies
  const hvacTopology = await reconstructSystemTopology(projectSlug, 'hvac');
  const plumbingTopology = await reconstructSystemTopology(projectSlug, 'plumbing');
  const electricalTopology = await reconstructSystemTopology(projectSlug, 'electrical');

  // Check for spatial clashes (equipment in same location)
  const locationMap = new Map<string, { system: string; equipment: string }[]>();

  [hvacTopology, plumbingTopology, electricalTopology].forEach(topology => {
    topology.nodes.forEach(node => {
      if (node.location?.gridRef) {
        const key = node.location.gridRef;
        const existing = locationMap.get(key) || [];
        existing.push({
          system: topology.systemType,
          equipment: node.id,
        });
        locationMap.set(key, existing);
      }
    });
  });

  // Detect clashes
  locationMap.forEach((items, gridRef) => {
    if (items.length > 1) {
      conflicts.push({
        conflictId: `clash-${gridRef}`,
        severity: 'major',
        conflictType: 'spatial_clash',
        location: { gridRef },
        description: `Multiple systems occupy the same location at grid ${gridRef}`,
        affectedSystems: [...new Set(items.map(i => i.system))],
        affectedElements: items.map(i => i.equipment),
        recommendations: [
          'Coordinate equipment locations with MEP coordinator',
          'Review clearance requirements',
          'Consider vertical separation',
        ],
      });
    }
  });

  // Check for clearance violations
  const clearanceRequirements = {
    'electrical panel': 36, // 36" clearance
    'hvac equipment': 30,   // 30" service clearance
    'fire alarm panel': 36,
  };

  Object.entries(clearanceRequirements).forEach(([equipmentType, required]) => {
    // Check each topology for equipment needing clearance
    [hvacTopology, plumbingTopology, electricalTopology].forEach(topology => {
      topology.nodes.forEach(node => {
        if (node.name.toLowerCase().includes(equipmentType.split(' ')[0])) {
          // Check if other equipment is too close
          const nearbyEquipment = topology.nodes.filter(other => 
            other.id !== node.id && 
            other.location?.gridRef === node.location?.gridRef
          );

          if (nearbyEquipment.length > 0) {
            conflicts.push({
              conflictId: `clearance-${node.id}`,
              severity: 'critical',
              conflictType: 'clearance_issue',
              location: node.location || {},
              description: `${node.name} may not have required ${required}" clearance`,
              affectedSystems: [topology.systemType],
              affectedElements: [node.id, ...nearbyEquipment.map(n => n.id)],
              codeReference: 'NEC 110.26 / IBC 1206',
              recommendations: [
                `Verify ${required}" clearance in all directions`,
                'Relocate nearby equipment if necessary',
                'Document clearance measurements',
              ],
            });
          }
        }
      });
    });
  });

  // Check for load conflicts (electrical circuits)
  if (electricalTopology.connections.length > 0) {
    const circuitLoads = new Map<string, number>();
    
    electricalTopology.connections.forEach(conn => {
      const load = circuitLoads.get(conn.from) || 0;
      circuitLoads.set(conn.from, load + 1);
    });

    circuitLoads.forEach((load, circuit) => {
      if (load > 10) { // Arbitrary threshold
        conflicts.push({
          conflictId: `load-${circuit}`,
          severity: 'major',
          conflictType: 'load_conflict',
          location: {},
          description: `${circuit} may be overloaded with ${load} connections`,
          affectedSystems: ['electrical'],
          affectedElements: [circuit],
          codeReference: 'NEC 210.19',
          recommendations: [
            'Perform load calculation',
            'Consider circuit splitting',
            'Verify wire sizing',
          ],
        });
      }
    });
  }

  return conflicts;
}

/**
 * ========================================
 * 4. ADAPTIVE SYMBOL LEARNING
 * ========================================
 */

export interface LearnedSymbol {
  symbolId: string;
  symbolType: string;
  category: 'hvac' | 'plumbing' | 'electrical' | 'architectural' | 'structural';
  appearances: {
    documentId: string;
    pageNumber: number;
    context: string;
    confidence: number;
  }[];
  variations: string[];             // Different representations of same symbol
  standardMapping?: string;          // Maps to standard symbol
  learningConfidence: number;        // 0-1 score
}

export interface SymbolLibrary {
  projectId: string;
  symbols: LearnedSymbol[];
  lastUpdated: Date;
  totalAppearances: number;
}

/**
 * Learn project-specific symbols from document usage
 */
export async function learnProjectSymbols(
  projectSlug: string
): Promise<SymbolLibrary> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Document: {
        include: {
          DocumentChunk: true,
        },
      },
    },
  });

  if (!project) {
    return {
      projectId: '',
      symbols: [],
      lastUpdated: new Date(),
      totalAppearances: 0,
    };
  }

  const symbolMap = new Map<string, LearnedSymbol>();
  let totalAppearances = 0;

  // Symbol patterns to detect
  const symbolPatterns = [
    // HVAC symbols
    { pattern: /\[AHU\]/gi, type: 'Air Handling Unit', category: 'hvac' as const },
    { pattern: /\[VAV\]/gi, type: 'Variable Air Volume', category: 'hvac' as const },
    { pattern: /⊗/g, type: 'Supply Diffuser', category: 'hvac' as const },
    { pattern: /⊕/g, type: 'Return Grille', category: 'hvac' as const },
    
    // Plumbing symbols
    { pattern: /\[WH\]/gi, type: 'Water Heater', category: 'plumbing' as const },
    { pattern: /\[P\]/gi, type: 'Pump', category: 'plumbing' as const },
    { pattern: /⌀/g, type: 'Pipe Diameter', category: 'plumbing' as const },
    
    // Electrical symbols
    { pattern: /⚡/g, type: 'Power', category: 'electrical' as const },
    { pattern: /\[P\]/gi, type: 'Panel', category: 'electrical' as const },
    { pattern: /○/g, type: 'Junction Box', category: 'electrical' as const },
  ];

  for (const doc of project.Document) {
    for (const chunk of doc.DocumentChunk) {
      const content = chunk.content;
      
      for (const symbolDef of symbolPatterns) {
        symbolDef.pattern.lastIndex = 0;
        let match;
        
        while ((match = symbolDef.pattern.exec(content)) !== null) {
          const symbolId = `${symbolDef.category}-${symbolDef.type}`.toLowerCase().replace(/\s+/g, '-');
          
          let symbol = symbolMap.get(symbolId);
          if (!symbol) {
            symbol = {
              symbolId,
              symbolType: symbolDef.type,
              category: symbolDef.category,
              appearances: [],
              variations: [],
              learningConfidence: 0,
            };
            symbolMap.set(symbolId, symbol);
          }

          // Add appearance
          symbol.appearances.push({
            documentId: doc.id,
            pageNumber: chunk.pageNumber || 0,
            context: content.substring(Math.max(0, match.index - 50), match.index + 50),
            confidence: 0.8,
          });

          // Track variations
          if (!symbol.variations.includes(match[0])) {
            symbol.variations.push(match[0]);
          }

          totalAppearances++;
        }
      }
    }
  }

  // Calculate learning confidence based on appearances
  symbolMap.forEach(symbol => {
    const appearanceCount = symbol.appearances.length;
    symbol.learningConfidence = Math.min(1.0, appearanceCount / 10); // Max confidence at 10+ appearances
  });

  return {
    projectId: project.id,
    symbols: Array.from(symbolMap.values()),
    lastUpdated: new Date(),
    totalAppearances,
  };
}

/**
 * Apply learned symbols to improve chunk understanding
 */
export function applyLearnedSymbols(
  chunk: EnhancedChunk,
  symbolLibrary: SymbolLibrary
): EnhancedChunk {
  let enhancedContent = chunk.content;
  
  symbolLibrary.symbols.forEach(symbol => {
    symbol.variations.forEach(variation => {
      // Replace symbol with expanded description
      const replacement = `${variation} [${symbol.symbolType}]`;
      enhancedContent = enhancedContent.replace(
        new RegExp(variation, 'g'),
        replacement
      );
    });
  });

  return {
    ...chunk,
    content: enhancedContent,
    metadata: {
      ...chunk.metadata,
      symbol_library_applied: true,
      symbols_recognized: symbolLibrary.symbols.filter(s => 
        chunk.content.includes(s.variations[0])
      ).map(s => s.symbolType),
    },
  };
}

/**
 * Generate symbol recognition report
 */
export function generateSymbolReport(library: SymbolLibrary): {
  summary: string;
  byCategory: Map<string, number>;
  topSymbols: LearnedSymbol[];
  coverage: number;
} {
  const byCategory = new Map<string, number>();
  
  library.symbols.forEach(symbol => {
    const count = byCategory.get(symbol.category) || 0;
    byCategory.set(symbol.category, count + symbol.appearances.length);
  });

  const topSymbols = library.symbols
    .sort((a, b) => b.appearances.length - a.appearances.length)
    .slice(0, 10);

  const coverage = library.symbols.filter(s => s.learningConfidence > 0.7).length / 
                   Math.max(1, library.symbols.length);

  const summary = `
Learned ${library.symbols.length} unique symbols from ${library.totalAppearances} appearances.
Symbol Coverage: ${(coverage * 100).toFixed(1)}%
High Confidence Symbols: ${library.symbols.filter(s => s.learningConfidence > 0.7).length}
  `.trim();

  return {
    summary,
    byCategory,
    topSymbols,
    coverage,
  };
}

// ============================================================================
// END OF PHASE 3C ENHANCEMENTS
// ============================================================================
// END OF PHASE 3A ENHANCEMENTS
// ============================================================================