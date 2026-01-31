/**
 * Dimension Intelligence System
 * 
 * Extracts labeled dimensions from construction drawings, calculates
 * derived dimensions, and validates dimension consistency.
 * 
 * Phase B.2 - Document Intelligence Roadmap
 */

import { prisma } from './db';
import { Prisma } from '@prisma/client';
import { callAbacusLLM } from './abacus-llm';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Dimension {
  value: number;               // Numeric value
  unit: 'ft' | 'in' | 'm' | 'mm' | 'cm'; // Unit of measurement
  label: string;               // Original label (e.g., "12'-6\"", "3.5m")
  type: 'linear' | 'area' | 'volume' | 'angle'; // Dimension type
  direction?: 'horizontal' | 'vertical' | 'diagonal'; // Orientation
  chainReference?: string;     // Reference to dimension chain
  location?: string;           // Description of location
  confidence: number;          // 0-1 extraction confidence
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DimensionChain {
  id: string;
  dimensions: Dimension[];
  totalDimension: Dimension;
  isValid: boolean;            // Does sum match total?
  variance?: number;           // If invalid, difference in inches
}

export interface DimensionValidation {
  chainValidations: {
    chain: DimensionChain;
    errors: string[];
  }[];
  isolatedDimensions: Dimension[];
  overallHealth: number;       // 0-1 health score
}

// Scale data for dimension extraction
export interface ScaleData {
  format: string;
  ratio: number;
}

// Raw dimension from LLM extraction
interface RawLLMDimension {
  value: number;
  unit?: string;
  label: string;
  type?: string;
  direction?: string;
  chainReference?: string;
  location?: string;
  confidence?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Stored dimension with sheet context
interface StoredDimension extends Dimension {
  sheetNumber?: string;
  annotationId?: string;
  critical?: boolean;
}

// Validation error from stored JSON
interface StoredValidationError {
  errors: string[];
}

// ============================================================================
// DIMENSION PARSING
// ============================================================================

const DIMENSION_PATTERNS = [
  // Feet and inches: 12'-6", 5'-0", 24'
  /([0-9]+)'\s*-?\s*([0-9]+(?:\/[0-9]+)?)"/gi,
  /([0-9]+)'/gi,
  
  // Metric: 3.5m, 350mm, 25cm
  /([0-9]+(?:\.[0-9]+)?)\s*(m|mm|cm)\b/gi,
  
  // Decimal feet: 12.5', 8.25'
  /([0-9]+\.[0-9]+)'/gi,
  
  // Inches only: 24", 6-1/2"
  /([0-9]+(?:-[0-9]+\/[0-9]+)?)"/gi,
];

/**
 * Parse dimension string to numeric value in inches
 */
export function parseDimensionToInches(dimString: string): number | null {
  dimString = dimString.trim();

  // Try feet-inches: 12'-6"
  let match = dimString.match(/([0-9]+)'\s*-?\s*([0-9]+(?:\/[0-9]+)?)"/);  
  if (match) {
    const feet = parseInt(match[1]);
    const inches = parseFraction(match[2]);
    return feet * 12 + inches;
  }

  // Try feet only: 12'
  match = dimString.match(/([0-9]+)'/);
  if (match) {
    return parseInt(match[1]) * 12;
  }

  // Try decimal feet: 12.5'
  match = dimString.match(/([0-9]+\.[0-9]+)'/);
  if (match) {
    return parseFloat(match[1]) * 12;
  }

  // Try inches: 24"
  match = dimString.match(/([0-9]+(?:-[0-9]+\/[0-9]+)?)"/);  
  if (match) {
    return parseFraction(match[1]);
  }

  // Try metric: 3.5m, 350mm
  match = dimString.match(/([0-9]+(?:\.[0-9]+)?)\s*(m|mm|cm)/);
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'm':
        return value * 39.3701; // meters to inches
      case 'cm':
        return value * 0.393701; // cm to inches
      case 'mm':
        return value * 0.0393701; // mm to inches
    }
  }

  return null;
}

/**
 * Parse fractional inches (e.g., "6-1/2" or "1/4")
 */
function parseFraction(str: string): number {
  if (str.includes('-')) {
    const [whole, frac] = str.split('-');
    return parseInt(whole) + parseFraction(frac);
  }

  if (str.includes('/')) {
    const [num, den] = str.split('/').map(Number);
    return num / den;
  }

  return parseFloat(str);
}

/**
 * Format dimension value to standard notation
 */
export function formatDimension(
  inches: number,
  unit: 'imperial' | 'metric' = 'imperial'
): string {
  if (unit === 'metric') {
    const meters = inches / 39.3701;
    if (meters >= 1) {
      return `${meters.toFixed(2)}m`;
    } else {
      return `${(meters * 100).toFixed(0)}cm`;
    }
  }

  // Imperial formatting
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  
  if (feet > 0 && remainingInches > 0) {
    return `${feet}'-${remainingInches.toFixed(2)}"`;
  } else if (feet > 0) {
    return `${feet}'-0"`;
  } else {
    return `${remainingInches.toFixed(2)}"`;
  }
}

// ============================================================================
// DIMENSION EXTRACTION
// ============================================================================

/**
 * Extract dimensions from text using pattern matching
 */
export function extractDimensionsFromText(
  text: string,
  sheetNumber: string
): Dimension[] {
  const dimensions: Dimension[] = [];
  const seen = new Set<string>();

  for (const pattern of DIMENSION_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    
    while ((match = regex.exec(text)) !== null) {
      const label = match[0];
      const inches = parseDimensionToInches(label);
      
      if (inches === null || seen.has(label)) continue;
      seen.add(label);

      dimensions.push({
        value: inches,
        unit: label.includes("'") || label.includes('"') ? 'in' : 'm',
        label,
        type: 'linear',
        confidence: 0.8, // Pattern-based confidence
      });
    }
  }

  return dimensions;
}

/**
 * Extract dimensions using GPT-4o Vision
 */
export async function extractDimensionsWithVision(
  imageBase64: string,
  sheetNumber: string,
  scaleData?: ScaleData
): Promise<Dimension[]> {
  const prompt = `Analyze this construction drawing and extract ALL labeled dimensions.

Look for:
1. Linear dimensions (walls, rooms, openings)
2. Dimension chains (series of connected dimensions)
3. Area dimensions (room sizes, floor areas)
4. Angular dimensions (slopes, angles)
5. Elevation markers with heights

${scaleData ? `Scale: ${scaleData.format} (ratio: ${scaleData.ratio})` : ''}

For EACH dimension found, provide:
- Exact label text (e.g., "12'-6\"", "3.5m")
- Numeric value in inches or meters
- Type (linear/area/angle)
- Direction (horizontal/vertical/diagonal)
- Location description
- Is it part of a dimension chain?

Return as JSON array:
{
  "dimensions": [
    {
      "label": "12'-6\"",
      "value": 150,
      "unit": "in",
      "type": "linear",
      "direction": "horizontal",
      "location": "North wall, Grid A-B",
      "chainReference": "chain_1",
      "confidence": 0.95
    }
  ],
  "chains": [
    {
      "id": "chain_1",
      "dimensions": ["12'-6\"", "8'-0\"", "10'-6\""],
      "totalDimension": "31'-0\""
    }
  ]
}`;

  try {
    const response = await callAbacusLLM(
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` }
            }
          ]
        }
      ],
      {
        response_format: { type: 'json_object' },
        max_tokens: 3000,
      }
    );

    // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
    let contentToParse = response.content;
    const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      contentToParse = jsonMatch[1].trim();
    }

    const result = JSON.parse(contentToParse);
    
    return (result.dimensions || []).map((d: RawLLMDimension) => ({
      value: d.value,
      unit: d.unit || 'in',
      label: d.label,
      type: d.type || 'linear',
      direction: d.direction,
      chainReference: d.chainReference,
      location: d.location,
      confidence: d.confidence || 0.85,
      boundingBox: d.boundingBox,
    }));
  } catch (error) {
    console.error('Vision dimension extraction failed:', error);
    return [];
  }
}

// ============================================================================
// DIMENSION VALIDATION
// ============================================================================

/**
 * Validate dimension chains for mathematical consistency
 */
export function validateDimensionChains(
  dimensions: Dimension[]
): DimensionValidation {
  const chains: Map<string, Dimension[]> = new Map();
  const isolated: Dimension[] = [];

  // Group dimensions by chain
  for (const dim of dimensions) {
    if (dim.chainReference) {
      if (!chains.has(dim.chainReference)) {
        chains.set(dim.chainReference, []);
      }
      chains.get(dim.chainReference)!.push(dim);
    } else {
      isolated.push(dim);
    }
  }

  const chainValidations: DimensionValidation['chainValidations'] = [];
  let totalValid = 0;
  let totalChecked = 0;

  // Validate each chain
  for (const [chainId, chainDims] of chains.entries()) {
    totalChecked++;

    // Find total dimension (usually last or marked differently)
    const sortedDims = [...chainDims].sort((a, b) => b.value - a.value);
    const totalDim = sortedDims[0]; // Assume largest is total
    const partialDims = sortedDims.slice(1);

    // Calculate sum of partial dimensions
    const calculatedSum = partialDims.reduce((sum, d) => sum + d.value, 0);
    const variance = Math.abs(calculatedSum - totalDim.value);
    const isValid = variance < 0.5; // Tolerance: 0.5 inches

    if (isValid) totalValid++;

    const errors: string[] = [];
    if (!isValid) {
      errors.push(
        `Sum of partial dimensions (${formatDimension(calculatedSum)}) ` +
        `does not match total (${totalDim.label}). ` +
        `Variance: ${variance.toFixed(2)}"`
      );
    }

    chainValidations.push({
      chain: {
        id: chainId,
        dimensions: chainDims,
        totalDimension: totalDim,
        isValid,
        variance: isValid ? 0 : variance,
      },
      errors,
    });
  }

  const overallHealth = totalChecked > 0 ? totalValid / totalChecked : 1.0;

  return {
    chainValidations,
    isolatedDimensions: isolated,
    overallHealth,
  };
}

/**
 * Calculate derived dimensions based on scale
 */
export function calculateDerivedDimensions(
  scaleData: { ratio: number },
  measuredPixels: number
): number {
  // Convert pixel measurement to real-world inches
  // ratio is scale factor (e.g., 1/48 for 1/4"=1'-0")
  return measuredPixels * scaleData.ratio;
}

/**
 * Store dimensions in database
 */
export async function storeDimensions(
  projectId: string,
  documentId: string,
  sheetNumber: string,
  dimensions: Dimension[],
  validation: DimensionValidation
): Promise<void> {
  // Check if record exists
  const existing = await prisma.dimensionAnnotation.findUnique({
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
    dimensions: dimensions as any,
    validationErrors: validation.chainValidations
      .filter((v) => v.errors.length > 0)
      .map((v) => ({ chainId: v.chain.id, errors: v.errors })),
    confidence: validation.overallHealth,
  };

  if (existing) {
    await prisma.dimensionAnnotation.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.dimensionAnnotation.create({ data });
  }
}

/**
 * Get dimension statistics for a project
 */
export async function getDimensionStats(projectId: string) {
  const annotations = await prisma.dimensionAnnotation.findMany({
    where: { projectId },
  });

  let totalDimensions = 0;
  let totalChains = 0;
  let validChains = 0;

  for (const annotation of annotations) {
    const dims = annotation.dimensions as unknown as Dimension[] | null;
    totalDimensions += Array.isArray(dims) ? dims.length : 0;

    const errors = annotation.validationErrors as unknown as StoredValidationError[] | null;
    if (Array.isArray(errors)) {
      totalChains += errors.length;
      validChains += errors.filter((e) => e.errors.length === 0).length;
    }
  }

  return {
    totalDimensions,
    totalSheets: annotations.length,
    totalChains,
    validChains,
    healthScore: totalChains > 0 ? validChains / totalChains : 1.0,
  };
}

/**
 * Get all dimensions for a project
 */
export async function getProjectDimensions(projectId: string, filters?: {
  type?: string;
  critical?: boolean;
}) {
  const where: Prisma.DimensionAnnotationWhereInput = { projectId };

  const annotations = await prisma.dimensionAnnotation.findMany({
    where,
    orderBy: { sheetNumber: 'asc' },
  });

  // Extract dimensions from annotations
  const allDimensions: StoredDimension[] = [];

  for (const annotation of annotations) {
    const dims = annotation.dimensions as unknown as StoredDimension[] | null;
    if (Array.isArray(dims)) {
      dims.forEach((dim) => {
        if (filters?.type && dim.type !== filters.type) return;
        if (filters?.critical && !dim.critical) return;

        allDimensions.push({
          ...dim,
          sheetNumber: annotation.sheetNumber,
          annotationId: annotation.id,
        });
      });
    }
  }

  return allDimensions;
}

/**
 * Get dimensions for a specific sheet
 */
export async function getSheetDimensions(projectId: string, sheetNumber: string) {
  const annotation = await prisma.dimensionAnnotation.findFirst({
    where: {
      projectId,
      sheetNumber,
    },
  });
  
  if (!annotation) {
    return [];
  }
  
  const dims = annotation.dimensions as unknown as Dimension[] | null;
  return Array.isArray(dims) ? dims : [];
}

/**
 * Search dimensions with advanced filters
 */
export async function searchDimensions(
  projectId: string,
  filters: {
    type?: string;
    context?: string;
    critical?: boolean;
    query?: string;
  }
) {
  const annotations = await prisma.dimensionAnnotation.findMany({
    where: { projectId },
    orderBy: { sheetNumber: 'asc' },
  });

  const results: StoredDimension[] = [];
  
  for (const annotation of annotations) {
    const dims = annotation.dimensions as any;
    if (!Array.isArray(dims)) continue;
    
    for (const dim of dims) {
      // Apply filters
      if (filters.type && dim.type !== filters.type) continue;
      if (filters.critical && !dim.critical) continue;
      if (filters.context && dim.context && !dim.context.toLowerCase().includes(filters.context.toLowerCase())) continue;
      
      if (filters.query) {
        const searchStr = `${dim.dimension || ''} ${dim.context || ''} ${dim.type || ''}`.toLowerCase();
        if (!searchStr.includes(filters.query.toLowerCase())) continue;
      }
      
      results.push({
        ...dim,
        sheetNumber: annotation.sheetNumber,
        annotationId: annotation.id,
      });
    }
  }
  
  return results;
}
