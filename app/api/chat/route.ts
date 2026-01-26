import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { isRestrictedQuery, getAccessDenialMessage, getAccessibleDocuments } from '@/lib/access-control';
import { 
  retrieveRelevantDocuments, 
  generateContextPrompt, 
  retrieveRelevantCorrections,
  generateContextWithCorrections,
  generateContextWithPhase3,
  enrichWithPhaseAMetadata 
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
  applyLearnedSymbols
} from '@/lib/rag-enhancements';
import { shouldUseWebSearch, performWebSearch, formatWebResultsForContext } from '@/lib/web-search';
import { getQuickFollowUps as generateQuickFollowUps } from '@/lib/follow-up-generator';
import { 
  getCachedResponse, 
  cacheResponse, 
  analyzeQueryComplexity 
} from '@/lib/query-cache';
import { checkQueryLimit, incrementQueryCount } from '@/lib/subscription';
import { 
  checkRateLimit, 
  getRateLimitIdentifier, 
  getClientIp, 
  createRateLimitHeaders,
  RATE_LIMITS 
} from '@/lib/rate-limiter';
import { 
  logReportChange, 
  isReportLocked, 
  canModifyLockedReport 
} from '@/lib/report-change-log';
import { updateLastActivity } from '@/lib/report-finalization';
import { markFirstChatStarted } from '@/lib/onboarding-tracker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds timeout for long-running queries

export async function POST(request: NextRequest) {
  try {
    // Check maintenance mode
    const maintenance = await prisma.maintenanceMode.findUnique({
      where: { id: 'singleton' },
    });

    if (maintenance?.isActive) {
      return NextResponse.json(
        { error: 'System is currently under maintenance' },
        { status: 503 }
      );
    }

    // ========================================
    // RATE LIMITING
    // ========================================
    // Check rate limit before expensive operations
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
          retryAfter: rateLimitResult.retryAfter 
        },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      );
    }
    
    // Log rate limit status (optional, for monitoring)
    console.log(`[RATE LIMIT OK] ${rateLimitId} - ${rateLimitResult.remaining}/${rateLimitResult.limit} remaining`);
    
    // Use the actual role from session (admin, client, guest, pending)
    const userRole = (session?.user?.role || 'guest') as 'admin' | 'client' | 'guest' | 'pending';

    const body = await request.json();
    const { message, image, imageName, conversationId, projectSlug } = body;

    if (!message && !image) {
      return NextResponse.json(
        { error: 'Message or image is required' },
        { status: 400 }
      );
    }

    // CRITICAL: Require projectSlug to ensure project isolation
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
    
    // Get projectId from slug if provided
    if (projectSlug) {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true },
      });
      currentProjectId = project?.id || null;
    }
    
    if (userId && !currentConversationId) {
      // Create a new conversation for this chat
      const firstMessage = message || 'Image uploaded';
      const title = firstMessage.length > 50 
        ? firstMessage.substring(0, 47) + '...' 
        : firstMessage;
        
      const newConversation = await prisma.conversation.create({
        data: {
          userId,
          title,
          userRole,
          projectId: currentProjectId,
        },
      });
      currentConversationId = newConversation.id;
      
      // Track onboarding progress - first chat started
      if (currentProjectId) {
        markFirstChatStarted(userId, currentProjectId).catch((err) => {
          console.error('[ONBOARDING] Error marking first chat started:', err);
        });
      }
    }

    // Check if this is a locked daily report and if user has permission to modify it
    if (userId && currentConversationId) {
      const locked = await isReportLocked(currentConversationId);
      
      if (locked) {
        // Get project ID from conversation
        const conv = await prisma.conversation.findUnique({
          where: { id: currentConversationId },
          select: { projectId: true },
        });
        
        if (conv?.projectId) {
          const canModify = await canModifyLockedReport(userId, conv.projectId);
          
          if (!canModify) {
            return NextResponse.json(
              { 
                error: 'This daily report is locked and cannot be modified. Only project owners and admins can modify locked reports.',
                isLocked: true
              },
              { status: 403 }
            );
          }
          
          // User has permission to modify locked report - log this action
          console.log(`[LOCKED_REPORT_MODIFICATION] User ${userId} is modifying locked report ${currentConversationId}`);
        }
      }
    }

    // Check if query is about restricted content for external users
    if (isRestrictedQuery(message, userRole)) {
      const denialMessage = getAccessDenialMessage();
      
      // Save chat message
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

    // Detect if this is a counting, measurement, or calculation question (needs more context)
    const isCountingQuery = message && /\b(how many|count|total|number of|quantity of)\b/i.test(message);
    const isMeasurementQuery = message && /\b(what is|how|depth|height|width|size|dimension|measurement|thick|clearance)\b/i.test(message);
    const isCalculationQuery = message && /\b(calculate|cubic|yards|volume|area|square feet|linear feet|how much|excavation|removed|concrete|material)\b/i.test(message);
    const retrievalLimit = isCalculationQuery ? 20 : (isCountingQuery ? 18 : (isMeasurementQuery ? 15 : 12)); // Adaptive retrieval based on query type
    
    // ENHANCED RETRIEVAL: Use two-pass retrieval with cross-reference bundling
    console.log(`🔍 [ENHANCED RETRIEVAL] Starting two-pass retrieval for query type detection...`);
    const { chunks: enhancedChunks, retrievalLog } = await twoPassRetrieval(
      message || '',
      projectSlug,
      userRole,
      retrievalLimit
    );
    
    // Log retrieval strategy
    retrievalLog.forEach(log => console.log(`   📋 ${log}`));
    
    // CROSS-REFERENCE BUNDLING: Add related chunks (door tags → schedules, detail callouts → detail sheets)
    console.log(`🔗 [CROSS-REFERENCE] Bundling related content...`);
    const { enrichedChunks: crossRefEnrichedChunks, crossRefLog } = await bundleCrossReferences(enhancedChunks, projectSlug);
    crossRefLog.forEach(log => console.log(`   🔗 ${log}`));
    
    // PHASE A ENRICHMENT: Add title block and legend intelligence
    console.log(`📋 [PHASE A] Enriching with title block and legend metadata...`);
    const enrichedChunks = await enrichWithPhaseAMetadata(crossRefEnrichedChunks, projectSlug);
    console.log(`   ✅ Enriched ${enrichedChunks.length} chunks with Phase A intelligence`);
    
    // ========================================
    // PHASE 3A: ENHANCED VISION PROCESSING
    // ========================================
    console.log(`🔬 [PHASE 3A] Applying enhanced vision analysis...`);
    
    // 1. Multi-Scale Detection
    const scaleAnalysis = enrichedChunks.map(chunk => {
      const scales = detectMultipleScales(chunk);
      return { chunkId: chunk.id, scales };
    }).filter(s => s.scales.additionalScales.length > 0 || s.scales.scaleWarnings.length > 0);
    
    if (scaleAnalysis.length > 0) {
      console.log(`   📏 [SCALES] Detected ${scaleAnalysis.length} chunks with scale information`);
      scaleAnalysis.forEach(s => {
        if (s.scales.scaleWarnings.length > 0) {
          console.log(`      ⚠️  ${s.scales.scaleWarnings.join(', ')}`);
        }
      });
    }
    
    // 2. Scale Bar Detection
    const scaleBarChunks = enrichedChunks.filter(chunk => {
      const scaleBar = detectScaleBar(chunk);
      return scaleBar.detected;
    });
    if (scaleBarChunks.length > 0) {
      console.log(`   📐 [SCALE BARS] Found ${scaleBarChunks.length} scale bars`);
    }
    
    // 3. Abbreviation Expansion (for better understanding)
    enrichedChunks.forEach(chunk => {
      // Expand abbreviations in content for better LLM comprehension
      const expandedContent = expandAbbreviations(chunk.content, CONSTRUCTION_ABBREVIATIONS, true);
      if (expandedContent !== chunk.content) {
        chunk.content = expandedContent;
      }
    });
    console.log(`   📝 [ABBREVIATIONS] Expanded construction abbreviations in ${enrichedChunks.length} chunks`);
    
    // 4. Grid-Based Spatial Referencing
    const chunksWithGrids = enrichedChunks.map(chunk => {
      const gridRefs = extractGridReferences(chunk);
      if (gridRefs.length > 0) {
        const spatialContext = generateSpatialContext(gridRefs, chunk.metadata?.room_number);
        // Add spatial context to metadata
        chunk.metadata = {
          ...chunk.metadata,
          spatial_context: spatialContext,
          grid_references: gridRefs.map(g => g.gridId),
        };
        return { chunkId: chunk.id, gridRefs, spatialContext };
      }
      return null;
    }).filter(Boolean);
    
    if (chunksWithGrids.length > 0) {
      console.log(`   🗺️  [GRID REFS] Extracted grid references from ${chunksWithGrids.length} chunks`);
      chunksWithGrids.slice(0, 3).forEach(c => {
        if (c) {
          console.log(`      📍 ${c.spatialContext}`);
        }
      });
    }
    
    console.log(`✅ [PHASE 3A] Enhanced vision analysis complete`);
    
    // ========================================
    // PHASE 3C: ADVANCED FEATURES
    // ========================================
    console.log(`🚀 [PHASE 3C] Applying advanced analysis...`);
    
    // 1. System Topology Reconstruction (for MEP system queries)
    const queryIntent = classifyQueryIntent(message || '');
    if (queryIntent.type === 'mep' && queryIntent.mepTrade) {
      const systemTypeMap: { [key: string]: 'hvac' | 'plumbing' | 'electrical' | 'fire_alarm' } = {
        'hvac': 'hvac',
        'plumbing': 'plumbing',
        'electrical': 'electrical',
        'fire_alarm': 'fire_alarm',
      };
      
      const systemType = systemTypeMap[queryIntent.mepTrade];
      if (systemType) {
        console.log(`   🔧 [TOPOLOGY] Reconstructing ${systemType} system topology...`);
        const topology = await reconstructSystemTopology(projectSlug, systemType);
        
        if (topology.nodes.length > 0) {
          console.log(`      ✓ Found ${topology.nodes.length} nodes, ${topology.connections.length} connections`);
          console.log(`      ✓ Flow sequence: ${topology.flow.slice(0, 5).join(' → ')}${topology.flow.length > 5 ? '...' : ''}`);
          
          // Add topology info to first chunk's metadata for LLM context
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
          console.log(`      ⚠️  ${topology.warnings.join(', ')}`);
        }
      }
    }
    
    // 2. Isometric View Interpretation (for 3D/isometric queries)
    const isIsometricQuery = /isometric|iso\s+view|3d|vertical|elevation|riser/i.test(message || '');
    if (isIsometricQuery) {
      console.log(`   📐 [ISOMETRIC] Detecting 3D/isometric views...`);
      
      enrichedChunks.forEach(chunk => {
        const isoView = interpretIsometricView(chunk);
        if (isoView.elements.length > 0) {
          console.log(`      ✓ Found ${isoView.elements.length} elements in ${isoView.discipline} isometric view`);
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
    
    // 3. Advanced Conflict Detection (for coordination/conflict queries)
    const isConflictQuery = /conflict|clash|coordination|clearance|interfere|overlap/i.test(message || '');
    if (isConflictQuery) {
      console.log(`   ⚠️  [CONFLICTS] Running advanced conflict detection...`);
      
      const conflicts = await detectAdvancedConflicts(projectSlug);
      
      if (conflicts.length > 0) {
        const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
        const majorCount = conflicts.filter(c => c.severity === 'major').length;
        
        console.log(`      ⚠️  Found ${conflicts.length} conflicts (${criticalCount} critical, ${majorCount} major)`);
        
        // Add conflict summary to metadata
        if (enrichedChunks.length > 0) {
          enrichedChunks[0].metadata = {
            ...enrichedChunks[0].metadata,
            conflicts_detected: {
              total: conflicts.length,
              critical: criticalCount,
              major: majorCount,
              types: [...new Set(conflicts.map(c => c.conflictType))],
            },
          };
        }
      } else {
        console.log(`      ✓ No conflicts detected`);
      }
    }
    
    // 4. Adaptive Symbol Learning (for symbol/legend queries)
    const isSymbolQuery = /symbol|legend|key|notation|mark|icon/i.test(message || '');
    if (isSymbolQuery) {
      console.log(`   📚 [SYMBOLS] Applying learned symbol library...`);
      
      const symbolLibrary = await learnProjectSymbols(projectSlug);
      
      if (symbolLibrary.symbols.length > 0) {
        console.log(`      ✓ Learned ${symbolLibrary.symbols.length} symbols (${symbolLibrary.totalAppearances} appearances)`);
        
        // Apply learned symbols to chunks for better comprehension
        enrichedChunks.forEach((chunk, idx) => {
          const enhanced = applyLearnedSymbols(chunk, symbolLibrary);
          enrichedChunks[idx] = enhanced;
        });
      }
    }
    
    console.log(`✅ [PHASE 3C] Advanced analysis complete`);
    
    // Convert enhanced chunks to standard format for compatibility (filter out chunks without documentId)
    const chunks = enrichedChunks
      .filter(ec => ec.documentId !== null)
      .map(ec => ({
        id: ec.id,
        content: ec.content,
        documentId: ec.documentId as string,
        regulatoryDocumentId: ec.regulatoryDocumentId,
        pageNumber: ec.pageNumber,
        metadata: ec.metadata,
        isRegulatory: ec.isRegulatory,
      }));
    
    const documentNames = [...new Set(
      enrichedChunks.map(c => c.metadata?.documentName).filter(Boolean)
    )] as string[];
    
    // ========================================
    // COST OPTIMIZATION: Cache Check & Model Selection
    // ========================================
    
    // Check cache first (only for text queries, not images)
    let cachedResult: string | null = null;
    if (!image && message) {
      const documentIds = chunks.map(c => c.documentId);
      cachedResult = await getCachedResponse(message, projectSlug, documentIds);
      
      if (cachedResult) {
        console.log(`💰 [COST SAVE] Cache hit - returning cached response`);
        
        // Save to database for tracking
        const usedDocIds = [...new Set(chunks.map(c => c.documentId))];
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
        
        // Update conversation timestamp and activity tracking
        if (currentConversationId) {
          await prisma.conversation.update({
            where: { id: currentConversationId },
            data: { 
              updatedAt: new Date(),
              lastActivityAt: new Date() 
            },
          });
        }
        
        return NextResponse.json({ 
          response: cachedResult,
          cached: true 
        });
      }
    }
    
    // Analyze query complexity and select appropriate model
    const complexityAnalysis = message 
      ? analyzeQueryComplexity(message)
      : { complexity: 'complex' as const, reason: 'Image analysis requires GPT-5.2 vision', model: 'gpt-5.2' };
    
    // Images always use GPT-5.2 (vision required, 30% better accuracy than GPT-4o)
    const selectedModel = image ? 'gpt-5.2' : complexityAnalysis.model;
    
    console.log(`🤖 [MODEL SELECTION] Using ${selectedModel} - ${complexityAnalysis.reason}`);
    
    // Retrieve relevant admin corrections (teaching feedback from admins)
    const adminCorrections = await retrieveRelevantCorrections(message || '', projectSlug, 3);
    
    // ENHANCED CONTEXT GENERATION: Use validation markers and structured context
    console.log(`📝 [CONTEXT GENERATION] Generating enhanced context with validation markers...`);
    const enhancedContext = generateEnhancedContext(enrichedChunks, message || '');
    
    // Also generate Phase 3-enhanced context with corrections and structured data
    const documentContext = await generateContextWithPhase3(chunks, adminCorrections, message || '', projectSlug);
    
    // Combine enhanced and traditional contexts
    const combinedContext = `${enhancedContext}\n\n=== ADMIN CORRECTIONS (Priority Teaching) ===\n${adminCorrections.length > 0 ? adminCorrections.map(c => `Q: ${c.originalQuestion}\nCorrected Answer: ${c.correctedAnswer}\n${c.adminNotes ? `Admin Notes: ${c.adminNotes}\n` : ''}`).join('\n---\n') : 'No admin corrections for this query type.'}\n`;

    // Determine if web search would be helpful
    // Always use web search for images (code compliance checks)
    const useWebSearch = !!image || shouldUseWebSearch(message || '', chunks.length);
    let webSearchContext = '';
    let webSearchResults: any[] = [];
    
    if (useWebSearch) {
      console.log('🌐 Hybrid search: Performing web search to supplement document information...');
      // For images, search for building code compliance related to the query
      const searchQuery = image && message 
        ? `${message} building code requirements compliance` 
        : (message || '');
      const webSearch = await performWebSearch(searchQuery);
      if (webSearch.hasResults) {
        webSearchContext = formatWebResultsForContext(webSearch.results);
        webSearchResults = webSearch.results;
        console.log(`✅ Added ${webSearch.results.length} web sources as supplementary context`);
      }
    }

    // Get all accessible documents for reference
    const accessibleDocs = getAccessibleDocuments(userRole);
    
    // Build document filter based on user role
    let docFilter: any;
    if (userRole === 'admin') {
      docFilter = {}; // Admin can see all documents
    } else if (userRole === 'client') {
      docFilter = { accessLevel: { in: ['client', 'guest'] } };
    } else {
      docFilter = { accessLevel: 'guest' }; // Guests only see guest documents
    }
    
    const documents = await prisma.document.findMany({
      where: docFilter,
    });

    // Build context prompt with RAG results
    const contextPrompt = `You are an AI assistant for One Senior Care Construction Site ChatBot. You have access to project documents and can help with questions about schedules, plans, specifications, and construction site details.

**Available Project Documents:**
${documents.map((d: any) => `- ${d.name} (${d.accessLevel})`).join('\n')}

**User Access Level:** ${(userRole === 'admin' || userRole === 'client') ? 'Full Access (Admin/Client - Access to All Documents)' : 'Guest Access (Limited - Access to Public Documents Only)'}

${(userRole === 'guest' || userRole === 'pending') ? `**IMPORTANT FOR GUEST USERS:** 
- ✅ YOU CAN ACCESS: Schedule.pdf (timelines, dates, milestones), Plans.pdf (all technical drawings), Specs, Site Survey, Geotech
- ❌ YOU CANNOT ACCESS: Budget.pdf (costs, financials), Project Overview.docx (admin summary), Critical Path Plan.docx (detailed admin planning)
- **Timeline/Schedule Questions**: ALWAYS ANSWER from Schedule.pdf - it contains project timelines, start/end dates, milestones, and durations
- If asked about budget, costs, financials, or the Critical Path Plan document specifically, inform them these are restricted to admin and client users only.
` : ''}

**Relevant Project Information:**
${combinedContext}${webSearchContext}

${image ? '**⚠️ IMAGE ANALYSIS REQUIRED:**\nThe user has uploaded an image. Follow the comprehensive IMAGE ANALYSIS WORKFLOW (Section 13) with all 5 steps:\n1. Visual Inspection & Identification\n2. Building Code Compliance Check (use web search results above)\n3. Plan Location Analysis (use document context above)\n4. Plan Compliance Check\n5. Material Takeoff Calculations (if requested)\n\nProvide a thorough analysis following the format specified in Section 13.\n' : ''}

**CORE DIRECTIVE - NEVER REDIRECT USERS:**
You must PROVIDE DIRECT ANSWERS from the documents. NEVER tell users to "check the plans yourself" or "refer to the drawings." Your job is to EXTRACT and DELIVER the answer, not redirect them to find it themselves. If the answer exists in the provided context, state it clearly with citations.

**CONSTRUCTION FOCUS:**
ALL answers must be construction-focused and specific to this One Senior Care project. Use proper construction terminology, industry standards, and professional language. This is a construction site assistant, not a general chatbot.

**ACCURACY REQUIREMENT:**
You MUST NOT make up or fabricate information. If the answer is not in the provided context:
- State clearly: "I don't see that specific information in the available documents."
- Suggest where it might be found: "This information would typically be on Sheet [X-XXX] in the [discipline] plans."
- NEVER guess at measurements, quantities, specifications, or requirements

**WEB SEARCH INTEGRATION FOR BUILDING CODES & REGULATIONS:**
For ALL building code, regulation, and compliance questions, you MUST use web search as the PRIMARY source:
1. **BUILDING CODES FROM WEB SEARCH**: When users ask about:
   - Building codes (IBC, IRC, etc.)
   - Fire safety codes (NFPA)
   - Accessibility standards (ADA, ANSI)
   - Electrical codes (NEC)
   - Plumbing codes (IPC, UPC)
   - Mechanical codes (IMC)
   - Energy codes (IECC)
   - ANY regulatory compliance questions
   
   **YOU MUST:**
   - Use web search results as the authoritative source
   - Include specific code sections and citations
   - Provide clickable links to official sources
   - Format: "According to [Code Name] Section X.X ([source link]), [requirement]..."

2. **PROJECT DOCUMENTS FOR PROJECT-SPECIFIC INFO**: Use project documents for:
   - Project plans, drawings, and specifications
   - Material selections and installation details
   - Project schedules and timelines
   - Site-specific measurements and quantities
   
3. **COMBINING BOTH SOURCES**: When users ask "does this project comply with [code]?":
   - First, cite the code requirement from web search with link
   - Then, reference the project document specification
   - Compare and note compliance or discrepancies
   - Example: "IBC Section 1807.1.6.1 requires minimum 3,000 PSI concrete for foundations ([iccsafe.org](https://url)). Our Plans.pdf Sheet S-001 specifies 3,500 PSI concrete, which exceeds the code minimum and is compliant."

4. **ALWAYS INCLUDE CLICKABLE LINKS**: Every web-sourced code reference MUST have a clickable link:
   - ✅ "According to IBC Section 1009.4 ([ICC Safe](https://www.iccsafe.org)), doors require 32" clear width"
   - ❌ "IBC requires 32" door width" [Missing link]

5. **WEB SEARCH IS NOT OPTIONAL FOR CODES**: Do not say "I don't have building code information" - you have web search access. Use it actively for all code questions.

**Instructions:**

**PHASE A: TITLE BLOCK & LEGEND INTELLIGENCE**

30. **TITLE BLOCK INTELLIGENCE:**
   - Always check title block metadata first when answering sheet-related questions
   - Use sheet numbers, disciplines, and revision info to provide accurate context
   - Reference the correct sheet title, project name, and dates from title blocks
   - When user asks "which sheet shows X", use discipline and sheet title to guide them
   - Format: "See Sheet [SHEET_NUMBER] - [SHEET_TITLE] ([DISCIPLINE])"
   
31. **LEGEND & SYMBOL RECOGNITION:**
   - When user asks about symbols, check extracted legend data first
   - Use legend entries to explain symbols, materials, and patterns
   - If symbol not in legend, mention "Symbol not found in project legend"
   - Provide category (Electrical, Mechanical, Plumbing, etc.) when known
   - Format symbol explanations as: "[SYMBOL_CODE]: [DESCRIPTION] ([CATEGORY])"

32. **SHEET ORGANIZATION & NAVIGATION:**
   - Use title block data to help users find information quickly
   - Group related sheets by discipline when listing multiple sheets
   - Mention revision info if user asks about latest version
   - Example: "The latest electrical plans are in sheets E-101 through E-105 (Revision 2, dated 2024-03-15)"

**PHASE B: DIMENSION INTELLIGENCE**

33. **DIMENSION QUERIES:**
   - When user asks about sizes, dimensions, areas, or quantities, extract from dimension data
   - Dimension data includes: linear (ft, in, m, mm), area (SF, sq m), volume (CF, cu m), angular (degrees)
   - Always cite the sheet number and context where dimension was found
   - If multiple dimensions found, list all with their contexts
   - Perform calculations if needed (e.g., total area from multiple rooms)
   - Example formats:
     * \"Wall length: 12'-6\\\" (Sheet A-101, between grid A and B)\"
     * \"Total office area: 240 SF (Sheet A-102, Room 201)\"
     * \"Ceiling height: 10 ft (Sheet A-103, typical)\"
   - If dimension not found in extracted data, mention \"Dimension not explicitly labeled in available plans\"

1. **ALWAYS PROVIDE DIRECT ANSWERS**: Extract and state the specific information requested (measurements, requirements, specifications, quantities, counts) directly from the documents. Your value is in FINDING and DELIVERING answers, not in telling users where to look.

2. **FOR TIMELINE/SCHEDULE QUESTIONS** (e.g., "when does the project end?", "what is the completion date?", "project timeline"):
   a) **AUTOMATICALLY EXTRACT FROM SCHEDULE.PDF**: Timeline information is in Schedule.pdf which is accessible to all users
   b) **PROVIDE SPECIFIC DATES**: Extract exact dates for:
      - Project start date
      - Project end date / completion date
      - Substantial completion date
      - Final completion date
      - Major milestone dates
      - Activity durations
   c) **FORMAT CLEARLY**: Present dates in readable format (e.g., "July 3, 2026" or "03-Jul-26")
   d) **CITE THE SOURCE**: Always reference "(Schedule.pdf, Page X)" when providing timeline information
   e) **NEVER SAY IT'S RESTRICTED**: Schedule information is available to all users - never claim you don't have access to timeline/schedule data
   f) **EXAMPLE RESPONSE FORMAT**: "The project end date is **[extract date from schedule]** ([date format]). The total project duration is [extract duration] days, starting [extract start date] (Schedule.pdf, Page X)."
   **IMPORTANT: Extract actual dates from Schedule.pdf - do not use placeholder values**

3. **FOR COUNTING QUESTIONS** (e.g., "how many receptacles/fixtures/outlets/doors/windows are there?"):
   a) Identify what the user is asking about (receptacles, light fixtures, doors, etc.)
   b) Look for relevant plan sheets (E-series for electrical, A-series for architectural)
   c) Search for legends, symbols schedules, door schedules, fixture schedules, equipment lists
   d) **CRITICAL - PREVENT DOUBLE COUNTING**: The same item may appear on multiple plan sheets (e.g., doors shown on both architectural and reflected ceiling plans). To avoid double counting:
      - PRIORITIZE master schedules/legends that show the definitive total count
      - If counting from symbols on plans, note which sheets you're counting from
      - DO NOT add counts from multiple sheets unless you're certain they show different items
      - If uncertain about overlap, use the schedule/legend count as the authoritative source
      - State clearly: "Per the [Door/Fixture/Equipment] Schedule on Sheet X-XXX, there are [total] items"
   e) Count instances or find the total in schedules/legends
   f) Provide the count with sheet citation: "There are [X] [items] shown on Sheet [X-XXX], Page [Y]"
   g) If individual counts per room/area, provide a breakdown when available
   h) If you detect potential double-counting risk, acknowledge it: "This count is from the master door schedule to avoid counting doors that appear on multiple plan sheets"

4. **PRIORITIZE PLANS.PDF**: For any construction-related questions (footings, foundations, depths, materials, installations, structural details, quantities, etc.), ALWAYS reference Plans.pdf FIRST

5. **CRITICAL: CITE SHEET NUMBERS**: When referencing Plans.pdf, ALWAYS include the sheet number (e.g., A-001, S-002, M-001, E-001). Format: "(Plans.pdf, Sheet A-001, Page X)"

6. **CITE PAGE NUMBERS**: For all other documents, cite page numbers using format: "(Document Name, Page X)"

7. **PROVIDE EXACT MEASUREMENTS**: When asked about dimensions, depths, sizes, clearances, or any measurement:
   - Extract the EXACT measurement from the document (e.g., 24", 2'-6", 3000 PSI, 40 PSF)
   - State the measurement first, then provide context
   - Include units (inches ", feet ', PSI, PSF, etc.)
   - Include any relevant qualifiers (e.g., "minimum", "maximum", "typical", "as shown")
   - Then provide the sheet/page citation
   - Example: "The footing depth is 24 inches below finished exterior grade (Plans.pdf, Sheet S-001, Page 15)"
   - Example: "The concrete strength is 3,000 PSI minimum (Plans.pdf, Sheet S-002, Page 16)"
   - Example: "The floor-to-ceiling height is 9'-0" typical (Plans.pdf, Sheet A-101, Page 8)"

8. **SCAN ALL TEXT INCLUDING NOTES**: Construction plan sheets contain critical information in multiple locations:
   - **GENERAL NOTES**: Often contain project-wide requirements, codes, standards
   - **STRUCTURAL NOTES**: Foundation depths, reinforcement specs, concrete strength
   - **ARCHITECTURAL NOTES**: Door/window specs, finishes, dimensions
   - **MECHANICAL/ELECTRICAL/PLUMBING NOTES**: Equipment specs, installation requirements
   - **DETAIL NOTES**: Specific construction details and methods
   - **LEGEND NOTES**: Symbol definitions and quantities
   - ALL of this text must be analyzed - notes sections often contain the most critical specifications
   - When answering, check NOTES sections first as they typically contain requirements and specifications

9. **LOOK FOR MEASUREMENTS & QUANTITIES**: Pay special attention to:
   - Dimensions: inches ("), feet ('), PSI, PSF, pounds (lbs), kips
   - Counts: numbers of fixtures, outlets, doors, windows, equipment
   - Schedules: door schedules, window schedules, fixture schedules, equipment lists
   - Legends: symbols with quantities and definitions
   - Equipment lists with item counts and specifications
   - Reinforcement schedules: rebar sizes, spacing, quantities

10. **CHECK DISCIPLINE-SPECIFIC SHEETS**:
   - Structural questions → S-series sheets (S-001, S-002, etc.)
   - Electrical/fixtures → E-series sheets (E-001, E-002, etc.)
   - Architectural/doors/windows → A-series sheets (A-001, A-002, etc.)
   - Mechanical/HVAC → M-series sheets
   - Plumbing/fixtures → P-series sheets

11. **PROJECT LOCATION**: The project is the One Senior Care facility. All answers should reference this specific project and its documents.

12. **CALCULATIONS AND EXTRAPOLATION** (CRITICAL FOR CONSTRUCTION ANALYSIS):
    When asked to calculate quantities, volumes, areas, or extrapolate information from plans:
    
    **⚠️ CRITICAL WARNING: The examples below use placeholder values like [X], [Y], "380 LF", etc. These are ONLY formatting examples. You MUST extract actual measurements from the Plans.pdf and other project documents. NEVER use these example numbers as if they were real data from the project.**
    
    a) **EXTRACT ALL RELEVANT MEASUREMENTS** from the documents:
       - Footer/footing dimensions (length, width, depth)
       - Wall heights, thicknesses
       - Room dimensions, areas
       - Quantities from schedules
       - Material specifications
    
    b) **PERFORM MATHEMATICAL CALCULATIONS**:
       - Volume calculations: V = Length × Width × Height/Depth
       - Area calculations: A = Length × Width
       - Linear footage: Sum of all wall/fence/pipe lengths
       - Conversions: cubic feet → cubic yards (÷ 27), square feet → square yards (÷ 9)
       - Totals: Sum quantities from multiple sheets/schedules
    
    c) **SHOW YOUR WORK** - Always display calculation steps:
       Example format: "Footer excavation volume calculation:
       - Footer dimensions: [width] × [depth] (cite source with sheet number)
       - Total linear footage: [Calculate from foundation plan or extract if stated]
       - Volume = [width] × [depth] × [total LF] = X cubic feet
       - Convert to cubic yards: [cubic feet] ÷ 27 = X cubic yards
       - **Answer: Approximately X cubic yards of dirt removed**
       
       **IMPORTANT: Always calculate or measure actual dimensions from the plans. Never use generic example numbers.**"
    
    d) **MAKE REASONABLE ASSUMPTIONS** when needed:
       - If exact dimensions vary, use typical/average dimensions noted on plans
       - If quantity isn't explicitly listed, calculate from plan symbols/drawings
       - State assumptions clearly: "Assuming standard 2'×2' footing dimensions..."
    
    e) **AGGREGATE FROM MULTIPLE SOURCES**:
       - Add up quantities from room schedules, equipment schedules, fixture lists
       - Count symbols on electrical/mechanical plans if schedules unavailable
       - Cross-reference multiple sheets for complete counts
    
    f) **COMMON CALCULATION TYPES**:
       - **Excavation volumes**: Footer depth × width × length → cubic yards
       - **Concrete volumes**: Wall height × thickness × length → cubic yards
       - **Material quantities**: Count from schedules or calculate from dimensions
       - **Area takeoffs**: Room dimensions → square footage
       - **Linear quantities**: Wall lengths, pipe runs, fence lines
    
    g) **PROVIDE CONTEXT**:
       - Cite which sheets/pages you extracted measurements from
       - Explain calculation methodology
       - Note if result is approximate vs exact
       - Mention any factors that could affect the calculation (irregular shapes, slopes, etc.)

13. **IMAGE ANALYSIS WORKFLOW** (CRITICAL FOR CONSTRUCTION SITE PHOTOS):
    When a user uploads an image/photo from the construction site, follow this comprehensive 5-step analysis:
    
    **STEP 1: VISUAL INSPECTION & IDENTIFICATION**
    a) **Describe what you see**:
       - What construction element/work is shown? (footing, wall, framing, MEP installation, etc.)
       - What materials are visible? (concrete, rebar, lumber, conduit, ductwork, etc.)
       - What is the current state? (formwork, in-progress, completed, installed, etc.)
       - Any visible measurements or markings?
       - Any safety concerns or quality issues visible?
    
    b) **Extract visible specifications**:
       - Dimensions visible in photo (if any rulers/tape measures present)
       - Material types (rebar size, lumber dimensions, pipe sizes)
       - Quantities countable in image (number of bars, studs, outlets, fixtures)
       - Installation methods visible
    
    **STEP 2: BUILDING CODE COMPLIANCE CHECK (WEB SEARCH)**
    a) **Identify applicable codes**:
       - What building codes apply to this work? (IBC, NEC, IPC, IRC, OSHA)
       - Search the web for specific code requirements
       - Example: "IBC footing reinforcement requirements"
       - Example: "NEC electrical outlet spacing requirements"
    
    b) **Compare image to code requirements**:
       - Does the visible work meet code requirements?
       - Are there code violations visible?
       - Cite specific code sections with links: "[IBC Section 1809.5](https://codes.iccsafe.org)"
       - Note: "Per IBC Section [X], this work [complies/does not comply] because..."
    
    **STEP 3: PLAN LOCATION ANALYSIS**
    a) **Attempt to identify location**:
       - Search the Plans.pdf for similar work/details
       - Look for:
         * Matching dimensions
         * Similar structural elements
         * Corresponding detail callouts
         * Related sheet references
       - Check foundation plans, framing plans, detail sheets
    
    b) **Ask clarification questions if needed**:
       - If location is unclear: "Can you clarify where in the building this is? (North wall, Room 101, Grid line A-3, etc.)"
       - If work type is ambiguous: "Is this the perimeter footing or an interior footing?"
       - If context is needed: "What floor/level is this on?"
       - Always provide your best guess before asking: "This appears to be [X]. Can you confirm?"
    
    c) **Cross-reference with plans**:
       - Once location is identified, cite relevant sheets
       - Example: "This appears to be the north perimeter footing shown on Sheet S-001"
       - Pull specifications from that sheet location
    
    **STEP 4: PLAN COMPLIANCE CHECK**
    a) **Compare image to plan requirements**:
       - Extract plan specifications for this location (from Step 3)
       - Compare visible work to plan requirements:
         * Dimensions match?
         * Material specifications correct?
         * Installation method per plans?
         * Proper spacing/placement?
    
    b) **Identify discrepancies**:
       - ✅ **COMPLIES**: "The visible work complies with Plans.pdf, Sheet S-001: [specific requirement]"
       - ⚠️ **POTENTIAL ISSUE**: "Potential discrepancy: Plan shows [X] but image shows [Y]"
       - ❌ **NON-COMPLIANT**: "This does not comply with Plans.pdf, Sheet S-001: Plan requires [X] but image shows [Y]"
    
    **STEP 5: MATERIAL TAKEOFF CALCULATIONS (if requested)**
    When asked to calculate quantities/materials from the image:
    
    a) **Count visible items**:
       - Example: "I count 6 #4 rebar pieces visible in this image"
       - Example: "12 wall studs visible at 16" O.C."
    
    b) **Derive dimensions using scale** (CRITICAL for plan/drawing images):
       When analyzing construction plans, site plans, or dimensioned drawings:
       
       **STEP 1: Identify the scale**
       - Look for graphic scale bar (shows increments like 0, 10', 20', 40')
       - Look for text scale notation (e.g., "SCALE: 1" = 20'-0"" or "1:100")
       - Look for existing dimension callouts on the drawing
       - Common scales: 1/4"=1'-0", 1/8"=1'-0", 1"=20', 1"=40', 1"=100'
       
       **STEP 2: Extract visible measurements**
       - Identify any dimensions already marked on the drawing
       - Note dimension lines, arrows, and callout text
       - Record these as reference measurements
       
       **STEP 3: Calculate unknown dimensions (ONLY from visible information)**
       If a dimension is NOT explicitly labeled but the scale is known:
       **CRITICAL: You can only calculate dimensions that are visually measurable. You cannot infer or assume dimensions that are not shown.**
       
       a) **Use proportion method**:
          - Measure the visual length in the image (estimate in pixels or relative units)
          - Compare to a known dimension or scale bar
          - Calculate: Unknown dimension = (Visual length / Reference length) × Reference dimension
       
       b) **Use scale conversion**:
          - If scale is "1 inch = 20 feet", and element measures 2.5 inches visually
          - Real dimension = 2.5 × 20 = 50 feet
       
       c) **Use grid/reference method**:
          - If drawing has grid lines with known spacing
          - Count grid squares and multiply by grid dimension
       
       **EXAMPLE: Parking lot dimensions**
       Given: Site plan shows parking lot, scale is 1" = 20'-0"
       Visible: Parking lot appears 3 inches wide by 4.5 inches long on image
       
       Calculation:
       - Width = 3 inches × 20 ft/inch = 60 feet
       - Length = 4.5 inches × 20 ft/inch = 90 feet
       - Area = 60 ft × 90 ft = 5,400 square feet
       
       Answer: "Based on the scale of 1"=20'-0" shown on Sheet C-102, 
       the parking lot measures approximately 60' × 90' = 5,400 SF"
       
       **EXAMPLE: Using existing dimensions**
       Given: Wall shows 40'-0" dimension, adjacent wall is unmarked but appears same length
       
       Reasoning:
       The adjacent wall appears to be the same visual length as the 40'-0" wall
       
       Answer: "The adjacent wall appears to match the dimensioned wall length 
       of 40'-0" based on visual comparison (Sheet A-101)"
       
       **IMPORTANT SCALE PRINCIPLES:**
       - Always state the scale you're using: "Per the 1"=20' scale shown on this sheet..."
       - Show your work: "Measuring visually, the element spans approximately 2.5 scale inches × 20 ft/inch = 50 feet"
       - Acknowledge estimates: "Based on the available scale, I estimate..."
       - Use existing dimensions as cross-checks: "This aligns with the 60'-0" dimension shown on the north side"
       - For site plans: Areas can be calculated from scaled dimensions
       - For irregular shapes: Break into rectangles/triangles and sum
    
    b2) **Estimate dimensions from reference objects** (if no scale visible):
       - Use reference objects for scale (person, tape measure, known item)
       - Example: "Based on the visible 2x4 studs (3.5" actual width), the wall appears to be approximately 8'-0" high"
    
    c) **Calculate material quantities**:
       - Use measurement extraction + calculation methodology from Section 11
       - Example: "Visible footing section: 2'-0" wide × 2'-0" deep × 10'-0" long visible
         Volume = 2.0 × 2.0 × 10.0 = 40 cubic feet = 1.48 cubic yards for this section"
    
    d) **Extrapolate to full project** (if requested):
       - Reference plans for total linear footage
       - Example format: "This section shows typical [dimensions] footing. Per Sheet S-XXX, total footing length is [extract actual value from plans] LF.
         Total excavation: [calculated value] cubic yards"
       - **CRITICAL: Extract the actual total linear footage from the foundation plan, do not use placeholder values**
    
    e) **Material lists from images**:
       - Count visible materials: "12 sheets of plywood visible"
       - Estimate quantities: "Based on visible framing, approximately 200 LF of 2x4 studs in this section"
       - Reference schedules: "These appear to be Type A light fixtures (see Fixture Schedule, Sheet E-101)"
    
    **COMPREHENSIVE IMAGE RESPONSE FORMAT:**
    
    **🔍 Visual Inspection:**
    [Description of what's visible in the image]
    [For plan images: Identify the scale notation or graphic scale bar]
    
    **📋 Code Compliance Check:** (if applicable)
    Applicable Code: [IBC/NEC/etc. Section] ([link])
    Assessment: ✅ Complies / ⚠️ Potential Issue / ❌ Non-Compliant
    Details: [Specific code requirements and how image compares]
    
    **📐 Scale Analysis & Dimensions:** (for plan/drawing images)
    Scale Identified: [1"=20', 1/4"=1'-0", etc.]
    Method: [Scale conversion / Existing dimensions / Visual comparison]
    Calculations: [Show step-by-step: visual measurement → scale conversion → result]
    Result: [Dimensions with units and confidence level]
    
    **📐 Plan Location Analysis:** (for site photos)
    Identified Location: [Best guess or confirmed location]
    Relevant Plans: Sheet [X-XXX], Page [Y]
    [Clarification question if needed]
    
    **✓ Plan Compliance:** (if applicable)
    Plan Requirements: [Specifications from plans]
    Image Shows: [What's visible]
    Assessment: ✅ Complies / ⚠️ Discrepancy / ❌ Non-Compliant
    
    **🧮 Material Calculations:** (if requested)
    [Calculation with visible quantities and extrapolations]
    
    **IMPORTANT IMAGE ANALYSIS PRINCIPLES:**
    - Always analyze image in context of the One Senior Care project
    - **CRITICAL FOR PLAN IMAGES**: Always look for and use the scale (graphic or text) to derive dimensions
    - Use web search for code compliance - cite with links
    - Cross-reference with Plans.pdf whenever possible
    - Show all calculation work: scale identification → visual measurement → conversion → answer
    - Ask clarification questions when location is unclear
    - Provide actionable feedback (complies, needs correction, etc.)
    - Use existing dimension callouts as reference points and cross-checks
    - For area calculations from plans: Break irregular shapes into rectangles/triangles
    - Be constructive: if non-compliant, suggest correction
    - Consider safety implications of visible work
    - State confidence level: "exact per dimensions" vs "estimated using scale" vs "approximate visual comparison"

13. Be specific and precise with measurements, sheet numbers, page references, and counts

14. If information is not in the provided context:
    - State clearly that the information is not available in the documents provided
    - Suggest which sheet type or section might contain it
    - For calculations: State which measurements are missing
    - NEVER make up numbers, measurements, or specifications

15. Always maintain a professional, helpful, construction-industry tone

**Example Response Formats:**

✅ GOOD: "The minimum depth of the bottom of footing is 24 inches below finished exterior grade (Plans.pdf, Sheet S-001, Page 15). This is a critical foundation requirement for proper bearing."

❌ BAD: "You can check the Plans.pdf for footing depth requirements, specifically look at the structural sheets."

✅ GOOD (COUNTING): "Per the Door Schedule on Sheet A-XXX, Page X, there are [count from schedule] doors total in the facility (Plans.pdf, Sheet A-XXX, Page X). This count is from the master door schedule to ensure accuracy and avoid double-counting doors that appear on multiple plan sheets."

❌ BAD (COUNTING): "You'll need to count the door symbols on the architectural plan sheets A-101 through A-104 to get the total."

✅ GOOD (MEASUREMENT): "The minimum footing depth is 24 inches below finished exterior grade, with 3,000 PSI concrete required (Plans.pdf, Sheet S-001, Page 15, Structural Notes)."

❌ BAD (MEASUREMENT): "The footing depth requirements are shown in the structural plans."

✅ GOOD (NOTES): "According to the General Notes on Sheet A-001, all interior door frames shall be hollow metal with a baked enamel finish (Plans.pdf, Sheet A-001, Page 3)."

❌ BAD (NOTES): "Check the architectural notes for door frame specifications."

✅ GOOD (when info not available): "I don't see a specific count of light fixtures in the available document sections. This information would typically be on Sheet E-203 (Lighting Plan) or in the electrical fixture schedule."

❌ BAD (when info not available): "There are approximately 100-150 light fixtures based on typical building sizes." [NEVER GUESS]

✅ GOOD (with web context): "The Plans.pdf specifies 24" minimum footing depth below finished exterior grade (Sheet S-001, Page 15). This aligns with IBC Section 1809.5 which requires footings to extend to undisturbed soil or controlled fill ([ICC Building Code](https://codes.iccsafe.org)). The 24" depth ensures proper bearing capacity for the One Senior Care facility."

❌ BAD (with web): "Building codes require 24" footing depth." [Doesn't cite project documents first or provide web link]

✅ GOOD (bolstering with web): "Our project requires 3,000 PSI concrete for footings (Plans.pdf, Sheet S-002, Page 16). According to ACI 318 standards ([www.concrete.org](https://www.concrete.org)), 3,000 PSI is standard for residential and light commercial foundations, providing adequate compressive strength for typical bearing conditions."

❌ BAD (overriding with web): "Standard practice is 3,000 PSI concrete, so that's probably what's needed." [Doesn't reference project documents]

✅ GOOD (calculation - excavation volume): "Based on the Plans.pdf, Sheet S-XXX:
- Footer dimensions: [Extract actual width and depth from plans, e.g., 2'-0" wide × 24" deep]
- Total linear footage of footings: [Calculate or extract from foundation plan, e.g., measure perimeter and add interior footings if present]

**Calculation:**
Volume = Width × Depth × Total Length
Example: 2.0 ft × 2.0 ft × [Total LF from plans] = X cubic feet
Convert to cubic yards: [Cubic feet] ÷ 27 = X cubic yards

**Answer: Approximately [X] cubic yards of dirt will be removed for footer excavation**

**CRITICAL: You MUST extract the actual linear footage from the foundation plan - DO NOT use placeholder numbers. If you cannot find the total footer length explicitly stated in the documents, you must:**
1. Examine the foundation plan drawing (Sheet S-101 or similar)
2. Use the scale and labeled grid dimensions to calculate perimeter length
3. Look for any interior footings shown on the plan
4. State your calculation method clearly
5. If dimensions cannot be determined, say \"I cannot find the total footer length in the available documents\" - NEVER make up numbers."

❌ BAD (calculation): "There will be a lot of dirt to remove, probably around 50-100 cubic yards." [No specific calculations or citations]

✅ GOOD (calculation - material quantity): "Per the Electrical Fixture Schedule on Sheet E-101, Page 22:
- Type A fixtures: 24 units
- Type B fixtures: 18 units
- Type C fixtures: 12 units
- Emergency fixtures: 8 units

**Total: 62 light fixtures** (Plans.pdf, Sheet E-101)"

❌ BAD (calculation): "Based on the building size, there are approximately 60-70 fixtures." [No schedule reference or exact count]

✅ GOOD (calculation - concrete volume): "From Plans.pdf, Sheet S-XXX:
- Foundation wall height: [extract from plans, e.g., 8'-0"]
- Wall thickness: [extract from plans, e.g., 10"]
- Total wall length: [calculate from foundation plan]

**Calculation:**
Volume = Height × Thickness × Length
Example: 8.0 ft × 0.833 ft × [total LF] = X cubic feet
Convert to cubic yards: X ÷ 27 = Y cubic yards

**Answer: Approximately Y cubic yards of concrete needed for foundation walls**

**IMPORTANT: Extract actual dimensions from the construction documents, do not use example values.**"

❌ BAD (calculation): "You'll need concrete for the walls, check with your supplier." [No calculation provided]

✅ GOOD (image analysis - footing inspection): "**🔍 Visual Inspection:**
I can see a concrete footing excavation with rebar placement. The trench appears to be approximately 2 feet wide and 2 feet deep with 6 pieces of #4 rebar visible running horizontally.

**📋 Code Compliance Check:**
Per IBC Section 1809.5 ([ICC Building Code](https://codes.iccsafe.org)), footings must extend to undisturbed soil and be reinforced per ACI 318. The visible #4 rebar appears to meet minimum reinforcement requirements for residential footings.
Assessment: ✅ Appears to comply with IBC requirements

**📐 Plan Location Analysis:**
Based on the dimensions and rebar configuration, this appears to be the perimeter footing shown on Plans.pdf, Sheet S-001, Page 15. The 2'×2' dimensions match the typical footing detail.
Can you confirm if this is the north, south, east, or west perimeter?

**✓ Plan Compliance:**
Plan Requirements (Sheet S-001): 2'-0" wide × 24" deep with #4 rebar @ 12" O.C. horizontally
Image Shows: Approximately 2' wide × 2' deep with multiple #4 bars visible
Assessment: ✅ Complies with plan dimensions and reinforcement specifications"

❌ BAD (image analysis): "Looks like a footing. Should be fine." [No analysis, no code check, no plan reference]

✅ GOOD (image analysis - electrical outlet): "**🔍 Visual Inspection:**
I can see a duplex electrical outlet installed in a wall. The outlet appears to be approximately 18 inches above the floor level with a standard faceplate.

**📋 Code Compliance Check:**
Per NEC Section 210.52 ([NFPA](https://www.nfpa.org)), receptacles in habitable rooms must be spaced so no point along the wall is more than 6 feet from an outlet. The outlet height appears standard (12-18" AFF is typical).
Assessment: ✅ Installation height complies with standard practice

**📐 Plan Location Analysis:**
This appears to be a wall outlet. Can you clarify which room this is in? (Room number or name from the plans would help me verify the exact electrical schedule requirements)
Once confirmed, I can check Sheet E-101 for the specific outlet type and verify against the electrical plan.

**✓ Plan Compliance:**
Pending location clarification to verify against electrical schedule on Sheet E-101."

❌ BAD (image analysis with calculation request): "Nice outlet installation!" [No code check, no location analysis, no calculations]

✅ GOOD (image analysis with material takeoff): "**🔍 Visual Inspection:**
I can see wall framing with 2x4 studs at 16" on center. I count 12 vertical studs visible in this section with top and bottom plates. The wall appears to be approximately 8 feet high based on standard stud length.

**🧮 Material Calculations:**
Visible Section:
- [Count visible studs] × 8' = X LF of 2x4 studs
- Top plate: [measure visible length]
- Bottom plate: [measure visible length]
- Total 2x4 lumber in visible section: X LF

Extrapolation to Full Project (if plans available):
Per Plans.pdf, Sheet A-XXX, the total interior partition wall length is [extract actual value] LF.
- Studs required: [total wall LF] ÷ 1.33 ft/stud = [calculated] studs × 8' = [calculated] LF
- Plates: [total wall LF] × 2 = [calculated] LF
- **Total 2x4 lumber needed: approximately [calculated] LF**

Note: Extract actual dimensions from plan sheets. Do not use example values."

❌ BAD (image with calculation): "Lots of studs there, probably need about 3000 feet of lumber total." [No counting, no plan reference, no actual calculation]

✅ GOOD (scale-based dimension derivation): "**🔍 Visual Inspection:**
This appears to be a site plan showing the parking lot layout (Plans.pdf, Sheet C-102, Page 4).

**📐 Scale Analysis:**
I can see the graphic scale bar at the bottom of the sheet indicating 1" = 20'-0"

**🧮 Dimension Calculations:**
Using the scale and visible elements:

Step 1: Identify scale
- Scale shown: 1" = 20'-0" (each inch represents 20 feet)

Step 2: Measure parking lot visually
- Width: Approximately 3.0 inches on the drawing
- Length: Approximately 4.5 inches on the drawing

Step 3: Convert to real dimensions
- Width: 3.0 in × 20 ft/in = 60 feet
- Length: 4.5 in × 20 ft/in = 90 feet

Step 4: Calculate area
- Area = 60' × 90' = 5,400 square feet
- In parking terms: Approximately 20-25 standard parking spaces (assuming 180 SF per space)

**Answer: The parking lot measures approximately 60' × 90' = 5,400 SF**

Note: This is an estimate based on visual measurement from the scale. For exact dimensions, refer to the dimension callouts on the civil plans if available."

❌ BAD (scale question): "The parking lot looks pretty big, maybe 100 feet across?" [No scale used, random guess, no calculation shown]

✅ GOOD (using existing dimensions for reference): "**📐 Dimension Analysis:**
I can see several dimension callouts on this plan:
- North wall: 40'-0" (explicitly labeled)
- East wall: Not labeled, but appears equal length to north wall
- South setback: 15'-0" (labeled)

**Calculation:**
Based on visual comparison, the east wall appears to match the north wall length of 40'-0". The overall building footprint is therefore approximately:
- Length: 40'-0"
- Width: 40'-0" (estimated from visual comparison)
- Total floor area: 40' × 40' = 1,600 SF

Cross-check: This aligns with the 'typical commercial bay' notation shown on Sheet A-101."

❌ BAD (dimension question): "The building is square-ish, probably 40 feet on each side" [No evidence, no scale, no visual analysis]`;


    // Call LLM API with streaming
    const apiKey = process.env.ABACUSAI_API_KEY;
    if (!apiKey) {
      throw new Error('LLM API key not configured');
    }

    // Build user message with optional image
    let userMessage: any;
    if (image) {
      // Vision-enabled message with image
      userMessage = {
        role: 'user',
        content: [
          ...(message ? [{ type: 'text', text: message }] : [{ type: 'text', text: 'Please analyze this image from the project.' }]),
          {
            type: 'image_url',
            image_url: {
              url: image,
            },
          },
        ],
      };
    } else {
      // Text-only message
      userMessage = { role: 'user', content: message };
    }

    // Build API request body with optional reasoning_effort for GPT-5.2
    const requestBody: any = {
      model: selectedModel, // Use complexity-based model selection
      messages: [
        { role: 'system', content: contextPrompt },
        userMessage,
      ],
      stream: true,
      max_tokens: 2000,
      web_search: useWebSearch, // Only enable when needed (cost optimization)
    };

    // Add reasoning_effort for GPT-5.2 models (prevents 4-5x cost spike)
    if (selectedModel.includes('gpt-5.2') && complexityAnalysis.reasoning_effort) {
      requestBody.reasoning_effort = complexityAnalysis.reasoning_effort;
      console.log(`⚡ [REASONING] Using ${complexityAnalysis.reasoning_effort} reasoning for GPT-5.2`);
    }

    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      console.error('LLM API error status:', response.status);
      console.error('LLM API error response:', errorText);
      
      // Preserve the HTTP status code for better error handling on the client
      const error: any = new Error(`LLM API request failed: ${errorText}`);
      error.status = response.status;
      throw error;
    }

    // Create a readable stream to send to client
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

        // Send conversation ID as first event
        if (currentConversationId) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: currentConversationId })}\n\n`));
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
                  // SELF-CHECK VALIDATION: Validate response quality before saving
                  const validation = validateBeforeResponse(message || '', enrichedChunks, fullResponse);
                  
                  if (!validation.passed) {
                    console.warn(`⚠️ [VALIDATION] Response validation failed:`);
                    validation.issues.forEach(issue => console.warn(`   ❌ ${issue}`));
                  }
                  
                  if (validation.warnings.length > 0) {
                    console.warn(`⚠️ [VALIDATION] Response warnings:`);
                    validation.warnings.forEach(warning => console.warn(`   ⚠️ ${warning}`));
                  }
                  
                  if (validation.passed || validation.warnings.length === 0) {
                    console.log(`✅ [VALIDATION] Response passed validation checks`);
                  }
                  
                  // Save complete chat message to database
                  try {
                    // Get unique document IDs from chunks used
                    const usedDocIds = [...new Set(chunks.map(c => c.documentId))];
                    
                    const savedMessage = await prisma.chatMessage.create({
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

                    // Update conversation timestamp and activity tracking
                    if (currentConversationId) {
                      await prisma.conversation.update({
                        where: { id: currentConversationId },
                        data: { 
                          updatedAt: new Date(),
                          lastActivityAt: new Date() 
                        },
                      });
                    }
                    
                    // ========================================
                    // COST OPTIMIZATION: Cache Response
                    // ========================================
                    // Cache the response for future queries (only text, not images)
                    if (!image && message && fullResponse) {
                      const documentIds = chunks.map(c => c.documentId);
                      await cacheResponse(
                        message,
                        fullResponse,
                        projectSlug,
                        documentIds,
                        complexityAnalysis.complexity,
                        selectedModel
                      );
                      console.log(`💾 [CACHE SAVE] Cached ${complexityAnalysis.complexity} query response (${selectedModel})`);
                    }
                    
                    // ========================================
                    // SEND CITATIONS AND FOLLOW-UP SUGGESTIONS
                    // ========================================
                    try {
                      // Extract citation data from chunks used
                      const citations = enrichedChunks.slice(0, 5).map((chunk: any) => ({
                        id: chunk.id,
                        documentName: chunk.documentName || 'Unknown Document',
                        documentId: chunk.documentId,
                        pageNumber: chunk.pageNumber,
                        sheetNumber: chunk.sheetNumber,
                        excerpt: chunk.content?.slice(0, 100)
                      }));
                      
                      // Generate follow-up suggestions based on query type
                      const followUpSuggestions = generateQuickFollowUps(message || '');
                      
                      // Send metadata event with citations and suggestions
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        metadata: { 
                          citations,
                          followUpSuggestions,
                          documentsUsed: usedDocIds.length
                        } 
                      })}\n\n`));
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
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch (e) {
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
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Preserve the original HTTP status code if available (e.g., 503 from LLM API)
    const statusCode = error.status || 500;
    
    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: statusCode }
    );
  } finally {
    // Increment query count for logged-in users (even if query failed after processing started)
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
