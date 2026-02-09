/**
 * Document Intelligence Router
 * Routes uploaded documents to appropriate processors and manages data source priority
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Data source confidence levels (higher = more accurate)
export const DATA_SOURCE_PRIORITY = {
  dwg: 100,      // CAD files - most accurate
  rvt: 95,       // Revit files
  ifc: 90,       // IFC/BIM files
  pdf_cad: 80,   // PDF exported from CAD
  pdf_scan: 60,  // Scanned PDF
  xlsx: 70,      // Excel spreadsheets
  docx: 50,      // Word documents
  manual: 40,    // Manual entry
} as const;

export type DataSourceType = keyof typeof DATA_SOURCE_PRIORITY;

export interface DocumentIntelligence {
  documentId: string;
  projectId: string;
  fileName: string;
  fileType: string;
  category: string | null;
  sourceType: DataSourceType;
  confidence: number;
  extractedFeatures: string[];
}

// Feature types that can be extracted from documents
export type FeatureType = 
  | 'scale'
  | 'dimensions'
  | 'rooms'
  | 'doors'
  | 'windows'
  | 'mep_electrical'
  | 'mep_plumbing'
  | 'mep_hvac'
  | 'budget'
  | 'schedule'
  | 'legends'
  | 'title_blocks'
  | 'materials';

// Map document categories to extractable features
const CATEGORY_FEATURES: Record<string, FeatureType[]> = {
  'architectural_plans': ['scale', 'dimensions', 'rooms', 'doors', 'windows', 'legends', 'title_blocks'],
  'structural_plans': ['scale', 'dimensions', 'materials', 'legends'],
  'mep_drawings': ['scale', 'mep_electrical', 'mep_plumbing', 'mep_hvac', 'legends'],
  'electrical_plans': ['scale', 'mep_electrical', 'legends'],
  'plumbing_plans': ['scale', 'mep_plumbing', 'legends'],
  'hvac_plans': ['scale', 'mep_hvac', 'legends'],
  'site_plans': ['scale', 'dimensions', 'legends'],
  'budget_cost': ['budget', 'materials'],
  'schedule': ['schedule'],
  'specifications': ['materials'],
  'door_schedule': ['doors'],
  'window_schedule': ['windows'],
  'finish_schedule': ['materials', 'rooms'],
};

/**
 * Determine data source type from file extension and content
 */
export function determineSourceType(fileName: string, category?: string | null): DataSourceType {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (ext === 'dwg' || ext === 'dxf') return 'dwg';
  if (ext === 'rvt' || ext === 'rfa') return 'rvt';
  if (ext === 'ifc') return 'ifc';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  
  // For PDFs, check if it's likely from CAD or scanned
  if (ext === 'pdf') {
    // Plans/drawings are likely CAD exports
    if (category && (category.includes('plan') || category.includes('drawing'))) {
      return 'pdf_cad';
    }
    return 'pdf_scan';
  }
  
  return 'manual';
}

/**
 * Get features that can be extracted from a document
 */
export function getExtractableFeatures(category: string | null, fileName: string): FeatureType[] {
  const features: FeatureType[] = [];
  
  // Check by category
  if (category && CATEGORY_FEATURES[category]) {
    features.push(...CATEGORY_FEATURES[category]);
  }
  
  // Check by filename patterns
  const lowerName = fileName.toLowerCase();
  
  if (/budget|cost|estimate/i.test(lowerName)) features.push('budget');
  if (/schedule|timeline|gantt/i.test(lowerName)) features.push('schedule');
  if (/door/i.test(lowerName)) features.push('doors');
  if (/window/i.test(lowerName)) features.push('windows');
  if (/electrical|elec|power/i.test(lowerName)) features.push('mep_electrical');
  if (/plumbing|plumb|water|sanitary/i.test(lowerName)) features.push('mep_plumbing');
  if (/hvac|mechanical|heating|cooling/i.test(lowerName)) features.push('mep_hvac');
  if (/floor.*plan|arch.*plan|layout/i.test(lowerName)) {
    features.push('rooms', 'scale', 'dimensions');
  }
  
  // DWG files always have accurate scale
  if (/\.dwg$/i.test(lowerName)) {
    features.push('scale', 'dimensions');
  }
  
  return [...new Set(features)]; // Remove duplicates
}

/**
 * Check if a new data source should override existing data
 */
export async function shouldOverrideExisting(
  projectId: string,
  feature: FeatureType,
  newSourceType: DataSourceType
): Promise<{ shouldOverride: boolean; existingSource?: string; existingConfidence?: number }> {
  // Check existing data source for this feature
  const existing = await prisma.projectDataSource.findFirst({
    where: {
      projectId,
      featureType: feature,
    },
    orderBy: { confidence: 'desc' },
  });
  
  if (!existing) {
    return { shouldOverride: true };
  }
  
  const newConfidence = DATA_SOURCE_PRIORITY[newSourceType];
  
  return {
    shouldOverride: newConfidence > existing.confidence,
    existingSource: existing.sourceType,
    existingConfidence: existing.confidence,
  };
}

/**
 * Record a data source for a feature
 */
export async function recordDataSource(
  projectId: string,
  documentId: string,
  feature: FeatureType,
  sourceType: DataSourceType,
  metadata?: Record<string, any>
): Promise<void> {
  const confidence = DATA_SOURCE_PRIORITY[sourceType];
  
  await prisma.projectDataSource.upsert({
    where: {
      projectId_featureType: {
        projectId,
        featureType: feature,
      },
    },
    create: {
      projectId,
      documentId,
      featureType: feature,
      sourceType,
      confidence,
      metadata: metadata || {},
      extractedAt: new Date(),
    },
    update: {
      documentId,
      sourceType,
      confidence,
      metadata: metadata || {},
      extractedAt: new Date(),
    },
  });
}

/**
 * Get all data sources for a project
 */
export async function getProjectDataSources(projectId: string) {
  return prisma.projectDataSource.findMany({
    where: { projectId },
    include: {
      Document: {
        select: { id: true, fileName: true, category: true },
      },
    },
    orderBy: { featureType: 'asc' },
  });
}

/**
 * Route document to appropriate processors
 */
export async function routeDocumentToProcessors(
  documentId: string,
  projectId: string,
  fileName: string,
  category: string | null
): Promise<{ features: FeatureType[]; triggered: string[] }> {
  const sourceType = determineSourceType(fileName, category);
  const features = getExtractableFeatures(category, fileName);
  const triggered: string[] = [];
  
  logger.info('DOC_INTELLIGENCE_ROUTER', 'Routing document', { fileName, sourceType, features: features.join(', ') });
  
  for (const feature of features) {
    const { shouldOverride, existingSource, existingConfidence } = 
      await shouldOverrideExisting(projectId, feature, sourceType);
    
    if (shouldOverride) {
      logger.info('DOC_INTELLIGENCE_ROUTER', 'Upgrading data source', { feature, existingSource: existingSource || 'none', existingConfidence: existingConfidence || 0, newSource: sourceType, newConfidence: DATA_SOURCE_PRIORITY[sourceType] });
      triggered.push(feature);
      
      // Record the new data source
      await recordDataSource(projectId, documentId, feature, sourceType);
    } else {
      logger.info('DOC_INTELLIGENCE_ROUTER', 'Keeping existing data source', { feature, existingSource, existingConfidence, newSource: sourceType, newConfidence: DATA_SOURCE_PRIORITY[sourceType] });
    }
  }
  
  return { features, triggered };
}
