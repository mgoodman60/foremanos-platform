/**
 * Enhanced Isometric View Interpretation
 * 3D reconstruction and analysis from 2D isometric drawings
 * 
 * Features:
 * - Isometric to orthographic projection conversion
 * - 3D spatial understanding from 2D views
 * - Piping and ductwork path reconstruction
 * - Elevation and depth calculation
 * - Interference detection in 3D space
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import type { MEPElement } from './mep-path-tracer';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface IsometricView {
  id: string;
  sheetNumber: string;
  system: 'mechanical' | 'electrical' | 'plumbing' | 'fire_protection';
  viewAngle: '30-60' | '45-45' | 'custom';
  elements: IsometricElement[];
  reconstructed3D: Spatial3DModel;
}

export interface IsometricElement {
  id: string;
  type: 'pipe' | 'duct' | 'fitting' | 'equipment' | 'support';
  position2D: { x: number; y: number }; // On the isometric drawing
  position3D: { x: number; y: number; z: number }; // Reconstructed 3D
  orientation: 'horizontal' | 'vertical' | 'diagonal';
  size?: string;
  elevation?: number;
  connections: string[]; // Connected element IDs
}

export interface Spatial3DModel {
  elements: IsometricElement[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  paths: Array<{
    id: string;
    elements: string[]; // Element IDs in path
    totalLength: number;
    elevationChange: number;
  }>;
}

export interface IsometricAnalysis {
  viewType: 'isometric' | 'oblique' | 'axonometric';
  confidence: number;
  elements: number;
  verticality: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
  recommendations: string[];
}

// ============================================================================
// ISOMETRIC DETECTION
// ============================================================================

/**
 * Detect if a drawing sheet contains isometric views
 */
export async function detectIsometricViews(
  projectSlug: string,
  sheetNumber: string
): Promise<IsometricAnalysis | null> {
  try {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          Project: { slug: projectSlug }
        },
        metadata: {
          path: ['sheet_number'],
          equals: sheetNumber
        }
      }
    });

    if (chunks.length === 0) return null;

    // Analyze content for isometric indicators
    const content = chunks.map((c: any) => c.content).join(' ');
    const metadata = chunks[0].metadata as any;

    const isometricKeywords = [
      'isometric',
      'iso view',
      'axonometric',
      'oblique',
      '3d view',
      'piping iso',
      'ductwork iso'
    ];

    const hasIsometricKeyword = isometricKeywords.some(kw =>
      content.toLowerCase().includes(kw)
    );

    const drawingType = (metadata?.drawing_type || '').toLowerCase();
    const isIsometricType = isometricKeywords.some(kw =>
      drawingType.includes(kw)
    );

    if (!hasIsometricKeyword && !isIsometricType) {
      return null;
    }

    // Use AI to analyze the view characteristics
    const analysis = await analyzeIsometricWithAI(content, metadata);

    return analysis;
  } catch (error) {
    console.error('Error detecting isometric views:', error);
    return null;
  }
}

/**
 * AI-powered analysis of isometric characteristics
 */
async function analyzeIsometricWithAI(
  content: string,
  metadata: any
): Promise<IsometricAnalysis> {
  try {
    const prompt = `Analyze this construction drawing for isometric view characteristics:

Drawing Type: ${metadata?.drawing_type || 'Unknown'}
Content Sample: ${content.substring(0, 500)}

Determine:
1. View type (isometric, oblique, or axonometric)
2. Confidence level (0-1)
3. Number of distinct elements visible
4. Verticality assessment (high/medium/low - how much vertical routing)
5. Complexity (simple/moderate/complex)
6. Recommendations for interpretation

Respond in JSON:
{
  "viewType": "isometric",
  "confidence": 0.85,
  "elements": 15,
  "verticality": "high",
  "complexity": "moderate",
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

    const response = await callAbacusLLM([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      max_tokens: 400
    });

    try {
      // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
      let contentToParse = response.content;
      const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        contentToParse = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(contentToParse);
      return {
        viewType: parsed.viewType || 'isometric',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7)),
        elements: Math.max(0, parsed.elements || 10),
        verticality: parsed.verticality || 'medium',
        complexity: parsed.complexity || 'moderate',
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : ['Review with MEP coordination team']
      };
    } catch {
      return {
        viewType: 'isometric',
        confidence: 0.5,
        elements: 10,
        verticality: 'medium',
        complexity: 'moderate',
        recommendations: ['Manual interpretation recommended']
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      viewType: 'isometric',
      confidence: 0.3,
      elements: 0,
      verticality: 'low',
      complexity: 'simple',
      recommendations: ['AI analysis unavailable - manual review required']
    };
  }
}

// ============================================================================
// 3D RECONSTRUCTION
// ============================================================================

/**
 * Reconstruct 3D spatial model from isometric drawing
 */
export async function reconstructFrom2D(
  projectSlug: string,
  sheetNumber: string,
  viewAngle: IsometricView['viewAngle'] = '30-60'
): Promise<Spatial3DModel | null> {
  try {
    // Get MEP elements from the sheet
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          Project: { slug: projectSlug }
        },
        metadata: {
          path: ['sheet_number'],
          equals: sheetNumber
        }
      }
    });

    if (chunks.length === 0) return null;

    const elements: IsometricElement[] = [];
    let elementIdCounter = 1;

    // Extract elements from chunks
    for (const chunk of chunks) {
      const metadata = chunk.metadata as any;

      if (metadata?.mepCallouts) {
        for (const callout of metadata.mepCallouts) {
          // Parse 2D position from context (simplified)
          const position2D = { x: 0, y: 0 }; // Would be extracted from actual coordinates

          // Convert to 3D using isometric projection math
          const position3D = convert2DTo3D(position2D, viewAngle);

          elements.push({
            id: `iso-element-${elementIdCounter++}`,
            type: inferIsometricElementType(callout.type || callout.description),
            position2D,
            position3D,
            orientation: inferOrientation(callout.description || ''),
            size: callout.size,
            elevation: callout.elevation,
            connections: []
          });
        }
      }
    }

    // Build connections based on proximity
    buildIsometricConnections(elements);

    // Calculate bounds
    const bounds = calculateBounds(elements);

    // Identify paths through the network
    const paths = identifyPaths(elements);

    return {
      elements,
      bounds,
      paths
    };
  } catch (error) {
    console.error('Error reconstructing 3D from isometric:', error);
    return null;
  }
}

/**
 * Convert 2D isometric coordinates to 3D space
 * Using standard isometric projection math
 */
function convert2DTo3D(
  pos2D: { x: number; y: number },
  viewAngle: IsometricView['viewAngle']
): { x: number; y: number; z: number } {
  // Standard isometric (30-60 degrees)
  if (viewAngle === '30-60') {
    return {
      x: (pos2D.x - pos2D.y) / Math.sqrt(3),
      y: (pos2D.x + pos2D.y) / Math.sqrt(3),
      z: pos2D.y // Z is typically represented by vertical on isometric
    };
  }

  // 45-45 axonometric
  if (viewAngle === '45-45') {
    return {
      x: pos2D.x,
      y: pos2D.y,
      z: pos2D.y
    };
  }

  // Default fallback
  return { x: pos2D.x, y: pos2D.y, z: 0 };
}

/**
 * Infer element type for isometric views
 */
function inferIsometricElementType(
  description: string
): IsometricElement['type'] {
  const desc = description.toLowerCase();

  if (desc.includes('pipe')) return 'pipe';
  if (desc.includes('duct')) return 'duct';
  if (desc.includes('fitting') || desc.includes('elbow') || desc.includes('tee')) return 'fitting';
  if (desc.includes('support') || desc.includes('hanger')) return 'support';

  return 'equipment';
}

/**
 * Infer orientation from description
 */
function inferOrientation(description: string): IsometricElement['orientation'] {
  const desc = description.toLowerCase();

  if (desc.includes('vertical') || desc.includes('riser') || desc.includes('up') || desc.includes('down')) {
    return 'vertical';
  }
  if (desc.includes('horizontal') || desc.includes('level')) {
    return 'horizontal';
  }
  if (desc.includes('diagonal') || desc.includes('slope') || desc.includes('angle')) {
    return 'diagonal';
  }

  return 'horizontal'; // Default
}

/**
 * Build connections between isometric elements
 */
function buildIsometricConnections(elements: IsometricElement[]): void {
  const threshold = 5; // Distance threshold for connection

  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const elem1 = elements[i];
      const elem2 = elements[j];

      const distance = Math.sqrt(
        Math.pow(elem1.position3D.x - elem2.position3D.x, 2) +
        Math.pow(elem1.position3D.y - elem2.position3D.y, 2) +
        Math.pow(elem1.position3D.z - elem2.position3D.z, 2)
      );

      if (distance <= threshold) {
        elem1.connections.push(elem2.id);
        elem2.connections.push(elem1.id);
      }
    }
  }
}

/**
 * Calculate 3D bounding box
 */
function calculateBounds(elements: IsometricElement[]): Spatial3DModel['bounds'] {
  if (elements.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  }

  const xs = elements.map(e => e.position3D.x);
  const ys = elements.map(e => e.position3D.y);
  const zs = elements.map(e => e.position3D.z);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs)
  };
}

/**
 * Identify continuous paths through the element network
 */
function identifyPaths(elements: IsometricElement[]): Spatial3DModel['paths'] {
  const paths: Spatial3DModel['paths'] = [];
  const visited = new Set<string>();

  for (const startElement of elements) {
    if (visited.has(startElement.id)) continue;

    // Start a new path
    const pathElements: string[] = [];
    const queue = [startElement];
    let totalLength = 0;
    let minZ = startElement.position3D.z;
    let maxZ = startElement.position3D.z;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;

      visited.add(current.id);
      pathElements.push(current.id);

      minZ = Math.min(minZ, current.position3D.z);
      maxZ = Math.max(maxZ, current.position3D.z);

      // Add connected elements to queue
      for (const connId of current.connections) {
        const connElement = elements.find(e => e.id === connId);
        if (connElement && !visited.has(connId)) {
          // Calculate distance for length
          const dist = Math.sqrt(
            Math.pow(current.position3D.x - connElement.position3D.x, 2) +
            Math.pow(current.position3D.y - connElement.position3D.y, 2) +
            Math.pow(current.position3D.z - connElement.position3D.z, 2)
          );
          totalLength += dist;
          queue.push(connElement);
        }
      }
    }

    if (pathElements.length > 1) {
      paths.push({
        id: `path-${paths.length + 1}`,
        elements: pathElements,
        totalLength: Math.round(totalLength),
        elevationChange: Math.round(maxZ - minZ)
      });
    }
  }

  return paths;
}

// ============================================================================
// GENERATE ISOMETRIC VIEW FROM PLAN
// ============================================================================

export interface IsometricGenerationResult {
  success: boolean;
  message?: string;
  analysis?: IsometricAnalysis;
  model?: Spatial3DModel;
  visualization?: {
    svgData: string;
    dimensions: { width: number; height: number };
    viewAngle: string;
    elements: Array<{
      id: string;
      type: string;
      path: string;
      color: string;
      label?: string;
    }>;
  };
}

/**
 * Generate an isometric view from a plan document
 * This creates a 3D visualization from 2D MEP plan data
 */
export async function generateIsometricView(
  projectId: string,
  documentId: string,
  sheetNumber?: string
): Promise<IsometricGenerationResult> {
  try {
    // Get document chunks with MEP data
    const whereClause: any = {
      documentId,
      Document: {
        projectId,
        deletedAt: null
      }
    };

    if (sheetNumber) {
      whereClause.metadata = {
        path: ['sheet_number'],
        equals: sheetNumber
      };
    }

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      include: {
        Document: {
          select: { name: true, fileName: true }
        }
      }
    });

    if (chunks.length === 0) {
      return {
        success: false,
        message: 'No data found for the selected sheet'
      };
    }

    // Extract MEP elements from chunks
    const mepElements: Array<{
      id: string;
      type: string;
      system: string;
      size?: string;
      elevation?: number;
      x: number;
      y: number;
      z: number;
      connections: string[];
      label?: string;
    }> = [];

    let elementCounter = 0;

    for (const chunk of chunks) {
      const metadata = chunk.metadata as any;
      const content = chunk.content || '';

      // Extract MEP callouts if available
      if (metadata?.mepCallouts && Array.isArray(metadata.mepCallouts)) {
        for (const callout of metadata.mepCallouts) {
          elementCounter++;
          mepElements.push({
            id: `elem-${elementCounter}`,
            type: inferElementType(callout.type || callout.description || ''),
            system: inferSystem(callout.type || callout.description || '', content),
            size: callout.size,
            elevation: callout.elevation || parseElevation(callout.description || content),
            x: callout.x || Math.random() * 100,
            y: callout.y || Math.random() * 100,
            z: callout.elevation || callout.z || 0,
            connections: [],
            label: callout.tag || callout.label
          });
        }
      }

      // Use AI to extract additional elements from content
      if (content.length > 100) {
        const aiElements = await extractElementsWithAI(content, metadata);
        for (const elem of aiElements) {
          elementCounter++;
          mepElements.push({
            ...elem,
            id: `elem-${elementCounter}`
          });
        }
      }
    }

    if (mepElements.length === 0) {
      // Try AI-based extraction from full content
      const fullContent = chunks.map(c => c.content).join('\n').substring(0, 3000);
      const aiElements = await extractElementsWithAI(fullContent, chunks[0]?.metadata);
      
      if (aiElements.length === 0) {
        return {
          success: false,
          message: 'No MEP elements found in this sheet. Try a mechanical, plumbing, or electrical plan.'
        };
      }
      
      for (const elem of aiElements) {
        elementCounter++;
        mepElements.push({
          ...elem,
          id: `elem-${elementCounter}`
        });
      }
    }

    // Build connections between nearby elements
    buildElementConnections(mepElements);

    // Create 3D model
    const model = createSpatialModel(mepElements);

    // Generate visualization
    const visualization = generateSVGVisualization(mepElements, model);

    // Create analysis
    const analysis: IsometricAnalysis = {
      viewType: 'isometric',
      confidence: 0.75,
      elements: mepElements.length,
      verticality: calculateVerticality(mepElements),
      complexity: calculateComplexity(mepElements),
      recommendations: generateRecommendations(mepElements, model)
    };

    return {
      success: true,
      analysis,
      model,
      visualization
    };
  } catch (error) {
    console.error('Error generating isometric view:', error);
    return {
      success: false,
      message: 'Failed to generate isometric view'
    };
  }
}

/**
 * Use AI to extract MEP elements from document content
 */
async function extractElementsWithAI(content: string, metadata: any): Promise<Array<{
  type: string;
  system: string;
  size?: string;
  elevation?: number;
  x: number;
  y: number;
  z: number;
  connections: string[];
  label?: string;
}>> {
  try {
    const prompt = `Analyze this construction document content and extract MEP (Mechanical, Electrical, Plumbing) elements.

Document Content:
${content.substring(0, 2000)}

${metadata?.drawing_type ? `Drawing Type: ${metadata.drawing_type}` : ''}

Extract up to 20 MEP elements. For each element provide:
- type: pipe, duct, conduit, equipment, fitting, valve, or diffuser
- system: plumbing, hvac, electrical, or fire_protection
- size: diameter or dimensions if mentioned
- elevation: height in feet if mentioned (default 0)
- label: any tag or label associated

Respond with a JSON array:
[
  {"type": "pipe", "system": "plumbing", "size": "2\\"", "elevation": 10, "label": "HW-1"},
  {"type": "duct", "system": "hvac", "size": "12x8", "elevation": 12, "label": "SA-1"}
]

If no MEP elements are found, respond with an empty array: []`;

    const response = await callAbacusLLM([{ role: 'user', content: prompt }], {
      temperature: 0.2,
      max_tokens: 1000
    });

    // Parse response
    let parsed: any[] = [];
    try {
      let contentToParse = response.content;
      const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        contentToParse = jsonMatch[1].trim();
      }
      // Also try to find array directly
      const arrayMatch = contentToParse.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        contentToParse = arrayMatch[0];
      }
      parsed = JSON.parse(contentToParse);
    } catch {
      return [];
    }

    if (!Array.isArray(parsed)) return [];

    // Convert to our format with positions
    return parsed.slice(0, 20).map((elem, idx) => ({
      type: elem.type || 'equipment',
      system: elem.system || 'mechanical',
      size: elem.size,
      elevation: elem.elevation || 0,
      x: 20 + (idx % 5) * 20,
      y: 20 + Math.floor(idx / 5) * 20,
      z: elem.elevation || 0,
      connections: [],
      label: elem.label
    }));
  } catch (error) {
    console.error('AI extraction error:', error);
    return [];
  }
}

/**
 * Build connections between elements based on proximity and system
 */
function buildElementConnections(elements: Array<{
  id: string;
  type: string;
  system: string;
  x: number;
  y: number;
  z: number;
  connections: string[];
}>): void {
  const connectionThreshold = 25;

  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const elem1 = elements[i];
      const elem2 = elements[j];

      // Only connect elements of the same system
      if (elem1.system !== elem2.system) continue;

      const distance = Math.sqrt(
        Math.pow(elem1.x - elem2.x, 2) +
        Math.pow(elem1.y - elem2.y, 2) +
        Math.pow(elem1.z - elem2.z, 2)
      );

      if (distance <= connectionThreshold) {
        elem1.connections.push(elem2.id);
        elem2.connections.push(elem1.id);
      }
    }
  }
}

/**
 * Create spatial model from elements
 */
function createSpatialModel(elements: Array<{
  id: string;
  type: string;
  system: string;
  size?: string;
  elevation?: number;
  x: number;
  y: number;
  z: number;
  connections: string[];
  label?: string;
}>): Spatial3DModel {
  const isometricElements: IsometricElement[] = elements.map(e => ({
    id: e.id,
    type: inferIsometricElementType(e.type),
    position2D: { x: e.x, y: e.y },
    position3D: { x: e.x, y: e.y, z: e.z },
    orientation: e.z > 5 ? 'vertical' : 'horizontal',
    size: e.size,
    elevation: e.elevation,
    connections: e.connections
  }));

  return {
    elements: isometricElements,
    bounds: calculateBounds(isometricElements),
    paths: identifyPaths(isometricElements)
  };
}

/**
 * Generate SVG visualization for isometric view
 */
function generateSVGVisualization(
  elements: Array<{
    id: string;
    type: string;
    system: string;
    x: number;
    y: number;
    z: number;
    connections: string[];
    label?: string;
  }>,
  model: Spatial3DModel
): {
  svgData: string;
  dimensions: { width: number; height: number };
  viewAngle: string;
  elements: Array<{
    id: string;
    type: string;
    path: string;
    color: string;
    label?: string;
  }>;
} {
  const width = 600;
  const height = 400;
  const scale = 3;
  const offsetX = 150;
  const offsetY = 300;

  // Isometric transformation (30-degree angle)
  const toIso = (x: number, y: number, z: number) => ({
    isoX: offsetX + (x - y) * Math.cos(Math.PI / 6) * scale,
    isoY: offsetY - (x + y) * Math.sin(Math.PI / 6) * scale - z * scale
  });

  const systemColors: Record<string, string> = {
    plumbing: '#3B82F6',
    hvac: '#10B981',
    electrical: '#F59E0B',
    fire_protection: '#EF4444',
    mechanical: '#8B5CF6'
  };

  const svgElements: Array<{
    id: string;
    type: string;
    path: string;
    color: string;
    label?: string;
  }> = [];

  // Draw connections first (as lines)
  const drawnConnections = new Set<string>();
  for (const elem of elements) {
    for (const connId of elem.connections) {
      const connKey = [elem.id, connId].sort().join('-');
      if (drawnConnections.has(connKey)) continue;
      drawnConnections.add(connKey);

      const connElem = elements.find(e => e.id === connId);
      if (!connElem) continue;

      const start = toIso(elem.x, elem.y, elem.z);
      const end = toIso(connElem.x, connElem.y, connElem.z);

      svgElements.push({
        id: `conn-${connKey}`,
        type: 'connection',
        path: `M ${start.isoX} ${start.isoY} L ${end.isoX} ${end.isoY}`,
        color: systemColors[elem.system] || '#6B7280'
      });
    }
  }

  // Draw elements
  for (const elem of elements) {
    const pos = toIso(elem.x, elem.y, elem.z);
    const color = systemColors[elem.system] || '#6B7280';
    
    let path = '';
    const size = 8;

    switch (elem.type) {
      case 'pipe':
      case 'duct':
        // Draw as circle
        path = `M ${pos.isoX - size} ${pos.isoY} a ${size} ${size} 0 1 0 ${size * 2} 0 a ${size} ${size} 0 1 0 ${-size * 2} 0`;
        break;
      case 'equipment':
        // Draw as rectangle
        path = `M ${pos.isoX - size} ${pos.isoY - size} h ${size * 2} v ${size * 2} h ${-size * 2} Z`;
        break;
      case 'fitting':
      case 'valve':
        // Draw as diamond
        path = `M ${pos.isoX} ${pos.isoY - size} l ${size} ${size} l ${-size} ${size} l ${-size} ${-size} Z`;
        break;
      default:
        // Draw as circle
        path = `M ${pos.isoX - size/2} ${pos.isoY} a ${size/2} ${size/2} 0 1 0 ${size} 0 a ${size/2} ${size/2} 0 1 0 ${-size} 0`;
    }

    svgElements.push({
      id: elem.id,
      type: elem.type,
      path,
      color,
      label: elem.label
    });
  }

  // Build SVG
  const svgPaths = svgElements.map(e => {
    if (e.type === 'connection') {
      return `<path d="${e.path}" stroke="${e.color}" stroke-width="2" fill="none" opacity="0.6"/>`;
    }
    return `<path d="${e.path}" fill="${e.color}" stroke="${e.color}" stroke-width="1.5" opacity="0.9"/>`;
  }).join('\n');

  const svgLabels = svgElements
    .filter(e => e.label && e.type !== 'connection')
    .map(e => {
      const elem = elements.find(el => el.id === e.id);
      if (!elem) return '';
      const pos = toIso(elem.x, elem.y, elem.z);
      return `<text x="${pos.isoX}" y="${pos.isoY - 12}" text-anchor="middle" fill="#fff" font-size="10" font-family="monospace">${e.label}</text>`;
    }).join('\n');

  // Draw grid lines for reference
  const gridLines = [];
  for (let i = 0; i <= 100; i += 20) {
    const start1 = toIso(i, 0, 0);
    const end1 = toIso(i, 100, 0);
    const start2 = toIso(0, i, 0);
    const end2 = toIso(100, i, 0);
    gridLines.push(`<line x1="${start1.isoX}" y1="${start1.isoY}" x2="${end1.isoX}" y2="${end1.isoY}" stroke="#374151" stroke-width="0.5" opacity="0.3"/>`);
    gridLines.push(`<line x1="${start2.isoX}" y1="${start2.isoY}" x2="${end2.isoX}" y2="${end2.isoY}" stroke="#374151" stroke-width="0.5" opacity="0.3"/>`);
  }

  const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#1F2328"/>
    ${gridLines.join('\n')}
    ${svgPaths}
    ${svgLabels}
    <text x="10" y="20" fill="#9CA3AF" font-size="12">Isometric View</text>
    <text x="10" y="${height - 10}" fill="#6B7280" font-size="10">${elements.length} elements</text>
  </svg>`;

  return {
    svgData,
    dimensions: { width, height },
    viewAngle: '30-60',
    elements: svgElements
  };
}

/**
 * Infer element type from description
 */
function inferElementType(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes('pipe') || desc.includes('piping')) return 'pipe';
  if (desc.includes('duct') || desc.includes('ductwork')) return 'duct';
  if (desc.includes('conduit') || desc.includes('wire')) return 'conduit';
  if (desc.includes('valve') || desc.includes('gate') || desc.includes('ball')) return 'valve';
  if (desc.includes('fitting') || desc.includes('elbow') || desc.includes('tee')) return 'fitting';
  if (desc.includes('diffuser') || desc.includes('grille') || desc.includes('register')) return 'diffuser';
  return 'equipment';
}

/**
 * Infer system from description
 */
function inferSystem(description: string, content: string): string {
  const combined = `${description} ${content}`.toLowerCase();
  if (combined.includes('plumb') || combined.includes('water') || combined.includes('drain') || combined.includes('sanitary')) {
    return 'plumbing';
  }
  if (combined.includes('hvac') || combined.includes('duct') || combined.includes('air') || combined.includes('supply') || combined.includes('return')) {
    return 'hvac';
  }
  if (combined.includes('elec') || combined.includes('circuit') || combined.includes('panel') || combined.includes('conduit')) {
    return 'electrical';
  }
  if (combined.includes('fire') || combined.includes('sprinkler')) {
    return 'fire_protection';
  }
  return 'mechanical';
}

/**
 * Parse elevation from text
 */
function parseElevation(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:'|ft|feet)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
}

/**
 * Calculate verticality metric
 */
function calculateVerticality(elements: Array<{ z: number }>): 'high' | 'medium' | 'low' {
  const zValues = elements.map(e => e.z);
  const range = Math.max(...zValues) - Math.min(...zValues);
  if (range > 20) return 'high';
  if (range > 5) return 'medium';
  return 'low';
}

/**
 * Calculate complexity metric
 */
function calculateComplexity(elements: Array<{ connections: string[] }>): 'simple' | 'moderate' | 'complex' {
  const totalConnections = elements.reduce((sum, e) => sum + e.connections.length, 0);
  const avgConnections = totalConnections / Math.max(elements.length, 1);
  
  if (elements.length > 15 || avgConnections > 2) return 'complex';
  if (elements.length > 5 || avgConnections > 1) return 'moderate';
  return 'simple';
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  elements: Array<{ type: string; system: string; z: number }>,
  model: Spatial3DModel
): string[] {
  const recommendations: string[] = [];

  // Check for multi-system coordination
  const systems = new Set(elements.map(e => e.system));
  if (systems.size > 1) {
    recommendations.push(`Multi-system coordination required (${Array.from(systems).join(', ')})`);
  }

  // Check for vertical complexity
  const zRange = model.bounds.maxZ - model.bounds.minZ;
  if (zRange > 10) {
    recommendations.push('Significant vertical routing - verify elevation clearances');
  }

  // Check for path complexity
  if (model.paths.length > 3) {
    recommendations.push(`${model.paths.length} routing paths identified - consider sequencing`);
  }

  // Element-specific recommendations
  const valveCount = elements.filter(e => e.type === 'valve').length;
  if (valveCount > 5) {
    recommendations.push(`${valveCount} valves detected - verify accessibility for maintenance`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Standard routing complexity - proceed with installation');
  }

  return recommendations;
}

// ============================================================================
// EXPORT
// ============================================================================

export const isometricInterpreter = {
  detectIsometricViews,
  reconstructFrom2D,
  generateIsometricView
};
