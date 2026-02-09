/**
 * Isometric View Interpretation Module (Phase 3C)
 *
 * Interprets 3D isometric views from construction documents,
 * extracts elements, builds spatial hierarchies, and determines
 * spatial relationships (above/below/adjacent).
 *
 * Extracted from lib/rag-enhancements.ts
 */

import type { EnhancedChunk, IsometricElement, IsometricView } from './types';

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
    viewName: (metadata.sheet_number as string) || 'Unknown',
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
