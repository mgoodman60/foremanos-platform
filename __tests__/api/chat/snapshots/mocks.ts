import { vi } from 'vitest';

process.env.OPENAI_API_KEY = 'test-key';

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    maintenanceMode: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue({ id: 'project-1' }),
    },
    conversation: {
      create: vi.fn().mockResolvedValue({ id: 'conversation-1' }),
      update: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ projectId: 'project-1' }),
    },
    chatMessage: {
      create: vi.fn().mockResolvedValue({ id: 'chat-1' }),
    },
    document: {
      findMany: vi.fn().mockResolvedValue([
        { name: 'Plans.pdf', accessLevel: 'guest' },
      ]),
    },
  },
}));

vi.mock('@/lib/access-control', () => ({
  isRestrictedQuery: vi.fn().mockReturnValue(false),
  getAccessDenialMessage: vi.fn().mockReturnValue('Access denied (mock).'),
  getAccessibleDocuments: vi.fn().mockReturnValue(['Plans.pdf']),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    success: true,
    remaining: 99,
    limit: 100,
    reset: Date.now() + 60000,
    retryAfter: 0,
  }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('rate-limit-id'),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  createRateLimitHeaders: vi.fn().mockReturnValue({}),
  RATE_LIMITS: {
    CHAT: { points: 100, duration: 60 },
  },
}));

vi.mock('@/lib/subscription', () => ({
  checkQueryLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 1000,
    remaining: 999,
    tier: 'pro',
  }),
  incrementQueryCount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rag', () => ({
  retrieveRelevantDocuments: vi.fn().mockResolvedValue([]),
  generateContextPrompt: vi.fn().mockReturnValue('Context prompt'),
  retrieveRelevantCorrections: vi.fn().mockResolvedValue([]),
  generateContextWithCorrections: vi.fn().mockResolvedValue('Corrected context'),
  generateContextWithPhase3: vi.fn().mockResolvedValue('Phase 3 context'),
  enrichWithPhaseAMetadata: vi.fn().mockImplementation(async (chunks) => chunks),
}));

vi.mock('@/lib/rag-enhancements', () => {
  const defaultChunk = {
    id: 'chunk-1',
    content: 'Mock content',
    documentId: 'doc-1',
    regulatoryDocumentId: null,
    pageNumber: 1,
    metadata: { documentName: 'Plans.pdf' },
    isRegulatory: false,
    documentName: 'Plans.pdf',
    sheetNumber: 'A1',
  };

  return {
    twoPassRetrieval: vi.fn().mockResolvedValue({
      chunks: [defaultChunk],
      retrievalLog: [],
    }),
    bundleCrossReferences: vi.fn().mockResolvedValue({
      enrichedChunks: [defaultChunk],
      crossRefLog: [],
    }),
    generateEnhancedContext: vi.fn().mockReturnValue('Enhanced context'),
    validateBeforeResponse: vi.fn().mockReturnValue({
      passed: true,
      issues: [],
      warnings: [],
    }),
    classifyQueryIntent: vi.fn().mockReturnValue({ type: 'general' }),
    detectMultipleScales: vi.fn().mockReturnValue({
      additionalScales: [],
      scaleWarnings: [],
    }),
    detectScaleBar: vi.fn().mockReturnValue({ detected: false }),
    expandAbbreviations: vi.fn().mockImplementation((content) => content),
    extractGridReferences: vi.fn().mockReturnValue([]),
    generateSpatialContext: vi.fn().mockReturnValue(''),
    CONSTRUCTION_ABBREVIATIONS: {},
    reconstructSystemTopology: vi.fn().mockResolvedValue({
      nodes: [],
      connections: [],
      flow: [],
      warnings: [],
    }),
    interpretIsometricView: vi.fn().mockReturnValue({
      elements: [],
      discipline: 'general',
      spatialHierarchy: [],
    }),
    detectAdvancedConflicts: vi.fn().mockResolvedValue([]),
    learnProjectSymbols: vi.fn().mockResolvedValue({
      symbols: [],
      totalAppearances: 0,
    }),
    applyLearnedSymbols: vi.fn().mockImplementation((chunk) => chunk),
  };
});

vi.mock('@/lib/web-search', () => ({
  shouldUseWebSearch: vi.fn().mockReturnValue(false),
  performWebSearch: vi.fn().mockResolvedValue({ hasResults: false, results: [] }),
  formatWebResultsForContext: vi.fn().mockReturnValue(''),
}));

vi.mock('@/lib/follow-up-generator', () => ({
  getQuickFollowUps: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/query-cache', () => ({
  getCachedResponse: vi.fn().mockImplementation(async (message: string) => {
    return message ? `Cached response for: ${message}` : null;
  }),
  cacheResponse: vi.fn().mockResolvedValue(undefined),
  analyzeQueryComplexity: vi.fn().mockReturnValue({
    complexity: 'simple',
    reason: 'mocked',
    model: 'gpt-4o-mini',
  }),
}));

vi.mock('@/lib/report-change-log', () => ({
  logReportChange: vi.fn().mockResolvedValue(undefined),
  isReportLocked: vi.fn().mockResolvedValue(false),
  canModifyLockedReport: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/report-finalization', () => ({
  updateLastActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/onboarding-tracker', () => ({
  markFirstChatStarted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/llm-providers', () => {
  const encoder = new TextEncoder();
  const mockStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Mock LLM response"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return {
    streamLLM: vi.fn().mockResolvedValue(mockStream),
    callLLM: vi.fn().mockResolvedValue({
      content: 'Mock LLM response',
      model: 'gpt-4o-mini',
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
    }),
    callOpenAI: vi.fn().mockResolvedValue({ content: 'Mock', model: 'gpt-4o-mini' }),
    callAnthropic: vi.fn().mockResolvedValue({ content: 'Mock', model: 'claude-sonnet-4-5-20251101' }),
  };
});
