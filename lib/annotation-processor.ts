/**
 * Enhanced Annotation Processing System
 *
 * Extracts and categorizes construction notes, requirements, and
 * annotations by priority level and type.
 *
 * Phase B.3 - Document Intelligence Roadmap
 *
 * NOTE: Updated Feb 2026 to support both image and PDF input.
 * PDF input is automatically detected and handled by vision APIs.
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { logger } from './logger';

/**
 * Detect if base64 content is a PDF (starts with %PDF- magic number)
 */
function isPdfContent(base64: string): boolean {
  // PDF magic number in base64: "JVBERi" which is %PDF-
  return base64.startsWith('JVBERi') || base64.substring(0, 20).includes('JVBERi');
}

/**
 * Build content array for vision API request, handling both image and PDF input
 */
function buildVisionContent(prompt: string, base64Data: string): any[] {
  const isPdf = isPdfContent(base64Data);

  if (isPdf) {
    // PDF content - use file type for APIs that support it
    return [
      { type: 'text', text: prompt },
      {
        type: 'file',
        file: {
          filename: 'page.pdf',
          file_data: `data:application/pdf;base64,${base64Data}`,
        },
      }
    ];
  } else {
    // Image content
    return [
      { type: 'text', text: prompt },
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64Data}` }
      }
    ];
  }
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Annotation {
  id: string;
  text: string;
  type: AnnotationType;
  priority: AnnotationPriority;
  category: AnnotationCategory;
  location?: string;           // Description of location
  relatedElements?: string[];  // Related elements (e.g., "Wall A-1", "Room 102")
  tags: string[];              // Keywords for search
  confidence: number;          // 0-1 extraction confidence
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type AnnotationType =
  | 'note'
  | 'requirement'
  | 'specification'
  | 'warning'
  | 'reference'
  | 'instruction';

export type AnnotationPriority =
  | 'critical'   // Safety, code compliance, must-do
  | 'important'  // Quality, functionality, should-do
  | 'info';      // General information, nice-to-know

export type AnnotationCategory =
  | 'safety'
  | 'code_compliance'
  | 'structural'
  | 'architectural'
  | 'mechanical'
  | 'electrical'
  | 'plumbing'
  | 'fire_protection'
  | 'accessibility'
  | 'quality'
  | 'material'
  | 'installation'
  | 'coordination'
  | 'general';

export interface AnnotationSummary {
  totalAnnotations: number;
  byPriority: Record<AnnotationPriority, number>;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  criticalAlerts: Annotation[];
}

// ============================================================================
// PRIORITY KEYWORDS
// ============================================================================

const CRITICAL_KEYWORDS = [
  'must', 'shall', 'required', 'mandatory',
  'safety', 'code', 'fire', 'structural',
  'egress', 'life safety', 'critical',
  'do not', 'danger', 'warning', 'caution',
  'per code', 'as per', 'comply',
];

const IMPORTANT_KEYWORDS = [
  'should', 'recommended', 'verify',
  'coordinate', 'quality', 'spec',
  'submit', 'approval', 'field verify',
  'coordinate with', 'match',
];

const CATEGORY_KEYWORDS: Record<AnnotationCategory, string[]> = {
  safety: ['safety', 'osha', 'ppe', 'hazard', 'danger', 'caution', 'warning'],
  code_compliance: ['code', 'ibc', 'nfpa', 'ada', 'comply', 'per code'],
  structural: ['structural', 'load', 'beam', 'column', 'foundation', 'reinforcement'],
  architectural: ['architectural', 'finish', 'door', 'window', 'ceiling', 'floor'],
  mechanical: ['hvac', 'duct', 'vent', 'mechanical', 'air handler', 'fan'],
  electrical: ['electrical', 'power', 'lighting', 'circuit', 'panel', 'conduit'],
  plumbing: ['plumbing', 'pipe', 'drain', 'water', 'sewer', 'fixture'],
  fire_protection: ['fire', 'sprinkler', 'fire alarm', 'smoke', 'suppression'],
  accessibility: ['ada', 'accessible', 'accessibility', 'grab bar', 'ramp'],
  quality: ['quality', 'tolerance', 'finish', 'submit', 'sample', 'mock-up'],
  material: ['material', 'spec', 'specification', 'manufacturer', 'product'],
  installation: ['install', 'installation', 'mounting', 'fastener', 'anchor'],
  coordination: ['coordinate', 'field verify', 'verify', 'check', 'confirm'],
  general: [],
};

// ============================================================================
// ANNOTATION EXTRACTION
// ============================================================================

/**
 * Extract annotations from text using pattern matching and keywords
 */
export function extractAnnotationsFromText(
  text: string,
  sheetNumber: string
): Annotation[] {
  const annotations: Annotation[] = [];
  
  // Split text into lines/sentences
  const lines = text.split(/[\r\n]+/).filter(line => line.trim().length > 20);
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip if too short or looks like a dimension
    if (trimmed.length < 10 || /^[0-9\s'"-\/]+$/.test(trimmed)) {
      continue;
    }

    // Determine priority
    const priority = determinePriority(trimmed);
    
    // Determine type
    const type = determineAnnotationType(trimmed);
    
    // Determine category
    const category = determineCategory(trimmed);
    
    // Extract tags
    const tags = extractTags(trimmed);

    annotations.push({
      id: generateId(),
      text: trimmed,
      type,
      priority,
      category,
      tags,
      confidence: 0.75, // Pattern-based confidence
    });
  }

  return annotations;
}

/**
 * Extract annotations using GPT-4o Vision
 * Supports both image and PDF input (auto-detected)
 */
export async function extractAnnotationsWithVision(
  base64Data: string,
  sheetNumber: string
): Promise<Annotation[]> {
  const prompt = `Analyze this construction drawing and extract ALL text annotations, notes, and requirements.

Look for:
1. General notes and construction requirements
2. Material specifications and standards
3. Safety warnings and code compliance notes
4. Installation instructions
5. Coordination requirements
6. Quality control notes

For EACH annotation found, provide:
- Complete text of the annotation
- Type (note/requirement/specification/warning/reference/instruction)
- Priority level (critical/important/info)
  - CRITICAL: Safety, code compliance, structural, "must", "shall", "required"
  - IMPORTANT: Quality, coordination, "should", "verify"
  - INFO: General information, reference notes
- Category (safety/code_compliance/structural/etc.)
- Location on drawing (if identifiable)
- Related elements (walls, rooms, equipment, etc.)
- Keywords/tags for search

Return as JSON:
{
  "annotations": [
    {
      "text": "All structural steel to comply with AISC specifications",
      "type": "requirement",
      "priority": "critical",
      "category": "structural",
      "location": "General notes, upper left",
      "relatedElements": ["structural steel"],
      "tags": ["steel", "aisc", "specification", "compliance"],
      "confidence": 0.95
    }
  ]
}`;

  try {
    const response = await callAbacusLLM(
      [
        {
          role: 'user',
          content: buildVisionContent(prompt, base64Data)
        }
      ],
      {
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      }
    );

    // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
    let contentToParse = response.content;
    const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      contentToParse = jsonMatch[1].trim();
    }

    const result = JSON.parse(contentToParse);
    
    return (result.annotations || []).map((a: any) => ({
      id: generateId(),
      text: a.text,
      type: a.type || 'note',
      priority: a.priority || 'info',
      category: a.category || 'general',
      location: a.location,
      relatedElements: a.relatedElements || [],
      tags: a.tags || [],
      confidence: a.confidence || 0.85,
      boundingBox: a.boundingBox,
    }));
  } catch (error) {
    logger.error('ANNOTATION_PROCESSOR', 'Vision annotation extraction failed', error as Error);
    return [];
  }
}

// ============================================================================
// CLASSIFICATION HELPERS
// ============================================================================

function determinePriority(text: string): AnnotationPriority {
  const lower = text.toLowerCase();
  
  // Check for critical keywords
  for (const keyword of CRITICAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'critical';
    }
  }
  
  // Check for important keywords
  for (const keyword of IMPORTANT_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'important';
    }
  }
  
  return 'info';
}

function determineAnnotationType(text: string): AnnotationType {
  const lower = text.toLowerCase();
  
  if (lower.includes('warning') || lower.includes('caution') || lower.includes('danger')) {
    return 'warning';
  }
  
  if (lower.includes('spec') || lower.includes('material') || lower.includes('per')) {
    return 'specification';
  }
  
  if (lower.includes('see') || lower.includes('refer') || lower.includes('detail')) {
    return 'reference';
  }
  
  if (lower.includes('shall') || lower.includes('must') || lower.includes('required')) {
    return 'requirement';
  }
  
  if (lower.includes('install') || lower.includes('mount') || lower.includes('provide')) {
    return 'instruction';
  }
  
  return 'note';
}

function determineCategory(text: string): AnnotationCategory {
  const lower = text.toLowerCase();
  
  // Count keyword matches for each category
  const scores: Record<string, number> = {};
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = keywords.filter(kw => lower.includes(kw)).length;
  }
  
  // Find category with highest score
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'general';
  
  const bestCategory = Object.keys(scores).find(cat => scores[cat] === maxScore);
  return (bestCategory as AnnotationCategory) || 'general';
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  const lower = text.toLowerCase();
  
  // Extract common construction terms
  const terms = [
    'code', 'spec', 'verify', 'coordinate', 'install',
    'steel', 'concrete', 'wood', 'metal', 'glass',
    'hvac', 'electrical', 'plumbing', 'fire',
    'wall', 'floor', 'ceiling', 'roof', 'door', 'window',
  ];
  
  for (const term of terms) {
    if (lower.includes(term)) {
      tags.add(term);
    }
  }
  
  return Array.from(tags);
}

function generateId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store annotations in database
 */
export async function storeAnnotations(
  projectId: string,
  documentId: string,
  sheetNumber: string,
  annotations: Annotation[]
): Promise<void> {
  // Check if record exists
  const existing = await prisma.enhancedAnnotation.findUnique({
    where: {
      projectId_documentId_sheetNumber: {
        projectId,
        documentId,
        sheetNumber,
      },
    },
  });

  const data = {
    projectId,
    documentId,
    sheetNumber,
    annotations: annotations as any,
    confidence: annotations.length > 0
      ? annotations.reduce((sum, a) => sum + a.confidence, 0) / annotations.length
      : 0,
  };

  if (existing) {
    await prisma.enhancedAnnotation.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.enhancedAnnotation.create({ data });
  }
}

/**
 * Get annotation summary for a project
 */
export async function getAnnotationSummary(
  projectId: string
): Promise<AnnotationSummary> {
  const records = await prisma.enhancedAnnotation.findMany({
    where: { projectId },
  });

  const allAnnotations: Annotation[] = [];
  
  for (const record of records) {
    const anns = record.annotations as any;
    if (Array.isArray(anns)) {
      allAnnotations.push(...anns);
    }
  }

  const byPriority: Record<AnnotationPriority, number> = {
    critical: 0,
    important: 0,
    info: 0,
  };

  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const criticalAlerts: Annotation[] = [];

  for (const ann of allAnnotations) {
    byPriority[ann.priority]++;
    byCategory[ann.category] = (byCategory[ann.category] || 0) + 1;
    byType[ann.type] = (byType[ann.type] || 0) + 1;
    
    if (ann.priority === 'critical') {
      criticalAlerts.push(ann);
    }
  }

  return {
    totalAnnotations: allAnnotations.length,
    byPriority,
    byCategory,
    byType,
    criticalAlerts: criticalAlerts.slice(0, 10), // Top 10
  };
}

/**
 * Search annotations by text, tags, or category
 */
export async function searchAnnotations(
  projectId: string,
  query: {
    text?: string;
    priority?: AnnotationPriority;
    category?: AnnotationCategory;
    tags?: string[];
  }
): Promise<Annotation[]> {
  const records = await prisma.enhancedAnnotation.findMany({
    where: { projectId },
  });

  const allAnnotations: Annotation[] = [];
  
  for (const record of records) {
    const anns = record.annotations as any;
    if (Array.isArray(anns)) {
      allAnnotations.push(...anns);
    }
  }

  // Filter annotations
  return allAnnotations.filter(ann => {
    if (query.text && !ann.text.toLowerCase().includes(query.text.toLowerCase())) {
      return false;
    }
    
    if (query.priority && ann.priority !== query.priority) {
      return false;
    }
    
    if (query.category && ann.category !== query.category) {
      return false;
    }
    
    if (query.tags && query.tags.length > 0) {
      const hasTag = query.tags.some(tag => 
        ann.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasTag) return false;
    }
    
    return true;
  });
}
