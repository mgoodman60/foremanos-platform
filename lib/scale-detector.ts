/**
 * Scale Detection & Validation System
 * Phase A.3: Automatically extracts, validates, and manages drawing scales
 * 
 * Features:
 * - Multiple scale extraction methods (Vision API + Pattern matching)
 * - Support for architectural (1/4"=1'-0") and metric (1:100) scales
 * - Multiple scales per sheet handling
 * - Scale validation and consistency checking
 * - Accurate quantity takeoffs
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from './db';

/**
 * Supported scale formats
 */
export type ScaleFormat = 'architectural' | 'engineering' | 'metric' | 'custom';

/**
 * Scale representation
 */
export interface DrawingScale {
  scaleString: string;          // Original scale text (e.g., "1/4\"=1'-0\"")
  scaleRatio: number;           // Numerical ratio (e.g., 48 for 1/4"=1'-0")
  format: ScaleFormat;          // Scale format type
  isMultiple: boolean;          // True if multiple scales on sheet
  viewportName?: string;        // Optional viewport/detail name
  confidence: number;           // Detection confidence (0-1)
}

/**
 * Sheet scale data
 */
export interface SheetScaleData {
  sheetNumber: string;
  primaryScale: DrawingScale;
  secondaryScales?: DrawingScale[];
  hasMultipleScales: boolean;
  scaleCount: number;
  extractedFrom: 'titleBlock' | 'viewport' | 'annotation';
  confidence: number;
}

/**
 * Scale validation issue
 */
export interface ScaleValidationIssue {
  sheetNumber: string;
  issueType: 'missing' | 'inconsistent' | 'unusual' | 'multiple';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

/**
 * Common architectural scales (Imperial)
 * Format: "1/4\"=1'-0\"" → 48 (48 inches per 1 inch on drawing)
 */
const ARCHITECTURAL_SCALES: Record<string, number> = {
  '1"=1\'': 12,          // 1" = 1 foot
  '3/4"=1\'': 16,        // 3/4" = 1 foot
  '1/2"=1\'': 24,        // 1/2" = 1 foot  
  '3/8"=1\'': 32,        // 3/8" = 1 foot
  '1/4"=1\'': 48,        // 1/4" = 1 foot (most common)
  '3/16"=1\'': 64,       // 3/16" = 1 foot
  '1/8"=1\'': 96,        // 1/8" = 1 foot
  '3/32"=1\'': 128,      // 3/32" = 1 foot
  '1/16"=1\'': 192,      // 1/16" = 1 foot
  '1/32"=1\'': 384,      // 1/32" = 1 foot
  '1/64"=1\'': 768,      // 1/64" = 1 foot
};

/**
 * Common engineering scales (Imperial)
 * Format: "1\"=10'" → 120 (120 inches per 1 inch on drawing)
 */
const ENGINEERING_SCALES: Record<string, number> = {
  '1"=10\'': 120,        // 1" = 10 feet
  '1"=20\'': 240,        // 1" = 20 feet
  '1"=30\'': 360,        // 1" = 30 feet
  '1"=40\'': 480,        // 1" = 40 feet
  '1"=50\'': 600,        // 1" = 50 feet
  '1"=60\'': 720,        // 1" = 60 feet
  '1"=100\'': 1200,      // 1" = 100 feet
};

/**
 * Common metric scales
 * Format: "1:100" → 100 (100 units per 1 unit on drawing)
 */
const METRIC_SCALES: Record<string, number> = {
  '1:1': 1,
  '1:5': 5,
  '1:10': 10,
  '1:20': 20,
  '1:25': 25,
  '1:50': 50,
  '1:100': 100,
  '1:200': 200,
  '1:500': 500,
  '1:1000': 1000,
};

/**
 * Detect scales from image using GPT-4o Vision
 */
export async function detectScalesWithVision(
  imageBase64: string,
  sheetNumber?: string
): Promise<{
  success: boolean;
  scales: DrawingScale[];
  extractedFrom: 'titleBlock' | 'viewport' | 'annotation';
  confidence: number;
}> {
  try {
    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) {
      throw new Error('ABACUSAI_API_KEY not configured');
    }

    const prompt = `Analyze this construction drawing and extract ALL scales.

**CRITICAL INSTRUCTIONS:**
1. Look in the TITLE BLOCK for the primary scale
2. Look for VIEWPORT/DETAIL SCALES throughout the drawing
3. Extract EXACT scale text as it appears

**Scale Formats to Recognize:**
- Architectural: 1/4"=1'-0", 1/8"=1'-0", 3/16"=1'-0"
- Engineering: 1"=10', 1"=20', 1"=50'
- Metric: 1:100, 1:50, 1:200
- Text variations: "SCALE: 1/4\"=1'-0\"", "Scale 1:100", "NTS" (Not To Scale)

**Multiple Scales:**
If you find multiple scales on the sheet, extract:
- The PRIMARY scale from title block
- ALL secondary scales with their viewport/detail names

**Return JSON Format:**
{
  "scales": [
    {
      "scaleString": "1/4\"=1'-0\"",
      "format": "architectural",
      "isMultiple": false,
      "viewportName": null,
      "confidence": 0.95
    },
    {
      "scaleString": "1/8\"=1'-0\"",
      "format": "architectural",
      "isMultiple": true,
      "viewportName": "DETAIL A",
      "confidence": 0.90
    }
  ],
  "extractedFrom": "titleBlock",
  "overallConfidence": 0.92
}

**Special Cases:**
- "NTS" or "NOT TO SCALE" → scaleString: "NTS", format: "custom", confidence: 1.0
- "AS NOTED" → scaleString: "AS NOTED", format: "custom", confidence: 1.0
- If no scale found → empty scales array, confidence: 0.0`;

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Vision API response');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Convert to DrawingScale format
    const scales: DrawingScale[] = result.scales.map((s: any) => ({
      scaleString: s.scaleString,
      scaleRatio: parseScaleString(s.scaleString).ratio,
      format: s.format,
      isMultiple: s.isMultiple,
      viewportName: s.viewportName,
      confidence: s.confidence,
    }));

    return {
      success: true,
      scales,
      extractedFrom: result.extractedFrom || 'titleBlock',
      confidence: result.overallConfidence || 0.8,
    };
  } catch (error) {
    console.error('Scale detection error:', error);
    return {
      success: false,
      scales: [],
      extractedFrom: 'titleBlock',
      confidence: 0,
    };
  }
}

/**
 * Extract scales using pattern matching (fallback method)
 */
export function extractScalesWithPatterns(text: string): DrawingScale[] {
  const scales: DrawingScale[] = [];

  // Pattern for architectural scales: 1/4"=1'-0", 3/16"=1'-0", etc.
  const archPattern = /(\d+\/\d+|\d+)"\s*=\s*(\d+)'(-\d+")?/gi;
  let match;

  while ((match = archPattern.exec(text)) !== null) {
    const scaleString = match[0].trim();
    const parsed = parseScaleString(scaleString);
    
    if (parsed.ratio > 0) {
      scales.push({
        scaleString,
        scaleRatio: parsed.ratio,
        format: 'architectural',
        isMultiple: false,
        confidence: 0.8,
      });
    }
  }

  // Pattern for engineering scales: 1"=10', 1"=50', etc.
  const engPattern = /1"\s*=\s*(\d+)'/gi;
  while ((match = engPattern.exec(text)) !== null) {
    const scaleString = match[0].trim();
    const parsed = parseScaleString(scaleString);
    
    if (parsed.ratio > 0) {
      scales.push({
        scaleString,
        scaleRatio: parsed.ratio,
        format: 'engineering',
        isMultiple: false,
        confidence: 0.8,
      });
    }
  }

  // Pattern for metric scales: 1:100, 1:50, etc.
  const metricPattern = /1:(\d+)/gi;
  while ((match = metricPattern.exec(text)) !== null) {
    const scaleString = match[0].trim();
    const ratio = parseInt(match[1]);
    
    if (ratio > 0) {
      scales.push({
        scaleString,
        scaleRatio: ratio,
        format: 'metric',
        isMultiple: false,
        confidence: 0.8,
      });
    }
  }

  // Special cases
  if (/NTS|NOT\s+TO\s+SCALE/i.test(text)) {
    scales.push({
      scaleString: 'NTS',
      scaleRatio: 0,
      format: 'custom',
      isMultiple: false,
      confidence: 1.0,
    });
  }

  if (/AS\s+NOTED/i.test(text)) {
    scales.push({
      scaleString: 'AS NOTED',
      scaleRatio: 0,
      format: 'custom',
      isMultiple: false,
      confidence: 1.0,
    });
  }

  return scales;
}

/**
 * Parse scale string to numerical ratio
 */
export function parseScaleString(scaleString: string): {
  ratio: number;
  format: ScaleFormat;
} {
  const normalized = scaleString.trim().toUpperCase();

  // Check architectural scales
  for (const [key, ratio] of Object.entries(ARCHITECTURAL_SCALES)) {
    if (normalized.includes(key.toUpperCase().replace(/'/g, "'").replace(/"/g, '"'))) {
      return { ratio, format: 'architectural' };
    }
  }

  // Check engineering scales
  for (const [key, ratio] of Object.entries(ENGINEERING_SCALES)) {
    if (normalized.includes(key.toUpperCase().replace(/'/g, "'").replace(/"/g, '"'))) {
      return { ratio, format: 'engineering' };
    }
  }

  // Check metric scales
  const metricMatch = normalized.match(/1:(\d+)/);
  if (metricMatch) {
    return { ratio: parseInt(metricMatch[1]), format: 'metric' };
  }

  // Try to parse custom format
  // Example: "1/4"=1'-0"" → (1/4) inch = 12 inches → ratio = 48
  const customMatch = normalized.match(/(\d+)\/(\d+)"\s*=\s*(\d+)'/);
  if (customMatch) {
    const numerator = parseInt(customMatch[1]);
    const denominator = parseInt(customMatch[2]);
    const feet = parseInt(customMatch[3]);
    const ratio = (feet * 12) / (numerator / denominator);
    return { ratio, format: 'architectural' };
  }

  // Special cases
  if (normalized === 'NTS' || normalized.includes('NOT TO SCALE')) {
    return { ratio: 0, format: 'custom' };
  }
  if (normalized.includes('AS NOTED')) {
    return { ratio: 0, format: 'custom' };
  }

  return { ratio: 0, format: 'custom' };
}

/**
 * Store scale data in database
 */
export async function storeSheetScaleData(
  projectId: string,
  documentId: string,
  sheetNumber: string,
  scaleData: SheetScaleData
): Promise<void> {
  await prisma.documentChunk.updateMany({
    where: {
      Document: { projectId },
      sheetNumber,
    },
    data: {
      scaleData: scaleData as any,
    },
  });
}

/**
 * Get scale data for a sheet
 */
export async function getSheetScaleData(
  projectId: string,
  sheetNumber: string
): Promise<SheetScaleData | null> {
  const chunk = await prisma.documentChunk.findFirst({
    where: {
      Document: { projectId },
      sheetNumber,
    },
    select: {
      scaleData: true,
    },
  });

  return chunk?.scaleData as unknown as SheetScaleData | null;
}

/**
 * Validate scales across all sheets in a project
 */
export async function validateProjectScales(
  projectSlug: string
): Promise<{
  totalSheets: number;
  sheetsWithScales: number;
  sheetsWithoutScales: number;
  sheetsWithMultipleScales: number;
  issues: ScaleValidationIssue[];
}> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const chunks = await prisma.documentChunk.findMany({
    where: {
      Document: { projectId: project.id },
    },
    select: {
      sheetNumber: true,
      scaleData: true,
    },
  });

  // Group by sheet number
  const sheetMap = new Map<string, any>();
  for (const chunk of chunks) {
    if (chunk.sheetNumber && !sheetMap.has(chunk.sheetNumber)) {
      sheetMap.set(chunk.sheetNumber, chunk.scaleData);
    }
  }

  const issues: ScaleValidationIssue[] = [];
  let sheetsWithScales = 0;
  let sheetsWithoutScales = 0;
  let sheetsWithMultipleScales = 0;

  for (const [sheetNumber, scaleData] of sheetMap.entries()) {
    if (!scaleData) {
      sheetsWithoutScales++;
      issues.push({
        sheetNumber,
        issueType: 'missing',
        severity: 'high',
        description: 'No scale information found',
        suggestion: 'Verify sheet has scale in title block or re-extract',
      });
      continue;
    }

    const scale = scaleData as unknown as SheetScaleData;
    sheetsWithScales++;

    if (scale.hasMultipleScales) {
      sheetsWithMultipleScales++;
      issues.push({
        sheetNumber,
        issueType: 'multiple',
        severity: 'low',
        description: `Sheet has ${scale.scaleCount} different scales`,
        suggestion: 'Verify each viewport/detail has correct scale noted',
      });
    }

    // Check for unusual scales
    const ratio = scale.primaryScale.scaleRatio;
    if (ratio > 0 && ratio < 10) {
      issues.push({
        sheetNumber,
        issueType: 'unusual',
        severity: 'medium',
        description: `Unusual scale ratio: ${ratio} (very large scale)`,
        suggestion: 'Verify this is correct for detail drawings',
      });
    } else if (ratio > 2000) {
      issues.push({
        sheetNumber,
        issueType: 'unusual',
        severity: 'medium',
        description: `Unusual scale ratio: ${ratio} (very small scale)`,
        suggestion: 'Verify this is correct for site plans',
      });
    }
  }

  return {
    totalSheets: sheetMap.size,
    sheetsWithScales,
    sheetsWithoutScales,
    sheetsWithMultipleScales,
    issues,
  };
}

/**
 * Get scale statistics for a project
 */
export async function getScaleStatistics(
  projectSlug: string
): Promise<{
  totalSheets: number;
  coverage: number;
  avgConfidence: number;
  scaleDistribution: Record<string, number>;
  formatDistribution: Record<ScaleFormat, number>;
}> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  const chunks = await prisma.documentChunk.findMany({
    where: {
      Document: { projectId: project.id },
    },
    select: {
      sheetNumber: true,
      scaleData: true,
    },
  });

  // Group by sheet number
  const sheetMap = new Map<string, any>();
  for (const chunk of chunks) {
    if (chunk.sheetNumber && !sheetMap.has(chunk.sheetNumber)) {
      sheetMap.set(chunk.sheetNumber, chunk.scaleData);
    }
  }

  const scaleDistribution: Record<string, number> = {};
  const formatDistribution: Record<ScaleFormat, number> = {
    architectural: 0,
    engineering: 0,
    metric: 0,
    custom: 0,
  };

  let totalConfidence = 0;
  let confidenceCount = 0;
  let sheetsWithScales = 0;

  for (const [sheetNumber, scaleData] of sheetMap.entries()) {
    if (scaleData) {
      const scale = scaleData as unknown as SheetScaleData;
      sheetsWithScales++;
      
      // Count scale strings
      const scaleString = scale.primaryScale.scaleString;
      scaleDistribution[scaleString] = (scaleDistribution[scaleString] || 0) + 1;
      
      // Count formats
      formatDistribution[scale.primaryScale.format]++;
      
      // Track confidence
      totalConfidence += scale.confidence;
      confidenceCount++;
    }
  }

  return {
    totalSheets: sheetMap.size,
    coverage: sheetMap.size > 0 ? (sheetsWithScales / sheetMap.size) * 100 : 0,
    avgConfidence: confidenceCount > 0 ? (totalConfidence / confidenceCount) * 100 : 0,
    scaleDistribution,
    formatDistribution,
  };
}

/**
 * Convert drawing measurement to real-world measurement
 */
export function convertDrawingToRealWorld(
  drawingMeasurement: number,
  scaleRatio: number,
  inputUnit: 'inches' | 'feet' | 'mm' | 'cm' | 'm' = 'inches',
  outputUnit: 'inches' | 'feet' | 'mm' | 'cm' | 'm' = 'feet'
): number {
  // Convert input to inches
  let inches = drawingMeasurement;
  switch (inputUnit) {
    case 'feet':
      inches *= 12;
      break;
    case 'mm':
      inches /= 25.4;
      break;
    case 'cm':
      inches /= 2.54;
      break;
    case 'm':
      inches /= 0.0254;
      break;
  }

  // Apply scale ratio
  const realWorldInches = inches * scaleRatio;

  // Convert to output unit
  switch (outputUnit) {
    case 'inches':
      return realWorldInches;
    case 'feet':
      return realWorldInches / 12;
    case 'mm':
      return realWorldInches * 25.4;
    case 'cm':
      return realWorldInches * 2.54;
    case 'm':
      return realWorldInches * 0.0254;
    default:
      return realWorldInches;
  }
}
