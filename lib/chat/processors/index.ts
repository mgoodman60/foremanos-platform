/**
 * Chat API Processor Modules
 *
 * These modules are extracted from app/api/chat/route.ts for better
 * organization and testability.
 */

export {
  manageConversation,
  lockedReportResponse,
  type ConversationManagerOptions,
} from './conversation-manager';

export { buildContext } from './context-builder';

export {
  handleLLMRequest,
  checkCache,
  saveCachedResponse,
  createCachedLLMResponse,
  saveCachedChatMessage,
} from './llm-handler';

export {
  streamResponse,
  createErrorResponse,
  createCachedResponse,
} from './response-streamer';
