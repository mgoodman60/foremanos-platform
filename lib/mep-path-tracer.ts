/**
 * Advanced MEP Path Tracing System
 * Traces mechanical, electrical, and plumbing paths through buildings
 * Includes vertical routing and clash detection
 * 
 * Features:
 * - 3D path tracing across multiple floors
 * - Vertical riser identification and routing
 * - Clash detection between systems
 * - System connectivity analysis
 * - Load path calculations
 */

import { prisma } from './db';
import type { GridCoordinate } from './spatial-correlation';
import { parseGridCoordinate, calculateGridDistance } from './spatial-correlation';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type MEPSystem = 'mechanical' | 'electrical' | 'plumbing' | 'fire_protection';
export type MEPElementType = 
  | 'duct' | 'pipe' | 'conduit' | 'cable_tray'
  | 'equipment' | 'fixture' | 'panel' | 'riser'
  | 'junction' | 'valve' | 'damper';

export interface MEPElement {
  id: string;
  type: MEPElementType;
  system: MEPSystem;
  location: {
    floor: string;
    grid?: GridCoordinate;
    coordinates?: { x: number; y: number; z?: number };
    description: string;
  };
  size?: string; // e.g., "6\" diameter", "2\" conduit"
  capacity?: number;
  connections: string[]; // IDs of connected elements
  elevation?: number; // Above finished floor (AFF)
  tag?: string; // Equipment/system tag
  metadata?: {
    manufacturer?: string;
    model?: string;
    voltage?: string;
    pressure?: string;
    flowRate?: string;
    [key: string]: any;
  };
}

export interface MEPPath {
  id: string;
  system: MEPSystem;
  startPoint: MEPElement;
  endPoint: MEPElement;
  intermediatePoints: MEPElement[];
  pathLength: number;
  floors: string[];
  risers: MEPElement[];
  clashes: ClashDetection[];
  confidence: number; // 0-1
}

export interface VerticalRiser {
  id: string;
  system: MEPSystem;
  tag: string;
  floors: string[];
  locations: Array<{
    floor: string;
    grid: GridCoordinate;
    elevation: number;
  }>;
  size: string;
  connectedElements: string[];
}

export interface ClashDetection {
  id: string;
  type: 'hard_clash' | 'soft_clash' | 'clearance_clash';
  severity: 'critical' | 'major' | 'minor';
  element1: MEPElement;
  element2: MEPElement;
  location: {
    floor: string;
    grid?: GridCoordinate;
    description: string;
  };
  distance: number; // Separation distance in inches
  clearanceRequired: number;
  resolution?: string;
}

export interface MEPNetwork {
  system: MEPSystem;
  elements: MEPElement[];
  connections: Array<{ from: string; to: string; distance: number }>;
  risers: VerticalRiser[];
  mainDistribution: MEPElement[];
  branches: Array<{
    id: string;
    elements: MEPElement[];
    endpoints: MEPElement[];
  }>;
}

// ============================================================================
// ELEMENT EXTRACTION
// ============================================================================

/**
 * Extract MEP elements from document chunks
 */
export async function extractMEPElements(
  projectSlug: string,
  system?: MEPSystem
): Promise<MEPElement[]> {
  try {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          Project: { slug: projectSlug }
        }
      }
    });

    const elements: MEPElement[] = [];
    let elementIdCounter = 1;

    for (const chunk of chunks) {
      const metadata = chunk.metadata as any;
      const content = chunk.content || '';
      const sheetNumber = metadata?.sheet_number || 'unknown';
      const drawingType = (metadata?.drawing_type || '').toLowerCase();

      // Determine if this is an MEP drawing
      const isMechanical = drawingType.includes('mech') || drawingType.includes('hvac');
      const isElectrical = drawingType.includes('elec') || drawingType.includes('power') || drawingType.includes('light');
      const isPlumbing = drawingType.includes('plumb') || drawingType.includes('sanit') || drawingType.includes('water');
      const isFireProtection = drawingType.includes('fire') || drawingType.includes('sprinkler');

      if (!isMechanical && !isElectrical && !isPlumbing && !isFireProtection) {
        continue; // Skip non-MEP drawings
      }

      const detectedSystem: MEPSystem = 
        isMechanical ? 'mechanical' :
        isElectrical ? 'electrical' :
        isPlumbing ? 'plumbing' :
        'fire_protection';

      // Skip if system filter doesn't match
      if (system && system !== detectedSystem) {
        continue;
      }

      // Extract MEP callouts from metadata
      if (metadata?.mepCallouts) {
        for (const callout of metadata.mepCallouts) {
          const element = parseMEPCallout(callout, detectedSystem, sheetNumber, elementIdCounter++);
          if (element) {
            elements.push(element);
          }
        }
      }

      // Extract from content using patterns
      const extracted = extractMEPFromContent(content, detectedSystem, sheetNumber, elementIdCounter);
      elements.push(...extracted);
      elementIdCounter += extracted.length;
    }

    return elements;
  } catch (error) {
    logger.error('MEP_PATH_TRACER', 'Error extracting MEP elements', error instanceof Error ? error : undefined);
    return [];
  }
}

/**
 * Parse MEP callout into structured element
 */
function parseMEPCallout(
  callout: any,
  system: MEPSystem,
  floor: string,
  id: number
): MEPElement | null {
  try {
    const type = inferElementType(callout.description || callout.type || '', system);
    const location = parseGridCoordinate(callout.location || '');

    return {
      id: `${system}-${id}`,
      type,
      system,
      location: {
        floor,
        grid: location || undefined,
        description: callout.location || callout.context || ''
      },
      size: callout.size || callout.dimension,
      tag: callout.tag || callout.mark,
      connections: [],
      metadata: {
        raw: callout
      }
    };
  } catch {
    return null;
  }
}

/**
 * Extract MEP elements from text content using patterns
 */
function extractMEPFromContent(
  content: string,
  system: MEPSystem,
  floor: string,
  startId: number
): MEPElement[] {
  const elements: MEPElement[] = [];
  let id = startId;

  // Mechanical: Ducts, Equipment, Risers
  if (system === 'mechanical') {
    // Duct patterns: "24x12 duct", "6\" round duct"
    const ductMatches = content.match(/\b(\d+[xX]\d+|\d+["']?\s*(?:round|dia(?:meter)?))\s+duct/gi);
    if (ductMatches) {
      for (const match of ductMatches) {
        elements.push({
          id: `mechanical-${id++}`,
          type: 'duct',
          system: 'mechanical',
          location: { floor, description: extractContext(content, match) },
          size: match.match(/\d+[xX]\d+|\d+["']?/)?.[0],
          connections: []
        });
      }
    }

    // Equipment: "AHU-1", "RTU-2", "EF-3"
    const equipMatches = content.match(/\b(AHU|RTU|MAU|EF|VAV|FCU)[-\s]?\d+/gi);
    if (equipMatches) {
      for (const match of equipMatches) {
        const grid = extractGridNearMatch(content, match);
        elements.push({
          id: `mechanical-${id++}`,
          type: 'equipment',
          system: 'mechanical',
          location: {
            floor,
            grid,
            description: extractContext(content, match)
          },
          tag: match.toUpperCase(),
          connections: []
        });
      }
    }

    // Risers: "Riser R-1", "R-1", "HR-1"
    const riserMatches = content.match(/\b(?:riser\s+)?([A-Z]*R)[-\s]?(\d+)\b/gi);
    if (riserMatches) {
      for (const match of riserMatches) {
        const tag = match.replace(/^riser\s+/i, '').toUpperCase();
        const grid = extractGridNearMatch(content, match);
        elements.push({
          id: `mechanical-${id++}`,
          type: 'riser',
          system: 'mechanical',
          location: {
            floor,
            grid,
            description: extractContext(content, match)
          },
          tag,
          connections: []
        });
      }
    }
  }

  // Electrical: Panels, Conduit, Cable Tray
  if (system === 'electrical') {
    // Panel patterns: "Panel LP-1", "MDP", "Panelboard A", "LP-1"
    const panelMatches = content.match(/\b(?:panel(?:board)?\s+)?(?:MDP|LP|DP|PP)[-\s]?\d+\b/gi);
    if (panelMatches) {
      for (const match of panelMatches) {
        const grid = extractGridNearMatch(content, match);
        elements.push({
          id: `electrical-${id++}`,
          type: 'panel',
          system: 'electrical',
          location: {
            floor,
            grid,
            description: extractContext(content, match)
          },
          tag: match.replace(/^panel(?:board)?\s+/i, '').toUpperCase(),
          connections: []
        });
      }
    }

    // Conduit patterns: "2\" EMT", "3/4\" conduit"
    const conduitMatches = content.match(/\b\d+(?:\/\d+)?["']?\s*(?:EMT|RGS|PVC|conduit)/gi);
    if (conduitMatches) {
      for (const match of conduitMatches) {
        elements.push({
          id: `electrical-${id++}`,
          type: 'conduit',
          system: 'electrical',
          location: { floor, description: extractContext(content, match) },
          size: match.match(/\d+(?:\/\d+)?["']?/)?.[0],
          connections: []
        });
      }
    }
  }

  // Plumbing: Pipes, Fixtures, Risers
  if (system === 'plumbing') {
    // Pipe patterns: "4\" waste", "2\" water"
    const pipeMatches = content.match(/\b\d+["']?\s*(?:waste|vent|water|drain|supply|line)/gi);
    if (pipeMatches) {
      for (const match of pipeMatches) {
        elements.push({
          id: `plumbing-${id++}`,
          type: 'pipe',
          system: 'plumbing',
          location: { floor, description: extractContext(content, match) },
          size: match.match(/\d+["']?/)?.[0],
          connections: []
        });
      }
    }

    // Fixtures: "WC", "LAV", "DF"
    const fixtureMatches = content.match(/\b(WC|LAV|DF|FD|CO|URN|SH|TUB)[-\s]?\d*/gi);
    if (fixtureMatches) {
      for (const match of fixtureMatches) {
        elements.push({
          id: `plumbing-${id++}`,
          type: 'fixture',
          system: 'plumbing',
          location: { floor, description: extractContext(content, match) },
          tag: match.toUpperCase(),
          connections: []
        });
      }
    }

    // Risers: "Riser R-1", "WR-1", "SR-1"
    const riserMatches = content.match(/\b(?:riser\s+)?([A-Z]*R)[-\s]?(\d+)\b/gi);
    if (riserMatches) {
      for (const match of riserMatches) {
        const tag = match.replace(/^riser\s+/i, '').toUpperCase();
        const grid = extractGridNearMatch(content, match);
        elements.push({
          id: `plumbing-${id++}`,
          type: 'riser',
          system: 'plumbing',
          location: {
            floor,
            grid,
            description: extractContext(content, match)
          },
          tag,
          connections: []
        });
      }
    }
  }

  // Fire Protection: Risers, Pipes
  if (system === 'fire_protection') {
    // Risers: "FS-R1", "Fire sprinkler riser"
    const riserMatches = content.match(/\b(?:fire\s+sprinkler\s+riser\s+)?([A-Z]*R)[-\s]?(\d+)\b/gi);
    if (riserMatches) {
      for (const match of riserMatches) {
        const tag = match.replace(/^fire\s+sprinkler\s+riser\s+/i, '').toUpperCase();
        const grid = extractGridNearMatch(content, match);
        elements.push({
          id: `fire_protection-${id++}`,
          type: 'riser',
          system: 'fire_protection',
          location: {
            floor,
            grid,
            description: extractContext(content, match)
          },
          tag,
          connections: []
        });
      }
    }
  }

  return elements;
}

/**
 * Infer element type from description
 */
function inferElementType(description: string, system: MEPSystem): MEPElementType {
  const desc = description.toLowerCase();

  // Common keywords
  if (desc.includes('duct')) return 'duct';
  if (desc.includes('pipe')) return 'pipe';
  if (desc.includes('conduit')) return 'conduit';
  if (desc.includes('cable tray') || desc.includes('tray')) return 'cable_tray';
  if (desc.includes('panel')) return 'panel';
  if (desc.includes('riser')) return 'riser';
  if (desc.includes('valve')) return 'valve';
  if (desc.includes('damper')) return 'damper';
  if (desc.includes('junction') || desc.includes('box')) return 'junction';

  // Equipment indicators
  if (desc.includes('air handling') || desc.includes('ahu')) return 'equipment';
  if (desc.includes('fan') || desc.includes('unit')) return 'equipment';
  if (desc.includes('boiler') || desc.includes('chiller')) return 'equipment';

  // System-specific defaults
  if (system === 'mechanical') return 'duct';
  if (system === 'electrical') return 'conduit';
  if (system === 'plumbing' || system === 'fire_protection') return 'pipe';

  return 'equipment';
}

/**
 * Extract surrounding context for a match
 */
function extractContext(content: string, match: string, contextLength: number = 50): string {
  const index = content.indexOf(match);
  if (index === -1) return match;

  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + match.length + contextLength);
  return content.substring(start, end).trim();
}

/**
 * Try to extract grid coordinate near a match in content
 */
function extractGridNearMatch(content: string, match: string): GridCoordinate | undefined {
  const context = extractContext(content, match, 100);

  // Look for patterns like "at grid A1", "at A2", "grid B3", etc.
  const gridMatch = context.match(/(?:at\s+(?:grid\s+)?|grid\s+)([A-Z]\d+)/i);
  if (gridMatch) {
    const coord = parseGridCoordinate(gridMatch[1]);
    return coord || undefined;
  }

  return undefined;
}

// ============================================================================
// PATH TRACING
// ============================================================================

/**
 * Trace a path between two MEP elements
 */
export async function tracePath(
  projectSlug: string,
  system: MEPSystem,
  startTag: string,
  endTag: string
): Promise<MEPPath | null> {
  try {
    const elements = await extractMEPElements(projectSlug, system);

    const startElement = elements.find(e => e.tag === startTag);
    const endElement = elements.find(e => e.tag === endTag);

    if (!startElement || !endElement) {
      return null;
    }

    // Build connectivity graph
    await buildConnections(elements);

    // Use BFS to find path
    const path = findShortestPath(elements, startElement, endElement);

    if (!path) {
      return null;
    }

    // Extract unique floors
    const floors = Array.from(new Set(path.map(e => e.location.floor)));

    // Identify risers
    const risers = path.filter(e => e.type === 'riser');

    // Calculate path length
    const pathLength = calculatePathLength(path);

    // Detect clashes along the path
    const clashes = await detectClashesAlongPath(projectSlug, path);

    return {
      id: `path-${startTag}-${endTag}`,
      system,
      startPoint: startElement,
      endPoint: endElement,
      intermediatePoints: path.slice(1, -1),
      pathLength,
      floors,
      risers,
      clashes,
      confidence: 0.8
    };
  } catch (error) {
    logger.error('MEP_PATH_TRACER', 'Error tracing path', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Build connections between MEP elements based on proximity and system logic
 */
async function buildConnections(elements: MEPElement[]): Promise<void> {
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const elem1 = elements[i];
      const elem2 = elements[j];

      // Only connect elements of the same system
      if (elem1.system !== elem2.system) continue;

      // Check if on same floor or if one is a riser
      const sameFloor = elem1.location.floor === elem2.location.floor;
      const hasRiser = elem1.type === 'riser' || elem2.type === 'riser';

      if (!sameFloor && !hasRiser) continue;

      let shouldConnect = false;

      // Check proximity if both have grid locations
      if (elem1.location.grid && elem2.location.grid) {
        const distance = calculateGridDistance(elem1.location.grid, elem2.location.grid);
        if (distance <= 5) { // Within 5 grid spaces
          shouldConnect = true;
        }
      } else if (sameFloor) {
        // If on same floor but no grid coordinates, check context for connection indicators
        const context1 = elem1.location.description.toLowerCase();
        const context2 = elem2.location.description.toLowerCase();

        // Check if contexts mention connection keywords
        const hasConnectionKeywords =
          (context1.includes('connect') || context1.includes('serves') ||
           context1.includes('to') || context1.includes('from') ||
           context1.includes(' and ')) ||
          (context2.includes('connect') || context2.includes('serves') ||
           context2.includes('to') || context2.includes('from') ||
           context2.includes(' and '));

        // Don't connect if explicitly marked as isolated
        const isIsolated =
          context1.includes('isolated') || context2.includes('isolated');

        if (hasConnectionKeywords && !isIsolated) {
          shouldConnect = true;
        }
      }

      if (shouldConnect) {
        elem1.connections.push(elem2.id);
        elem2.connections.push(elem1.id);
      }
    }
  }
}

/**
 * Find shortest path using BFS
 */
function findShortestPath(
  elements: MEPElement[],
  start: MEPElement,
  end: MEPElement
): MEPElement[] | null {
  const elementMap = new Map(elements.map(e => [e.id, e]));
  const visited = new Set<string>();
  const queue: Array<{ element: MEPElement; path: MEPElement[] }> = [
    { element: start, path: [start] }
  ];

  while (queue.length > 0) {
    const { element, path } = queue.shift()!;

    if (element.id === end.id) {
      return path;
    }

    if (visited.has(element.id)) continue;
    visited.add(element.id);

    for (const connId of element.connections) {
      const connElement = elementMap.get(connId);
      if (connElement && !visited.has(connId)) {
        queue.push({
          element: connElement,
          path: [...path, connElement]
        });
      }
    }
  }

  return null;
}

/**
 * Calculate total path length
 */
function calculatePathLength(path: MEPElement[]): number {
  let length = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const elem1 = path[i];
    const elem2 = path[i + 1];

    if (elem1.location.grid && elem2.location.grid) {
      const distance = calculateGridDistance(elem1.location.grid, elem2.location.grid);
      length += distance * 20; // Assume 20 feet per grid space
    } else {
      length += 10; // Default segment length
    }
  }

  return length;
}

// ============================================================================
// CLASH DETECTION
// ============================================================================

/**
 * Detect clashes along a specific path
 */
async function detectClashesAlongPath(
  projectSlug: string,
  path: MEPElement[]
): Promise<ClashDetection[]> {
  const allElements = await extractMEPElements(projectSlug);
  const clashes: ClashDetection[] = [];
  let clashIdCounter = 1;

  for (const pathElement of path) {
    // Check against all other elements on the same floor
    const sameFloorElements = allElements.filter(e => 
      e.location.floor === pathElement.location.floor &&
      e.system !== pathElement.system && // Different system
      e.id !== pathElement.id
    );

    for (const other of sameFloorElements) {
      if (pathElement.location.grid && other.location.grid) {
        const distance = calculateGridDistance(pathElement.location.grid, other.location.grid);

        // Check for clashes based on distance and element types
        if (distance < 1) {
          const clearanceRequired = getRequiredClearance(pathElement, other);
          const actualDistance = distance * 12; // Convert to inches

          if (actualDistance < clearanceRequired) {
            clashes.push({
              id: `clash-${clashIdCounter++}`,
              type: actualDistance === 0 ? 'hard_clash' : 'clearance_clash',
              severity: actualDistance === 0 ? 'critical' : 
                        actualDistance < clearanceRequired * 0.5 ? 'major' : 'minor',
              element1: pathElement,
              element2: other,
              location: {
                floor: pathElement.location.floor,
                grid: pathElement.location.grid,
                description: `${pathElement.system} ${pathElement.type} conflicts with ${other.system} ${other.type}`
              },
              distance: actualDistance,
              clearanceRequired,
              resolution: suggestClashResolution(pathElement, other, actualDistance, clearanceRequired)
            });
          }
        }
      }
    }
  }

  return clashes;
}

/**
 * Get required clearance between two elements
 */
function getRequiredClearance(elem1: MEPElement, elem2: MEPElement): number {
  // Default clearances in inches
  const clearances: Record<string, number> = {
    'duct-pipe': 4,
    'duct-conduit': 6,
    'duct-duct': 2,
    'pipe-pipe': 2,
    'pipe-conduit': 3,
    'conduit-conduit': 1,
    'equipment-equipment': 24,
    'equipment-default': 12,
    'default': 6
  };

  const key1 = `${elem1.type}-${elem2.type}`;
  const key2 = `${elem2.type}-${elem1.type}`;

  return clearances[key1] || clearances[key2] || clearances['default'];
}

/**
 * Suggest resolution for a clash
 */
function suggestClashResolution(
  elem1: MEPElement,
  elem2: MEPElement,
  actualDistance: number,
  requiredClearance: number
): string {
  const deficit = requiredClearance - actualDistance;

  const suggestions = [
    `Increase vertical separation by ${Math.ceil(deficit)}"`,
    `Reroute ${elem1.system} ${elem1.type} around ${elem2.system} ${elem2.type}`,
    `Adjust ${elem2.system} ${elem2.type} elevation by ${Math.ceil(deficit)}"`,
    `Review conflict in coordination meeting`
  ];

  return suggestions[Math.min(2, Math.floor(deficit / 6))];
}

/**
 * Detect all clashes in a project
 */
export async function detectAllClashes(
  projectSlug: string,
  systems?: MEPSystem[]
): Promise<ClashDetection[]> {
  try {
    const allElements = await extractMEPElements(projectSlug);
    const filteredElements = systems && systems.length > 0
      ? allElements.filter(e => systems.includes(e.system))
      : allElements;

    const clashes: ClashDetection[] = [];
    let clashIdCounter = 1;

    // Compare all elements pairwise
    for (let i = 0; i < filteredElements.length; i++) {
      for (let j = i + 1; j < filteredElements.length; j++) {
        const elem1 = filteredElements[i];
        const elem2 = filteredElements[j];

        // Only check elements on the same floor
        if (elem1.location.floor !== elem2.location.floor) continue;

        // Only check elements from different systems
        if (elem1.system === elem2.system) continue;

        if (elem1.location.grid && elem2.location.grid) {
          const distance = calculateGridDistance(elem1.location.grid, elem2.location.grid);

          if (distance < 1) {
            const clearanceRequired = getRequiredClearance(elem1, elem2);
            const actualDistance = distance * 12;

            if (actualDistance < clearanceRequired) {
              clashes.push({
                id: `clash-${clashIdCounter++}`,
                type: actualDistance === 0 ? 'hard_clash' : 'clearance_clash',
                severity: actualDistance === 0 ? 'critical' : 
                          actualDistance < clearanceRequired * 0.5 ? 'major' : 'minor',
                element1: elem1,
                element2: elem2,
                location: {
                  floor: elem1.location.floor,
                  grid: elem1.location.grid,
                  description: `${elem1.system} ${elem1.type} conflicts with ${elem2.system} ${elem2.type}`
                },
                distance: actualDistance,
                clearanceRequired,
                resolution: suggestClashResolution(elem1, elem2, actualDistance, clearanceRequired)
              });
            }
          }
        }
      }
    }

    return clashes;
  } catch (error) {
    logger.error('MEP_PATH_TRACER', 'Error detecting clashes', error instanceof Error ? error : undefined);
    return [];
  }
}

// ============================================================================
// VERTICAL RISER DETECTION
// ============================================================================

/**
 * Identify vertical risers across multiple floors
 */
export async function identifyVerticalRisers(
  projectSlug: string,
  system: MEPSystem
): Promise<VerticalRiser[]> {
  try {
    const elements = await extractMEPElements(projectSlug, system);
    const riserElements = elements.filter(e => e.type === 'riser');

    // Group risers by tag (same riser on different floors)
    const riserGroups = new Map<string, MEPElement[]>();

    for (const riser of riserElements) {
      if (riser.tag) {
        const existing = riserGroups.get(riser.tag) || [];
        existing.push(riser);
        riserGroups.set(riser.tag, existing);
      }
    }

    const verticalRisers: VerticalRiser[] = [];

    for (const [tag, risers] of riserGroups) {
      const floors = Array.from(new Set(risers.map(r => r.location.floor))).sort();
      const locations = risers
        .filter(r => r.location.grid)
        .map(r => ({
          floor: r.location.floor,
          grid: r.location.grid!,
          elevation: r.elevation || 0
        }));

      if (floors.length > 1) {
        verticalRisers.push({
          id: `riser-${tag}`,
          system,
          tag,
          floors,
          locations,
          size: risers[0].size || 'Unknown',
          connectedElements: risers.flatMap(r => r.connections)
        });
      }
    }

    return verticalRisers;
  } catch (error) {
    logger.error('MEP_PATH_TRACER', 'Error identifying vertical risers', error instanceof Error ? error : undefined);
    return [];
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const mepPathTracer = {
  extractMEPElements,
  tracePath,
  detectAllClashes,
  identifyVerticalRisers
};
