/**
 * BIM to Takeoff Mapping Service
 * Converts BIM element data into takeoff line items
 */

import { prisma } from './db';
import { BIMExtractionResult, ElementProperty, categorizeElement } from './bim-metadata-extractor';

// CSI Division mappings for BIM categories
const CSI_MAPPINGS: Record<string, { division: string; divisionName: string }> = {
  // Structural
  'structural:foundations': { division: '03', divisionName: 'Concrete' },
  'structural:columns': { division: '03', divisionName: 'Concrete' },
  'structural:walls': { division: '04', divisionName: 'Masonry' },
  'structural:framing': { division: '05', divisionName: 'Metals' },
  'structural:floors': { division: '03', divisionName: 'Concrete' },
  'structural:roofs': { division: '07', divisionName: 'Thermal & Moisture Protection' },
  'structural:ceilings': { division: '09', divisionName: 'Finishes' },
  'structural:stairs': { division: '05', divisionName: 'Metals' },
  'structural:railings': { division: '05', divisionName: 'Metals' },
  'structural:ramps': { division: '03', divisionName: 'Concrete' },
  
  // Architectural
  'architectural:doors': { division: '08', divisionName: 'Openings' },
  'architectural:windows': { division: '08', divisionName: 'Openings' },
  'architectural:curtain_wall': { division: '08', divisionName: 'Openings' },
  'architectural:casework': { division: '12', divisionName: 'Furnishings' },
  'architectural:furniture': { division: '12', divisionName: 'Furnishings' },
  'architectural:specialty': { division: '11', divisionName: 'Equipment' },
  'architectural:openings': { division: '08', divisionName: 'Openings' },
  'architectural:furnishings': { division: '12', divisionName: 'Furnishings' },
  
  // MEP - Mechanical
  'mep:mechanical_equipment': { division: '23', divisionName: 'HVAC' },
  'mep:ductwork': { division: '23', divisionName: 'HVAC' },
  'mep:duct_fittings': { division: '23', divisionName: 'HVAC' },
  'mep:duct_accessories': { division: '23', divisionName: 'HVAC' },
  'mep:air_terminals': { division: '23', divisionName: 'HVAC' },
  'mep:flex_ducts': { division: '23', divisionName: 'HVAC' },
  'mep:mechanical': { division: '23', divisionName: 'HVAC' },
  
  // MEP - Electrical
  'mep:electrical_equipment': { division: '26', divisionName: 'Electrical' },
  'mep:electrical_fixtures': { division: '26', divisionName: 'Electrical' },
  'mep:lighting': { division: '26', divisionName: 'Electrical' },
  'mep:cable_trays': { division: '26', divisionName: 'Electrical' },
  'mep:conduits': { division: '26', divisionName: 'Electrical' },
  'mep:wire': { division: '26', divisionName: 'Electrical' },
  'mep:electrical': { division: '26', divisionName: 'Electrical' },
  
  // MEP - Plumbing
  'mep:plumbing_fixtures': { division: '22', divisionName: 'Plumbing' },
  'mep:piping': { division: '22', divisionName: 'Plumbing' },
  'mep:pipe_fittings': { division: '22', divisionName: 'Plumbing' },
  'mep:pipe_accessories': { division: '22', divisionName: 'Plumbing' },
  'mep:flex_pipes': { division: '22', divisionName: 'Plumbing' },
  'mep:fire_protection': { division: '21', divisionName: 'Fire Suppression' },
  'mep:plumbing': { division: '22', divisionName: 'Plumbing' },
  
  // Site
  'site:topography': { division: '31', divisionName: 'Earthwork' },
  'site:landscaping': { division: '32', divisionName: 'Exterior Improvements' },
  'site:site_elements': { division: '32', divisionName: 'Exterior Improvements' },
  'site:parking': { division: '32', divisionName: 'Exterior Improvements' },
  
  // Default
  'other:unknown': { division: '01', divisionName: 'General Requirements' },
};

// Unit inference from dimensions
function inferUnit(element: ElementProperty): string {
  const categoryLower = element.category.toLowerCase();
  
  // Area-based items
  if (
    categoryLower.includes('floor') ||
    categoryLower.includes('ceiling') ||
    categoryLower.includes('roof') ||
    categoryLower.includes('wall')
  ) {
    return 'SF';
  }
  
  // Linear items
  if (
    categoryLower.includes('pipe') ||
    categoryLower.includes('duct') ||
    categoryLower.includes('conduit') ||
    categoryLower.includes('cable') ||
    categoryLower.includes('wire') ||
    categoryLower.includes('beam') ||
    categoryLower.includes('framing')
  ) {
    return 'LF';
  }
  
  // Volume items
  if (
    categoryLower.includes('concrete') ||
    categoryLower.includes('foundation')
  ) {
    return 'CY';
  }
  
  // Count items (equipment, fixtures, etc.)
  return 'EA';
}

// Extract quantity from element properties
function extractQuantity(element: ElementProperty): number {
  // Try to get from dimensions
  if (element.dimensions) {
    if (element.dimensions.area) return element.dimensions.area;
    if (element.dimensions.length) return element.dimensions.length;
    if (element.dimensions.volume) return element.dimensions.volume;
  }
  
  // Try from material quantity
  if (element.materialQuantity) return element.materialQuantity;
  
  // Default to 1 for count items
  return 1;
}

export interface TakeoffImportResult {
  takeoffId: string;
  importedItems: number;
  skippedItems: number;
  categories: Record<string, number>;
  errors: string[];
}

/**
 * Import BIM extraction data into the takeoff system
 */
export async function importBIMToTakeoff(
  projectId: string,
  modelId: string,
  bimData: BIMExtractionResult
): Promise<TakeoffImportResult> {
  console.log(`[BIM→Takeoff] Starting import for project ${projectId}, model ${modelId}`);
  
  const errors: string[] = [];
  const categoryCount: Record<string, number> = {};
  let importedItems = 0;
  let skippedItems = 0;

  // Create or find existing takeoff for this model
  // Use name pattern to find existing BIM takeoff for this model
  let takeoff = await prisma.materialTakeoff.findFirst({
    where: {
      projectId,
      name: { startsWith: `BIM Takeoff - ` },
      description: { contains: modelId },
    },
  });

  // Get the model info
  const model = await prisma.autodeskModel.findUnique({
    where: { id: modelId },
  });

  // Get a user ID for createdBy (use the model uploader)
  const createdBy = model?.uploadedBy || 'system';

  if (!takeoff) {
    takeoff = await prisma.materialTakeoff.create({
      data: {
        projectId,
        name: `BIM Takeoff - ${model?.fileName || 'Unknown Model'}`,
        description: `Auto-extracted from BIM model (${modelId}) on ${new Date().toLocaleDateString()}. Elements: ${bimData.totalElements}`,
        status: 'processing',
        createdBy,
        extractedAt: new Date(),
        extractedBy: 'autodesk_bim',
      },
    });
  } else {
    // Clear existing line items for re-import
    await prisma.takeoffLineItem.deleteMany({
      where: { takeoffId: takeoff.id },
    });
  }

  // Group elements by type/name for aggregation
  const aggregatedItems: Map<string, {
    elements: ElementProperty[];
    totalQuantity: number;
    unit: string;
    category: string;
    subcategory: string;
  }> = new Map();

  for (const element of bimData.elements) {
    try {
      const { category, subcategory } = categorizeElement(element.category);
      const unit = inferUnit(element);
      const quantity = extractQuantity(element);

      // Create aggregation key
      const key = `${element.name}|${category}|${subcategory}|${unit}|${element.material || 'default'}`;

      if (aggregatedItems.has(key)) {
        const existing = aggregatedItems.get(key)!;
        existing.elements.push(element);
        existing.totalQuantity += quantity;
      } else {
        aggregatedItems.set(key, {
          elements: [element],
          totalQuantity: quantity,
          unit,
          category,
          subcategory,
        });
      }
    } catch (error) {
      errors.push(`Failed to process element ${element.dbId}: ${error}`);
      skippedItems++;
    }
  }

  // Create takeoff line items from aggregated data
  const lineItemsToCreate: any[] = [];

  for (const [key, data] of aggregatedItems) {
    const [name, category, subcategory, unit, material] = key.split('|');
    const csiKey = `${category}:${subcategory}`;
    const csiMapping = CSI_MAPPINGS[csiKey] || CSI_MAPPINGS['other:unknown'];

    lineItemsToCreate.push({
      takeoffId: takeoff.id,
      itemName: name,
      category: `${csiMapping.division} - ${csiMapping.divisionName}`,
      quantity: Math.round(data.totalQuantity * 100) / 100, // Round to 2 decimals
      unit: data.unit,
      description: `${data.elements.length} ${name} elements${material !== 'default' ? ` (${material})` : ''}`,
      confidence: 0.9, // High confidence for BIM data
      sourceType: 'bim',
      bimCategory: data.elements[0].category,
      material: material !== 'default' ? material : null,
      level: data.elements[0].level || null,
      metadata: {
        bimCategory: category,
        bimSubcategory: subcategory,
        csiDivision: csiMapping.division,
        elementCount: data.elements.length,
        dbIds: data.elements.map(e => e.dbId).slice(0, 100), // Store first 100 dbIds for reference
      },
    });

    categoryCount[csiMapping.divisionName] = (categoryCount[csiMapping.divisionName] || 0) + 1;
    importedItems++;
  }

  // Batch create line items
  if (lineItemsToCreate.length > 0) {
    await prisma.takeoffLineItem.createMany({
      data: lineItemsToCreate,
    });
  }

  // Update takeoff status
  await prisma.materialTakeoff.update({
    where: { id: takeoff.id },
    data: {
      status: 'completed',
      description: `Auto-extracted from BIM model (${modelId}). ${importedItems} items imported. Categories: ${Object.keys(categoryCount).join(', ')}`,
    },
  });

  console.log(`[BIM→Takeoff] Import complete: ${importedItems} items, ${skippedItems} skipped`);

  return {
    takeoffId: takeoff.id,
    importedItems,
    skippedItems,
    categories: categoryCount,
    errors,
  };
}

/**
 * Get MEP equipment summary from BIM data
 */
export function extractMEPEquipment(bimData: BIMExtractionResult): {
  mechanical: ElementProperty[];
  electrical: ElementProperty[];
  plumbing: ElementProperty[];
  fireProtection: ElementProperty[];
} {
  const mep = {
    mechanical: [] as ElementProperty[],
    electrical: [] as ElementProperty[],
    plumbing: [] as ElementProperty[],
    fireProtection: [] as ElementProperty[],
  };

  for (const element of bimData.elements) {
    const { category, subcategory } = categorizeElement(element.category);
    
    if (category !== 'mep') continue;

    if (['mechanical_equipment', 'ductwork', 'duct_fittings', 'duct_accessories', 'air_terminals', 'flex_ducts', 'mechanical'].includes(subcategory)) {
      mep.mechanical.push(element);
    } else if (['electrical_equipment', 'electrical_fixtures', 'lighting', 'cable_trays', 'conduits', 'wire', 'electrical'].includes(subcategory)) {
      mep.electrical.push(element);
    } else if (['plumbing_fixtures', 'piping', 'pipe_fittings', 'pipe_accessories', 'flex_pipes', 'plumbing'].includes(subcategory)) {
      mep.plumbing.push(element);
    } else if (subcategory === 'fire_protection') {
      mep.fireProtection.push(element);
    }
  }

  return mep;
}
