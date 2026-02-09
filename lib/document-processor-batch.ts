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
import { logger } from '@/lib/logger';

interface ProviderStat {
  pagesProcessed: number;
  totalTime: number; // in milliseconds
  avgTimePerPage: number; // in seconds
}

export interface BatchResult {
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
 * @param preloadedPdfBuffer Optional pre-downloaded PDF buffer to skip re-downloading (used for concurrent batch dispatch)
 */
export async function processDocumentBatch(
  documentId: string,
  startPage: number,
  endPage: number,
  processorType?: string,
  preloadedPdfBuffer?: Buffer
): Promise<BatchResult> {
  let pagesProcessed = 0;
  const tempFiles: string[] = [];
  const providerStats: Record<string, ProviderStat> = {};

  try {
    logger.info('BATCH_PROCESSOR', `Processing document ${documentId} pages ${startPage}-${endPage}`, { processorType: processorType || 'default', preloaded: !!preloadedPdfBuffer });

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
    const effectiveProcessorType = processorType || document.processorType || 'vision-ai';

    // Use preloaded buffer or download PDF
    let buffer: Buffer;
    if (preloadedPdfBuffer) {
      buffer = preloadedPdfBuffer;
      logger.info('BATCH_PROCESSOR', `Using preloaded PDF buffer (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      const fileUrl = await getFileUrl(document.cloud_storage_path, document.isPublic);
      const response = await fetch(fileUrl);
      buffer = Buffer.from(await response.arrayBuffer());
    }

    const tempPdfPath = join(tmpdir(), `batch-${documentId}-${Date.now()}.pdf`);
    await writeFile(tempPdfPath, buffer);
    tempFiles.push(tempPdfPath);

    // Clean up any existing chunks for this page range to prevent duplicates on retry/recovery
    await prisma.documentChunk.deleteMany({
      where: {
        documentId,
        pageNumber: { gte: startPage, lte: endPage },
      },
    });

    // Process each page in the batch
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      try {
        logger.info('BATCH_PROCESSOR', `Processing page ${pageNum}`);

        // Extract single page to avoid sending full PDF to vision API (OOM/oversized request)
        let pageBuffer = buffer;
        try {
          const { extractPageAsPdf } = await import('./pdf-to-image-serverless');
          const { base64: singlePageBase64 } = await extractPageAsPdf(buffer, pageNum);
          pageBuffer = Buffer.from(singlePageBase64, 'base64');
          logger.info('BATCH_PROCESSOR', `Extracted page ${pageNum} (${(pageBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
        } catch (extractErr: any) {
          logger.warn('BATCH_PROCESSOR', `Page extraction failed for page ${pageNum}, using full PDF`, { error: extractErr.message });
        }

        // Use smart routing based on document classification
        const startTime = Date.now();
        const visionResult = await analyzeWithSmartRouting(
          pageBuffer,
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
                logger.info('BATCH_PROCESSOR', `Stripped markdown wrapper from Claude response`, { pageNum });
              }
            }
            
            const parsedData = typeof contentToParse === 'string' 
              ? JSON.parse(contentToParse)
              : contentToParse;
            
            // Perform quality check
            const qualityCheck = performQualityCheck(parsedData, pageNum);
            logger.info('BATCH_PROCESSOR', formatQualityReport(qualityCheck, pageNum));

            // Check if page is blank
            if (isBlankPage(parsedData)) {
              logger.warn('BATCH_PROCESSOR', `Page ${pageNum} appears to be blank`);
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

            logger.info('BATCH_PROCESSOR', `Page ${pageNum} processed`, { provider: getProviderDisplayName(visionResult.provider), quality: qualityCheck.score, confidence: visionResult.confidenceScore });
          } catch (parseError) {
            logger.error('BATCH_PROCESSOR', `Failed to parse vision response for page ${pageNum}`, parseError as Error);
            
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
          logger.error('BATCH_PROCESSOR', `All providers failed for page ${pageNum}`, undefined, { error: visionResult.error });
          chunkContent = `PAGE: ${pageNum}\nCHUNK TYPE: PROCESSING FAILED\n\nAll vision providers failed to process this page.\nError: ${visionResult.error}\n\nManual review required.`;
          metadata = {
            page: pageNum,
            source: 'failed-processing',
            error: visionResult.error,
            attempts: visionResult.attempts,
            skipForRag: true,
            extractionError: visionResult.error,
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
        logger.info('BATCH_PROCESSOR', `Page ${pageNum} stored successfully`);

      } catch (pageError: any) {
        logger.error('BATCH_PROCESSOR', `Error processing page ${pageNum}`, pageError);

        // Create error chunk so we don't lose track of the page
        // Mark with skipForRag so RAG won't retrieve garbage content
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
              skipForRag: true,
              extractionError: pageError.message,
            },
          },
        });

        // Still count as processed (we created a chunk, even if with error)
        pagesProcessed++;
      }
    }

    logger.info('BATCH_PROCESSOR', 'Provider usage summary',
      Object.fromEntries(
        Object.entries(providerStats)
          .filter(([, stats]) => stats.pagesProcessed > 0)
          .map(([name, stats]) => [name, `${stats.pagesProcessed} pages @ ${stats.avgTimePerPage.toFixed(1)}s/page`])
      )
    );

    return {
      success: true,
      pagesProcessed,
      providerStats,
    };

  } catch (error: any) {
    logger.error('BATCH_PROCESSOR', 'Batch processing failed', error);
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
        logger.error('BATCH_PROCESSOR', `Failed to cleanup ${file}`, cleanupError as Error);
      }
    }
  }
}

/**
 * Get vision analysis prompt
 */
function getVisionPrompt(fileName: string, pageNum: number): string {
  return `CONSTRUCTION DOCUMENT ANALYSIS - Page ${pageNum} of ${fileName}

Analyze this construction document page. Extract ALL visible information across these categories.
Respond with valid JSON. Include only categories that apply to this page - omit empty/irrelevant sections.

EXTRACTION CATEGORIES:

1. TITLE BLOCK & SHEET INFO (bottom-right corner or border):
   - Sheet number, title, project name, drawn by, date, revision, checker
   - Drawing scale(s), discipline, drawing type

2. SPATIAL ELEMENTS:
   - Room names/numbers with areas if shown
   - ALL dimension strings WITH context: what is being measured
   - Heights: floor-to-floor, floor-to-ceiling, sill, header
   - Thicknesses: slab, wall, insulation
   - Spot elevations with locations
   - Level designations with elevations
   - Grid line labels and spacing
   - Slopes/grades as rise/run or percentage

3. MATERIAL IDENTIFICATION (from hatching/fill patterns):
   - Concrete (diagonal lines/stipple), steel (cross-hatch), masonry/CMU (running bond)
   - Insulation (wavy/cloud fill), wood (grain lines), earth (dot pattern)
   - Report: material type, hatching style, locations, confidence

4. LINE TYPE ANALYSIS:
   - Solid thick = load-bearing walls. Dashed = concealed/above/below
   - Demolition lines (marked for removal). New construction indicators
   - Centerlines, property lines, setback lines

5. PLUMBING FIXTURES:
   - Water closets, lavatories, urinals, floor drains, cleanouts, hose bibbs
   - Fixture tag/ID, room location, connection sizes, count per room

6. ELECTRICAL DEVICES:
   - Receptacles (duplex, GFCI, dedicated), switches (single/3-way/dimmer)
   - Light fixtures with type/tag/circuit, panels, transformers
   - Conduit sizes and routing paths

7. MECHANICAL/HVAC:
   - Ductwork: size, CFM, material. Diffusers/registers: type, size, CFM
   - Equipment: AHUs, RTUs, VAVs with tags and capacity
   - Piping: chilled/hot water, steam with sizes

8. FIRE PROTECTION:
   - Sprinkler heads: type, spacing, coverage, K-factor
   - Fire alarm: pull stations, detectors, horn/strobes
   - Fire dampers, standpipes, extinguisher locations

9. SYMBOLS & CROSS-REFERENCES:
   - Section cut markers (direction, reference sheet)
   - Detail callout bubbles (number, reference sheet)
   - Elevation markers, north arrow, scale bars
   - Revision clouds (rev number, location, what changed)
   - Match lines (drawing continuation)

10. CONSTRUCTION INTELLIGENCE:
    - Trades required for this page
    - Fire-rated assemblies (type, rating, location)
    - ADA/clearance zones
    - Construction phasing (demo vs new vs existing)

11. SCHEDULE TABLES (tabular data on drawings):
    - Door schedules, window schedules, finish schedules
    - Equipment schedules, fixture schedules
    - Structural member schedules, footing schedules
    - Extract: headers[], rows[][] for each table found

12. SITE & CONCRETE (if applicable):
    - Footings: size, depth, rebar. Slabs: thickness, reinforcement
    - Grading contours, utility trenches, pavement sections

13. SPECIFICATION REFERENCES:
    - CSI section callouts, building code references
    - Keynote numbers with definitions

14. ENHANCED SCALE:
    - Multiple scales per page with applicable areas
    - NTS (Not to Scale) detection
    - Metric vs imperial identification

15. SPECIAL DRAWING FEATURES:
    - General notes: flag as project-wide
    - Reflected ceiling plan data
    - Life safety: exit paths, occupancy loads
    - Roof drainage patterns

JSON RESPONSE FORMAT:
{
  "sheetNumber": "exact sheet number",
  "sheetTitle": "sheet title",
  "scale": "primary scale",
  "discipline": "Architectural|Structural|Mechanical|Electrical|Plumbing|Civil|Fire Protection|General",
  "drawingType": "floor_plan|elevation|section|detail|schedule|specification|cover|site_plan|reflected_ceiling|roof_plan|life_safety",
  "titleBlock": {"project": "", "drawn_by": "", "date": "", "revision": "", "checker": "", "sheet_of": ""},
  "dimensions": [{"value": "15'-6\\"", "label": "room width", "context": "Room 101", "type": "horizontal"}],
  "rooms": [{"number": "101", "name": "LOBBY", "area": "450 SF"}],
  "doors": ["D1", "D2"],
  "windows": ["W1", "W2"],
  "gridLines": ["A", "B", "1", "2"],
  "notes": ["note text"],
  "legendEntries": [{"symbol": "desc", "meaning": "meaning"}],
  "callouts": ["reference to other sheets"],
  "equipment": ["tag and description"],
  "scheduleData": [],
  "textContent": "visible text/specs",
  "visualMaterials": [{"material": "concrete", "hatchingType": "diagonal lines", "locations": ["foundation"], "confidence": 0.9}],
  "lineTypeAnalysis": {"demolitionElements": [], "newConstruction": [], "hiddenElements": [], "belowGrade": []},
  "plumbingFixtures": [{"type": "water_closet", "tag": "WC-1", "room": "101", "count": 1, "confidence": 0.85}],
  "electricalDevices": [{"type": "receptacle", "subtype": "duplex", "tag": "", "room": "101", "circuit": "", "count": 4, "confidence": 0.8}],
  "spatialData": {
    "contextualDimensions": [{"value": "15'-6\\"", "context": "Room 101 width", "type": "horizontal"}],
    "heights": [{"value": "9'-0\\"", "type": "floor_to_ceiling", "location": "Room 101"}],
    "thicknesses": [{"value": "8\\"", "element": "exterior wall", "location": "typical"}],
    "spotElevations": [{"value": "+100.00'", "type": "finished_floor", "location": "Room 101"}],
    "levels": [{"name": "Level 2", "elevation": "+14'-0\\""}],
    "gridSpacing": [{"from": "A", "to": "B", "distance": "24'-0\\""}],
    "slopes": [],
    "spacing": []
  },
  "symbolData": {
    "sectionCuts": [{"number": "1", "referenceSheet": "A3.01", "direction": "looking north"}],
    "detailCallouts": [{"number": "3", "referenceSheet": "A5.01"}],
    "elevationMarkers": [],
    "northArrow": null,
    "scaleBars": [],
    "revisionClouds": [{"revNumber": "C", "location": "column grid B/3", "description": "modified column spacing"}],
    "matchLines": []
  },
  "constructionIntel": {
    "tradesRequired": ["Architectural", "Mechanical"],
    "fireRatedAssemblies": [{"type": "wall", "rating": "2-hour", "location": "corridor"}],
    "coordinationPoints": [],
    "clearanceZones": [],
    "phasing": {"demo": [], "new": [], "existing": []}
  },
  "drawingScheduleTables": [{"scheduleType": "door", "headers": ["Door No", "Type", "Size"], "rows": [["D101", "A", "3070"]], "sourceArea": "right side of sheet"}],
  "hvacData": {"ductwork": [], "diffusers": [], "equipment": [], "piping": [], "controls": []},
  "fireProtection": {"sprinklerHeads": [], "alarmDevices": [], "dampers": [], "standpipes": []},
  "siteAndConcrete": {"footings": [], "slabDetails": [], "rebarSchedule": [], "gradingData": null},
  "references": {"specSections": [], "codeReferences": [], "keynotes": []},
  "enhancedScaleData": {"scales": [{"value": "1/4\\" = 1'-0\\"", "applicableArea": "main plan", "isNTS": false}]},
  "specialDrawingData": {"isGeneralNotes": false, "ceilingPlan": null, "lifeSafety": null}
}

IMPORTANT: Extract EVERYTHING visible. Omit categories with no data rather than including empty arrays. More data is better.`;
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

  // Visual Materials
  if (data.visualMaterials?.length > 0) {
    lines.push('');
    lines.push('VISUAL MATERIALS:');
    data.visualMaterials.forEach((m: any) => {
      lines.push(`  • ${m.material} (${m.hatchingType}) at ${(m.locations || []).join(', ')}`);
    });
  }

  // Line Type Analysis
  if (data.lineTypeAnalysis) {
    const lta = data.lineTypeAnalysis;
    const parts: string[] = [];
    if (lta.demolitionElements?.length) parts.push(`${lta.demolitionElements.length} demolition elements`);
    if (lta.newConstruction?.length) parts.push(`${lta.newConstruction.length} new construction elements`);
    if (lta.hiddenElements?.length) parts.push(`${lta.hiddenElements.length} hidden elements`);
    if (lta.belowGrade?.length) parts.push(`${lta.belowGrade.length} below-grade elements`);
    if (parts.length > 0) {
      lines.push('');
      lines.push(`LINE ANALYSIS: ${parts.join(', ')}`);
    }
  }

  // Plumbing Fixtures
  if (data.plumbingFixtures?.length > 0) {
    lines.push('');
    lines.push('PLUMBING FIXTURES:');
    data.plumbingFixtures.forEach((f: any) => {
      lines.push(`  • ${f.tag || f.type} (${f.type}, Room ${f.room || 'unknown'})`);
    });
  }

  // Electrical Devices
  if (data.electricalDevices?.length > 0) {
    lines.push('');
    lines.push('ELECTRICAL DEVICES:');
    // Summarize by type
    const typeCounts: Record<string, number> = {};
    data.electricalDevices.forEach((d: any) => {
      const key = d.subtype ? `${d.type} (${d.subtype})` : d.type;
      typeCounts[key] = (typeCounts[key] || 0) + (d.count || 1);
    });
    Object.entries(typeCounts).forEach(([type, count]) => {
      lines.push(`  • ${count}x ${type}`);
    });
  }

  // Spatial Data
  if (data.spatialData) {
    const sd = data.spatialData;
    if (sd.contextualDimensions?.length > 0 || sd.heights?.length > 0 || sd.spotElevations?.length > 0) {
      lines.push('');
      lines.push('SPATIAL DATA:');
      sd.contextualDimensions?.forEach((d: any) => {
        lines.push(`  • ${d.context}: ${d.value} (${d.type})`);
      });
      sd.heights?.forEach((h: any) => {
        lines.push(`  • ${h.type}: ${h.value} at ${h.location}`);
      });
      sd.spotElevations?.forEach((e: any) => {
        lines.push(`  • Spot elevation: ${e.value} (${e.type}) at ${e.location}`);
      });
      sd.levels?.forEach((l: any) => {
        lines.push(`  • Level: ${l.name} = ${l.elevation}`);
      });
      sd.gridSpacing?.forEach((g: any) => {
        lines.push(`  • Grid ${g.from} to ${g.to}: ${g.distance}`);
      });
    }
  }

  // Construction Intelligence
  if (data.constructionIntel) {
    const ci = data.constructionIntel;
    if (ci.tradesRequired?.length > 0) {
      lines.push('');
      lines.push(`TRADES: ${ci.tradesRequired.join(', ')}`);
    }
    if (ci.fireRatedAssemblies?.length > 0) {
      lines.push('');
      lines.push('FIRE RATED:');
      ci.fireRatedAssemblies.forEach((a: any) => {
        lines.push(`  • ${a.rating} ${a.type} at ${a.location}`);
      });
    }
  }

  // Symbol Data
  if (data.symbolData) {
    const sym = data.symbolData;
    if (sym.revisionClouds?.length > 0) {
      lines.push('');
      lines.push('REVISION CLOUDS:');
      sym.revisionClouds.forEach((r: any) => {
        lines.push(`  • Rev ${r.revNumber} - ${r.description} at ${r.location}`);
      });
    }
    if (sym.sectionCuts?.length > 0 || sym.detailCallouts?.length > 0) {
      lines.push('');
      lines.push('CROSS REFERENCES:');
      sym.sectionCuts?.forEach((s: any) => {
        lines.push(`  • Section ${s.number}/${s.referenceSheet}`);
      });
      sym.detailCallouts?.forEach((d: any) => {
        lines.push(`  • Detail ${d.number}/${d.referenceSheet}`);
      });
    }
  }

  // Drawing Schedule Tables
  if (data.drawingScheduleTables?.length > 0) {
    data.drawingScheduleTables.forEach((table: any) => {
      lines.push('');
      lines.push(`SCHEDULE TABLE [${(table.scheduleType || 'unknown').toUpperCase()}]:`);
      if (table.headers?.length > 0) {
        lines.push(`  Headers: ${table.headers.join(' | ')}`);
      }
      table.rows?.forEach((row: any) => {
        lines.push(`  ${Array.isArray(row) ? row.join(' | ') : JSON.stringify(row)}`);
      });
    });
  }

  // HVAC Data
  if (data.hvacData) {
    const hvac = data.hvacData;
    const items: string[] = [];
    if (hvac.ductwork?.length) items.push(`${hvac.ductwork.length} duct segments`);
    if (hvac.diffusers?.length) items.push(`${hvac.diffusers.length} diffusers`);
    if (hvac.equipment?.length) items.push(`${hvac.equipment.length} units`);
    if (items.length > 0) {
      lines.push('');
      lines.push(`HVAC: ${items.join(', ')}`);
    }
  }

  // Fire Protection
  if (data.fireProtection) {
    const fp = data.fireProtection;
    const items: string[] = [];
    if (fp.sprinklerHeads?.length) items.push(`${fp.sprinklerHeads.length} sprinkler heads`);
    if (fp.alarmDevices?.length) items.push(`${fp.alarmDevices.length} alarm devices`);
    if (fp.dampers?.length) items.push(`${fp.dampers.length} fire dampers`);
    if (items.length > 0) {
      lines.push('');
      lines.push(`FIRE PROTECTION: ${items.join(', ')}`);
    }
  }

  // Site & Concrete
  if (data.siteAndConcrete) {
    const sc = data.siteAndConcrete;
    const items: string[] = [];
    if (sc.footings?.length) items.push(`${sc.footings.length} footings`);
    if (sc.slabDetails?.length) items.push(`${sc.slabDetails.length} slab details`);
    if (sc.rebarSchedule?.length) items.push(`${sc.rebarSchedule.length} rebar entries`);
    if (items.length > 0) {
      lines.push('');
      lines.push(`CONCRETE/SITE: ${items.join(', ')}`);
    }
  }

  // References
  if (data.references) {
    const refs = data.references;
    if (refs.specSections?.length > 0 || refs.codeReferences?.length > 0) {
      lines.push('');
      lines.push('REFERENCES:');
      refs.specSections?.forEach((s: any) => lines.push(`  • Spec: ${s}`));
      refs.codeReferences?.forEach((c: any) => lines.push(`  • Code: ${c}`));
      refs.keynotes?.forEach((k: any) => lines.push(`  • Keynote: ${typeof k === 'string' ? k : `${k.number}: ${k.definition}`}`));
    }
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
    rooms: data.rooms || null,
    notesCount: data.notes?.length || 0,
    // Enhanced extraction metadata
    visualMaterials: data.visualMaterials || null,
    lineTypeAnalysis: data.lineTypeAnalysis || null,
    plumbingFixtures: data.plumbingFixtures || null,
    electricalDevices: data.electricalDevices || null,
    spatialData: data.spatialData || null,
    symbolData: data.symbolData || null,
    constructionIntel: data.constructionIntel || null,
    drawingScheduleTables: data.drawingScheduleTables || null,
    hvacData: data.hvacData || null,
    fireProtection: data.fireProtection || null,
    siteAndConcrete: data.siteAndConcrete || null,
    references: data.references || null,
    enhancedScaleData: data.enhancedScaleData || null,
    specialDrawingData: data.specialDrawingData || null,
  };
}
