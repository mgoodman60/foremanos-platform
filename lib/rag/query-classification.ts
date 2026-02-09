/**
 * RAG Query Classification for Construction Document Analysis
 *
 * Extracted from lib/rag-enhancements.ts — query intent detection,
 * identifier extraction, and keyword extraction.
 */

import { MEP_ENTITIES } from './mep-entities';

/**
 * Identify query type to determine retrieval strategy
 */
export function classifyQueryIntent(query: string): {
  type: 'requirement' | 'measurement' | 'counting' | 'location' | 'room_specific' | 'mep' | 'takeoff' | 'daily_report' | 'general';
  requiresNotes: boolean;
  requiresCrossRef: boolean;
  requiresRegulatory: boolean;
  mepTrade?: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm';
  roomNumber?: string;
  isTakeoff?: boolean;
  takeoffScope?: string;
} {
  const queryLower = query.toLowerCase();

  // Daily report / field report queries
  const dailyReportPatterns = [
    'what did we do',
    'what happened',
    'work performed',
    'work done',
    'what work',
    'crew size',
    'how many workers',
    'labor on',
    'weather on',
    'weather last',
    'weather conditions on',
    'delays on',
    'what delays',
    'delay reason',
    'equipment on site',
    'equipment used',
    'safety incident',
    'safety on',
    'daily report',
    'field report',
    'yesterday',
    'last monday',
    'last tuesday',
    'last wednesday',
    'last thursday',
    'last friday',
    'last saturday',
    'last sunday',
    'last week',
    'this week',
  ];

  // Also check for date patterns like "on 2/5", "on january 5", "on the 5th"
  const datePatterns = /\b(?:on|for|from)\s+(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|the\s+\d{1,2}(?:st|nd|rd|th))\b/i;

  const isDailyReport = dailyReportPatterns.some(p => queryLower.includes(p)) || datePatterns.test(query);

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
  let type: 'requirement' | 'measurement' | 'counting' | 'location' | 'room_specific' | 'mep' | 'takeoff' | 'daily_report' | 'general' = 'general';

  if (isTakeoff) {
    type = 'takeoff';
  } else if (isMEP) {
    type = 'mep';
  } else if (isDailyReport) {
    type = 'daily_report';
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
    requiresNotes: type === 'daily_report' ? false : (isRequirement || isMEP || isTakeoff),
    requiresCrossRef: type === 'daily_report' ? false : (needsCrossRef || isTakeoff),
    requiresRegulatory: hasRegulatoryRef,
    mepTrade,
    roomNumber,
    isTakeoff,
    takeoffScope,
  };
}

/**
 * Extract identifiers from query (sheet numbers, detail tags, door marks, etc.)
 */
export function extractIdentifiers(query: string): string[] {
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
export function extractKeywords(query: string): string[] {
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
