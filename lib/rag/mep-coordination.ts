/**
 * MEP Coordination Conflict Detection
 *
 * Extracted from lib/rag-enhancements.ts — detects potential clashes and
 * coordination issues between MEP systems.
 */

import type {
  CoordinationConflict,
  EnhancedChunk,
} from './types';

/**
 * Detect MEP coordination conflicts from document chunks
 */
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
