/**
 * Phase 3 Context Module
 *
 * Contains functions for retrieving Phase 3 structured data (rooms, materials,
 * MEP equipment, symbols, isometric views, path analysis) and generating
 * enhanced context prompts with all intelligence layers.
 *
 * Functions:
 * - retrievePhase3Context
 * - generateContextWithPhase3
 */

import { prisma } from '@/lib/db';
import { getTakeoffContext, detectTakeoffQuery } from '@/lib/takeoff-memory-service';
import { getBIMContext } from '@/lib/bim-rag-indexer';
import { getMEPScheduleContext } from '@/lib/mep-schedule-extractor';
import { getDoorScheduleContext } from '@/lib/door-schedule-extractor';
import { getWindowScheduleContext } from '@/lib/window-schedule-extractor';
import { logger } from '@/lib/logger';
import type {
  AdminCorrection,
  ChunkMetadata,
  CriticalPath,
  DocumentChunk,
  Phase3ContextData,
} from './core-types';
import { generateContextWithCorrections } from './regulatory-retrieval';
import {
  isSymbolQuery,
  getLegendContext,
  isScaleQuery,
  getScaleContext,
  isDrawingTypeQuery,
  getDrawingTypeContext,
  retrievePhaseBContext,
  getPhaseBRAGInstructions,
} from './intelligence-queries';

/**
 * Retrieve Phase 3 structured data (rooms, materials, MEP equipment)
 * to enrich the AI's contextual understanding
 */
export async function retrievePhase3Context(
  query: string,
  projectSlug: string
): Promise<Phase3ContextData> {
  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });

    if (!project) {
      return {};
    }

    const phase3Data: Phase3ContextData = {};
    const queryLower = query.toLowerCase();

    // Detect if query is about rooms/spaces
    const roomKeywords = [
      'room', 'space', 'floor', 'area', 'location', 'where',
      'office', 'bathroom', 'mechanical', 'conference', 'storage'
    ];
    const isRoomQuery = roomKeywords.some(kw => queryLower.includes(kw));

    if (isRoomQuery) {
      const rooms = await prisma.room.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          name: true,
          roomNumber: true,
          type: true,
          floorNumber: true,
          area: true,
          status: true
        },
        take: 20 // Limit to prevent context overflow
      });
      phase3Data.rooms = rooms;
    }

    // Detect if query is about materials/costs/quantities
    const materialKeywords = [
      'material', 'cost', 'quantity', 'how much', 'how many',
      'concrete', 'steel', 'lumber', 'drywall', 'paint',
      'budget', 'estimate', 'price', 'takeoff'
    ];
    const isMaterialQuery = materialKeywords.some(kw => queryLower.includes(kw));

    if (isMaterialQuery) {
      const takeoffs = await prisma.materialTakeoff.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          name: true,
          description: true,
          TakeoffLineItem: {
            select: {
              description: true,
              quantity: true,
              unit: true,
              unitCost: true,
              totalCost: true
            }
          }
        },
        take: 10 // Limit takeoffs
      });
      phase3Data.materials = takeoffs.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        lineItems: t.TakeoffLineItem || []
      }));
    }

    // Detect if query is about MEP equipment
    const mepKeywords = [
      'hvac', 'electrical', 'plumbing', 'mechanical', 'equipment',
      'ahu', 'rtu', 'vav', 'fcu', 'panel', 'mcc', 'mdb',
      'fixture', 'sprinkler', 'pump', 'fan', 'unit'
    ];
    const isMEPQuery = mepKeywords.some(kw => queryLower.includes(kw));

    if (isMEPQuery) {
      // Get MEP data from document chunks metadata
      const mepChunks = await prisma.documentChunk.findMany({
        where: {
          Document: {
            projectId: project.id
          }
        },
        select: {
          metadata: true
        },
        take: 500
      });

      // Aggregate MEP callouts
      const mepMap = new Map<string, { trade: string; count: number }>();

      mepChunks.forEach((chunk) => {
        const metadata = chunk.metadata as ChunkMetadata | null;
        if (metadata?.mepCallouts) {
          const callouts = Array.isArray(metadata.mepCallouts)
            ? metadata.mepCallouts
            : [];

          callouts.forEach((callout) => {
            const upper = callout.toUpperCase();
            let trade = 'Other';

            if (upper.includes('AHU') || upper.includes('RTU') ||
                upper.includes('VAV') || upper.includes('FCU')) {
              trade = 'HVAC';
            } else if (upper.includes('MDP') || upper.includes('LP') ||
                       upper.includes('RP') || upper.includes('PANEL')) {
              trade = 'Electrical';
            } else if (upper.includes('WC') || upper.includes('LAV') ||
                       upper.includes('UR') || upper.includes('SINK')) {
              trade = 'Plumbing';
            } else if (upper.includes('FACP') || upper.includes('SD') ||
                       upper.includes('HS') || upper.includes('SPRINKLER')) {
              trade = 'Fire Protection';
            }

            const key = `${callout}|${trade}`;
            const existing = mepMap.get(key);
            if (existing) {
              existing.count++;
            } else {
              mepMap.set(key, { trade, count: 1 });
            }
          });
        }
      });

      // Convert to array
      phase3Data.mepEquipment = Array.from(mepMap.entries())
        .map(([key, data]) => ({
          callout: key.split('|')[0],
          trade: data.trade,
          count: data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30); // Top 30 items
    }

    // Detect if query is about symbols/patterns/callouts
    const symbolKeywords = [
      'symbol', 'pattern', 'callout', 'legend', 'notation',
      'marking', 'designation', 'identifier', 'label'
    ];
    const isSymbolQueryLocal = symbolKeywords.some(kw => queryLower.includes(kw));

    if (isSymbolQueryLocal) {
      try {
        const { getSymbolStatistics } = await import('@/lib/symbol-learner');
        const symbolStats = await getSymbolStatistics(projectSlug);
        phase3Data.symbols = symbolStats.topSymbols;
      } catch (error) {
        logger.error('RAG', 'Symbol learning error', error as Error);
      }
    }

    // Detect if query is about isometric/3D views/riser diagrams
    const isometricKeywords = [
      'isometric', '3d', 'riser', 'vertical', 'axonometric',
      'elevation', 'height', 'clearance', 'routing'
    ];
    const isIsometricQuery = isometricKeywords.some(kw => queryLower.includes(kw));

    if (isIsometricQuery) {
      try {
        // Isometric view detection available via API
        // Future: Integrate directly here for richer context
        phase3Data.isometricViews = [];
      } catch (error) {
        logger.error('RAG', 'Isometric interpretation error', error as Error);
      }
    }

    // Detect if query is about MEP routing/paths/connections
    const pathKeywords = [
      'path', 'route', 'routing', 'connection', 'connected',
      'from', 'to', 'between', 'distance', 'conflict'
    ];
    const isPathQuery = pathKeywords.some(kw => queryLower.includes(kw)) && isMEPQuery;

    if (isPathQuery) {
      try {
        // MEP path analysis available via API
        // Future: Integrate directly here for richer context
        phase3Data.pathAnalysis = undefined;
      } catch (error) {
        logger.error('RAG', 'Path tracing error', error as Error);
      }
    }

    return phase3Data;
  } catch (error) {
    logger.error('RAG', 'Error retrieving Phase 3 context', error as Error);
    return {};
  }
}

/**
 * Generate enhanced context with Phase 3 structured data
 */
export async function generateContextWithPhase3(
  chunks: DocumentChunk[],
  corrections: AdminCorrection[],
  query: string,
  projectSlug: string
): Promise<string> {
  // Get base context
  let prompt = await generateContextWithCorrections(chunks, corrections);

  // Get Phase 3 data
  const phase3Data = await retrievePhase3Context(query, projectSlug);

  // Add Phase 3 context sections
  if (phase3Data.rooms && phase3Data.rooms.length > 0) {
    prompt += '\n\n=== PROJECT ROOMS & SPACES ===\n';
    prompt += 'The following rooms are tracked in this project:\n\n';

    phase3Data.rooms.forEach(room => {
      const roomNum = room.roomNumber ? ` [${room.roomNumber}]` : '';
      const floor = room.floorNumber ? ` (Floor ${room.floorNumber})` : '';
      const areaInfo = room.area ? ` | ${room.area.toFixed(0)} sq ft` : '';
      const statusIcon = room.status === 'completed' ? '\u2705' :
                        room.status === 'in_progress' ? '\u{1F6A7}' : '\u2B1C';

      prompt += `${statusIcon} ${room.name}${roomNum}${floor} [${room.type}]${areaInfo}\n`;
    });

    prompt += '\n\u2139\uFE0F Use this room data to provide location-specific answers.\n';
    prompt += 'Mention specific rooms when relevant to the question.\n';
  }

  // Enhanced material takeoff context with comprehensive data
  const takeoffDetection = detectTakeoffQuery(query);
  if (takeoffDetection.isTakeoffQuery) {
    try {
      const takeoffContext = await getTakeoffContext(query, projectSlug);
      if (takeoffContext && takeoffContext.items.length > 0) {
        prompt += '\n\n' + takeoffContext.formattedContext;
      }
    } catch (error) {
      logger.error('RAG', 'Error getting takeoff context', error as Error);
      // Fall back to basic material data if enhanced service fails
      if (phase3Data.materials && phase3Data.materials.length > 0) {
        prompt += '\n\n=== MATERIAL TAKEOFF DATA ===\n';
        prompt += 'The following materials have been quantified for this project:\n\n';

        phase3Data.materials.forEach(takeoff => {
          const desc = takeoff.description ? ` - ${takeoff.description}` : '';
          prompt += `\u{1F4E6} ${takeoff.name}${desc}:\n`;

          takeoff.lineItems.forEach(item => {
            const cost = item.totalCost
              ? ` ($${item.totalCost.toFixed(2)})`
              : '';
            prompt += `  \u2022 ${item.description}: ${item.quantity} ${item.unit}${cost}\n`;
          });
          prompt += '\n';
        });

        prompt += '\u2139\uFE0F Use this takeoff data for cost and quantity questions.\n';
        prompt += 'Cite specific quantities and costs when answering material-related queries.\n';
      }
    }
  } else if (phase3Data.materials && phase3Data.materials.length > 0) {
    // Non-takeoff query but materials available - provide basic summary
    prompt += '\n\n=== MATERIAL TAKEOFF DATA ===\n';
    prompt += 'The following materials have been quantified for this project:\n\n';

    phase3Data.materials.forEach(takeoff => {
      const desc = takeoff.description ? ` - ${takeoff.description}` : '';
      prompt += `\u{1F4E6} ${takeoff.name}${desc}:\n`;

      takeoff.lineItems.forEach(item => {
        const cost = item.totalCost
          ? ` ($${item.totalCost.toFixed(2)})`
          : '';
        prompt += `  \u2022 ${item.description}: ${item.quantity} ${item.unit}${cost}\n`;
      });
      prompt += '\n';
    });

    prompt += '\u2139\uFE0F Use this takeoff data for cost and quantity questions.\n';
    prompt += 'Cite specific quantities and costs when answering material-related queries.\n';
  }

  if (phase3Data.mepEquipment && phase3Data.mepEquipment.length > 0) {
    prompt += '\n\n=== MEP EQUIPMENT INVENTORY ===\n';
    prompt += 'The following MEP equipment has been identified in the plans:\n\n';

    const byTrade = phase3Data.mepEquipment.reduce((acc, item) => {
      if (!acc[item.trade]) acc[item.trade] = [];
      acc[item.trade].push(item);
      return acc;
    }, {} as Record<string, typeof phase3Data.mepEquipment>);

    Object.entries(byTrade).forEach(([trade, items]) => {
      const tradeIcon = trade === 'HVAC' ? '\u2744\uFE0F' :
                       trade === 'Electrical' ? '\u26A1' :
                       trade === 'Plumbing' ? '\u{1F4A7}' :
                       trade === 'Fire Protection' ? '\u{1F525}' : '\u{1F527}';

      prompt += `${tradeIcon} ${trade}:\n`;
      items.forEach(item => {
        prompt += `  \u2022 ${item.callout}${item.count > 1 ? ` (${item.count} units)` : ''}\n`;
      });
      prompt += '\n';
    });

    prompt += '\u2139\uFE0F Use this MEP data for equipment and system questions.\n';
    prompt += 'Reference specific equipment tags when discussing systems.\n';
  }

  // Add Phase 3 AI instructions
  if (Object.keys(phase3Data).length > 0) {
    prompt += '\n\n\u{1F4CA} PHASE 3 INTELLIGENCE USAGE:\n';
    prompt += '21. ROOM CONTEXT: When answering "where" questions, reference specific tracked rooms with their numbers and floors\n';
    prompt += '22. MATERIAL QUANTITIES: For cost/quantity questions, cite extracted takeoff data with exact quantities and costs\n';
    prompt += '23. MEP EQUIPMENT: When discussing systems, mention specific equipment tags and their counts\n';
    prompt += '24. LOCATION AWARENESS: Combine room data with document references for precise spatial context\n';
    prompt += '25. INLINE DATA CARDS: Format responses to include [ROOM:id], [MATERIAL:id], or [MEP:callout] tags for UI enhancement\n';
    prompt += '26. CROSS-REFERENCES: When mentioning rooms/materials/equipment, suggest viewing them in their respective browsers\n';
    prompt += '27. SHOW ON PLAN: For visual elements, suggest using the Plan Viewer with [SHOW_ON_PLAN:documentId:pageNumber]\n';

    // Add intelligence feature instructions
    if (phase3Data.symbols && phase3Data.symbols.length > 0) {
      prompt += '28. SYMBOL RECOGNITION: Reference learned construction symbols (callouts, patterns) when interpreting plans\n';
    }
    if (phase3Data.isometricViews && phase3Data.isometricViews.length > 0) {
      prompt += '29. 3D SPATIAL UNDERSTANDING: Use isometric view analysis for vertical routing, clearances, and elevation questions\n';
    }
    if (phase3Data.pathAnalysis) {
      prompt += '30. MEP ROUTING INTELLIGENCE: Cite path efficiency, conflicts, and routing distances from system analysis\n';
      prompt += '31. OPTIMIZATION INSIGHTS: Suggest path optimizations when discussing MEP routing or coordination\n';
      prompt += '32. PATH VISUALIZATION: When discussing MEP equipment paths, connections, or routing, embed a path visualization using this format:\n';
      prompt += '    ```json:mep-path\n';
      prompt += '    {"id":"path-123","equipment":[...],"segments":[...],"totalDistance":150.5,"conflicts":[...],"efficiency":75}\n';
      prompt += '    ```\n';
      prompt += '    Use the pathAnalysis data provided to construct the visualization. Include all relevant equipment, segments, conflicts, and efficiency metrics.\n';
    }
  }

  // Add enhanced takeoff query instructions
  if (takeoffDetection.isTakeoffQuery) {
    prompt += '\n\n\u{1F3D7}\uFE0F MATERIAL TAKEOFF QUERY GUIDANCE:\n';
    prompt += '33. CONFIDENCE INDICATORS: Always mention confidence levels (\u2713=verified, ~=moderate, ?=needs review) when citing quantities\n';
    prompt += '34. WASTE FACTORS: When providing order quantities, include waste-adjusted amounts where applicable\n';
    prompt += '35. COST DISCLAIMERS: State that cost estimates are preliminary and should be verified with current market rates\n';
    prompt += '36. CATEGORY BREAKDOWN: For general material questions, provide a summary by category before detailed items\n';
    prompt += '37. SOURCE TRACKING: Mention sheet numbers and locations when available for verification\n';
    prompt += '38. LABOR ESTIMATES: Include estimated labor hours when relevant to the question\n';
    prompt += '39. VERIFICATION REMINDER: For low-confidence items (<70%), recommend manual verification\n';
    prompt += '40. UNITS CONSISTENCY: Always include units with quantities and convert if user asks in different units\n';
  }

  // Add BIM model context for 3D/BIM-related queries
  try {
    const bimContext = await getBIMContext(projectSlug, query);
    if (bimContext) {
      prompt += bimContext;
      prompt += '\n\n\u{1F3DB}\uFE0F BIM MODEL GUIDANCE:\n';
      prompt += '\u2022 Use BIM data for accurate element counts and material quantities\n';
      prompt += '\u2022 BIM-extracted quantities have high confidence (0.9) from actual model data\n';
      prompt += '\u2022 Reference specific Revit categories when discussing building elements\n';
      prompt += '\u2022 For MEP questions, prioritize BIM data over PDF extraction when available\n';
    }
  } catch (error) {
    logger.error('RAG', 'Error getting BIM context', error as Error);
  }

  // Add MEP Schedule context for equipment-related queries
  try {
    const mepScheduleContext = await getMEPScheduleContext(projectSlug);
    if (mepScheduleContext) {
      prompt += '\n\n' + mepScheduleContext;
      prompt += '\n\n\u{1F527} MEP SCHEDULE GUIDANCE:\n';
      prompt += '\u2022 Use MEP schedule data for accurate equipment specifications and counts\n';
      prompt += '\u2022 Light fixtures: reference manufacturer, model number, wattage, and mounting type\n';
      prompt += '\u2022 Plumbing fixtures: include fixture tag, manufacturer, and connection sizes\n';
      prompt += '\u2022 HVAC equipment: cite unit tags, capacities (CFM, tons), and electrical requirements\n';
      prompt += '\u2022 Use mechanical abbreviations from the project when explaining technical terms\n';
      prompt += '\u2022 For equipment questions, always check MEP schedules before giving generic answers\n';
    }
  } catch (error) {
    logger.error('RAG', 'Error getting MEP schedule context', error as Error);
  }

  // Add Door Schedule context
  try {
    const doorScheduleContext = await getDoorScheduleContext(projectSlug);
    if (doorScheduleContext) {
      prompt += '\n\n' + doorScheduleContext;
      prompt += '\n\n\u{1F6AA} DOOR SCHEDULE GUIDANCE:\n';
      prompt += '\u2022 Reference door numbers, types, and dimensions from the schedule\n';
      prompt += '\u2022 Include fire ratings when discussing door requirements\n';
      prompt += '\u2022 Cite hardware sets and specific hardware components\n';
      prompt += '\u2022 Mention frame types and materials when relevant\n';
    }
  } catch (error) {
    logger.error('RAG', 'Error getting door schedule context', error as Error);
  }

  // Add Window Schedule context
  try {
    const windowScheduleContext = await getWindowScheduleContext(projectSlug);
    if (windowScheduleContext) {
      prompt += '\n\n' + windowScheduleContext;
      prompt += '\n\n\u{1FA9F} WINDOW SCHEDULE GUIDANCE:\n';
      prompt += '\u2022 Reference window marks, types, and dimensions from the schedule\n';
      prompt += '\u2022 Include glazing types and performance specs (U-value, SHGC)\n';
      prompt += '\u2022 Note egress compliance status when applicable\n';
      prompt += '\u2022 Cite manufacturers and model numbers when available\n';
    }
  } catch (error) {
    logger.error('RAG', 'Error getting window schedule context', error as Error);
  }

  // Add daily report context for field/temporal queries
  try {
    const { classifyQueryIntent } = await import('@/lib/rag-enhancements');
    const intent = classifyQueryIntent(query);

    if (intent.type === 'daily_report') {
      const { searchDailyReportChunks } = await import('@/lib/daily-report-indexer');
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true },
      });

      if (project) {
        const dailyReportResults = await searchDailyReportChunks(project.id, query, {
          limit: 10,
        });

        if (dailyReportResults.length > 0) {
          prompt += '\n\n=== DAILY REPORT DATA ===\n';
          prompt += 'The following daily/field report entries are relevant to your query:\n\n';

          for (const chunk of dailyReportResults) {
            const metadata = chunk.metadata || {};
            const dateStr = new Date(chunk.reportDate).toLocaleDateString();
            const reportNum = (metadata.reportNumber as string | number) || '?';

            prompt += `--- Daily Report #${reportNum} (${dateStr}) [${chunk.section}] ---\n`;
            prompt += `${chunk.content}\n\n`;
          }

          prompt += '\n\u{1F4CB} DAILY REPORT QUERY GUIDANCE:\n';
          prompt += '\u2022 Reference specific report numbers and dates when citing field data\n';
          prompt += '\u2022 For labor questions, mention trade names, crew counts, and hours\n';
          prompt += '\u2022 For weather questions, include temperature, conditions, and any impact on work\n';
          prompt += '\u2022 For delay questions, cite delay reasons and hours lost\n';
          prompt += '\u2022 For safety questions, note incident counts and any corrective actions\n';

          logger.info('RAG', `Added ${dailyReportResults.length} daily report chunks to context`);
        }
      }
    }
  } catch (error) {
    logger.warn('RAG', 'Failed to retrieve daily report chunks', { error });
  }

  // Add scale context for dimension-related queries (Phase A.3)
  if (isScaleQuery(query)) {
    try {
      const scaleContext = await getScaleContext(query, projectSlug);
      prompt += scaleContext;
    } catch (error) {
      logger.error('RAG', 'Error adding scale context', error as Error);
    }
  }

  // Add drawing type context for drawing-specific queries (Phase A.4)
  if (isDrawingTypeQuery(query)) {
    try {
      const drawingTypeContext = await getDrawingTypeContext(query, projectSlug);
      if (drawingTypeContext) {
        prompt += drawingTypeContext;
      }
    } catch (error) {
      logger.error('RAG', 'Error adding drawing type context', error as Error);
    }
  }

  // Add legend/symbol context for symbol-related queries (Phase A.2)
  if (isSymbolQuery(query)) {
    try {
      const legendContext = await getLegendContext(query, projectSlug);
      if (legendContext) {
        prompt += legendContext;
        // Add instruction for symbol usage
        prompt += '\n\u{1F4A1} SYMBOL INTERPRETATION:\n';
        prompt += '\u2022 Use the legend definitions above to interpret symbols in the plans\n';
        prompt += '\u2022 Always cite the symbol code and description when answering\n';
        prompt += '\u2022 Reference sheet numbers where symbols are used\n';
        prompt += '\u2022 Note any category or discipline associations\n';
      }
    } catch (error) {
      logger.error('RAG', 'Error adding legend context', error as Error);
    }
  }

  // Add drawing type context for classification-related queries (Phase A.4)
  if (isDrawingTypeQuery(query)) {
    try {
      const drawingTypeContext = await getDrawingTypeContext(query, projectSlug);
      prompt += drawingTypeContext;
    } catch (error) {
      logger.error('RAG', 'Error adding drawing type context', error as Error);
    }
  }

  // Add Phase B intelligence context (callouts, dimensions, annotations, symbols)
  try {
    const phaseBContext = await retrievePhaseBContext(query, projectSlug, chunks);
    if (phaseBContext) {
      prompt += phaseBContext;

      // Add Phase B instructions
      prompt += getPhaseBRAGInstructions();
    }
  } catch (error) {
    logger.error('RAG', 'Error adding Phase B context', error as Error);
  }

  // Add Phase 3 intelligence data sections
  if (phase3Data.symbols && phase3Data.symbols.length > 0) {
    prompt += '\n\n=== LEARNED CONSTRUCTION SYMBOLS ===\n';
    prompt += 'The following symbols have been identified in project documents:\n\n';
    phase3Data.symbols.slice(0, 20).forEach(symbol => {
      prompt += `\u2022 ${symbol.pattern} (${symbol.category}) - ${symbol.occurrences} occurrences, ${symbol.confidence.toFixed(0)}% confidence\n`;
      if (symbol.variations.length > 1) {
        prompt += `  Variations: ${symbol.variations.slice(0, 3).join(', ')}\n`;
      }
    });
  }

  if (phase3Data.isometricViews && phase3Data.isometricViews.length > 0) {
    const isoSummary = phase3Data.isometricViews[0];
    prompt += '\n\n=== ISOMETRIC VIEW ANALYSIS ===\n';
    prompt += `\u2022 ${isoSummary.totalViews} isometric/riser diagram views detected\n`;
    prompt += `\u2022 ${isoSummary.totalElements} MEP elements analyzed\n`;
    if (isoSummary.criticalClearances > 0) {
      prompt += `\u2022 \u26A0\uFE0F ${isoSummary.criticalClearances} critical clearance issues identified\n`;
    }
    if (isoSummary.bySystem) {
      prompt += '\nViews by system:\n';
      Object.entries(isoSummary.bySystem).forEach(([system, count]) => {
        prompt += `  \u2022 ${system}: ${count} views\n`;
      });
    }
  }

  if (phase3Data.pathAnalysis) {
    const analysis = phase3Data.pathAnalysis;
    prompt += '\n\n=== MEP PATH ANALYSIS ===\n';
    prompt += `Trade: ${analysis.trade}\n`;
    prompt += `\u2022 ${analysis.totalEquipment} equipment items\n`;
    prompt += `\u2022 ${analysis.avgDistance.toFixed(1)} units average routing distance\n`;
    prompt += `\u2022 ${analysis.totalConflicts} potential conflicts detected\n`;
    prompt += `\u2022 ${analysis.overallEfficiency.toFixed(0)}% routing efficiency\n`;
    if (analysis.criticalPaths && analysis.criticalPaths.length > 0) {
      prompt += `\n\u26A0\uFE0F ${analysis.criticalPaths.length} critical paths requiring attention:\n`;
      analysis.criticalPaths.forEach((path, idx) => {
        prompt += `  ${idx + 1}. ${path.equipment.length} equipment items, ${path.efficiency.toFixed(0)}% efficiency, ${path.conflicts.length} conflicts\n`;
      });
    }
  }

  return prompt;
}
