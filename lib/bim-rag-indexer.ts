/**
 * BIM RAG Indexer
 * Indexes BIM model data for chat/RAG queries
 */

import { prisma } from './db';
import { BIMExtractionResult, ElementProperty, categorizeElement } from './bim-metadata-extractor';
import { extractMEPEquipment } from './bim-to-takeoff-service';
import { logger } from '@/lib/logger';

export interface BIMIndexEntry {
  type: 'element' | 'summary' | 'mep' | 'material' | 'level';
  content: string;
  metadata: Record<string, any>;
}

/**
 * Generate searchable text content from BIM data
 */
export function generateBIMIndexEntries(bimData: BIMExtractionResult): BIMIndexEntry[] {
  const entries: BIMIndexEntry[] = [];

  // 1. Overall model summary
  entries.push({
    type: 'summary',
    content: `BIM Model Summary: ${bimData.totalElements} total elements. ` +
      `Structural: ${bimData.summary.structural} elements. ` +
      `MEP (Mechanical/Electrical/Plumbing): ${bimData.summary.mep} elements. ` +
      `Architectural: ${bimData.summary.architectural} elements. ` +
      `Site: ${bimData.summary.site} elements.`,
    metadata: {
      totalElements: bimData.totalElements,
      summary: bimData.summary,
      categories: bimData.categories,
    },
  });

  // 2. Category breakdown
  for (const [category, count] of Object.entries(bimData.categories)) {
    if (count > 0) {
      entries.push({
        type: 'summary',
        content: `The BIM model contains ${count} ${category} elements.`,
        metadata: { category, count },
      });
    }
  }

  // 3. MEP Equipment details
  const mep = extractMEPEquipment(bimData);
  
  if (mep.mechanical.length > 0) {
    const equipmentNames = [...new Set(mep.mechanical.map(e => e.name))].slice(0, 20);
    entries.push({
      type: 'mep',
      content: `Mechanical/HVAC Equipment (${mep.mechanical.length} items): ${equipmentNames.join(', ')}. ` +
        `Includes ductwork, air terminals, and mechanical equipment.`,
      metadata: {
        type: 'mechanical',
        count: mep.mechanical.length,
        items: equipmentNames,
      },
    });
  }

  if (mep.electrical.length > 0) {
    const equipmentNames = [...new Set(mep.electrical.map(e => e.name))].slice(0, 20);
    entries.push({
      type: 'mep',
      content: `Electrical Equipment (${mep.electrical.length} items): ${equipmentNames.join(', ')}. ` +
        `Includes lighting fixtures, electrical panels, conduits, and wiring.`,
      metadata: {
        type: 'electrical',
        count: mep.electrical.length,
        items: equipmentNames,
      },
    });
  }

  if (mep.plumbing.length > 0) {
    const equipmentNames = [...new Set(mep.plumbing.map(e => e.name))].slice(0, 20);
    entries.push({
      type: 'mep',
      content: `Plumbing Equipment (${mep.plumbing.length} items): ${equipmentNames.join(', ')}. ` +
        `Includes plumbing fixtures, piping, and pipe fittings.`,
      metadata: {
        type: 'plumbing',
        count: mep.plumbing.length,
        items: equipmentNames,
      },
    });
  }

  if (mep.fireProtection.length > 0) {
    const equipmentNames = [...new Set(mep.fireProtection.map(e => e.name))].slice(0, 20);
    entries.push({
      type: 'mep',
      content: `Fire Protection (${mep.fireProtection.length} items): ${equipmentNames.join(', ')}. ` +
        `Includes sprinklers and fire suppression equipment.`,
      metadata: {
        type: 'fire_protection',
        count: mep.fireProtection.length,
        items: equipmentNames,
      },
    });
  }

  // 4. Material summary
  const materials = new Map<string, number>();
  for (const element of bimData.elements) {
    if (element.material) {
      materials.set(element.material, (materials.get(element.material) || 0) + 1);
    }
  }

  if (materials.size > 0) {
    const materialList = Array.from(materials.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    entries.push({
      type: 'material',
      content: `Materials used in BIM model: ${materialList.map(([m, c]) => `${m} (${c} elements)`).join(', ')}.`,
      metadata: {
        materials: Object.fromEntries(materialList),
      },
    });
  }

  // 5. Level/Floor summary
  const levels = new Map<string, number>();
  for (const element of bimData.elements) {
    if (element.level) {
      levels.set(element.level, (levels.get(element.level) || 0) + 1);
    }
  }

  if (levels.size > 0) {
    const levelList = Array.from(levels.entries()).sort((a, b) => b[1] - a[1]);

    entries.push({
      type: 'level',
      content: `Building levels in BIM model: ${levelList.map(([l, c]) => `${l} (${c} elements)`).join(', ')}.`,
      metadata: {
        levels: Object.fromEntries(levelList),
      },
    });
  }

  // 6. Specific element details (top items by category)
  const elementsByCategory = new Map<string, ElementProperty[]>();
  for (const element of bimData.elements) {
    const { category } = categorizeElement(element.category);
    if (!elementsByCategory.has(category)) {
      elementsByCategory.set(category, []);
    }
    elementsByCategory.get(category)!.push(element);
  }

  for (const [category, elements] of elementsByCategory) {
    // Group by name within category
    const byName = new Map<string, number>();
    for (const e of elements) {
      byName.set(e.name, (byName.get(e.name) || 0) + 1);
    }

    const topItems = Array.from(byName.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (topItems.length > 0) {
      entries.push({
        type: 'element',
        content: `${category.charAt(0).toUpperCase() + category.slice(1)} elements: ${topItems.map(([n, c]) => `${n} (${c})`).join(', ')}.`,
        metadata: {
          category,
          items: Object.fromEntries(topItems),
        },
      });
    }
  }

  return entries;
}

/**
 * Store BIM data in database for RAG access
 */
export async function indexBIMForRAG(
  projectId: string,
  modelId: string,
  bimData: BIMExtractionResult
): Promise<number> {
  logger.info('BIM_RAG_INDEXER', `Indexing BIM data for project ${projectId}`);

  // Generate index entries
  const entries = generateBIMIndexEntries(bimData);

  // Get the model
  const model = await prisma.autodeskModel.findUnique({
    where: { id: modelId },
  });

  if (!model) {
    throw new Error('Model not found');
  }

  // Find or create a pseudo-document for BIM data
  const bimDocName = `BIM:${modelId}`;
  
  let bimDoc = await prisma.document.findFirst({
    where: {
      projectId,
      name: bimDocName,
    },
  });

  if (bimDoc) {
    // Delete existing chunks for this document
    await prisma.documentChunk.deleteMany({
      where: { documentId: bimDoc.id },
    });
  } else {
    // Create new document for BIM data
    bimDoc = await prisma.document.create({
      data: {
        projectId,
        name: bimDocName,
        fileName: model.fileName,
        fileType: 'bim',
        cloud_storage_path: model.objectKey,
        isPublic: false,
        fileSize: model.fileSize || 0,
        processed: true,
        category: 'plans_drawings',
        accessLevel: 'admin',
        description: `BIM model data for ${model.fileName}. Total elements: ${bimData.totalElements}`,
        tags: ['bim', 'autodesk', '3d-model'],
      },
    });
  }

  // Create document chunks for each entry
  const chunks = entries.map((entry, index) => ({
    documentId: bimDoc!.id,
    content: entry.content,
    chunkIndex: index,
    metadata: entry.metadata,
  }));

  await prisma.documentChunk.createMany({
    data: chunks,
  });

  // Update model metadata with extraction info
  await prisma.autodeskModel.update({
    where: { id: modelId },
    data: {
      metadata: {
        ...(model.metadata as object || {}),
        ragIndexed: true,
        ragIndexedAt: new Date().toISOString(),
        ragChunkCount: entries.length,
      },
    },
  });

  logger.info('BIM_RAG_INDEXER', `Indexed ${entries.length} chunks for model ${modelId}`);

  return entries.length;
}

/**
 * Get BIM and DWG context for a RAG query
 */
export async function getBIMContext(
  projectId: string,
  query: string
): Promise<string | null> {
  const queryLower = query.toLowerCase();

  // Keywords for BIM models (3D)
  const bimKeywords = [
    'mep', 'mechanical', 'electrical', 'plumbing', 'hvac', 'duct',
    'pipe', 'light', 'fixture', 'equipment', 'material', 'wall',
    'floor', 'ceiling', 'door', 'window', 'bim', '3d', 'model',
    'element', 'structural', 'concrete', 'steel', 'level', 'floor',
    'revit', 'ifc', 'navisworks',
  ];

  // Keywords for DWG drawings (2D)
  const dwgKeywords = [
    'dwg', 'drawing', 'layer', 'autocad', 'civil', 'site', 'grading',
    'topography', 'utility', 'storm', 'sewer', 'paving', 'landscape',
    'block', 'symbol', 'annotation', 'note', 'dimension', 'plan',
    '2d', 'sheet', 'cad', 'survey', 'contour', 'elevation', 'section',
    'detail', 'typical', 'legend', 'schedule',
  ];

  const isBIMRelevant = bimKeywords.some(k => queryLower.includes(k));
  const isDWGRelevant = dwgKeywords.some(k => queryLower.includes(k));

  if (!isBIMRelevant && !isDWGRelevant) return null;

  const contextParts: string[] = [];

  // Get BIM model context
  if (isBIMRelevant) {
    const bimDocs = await prisma.document.findMany({
      where: {
        projectId,
        name: { startsWith: 'BIM:' },
      },
      select: { id: true },
    });

    if (bimDocs.length > 0) {
      const bimChunks = await prisma.documentChunk.findMany({
        where: {
          documentId: { in: bimDocs.map(d => d.id) },
        },
        take: 15,
        orderBy: { chunkIndex: 'asc' },
      });

      const relevantBIM = bimChunks.filter(chunk => {
        const contentLower = chunk.content.toLowerCase();
        const chunkKeywords = queryLower.split(/\s+/);
        const matches = chunkKeywords.filter(k => k.length > 3 && contentLower.includes(k));
        return matches.length > 0 || contentLower.includes('summary');
      });

      if (relevantBIM.length > 0) {
        contextParts.push(`=== BIM MODEL DATA (3D) ===\n${relevantBIM.slice(0, 8).map(c => c.content).join('\n\n')}`);
      }
    }
  }

  // Get DWG drawing context
  if (isDWGRelevant) {
    // Check for Autodesk models with extracted DWG metadata
    const dwgModels = await prisma.autodeskModel.findMany({
      where: {
        project: { id: projectId },
        is2D: true,
        // @ts-expect-error strictNullChecks migration
        extractedMetadata: { not: null },
      },
      select: {
        fileName: true,
        extractedMetadata: true,
      },
      take: 5,
    });

    const dwgContext: string[] = [];

    // Extract searchable content from DWG models
    for (const model of dwgModels) {
      const meta = model.extractedMetadata as any;
      
      // Check for searchChunks in extracted metadata
      if (meta?.searchChunks && Array.isArray(meta.searchChunks)) {
        const relevantChunks = meta.searchChunks.filter((chunk: string) => {
          const chunkLower = chunk.toLowerCase();
          const queryWords = queryLower.split(/\s+/);
          const matches = queryWords.filter(w => w.length > 3 && chunkLower.includes(w));
          return matches.length > 0 || chunkLower.includes('dwg') || chunkLower.includes('layer');
        });
        dwgContext.push(...relevantChunks.slice(0, 4));
      }
      
      // Add summary if no chunks match
      if (dwgContext.length === 0 && meta?.summary) {
        dwgContext.push(
          `DWG Drawing: ${model.fileName}. ` +
          `Layers: ${meta.summary.totalLayers || 0}, ` +
          `Blocks: ${meta.summary.totalBlocks || 0}, ` +
          `Annotations: ${meta.summary.totalAnnotations || 0}.`
        );
        
        // Add layer categories if available
        if (meta.layerCategories) {
          const cats = Object.entries(meta.layerCategories)
            .map(([cat, count]) => `${cat}: ${count}`)
            .join(', ');
          dwgContext.push(`Layer categories: ${cats}`);
        }
      }
    }

    if (dwgContext.length > 0) {
      contextParts.push(`=== DWG DRAWING DATA (2D) ===\n${dwgContext.slice(0, 8).join('\n\n')}`);
    }
  }

  if (contextParts.length === 0) return null;

  return '\n\n' + contextParts.join('\n\n');
}
