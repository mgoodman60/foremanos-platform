/**
 * Enhanced Diagram Understanding
 *
 * Extracted from lib/rag-enhancements.ts — improved interpretation of
 * one-lines, risers, and flow diagrams.
 */

import type {
  DiagramElement,
  DiagramAnalysis,
  EnhancedChunk,
} from './types';

/**
 * Analyze a diagram chunk and extract structured elements
 */
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
    if (line.includes('\u2192') || line.includes('->') || line.includes('to')) {
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
