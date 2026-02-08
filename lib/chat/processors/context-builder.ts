import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  twoPassRetrieval,
  bundleCrossReferences,
  generateEnhancedContext,
  classifyQueryIntent,
  detectMultipleScales,
  detectScaleBar,
  expandAbbreviations,
  extractGridReferences,
  generateSpatialContext,
  CONSTRUCTION_ABBREVIATIONS,
  reconstructSystemTopology,
  interpretIsometricView,
  detectAdvancedConflicts,
  learnProjectSymbols,
  applyLearnedSymbols,
  EnhancedChunk,
} from '@/lib/rag-enhancements';
import {
  enrichWithPhaseAMetadata,
  generateContextWithPhase3,
  retrieveRelevantCorrections,
} from '@/lib/rag';
import { shouldUseWebSearch, performWebSearch, formatWebResultsForContext } from '@/lib/web-search';
import { getAccessibleDocuments } from '@/lib/access-control';
import { classifyQuery } from '@/lib/chat/utils/query-classifier';
import type { ContextBuilderOptions, BuiltContext, WebSearchResult } from '@/types/chat';

/**
 * Build context from RAG retrieval and enhancements
 * Extracted from app/api/chat/route.ts lines 227-540
 *
 * This is the most complex processor - it handles:
 * 1. Query classification (counting, measurement, calculation)
 * 2. Two-pass RAG retrieval
 * 3. Cross-reference bundling
 * 4. Phase A enrichment (title block, legends)
 * 5. Phase 3A enhancements (scales, abbreviations, grid refs)
 * 6. Phase 3C advanced features (topology, isometric, conflicts)
 * 7. Web search integration
 */
export async function buildContext(options: ContextBuilderOptions): Promise<BuiltContext> {
  const { message, image, projectSlug, userRole } = options;

  // Classify query type to determine retrieval limit
  const queryClassification = classifyQuery(message || '');
  const retrievalLimit = options.retrievalLimit || queryClassification.retrievalLimit;

  // ENHANCED RETRIEVAL: Use two-pass retrieval with cross-reference bundling
  logger.info('ENHANCED_RETRIEVAL', 'Starting two-pass retrieval for query type detection');
  const { chunks: enhancedChunks, retrievalLog } = await twoPassRetrieval(
    message || '',
    projectSlug,
    userRole as "admin" | "client" | "guest",
    retrievalLimit
  );

  // Log retrieval strategy
  retrievalLog.forEach((log) => logger.info('ENHANCED_RETRIEVAL', log));

  // CROSS-REFERENCE BUNDLING: Add related chunks
  logger.info('CROSS_REFERENCE', 'Bundling related content');
  const { enrichedChunks: crossRefEnrichedChunks, crossRefLog } = await bundleCrossReferences(
    enhancedChunks,
    projectSlug
  );
  crossRefLog.forEach((log) => logger.info('CROSS_REFERENCE', log));

  // PHASE A ENRICHMENT: Add title block and legend intelligence
  logger.info('PHASE_A', 'Enriching with title block and legend metadata');
  const enrichedChunks = await enrichWithPhaseAMetadata(crossRefEnrichedChunks, projectSlug);
  logger.info('PHASE_A', `Enriched chunks with Phase A intelligence`, { chunkCount: enrichedChunks.length });

  // ========================================
  // PHASE 3A: ENHANCED VISION PROCESSING
  // ========================================
  logger.info('PHASE_3A', 'Applying enhanced vision analysis');

  // 1. Multi-Scale Detection
  const scaleAnalysis = enrichedChunks
    .map((chunk) => {
      const scales = detectMultipleScales(chunk);
      return { chunkId: chunk.id, scales };
    })
    .filter((s) => s.scales.additionalScales.length > 0 || s.scales.scaleWarnings.length > 0);

  if (scaleAnalysis.length > 0) {
    logger.info('SCALES', `Detected chunks with scale information`, { chunkCount: scaleAnalysis.length });
    scaleAnalysis.forEach((s) => {
      if (s.scales.scaleWarnings.length > 0) {
        logger.warn('SCALES', s.scales.scaleWarnings.join(', '));
      }
    });
  }

  // 2. Scale Bar Detection
  const scaleBarChunks = enrichedChunks.filter((chunk) => {
    const scaleBar = detectScaleBar(chunk);
    return scaleBar.detected;
  });
  if (scaleBarChunks.length > 0) {
    logger.info('SCALE_BARS', `Found scale bars`, { count: scaleBarChunks.length });
  }

  // 3. Abbreviation Expansion
  enrichedChunks.forEach((chunk) => {
    const expandedContent = expandAbbreviations(chunk.content, CONSTRUCTION_ABBREVIATIONS, true);
    if (expandedContent !== chunk.content) {
      chunk.content = expandedContent;
    }
  });
  logger.info('ABBREVIATIONS', `Expanded construction abbreviations`, { chunkCount: enrichedChunks.length });

  // 4. Grid-Based Spatial Referencing
  const chunksWithGrids = enrichedChunks
    .map((chunk) => {
      const gridRefs = extractGridReferences(chunk);
      if (gridRefs.length > 0) {
        const spatialContext = generateSpatialContext(gridRefs, chunk.metadata?.room_number);
        chunk.metadata = {
          ...chunk.metadata,
          spatial_context: spatialContext,
          grid_references: gridRefs.map((g) => g.gridId),
        };
        return { chunkId: chunk.id, gridRefs, spatialContext };
      }
      return null;
    })
    .filter(Boolean);

  if (chunksWithGrids.length > 0) {
    logger.info('GRID_REFS', `Extracted grid references`, { chunkCount: chunksWithGrids.length });
    chunksWithGrids.slice(0, 3).forEach((c) => {
      if (c) {
        logger.info('GRID_REFS', c.spatialContext);
      }
    });
  }

  logger.info('PHASE_3A', 'Enhanced vision analysis complete');

  // ========================================
  // PHASE 3C: ADVANCED FEATURES
  // ========================================
  logger.info('PHASE_3C', 'Applying advanced analysis');

  // 1. System Topology Reconstruction (for MEP system queries)
  const queryIntent = classifyQueryIntent(message || '');
  if (queryIntent.type === 'mep' && queryIntent.mepTrade) {
    const systemTypeMap: { [key: string]: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm' } = {
      hvac: 'hvac',
      plumbing: 'plumbing',
      electrical: 'electrical',
      fire_alarm: 'fire_alarm',
    };

    const systemType = systemTypeMap[queryIntent.mepTrade];
    if (systemType) {
      logger.info('TOPOLOGY', `Reconstructing system topology`, { systemType });
      const topology = await reconstructSystemTopology(projectSlug, systemType);

      if (topology.nodes.length > 0) {
        logger.info('TOPOLOGY', `Found nodes and connections`, { nodes: topology.nodes.length, connections: topology.connections.length });
        logger.info('TOPOLOGY', `Flow sequence: ${topology.flow.slice(0, 5).join(' → ')}${topology.flow.length > 5 ? '...' : ''}`);

        if (enrichedChunks.length > 0) {
          enrichedChunks[0].metadata = {
            ...enrichedChunks[0].metadata,
            system_topology: {
              nodes: topology.nodes.length,
              connections: topology.connections.length,
              flow: topology.flow.join(' → '),
            },
          };
        }
      } else if (topology.warnings.length > 0) {
        logger.warn('TOPOLOGY', topology.warnings.join(', '));
      }
    }
  }

  // 2. Isometric View Interpretation
  const isIsometricQuery = /isometric|iso\s+view|3d|vertical|elevation|riser/i.test(message || '');
  if (isIsometricQuery) {
    logger.info('ISOMETRIC', 'Detecting 3D/isometric views');

    enrichedChunks.forEach((chunk) => {
      const isoView = interpretIsometricView(chunk);
      if (isoView.elements.length > 0) {
        logger.info('ISOMETRIC', `Found elements in isometric view`, { elements: isoView.elements.length, discipline: isoView.discipline });
        chunk.metadata = {
          ...chunk.metadata,
          isometric_view: {
            discipline: isoView.discipline,
            elements: isoView.elements.length,
            levels: isoView.spatialHierarchy.length,
          },
        };
      }
    });
  }

  // 3. Advanced Conflict Detection
  const isConflictQuery = /conflict|clash|coordination|clearance|interfere|overlap/i.test(message || '');
  if (isConflictQuery) {
    logger.info('CONFLICTS', 'Running advanced conflict detection');

    const conflicts = await detectAdvancedConflicts(projectSlug);

    if (conflicts.length > 0) {
      const criticalCount = conflicts.filter((c) => c.severity === 'critical').length;
      const majorCount = conflicts.filter((c) => c.severity === 'major').length;

      logger.warn('CONFLICTS', `Found conflicts`, { total: conflicts.length, critical: criticalCount, major: majorCount });

      if (enrichedChunks.length > 0) {
        enrichedChunks[0].metadata = {
          ...enrichedChunks[0].metadata,
          conflicts_detected: {
            total: conflicts.length,
            critical: criticalCount,
            major: majorCount,
            types: [...new Set(conflicts.map((c) => c.conflictType))],
          },
        };
      }
    } else {
      logger.info('CONFLICTS', 'No conflicts detected');
    }
  }

  // 4. Adaptive Symbol Learning
  const isSymbolQuery = /symbol|legend|key|notation|mark|icon/i.test(message || '');
  if (isSymbolQuery) {
    logger.info('SYMBOLS', 'Applying learned symbol library');

    const symbolLibrary = await learnProjectSymbols(projectSlug);

    if (symbolLibrary.symbols.length > 0) {
      logger.info('SYMBOLS', `Learned symbols`, { count: symbolLibrary.symbols.length, appearances: symbolLibrary.totalAppearances });

      enrichedChunks.forEach((chunk, idx) => {
        const enhanced = applyLearnedSymbols(chunk, symbolLibrary);
        enrichedChunks[idx] = enhanced;
      });
    }
  }

  logger.info('PHASE_3C', 'Advanced analysis complete');

  // Convert enhanced chunks to standard format
  const chunks = enrichedChunks
    .filter((ec) => ec.documentId !== null)
    .map((ec) => ({
      id: ec.id,
      content: ec.content,
      documentId: ec.documentId as string,
      regulatoryDocumentId: ec.regulatoryDocumentId,
      pageNumber: ec.pageNumber,
      metadata: ec.metadata,
      isRegulatory: ec.isRegulatory,
    }));

  const documentNames = [...new Set(enrichedChunks.map((c) => c.metadata?.documentName).filter(Boolean))] as string[];

  // Retrieve admin corrections
  const adminCorrections = await retrieveRelevantCorrections(message || '', projectSlug, 3);

  // Daily report chunk retrieval (best-effort)
  let dailyReportContext = '';
  try {
    const { searchDailyReportChunks } = await import('@/lib/daily-report-indexer');
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });
    if (project) {
      const reportChunks = await searchDailyReportChunks(project.id, message || '', { limit: 5 });
      if (reportChunks.length > 0) {
        dailyReportContext = '\n\n=== DAILY REPORT DATA ===\n' + reportChunks.map(c =>
          `[Report ${c.reportDate.toISOString().split('T')[0]} - ${c.section}]: ${c.content}`
        ).join('\n---\n');
        logger.info('DAILY_REPORTS', 'Added daily report chunks to context', { count: reportChunks.length });
      }
    }
  } catch (err) {
    logger.warn('DAILY_REPORTS', 'Failed to retrieve daily report chunks (non-blocking)');
  }

  // Generate enhanced context
  logger.info('CONTEXT_GENERATION', 'Generating enhanced context with validation markers');
  const enhancedContext = generateEnhancedContext(enrichedChunks, message || '');

  // Generate Phase 3-enhanced context with corrections
  const documentContext = await generateContextWithPhase3(chunks, adminCorrections, message || '', projectSlug);

  // Combine contexts
  const combinedContext = `${enhancedContext}${dailyReportContext}\n\n=== ADMIN CORRECTIONS (Priority Teaching) ===\n${
    adminCorrections.length > 0
      ? adminCorrections
          .map(
            (c) =>
              `Q: ${c.originalQuestion}\nCorrected Answer: ${c.correctedAnswer}\n${
                c.adminNotes ? `Admin Notes: ${c.adminNotes}\n` : ''
              }`
          )
          .join('\n---\n')
      : 'No admin corrections for this query type.'
  }\n`;

  // Web search integration
  const useWebSearch = !!image || shouldUseWebSearch(message || '', chunks.length);
  let webSearchContext = '';
  let webSearchResults: WebSearchResult[] = [];

  if (useWebSearch) {
    logger.info('WEB_SEARCH', 'Performing web search to supplement document information');
    const searchQuery =
      image && message ? `${message} building code requirements compliance` : message || '';
    const webSearch = await performWebSearch(searchQuery);
    if (webSearch.hasResults) {
      webSearchContext = formatWebResultsForContext(webSearch.results);
      webSearchResults = webSearch.results;
      logger.info('WEB_SEARCH', `Added web sources as supplementary context`, { sourceCount: webSearch.results.length });
    }
  }

  // Get accessible documents for context
  const accessibleDocs = getAccessibleDocuments(userRole as "admin" | "client" | "guest");

  // Build document filter based on user role
  let docFilter: { accessLevel?: { in: string[] } | string };
  if (userRole === 'admin') {
    docFilter = {};
  } else if (userRole === 'client') {
    docFilter = { accessLevel: { in: ['client', 'guest'] } };
  } else {
    docFilter = { accessLevel: 'guest' };
  }

  const documents = await prisma.document.findMany({
    where: docFilter,
  });

  // Build the full context prompt (this is the massive system prompt)
  const contextPrompt = buildSystemPrompt(
    documents,
    userRole,
    combinedContext,
    webSearchContext,
    !!image
  );

  return {
    chunks: enrichedChunks,
    documentNames,
    contextPrompt,
    retrievalLog,
    webSearchResults: webSearchResults.length > 0 ? webSearchResults : undefined,
  };
}

/**
 * Build the system prompt for the LLM
 * Contains all the instructions and context
 */
function buildSystemPrompt(
  documents: { name: string; accessLevel: string }[],
  userRole: string,
  combinedContext: string,
  webSearchContext: string,
  hasImage: boolean
): string {
  const isGuestOrPending = userRole === 'guest' || userRole === 'pending';
  const accessLevelText =
    userRole === 'admin' || userRole === 'client'
      ? 'Full Access (Admin/Client - Access to All Documents)'
      : 'Guest Access (Limited - Access to Public Documents Only)';

  return `You are an AI assistant for One Senior Care Construction Site ChatBot. You have access to project documents and can help with questions about schedules, plans, specifications, and construction site details.

**Available Project Documents:**
${documents.map((d) => `- ${d.name} (${d.accessLevel})`).join('\n')}

**User Access Level:** ${accessLevelText}

${
  isGuestOrPending
    ? `**IMPORTANT FOR GUEST USERS:**
- ✅ YOU CAN ACCESS: Schedule.pdf (timelines, dates, milestones), Plans.pdf (all technical drawings), Specs, Site Survey, Geotech
- ❌ YOU CANNOT ACCESS: Budget.pdf (costs, financials), Project Overview.docx (admin summary), Critical Path Plan.docx (detailed admin planning)
- **Timeline/Schedule Questions**: ALWAYS ANSWER from Schedule.pdf - it contains project timelines, start/end dates, milestones, and durations
- If asked about budget, costs, financials, or the Critical Path Plan document specifically, inform them these are restricted to admin and client users only.
`
    : ''
}

**Relevant Project Information:**
${combinedContext}${webSearchContext}

${
  hasImage
    ? '**⚠️ IMAGE ANALYSIS REQUIRED:**\nThe user has uploaded an image. Follow the comprehensive IMAGE ANALYSIS WORKFLOW with all 5 steps:\n1. Visual Inspection & Identification\n2. Building Code Compliance Check (use web search results above)\n3. Plan Location Analysis (use document context above)\n4. Plan Compliance Check\n5. Material Takeoff Calculations (if requested)\n\nProvide a thorough analysis following the format specified.\n'
    : ''
}

**CORE DIRECTIVE - NEVER REDIRECT USERS:**
You must PROVIDE DIRECT ANSWERS from the documents. NEVER tell users to "check the plans yourself" or "refer to the drawings." Your job is to EXTRACT and DELIVER the answer, not redirect them to find it themselves. If the answer exists in the provided context, state it clearly with citations.

**CONSTRUCTION FOCUS:**
ALL answers must be construction-focused and specific to this One Senior Care project. Use proper construction terminology, industry standards, and professional language.

**ACCURACY REQUIREMENT:**
You MUST NOT make up or fabricate information. If the answer is not in the provided context:
- State clearly: "I don't see that specific information in the available documents."
- Suggest where it might be found: "This information would typically be on Sheet [X-XXX] in the [discipline] plans."
- NEVER guess at measurements, quantities, specifications, or requirements`;
}
