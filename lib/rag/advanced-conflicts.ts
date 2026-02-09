/**
 * Advanced Conflict Detection Module (Phase 3C)
 *
 * Multi-discipline conflict detection for MEP systems including
 * spatial clashes, clearance violations, and load conflicts.
 *
 * Extracted from lib/rag-enhancements.ts
 */

import { reconstructSystemTopology } from './system-topology';
import type { AdvancedConflict } from './types';

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
