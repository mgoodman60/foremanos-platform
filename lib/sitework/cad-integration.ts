/**
 * DWG/CAD file integration for sitework takeoff extraction
 */

import { prisma } from '../db';
import { createScopedLogger } from '../logger';
import type { SiteworkExtractionResult } from './extraction';
import { consolidateResults } from './extraction';

const log = createScopedLogger('SITEWORK_CAD');

export interface CADEntity {
  type: 'LINE' | 'POLYLINE' | 'CIRCLE' | 'ARC' | 'TEXT' | 'MTEXT' | 'INSERT' | 'HATCH' | 'POINT';
  layer: string;
  length?: number;
  area?: number;
  text?: string;
  coordinates?: { x: number; y: number; z?: number }[];
  radius?: number;
  blockName?: string;
}

export interface CADLayerData {
  name: string;
  entityCount: number;
  totalLength?: number;
  totalArea?: number;
  entities: CADEntity[];
}

export interface CADExtractionResult {
  layers: CADLayerData[];
  blocks: { name: string; count: number }[];
  units: string;
  extents: { minX: number; minY: number; maxX: number; maxY: number };
}

export const CAD_LAYER_PATTERNS: Record<string, { division: number; category: string; itemKey: string }> = {
  'C-GRAD': { division: 31, category: 'earthwork', itemKey: 'grading-fine' },
  'C-TOPO': { division: 31, category: 'earthwork', itemKey: 'grading-fine' },
  'C-CONT': { division: 31, category: 'earthwork', itemKey: 'grading-fine' },
  'C-PAVE': { division: 32, category: 'paving', itemKey: 'asphalt-paving-4in' },
  'C-CURB': { division: 32, category: 'paving', itemKey: 'concrete-curb-gutter' },
  'C-WALK': { division: 32, category: 'paving', itemKey: 'concrete-sidewalk-4in' },
  'C-PARK': { division: 32, category: 'paving', itemKey: 'parking-stall-striping' },
  'C-STRP': { division: 32, category: 'paving', itemKey: 'pavement-marking' },
  'C-STRM': { division: 33, category: 'utilities', itemKey: 'storm-pipe-12' },
  'C-STOR': { division: 33, category: 'utilities', itemKey: 'storm-pipe-12' },
  'C-DRAI': { division: 33, category: 'utilities', itemKey: 'storm-pipe-12' },
  'C-SSWR': { division: 33, category: 'utilities', itemKey: 'sanitary-pipe-8' },
  'C-SANI': { division: 33, category: 'utilities', itemKey: 'sanitary-pipe-8' },
  'C-WATR': { division: 33, category: 'utilities', itemKey: 'water-main-6' },
  'C-FIRE': { division: 33, category: 'utilities', itemKey: 'fire-hydrant' },
  'C-GAS': { division: 33, category: 'utilities', itemKey: 'gas-pipe-2' },
  'C-ELEC': { division: 33, category: 'utilities', itemKey: 'conduit-underground-2in' },
  'C-POWR': { division: 33, category: 'utilities', itemKey: 'conduit-underground-2in' },
  'L-PLNT': { division: 32, category: 'landscape', itemKey: 'tree-2in-cal' },
  'L-TREE': { division: 32, category: 'landscape', itemKey: 'tree-2in-cal' },
  'L-SHRB': { division: 32, category: 'landscape', itemKey: 'shrub-3gal' },
  'L-MULC': { division: 32, category: 'landscape', itemKey: 'mulch-3in' },
  'L-SOD': { division: 32, category: 'landscape', itemKey: 'sod' },
  'L-SEED': { division: 32, category: 'landscape', itemKey: 'seed-fertilize' },
  'L-IRRI': { division: 32, category: 'landscape', itemKey: 'irrigation-per-sf' },
  'C-EROD': { division: 31, category: 'earthwork', itemKey: 'silt-fence' },
  'C-ESCP': { division: 31, category: 'earthwork', itemKey: 'silt-fence' },
};

export function parseCADLayerName(layerName: string): { division: number; category: string; itemKey: string } | null {
  const upperLayer = layerName.toUpperCase();
  for (const [pattern, mapping] of Object.entries(CAD_LAYER_PATTERNS)) {
    if (upperLayer.startsWith(pattern) || upperLayer.includes(pattern)) return mapping;
  }
  if (upperLayer.includes('GRAD') || upperLayer.includes('TOPO')) return { division: 31, category: 'earthwork', itemKey: 'grading-fine' };
  if (upperLayer.includes('PAVE') || upperLayer.includes('ASPH')) return { division: 32, category: 'paving', itemKey: 'asphalt-paving-4in' };
  if (upperLayer.includes('STORM') || upperLayer.includes('DRAIN')) return { division: 33, category: 'utilities', itemKey: 'storm-pipe-12' };
  if (upperLayer.includes('WATER') || upperLayer.includes('WTR')) return { division: 33, category: 'utilities', itemKey: 'water-main-6' };
  if (upperLayer.includes('SEWER') || upperLayer.includes('SAN')) return { division: 33, category: 'utilities', itemKey: 'sanitary-pipe-8' };
  if (upperLayer.includes('TREE') || upperLayer.includes('PLANT') || upperLayer.includes('LAND')) return { division: 32, category: 'landscape', itemKey: 'tree-2in-cal' };
  return null;
}

export function convertCADToTakeoff(cadData: CADExtractionResult, scaleFactor: number = 1): SiteworkExtractionResult[] {
  const results: SiteworkExtractionResult[] = [];

  for (const layer of cadData.layers) {
    const mapping = parseCADLayerName(layer.name);
    if (!mapping) continue;
    let quantity = 0;
    let unit = 'EA';
    if (layer.totalLength && (mapping.itemKey.includes('pipe') || mapping.itemKey.includes('curb') || mapping.itemKey.includes('fence'))) {
      quantity = layer.totalLength * scaleFactor;
      unit = 'LF';
    } else if (layer.totalArea && (mapping.category === 'paving' || mapping.category === 'earthwork')) {
      quantity = layer.totalArea * scaleFactor * scaleFactor;
      unit = 'SF';
    } else {
      quantity = layer.entityCount;
      unit = 'EA';
    }
    if (quantity > 0) {
      results.push({
        itemName: `${layer.name} - CAD Extract`, description: `Extracted from CAD layer ${layer.name}`,
        quantity: Math.round(quantity * 100) / 100, unit, division: mapping.division,
        category: mapping.category, itemKey: mapping.itemKey, confidence: 85,
        source: 'cad_extraction', derivedFrom: `Layer: ${layer.name}, ${layer.entityCount} entities`
      });
    }
  }

  for (const block of cadData.blocks) {
    const blockUpper = block.name.toUpperCase();
    let mapping: { division: number; category: string; itemKey: string } | null = null;
    let itemName = block.name;
    if (blockUpper.includes('MH') || blockUpper.includes('MANHOLE')) { mapping = { division: 33, category: 'utilities', itemKey: 'manhole-sanitary' }; itemName = 'Manhole'; }
    else if (blockUpper.includes('CB') || blockUpper.includes('CATCH')) { mapping = { division: 33, category: 'utilities', itemKey: 'catch-basin' }; itemName = 'Catch Basin'; }
    else if (blockUpper.includes('FH') || blockUpper.includes('HYD')) { mapping = { division: 33, category: 'utilities', itemKey: 'fire-hydrant' }; itemName = 'Fire Hydrant'; }
    else if (blockUpper.includes('TREE') || blockUpper.includes('DEC') || blockUpper.includes('EVG')) { mapping = { division: 32, category: 'landscape', itemKey: 'tree-2in-cal' }; itemName = 'Tree'; }
    else if (blockUpper.includes('SHRUB')) { mapping = { division: 32, category: 'landscape', itemKey: 'shrub-3gal' }; itemName = 'Shrub'; }
    else if (blockUpper.includes('LIGHT') || blockUpper.includes('POLE')) { mapping = { division: 32, category: 'paving', itemKey: 'light-pole-25ft' }; itemName = 'Light Pole'; }
    if (mapping && block.count > 0) {
      results.push({
        itemName: `${itemName} (Block: ${block.name})`, description: `CAD block count: ${block.count}`,
        quantity: block.count, unit: 'EA', division: mapping.division,
        category: mapping.category, itemKey: mapping.itemKey, confidence: 90, source: 'cad_block_count'
      });
    }
  }
  return results;
}

export async function extractFromDWG(documentId: string, projectId: string): Promise<SiteworkExtractionResult[]> {
  try {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) { log.info('Document not found for CAD extraction', { documentId }); return []; }
    const documentChunks = await prisma.documentChunk.findMany({ where: { documentId }, orderBy: { pageNumber: 'asc' } });
    const cadChunk = documentChunks.find((c: any) => {
      const meta = c.metadata as any;
      return meta?.cadData || meta?.dwgExtraction || meta?.autodeskData;
    });
    if (cadChunk) {
      const cadMeta = (cadChunk.metadata as any);
      const cadData = cadMeta.cadData || cadMeta.dwgExtraction || cadMeta.autodeskData;
      if (cadData) { log.info('Found CAD metadata, extracting quantities'); return convertCADToTakeoff(cadData); }
    }
    const autodeskModel = await prisma.autodeskModel.findFirst({
      where: { projectId, fileName: { contains: document.name.split('.')[0] } }
    }).catch(() => null);
    if (autodeskModel?.extractedMetadata) {
      const extractedData = autodeskModel.extractedMetadata as any;
      if (extractedData.layers || extractedData.blocks) {
        log.info('Found DWG extraction data');
        return convertCADToTakeoff({
          layers: extractedData.layers || [], blocks: extractedData.blocks || [],
          units: extractedData.units || 'feet',
          extents: extractedData.extents || { minX: 0, minY: 0, maxX: 0, maxY: 0 }
        });
      }
    }
    log.info('No CAD data available for extraction');
    return [];
  } catch (error) {
    log.error('Error extracting from DWG', error as Error);
    return [];
  }
}

export async function extractSiteworkFromProjectModels(projectId: string): Promise<SiteworkExtractionResult[]> {
  log.info('Extracting from all project models', { projectId });
  const results: SiteworkExtractionResult[] = [];
  try {
    const dwgModels = await prisma.autodeskModel.findMany({
      where: { projectId, status: 'ready', OR: [{ fileName: { endsWith: '.dwg' } }, { fileName: { endsWith: '.dxf' } }] },
    });
    log.info('Found DWG models', { count: dwgModels.length });
    for (const model of dwgModels) {
      if (!model.extractedMetadata) continue;
      const metadata = model.extractedMetadata as any;
      const fileName = model.fileName.toLowerCase();
      const isSitework = fileName.includes('grading') || fileName.includes('site') || fileName.includes('civil') ||
        fileName.includes('c-') || fileName.includes('l-') || fileName.includes('utility') ||
        fileName.includes('storm') || fileName.includes('paving');
      if (!isSitework) continue;
      log.info('Processing sitework drawing', { fileName: model.fileName });
      if (metadata.layers && Array.isArray(metadata.layers)) {
        for (const layer of metadata.layers) {
          const layerName = layer.name?.toUpperCase() || '';
          const objectCount = layer.objectCount || 0;
          if (layerName.includes('GRAD') || layerName.includes('CONTOUR')) {
            results.push({ itemName: `Grading Elements (${layer.name})`, description: `${objectCount} objects from ${model.fileName}`, quantity: objectCount, unit: 'EA', division: 31, category: 'earthwork', itemKey: 'grading-fine', confidence: 75, source: `dwg:${model.fileName}:layer:${layer.name}` });
          } else if (layerName.includes('PAVE') || layerName.includes('ASPH') || layerName.includes('CONC-PAVE')) {
            results.push({ itemName: `Paving Elements (${layer.name})`, description: `${objectCount} objects from ${model.fileName}`, quantity: objectCount, unit: 'EA', division: 32, category: 'paving', itemKey: 'asphalt-parking', confidence: 75, source: `dwg:${model.fileName}:layer:${layer.name}` });
          } else if (layerName.includes('CURB') || layerName.includes('GUTTER')) {
            results.push({ itemName: `Curb & Gutter (${layer.name})`, description: `${objectCount} objects from ${model.fileName}`, quantity: objectCount, unit: 'LF', division: 32, category: 'paving', itemKey: 'curb-standard', confidence: 70, source: `dwg:${model.fileName}:layer:${layer.name}` });
          } else if (layerName.includes('STORM') || layerName.includes('DRAIN')) {
            results.push({ itemName: `Storm Drainage (${layer.name})`, description: `${objectCount} objects from ${model.fileName}`, quantity: objectCount, unit: 'EA', division: 33, category: 'stormwater', itemKey: 'storm-pipe-rcp', confidence: 70, source: `dwg:${model.fileName}:layer:${layer.name}` });
          } else if (layerName.includes('SEWER') || layerName.includes('SANIT')) {
            results.push({ itemName: `Sanitary Sewer (${layer.name})`, description: `${objectCount} objects from ${model.fileName}`, quantity: objectCount, unit: 'EA', division: 33, category: 'utilities', itemKey: 'sanitary-pipe', confidence: 70, source: `dwg:${model.fileName}:layer:${layer.name}` });
          } else if (layerName.includes('WATER') || layerName.includes('WTR')) {
            results.push({ itemName: `Water Line (${layer.name})`, description: `${objectCount} objects from ${model.fileName}`, quantity: objectCount, unit: 'EA', division: 33, category: 'utilities', itemKey: 'water-main', confidence: 70, source: `dwg:${model.fileName}:layer:${layer.name}` });
          } else if (layerName.includes('ELEC') || layerName.includes('POWER')) {
            results.push({ itemName: `Site Electrical (${layer.name})`, description: `${objectCount} objects from ${model.fileName}`, quantity: objectCount, unit: 'EA', division: 33, category: 'utilities', itemKey: 'electrical-conduit', confidence: 70, source: `dwg:${model.fileName}:layer:${layer.name}` });
          } else if (layerName.includes('LAND') || layerName.includes('PLANT') || layerName.includes('TREE')) {
            results.push({ itemName: `Landscaping (${layer.name})`, description: `${objectCount} objects from ${model.fileName}`, quantity: objectCount, unit: 'EA', division: 32, category: 'landscape', itemKey: 'landscape-general', confidence: 70, source: `dwg:${model.fileName}:layer:${layer.name}` });
          } else if (layerName.includes('SV') || layerName.includes('SURVEY') || layerName.includes('PNTS')) {
            results.push({ itemName: `Survey Points (${layer.name})`, description: `${objectCount} survey points from ${model.fileName}`, quantity: objectCount, unit: 'EA', division: 31, category: 'earthwork', itemKey: 'survey-stake', confidence: 80, source: `dwg:${model.fileName}:layer:${layer.name}` });
          }
        }
      }
      if (metadata.blocks && Array.isArray(metadata.blocks)) {
        for (const block of metadata.blocks) {
          const blockName = block.name?.toUpperCase() || '';
          const count = block.instanceCount || 0;
          if (count === 0) continue;
          if (blockName.includes('TREE')) { results.push({ itemName: `Trees (${block.name})`, description: `${count} tree blocks from ${model.fileName}`, quantity: count, unit: 'EA', division: 32, category: 'landscape', itemKey: 'tree-deciduous', confidence: 85, source: `dwg:${model.fileName}:block:${block.name}` }); }
          else if (blockName.includes('SHRUB') || blockName.includes('PLANT')) { results.push({ itemName: `Shrubs/Plants (${block.name})`, description: `${count} plant blocks from ${model.fileName}`, quantity: count, unit: 'EA', division: 32, category: 'landscape', itemKey: 'shrub-3gal', confidence: 85, source: `dwg:${model.fileName}:block:${block.name}` }); }
          else if (blockName.includes('MH') || blockName.includes('MANHOLE')) { results.push({ itemName: `Manholes (${block.name})`, description: `${count} manhole blocks from ${model.fileName}`, quantity: count, unit: 'EA', division: 33, category: 'utilities', itemKey: 'manhole-48in', confidence: 90, source: `dwg:${model.fileName}:block:${block.name}` }); }
          else if (blockName.includes('CB') || blockName.includes('CATCH')) { results.push({ itemName: `Catch Basins (${block.name})`, description: `${count} catch basin blocks from ${model.fileName}`, quantity: count, unit: 'EA', division: 33, category: 'stormwater', itemKey: 'catch-basin', confidence: 90, source: `dwg:${model.fileName}:block:${block.name}` }); }
          else if (blockName.includes('LIGHT') || blockName.includes('POLE')) { results.push({ itemName: `Light Poles (${block.name})`, description: `${count} light pole blocks from ${model.fileName}`, quantity: count, unit: 'EA', division: 32, category: 'paving', itemKey: 'light-pole-25ft', confidence: 90, source: `dwg:${model.fileName}:block:${block.name}` }); }
          else if (blockName.includes('SIGN')) { results.push({ itemName: `Signs (${block.name})`, description: `${count} sign blocks from ${model.fileName}`, quantity: count, unit: 'EA', division: 32, category: 'paving', itemKey: 'signage', confidence: 85, source: `dwg:${model.fileName}:block:${block.name}` }); }
          else if (blockName.includes('HYDRANT') || blockName.includes('FH')) { results.push({ itemName: `Fire Hydrants (${block.name})`, description: `${count} hydrant blocks from ${model.fileName}`, quantity: count, unit: 'EA', division: 33, category: 'utilities', itemKey: 'fire-hydrant', confidence: 90, source: `dwg:${model.fileName}:block:${block.name}` }); }
          else if (blockName.includes('VALVE') || blockName.includes('GATE')) { results.push({ itemName: `Valves (${block.name})`, description: `${count} valve blocks from ${model.fileName}`, quantity: count, unit: 'EA', division: 33, category: 'utilities', itemKey: 'gate-valve', confidence: 85, source: `dwg:${model.fileName}:block:${block.name}` }); }
        }
      }
    }
    const consolidated = consolidateResults(results);
    log.info('Extracted sitework items from DWG models', { itemCount: consolidated.length });
    return consolidated;
  } catch (error) {
    log.error('Error extracting from project models', error as Error);
    return [];
  }
}
