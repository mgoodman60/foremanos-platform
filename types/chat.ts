/**
 * Type definitions for the refactored Chat API modules.
 */

import type { Session } from 'next-auth';
import type { EnhancedChunk } from '@/lib/rag-enhancements';

/**
 * Result of maintenance mode check.
 *
 * @interface MaintenanceCheckResult
 */
export interface MaintenanceCheckResult {
  /** Whether maintenance mode is currently active. */
  isActive: boolean;
  /** Optional maintenance message. */
  message?: string;
}

/**
 * Result of authentication check.
 *
 * @interface AuthCheckResult
 */
export interface AuthCheckResult {
  /** NextAuth session object. */
  session: Session | null;
  /** User ID from session, or null for guests. */
  userId: string | null;
  /** User role: admin, client, guest, or pending. */
  userRole: 'admin' | 'client' | 'guest' | 'pending';
  /** Client IP address. */
  clientIp: string;
  /** Rate limit identifier (user ID or IP). */
  rateLimitId: string;
}

/**
 * Result of rate limit check.
 *
 * @interface RateLimitCheckResult
 */
export interface RateLimitCheckResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Number of requests remaining in the window. */
  remaining: number;
  /** Total rate limit for the window. */
  limit: number;
  /** Seconds to wait before retrying (if rate limited). */
  retryAfter?: number;
  /** HTTP headers to include in response. */
  headers: HeadersInit;
}

/**
 * Result of query validation.
 *
 * @interface QueryValidationResult
 */
export interface QueryValidationResult {
  /** Whether the query is valid. */
  valid: boolean;
  /** Parsed and validated request body. */
  body?: {
    /** User's message text. */
    message?: string;
    /** Base64-encoded image. */
    image?: string;
    /** Original image filename. */
    imageName?: string;
    /** Existing conversation ID. */
    conversationId?: string;
    /** Project slug (required). */
    projectSlug: string;
  };
  /** Validation error details. */
  error?: {
    /** Error message. */
    message: string;
    /** HTTP status code. */
    status: number;
  };
}

/**
 * Result of query limit check (subscription limits).
 *
 * @interface QueryLimitCheckResult
 */
export interface QueryLimitCheckResult {
  /** Whether the user has remaining queries. */
  allowed: boolean;
  /** Monthly query limit for user's tier. */
  limit: number;
  /** Number of queries remaining this month. */
  remaining: number;
  /** User's subscription tier. */
  tier: string;
  /** Optional error message. */
  message?: string;
}

/**
 * Result of conversation management.
 *
 * @interface ConversationResult
 */
export interface ConversationResult {
  /** Conversation ID (null if not created). */
  id: string | null;
  /** Project ID associated with conversation. */
  projectId: string | null;
  /** Whether a new conversation was created. */
  created: boolean;
}

/**
 * Options for building context from RAG retrieval.
 *
 * @interface ContextBuilderOptions
 */
export interface ContextBuilderOptions {
  /** User's message text. */
  message: string | null;
  /** Base64-encoded image. */
  image: string | null;
  /** Project slug. */
  projectSlug: string;
  /** User role for access control. */
  userRole: string;
  /** Maximum number of chunks to retrieve. */
  retrievalLimit?: number;
}

/**
 * Web search result returned by external search provider.
 *
 * @interface WebSearchResult
 */
export interface WebSearchResult {
  /** Search result title. */
  title: string;
  /** Search result URL. */
  url: string;
  /** Short snippet for the result. */
  snippet: string;
}

/**
 * Built context from RAG retrieval and enhancements.
 *
 * @interface BuiltContext
 */
export interface BuiltContext {
  /** Retrieved document chunks. */
  chunks: EnhancedChunk[];
  /** Names of documents used. */
  documentNames: string[];
  /** Formatted context prompt for LLM. */
  contextPrompt: string;
  /** Log of retrieval steps. */
  retrievalLog: string[];
  /** Web search results (if applicable). */
  webSearchResults?: WebSearchResult[];
  /** Cache key for this query. */
  cacheKey?: string;
}

/**
 * Options for LLM request handling.
 *
 * @interface LLMHandlerOptions
 */
export interface LLMHandlerOptions {
  /** User's message text. */
  message: string | null;
  /** Base64-encoded image. */
  image: string | null;
  /** Built context from RAG. */
  context: BuiltContext;
  /** Conversation ID. */
  conversationId: string | null;
  /** Project slug. */
  projectSlug: string;
  /** User role. */
  userRole: string;
}

/**
 * LLM response with streaming support.
 *
 * @interface LLMResponse
 */
export interface LLMResponse {
  /** Readable stream of LLM response. */
  stream: ReadableStream;
  /** Model used (e.g., 'gpt-4', 'claude-3.5-sonnet'). */
  model: string;
  /** Number of tokens used (if available). */
  tokensUsed?: number;
  /** Whether response was served from cache. */
  cached?: boolean;
}

/**
 * Options for streaming response.
 *
 * @interface StreamResponseOptions
 */
export interface StreamResponseOptions {
  /** LLM response to stream. */
  llmResponse: LLMResponse;
  /** Conversation details. */
  conversation: ConversationResult;
  /** Built context. */
  context: BuiltContext;
  /** Original user message. */
  message: string | null;
  /** User ID. */
  userId: string | null;
  /** User role. */
  userRole: string;
}

/**
 * Query classification result.
 *
 * @interface QueryClassification
 */
export interface QueryClassification {
  /** Type of query: counting, measurement, calculation, or general. */
  type: 'counting' | 'measurement' | 'calculation' | 'general';
  /** Recommended retrieval limit based on query type. */
  retrievalLimit: number;
  /** Whether this is a counting query. */
  isCounting: boolean;
  /** Whether this is a measurement query. */
  isMeasurement: boolean;
  /** Whether this is a calculation query. */
  isCalculation: boolean;
}

/**
 * Result of restricted query check.
 *
 * @interface RestrictedQueryResult
 */
export interface RestrictedQueryResult {
  /** Whether the query is restricted for this user role. */
  isRestricted: boolean;
  /** Denial message (if restricted). */
  denialMessage?: string;
}
