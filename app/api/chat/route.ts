import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { incrementQueryCount } from '@/lib/subscription';
import { isRestrictedQuery, getAccessDenialMessage } from '@/lib/access-control';

// Feature flags for gradual rollout
import { shouldUseNewRoute } from '@/lib/chat/feature-flags';

// New middleware modules
import {
  checkMaintenance,
  maintenanceResponse,
  checkAuth,
  checkRateLimitMiddleware,
  rateLimitResponse,
  validateQuery,
  validationErrorResponse,
  checkQueryLimitMiddleware,
  queryLimitResponse,
} from '@/lib/chat/middleware';

// New processor modules
import {
  manageConversation,
  lockedReportResponse,
  buildContext,
  handleLLMRequest,
  checkCache,
  saveCachedChatMessage,
  streamResponse,
  createErrorResponse,
  createCachedResponse,
} from '@/lib/chat/processors';

// Restricted query check utility (created by Codex)
import { checkRestrictedQuery } from '@/lib/chat/utils/restricted-query-check';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds timeout for long-running queries

/**
 * Main POST handler - routes between new and legacy implementations
 */
export async function POST(request: NextRequest) {
  // Check auth first to get userId for feature flag check
  const auth = await checkAuth(request);

  // Use feature flags to determine which implementation to use
  if (shouldUseNewRoute(auth.userId)) {
    console.log('[CHAT API] Using new refactored route handler');
    return newRouteHandler(request, auth);
  }

  // Fallback to legacy implementation
  console.log('[CHAT API] Using legacy route handler');
  return legacyRouteHandler(request);
}

/**
 * New refactored route handler using middleware and processors
 * Reduces complexity by using extracted modules
 */
async function newRouteHandler(request: NextRequest, auth: Awaited<ReturnType<typeof checkAuth>>) {
  try {
    // 1. Maintenance check
    const maintenance = await checkMaintenance();
    if (maintenance.isActive) {
      return maintenanceResponse();
    }

    // 2. Rate limit check
    const rateLimit = await checkRateLimitMiddleware(auth);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    // 3. Query validation
    const validation = await validateQuery(request);
    if (!validation.valid) {
      return validationErrorResponse(validation);
    }

    // 4. Query limit check (subscription limits)
    const queryLimit = await checkQueryLimitMiddleware(auth);
    if (!queryLimit.allowed) {
      return queryLimitResponse(queryLimit);
    }

    // 5. Conversation management
    let conversation;
    try {
      conversation = await manageConversation({
        userId: auth.userId,
        conversationId: validation.body?.conversationId || null,
        projectSlug: validation.body!.projectSlug,
        message: validation.body?.message || null,
        userRole: auth.userRole,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'REPORT_LOCKED') {
        return lockedReportResponse();
      }
      throw error;
    }

    // 6. Restricted query check
    const restricted = checkRestrictedQuery(validation.body?.message || null, auth.userRole);
    if (restricted.isRestricted) {
      // Save denial message to database
      await prisma.chatMessage.create({
        data: {
          conversationId: conversation.id || null,
          userId: auth.userId || null,
          userRole: auth.userRole,
          message: validation.body?.message || '',
          response: restricted.denialMessage || '',
          documentsUsed: [],
        },
      });

      return NextResponse.json({ response: restricted.denialMessage });
    }

    // 7. Build context (RAG retrieval and enhancements)
    const context = await buildContext({
      message: validation.body?.message || null,
      image: validation.body?.image || null,
      projectSlug: validation.body!.projectSlug,
      userRole: auth.userRole,
    });

    // 8. Check cache (only for text queries)
    const cacheResult = await checkCache(
      validation.body?.message || null,
      validation.body?.image || null,
      validation.body!.projectSlug,
      context.chunks.filter((c) => c.documentId).map((c) => ({ documentId: c.documentId as string }))
    );

    if (cacheResult.hit && cacheResult.response) {
      // Save cached response to database
      await saveCachedChatMessage(
        conversation.id,
        auth.userId,
        auth.userRole,
        validation.body?.message || '',
        cacheResult.response,
        context.chunks.filter((c) => c.documentId).map((c) => c.documentId as string)
      );

      return createCachedResponse(cacheResult.response, conversation.id);
    }

    // 9. Handle LLM request
    const llmResponse = await handleLLMRequest({
      message: validation.body?.message || null,
      image: validation.body?.image || null,
      context,
      conversationId: conversation.id,
      projectSlug: validation.body!.projectSlug,
      userRole: auth.userRole,
    });

    // 10. Stream response
    return streamResponse({
      llmResponse,
      conversation,
      context,
      message: validation.body?.message || null,
      userId: auth.userId,
      userRole: auth.userRole,
    });
  } catch (error) {
    return createErrorResponse(error);
  } finally {
    // Increment query count for logged-in users
    if (auth.userId) {
      try {
        await incrementQueryCount(auth.userId);
      } catch (error) {
        console.error('Error incrementing query count:', error);
      }
    }
  }
}

// ============================================================================
// LEGACY ROUTE HANDLER
// Keep the original implementation for fallback during gradual rollout
// This will be removed after 7 days of stable operation with the new route
// ============================================================================

import {
  retrieveRelevantCorrections,
  generateContextWithPhase3,
  enrichWithPhaseAMetadata,
} from '@/lib/rag';
import {
  twoPassRetrieval,
  bundleCrossReferences,
  generateEnhancedContext,
  validateBeforeResponse,
  classifyQueryIntent,
  EnhancedChunk,
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
} from '@/lib/rag-enhancements';
import { shouldUseWebSearch, performWebSearch, formatWebResultsForContext } from '@/lib/web-search';
import { getQuickFollowUps as generateQuickFollowUps } from '@/lib/follow-up-generator';
import { getCachedResponse, cacheResponse, analyzeQueryComplexity } from '@/lib/query-cache';
import { checkQueryLimit } from '@/lib/subscription';
import {
  checkRateLimit,
  getRateLimitIdentifier,
  getClientIp,
  createRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/rate-limiter';
import { isReportLocked, canModifyLockedReport } from '@/lib/report-change-log';
import { markFirstChatStarted } from '@/lib/onboarding-tracker';
import { getAccessibleDocuments } from '@/lib/access-control';

async function legacyRouteHandler(request: NextRequest) {
  try {
    // Check maintenance mode
    const maintenance = await prisma.maintenanceMode.findUnique({
      where: { id: 'singleton' },
    });

    if (maintenance?.isActive) {
      return NextResponse.json({ error: 'System is currently under maintenance' }, { status: 503 });
    }

    // Rate limiting
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    const clientIp = getClientIp(request);
    const rateLimitId = getRateLimitIdentifier(userId, clientIp);

    const rateLimitResult = await checkRateLimit(rateLimitId, RATE_LIMITS.CHAT);

    if (!rateLimitResult.success) {
      console.warn(`[RATE LIMIT EXCEEDED] ${rateLimitId} - ${rateLimitResult.limit} requests/min`);
      return NextResponse.json(
        {
          error: 'Too many requests. Please slow down and try again in a moment.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult),
        }
      );
    }

    console.log(
      `[RATE LIMIT OK] ${rateLimitId} - ${rateLimitResult.remaining}/${rateLimitResult.limit} remaining`
    );

    const userRole = (session?.user?.role || 'guest') as 'admin' | 'client' | 'guest' | 'pending';

    const body = await request.json();
    const { message, image, imageName, conversationId, projectSlug } = body;

    if (!message && !image) {
      return NextResponse.json({ error: 'Message or image is required' }, { status: 400 });
    }

    if (!projectSlug) {
      return NextResponse.json(
        { error: 'Project context is required. Please access chat through a project page.' },
        { status: 400 }
      );
    }

    // Check query limits for logged-in users
    if (userId) {
      const queryCheck = await checkQueryLimit(userId);

      if (!queryCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Query limit reached',
            message: `You've reached your monthly limit of ${queryCheck.limit} queries. Upgrade your plan to continue using ForemanOS.`,
            tier: queryCheck.tier,
            limit: queryCheck.limit,
            remaining: 0,
          },
          { status: 429 }
        );
      }
    }

    // Handle conversation for logged-in users
    let currentConversationId = conversationId;
    let currentProjectId: string | null = null;

    if (projectSlug) {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true },
      });
      currentProjectId = project?.id || null;
    }

    if (userId && !currentConversationId) {
      const firstMessage = message || 'Image uploaded';
      const title = firstMessage.length > 50 ? firstMessage.substring(0, 47) + '...' : firstMessage;

      const newConversation = await prisma.conversation.create({
        data: {
          userId,
          title,
          userRole,
          projectId: currentProjectId,
        },
      });
      currentConversationId = newConversation.id;

      if (currentProjectId) {
        markFirstChatStarted(userId, currentProjectId).catch((err) => {
          console.error('[ONBOARDING] Error marking first chat started:', err);
        });
      }
    }

    // Check if this is a locked daily report
    if (userId && currentConversationId) {
      const locked = await isReportLocked(currentConversationId);

      if (locked) {
        const conv = await prisma.conversation.findUnique({
          where: { id: currentConversationId },
          select: { projectId: true },
        });

        if (conv?.projectId) {
          const canModify = await canModifyLockedReport(userId, conv.projectId);

          if (!canModify) {
            return NextResponse.json(
              {
                error:
                  'This daily report is locked and cannot be modified. Only project owners and admins can modify locked reports.',
                isLocked: true,
              },
              { status: 403 }
            );
          }

          console.log(
            `[LOCKED_REPORT_MODIFICATION] User ${userId} is modifying locked report ${currentConversationId}`
          );
        }
      }
    }

    // Check if query is about restricted content
    if (isRestrictedQuery(message, userRole)) {
      const denialMessage = getAccessDenialMessage();

      await prisma.chatMessage.create({
        data: {
          conversationId: currentConversationId || null,
          userId: userId || null,
          userRole,
          message,
          response: denialMessage,
          documentsUsed: [],
        },
      });

      return NextResponse.json({ response: denialMessage });
    }

    // Query classification
    const isCountingQuery =
      message && /\b(how many|count|total|number of|quantity of)\b/i.test(message);
    const isMeasurementQuery =
      message &&
      /\b(what is|how|depth|height|width|size|dimension|measurement|thick|clearance)\b/i.test(
        message
      );
    const isCalculationQuery =
      message &&
      /\b(calculate|cubic|yards|volume|area|square feet|linear feet|how much|excavation|removed|concrete|material)\b/i.test(
        message
      );
    const retrievalLimit = isCalculationQuery
      ? 20
      : isCountingQuery
        ? 18
        : isMeasurementQuery
          ? 15
          : 12;

    // Two-pass retrieval
    console.log(`🔍 [ENHANCED RETRIEVAL] Starting two-pass retrieval...`);
    const { chunks: enhancedChunks, retrievalLog } = await twoPassRetrieval(
      message || '',
      projectSlug,
      userRole,
      retrievalLimit
    );
    retrievalLog.forEach((log) => console.log(`   📋 ${log}`));

    // Cross-reference bundling
    console.log(`🔗 [CROSS-REFERENCE] Bundling related content...`);
    const { enrichedChunks: crossRefEnrichedChunks, crossRefLog } = await bundleCrossReferences(
      enhancedChunks,
      projectSlug
    );
    crossRefLog.forEach((log) => console.log(`   🔗 ${log}`));

    // Phase A enrichment
    console.log(`📋 [PHASE A] Enriching with title block and legend metadata...`);
    const enrichedChunks = await enrichWithPhaseAMetadata(crossRefEnrichedChunks, projectSlug);
    console.log(`   ✅ Enriched ${enrichedChunks.length} chunks with Phase A intelligence`);

    // Phase 3A: Enhanced vision processing
    console.log(`🔬 [PHASE 3A] Applying enhanced vision analysis...`);

    const scaleAnalysis = enrichedChunks
      .map((chunk) => {
        const scales = detectMultipleScales(chunk);
        return { chunkId: chunk.id, scales };
      })
      .filter(
        (s) => s.scales.additionalScales.length > 0 || s.scales.scaleWarnings.length > 0
      );

    if (scaleAnalysis.length > 0) {
      console.log(`   📏 [SCALES] Detected ${scaleAnalysis.length} chunks with scale information`);
    }

    const scaleBarChunks = enrichedChunks.filter((chunk) => {
      const scaleBar = detectScaleBar(chunk);
      return scaleBar.detected;
    });
    if (scaleBarChunks.length > 0) {
      console.log(`   📐 [SCALE BARS] Found ${scaleBarChunks.length} scale bars`);
    }

    enrichedChunks.forEach((chunk) => {
      const expandedContent = expandAbbreviations(
        chunk.content,
        CONSTRUCTION_ABBREVIATIONS,
        true
      );
      if (expandedContent !== chunk.content) {
        chunk.content = expandedContent;
      }
    });
    console.log(
      `   📝 [ABBREVIATIONS] Expanded construction abbreviations in ${enrichedChunks.length} chunks`
    );

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
      console.log(
        `   🗺️  [GRID REFS] Extracted grid references from ${chunksWithGrids.length} chunks`
      );
    }

    console.log(`✅ [PHASE 3A] Enhanced vision analysis complete`);

    // Phase 3C: Advanced features
    console.log(`🚀 [PHASE 3C] Applying advanced analysis...`);

    const queryIntent = classifyQueryIntent(message || '');
    if (queryIntent.type === 'mep' && queryIntent.mepTrade) {
      const systemTypeMap: {
        [key: string]: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm';
      } = {
        hvac: 'hvac',
        plumbing: 'plumbing',
        electrical: 'electrical',
        fire_alarm: 'fire_alarm',
      };

      const systemType = systemTypeMap[queryIntent.mepTrade];
      if (systemType) {
        console.log(`   🔧 [TOPOLOGY] Reconstructing ${systemType} system topology...`);
        const topology = await reconstructSystemTopology(projectSlug, systemType);

        if (topology.nodes.length > 0) {
          console.log(
            `      ✓ Found ${topology.nodes.length} nodes, ${topology.connections.length} connections`
          );

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
        }
      }
    }

    const isIsometricQuery = /isometric|iso\s+view|3d|vertical|elevation|riser/i.test(
      message || ''
    );
    if (isIsometricQuery) {
      console.log(`   📐 [ISOMETRIC] Detecting 3D/isometric views...`);
      enrichedChunks.forEach((chunk) => {
        const isoView = interpretIsometricView(chunk);
        if (isoView.elements.length > 0) {
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

    const isConflictQuery = /conflict|clash|coordination|clearance|interfere|overlap/i.test(
      message || ''
    );
    if (isConflictQuery) {
      console.log(`   ⚠️  [CONFLICTS] Running advanced conflict detection...`);
      const conflicts = await detectAdvancedConflicts(projectSlug);

      if (conflicts.length > 0 && enrichedChunks.length > 0) {
        const criticalCount = conflicts.filter((c) => c.severity === 'critical').length;
        const majorCount = conflicts.filter((c) => c.severity === 'major').length;

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
    }

    const isSymbolQuery = /symbol|legend|key|notation|mark|icon/i.test(message || '');
    if (isSymbolQuery) {
      console.log(`   📚 [SYMBOLS] Applying learned symbol library...`);
      const symbolLibrary = await learnProjectSymbols(projectSlug);

      if (symbolLibrary.symbols.length > 0) {
        enrichedChunks.forEach((chunk, idx) => {
          const enhanced = applyLearnedSymbols(chunk, symbolLibrary);
          enrichedChunks[idx] = enhanced;
        });
      }
    }

    console.log(`✅ [PHASE 3C] Advanced analysis complete`);

    // Convert chunks to standard format
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

    const documentNames = [
      ...new Set(enrichedChunks.map((c) => c.metadata?.documentName).filter(Boolean)),
    ] as string[];

    // Cache check
    let cachedResult: string | null = null;
    if (!image && message) {
      const documentIds = chunks.map((c) => c.documentId);
      cachedResult = await getCachedResponse(message, projectSlug, documentIds);

      if (cachedResult) {
        console.log(`💰 [COST SAVE] Cache hit - returning cached response`);

        const usedDocIds = [...new Set(chunks.map((c) => c.documentId))];
        await prisma.chatMessage.create({
          data: {
            conversationId: currentConversationId || null,
            userId: userId || null,
            userRole,
            message,
            response: cachedResult,
            documentsUsed: usedDocIds,
            hasImage: false,
          },
        });

        if (currentConversationId) {
          await prisma.conversation.update({
            where: { id: currentConversationId },
            data: {
              updatedAt: new Date(),
              lastActivityAt: new Date(),
            },
          });
        }

        return NextResponse.json({
          response: cachedResult,
          cached: true,
        });
      }
    }

    // Model selection
    const complexityAnalysis = message
      ? analyzeQueryComplexity(message)
      : {
          complexity: 'complex' as const,
          reason: 'Image analysis requires GPT-5.2 vision',
          model: 'gpt-5.2',
        };

    const selectedModel = image ? 'gpt-5.2' : complexityAnalysis.model;
    console.log(`🤖 [MODEL SELECTION] Using ${selectedModel} - ${complexityAnalysis.reason}`);

    // Admin corrections
    const adminCorrections = await retrieveRelevantCorrections(message || '', projectSlug, 3);

    // Context generation
    console.log(`📝 [CONTEXT GENERATION] Generating enhanced context...`);
    const enhancedContext = generateEnhancedContext(enrichedChunks, message || '');
    const documentContext = await generateContextWithPhase3(
      chunks,
      adminCorrections,
      message || '',
      projectSlug
    );

    const combinedContext = `${enhancedContext}\n\n=== ADMIN CORRECTIONS (Priority Teaching) ===\n${
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

    // Web search
    const useWebSearch = !!image || shouldUseWebSearch(message || '', chunks.length);
    let webSearchContext = '';
    let webSearchResults: Array<{ title: string; url: string; snippet: string }> = [];

    if (useWebSearch) {
      console.log('🌐 Hybrid search: Performing web search...');
      const searchQuery =
        image && message ? `${message} building code requirements compliance` : message || '';
      const webSearch = await performWebSearch(searchQuery);
      if (webSearch.hasResults) {
        webSearchContext = formatWebResultsForContext(webSearch.results);
        webSearchResults = webSearch.results;
        console.log(`✅ Added ${webSearch.results.length} web sources`);
      }
    }

    const accessibleDocs = getAccessibleDocuments(userRole);

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

    // Build context prompt (simplified version - the full prompt is in context-builder.ts)
    const contextPrompt = `You are an AI assistant for One Senior Care Construction Site ChatBot.

**Available Project Documents:**
${documents.map((d) => `- ${d.name} (${d.accessLevel})`).join('\n')}

**User Access Level:** ${
      userRole === 'admin' || userRole === 'client'
        ? 'Full Access (Admin/Client)'
        : 'Guest Access (Limited)'
    }

**Relevant Project Information:**
${combinedContext}${webSearchContext}

${image ? '**IMAGE ANALYSIS REQUIRED**\n' : ''}

Provide direct answers from the documents. Never redirect users to find information themselves.`;

    // LLM API call
    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) {
      throw new Error('LLM API key not configured');
    }

    type TextContent = { type: 'text'; text: string };
    type ImageContent = { type: 'image_url'; image_url: { url: string } };
    type MessageContent = string | Array<TextContent | ImageContent>;
    type ChatMessage = { role: 'user' | 'system'; content: MessageContent };

    let userMessage: ChatMessage;
    if (image) {
      userMessage = {
        role: 'user',
        content: [
          ...(message
            ? [{ type: 'text' as const, text: message }]
            : [{ type: 'text' as const, text: 'Please analyze this image from the project.' }]),
          {
            type: 'image_url' as const,
            image_url: {
              url: image,
            },
          },
        ],
      };
    } else {
      userMessage = { role: 'user', content: message };
    }

    interface LLMRequestBody {
      model: string;
      messages: ChatMessage[];
      stream: boolean;
      max_tokens: number;
      web_search: boolean;
      reasoning_effort?: string;
    }

    const requestBody: LLMRequestBody = {
      model: selectedModel,
      messages: [{ role: 'system', content: contextPrompt }, userMessage],
      stream: true,
      max_tokens: 2000,
      web_search: useWebSearch,
    };

    if (selectedModel.includes('gpt-5.2') && complexityAnalysis.reasoning_effort) {
      requestBody.reasoning_effort = complexityAnalysis.reasoning_effort;
      console.log(
        `⚡ [REASONING] Using ${complexityAnalysis.reasoning_effort} reasoning for GPT-5.2`
      );
    }

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      console.error('LLM API error status:', response.status);
      console.error('LLM API error response:', errorText);

      const error = new Error(`LLM API request failed: ${errorText}`) as Error & {
        status?: number;
      };
      error.status = response.status;
      throw error;
    }

    // Stream response
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let fullResponse = '';
        let partialRead = '';

        if (currentConversationId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ conversationId: currentConversationId })}\n\n`
            )
          );
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            partialRead += decoder.decode(value, { stream: true });
            let lines = partialRead.split('\n');
            partialRead = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  const validation = validateBeforeResponse(
                    message || '',
                    enrichedChunks,
                    fullResponse
                  );

                  if (!validation.passed) {
                    console.warn(`⚠️ [VALIDATION] Response validation failed`);
                  }

                  try {
                    const usedDocIds = [...new Set(chunks.map((c) => c.documentId))];

                    await prisma.chatMessage.create({
                      data: {
                        conversationId: currentConversationId || null,
                        userId: userId || null,
                        userRole,
                        message: message || '[Image uploaded]',
                        response: fullResponse,
                        documentsUsed: usedDocIds,
                        hasImage: !!image,
                      },
                    });

                    if (currentConversationId) {
                      await prisma.conversation.update({
                        where: { id: currentConversationId },
                        data: {
                          updatedAt: new Date(),
                          lastActivityAt: new Date(),
                        },
                      });
                    }

                    if (!image && message && fullResponse) {
                      const documentIds = chunks.map((c) => c.documentId);
                      await cacheResponse(
                        message,
                        fullResponse,
                        projectSlug,
                        documentIds,
                        complexityAnalysis.complexity,
                        selectedModel
                      );
                      console.log(
                        `💾 [CACHE SAVE] Cached ${complexityAnalysis.complexity} query response`
                      );
                    }

                    try {
                      const citations = enrichedChunks
                        .slice(0, 5)
                        .map((chunk: EnhancedChunk) => ({
                          id: chunk.id,
                          documentName: chunk.documentName || 'Unknown Document',
                          documentId: chunk.documentId,
                          pageNumber: chunk.pageNumber,
                          sheetNumber: chunk.sheetNumber,
                          excerpt: chunk.content?.slice(0, 100),
                        }));

                      const followUpSuggestions = generateQuickFollowUps(message || '');

                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({
                            metadata: {
                              citations,
                              followUpSuggestions,
                              documentsUsed: usedDocIds.length,
                            },
                          })}\n\n`
                        )
                      );
                    } catch (metaError) {
                      console.error('Error sending metadata:', metaError);
                    }
                  } catch (dbError) {
                    console.error('Error saving chat message:', dbError);
                  }
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  if (content) {
                    fullResponse += content;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);

    const errorWithStatus = error as Error & { status?: number };
    const statusCode = errorWithStatus.status || 500;

    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: statusCode }
    );
  } finally {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (userId) {
      try {
        await incrementQueryCount(userId);
      } catch (error) {
        console.error('Error incrementing query count:', error);
      }
    }
  }
}
