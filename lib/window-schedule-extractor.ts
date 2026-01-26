/**
 * Window Schedule Extractor
 * 
 * Extracts detailed window schedule data from architectural drawings:
 * - Window numbers, marks, and types
 * - Physical dimensions (width, height, sill height)
 * - Materials (frame, glass, glazing type)
 * - Performance specs (U-value, SHGC)
 * - Operation types (fixed, casement, double-hung, sliding)
 * - Code compliance (egress, fire rating)
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExtractedWindow {
  windowNumber: string;
  windowMark?: string;
  windowType: string;
  roomNumber?: string;
  elevation?: string;
  width?: string;
  height?: string;
  roughOpeningW?: string;
  roughOpeningH?: string;
  sillHeight?: string;
  headHeight?: string;
  frameMaterial?: string;
  frameFinish?: string;
  glazingType?: string;
  glassType?: string;
  glassThickness?: string;
  uValue?: number;
  shgc?: number;
  operationType?: string;
  hardwareFinish?: string;
  screenType?: string;
  fireRating?: string;
  egressCompliant?: boolean;
  manufacturer?: string;
  modelNumber?: string;
  notes?: string;
  sourceSheet?: string;
}

export interface WindowScheduleExtractionResult {
  windows: ExtractedWindow[];
  windowTypes: Record<string, string>;
  glassTypes: Record<string, string>;
  sourceDocument?: string;
  extractedAt: Date;
}

// ============================================================================
// WINDOW SCHEDULE EXTRACTION
// ============================================================================

/**
 * Extract window schedule from document text using LLM
 */
export async function extractWindowScheduleFromText(
  documentText: string,
  sourceSheetNumber?: string
): Promise<WindowScheduleExtractionResult> {
  const prompt = `You are a construction document expert. Extract all window schedule information from this document.

Focus on:
1. Window Schedule tables (typically show mark, width, height, type, frame material)
2. Window Type Legend (shows codes like "W-1", "W-2" with descriptions)
3. Glazing specifications (Low-E, insulated, tempered, laminated)
4. Performance ratings (U-value, SHGC, VT)
5. Operation types (Fixed, Casement, Double Hung, Sliding, Awning)
6. Egress compliance markings

Return a JSON object with this structure:
{
  "windows": [
    {
      "windowNumber": "W-1",
      "windowMark": "A",
      "windowType": "FIXED ALUMINUM WINDOW",
      "roomNumber": "101",
      "elevation": "NORTH",
      "width": "4'-0\"",
      "height": "5'-0\"",
      "roughOpeningW": "4'-2\"",
      "roughOpeningH": "5'-2\"",
      "sillHeight": "3'-0\"",
      "headHeight": "8'-0\"",
      "frameMaterial": "ALUMINUM",
      "frameFinish": "ANODIZED BRONZE",
      "glazingType": "INSULATED",
      "glassType": "LOW-E CLEAR",
      "glassThickness": "1\"",
      "uValue": 0.30,
      "shgc": 0.25,
      "operationType": "FIXED",
      "hardwareFinish": "BRONZE",
      "screenType": "FULL",
      "fireRating": null,
      "egressCompliant": false,
      "manufacturer": "KAWNEER",
      "modelNumber": "4500",
      "notes": "SEE DETAIL 3/A5.1"
    }
  ],
  "windowTypes": {
    "A": "FIXED ALUMINUM FRAME",
    "B": "OPERABLE CASEMENT"
  },
  "glassTypes": {
    "1": "1\" INSULATED LOW-E",
    "2": "TEMPERED SAFETY GLASS"
  }
}

Document text:
${documentText.substring(0, 15000)}`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, max_tokens: 4000 }
    );

    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[WindowScheduleExtractor] No valid JSON found in response');
      return { windows: [], windowTypes: {}, glassTypes: {}, extractedAt: new Date() };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Add source sheet to all windows
    const windows = (parsed.windows || []).map((window: ExtractedWindow) => ({
      ...window,
      sourceSheet: sourceSheetNumber || window.sourceSheet,
    }));

    return {
      windows,
      windowTypes: parsed.windowTypes || {},
      glassTypes: parsed.glassTypes || {},
      extractedAt: new Date(),
    };
  } catch (error) {
    console.error('[WindowScheduleExtractor] Extraction failed:', error);
    return { windows: [], windowTypes: {}, glassTypes: {}, extractedAt: new Date() };
  }
}

/**
 * Store extracted window schedule data in the database
 */
export async function storeWindowScheduleData(
  projectId: string,
  extractionResult: WindowScheduleExtractionResult,
  sourceDocumentId?: string
): Promise<{ created: number; updated: number; errors: string[] }> {
  const stats = { created: 0, updated: 0, errors: [] as string[] };

  for (const window of extractionResult.windows) {
    try {
      // Try to find room by room number for linking
      let roomId: string | undefined;
      if (window.roomNumber) {
        const room = await prisma.room.findFirst({
          where: {
            projectId,
            OR: [
              { roomNumber: window.roomNumber },
              { name: { contains: window.roomNumber } },
            ],
          },
        });
        if (room) roomId = room.id;
      }

      // Upsert window schedule item
      await prisma.windowScheduleItem.upsert({
        where: {
          projectId_windowNumber: {
            projectId,
            windowNumber: window.windowNumber,
          },
        },
        create: {
          projectId,
          roomId,
          windowNumber: window.windowNumber,
          windowMark: window.windowMark,
          windowType: window.windowType,
          roomNumber: window.roomNumber,
          elevation: window.elevation,
          width: window.width,
          height: window.height,
          roughOpeningW: window.roughOpeningW,
          roughOpeningH: window.roughOpeningH,
          sillHeight: window.sillHeight,
          headHeight: window.headHeight,
          frameMaterial: window.frameMaterial,
          frameFinish: window.frameFinish,
          glazingType: window.glazingType,
          glassType: window.glassType,
          glassThickness: window.glassThickness,
          uValue: window.uValue,
          shgc: window.shgc,
          operationType: window.operationType,
          hardwareFinish: window.hardwareFinish,
          screenType: window.screenType,
          fireRating: window.fireRating,
          egressCompliant: window.egressCompliant || false,
          manufacturer: window.manufacturer,
          modelNumber: window.modelNumber,
          notes: window.notes,
          sourceDocumentId,
          sourceSheetNumber: window.sourceSheet,
        },
        update: {
          roomId,
          windowMark: window.windowMark,
          windowType: window.windowType,
          roomNumber: window.roomNumber,
          elevation: window.elevation,
          width: window.width,
          height: window.height,
          roughOpeningW: window.roughOpeningW,
          roughOpeningH: window.roughOpeningH,
          sillHeight: window.sillHeight,
          headHeight: window.headHeight,
          frameMaterial: window.frameMaterial,
          frameFinish: window.frameFinish,
          glazingType: window.glazingType,
          glassType: window.glassType,
          glassThickness: window.glassThickness,
          uValue: window.uValue,
          shgc: window.shgc,
          operationType: window.operationType,
          hardwareFinish: window.hardwareFinish,
          screenType: window.screenType,
          fireRating: window.fireRating,
          egressCompliant: window.egressCompliant || false,
          manufacturer: window.manufacturer,
          modelNumber: window.modelNumber,
          notes: window.notes,
          sourceDocumentId,
          sourceSheetNumber: window.sourceSheet,
        },
      });

      stats.created++;
    } catch (error) {
      const errorMsg = `Failed to store window ${window.windowNumber}: ${error}`;
      console.error('[WindowScheduleExtractor]', errorMsg);
      stats.errors.push(errorMsg);
    }
  }

  console.log(`[WindowScheduleExtractor] Stored ${stats.created} windows for project ${projectId}`);
  return stats;
}

/**
 * Get window schedule context for RAG queries
 */
export async function getWindowScheduleContext(projectSlug: string): Promise<string | null> {
  try {
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });

    if (!project) return null;

    const windows = await prisma.windowScheduleItem.findMany({
      where: { projectId: project.id },
      orderBy: { windowNumber: 'asc' },
    });

    if (windows.length === 0) return null;

    // Build context string
    let context = `=== WINDOW SCHEDULE (${windows.length} windows) ===\n\n`;

    // Group by operation type for summary
    const byOperationType: Record<string, typeof windows> = {};
    windows.forEach((window) => {
      const opType = window.operationType || 'Unspecified';
      if (!byOperationType[opType]) byOperationType[opType] = [];
      byOperationType[opType].push(window);
    });

    context += 'Operation Type Summary:\n';
    Object.entries(byOperationType).forEach(([opType, windowList]) => {
      context += `  ${opType}: ${windowList.length} windows\n`;
    });
    context += '\n';

    // Group by glazing type
    const byGlazing: Record<string, number> = {};
    windows.forEach((window) => {
      const glazing = window.glazingType || 'Unspecified';
      byGlazing[glazing] = (byGlazing[glazing] || 0) + 1;
    });

    context += 'Glazing Type Summary:\n';
    Object.entries(byGlazing).forEach(([glazing, count]) => {
      context += `  ${glazing}: ${count} windows\n`;
    });
    context += '\n';

    // List all windows
    context += 'Window Details:\n';
    windows.forEach((window) => {
      context += `  ${window.windowNumber}: ${window.windowType}`;
      if (window.width && window.height) context += ` (${window.width} x ${window.height})`;
      if (window.operationType) context += ` [${window.operationType}]`;
      if (window.roomNumber) context += ` @ Room ${window.roomNumber}`;
      if (window.egressCompliant) context += ' [EGRESS]';
      if (window.manufacturer) context += ` - ${window.manufacturer}`;
      context += '\n';
    });

    return context;
  } catch (error) {
    console.error('[WindowScheduleExtractor] Failed to get context:', error);
    return null;
  }
}

/**
 * Extract and store window schedule from a project's documents
 */
export async function processWindowScheduleForProject(
  projectId: string,
  documentId?: string
): Promise<{ success: boolean; windowsExtracted: number; errors: string[] }> {
  try {
    // Get architectural documents that likely contain window schedules
    const whereClause: any = {
      projectId,
      deletedAt: null,
      OR: [
        { name: { contains: 'window', mode: 'insensitive' } },
        { name: { contains: 'schedule', mode: 'insensitive' } },
        { name: { contains: 'architectural', mode: 'insensitive' } },
        { name: { contains: 'elevation', mode: 'insensitive' } },
        { category: 'ARCHITECTURAL' },
      ],
    };

    if (documentId) {
      whereClause.id = documentId;
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        DocumentChunk: {
          where: {
            OR: [
              { content: { contains: 'window schedule', mode: 'insensitive' } },
              { content: { contains: 'window type', mode: 'insensitive' } },
              { content: { contains: 'glazing', mode: 'insensitive' } },
              { content: { contains: 'sill height', mode: 'insensitive' } },
            ],
          },
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    let totalWindows = 0;
    const allErrors: string[] = [];

    for (const doc of documents) {
      if (doc.DocumentChunk.length === 0) continue;

      // Combine relevant chunks
      const combinedText = doc.DocumentChunk.map((chunk) => chunk.content).join('\n\n');

      // Extract window schedule
      const extraction = await extractWindowScheduleFromText(
        combinedText,
        doc.DocumentChunk[0]?.sheetNumber || undefined
      );

      if (extraction.windows.length > 0) {
        const result = await storeWindowScheduleData(projectId, extraction, doc.id);
        totalWindows += result.created;
        allErrors.push(...result.errors);
      }
    }

    return {
      success: allErrors.length === 0,
      windowsExtracted: totalWindows,
      errors: allErrors,
    };
  } catch (error) {
    console.error('[WindowScheduleExtractor] Processing failed:', error);
    return {
      success: false,
      windowsExtracted: 0,
      errors: [String(error)],
    };
  }
}
