/**
 * DWG Metadata Extraction Service
 * Extracts layers, blocks, text annotations, and properties from AutoCAD DWG files
 * via Autodesk Model Derivative API
 */

import { getAccessToken } from './autodesk-auth';

const MD_BASE_URL = 'https://developer.api.autodesk.com/modelderivative/v2';

// Common AutoCAD layer categories for construction
export const DWG_LAYER_CATEGORIES = {
  // Site/Civil
  'C-': { category: 'civil', description: 'Civil/Site Work' },
  'L-': { category: 'landscape', description: 'Landscape' },
  'G-': { category: 'grading', description: 'Grading/Earthwork' },
  'T-': { category: 'topography', description: 'Topography' },
  'U-': { category: 'utilities', description: 'Utilities' },
  'W-': { category: 'water', description: 'Water/Storm Drainage' },
  'S-': { category: 'sewer', description: 'Sanitary Sewer' },
  'P-': { category: 'paving', description: 'Paving' },
  
  // Architectural
  'A-': { category: 'architectural', description: 'Architectural' },
  'I-': { category: 'interior', description: 'Interior Design' },
  'F-': { category: 'furniture', description: 'Furniture/Fixtures' },
  
  // Structural
  'ST-': { category: 'structural', description: 'Structural' },
  
  // MEP
  'M-': { category: 'mechanical', description: 'Mechanical/HVAC' },
  'E-': { category: 'electrical', description: 'Electrical' },
  'PL-': { category: 'plumbing', description: 'Plumbing' },
  'FP-': { category: 'fire_protection', description: 'Fire Protection' },
  
  // General
  'X-': { category: 'xref', description: 'External Reference' },
  'D-': { category: 'demolition', description: 'Demolition' },
  'N-': { category: 'new', description: 'New Construction' },
  'EX-': { category: 'existing', description: 'Existing Conditions' },
  'PROP-': { category: 'proposed', description: 'Proposed' },
} as const;

export interface DWGLayer {
  name: string;
  category: string;
  description: string;
  isVisible: boolean;
  color?: string;
  lineType?: string;
  objectCount?: number;
}

export interface DWGBlock {
  name: string;
  instanceCount: number;
  attributes?: Record<string, string>[];
  insertionPoints?: Array<{ x: number; y: number; z: number }>;
}

export interface DWGTextAnnotation {
  text: string;
  layer: string;
  position?: { x: number; y: number };
  height?: number;
  style?: string;
  type: 'text' | 'mtext' | 'dimension' | 'leader';
}

export interface DWGExtent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  unit: string;
}

export interface DWGExtractionResult {
  modelUrn: string;
  fileName: string;
  extractedAt: string;
  fileType: 'dwg' | 'dxf';
  is2D: boolean;
  
  // Layer information
  layers: DWGLayer[];
  layerCategories: Record<string, number>;
  
  // Block/symbol information
  blocks: DWGBlock[];
  
  // Text annotations
  textAnnotations: DWGTextAnnotation[];
  
  // Drawing metadata
  extent?: DWGExtent;
  scale?: string;
  units?: string;
  
  // Summary counts
  summary: {
    totalLayers: number;
    visibleLayers: number;
    totalBlocks: number;
    totalBlockInstances: number;
    totalAnnotations: number;
    categoryCounts: Record<string, number>;
  };
  
  // Raw metadata from Autodesk
  rawMetadata?: Record<string, any>;
}

/**
 * Categorize a DWG layer based on naming conventions
 */
export function categorizeLayer(layerName: string): { category: string; description: string } {
  const upperName = layerName.toUpperCase();
  
  for (const [prefix, info] of Object.entries(DWG_LAYER_CATEGORIES)) {
    if (upperName.startsWith(prefix)) {
      return info;
    }
  }
  
  // Try to infer from common keywords
  if (upperName.includes('DEMO') || upperName.includes('REMOVE')) {
    return { category: 'demolition', description: 'Demolition' };
  }
  if (upperName.includes('EXIST')) {
    return { category: 'existing', description: 'Existing Conditions' };
  }
  if (upperName.includes('PROP') || upperName.includes('NEW')) {
    return { category: 'proposed', description: 'Proposed' };
  }
  if (upperName.includes('SITE') || upperName.includes('CIVIL')) {
    return { category: 'civil', description: 'Civil/Site Work' };
  }
  if (upperName.includes('GRADE') || upperName.includes('TOPO')) {
    return { category: 'grading', description: 'Grading/Topography' };
  }
  if (upperName.includes('UTIL')) {
    return { category: 'utilities', description: 'Utilities' };
  }
  if (upperName.includes('STORM') || upperName.includes('DRAIN')) {
    return { category: 'water', description: 'Storm Drainage' };
  }
  if (upperName.includes('SEWER') || upperName.includes('SANIT')) {
    return { category: 'sewer', description: 'Sanitary Sewer' };
  }
  if (upperName.includes('PAVE') || upperName.includes('PARKING')) {
    return { category: 'paving', description: 'Paving' };
  }
  if (upperName.includes('LAND') || upperName.includes('PLANT')) {
    return { category: 'landscape', description: 'Landscape' };
  }
  if (upperName.includes('ELEC') || upperName.includes('POWER')) {
    return { category: 'electrical', description: 'Electrical' };
  }
  if (upperName.includes('MECH') || upperName.includes('HVAC')) {
    return { category: 'mechanical', description: 'Mechanical' };
  }
  if (upperName.includes('PLUMB') || upperName.includes('PIPE')) {
    return { category: 'plumbing', description: 'Plumbing' };
  }
  if (upperName.includes('FIRE') || upperName.includes('SPRINK')) {
    return { category: 'fire_protection', description: 'Fire Protection' };
  }
  if (upperName.includes('STRUCT') || upperName.includes('FOUND')) {
    return { category: 'structural', description: 'Structural' };
  }
  if (upperName.includes('ARCH') || upperName.includes('BLDG')) {
    return { category: 'architectural', description: 'Architectural' };
  }
  if (upperName.includes('TEXT') || upperName.includes('ANNO') || upperName.includes('NOTE')) {
    return { category: 'annotation', description: 'Annotations/Notes' };
  }
  if (upperName.includes('DIM')) {
    return { category: 'dimensions', description: 'Dimensions' };
  }
  if (upperName.includes('HATCH') || upperName.includes('PATT')) {
    return { category: 'hatching', description: 'Hatching/Patterns' };
  }
  if (upperName.includes('TITLE') || upperName.includes('BORDER')) {
    return { category: 'titleblock', description: 'Title Block/Border' };
  }
  
  return { category: 'general', description: 'General' };
}

/**
 * Get model metadata (views/viewables) from translated DWG
 */
export async function getDWGMetadata(urn: string): Promise<any[]> {
  const token = await getAccessToken();
  
  const response = await fetch(`${MD_BASE_URL}/designdata/${urn}/metadata`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get DWG metadata: ${response.status}`);
  }
  
  const result = await response.json();
  return result.data?.metadata || [];
}

/**
 * Get object tree (layers, blocks) from DWG
 */
export async function getDWGObjectTree(urn: string, guid: string): Promise<any> {
  const token = await getAccessToken();
  
  const response = await fetch(
    `${MD_BASE_URL}/designdata/${urn}/metadata/${guid}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to get DWG object tree: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Get all properties from DWG elements
 */
export async function getDWGProperties(urn: string, guid: string): Promise<any> {
  const token = await getAccessToken();
  
  const response = await fetch(
    `${MD_BASE_URL}/designdata/${urn}/metadata/${guid}/properties?forceget=true`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to get DWG properties: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Extract layers from DWG properties
 * Handles Autodesk's nested property structure: properties.General.Layer
 */
function extractLayers(properties: any[]): DWGLayer[] {
  const layerMap = new Map<string, DWGLayer>();
  
  for (const obj of properties) {
    const props = obj.properties || {};
    
    // Look for layer property in nested structure (Autodesk format)
    let layerName = '';
    
    // First check General.Layer (most common for DWG)
    if (props.General?.Layer) {
      layerName = String(props.General.Layer);
    } else if (props.General?.['Layer ']) {
      // Handle potential trailing space in property name
      layerName = String(props.General['Layer ']);
    } else {
      // Fall back to searching all nested properties
      for (const category of Object.values(props)) {
        if (typeof category === 'object' && category !== null) {
          for (const [key, value] of Object.entries(category as Record<string, unknown>)) {
            if (key.toLowerCase().trim() === 'layer' && typeof value === 'string') {
              layerName = value;
              break;
            }
          }
        }
        if (layerName) break;
      }
    }
    
    if (layerName) {
      // Include "0" layer but categorize it appropriately
      if (!layerMap.has(layerName)) {
        const { category, description } = layerName === '0' 
          ? { category: 'default', description: 'Default Layer' }
          : categorizeLayer(layerName);
        layerMap.set(layerName, {
          name: layerName,
          category,
          description,
          isVisible: true,
          objectCount: 1,
        });
      } else {
        const layer = layerMap.get(layerName)!;
        layer.objectCount = (layer.objectCount || 0) + 1;
      }
    }
  }
  
  return Array.from(layerMap.values());
}

/**
 * Extract blocks/symbols from DWG object tree and properties
 * Block references are identified by names with patterns like "BlockName [HexID]"
 */
function extractBlocks(objectTree: any, properties?: any[]): DWGBlock[] {
  const blockMap = new Map<string, DWGBlock>();
  
  // Helper to extract clean block name from "BlockName [HexID]" format
  function getBlockName(name: string): string | null {
    // Skip generic names
    if (!name || name.startsWith('A$C')) return null; // Anonymous blocks
    
    // Extract block name before hex ID
    const match = name.match(/^([A-Za-z0-9_$-]+)/);
    if (match) {
      return match[1];
    }
    return name;
  }
  
  function traverse(node: any) {
    if (!node) return;
    
    const nodeName = node.name || '';
    
    // Check if this looks like a block reference (pattern: "BlockName [HexID]")
    if (nodeName && nodeName.includes('[') && nodeName.includes(']')) {
      const blockName = getBlockName(nodeName);
      if (blockName) {
        if (!blockMap.has(blockName)) {
          blockMap.set(blockName, {
            name: blockName,
            instanceCount: 1,
            attributes: [],
          });
        } else {
          blockMap.get(blockName)!.instanceCount++;
        }
      }
    }
    
    // Recurse into children
    if (node.objects) {
      for (const child of node.objects) {
        traverse(child);
      }
    }
  }
  
  if (objectTree.data?.objects) {
    for (const obj of objectTree.data.objects) {
      traverse(obj);
    }
  }
  
  // Also check properties for Block Reference objects
  if (properties) {
    for (const obj of properties) {
      const props = obj.properties || {};
      const generalProps = props.General || {};
      
      // Check if this is a Block Reference
      if (generalProps['Name '] === 'Block Reference' || generalProps.Name === 'Block Reference') {
        const blockName = getBlockName(obj.name);
        if (blockName) {
          if (!blockMap.has(blockName)) {
            blockMap.set(blockName, {
              name: blockName,
              instanceCount: 1,
              attributes: [],
            });
          } else {
            blockMap.get(blockName)!.instanceCount++;
          }
        }
      }
    }
  }
  
  return Array.from(blockMap.values());
}

/**
 * Extract text annotations from DWG properties
 * Handles Autodesk's nested property structure
 */
function extractTextAnnotations(properties: any[]): DWGTextAnnotation[] {
  const annotations: DWGTextAnnotation[] = [];
  
  for (const obj of properties) {
    const props = obj.properties || {};
    const generalProps = props.General || {};
    const name = obj.name || '';
    const entityName = generalProps['Name '] || generalProps.Name || '';
    
    // Check for text entities by entity type
    let textContent = '';
    let textType: DWGTextAnnotation['type'] = 'text';
    let layerName = generalProps.Layer || generalProps['Layer '] || '';
    
    // Look for text content in nested properties
    for (const category of Object.values(props)) {
      if (typeof category === 'object' && category !== null) {
        for (const [key, value] of Object.entries(category as Record<string, unknown>)) {
          const keyLower = key.toLowerCase().trim();
          if (keyLower === 'contents' || keyLower === 'textstring' || keyLower === 'text' || keyLower === 'annotation text') {
            if (typeof value === 'string' && value.trim()) {
              textContent = value;
            }
          }
        }
      }
    }
    
    // Determine text type from entity name
    const nameLower = (entityName + ' ' + name).toLowerCase();
    if (nameLower.includes('mtext')) {
      textType = 'mtext';
    } else if (nameLower.includes('dimension') || nameLower.includes('dim')) {
      textType = 'dimension';
    } else if (nameLower.includes('leader') || nameLower.includes('multileader')) {
      textType = 'leader';
    }
    
    // Include items that are text entities even without parsed text content
    // (they might have text visible in the drawing)
    const isTextEntity = ['text', 'mtext', 'dimension', 'leader', 'multileader', 'attribute'].some(
      t => nameLower.includes(t)
    );
    
    if (textContent && textContent.trim().length > 0) {
      annotations.push({
        text: textContent.trim(),
        layer: layerName,
        type: textType,
      });
    } else if (isTextEntity && name) {
      // Even without explicit text content, note that there's a text entity
      annotations.push({
        text: `[${entityName || textType}]`,
        layer: layerName,
        type: textType,
      });
    }
  }
  
  return annotations;
}

/**
 * Full DWG metadata extraction
 */
export async function extractDWGMetadata(
  urn: string,
  fileName: string
): Promise<DWGExtractionResult> {
  console.log('[DWG Extractor] Starting extraction for:', fileName);
  
  const result: DWGExtractionResult = {
    modelUrn: urn,
    fileName,
    extractedAt: new Date().toISOString(),
    fileType: fileName.toLowerCase().endsWith('.dxf') ? 'dxf' : 'dwg',
    is2D: true, // DWG files are typically 2D
    layers: [],
    layerCategories: {},
    blocks: [],
    textAnnotations: [],
    summary: {
      totalLayers: 0,
      visibleLayers: 0,
      totalBlocks: 0,
      totalBlockInstances: 0,
      totalAnnotations: 0,
      categoryCounts: {},
    },
  };
  
  try {
    // Get model metadata (viewables)
    const metadata = await getDWGMetadata(urn);
    
    if (!metadata || metadata.length === 0) {
      console.log('[DWG Extractor] No metadata found, model may still be processing');
      return result;
    }
    
    // Find the 2D view (or first available)
    const viewable = metadata.find((m: any) => m.role === '2d') || metadata[0];
    const guid = viewable?.guid;
    
    if (!guid) {
      console.log('[DWG Extractor] No viewable GUID found');
      return result;
    }
    
    // Get properties for layers, text, and block info
    const propertiesResult = await getDWGProperties(urn, guid);
    const properties = propertiesResult.data?.collection || [];
    
    console.log('[DWG Extractor] Retrieved properties:', properties.length);
    
    // Get object tree for blocks
    const objectTree = await getDWGObjectTree(urn, guid);
    result.blocks = extractBlocks(objectTree, properties);
    
    result.layers = extractLayers(properties);
    result.textAnnotations = extractTextAnnotations(properties);
    
    // Store raw metadata for debugging
    result.rawMetadata = {
      viewableGuid: guid,
      totalObjects: properties.length,
    };
    
    // Calculate layer categories
    for (const layer of result.layers) {
      result.layerCategories[layer.category] = 
        (result.layerCategories[layer.category] || 0) + 1;
    }
    
    // Calculate summary
    result.summary = {
      totalLayers: result.layers.length,
      visibleLayers: result.layers.filter(l => l.isVisible).length,
      totalBlocks: result.blocks.length,
      totalBlockInstances: result.blocks.reduce((sum, b) => sum + b.instanceCount, 0),
      totalAnnotations: result.textAnnotations.length,
      categoryCounts: result.layerCategories,
    };
    
    console.log('[DWG Extractor] Extraction complete:', {
      layers: result.layers.length,
      blocks: result.blocks.length,
      annotations: result.textAnnotations.length,
    });
    
  } catch (error) {
    console.error('[DWG Extractor] Error during extraction:', error);
    // Return partial result even on error
  }
  
  return result;
}

/**
 * Generate searchable text content from DWG data for RAG
 */
export function generateDWGSearchContent(dwgData: DWGExtractionResult): string[] {
  const chunks: string[] = [];
  
  // Summary chunk
  chunks.push(
    `DWG Drawing: ${dwgData.fileName}. ` +
    `This is a ${dwgData.is2D ? '2D' : '3D'} AutoCAD ${dwgData.fileType.toUpperCase()} file. ` +
    `Contains ${dwgData.summary.totalLayers} layers, ` +
    `${dwgData.summary.totalBlocks} unique blocks with ${dwgData.summary.totalBlockInstances} total instances, ` +
    `and ${dwgData.summary.totalAnnotations} text annotations.`
  );
  
  // Layer categories summary
  const categoryList = Object.entries(dwgData.layerCategories)
    .map(([cat, count]) => `${cat}: ${count} layers`)
    .join(', ');
  if (categoryList) {
    chunks.push(`Layer categories in ${dwgData.fileName}: ${categoryList}`);
  }
  
  // Individual layer details (grouped by category)
  const layersByCategory = new Map<string, DWGLayer[]>();
  for (const layer of dwgData.layers) {
    if (!layersByCategory.has(layer.category)) {
      layersByCategory.set(layer.category, []);
    }
    layersByCategory.get(layer.category)!.push(layer);
  }
  
  for (const [category, layers] of layersByCategory) {
    const layerNames = layers.map(l => l.name).slice(0, 30).join(', ');
    chunks.push(
      `${category.toUpperCase()} layers (${layers.length}): ${layerNames}` +
      (layers.length > 30 ? ` ...and ${layers.length - 30} more` : '')
    );
  }
  
  // Block information
  if (dwgData.blocks.length > 0) {
    const topBlocks = dwgData.blocks
      .sort((a, b) => b.instanceCount - a.instanceCount)
      .slice(0, 20);
    const blockList = topBlocks
      .map(b => `${b.name} (${b.instanceCount}x)`)
      .join(', ');
    chunks.push(`Blocks/Symbols in drawing: ${blockList}`);
  }
  
  // Text annotations (deduplicated, limited)
  const uniqueTexts = [...new Set(dwgData.textAnnotations.map(t => t.text))]
    .filter(t => t.length > 3) // Skip very short text
    .slice(0, 50);
  
  if (uniqueTexts.length > 0) {
    // Group by type for better context
    const dimensionTexts = dwgData.textAnnotations
      .filter(t => t.type === 'dimension')
      .map(t => t.text)
      .slice(0, 20);
    const noteTexts = dwgData.textAnnotations
      .filter(t => t.type !== 'dimension')
      .map(t => t.text)
      .slice(0, 30);
    
    if (dimensionTexts.length > 0) {
      chunks.push(`Dimensions shown: ${[...new Set(dimensionTexts)].join(', ')}`);
    }
    if (noteTexts.length > 0) {
      chunks.push(`Drawing notes/annotations: ${[...new Set(noteTexts)].join(' | ')}`);
    }
  }
  
  return chunks;
}
