/**
 * Drawing Type Classification System
 * Automatically categorizes construction drawings using pattern matching and AI vision
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { convertSinglePage } from './pdf-to-image';
import { getFileUrl } from './s3';
import { analyzeWithMultiProvider } from '@/lib/vision-api-multi-provider';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

// Drawing type definitions
export type DrawingType =
  | 'FLOOR_PLAN'
  | 'ELEVATION'
  | 'SECTION'
  | 'DETAIL'
  | 'SCHEDULE'
  | 'SITE_PLAN'
  | 'ROOF_PLAN'
  | 'REFLECTED_CEILING'
  | 'FRAMING_PLAN'
  | 'FOUNDATION_PLAN'
  | 'MECHANICAL'
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'FIRE_PROTECTION'
  | 'STRUCTURAL'
  | 'CIVIL'
  | 'LANDSCAPE'
  | 'DIAGRAM'
  | 'ISOMETRIC'
  | 'AXONOMETRIC'
  | 'PERSPECTIVE'
  | 'RENDERED_VIEW'
  | 'COVER_SHEET'
  | 'SPEC_SHEET'
  | 'EQUIPMENT_LAYOUT'
  | 'LIGHTING_PLAN'
  | 'POWER_PLAN'
  | 'CONTROL_DIAGRAM'
  | 'RISER_DIAGRAM'
  | 'SINGLE_LINE_DIAGRAM'
  | 'UNKNOWN';

// Subtype categories
export type DrawingSubtype =
  | 'ARCHITECTURAL'
  | 'STRUCTURAL'
  | 'MECHANICAL'
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'FIRE_PROTECTION'
  | 'CIVIL'
  | 'LANDSCAPE'
  | 'GENERAL';

export interface DrawingClassification {
  type: DrawingType;
  subtype: DrawingSubtype;
  confidence: number;
  features: string[];
  reasoning: string;
  patterns: string[];
}

export interface DrawingTypeResult {
  sheetNumber: string;
  sheetTitle: string;
  classification: DrawingClassification;
  extractedAt: Date;
}

// Pattern definitions for rule-based classification
const DRAWING_TYPE_PATTERNS: Record<DrawingType, {
  keywords: string[];
  sheetPrefixes: string[];
  titlePatterns: RegExp[];
  exclusions?: string[];
}> = {
  FLOOR_PLAN: {
    keywords: ['floor plan', 'level', 'first floor', 'second floor', 'ground floor', 'typical floor'],
    sheetPrefixes: ['A-1', 'A-2', 'A1', 'A2'],
    titlePatterns: [/floor plan/i, /level \d+/i, /\d+(st|nd|rd|th) floor/i],
    exclusions: ['roof', 'ceiling', 'framing']
  },
  ELEVATION: {
    keywords: ['elevation', 'exterior elevation', 'building elevation', 'north elevation', 'south elevation'],
    sheetPrefixes: ['A-3', 'A-4', 'A3', 'A4'],
    titlePatterns: [/elevation/i, /(north|south|east|west) elev/i]
  },
  SECTION: {
    keywords: ['section', 'building section', 'wall section', 'detail section'],
    sheetPrefixes: ['A-5', 'A-6', 'A5', 'A6', 'A-7'],
    titlePatterns: [/section/i, /sect\./i]
  },
  DETAIL: {
    keywords: ['detail', 'typical detail', 'enlarged detail', 'connection detail'],
    sheetPrefixes: ['A-7', 'A-8', 'A-9', 'A7', 'A8', 'A9'],
    titlePatterns: [/detail/i, /typical/i, /enlarged/i]
  },
  SCHEDULE: {
    keywords: ['schedule', 'door schedule', 'window schedule', 'finish schedule', 'room schedule'],
    sheetPrefixes: ['A-0', 'A0'],
    titlePatterns: [/schedule/i, /(door|window|finish|room) sched/i]
  },
  SITE_PLAN: {
    keywords: ['site plan', 'site layout', 'overall site', 'property line', 'grading plan'],
    sheetPrefixes: ['C-1', 'C-0', 'C1', 'C0', 'L-1'],
    titlePatterns: [/site plan/i, /site layout/i, /grading/i]
  },
  ROOF_PLAN: {
    keywords: ['roof plan', 'roof layout', 'roofing plan'],
    sheetPrefixes: ['A-2', 'A2'],
    titlePatterns: [/roof plan/i, /roof layout/i],
    exclusions: ['framing']
  },
  REFLECTED_CEILING: {
    keywords: ['reflected ceiling', 'ceiling plan', 'rcp'],
    sheetPrefixes: ['A-2', 'E-3', 'A2', 'E3'],
    titlePatterns: [/reflected ceiling/i, /ceiling plan/i, /\bRCP\b/i]
  },
  FRAMING_PLAN: {
    keywords: ['framing plan', 'roof framing', 'floor framing', 'structural framing'],
    sheetPrefixes: ['S-2', 'S-3', 'S2', 'S3'],
    titlePatterns: [/framing plan/i, /(roof|floor) framing/i]
  },
  FOUNDATION_PLAN: {
    keywords: ['foundation plan', 'foundation layout', 'basement plan'],
    sheetPrefixes: ['S-1', 'S1'],
    titlePatterns: [/foundation/i, /basement/i]
  },
  MECHANICAL: {
    keywords: ['hvac', 'mechanical', 'ductwork', 'air handling', 'vav', 'ahu'],
    sheetPrefixes: ['M-', 'M1', 'M2', 'M3'],
    titlePatterns: [/hvac/i, /mechanical/i, /duct/i, /air/i]
  },
  ELECTRICAL: {
    keywords: ['electrical', 'power', 'lighting', 'panel', 'switchboard'],
    sheetPrefixes: ['E-', 'E1', 'E2', 'E3'],
    titlePatterns: [/electrical/i, /power/i, /lighting/i]
  },
  PLUMBING: {
    keywords: ['plumbing', 'domestic water', 'waste', 'sanitary', 'storm drain'],
    sheetPrefixes: ['P-', 'P1', 'P2'],
    titlePatterns: [/plumbing/i, /water/i, /sanitary/i, /waste/i]
  },
  FIRE_PROTECTION: {
    keywords: ['fire protection', 'sprinkler', 'fire alarm', 'suppression'],
    sheetPrefixes: ['FP-', 'FP1', 'F-'],
    titlePatterns: [/fire/i, /sprinkler/i, /suppression/i]
  },
  STRUCTURAL: {
    keywords: ['structural', 'steel', 'concrete', 'beam', 'column', 'reinforcing'],
    sheetPrefixes: ['S-', 'S1', 'S2', 'S3'],
    titlePatterns: [/structural/i, /steel/i, /concrete/i, /reinf/i]
  },
  CIVIL: {
    keywords: ['civil', 'grading', 'utility', 'drainage', 'paving'],
    sheetPrefixes: ['C-', 'C1', 'C2', 'C3'],
    titlePatterns: [/civil/i, /grading/i, /utility/i, /drainage/i]
  },
  LANDSCAPE: {
    keywords: ['landscape', 'planting', 'irrigation', 'hardscape'],
    sheetPrefixes: ['L-', 'L1', 'L2'],
    titlePatterns: [/landscape/i, /planting/i, /irrigation/i]
  },
  DIAGRAM: {
    keywords: ['diagram', 'schematic', 'flow diagram', 'system diagram'],
    sheetPrefixes: [],
    titlePatterns: [/diagram/i, /schematic/i]
  },
  ISOMETRIC: {
    keywords: ['isometric', 'iso view', '3d view'],
    sheetPrefixes: [],
    titlePatterns: [/isometric/i, /iso/i]
  },
  AXONOMETRIC: {
    keywords: ['axonometric', 'axon'],
    sheetPrefixes: [],
    titlePatterns: [/axonometric/i, /axon/i]
  },
  PERSPECTIVE: {
    keywords: ['perspective', 'view'],
    sheetPrefixes: [],
    titlePatterns: [/perspective/i]
  },
  RENDERED_VIEW: {
    keywords: ['rendering', 'rendered view', 'visualization'],
    sheetPrefixes: [],
    titlePatterns: [/rendering/i, /rendered/i, /visualization/i]
  },
  COVER_SHEET: {
    keywords: ['cover sheet', 'index', 'drawing index', 'sheet index'],
    sheetPrefixes: ['A-0.0', 'G-0', 'T-0'],
    titlePatterns: [/cover/i, /index/i, /title sheet/i]
  },
  SPEC_SHEET: {
    keywords: ['specifications', 'notes', 'general notes'],
    sheetPrefixes: ['A-0', 'G-0'],
    titlePatterns: [/spec/i, /notes/i, /legend/i]
  },
  EQUIPMENT_LAYOUT: {
    keywords: ['equipment layout', 'equipment plan', 'kitchen equipment'],
    sheetPrefixes: ['A-', 'M-'],
    titlePatterns: [/equipment/i, /appliance/i]
  },
  LIGHTING_PLAN: {
    keywords: ['lighting plan', 'lighting layout', 'fixture'],
    sheetPrefixes: ['E-2', 'E-3', 'E2', 'E3'],
    titlePatterns: [/lighting/i, /fixture/i]
  },
  POWER_PLAN: {
    keywords: ['power plan', 'receptacle', 'outlet'],
    sheetPrefixes: ['E-1', 'E1'],
    titlePatterns: [/power/i, /receptacle/i, /outlet/i]
  },
  CONTROL_DIAGRAM: {
    keywords: ['control', 'control diagram', 'controls'],
    sheetPrefixes: ['M-', 'E-'],
    titlePatterns: [/control/i]
  },
  RISER_DIAGRAM: {
    keywords: ['riser', 'riser diagram', 'vertical distribution'],
    sheetPrefixes: ['E-', 'M-', 'P-'],
    titlePatterns: [/riser/i, /vertical/i]
  },
  SINGLE_LINE_DIAGRAM: {
    keywords: ['single line', 'one line', 'sld'],
    sheetPrefixes: ['E-'],
    titlePatterns: [/single.?line/i, /one.?line/i, /\bSLD\b/i]
  },
  UNKNOWN: {
    keywords: [],
    sheetPrefixes: [],
    titlePatterns: []
  }
};

// Subtype determination based on discipline
function determineSubtype(type: DrawingType, sheetNumber: string, title: string): DrawingSubtype {
  const disciplinePrefix = sheetNumber.match(/^([A-Z]+)-?/)?.[1]?.toUpperCase();
  
  // Check sheet prefix first
  if (disciplinePrefix) {
    if (disciplinePrefix === 'A') return 'ARCHITECTURAL';
    if (disciplinePrefix === 'S') return 'STRUCTURAL';
    if (disciplinePrefix === 'M') return 'MECHANICAL';
    if (disciplinePrefix === 'E') return 'ELECTRICAL';
    if (disciplinePrefix === 'P') return 'PLUMBING';
    if (disciplinePrefix === 'FP' || disciplinePrefix === 'F') return 'FIRE_PROTECTION';
    if (disciplinePrefix === 'C') return 'CIVIL';
    if (disciplinePrefix === 'L') return 'LANDSCAPE';
  }
  
  // Check title keywords
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('architectural')) return 'ARCHITECTURAL';
  if (lowerTitle.includes('structural')) return 'STRUCTURAL';
  if (lowerTitle.includes('mechanical') || lowerTitle.includes('hvac')) return 'MECHANICAL';
  if (lowerTitle.includes('electrical')) return 'ELECTRICAL';
  if (lowerTitle.includes('plumbing')) return 'PLUMBING';
  if (lowerTitle.includes('fire')) return 'FIRE_PROTECTION';
  if (lowerTitle.includes('civil')) return 'CIVIL';
  if (lowerTitle.includes('landscape')) return 'LANDSCAPE';
  
  // Check drawing type
  if (['MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'FIRE_PROTECTION', 'STRUCTURAL', 'CIVIL', 'LANDSCAPE'].includes(type)) {
    return type as DrawingSubtype;
  }
  
  return 'GENERAL';
}

/**
 * Classify drawing using pattern matching (fast, rule-based)
 */
export function classifyDrawingWithPatterns(
  sheetNumber: string,
  sheetTitle: string
): DrawingClassification {
  const normalizedTitle = sheetTitle.toLowerCase();
  const normalizedSheet = sheetNumber.toUpperCase();
  
  let bestMatch: { type: DrawingType; score: number; patterns: string[] } = {
    type: 'UNKNOWN',
    score: 0,
    patterns: []
  };
  
  // Check each drawing type
  for (const [drawingType, patterns] of Object.entries(DRAWING_TYPE_PATTERNS)) {
    let score = 0;
    const matchedPatterns: string[] = [];
    
    // Check exclusions first
    if (patterns.exclusions) {
      const hasExclusion = patterns.exclusions.some(exc => normalizedTitle.includes(exc));
      if (hasExclusion) continue;
    }
    
    // Check keywords
    for (const keyword of patterns.keywords) {
      if (normalizedTitle.includes(keyword.toLowerCase())) {
        score += 10;
        matchedPatterns.push(`keyword: ${keyword}`);
      }
    }
    
    // Check sheet prefixes
    for (const prefix of patterns.sheetPrefixes) {
      if (normalizedSheet.startsWith(prefix)) {
        score += 15;
        matchedPatterns.push(`sheet prefix: ${prefix}`);
      }
    }
    
    // Check title patterns
    for (const pattern of patterns.titlePatterns) {
      if (pattern.test(normalizedTitle)) {
        score += 12;
        matchedPatterns.push(`title pattern: ${pattern.source}`);
      }
    }
    
    // Update best match
    if (score > bestMatch.score) {
      bestMatch = {
        type: drawingType as DrawingType,
        score,
        patterns: matchedPatterns
      };
    }
  }
  
  const subtype = determineSubtype(bestMatch.type, sheetNumber, sheetTitle);
  const confidence = Math.min(bestMatch.score / 30, 1.0); // Normalize to 0-1
  
  return {
    type: bestMatch.type,
    subtype,
    confidence,
    features: bestMatch.patterns,
    reasoning: `Pattern-based classification using ${bestMatch.patterns.length} matching patterns`,
    patterns: bestMatch.patterns
  };
}

/**
 * Classify drawing using AI vision (more accurate but slower)
 */
export async function classifyDrawingWithVision(
  imagePath: string,
  sheetNumber: string,
  sheetTitle: string
): Promise<DrawingClassification> {
  try {
    // Get pattern-based classification first
    const patternClassification = classifyDrawingWithPatterns(sheetNumber, sheetTitle);
    
    // If pattern-based classification is highly confident, use it
    if (patternClassification.confidence >= 0.8) {
      return patternClassification;
    }
    
    // Otherwise, use vision for more accuracy
    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

    const prompt = `Analyze this construction drawing and classify it.

Sheet Number: ${sheetNumber}
Sheet Title: ${sheetTitle}

Available drawing types:
- FLOOR_PLAN: Plans showing room layouts, walls, doors, windows
- ELEVATION: Exterior or interior vertical views
- SECTION: Cut-through views showing construction details
- DETAIL: Enlarged views of specific connections or elements
- SCHEDULE: Tables listing doors, windows, finishes, etc.
- SITE_PLAN: Overall property layout with buildings, parking, utilities
- ROOF_PLAN: Roofing layout and drainage
- REFLECTED_CEILING: Ceiling plan showing lights, HVAC, etc.
- FRAMING_PLAN: Structural framing layout
- FOUNDATION_PLAN: Foundation layout and details
- MECHANICAL: HVAC systems and ductwork
- ELECTRICAL: Power, lighting, and electrical systems
- PLUMBING: Water supply and drainage systems
- FIRE_PROTECTION: Sprinkler and fire alarm systems
- STRUCTURAL: Structural elements (beams, columns, etc.)
- CIVIL: Site grading, utilities, drainage
- LANDSCAPE: Planting and irrigation
- DIAGRAM: System diagrams (riser, single-line, control)
- ISOMETRIC: 3D isometric views
- COVER_SHEET: Title sheet or drawing index
- SPEC_SHEET: Specifications or general notes
- EQUIPMENT_LAYOUT: Equipment placement plans
- OTHER: If none of the above fit

Return a JSON object with:
{
  "type": "<DrawingType>",
  "subtype": "<ARCHITECTURAL|STRUCTURAL|MECHANICAL|ELECTRICAL|PLUMBING|FIRE_PROTECTION|CIVIL|LANDSCAPE|GENERAL>",
  "confidence": <0.0-1.0>,
  "features": ["list of visual features that led to classification"],
  "reasoning": "<explanation of classification decision>"
}`;

    const data = await analyzeWithMultiProvider(imageBase64, prompt);
    const content = data.success ? data.content : null;

    if (!content) {
      return patternClassification;
    }
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return patternClassification;
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      type: result.type || patternClassification.type,
      subtype: result.subtype || patternClassification.subtype,
      confidence: result.confidence || patternClassification.confidence,
      features: result.features || [],
      reasoning: result.reasoning || 'Vision-based classification',
      patterns: [`Vision AI: ${result.type}`]
    };
    
  } catch (error) {
    logger.error('DRAWING_CLASSIFIER', 'Vision classification error', error as Error);
    // Fall back to pattern-based classification
    return classifyDrawingWithPatterns(sheetNumber, sheetTitle);
  }
}

/**
 * Classify all drawings in a project
 */
export async function classifyProjectDrawings(
  projectSlug: string,
  options: { forceReprocess?: boolean; useVision?: boolean } = {}
): Promise<DrawingTypeResult[]> {
  const { forceReprocess: _forceReprocess = false, useVision = false } = options;
  
  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        Document: {
          where: {
            processed: true,
            fileType: 'application/pdf'
          }
        }
      }
    });
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Get all sheets with title block data
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          projectId: project.id
        },
        sheetNumber: { not: null as any },
        titleBlockData: { not: null as any }
      },
      select: {
        id: true,
        documentId: true,
        sheetNumber: true,
        titleBlockData: true,
        content: true
      },
      distinct: ['sheetNumber']
    });
    
    const results: DrawingTypeResult[] = [];
    
    for (const chunk of chunks) {
      const titleBlockData = chunk.titleBlockData as any;
      const sheetTitle = titleBlockData?.sheetTitle || titleBlockData?.title || 'Untitled';
      const sheetNumber = chunk.sheetNumber ?? 'Unknown';
      
      let classification: DrawingClassification;
      
      if (useVision && chunk.documentId) {
        // Convert PDF page to image for vision analysis
        const document = await prisma.document.findUnique({
          where: { id: chunk.documentId as string }
        });
        
        if (document?.cloud_storage_path) {
          try {
            // Download PDF from S3 and convert to image using pure JS
            const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
            const response = await fetch(fileUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            
            // Convert first page to image
            const { base64: _imageBase64 } = await convertSinglePage(buffer, 1, 2048);

            // Use pattern-based classification (vision classification requires file path)
            // For now, fall back to pattern-based until we update classifyDrawingWithVision
            classification = classifyDrawingWithPatterns(sheetNumber, sheetTitle);
          } catch (error) {
            logger.error('DRAWING_CLASSIFIER', 'Vision classification failed', error as Error);
            classification = classifyDrawingWithPatterns(sheetNumber, sheetTitle);
          }
        } else {
          classification = classifyDrawingWithPatterns(sheetNumber, sheetTitle);
        }
      } else {
        // Use fast pattern-based classification
        classification = classifyDrawingWithPatterns(sheetNumber, sheetTitle);
      }
      
      results.push({
        sheetNumber,
        sheetTitle,
        classification,
        extractedAt: new Date()
      });
      
      // Store in database (only if documentId exists)
      if (chunk.documentId) {
        await storeDrawingClassification(project.id, chunk.documentId, sheetNumber, classification);
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error('DRAWING_CLASSIFIER', 'Error classifying drawings', error as Error);
    throw error;
  }
}

/**
 * Store drawing classification in database
 */
export async function storeDrawingClassification(
  projectId: string,
  documentId: string,
  sheetNumber: string,
  classification: DrawingClassification
): Promise<void> {
  try {
    await prisma.drawingType.upsert({
      where: {
        projectId_documentId_sheetNumber: {
          projectId,
          documentId,
          sheetNumber
        }
      },
      update: {
        type: classification.type,
        subtype: classification.subtype,
        confidence: classification.confidence,
        features: classification.features,
        reasoning: classification.reasoning,
        patterns: classification.patterns
      },
      create: {
        projectId,
        documentId,
        sheetNumber,
        type: classification.type,
        subtype: classification.subtype,
        confidence: classification.confidence,
        features: classification.features,
        reasoning: classification.reasoning,
        patterns: classification.patterns
      }
    });
  } catch (error) {
    logger.error('DRAWING_CLASSIFIER', 'Error storing drawing classification', error as Error);
    throw error;
  }
}

/**
 * Get drawing classifications for a project
 */
export async function getProjectDrawingTypes(
  projectSlug: string,
  filters?: {
    type?: DrawingType;
    subtype?: DrawingSubtype;
    minConfidence?: number;
  }
): Promise<DrawingTypeResult[]> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug }
    });
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    const where: any = { projectId: project.id };
    
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.subtype) {
      where.subtype = filters.subtype;
    }
    if (filters?.minConfidence) {
      where.confidence = { gte: filters.minConfidence };
    }
    
    const classifications = await prisma.drawingType.findMany({
      where,
      orderBy: { sheetNumber: 'asc' }
    });
    
    return classifications.map((c: any) => ({
      sheetNumber: c.sheetNumber,
      sheetTitle: '', // Would need to join with chunks to get this
      classification: {
        type: c.type as DrawingType,
        subtype: c.subtype as DrawingSubtype,
        confidence: c.confidence,
        features: c.features as string[],
        reasoning: c.reasoning,
        patterns: c.patterns as string[]
      },
      extractedAt: c.extractedAt
    }));
  } catch (error) {
    logger.error('DRAWING_CLASSIFIER', 'Error getting drawing types', error as Error);
    throw error;
  }
}

/**
 * Get drawing type statistics for a project
 */
export async function getDrawingTypeStats(projectSlug: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug }
    });
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    const classifications = await prisma.drawingType.findMany({
      where: { projectId: project.id }
    });
    
    // Group by type
    const byType: Record<string, number> = {};
    const bySubtype: Record<string, number> = {};
    let totalConfidence = 0;
    
    for (const c of classifications) {
      byType[c.type] = (byType[c.type] || 0) + 1;
      bySubtype[c.subtype] = (bySubtype[c.subtype] || 0) + 1;
      totalConfidence += c.confidence;
    }
    
    return {
      total: classifications.length,
      byType,
      bySubtype,
      averageConfidence: classifications.length > 0 ? totalConfidence / classifications.length : 0,
      lastUpdated: classifications[0]?.extractedAt
    };
  } catch (error) {
    logger.error('DRAWING_CLASSIFIER', 'Error getting drawing type stats', error as Error);
    throw error;
  }
}
