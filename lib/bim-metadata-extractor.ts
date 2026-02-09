/**
 * BIM Metadata Extraction Service
 * Extracts properties, materials, and quantities from Autodesk models
 */

import { getAccessToken } from './autodesk-auth';
import { logger } from '@/lib/logger';

const MD_BASE_URL = 'https://developer.api.autodesk.com/modelderivative/v2';

// Common Revit category mappings
export const REVIT_CATEGORIES = {
  // Structural
  'Revit Walls': { category: 'structural', subcategory: 'walls' },
  'Revit Floors': { category: 'structural', subcategory: 'floors' },
  'Revit Structural Columns': { category: 'structural', subcategory: 'columns' },
  'Revit Structural Framing': { category: 'structural', subcategory: 'framing' },
  'Revit Structural Foundations': { category: 'structural', subcategory: 'foundations' },
  'Revit Roofs': { category: 'structural', subcategory: 'roofs' },
  'Revit Ceilings': { category: 'structural', subcategory: 'ceilings' },
  'Revit Stairs': { category: 'structural', subcategory: 'stairs' },
  'Revit Railings': { category: 'structural', subcategory: 'railings' },
  'Revit Ramps': { category: 'structural', subcategory: 'ramps' },
  
  // MEP - Mechanical
  'Revit Mechanical Equipment': { category: 'mep', subcategory: 'mechanical_equipment' },
  'Revit Ducts': { category: 'mep', subcategory: 'ductwork' },
  'Revit Duct Fittings': { category: 'mep', subcategory: 'duct_fittings' },
  'Revit Duct Accessories': { category: 'mep', subcategory: 'duct_accessories' },
  'Revit Air Terminals': { category: 'mep', subcategory: 'air_terminals' },
  'Revit Flex Ducts': { category: 'mep', subcategory: 'flex_ducts' },
  
  // MEP - Electrical
  'Revit Electrical Equipment': { category: 'mep', subcategory: 'electrical_equipment' },
  'Revit Electrical Fixtures': { category: 'mep', subcategory: 'electrical_fixtures' },
  'Revit Lighting Fixtures': { category: 'mep', subcategory: 'lighting' },
  'Revit Cable Trays': { category: 'mep', subcategory: 'cable_trays' },
  'Revit Conduits': { category: 'mep', subcategory: 'conduits' },
  'Revit Wire': { category: 'mep', subcategory: 'wire' },
  
  // MEP - Plumbing
  'Revit Plumbing Fixtures': { category: 'mep', subcategory: 'plumbing_fixtures' },
  'Revit Pipes': { category: 'mep', subcategory: 'piping' },
  'Revit Pipe Fittings': { category: 'mep', subcategory: 'pipe_fittings' },
  'Revit Pipe Accessories': { category: 'mep', subcategory: 'pipe_accessories' },
  'Revit Flex Pipes': { category: 'mep', subcategory: 'flex_pipes' },
  'Revit Sprinklers': { category: 'mep', subcategory: 'fire_protection' },
  
  // Architectural
  'Revit Doors': { category: 'architectural', subcategory: 'doors' },
  'Revit Windows': { category: 'architectural', subcategory: 'windows' },
  'Revit Curtain Panels': { category: 'architectural', subcategory: 'curtain_wall' },
  'Revit Curtain Wall Mullions': { category: 'architectural', subcategory: 'curtain_wall' },
  'Revit Casework': { category: 'architectural', subcategory: 'casework' },
  'Revit Furniture': { category: 'architectural', subcategory: 'furniture' },
  'Revit Specialty Equipment': { category: 'architectural', subcategory: 'specialty' },
  
  // Site
  'Revit Topography': { category: 'site', subcategory: 'topography' },
  'Revit Planting': { category: 'site', subcategory: 'landscaping' },
  'Revit Site': { category: 'site', subcategory: 'site_elements' },
  'Revit Parking': { category: 'site', subcategory: 'parking' },
} as const;

export interface ModelMetadata {
  guid: string;
  name: string;
  role: string;
  viewableId?: string;
}

// Raw item from Autodesk Model Derivative API
interface RawAutodeskItem {
  objectid: number;
  externalId?: string;
  name?: string;
  category?: string;
  properties?: Record<string, Record<string, unknown>>;
}

export interface ElementProperty {
  dbId: number;
  externalId?: string;
  name: string;
  category: string;
  properties: Record<string, string | number | boolean>;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    area?: number;
    volume?: number;
  };
  material?: string;
  materialQuantity?: number;
  materialUnit?: string;
  level?: string;
  location?: string;
}

export interface BIMExtractionResult {
  modelUrn: string;
  extractedAt: string;
  viewableGuids: string[];
  totalElements: number;
  categories: Record<string, number>;
  elements: ElementProperty[];
  summary: {
    structural: number;
    mep: number;
    architectural: number;
    site: number;
    other: number;
  };
}

/**
 * Get metadata (views/viewables) from a translated model
 */
export async function getModelMetadata(urn: string): Promise<ModelMetadata[]> {
  const token = await getAccessToken();

  const response = await fetch(`${MD_BASE_URL}/designdata/${urn}/metadata`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to get metadata: ${response.status}`);
  }

  const data = await response.json();
  return data.data?.metadata || [];
}

/**
 * Get the object tree (hierarchy) for a specific view
 */
export async function getObjectTree(
  urn: string,
  guid: string
): Promise<any> {
  const token = await getAccessToken();

  const response = await fetch(
    `${MD_BASE_URL}/designdata/${urn}/metadata/${guid}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) {
    if (response.status === 202) {
      // Still processing
      return null;
    }
    throw new Error(`Failed to get object tree: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get properties for all objects in a view
 */
export async function getAllProperties(
  urn: string,
  guid: string
): Promise<ElementProperty[]> {
  const token = await getAccessToken();

  const response = await fetch(
    `${MD_BASE_URL}/designdata/${urn}/metadata/${guid}/properties?forceget=true`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) {
    if (response.status === 202) {
      // Properties still being generated
      return [];
    }
    throw new Error(`Failed to get properties: ${response.status}`);
  }

  const data = await response.json();
  const collection = data.data?.collection || [];

  // Parse and normalize properties
  return collection.map((item: RawAutodeskItem) => parseElementProperties(item));
}

/**
 * Parse raw Autodesk properties into our format
 */
function parseElementProperties(item: RawAutodeskItem): ElementProperty {
  const props: Record<string, string | number | boolean> = {};
  const dimensions: ElementProperty['dimensions'] = {};

  // Flatten property groups
  if (item.properties) {
    for (const group of Object.values(item.properties)) {
      if (typeof group === 'object' && group !== null) {
        for (const [key, value] of Object.entries(group)) {
          if (value !== null && value !== undefined && value !== '') {
            props[key] = value as string | number | boolean;

            // Extract dimensions
            const keyLower = key.toLowerCase();
            if (keyLower.includes('length')) dimensions.length = parseFloat(String(value)) || undefined;
            if (keyLower.includes('width')) dimensions.width = parseFloat(String(value)) || undefined;
            if (keyLower.includes('height')) dimensions.height = parseFloat(String(value)) || undefined;
            if (keyLower.includes('area')) dimensions.area = parseFloat(String(value)) || undefined;
            if (keyLower.includes('volume')) dimensions.volume = parseFloat(String(value)) || undefined;
          }
        }
      }
    }
  }

  // Get material info
  const material = props['Material'] || props['material'] || props['Structural Material'] || '';
  const materialQuantity = props['Material Quantity'] || props['Quantity'] || undefined;

  // Extract category from nested properties if available
  const categoryGroup = item.properties?.['__category__'] as Record<string, unknown> | undefined;
  const categoryValue = categoryGroup?.['Category'];

  return {
    dbId: item.objectid,
    externalId: item.externalId,
    name: item.name || 'Unknown',
    category: (typeof categoryValue === 'string' ? categoryValue : item.category) || 'Unknown',
    properties: props,
    dimensions: Object.keys(dimensions).length > 0 ? dimensions : undefined,
    material: material ? String(material) : undefined,
    materialQuantity: materialQuantity ? Number(materialQuantity) : undefined,
    level: String(props['Level'] || props['Reference Level'] || ''),
    location: String(props['Location'] || props['Room'] || ''),
  };
}

/**
 * Categorize an element based on its Revit category
 */
export function categorizeElement(category: string): { category: string; subcategory: string } {
  // Try exact match first
  const mapping = REVIT_CATEGORIES[category as keyof typeof REVIT_CATEGORIES];
  if (mapping) return mapping;

  // Try partial match
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('duct') || categoryLower.includes('hvac') || categoryLower.includes('air')) {
    return { category: 'mep', subcategory: 'mechanical' };
  }
  if (categoryLower.includes('pipe') || categoryLower.includes('plumb')) {
    return { category: 'mep', subcategory: 'plumbing' };
  }
  if (categoryLower.includes('electric') || categoryLower.includes('light') || categoryLower.includes('conduit')) {
    return { category: 'mep', subcategory: 'electrical' };
  }
  if (categoryLower.includes('wall') || categoryLower.includes('floor') || categoryLower.includes('column') || categoryLower.includes('beam')) {
    return { category: 'structural', subcategory: 'general' };
  }
  if (categoryLower.includes('door') || categoryLower.includes('window') || categoryLower.includes('curtain')) {
    return { category: 'architectural', subcategory: 'openings' };
  }
  if (categoryLower.includes('furniture') || categoryLower.includes('casework') || categoryLower.includes('equipment')) {
    return { category: 'architectural', subcategory: 'furnishings' };
  }

  return { category: 'other', subcategory: 'unknown' };
}

/**
 * Full extraction of BIM data from a model
 */
export async function extractBIMData(urn: string): Promise<BIMExtractionResult> {
  logger.info('BIM_METADATA', 'Starting extraction for URN', { urn });

  // Get all viewables/metadata
  const metadata = await getModelMetadata(urn);
  const viewableGuids: string[] = [];
  const allElements: ElementProperty[] = [];
  const categories: Record<string, number> = {};

  // Process each viewable (usually 3D and 2D views)
  for (const view of metadata) {
    if (view.role === '3d' || view.role === '2d') {
      viewableGuids.push(view.guid);

      try {
        const properties = await getAllProperties(urn, view.guid);
        
        for (const element of properties) {
          // Skip if already processed (same element can appear in multiple views)
          if (allElements.some(e => e.dbId === element.dbId)) continue;

          allElements.push(element);

          // Count by category
          categories[element.category] = (categories[element.category] || 0) + 1;
        }

        logger.info('BIM_METADATA', 'View processed', { guid: view.guid, elements: properties.length });
      } catch (error) {
        logger.warn('BIM_METADATA', 'Failed to get properties for view', { guid: view.guid });
      }
    }
  }

  // Calculate summary
  const summary = { structural: 0, mep: 0, architectural: 0, site: 0, other: 0 };
  for (const element of allElements) {
    const { category } = categorizeElement(element.category);
    summary[category as keyof typeof summary] = (summary[category as keyof typeof summary] || 0) + 1;
  }

  logger.info('BIM_METADATA', 'Extraction complete', { elements: allElements.length });

  return {
    modelUrn: urn,
    extractedAt: new Date().toISOString(),
    viewableGuids,
    totalElements: allElements.length,
    categories,
    elements: allElements,
    summary,
  };
}
