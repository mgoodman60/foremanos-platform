/**
 * Legend & Key Recognition System (Phase A.2)
 * Extracts legend sections from construction drawings and maps symbols to definitions
 *
 * Capabilities:
 * - Legend region detection on sheets
 * - Symbol-to-definition mapping
 * - Dynamic symbol library updates
 * - Cross-sheet legend consolidation
 * - Symbol usage validation
 *
 * NOTE: Updated Feb 2026 to support both image and PDF input.
 * PDF input is automatically detected and handled by vision APIs.
 */

import { DisciplineCode, getDisciplineName } from './title-block-extractor';
import { prisma } from '@/lib/db';

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

export interface LegendEntry {
  id: string;
  symbolImage?: string;          // Base64 or S3 URL of symbol image
  symbolCode: string;            // "FA-PS", "E-1", etc.
  symbolDescription: string;     // "Fire Alarm Pull Station"
  category: SymbolCategory;
  discipline?: DisciplineCode;
  confidence: number;            // 0-1
  position?: { x: number; y: number; width: number; height: number };
}

export enum SymbolCategory {
  ELECTRICAL = 'electrical',
  MECHANICAL = 'mechanical',
  PLUMBING = 'plumbing',
  FIRE_PROTECTION = 'fire_protection',
  ARCHITECTURAL = 'architectural',
  STRUCTURAL = 'structural',
  CIVIL = 'civil',
  GENERAL = 'general',
  UNKNOWN = 'unknown'
}

export interface SheetLegend {
  id: string;
  projectId: string;
  documentId: string;
  sheetNumber: string;
  legendEntries: LegendEntry[];
  boundingBox?: { x: number; y: number; width: number; height: number };
  extractedAt: Date;
  confidence: number;
  discipline?: DisciplineCode;
}

export interface ProjectLegendLibrary {
  projectId: string;
  totalSymbols: number;
  byCategory: Record<SymbolCategory, LegendEntry[]>;
  byDiscipline: Record<DisciplineCode, LegendEntry[]>;
  allEntries: LegendEntry[];
  lastUpdated: Date;
}

export interface LegendExtractionResult {
  success: boolean;
  legend?: SheetLegend;
  error?: string;
  confidence: number;
  method: 'vision' | 'pattern' | 'none';
}

// ============================================================================
// LEGEND DETECTION
// ============================================================================

/**
 * Detect legend regions on a construction drawing using GPT-4 Vision
 * Supports both image and PDF input (auto-detected)
 */
export async function detectLegendRegion(
  base64Data: string,
  sheetNumber: string
): Promise<{ found: boolean; boundingBox?: any; confidence: number }> {
  try {
    const prompt = generateLegendDetectionPrompt();

    const response = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: buildVisionContent(prompt, base64Data)
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      return { found: false, confidence: 0 };
    }

    // Parse JSON response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { found: false, confidence: 0 };
    }

    const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    return {
      found: data.found || false,
      boundingBox: data.boundingBox,
      confidence: data.confidence || 0
    };
  } catch (error) {
    console.error('Legend detection error:', error);
    return { found: false, confidence: 0 };
  }
}

/**
 * Extract legend entries from a detected legend region
 * Supports both image and PDF input (auto-detected)
 */
export async function extractLegendEntries(
  base64Data: string,
  sheetNumber: string,
  discipline?: DisciplineCode
): Promise<LegendExtractionResult> {
  try {
    const prompt = generateLegendExtractionPrompt(discipline);

    const response = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: buildVisionContent(prompt, base64Data)
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      return {
        success: false,
        error: 'No content in response',
        confidence: 0,
        method: 'vision'
      };
    }

    // Parse JSON response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: 'No JSON found in response',
        confidence: 0,
        method: 'vision'
      };
    }

    const extractedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    // Build legend entries
    const entries: LegendEntry[] = (extractedData.entries || []).map((e: any, idx: number) => ({
      id: `${sheetNumber}-${idx}`,
      symbolCode: e.symbolCode || e.code || '',
      symbolDescription: e.description || '',
      category: categorizeLegendEntry(e.description, discipline),
      discipline: discipline,
      confidence: e.confidence || 0.85,
      position: e.position
    }));

    const legend: SheetLegend = {
      id: `legend-${sheetNumber}-${Date.now()}`,
      projectId: '', // Will be set when storing
      documentId: '', // Will be set when storing
      sheetNumber,
      legendEntries: entries,
      boundingBox: extractedData.boundingBox,
      extractedAt: new Date(),
      confidence: extractedData.confidence || 0.8,
      discipline
    };

    return {
      success: true,
      legend,
      confidence: legend.confidence,
      method: 'vision'
    };
  } catch (error) {
    console.error('Legend extraction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      confidence: 0,
      method: 'vision'
    };
  }
}

// ============================================================================
// CATEGORIZATION
// ============================================================================

/**
 * Categorize a legend entry based on its description and discipline
 */
export function categorizeLegendEntry(
  description: string,
  discipline?: DisciplineCode
): SymbolCategory {
  const desc = description.toLowerCase();

  // Discipline-based categorization
  if (discipline === DisciplineCode.ELECTRICAL || desc.includes('electrical')) {
    return SymbolCategory.ELECTRICAL;
  }
  if (discipline === DisciplineCode.MECHANICAL || desc.includes('mechanical') || desc.includes('hvac')) {
    return SymbolCategory.MECHANICAL;
  }
  if (discipline === DisciplineCode.PLUMBING || desc.includes('plumbing') || desc.includes('water')) {
    return SymbolCategory.PLUMBING;
  }
  if (discipline === DisciplineCode.FIRE_PROTECTION || desc.includes('fire') || desc.includes('sprinkler')) {
    return SymbolCategory.FIRE_PROTECTION;
  }
  if (discipline === DisciplineCode.STRUCTURAL || desc.includes('structural') || desc.includes('beam') || desc.includes('column')) {
    return SymbolCategory.STRUCTURAL;
  }
  if (discipline === DisciplineCode.ARCHITECTURAL || desc.includes('door') || desc.includes('window')) {
    return SymbolCategory.ARCHITECTURAL;
  }
  if (discipline === DisciplineCode.CIVIL || desc.includes('civil') || desc.includes('site')) {
    return SymbolCategory.CIVIL;
  }

  // Keyword-based categorization
  const electricalKeywords = ['outlet', 'switch', 'panel', 'breaker', 'light', 'fixture', 'receptacle'];
  const mechanicalKeywords = ['duct', 'vav', 'ahu', 'fan', 'damper', 'diffuser', 'grille'];
  const plumbingKeywords = ['pipe', 'valve', 'drain', 'faucet', 'toilet', 'sink', 'shower'];
  const fireKeywords = ['alarm', 'extinguisher', 'pull station', 'horn', 'strobe', 'detector'];
  const architecturalKeywords = ['wall', 'partition', 'furniture', 'casework', 'ceiling'];
  const structuralKeywords = ['footing', 'foundation', 'rebar', 'concrete', 'steel'];

  if (electricalKeywords.some(k => desc.includes(k))) return SymbolCategory.ELECTRICAL;
  if (mechanicalKeywords.some(k => desc.includes(k))) return SymbolCategory.MECHANICAL;
  if (plumbingKeywords.some(k => desc.includes(k))) return SymbolCategory.PLUMBING;
  if (fireKeywords.some(k => desc.includes(k))) return SymbolCategory.FIRE_PROTECTION;
  if (architecturalKeywords.some(k => desc.includes(k))) return SymbolCategory.ARCHITECTURAL;
  if (structuralKeywords.some(k => desc.includes(k))) return SymbolCategory.STRUCTURAL;

  return SymbolCategory.GENERAL;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Store legend in database
 */
export async function storeLegend(
  projectId: string,
  documentId: string,
  legend: SheetLegend
): Promise<void> {
  try {
    await prisma.sheetLegend.create({
      data: {
        projectId,
        documentId,
        sheetNumber: legend.sheetNumber,
        legendEntries: legend.legendEntries as any,
        boundingBox: legend.boundingBox as any,
        confidence: legend.confidence,
        discipline: legend.discipline || null
      }
    });

    console.log(`✅ Legend stored for sheet ${legend.sheetNumber} (${legend.legendEntries.length} entries)`);
  } catch (error) {
    console.error('Error storing legend:', error);
    throw error;
  }
}

/**
 * Get all legends for a project
 */
export async function getProjectLegends(projectSlug: string): Promise<SheetLegend[]> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      include: {
        SheetLegend: {
          orderBy: { sheetNumber: 'asc' }
        }
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    return project.SheetLegend.map((legend: any) => ({
      id: legend.id,
      projectId: legend.projectId,
      documentId: legend.documentId,
      sheetNumber: legend.sheetNumber,
      legendEntries: legend.legendEntries as any,
      boundingBox: legend.boundingBox as any,
      extractedAt: legend.extractedAt,
      confidence: legend.confidence,
      discipline: legend.discipline as DisciplineCode
    }));
  } catch (error) {
    console.error('Error getting project legends:', error);
    throw error;
  }
}

/**
 * Build unified legend library for a project
 */
export async function buildProjectLegendLibrary(projectSlug: string): Promise<ProjectLegendLibrary> {
  try {
    const legends = await getProjectLegends(projectSlug);
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } });

    if (!project) {
      throw new Error('Project not found');
    }

    // Flatten all entries
    const allEntries: LegendEntry[] = [];
    const seenCodes = new Set<string>();

    for (const legend of legends) {
      for (const entry of legend.legendEntries) {
        // Deduplicate by symbol code
        if (!seenCodes.has(entry.symbolCode)) {
          allEntries.push(entry);
          seenCodes.add(entry.symbolCode);
        }
      }
    }

    // Group by category
    const byCategory = allEntries.reduce((acc, entry) => {
      if (!acc[entry.category]) {
        acc[entry.category] = [];
      }
      acc[entry.category].push(entry);
      return acc;
    }, {} as Record<SymbolCategory, LegendEntry[]>);

    // Group by discipline
    const byDiscipline = allEntries.reduce((acc, entry) => {
      if (entry.discipline) {
        if (!acc[entry.discipline]) {
          acc[entry.discipline] = [];
        }
        acc[entry.discipline].push(entry);
      }
      return acc;
    }, {} as Record<DisciplineCode, LegendEntry[]>);

    return {
      projectId: project.id,
      totalSymbols: allEntries.length,
      byCategory,
      byDiscipline,
      allEntries,
      lastUpdated: new Date()
    };
  } catch (error) {
    console.error('Error building legend library:', error);
    throw error;
  }
}

/**
 * Search for a symbol in project legends
 */
export async function searchSymbol(
  projectSlug: string,
  query: string
): Promise<LegendEntry[]> {
  try {
    const library = await buildProjectLegendLibrary(projectSlug);
    const lowerQuery = query.toLowerCase();

    return library.allEntries.filter(entry => {
      return (
        entry.symbolCode.toLowerCase().includes(lowerQuery) ||
        entry.symbolDescription.toLowerCase().includes(lowerQuery)
      );
    });
  } catch (error) {
    console.error('Error searching symbols:', error);
    return [];
  }
}

// ============================================================================
// SYMBOL VALIDATION
// ============================================================================

/**
 * Validate symbol usage across project sheets
 */
export async function validateSymbolUsage(
  projectSlug: string
): Promise<{
  inconsistencies: Array<{
    symbolCode: string;
    descriptions: string[];
    sheets: string[];
  }>;
  totalSymbols: number;
  consistentSymbols: number;
}> {
  try {
    const legends = await getProjectLegends(projectSlug);

    // Map symbol codes to their descriptions and sheets
    const symbolMap = new Map<string, { descriptions: Set<string>; sheets: Set<string> }>();

    for (const legend of legends) {
      for (const entry of legend.legendEntries) {
        if (!symbolMap.has(entry.symbolCode)) {
          symbolMap.set(entry.symbolCode, {
            descriptions: new Set(),
            sheets: new Set()
          });
        }

        const data = symbolMap.get(entry.symbolCode)!;
        data.descriptions.add(entry.symbolDescription);
        data.sheets.add(legend.sheetNumber);
      }
    }

    // Find inconsistencies (same code, different descriptions)
    const inconsistencies: Array<{ symbolCode: string; descriptions: string[]; sheets: string[] }> = [];

    for (const [code, data] of symbolMap.entries()) {
      if (data.descriptions.size > 1) {
        inconsistencies.push({
          symbolCode: code,
          descriptions: Array.from(data.descriptions),
          sheets: Array.from(data.sheets)
        });
      }
    }

    return {
      inconsistencies,
      totalSymbols: symbolMap.size,
      consistentSymbols: symbolMap.size - inconsistencies.length
    };
  } catch (error) {
    console.error('Error validating symbol usage:', error);
    return {
      inconsistencies: [],
      totalSymbols: 0,
      consistentSymbols: 0
    };
  }
}

// ============================================================================
// INTEGRATION WITH SYMBOL LEARNING
// ============================================================================

/**
 * Merge legend data with existing symbol library
 */
export async function mergeLegendWithSymbolLibrary(
  projectSlug: string
): Promise<{ merged: number; updated: number; new: number }> {
  try {
    const library = await buildProjectLegendLibrary(projectSlug);
    
    // This would integrate with the existing symbol-learner.ts
    // For now, we'll return statistics
    
    console.log(`📚 Legend library built: ${library.totalSymbols} symbols`);
    
    return {
      merged: library.totalSymbols,
      updated: 0,
      new: library.totalSymbols
    };
  } catch (error) {
    console.error('Error merging legend with symbol library:', error);
    return { merged: 0, updated: 0, new: 0 };
  }
}

// ============================================================================
// PROMPT GENERATION
// ============================================================================

function generateLegendDetectionPrompt(): string {
  return `Analyze this construction drawing and detect if there is a LEGEND or KEY section.

Legends typically:
- Are labeled "LEGEND", "KEY", "SYMBOLS", "ABBREVIATIONS"
- Located in corners or along edges
- Contain symbols with text descriptions
- Show door schedules, wall types, material symbols, MEP symbols

Return JSON:
{
  "found": true/false,
  "boundingBox": {
    "x": percentage from left (0-100),
    "y": percentage from top (0-100),
    "width": percentage of image width (0-100),
    "height": percentage of image height (0-100)
  },
  "confidence": 0.95
}

If no legend is found, return { "found": false, "confidence": 0 }

Return ONLY the JSON object.`;
}

function generateLegendExtractionPrompt(discipline?: DisciplineCode): string {
  const disciplineName = discipline ? getDisciplineName(discipline) : 'any';
  
  return `Extract ALL legend entries from this ${disciplineName} construction drawing legend.

For EACH symbol or abbreviation, extract:
1. Symbol code/abbreviation (e.g., "FA-PS", "E-1", "WP")
2. Full description (e.g., "Fire Alarm Pull Station", "Electrical Panel 1")

Return JSON:
{
  "entries": [
    {
      "symbolCode": "FA-PS",
      "description": "Fire Alarm Pull Station",
      "confidence": 0.95
    },
    {
      "symbolCode": "E-1",
      "description": "Electrical Panel 1",
      "confidence": 0.90
    }
  ],
  "boundingBox": {
    "x": 85,
    "y": 10,
    "width": 12,
    "height": 30
  },
  "confidence": 0.92
}

Rules:
1. Extract EVERY entry in the legend
2. Preserve exact codes/abbreviations
3. Capture complete descriptions
4. Include door types, wall types, equipment tags
5. Set confidence based on clarity

Common legend types:
- Door schedule (types, sizes, materials)
- Wall types (construction assemblies)
- Room finishes
- MEP symbols (electrical, mechanical, plumbing)
- Fire protection symbols
- Structural symbols
- Material symbols

Return ONLY the JSON object with ALL entries.`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getCategoryName(category: SymbolCategory): string {
  const names: Record<SymbolCategory, string> = {
    [SymbolCategory.ELECTRICAL]: 'Electrical',
    [SymbolCategory.MECHANICAL]: 'Mechanical',
    [SymbolCategory.PLUMBING]: 'Plumbing',
    [SymbolCategory.FIRE_PROTECTION]: 'Fire Protection',
    [SymbolCategory.ARCHITECTURAL]: 'Architectural',
    [SymbolCategory.STRUCTURAL]: 'Structural',
    [SymbolCategory.CIVIL]: 'Civil',
    [SymbolCategory.GENERAL]: 'General',
    [SymbolCategory.UNKNOWN]: 'Unknown'
  };
  return names[category];
}

export function getLegendStatistics(legends: SheetLegend[]): {
  totalLegends: number;
  totalSymbols: number;
  avgSymbolsPerSheet: number;
  avgConfidence: number;
  byDiscipline: Record<string, number>;
} {
  const totalLegends = legends.length;
  const totalSymbols = legends.reduce((sum, l) => sum + l.legendEntries.length, 0);
  const avgSymbolsPerSheet = totalLegends > 0 ? totalSymbols / totalLegends : 0;
  const avgConfidence = totalLegends > 0 ? legends.reduce((sum, l) => sum + l.confidence, 0) / totalLegends : 0;

  const byDiscipline: Record<string, number> = {};
  for (const legend of legends) {
    const disc = legend.discipline || 'UNKNOWN';
    byDiscipline[disc] = (byDiscipline[disc] || 0) + legend.legendEntries.length;
  }

  return {
    totalLegends,
    totalSymbols,
    avgSymbolsPerSheet,
    avgConfidence,
    byDiscipline
  };
}
