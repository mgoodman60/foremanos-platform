/**
 * Earthwork Data Extractor
 * Extracts elevation data from various document types:
 * - DWG/DXF files (contour lines, spot elevations)
 * - PDF grading plans
 * - Site surveys
 * - Geotech reports
 */

import { ElevationGrid, CrossSection, parseElevationData } from './earthwork-calculator';

export interface ExtractedElevations {
  existing: { x: number; y: number; elev: number }[];
  proposed: { x: number; y: number; elev: number }[];
  crossSections: CrossSection[];
  metadata: {
    source: string;
    confidence: number;
    extractionMethod: string;
    datum?: string;
    units?: string;
  };
}

/**
 * Extract elevation data using AI vision from document content
 */
export async function extractElevationsFromDocument(
  documentContent: string,
  documentType: 'survey' | 'grading' | 'geotech' | 'plans',
  projectContext?: string
): Promise<ExtractedElevations> {
  const existing: ExtractedElevations['existing'] = [];
  const proposed: ExtractedElevations['proposed'] = [];
  const crossSections: CrossSection[] = [];
  
  // Pattern matching for elevation data
  const patterns = {
    // Spot elevation: "ELEV 985.5" or "EL. 985.5" or "985.5'"
    spotElev: /(?:ELEV\.?|EL\.?|ELEVATION)\s*[=:]?\s*(\d{2,4}\.?\d{0,2})['']?/gi,
    
    // Contour labels: "980", "985", "990" (typically 5ft intervals)
    contour: /\b(9[0-9]{2}|10[0-9]{2}|11[0-9]{2})\b/g,
    
    // Coordinate with elevation: "N 1234.56 E 5678.90 ELEV 985.5"
    coordElev: /N\s*(\d+\.?\d*)\s*E\s*(\d+\.?\d*)\s*(?:ELEV\.?|EL\.?)\s*(\d+\.?\d*)/gi,
    
    // Cross section data: "STA 1+00 CUT 125 SF FILL 85 SF"
    crossSection: /STA\.?\s*(\d+)\+(\d{2})\s*(?:CUT|C)\s*(\d+\.?\d*)\s*(?:SF)?\s*(?:FILL|F)\s*(\d+\.?\d*)\s*(?:SF)?/gi,
    
    // Existing vs Proposed markers
    existingMarker: /(?:EXISTING|EXIST\.?|EX\.?)\s*(?:GRADE|ELEV|GROUND|SURFACE)/gi,
    proposedMarker: /(?:PROPOSED|PROP\.?|DESIGN|FINISH|FG|FF)\s*(?:GRADE|ELEV|GROUND|SURFACE)/gi,
    
    // Grid coordinates: "X: 1234.56, Y: 5678.90, Z: 985.5"
    gridCoord: /X\s*[=:]?\s*(\d+\.?\d*)\s*,?\s*Y\s*[=:]?\s*(\d+\.?\d*)\s*,?\s*Z\s*[=:]?\s*(\d+\.?\d*)/gi,
    
    // Cut/Fill depths: "CUT 2.5'" or "FILL 1.8'"
    cutFillDepth: /(?:CUT|FILL)\s*(\d+\.?\d*)['']?/gi,
  };
  
  // Extract cross-section data
  let csMatch;
  while ((csMatch = patterns.crossSection.exec(documentContent)) !== null) {
    const station = parseInt(csMatch[1]) + parseInt(csMatch[2]) / 100;
    crossSections.push({
      station,
      cutArea: parseFloat(csMatch[3]),
      fillArea: parseFloat(csMatch[4]),
    });
  }
  
  // Extract coordinate-based elevations
  let coordMatch;
  while ((coordMatch = patterns.coordElev.exec(documentContent)) !== null) {
    const point = {
      y: parseFloat(coordMatch[1]), // Northing
      x: parseFloat(coordMatch[2]), // Easting
      elev: parseFloat(coordMatch[3]),
    };
    
    // Determine if existing or proposed based on context
    const contextBefore = documentContent.slice(Math.max(0, coordMatch.index - 100), coordMatch.index);
    if (patterns.proposedMarker.test(contextBefore)) {
      proposed.push(point);
    } else {
      existing.push(point);
    }
  }
  
  // Extract grid coordinates
  let gridMatch;
  while ((gridMatch = patterns.gridCoord.exec(documentContent)) !== null) {
    const point = {
      x: parseFloat(gridMatch[1]),
      y: parseFloat(gridMatch[2]),
      elev: parseFloat(gridMatch[3]),
    };
    
    const contextBefore = documentContent.slice(Math.max(0, gridMatch.index - 100), gridMatch.index);
    if (patterns.proposedMarker.test(contextBefore)) {
      proposed.push(point);
    } else {
      existing.push(point);
    }
  }
  
  // Calculate confidence based on data quality
  const confidence = calculateConfidence(existing, proposed, crossSections);
  
  return {
    existing,
    proposed,
    crossSections,
    metadata: {
      source: documentType,
      confidence,
      extractionMethod: 'pattern-matching',
      datum: detectDatum(documentContent),
      units: detectUnits(documentContent),
    },
  };
}

/**
 * Extract elevations using AI/LLM for complex documents
 */
export async function extractElevationsWithAI(
  documentText: string,
  documentType: string,
  apiKey?: string
): Promise<ExtractedElevations> {
  // If no API key, fall back to pattern matching
  if (!apiKey) {
    return extractElevationsFromDocument(documentText, documentType as any);
  }
  
  const prompt = `Extract elevation data from this ${documentType} document for earthwork calculations.

Document content:
${documentText.slice(0, 8000)}

Extract and return as JSON:
1. existing_elevations: Array of {x, y, elev} for existing ground elevations
2. proposed_elevations: Array of {x, y, elev} for proposed/design elevations  
3. cross_sections: Array of {station, cut_area_sf, fill_area_sf}
4. datum: The vertical datum used (e.g., NAVD88, local)
5. units: Measurement units (feet or meters)

Focus on:
- Spot elevations marked on plans
- Contour line values
- Cross-section cut/fill areas
- Benchmark elevations

Return ONLY valid JSON.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });
    
    if (!response.ok) {
      throw new Error('AI extraction failed');
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    return {
      existing: parsed.existing_elevations || [],
      proposed: parsed.proposed_elevations || [],
      crossSections: (parsed.cross_sections || []).map((cs: any) => ({
        station: cs.station,
        cutArea: cs.cut_area_sf,
        fillArea: cs.fill_area_sf,
      })),
      metadata: {
        source: documentType,
        confidence: 0.85,
        extractionMethod: 'ai-vision',
        datum: parsed.datum,
        units: parsed.units,
      },
    };
  } catch (error) {
    console.error('[EarthworkExtractor] AI extraction failed:', error);
    return extractElevationsFromDocument(documentText, documentType as any);
  }
}

/**
 * Merge elevation data from multiple sources
 */
export function mergeElevationSources(
  sources: ExtractedElevations[]
): ExtractedElevations {
  const existing: ExtractedElevations['existing'] = [];
  const proposed: ExtractedElevations['proposed'] = [];
  const crossSections: CrossSection[] = [];
  
  // Sort by confidence to prioritize better sources
  const sortedSources = [...sources].sort(
    (a, b) => b.metadata.confidence - a.metadata.confidence
  );
  
  for (const source of sortedSources) {
    // Add unique points (avoiding duplicates within tolerance)
    for (const point of source.existing) {
      if (!hasNearbyPoint(existing, point, 5)) {
        existing.push(point);
      }
    }
    
    for (const point of source.proposed) {
      if (!hasNearbyPoint(proposed, point, 5)) {
        proposed.push(point);
      }
    }
    
    // Merge cross sections by station
    for (const cs of source.crossSections) {
      const existingCS = crossSections.find(c => Math.abs(c.station - cs.station) < 0.01);
      if (!existingCS) {
        crossSections.push(cs);
      }
    }
  }
  
  // Calculate average confidence
  const avgConfidence = sources.reduce((sum, s) => sum + s.metadata.confidence, 0) / sources.length;
  
  return {
    existing,
    proposed,
    crossSections,
    metadata: {
      source: 'merged',
      confidence: avgConfidence,
      extractionMethod: 'multi-source',
      datum: sortedSources[0]?.metadata.datum,
      units: sortedSources[0]?.metadata.units,
    },
  };
}

/**
 * Create elevation grid from extracted data
 */
export function createElevationGrid(
  data: ExtractedElevations,
  gridSpacing: number = 25
): ElevationGrid | null {
  if (data.existing.length < 3 || data.proposed.length < 3) {
    return null;
  }
  
  return parseElevationData(data.existing, data.proposed, gridSpacing);
}

// Helper functions

function hasNearbyPoint(
  points: { x: number; y: number; elev: number }[],
  target: { x: number; y: number; elev: number },
  tolerance: number
): boolean {
  return points.some(p => {
    const dist = Math.sqrt(Math.pow(p.x - target.x, 2) + Math.pow(p.y - target.y, 2));
    return dist < tolerance;
  });
}

function calculateConfidence(
  existing: ExtractedElevations['existing'],
  proposed: ExtractedElevations['proposed'],
  crossSections: CrossSection[]
): number {
  let confidence = 0.3; // Base confidence
  
  // More points = higher confidence
  if (existing.length >= 10) confidence += 0.2;
  else if (existing.length >= 5) confidence += 0.1;
  
  if (proposed.length >= 10) confidence += 0.2;
  else if (proposed.length >= 5) confidence += 0.1;
  
  // Cross sections are very reliable
  if (crossSections.length >= 5) confidence += 0.2;
  else if (crossSections.length >= 2) confidence += 0.1;
  
  return Math.min(confidence, 1.0);
}

function detectDatum(content: string): string | undefined {
  const datumPatterns = [
    /NAVD\s*88/i,
    /NGVD\s*29/i,
    /LOCAL\s+DATUM/i,
    /MSL/i,
  ];
  
  for (const pattern of datumPatterns) {
    if (pattern.test(content)) {
      return content.match(pattern)?.[0]?.toUpperCase();
    }
  }
  
  return undefined;
}

function detectUnits(content: string): string {
  if (/\bmeters?\b|\bm\b/i.test(content) && !/\bft\b|\bfeet\b/i.test(content)) {
    return 'meters';
  }
  return 'feet';
}

/**
 * Estimate earthwork from simple site parameters
 * Used when detailed elevation data isn't available
 */
export function estimateFromSiteParams(params: {
  siteAreaSF: number;
  existingAvgElev: number;
  proposedAvgElev: number;
  slopePercent?: number;
}): { avgCutDepth: number; avgFillDepth: number; balanceEstimate: string } {
  const elevDiff = params.existingAvgElev - params.proposedAvgElev;
  const slopeFactor = params.slopePercent ? (params.slopePercent / 100) * 0.5 : 0;
  
  let avgCutDepth = 0;
  let avgFillDepth = 0;
  
  if (elevDiff > 0) {
    // Site needs to be lowered (cut)
    avgCutDepth = elevDiff + slopeFactor;
  } else if (elevDiff < 0) {
    // Site needs to be raised (fill)
    avgFillDepth = Math.abs(elevDiff) + slopeFactor;
  }
  
  // Estimate balance
  let balanceEstimate: string;
  if (Math.abs(elevDiff) < 0.5) {
    balanceEstimate = 'Site appears relatively balanced';
  } else if (elevDiff > 2) {
    balanceEstimate = 'Significant cut expected - potential material export';
  } else if (elevDiff < -2) {
    balanceEstimate = 'Significant fill expected - material import likely needed';
  } else {
    balanceEstimate = 'Moderate earthwork - may balance on site';
  }
  
  return { avgCutDepth, avgFillDepth, balanceEstimate };
}
