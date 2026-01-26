/**
 * Document Batch Processor
 * Processes PDF pages in batches with multi-provider vision API
 */

import { prisma } from './db';
import { getFileUrl } from './s3';
import { analyzeWithMultiProvider, analyzeWithLoadBalancing, analyzeDocumentSmart, analyzeWithDirectPdf, analyzeWithSmartRouting, getProviderDisplayName, type VisionProvider } from './vision-api-multi-provider';
import { performQualityCheck, formatQualityReport, isBlankPage, type ExtractedData } from './vision-api-quality';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { convertSinglePage } from './pdf-to-image';

interface ProviderStat {
  pagesProcessed: number;
  totalTime: number; // in milliseconds
  avgTimePerPage: number; // in seconds
}

interface BatchResult {
  success: boolean;
  pagesProcessed: number;
  error?: string;
  providerStats?: Record<string, ProviderStat>;
}

/**
 * Process a batch of pages from a document
 * @param documentId Document ID
 * @param startPage Starting page (1-indexed)
 * @param endPage Ending page (1-indexed)
 * @param processorType Optional processor type from document classification for smart routing
 */
export async function processDocumentBatch(
  documentId: string,
  startPage: number,
  endPage: number,
  processorType?: string
): Promise<BatchResult> {
  let pagesProcessed = 0;
  const tempFiles: string[] = [];
  const providerStats: Record<string, ProviderStat> = {};

  try {
    console.log(`[BATCH] Processing document ${documentId} pages ${startPage}-${endPage}`);
    if (processorType) {
      console.log(`[BATCH] Document classification: ${processorType}`);
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        Project: {
          select: { ownerId: true },
        },
      },
    });

    if (!document || !document.cloud_storage_path) {
      throw new Error('Document not found');
    }

    // Use stored processorType if not provided as parameter
    const effectiveProcessorType = processorType || document.processorType || 'gpt-4o-vision';

    // Download PDF
    const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    const tempPdfPath = join(tmpdir(), `batch-${documentId}-${Date.now()}.pdf`);
    await writeFile(tempPdfPath, buffer);
    tempFiles.push(tempPdfPath);

    // Process each page in the batch
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      try {
        console.log(`[BATCH] Processing page ${pageNum}...`);

        // Use smart routing based on document classification
        const startTime = Date.now();
        const visionResult = await analyzeWithSmartRouting(
          buffer,
          getVisionPrompt(document.fileName, pageNum),
          effectiveProcessorType,
          pageNum,
          50 // Minimum quality score
        );
        const processingTime = Date.now() - startTime;

        let chunkContent = '';
        let metadata: any = {};

        if (visionResult.success && visionResult.content) {
          // Track which provider was used with timing
          const providerName = getProviderDisplayName(visionResult.provider);
          if (!providerStats[providerName]) {
            providerStats[providerName] = {
              pagesProcessed: 0,
              totalTime: 0,
              avgTimePerPage: 0,
            };
          }
          providerStats[providerName].pagesProcessed++;
          providerStats[providerName].totalTime += processingTime;
          providerStats[providerName].avgTimePerPage = 
            providerStats[providerName].totalTime / providerStats[providerName].pagesProcessed / 1000; // Convert to seconds

          // Parse vision response
          try {
            // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
            let contentToParse = visionResult.content;
            if (typeof contentToParse === 'string') {
              // Check for markdown code block wrappers: ```json ... ``` or ``` ... ```
              const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (jsonMatch) {
                contentToParse = jsonMatch[1].trim(); // Extract just the JSON content
                console.log(`[BATCH] 🔧 Stripped markdown wrapper from Claude response (page ${pageNum})`);
              }
            }
            
            const parsedData = typeof contentToParse === 'string' 
              ? JSON.parse(contentToParse)
              : contentToParse;
            
            // Perform quality check
            const qualityCheck = performQualityCheck(parsedData, pageNum);
            console.log(formatQualityReport(qualityCheck, pageNum));

            // Check if page is blank
            if (isBlankPage(parsedData)) {
              console.log(`[BATCH] ⚠️  Page ${pageNum} appears to be blank`);
            }
            
            chunkContent = formatVisionData(parsedData);
            metadata = {
              page: pageNum,
              source: 'vision-analysis',
              provider: visionResult.provider,
              providerDisplayName: getProviderDisplayName(visionResult.provider),
              confidenceScore: visionResult.confidenceScore,
              qualityScore: qualityCheck.score,
              qualityPassed: qualityCheck.passed,
              attempts: visionResult.attempts,
              ...extractMetadata(parsedData),
            };

            console.log(`[BATCH] ✅ Page ${pageNum} processed with ${getProviderDisplayName(visionResult.provider)} (quality: ${qualityCheck.score}/100, confidence: ${visionResult.confidenceScore}/100)`);
          } catch (parseError) {
            console.error(`Failed to parse vision response for page ${pageNum}:`, parseError);
            
            // Store raw response if parsing fails
            chunkContent = visionResult.content;
            metadata = {
              page: pageNum,
              source: 'vision-analysis-raw',
              provider: visionResult.provider,
              providerDisplayName: getProviderDisplayName(visionResult.provider),
              parseError: (parseError as Error).message,
            };
          }
        } else {
          // All providers failed - create error chunk
          console.error(`[BATCH] ❌ All providers failed for page ${pageNum}: ${visionResult.error}`);
          chunkContent = `PAGE: ${pageNum}\nCHUNK TYPE: PROCESSING FAILED\n\nAll vision providers failed to process this page.\nError: ${visionResult.error}\n\nManual review required.`;
          metadata = {
            page: pageNum,
            source: 'failed-processing',
            error: visionResult.error,
            attempts: visionResult.attempts,
          };
        }

        // Store chunk in database
        await prisma.documentChunk.create({
          data: {
            documentId,
            pageNumber: pageNum,
            chunkIndex: pageNum - 1,
            content: chunkContent,
            metadata,
          },
        });

        pagesProcessed++;
        console.log(`[BATCH] ✅ Page ${pageNum} processed successfully`);

      } catch (pageError: any) {
        console.error(`[BATCH] Error processing page ${pageNum}:`, pageError.message);
        
        // Create error chunk so we don't lose track of the page
        await prisma.documentChunk.create({
          data: {
            documentId,
            pageNumber: pageNum,
            chunkIndex: pageNum - 1,
            content: `PAGE: ${pageNum}\nERROR: ${pageError.message}`,
            metadata: {
              page: pageNum,
              source: 'error',
              error: pageError.message,
            },
          },
        });
        
        // Still count as processed (we created a chunk, even if with error)
        pagesProcessed++;
      }
    }

    console.log(`\n[BATCH] Provider usage summary:`);
    Object.entries(providerStats).forEach(([providerName, stats]) => {
      if (stats.pagesProcessed > 0) {
        console.log(`  - ${providerName}: ${stats.pagesProcessed} pages @ ${stats.avgTimePerPage.toFixed(1)}s/page`);
      }
    });

    return {
      success: true,
      pagesProcessed,
      providerStats,
    };

  } catch (error: any) {
    console.error(`[BATCH] Batch processing failed:`, error);
    return {
      success: false,
      pagesProcessed,
      error: error.message,
    };
  } finally {
    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) {
          await unlink(file);
        }
      } catch (cleanupError) {
        console.error(`Failed to cleanup ${file}:`, cleanupError);
      }
    }
  }
}

/**
 * Get vision analysis prompt
 */
function getVisionPrompt(fileName: string, pageNum: number): string {
  return `CONSTRUCTION DOCUMENT VISUAL ANALYSIS - Page ${pageNum} of ${fileName}

You are analyzing a construction document. This could be an architectural drawing, floor plan, elevation, section, detail, schedule, or specification page.

CRITICAL INSTRUCTIONS FOR MAXIMUM EXTRACTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EXAMINE THE ENTIRE PAGE VISUALLY:
   • Start with the title block (usually bottom-right corner or along border)
   • Scan the main drawing area systematically from left to right
   • Look for legends, keynotes, symbol lists (often on right side or bottom)
   • Check for general notes sections

2. FOR CONSTRUCTION DRAWINGS (PLANS/ELEVATIONS/DETAILS):
   • Identify ALL room names and numbers visible within the drawing
   • Extract ALL dimension strings exactly as shown (e.g., "15'-6\"", "4572mm")
   • List ALL door/window tags (D1, W2, etc.)
   • Record equipment and fixture tags/marks
   • Note section cuts and detail references (circles with numbers/letters)
   • Identify grid line references (A, B, C / 1, 2, 3)
   • Look for revision clouds or highlighted changes

3. FOR SCHEDULES AND TABLES:
   • Extract ALL rows and columns of data
   • Note headers and column names
   • Include quantities, sizes, materials, finishes

4. FOR SPECIFICATION PAGES:
   • Section numbers (CSI format: 01 00 00, 03 30 00)
   • Product specifications and standards
   • Referenced standards (ASTM, ANSI, UL)

RESPOND WITH VALID JSON:
{
  "sheetNumber": "exact sheet number from title block",
  "sheetTitle": "sheet title/description",
  "scale": "drawing scale(s) shown",
  "discipline": "Architectural|Structural|Mechanical|Electrical|Plumbing|Civil|General",
  "drawingType": "floor_plan|elevation|section|detail|schedule|specification|cover|site_plan",
  "dimensions": [{"value": "15'-6\"", "label": "room width"}],
  "rooms": [{"number": "101", "name": "LOBBY", "area": "450 SF"}],
  "doors": ["D1", "D2", "D3"],
  "windows": ["W1", "W2"],
  "gridLines": ["A", "B", "1", "2"],
  "notes": ["note 1 text", "note 2 text"],
  "legendEntries": [{"symbol": "description", "meaning": "meaning"}],
  "titleBlock": {"project": "", "drawn_by": "", "date": "", "revision": ""},
  "callouts": ["reference to other sheets/details"],
  "equipment": ["tag and description"],
  "scheduleData": [],
  "textContent": "any general text/specs visible"
}

IMPORTANT: Extract EVERYTHING visible. More data is better. If unsure about a value, include it with your best interpretation.`;
}

/**
 * Format vision data for storage - enhanced for RAG retrieval
 */
function formatVisionData(data: any): string {
  const lines: string[] = [];
  
  // Header info
  lines.push(`PAGE: ${data.page || 'Unknown'}`);
  
  if (data.sheetNumber) {
    lines.push(`SHEET NUMBER: ${data.sheetNumber}`);
  }
  
  if (data.sheetTitle) {
    lines.push(`SHEET TITLE: ${data.sheetTitle}`);
  }
  
  if (data.scale) {
    lines.push(`SCALE: ${data.scale}`);
  }
  
  if (data.discipline) {
    lines.push(`DISCIPLINE: ${data.discipline}`);
  }
  
  if (data.drawingType) {
    lines.push(`DRAWING TYPE: ${data.drawingType}`);
  }
  
  // Title block info
  if (data.titleBlock && typeof data.titleBlock === 'object') {
    const tb = data.titleBlock;
    if (tb.project) lines.push(`PROJECT: ${tb.project}`);
    if (tb.drawn_by) lines.push(`DRAWN BY: ${tb.drawn_by}`);
    if (tb.date) lines.push(`DATE: ${tb.date}`);
    if (tb.revision) lines.push(`REVISION: ${tb.revision}`);
  }
  
  // Grid lines
  if (data.gridLines?.length > 0) {
    lines.push('');
    lines.push(`GRID LINES: ${data.gridLines.join(', ')}`);
  }
  
  // Rooms - critical for RAG
  if (data.rooms?.length > 0) {
    lines.push('');
    lines.push('ROOMS:');
    data.rooms.forEach((r: any) => {
      const roomInfo = [r.number, r.name, r.area].filter(Boolean).join(' - ');
      lines.push(`  • ${roomInfo}`);
    });
  }
  
  // Dimensions
  if (data.dimensions?.length > 0) {
    lines.push('');
    lines.push('DIMENSIONS:');
    data.dimensions.forEach((d: any) => {
      if (typeof d === 'string') {
        lines.push(`  • ${d}`);
      } else {
        lines.push(`  • ${d.label || 'Dimension'}: ${d.value}`);
      }
    });
  }
  
  // Doors and Windows
  if (data.doors?.length > 0) {
    lines.push('');
    lines.push(`DOORS: ${data.doors.join(', ')}`);
  }
  
  if (data.windows?.length > 0) {
    lines.push('');
    lines.push(`WINDOWS: ${data.windows.join(', ')}`);
  }
  
  // Equipment
  if (data.equipment?.length > 0) {
    lines.push('');
    lines.push('EQUIPMENT:');
    data.equipment.forEach((eq: any) => {
      lines.push(`  • ${typeof eq === 'string' ? eq : eq.tag || eq.description || JSON.stringify(eq)}`);
    });
  }
  
  // Legend entries
  if (data.legendEntries?.length > 0) {
    lines.push('');
    lines.push('LEGEND:');
    data.legendEntries.forEach((entry: any) => {
      if (typeof entry === 'string') {
        lines.push(`  • ${entry}`);
      } else {
        lines.push(`  • ${entry.symbol}: ${entry.meaning}`);
      }
    });
  }
  
  // Notes
  if (data.notes?.length > 0) {
    lines.push('');
    lines.push('NOTES:');
    data.notes.forEach((note: string) => {
      lines.push(`  • ${note}`);
    });
  }
  
  // Callouts/References
  if (data.callouts?.length > 0) {
    lines.push('');
    lines.push('REFERENCES:');
    data.callouts.forEach((callout: string) => {
      lines.push(`  • ${callout}`);
    });
  }
  
  // Schedule data
  if (data.scheduleData?.length > 0) {
    lines.push('');
    lines.push('SCHEDULE DATA:');
    data.scheduleData.forEach((item: any) => {
      lines.push(`  • ${JSON.stringify(item)}`);
    });
  }
  
  // Text content (for specs)
  if (data.textContent) {
    lines.push('');
    lines.push('TEXT CONTENT:');
    lines.push(data.textContent);
  }
  
  return lines.join('\n');
}

/**
 * Extract metadata from vision response
 */
function extractMetadata(data: any): any {
  return {
    sheetNumber: data.sheetNumber || null,
    discipline: data.discipline || null,
    hasScale: !!data.scale,
    hasDimensions: (data.dimensions?.length || 0) > 0,
    roomsCount: data.rooms?.length || 0,
    notesCount: data.notes?.length || 0,
  };
}
