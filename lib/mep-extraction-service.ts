/**
 * MEP Equipment Extraction Service
 * 
 * Uses AI to extract MEP equipment from construction documents
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';

export interface MEPEquipment {
  id: string;
  tag: string;
  name: string;
  type: string;
  trade: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm';
  specifications: Record<string, string>;
  location?: string;
  status: 'installed' | 'pending' | 'ordered';
  sheetReference?: string;
  notes?: string[];
  confidence?: number;
}

export interface MEPConflict {
  id: string;
  type: 'clearance' | 'coordination' | 'specification';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location: string;
  affectedEquipment: string[];
}

// MEP entity patterns by trade
const MEP_PATTERNS = {
  hvac: {
    regex: /\b(AHU|RTU|VAV|FCU|MAU|ERV|HRV|DOAS|UH|EF|IF|RF|SF|AC|HP|CU|CHILLER|BOILER|HX|PAU|CRAC|CRAH)-?\d*[A-Z]?\b/gi,
    keywords: ['air handling', 'rooftop unit', 'variable air volume', 'fan coil', 'exhaust fan', 'supply air', 
               'return air', 'ductwork', 'diffuser', 'thermostat', 'hvac', 'mechanical', 'heating', 'cooling',
               'ventilation', 'air conditioning', 'chiller', 'boiler', 'condenser', 'compressor']
  },
  electrical: {
    regex: /\b(MDP|MSB|SB|RP|LP|DP|PP|EM|PNL|XFMR|GEN|ATS|UPS|VFD|MCC|CDP|LTG|PWR)-?\d*[A-Z]?\b/gi,
    keywords: ['panel', 'switchboard', 'transformer', 'generator', 'circuit', 'breaker', 'electrical',
               'power', 'lighting', 'receptacle', 'outlet', 'conduit', 'wire', 'voltage', 'amperage']
  },
  plumbing: {
    regex: /\b(WC|LAV|UR|DF|FD|SH|BT|HB|MOP|EWC|CO|WH|HWH|PUMP|EXP|PRV|BFP|SAN|DWV|CW|HW|VENT)-?\d*[A-Z]?\b/gi,
    keywords: ['water closet', 'toilet', 'lavatory', 'sink', 'faucet', 'drain', 'pipe', 'plumbing',
               'water heater', 'pump', 'valve', 'fixture', 'sanitary', 'domestic water', 'waste']
  },
  fire_alarm: {
    regex: /\b(FACU|FACP|NAC|SLC|ANN|HS|PS|SD|PD|DUCT|WF|FDC|SPKR|PIV|OS&Y|TAMPER)-?\d*[A-Z]?\b/gi,
    keywords: ['fire alarm', 'smoke detector', 'pull station', 'sprinkler', 'horn', 'strobe',
               'fire protection', 'suppression', 'standpipe', 'fire pump', 'fire extinguisher']
  }
};

const TYPE_MAP: Record<string, Record<string, string>> = {
  hvac: {
    'AHU': 'Air Handling Unit',
    'RTU': 'Rooftop Unit',
    'VAV': 'Variable Air Volume Box',
    'FCU': 'Fan Coil Unit',
    'MAU': 'Make-up Air Unit',
    'ERV': 'Energy Recovery Ventilator',
    'HRV': 'Heat Recovery Ventilator',
    'DOAS': 'Dedicated Outdoor Air System',
    'UH': 'Unit Heater',
    'EF': 'Exhaust Fan',
    'IF': 'Inline Fan',
    'RF': 'Return Fan',
    'SF': 'Supply Fan',
    'AC': 'Air Conditioning Unit',
    'HP': 'Heat Pump',
    'CU': 'Condensing Unit',
    'CHILLER': 'Chiller',
    'BOILER': 'Boiler',
    'HX': 'Heat Exchanger',
    'PAU': 'Primary Air Unit',
    'CRAC': 'Computer Room AC',
    'CRAH': 'Computer Room Air Handler'
  },
  electrical: {
    'MDP': 'Main Distribution Panel',
    'MSB': 'Main Switchboard',
    'SB': 'Switchboard',
    'RP': 'Receptacle Panel',
    'LP': 'Lighting Panel',
    'DP': 'Distribution Panel',
    'PP': 'Power Panel',
    'EM': 'Emergency Panel',
    'PNL': 'Panel',
    'XFMR': 'Transformer',
    'GEN': 'Generator',
    'ATS': 'Automatic Transfer Switch',
    'UPS': 'Uninterruptible Power Supply',
    'VFD': 'Variable Frequency Drive',
    'MCC': 'Motor Control Center',
    'CDP': 'Central Distribution Panel',
    'LTG': 'Lighting Panel',
    'PWR': 'Power Panel'
  },
  plumbing: {
    'WC': 'Water Closet',
    'LAV': 'Lavatory',
    'UR': 'Urinal',
    'DF': 'Drinking Fountain',
    'FD': 'Floor Drain',
    'SH': 'Shower',
    'BT': 'Bathtub',
    'HB': 'Hose Bibb',
    'MOP': 'Mop Sink',
    'EWC': 'Electric Water Cooler',
    'CO': 'Cleanout',
    'WH': 'Water Heater',
    'HWH': 'Hot Water Heater',
    'PUMP': 'Pump',
    'EXP': 'Expansion Tank',
    'PRV': 'Pressure Reducing Valve',
    'BFP': 'Backflow Preventer'
  },
  fire_alarm: {
    'FACU': 'Fire Alarm Control Unit',
    'FACP': 'Fire Alarm Control Panel',
    'NAC': 'Notification Appliance Circuit',
    'SLC': 'Signaling Line Circuit',
    'ANN': 'Annunciator',
    'HS': 'Horn/Strobe',
    'PS': 'Pull Station',
    'SD': 'Smoke Detector',
    'PD': 'Photoelectric Detector',
    'DUCT': 'Duct Smoke Detector',
    'WF': 'Water Flow Switch',
    'FDC': 'Fire Department Connection',
    'SPKR': 'Sprinkler Head',
    'PIV': 'Post Indicator Valve',
    'TAMPER': 'Tamper Switch'
  }
};

/**
 * Extract MEP equipment from project documents using AI
 */
export async function extractMEPEquipmentWithAI(
  projectSlug: string,
  tradeFilter?: string
): Promise<{ equipment: MEPEquipment[]; conflicts: MEPConflict[] }> {
  // Get document chunks
  const chunks = await prisma.documentChunk.findMany({
    where: {
      Document: {
        Project: { slug: projectSlug }
      }
    },
    include: {
      Document: { select: { id: true, name: true, fileName: true } }
    },
    orderBy: { pageNumber: 'asc' }
  });

  if (chunks.length === 0) {
    return { equipment: [], conflicts: [] };
  }

  const equipmentMap = new Map<string, MEPEquipment>();
  
  // First pass: Pattern-based extraction
  for (const chunk of chunks) {
    const content = chunk.content || '';
    const metadata = parseMetadata(chunk.metadata);

    for (const [trade, config] of Object.entries(MEP_PATTERNS)) {
      if (tradeFilter && trade !== tradeFilter) continue;

      // Check if content has relevant keywords
      const hasRelevantContent = config.keywords.some(kw => 
        content.toLowerCase().includes(kw)
      );

      // Pattern matching
      const matches = content.match(config.regex);
      if (matches) {
        for (const tag of matches) {
          const normalizedTag = tag.toUpperCase();
          if (!equipmentMap.has(normalizedTag)) {
            const prefix = normalizedTag.match(/^[A-Z]+/)?.[0] || '';
            const type = TYPE_MAP[trade]?.[prefix] || 'Equipment';
            
            equipmentMap.set(normalizedTag, {
              id: `${trade}-${normalizedTag}`,
              tag: normalizedTag,
              name: `${type} ${normalizedTag}`,
              type,
              trade: trade as MEPEquipment['trade'],
              specifications: extractSpecifications(content, normalizedTag),
              location: metadata.room_number || extractLocation(content, normalizedTag),
              status: determineStatus(content),
              sheetReference: chunk.Document?.name || chunk.Document?.fileName || metadata.sheet_number,
              notes: extractNotes(content, normalizedTag),
              confidence: 0.85
            });
          }
        }
      }
    }
  }

  // If we found equipment through patterns, return
  if (equipmentMap.size > 0) {
    const equipment = Array.from(equipmentMap.values());
    const conflicts = detectConflicts(equipment);
    return { equipment, conflicts };
  }

  // Second pass: AI-based extraction for documents without clear tags
  // Sample some chunks for AI analysis
  const relevantChunks = chunks
    .filter((chunk: { content: string | null }) => {
      const content = (chunk.content || '').toLowerCase();
      return Object.values(MEP_PATTERNS).some(config =>
        config.keywords.some(kw => content.includes(kw))
      );
    })
    .slice(0, 10); // Limit for AI processing

  if (relevantChunks.length === 0) {
    return { equipment: [], conflicts: [] };
  }

  try {
    const aiEquipment = await extractWithAI(relevantChunks, tradeFilter);
    for (const eq of aiEquipment) {
      if (!equipmentMap.has(eq.tag)) {
        equipmentMap.set(eq.tag, eq);
      }
    }
  } catch (error) {
    console.error('AI MEP extraction error:', error);
  }

  const equipment = Array.from(equipmentMap.values());
  const conflicts = detectConflicts(equipment);
  return { equipment, conflicts };
}

/**
 * Use AI to extract equipment from document content
 */
async function extractWithAI(
  chunks: Array<{ content: string | null; Document: { name: string | null; fileName: string | null } | null }>,
  tradeFilter?: string
): Promise<MEPEquipment[]> {
  const combinedContent = chunks
    .map(c => c.content || '')
    .join('\n---\n')
    .slice(0, 8000); // Limit content size

  const tradeContext = tradeFilter 
    ? `Focus on ${tradeFilter.toUpperCase()} equipment only.`
    : 'Extract all MEP equipment (HVAC, Electrical, Plumbing, Fire Alarm).';

  const prompt = `Analyze this construction document content and extract MEP (Mechanical, Electrical, Plumbing) equipment.
${tradeContext}

Document Content:
${combinedContent}

Extract equipment with the following JSON format (return ONLY the JSON array, no markdown):
[
  {
    "tag": "equipment tag/ID",
    "name": "full equipment name",
    "type": "equipment type",
    "trade": "hvac" | "electrical" | "plumbing" | "fire_alarm",
    "specifications": { "key": "value" },
    "location": "room/area if mentioned",
    "status": "installed" | "pending" | "ordered"
  }
]

If no equipment is found, return empty array: []`;

  const response = await callAbacusLLM(
    [{ role: 'user', content: prompt }],
    { model: 'gpt-5.2' }
  );

  const content = response.content;
  
  // Parse JSON from response
  const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/)
    || content.match(/\[\s*\]/);
  
  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((item: Record<string, unknown>, index: number) => ({
      id: `ai-${item.trade}-${index}`,
      tag: String(item.tag || `EQUIP-${index}`),
      name: String(item.name || 'Unknown Equipment'),
      type: String(item.type || 'Equipment'),
      trade: validateTrade(String(item.trade)),
      specifications: (item.specifications as Record<string, string>) || {},
      location: item.location ? String(item.location) : undefined,
      status: validateStatus(String(item.status)),
      sheetReference: undefined,
      notes: [],
      confidence: 0.7
    }));
  } catch {
    return [];
  }
}

function validateTrade(trade: string): MEPEquipment['trade'] {
  const valid: MEPEquipment['trade'][] = ['hvac', 'plumbing', 'electrical', 'fire_alarm'];
  return valid.includes(trade as MEPEquipment['trade']) 
    ? (trade as MEPEquipment['trade']) 
    : 'hvac';
}

function validateStatus(status: string): MEPEquipment['status'] {
  const valid: MEPEquipment['status'][] = ['installed', 'pending', 'ordered'];
  return valid.includes(status as MEPEquipment['status'])
    ? (status as MEPEquipment['status'])
    : 'pending';
}

function parseMetadata(metadata: unknown): Record<string, string> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata); } catch { return {}; }
  }
  return metadata as Record<string, string>;
}

function extractSpecifications(content: string, tag: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const tagIndex = content.indexOf(tag);
  if (tagIndex === -1) return specs;

  const context = content.substring(
    Math.max(0, tagIndex - 300),
    Math.min(content.length, tagIndex + 300)
  );

  // CFM
  const cfm = context.match(/(\d+[,\d]*)\s*CFM/i);
  if (cfm) specs.CFM = cfm[1].replace(/,/g, '');

  // Voltage
  const voltage = context.match(/(\d+)\s*V(?:olts)?/i);
  if (voltage) specs.Voltage = voltage[1] + 'V';

  // Amperage
  const amps = context.match(/(\d+)\s*A(?:mp|mps)?/i);
  if (amps) specs.Amperage = amps[1] + 'A';

  // HP
  const hp = context.match(/(\d+(?:\.\d+)?)\s*HP/i);
  if (hp) specs.HP = hp[1] + ' HP';

  // GPM
  const gpm = context.match(/(\d+(?:\.\d+)?)\s*GPM/i);
  if (gpm) specs['Flow Rate'] = gpm[1] + ' GPM';

  // BTU
  const btu = context.match(/(\d+[,\d]*)\s*BTU/i);
  if (btu) specs.BTU = btu[1].replace(/,/g, '');

  // Tons
  const tons = context.match(/(\d+(?:\.\d+)?)\s*(?:ton|tons)/i);
  if (tons) specs.Capacity = tons[1] + ' Tons';

  // Size/Dimensions
  const size = context.match(/(\d+)\s*["']?\s*x\s*(\d+)/i);
  if (size) specs.Size = `${size[1]}" x ${size[2]}"`;

  return specs;
}

function extractLocation(content: string, tag: string): string | undefined {
  const tagIndex = content.indexOf(tag);
  if (tagIndex === -1) return undefined;

  const context = content.substring(
    Math.max(0, tagIndex - 150),
    Math.min(content.length, tagIndex + 150)
  );

  // Room number
  const room = context.match(/(?:Room|RM|R)\s*[#:]?\s*(\d+[A-Z]?)/i);
  if (room) return `Room ${room[1]}`;

  // Floor
  const floor = context.match(/(\d+)(?:st|nd|rd|th)?\s*(?:Floor|FL)/i);
  if (floor) return `Floor ${floor[1]}`;

  // Level
  const level = context.match(/(?:Level|LVL)\s*(\d+|[A-Z])/i);
  if (level) return `Level ${level[1]}`;

  // Area
  const area = context.match(/(?:Area|Zone)\s*[#:]?\s*([A-Z0-9]+)/i);
  if (area) return `Area ${area[1]}`;

  return undefined;
}

function determineStatus(content: string): MEPEquipment['status'] {
  const lower = content.toLowerCase();
  if (lower.includes('existing') || lower.includes('installed') || lower.includes('in place')) {
    return 'installed';
  }
  if (lower.includes('on order') || lower.includes('ordered') || lower.includes('procurement')) {
    return 'ordered';
  }
  return 'pending';
}

function extractNotes(content: string, tag: string): string[] {
  const notes: string[] = [];
  const tagIndex = content.indexOf(tag);
  if (tagIndex === -1) return notes;

  const context = content.substring(
    Math.max(0, tagIndex - 400),
    Math.min(content.length, tagIndex + 400)
  );

  // Note patterns
  const patterns = [
    /NOTE:\s*([^.\n]{10,100})/gi,
    /\*\s*([^\n]{10,100})/g,
    /SEE\s+([^.\n]{10,50})/gi,
    /VERIFY\s+([^.\n]{10,80})/gi
  ];

  for (const pattern of patterns) {
    for (const match of context.matchAll(pattern)) {
      if (match[1]) notes.push(match[1].trim());
    }
  }

  return [...new Set(notes)].slice(0, 5);
}

function detectConflicts(equipment: MEPEquipment[]): MEPConflict[] {
  const conflicts: MEPConflict[] = [];
  const locationMap = new Map<string, MEPEquipment[]>();

  // Group by location
  for (const eq of equipment) {
    if (!eq.location) continue;
    const key = eq.location.toLowerCase();
    if (!locationMap.has(key)) locationMap.set(key, []);
    locationMap.get(key)!.push(eq);
  }

  // Check for multi-trade conflicts
  for (const [location, items] of locationMap.entries()) {
    if (items.length <= 1) continue;
    
    const trades = new Set(items.map(e => e.trade));
    if (trades.size > 1) {
      conflicts.push({
        id: `conflict-${location.replace(/\s/g, '-')}`,
        type: 'coordination',
        severity: trades.size > 2 ? 'high' : 'medium',
        description: `Multiple MEP systems in same location may require coordination: ${Array.from(trades).join(', ')}`,
        location: items[0].location!,
        affectedEquipment: items.map(e => e.tag)
      });
    }
  }

  return conflicts;
}
