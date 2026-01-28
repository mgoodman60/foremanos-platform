# Codex - Phase 2 Integration Tests (You're Unblocked!)

## 🎉 Great News: Claude Code Has Completed Their Work!

**Claude Code has finished:**
- ✅ Step 2: Feature flags system
- ✅ Step 4: All 5 middleware modules (in `lib/chat/middleware/`)
- ✅ Step 6: All 4 processor modules (in `lib/chat/processors/`)
- ✅ Step 8: Main route refactored (using new modules)

**You are now UNBLOCKED and can complete your remaining tasks!**

---

## Your Current Status

**✅ Completed (4/6 tasks):**
- ✅ Step 1: Type definitions (`types/chat.ts`) - Complete
- ✅ Step 3: Utility functions (`lib/chat/utils/`) - Complete
- ✅ Step 5: Snapshot tests - Complete
- ✅ Step 11: Vitest setup - Complete

**⏸️ Ready to Complete (2/6 tasks):**
- ⏸️ Step 7: Middleware integration tests - **READY TO START**
- ⏸️ Step 9: Processor & full flow integration tests - **READY TO START**

---

## Step 7: Implement Middleware Integration Tests

**Priority:** High

**File to Update:** `__tests__/api/chat/integration/middleware.test.ts`

**Status:** Template exists with `it.todo()` tests - you need to implement them

**What Claude Code Created:**
All middleware modules are in `lib/chat/middleware/`:
- `maintenance-check.ts` - `checkMaintenance()`, `maintenanceResponse()`
- `auth-check.ts` - `checkAuth()`
- `rate-limit-check.ts` - `checkRateLimitMiddleware()`, `rateLimitResponse()`
- `query-validation.ts` - `validateQuery()`, `validationErrorResponse()`
- `query-limit-check.ts` - `checkQueryLimitMiddleware()`, `queryLimitResponse()`

**Your Task:**
Replace all `it.todo()` tests with actual implementations.

### 7.1 Test checkAuth

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { checkAuth } from '@/lib/chat/middleware/auth-check';

describe('checkAuth', () => {
  it('should extract auth info from request', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
    });
    
    const result = await checkAuth(request);
    
    expect(result).toHaveProperty('userId');
    expect(result).toHaveProperty('userRole');
    expect(result).toHaveProperty('clientIp');
    expect(result).toHaveProperty('rateLimitId');
    expect(result.userRole).toBeOneOf(['admin', 'client', 'guest', 'pending']);
  });
});
```

### 7.2 Test checkRateLimitMiddleware

```typescript
import { checkRateLimitMiddleware, rateLimitResponse } from '@/lib/chat/middleware/rate-limit-check';
import type { AuthCheckResult } from '@/types/chat';

describe('checkRateLimitMiddleware', () => {
  it('should apply rate limits and headers', async () => {
    const auth: AuthCheckResult = {
      session: null,
      userId: 'test-user',
      userRole: 'client',
      clientIp: '127.0.0.1',
      rateLimitId: 'test-user',
    };
    
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
    });
    
    const result = await checkRateLimitMiddleware(auth, request);
    
    expect(result).toHaveProperty('allowed');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('headers');
    
    if (!result.allowed) {
      expect(result).toHaveProperty('retryAfter');
      const response = rateLimitResponse(result);
      expect(response.status).toBe(429);
    }
  });
});
```

### 7.3 Test validateQuery

```typescript
import { validateQuery, validationErrorResponse } from '@/lib/chat/middleware/query-validation';

describe('validateQuery', () => {
  it('should accept valid text requests', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is the schedule?',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await validateQuery(request);
    
    expect(result.valid).toBe(true);
    expect(result.body?.message).toBe('What is the schedule?');
    expect(result.body?.projectSlug).toBe('test-project');
  });
  
  it('should reject missing message/image', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await validateQuery(request);
    
    expect(result.valid).toBe(false);
    expect(result.error?.message).toContain('Message or image is required');
    expect(result.error?.status).toBe(400);
    
    const response = validationErrorResponse(result);
    expect(response.status).toBe(400);
  });
  
  it('should reject missing projectSlug', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is the schedule?',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await validateQuery(request);
    
    expect(result.valid).toBe(false);
    expect(result.error?.message).toContain('Project context is required');
    expect(result.error?.status).toBe(400);
  });
});
```

### 7.4 Test checkQueryLimitMiddleware

```typescript
import { checkQueryLimitMiddleware, queryLimitResponse } from '@/lib/chat/middleware/query-limit-check';
import type { AuthCheckResult } from '@/types/chat';

describe('checkQueryLimitMiddleware', () => {
  it('should block when query limit exceeded', async () => {
    const auth: AuthCheckResult = {
      session: null,
      userId: 'test-user-exceeded',
      userRole: 'client',
      clientIp: '127.0.0.1',
      rateLimitId: 'test-user-exceeded',
    };
    
    // Mock subscription service to return exceeded limit
    // Then test the middleware
    
    const result = await checkQueryLimitMiddleware(auth);
    
    if (!result.allowed) {
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('tier');
      expect(result).toHaveProperty('message');
      expect(result.remaining).toBe(0);
      
      const response = queryLimitResponse(result);
      expect(response.status).toBe(429);
    }
  });
});
```

### 7.5 Test checkMaintenance

```typescript
import { checkMaintenance, maintenanceResponse } from '@/lib/chat/middleware/maintenance-check';

describe('checkMaintenance', () => {
  it('should short-circuit when maintenance is active', async () => {
    // Mock prisma.maintenanceMode to return active maintenance
    // Then test the middleware
    
    const result = await checkMaintenance();
    
    if (result.isActive) {
      expect(result).toHaveProperty('message');
      const response = maintenanceResponse();
      expect(response.status).toBe(503);
    }
  });
});
```

**After completing all middleware tests:**
1. ✅ Run tests: `npm run test:integration` or `npm run test`
2. ✅ Verify all tests pass
3. ✅ Commit with: `[CODEX] Phase 2: Add middleware integration tests`

---

## Step 9: Implement Processor & Full Flow Integration Tests

**Priority:** High

**Files to Update:**
1. `__tests__/api/chat/integration/processors.test.ts`
2. `__tests__/api/chat/integration/full-flow.test.ts`

**Status:** Templates exist with `it.todo()` tests - you need to implement them

**What Claude Code Created:**
All processor modules are in `lib/chat/processors/`:
- `conversation-manager.ts` - `manageConversation()`, `lockedReportResponse()`
- `context-builder.ts` - `buildContext()`
- `llm-handler.ts` - `handleLLMRequest()`, `checkCache()`, `saveCachedResponse()`, etc.
- `response-streamer.ts` - `streamResponse()`, `createErrorResponse()`, `createCachedResponse()`

**Main route is refactored:** `app/api/chat/route.ts` now uses all these modules

### 9.1 Test Processors

**File:** `__tests__/api/chat/integration/processors.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildContext } from '@/lib/chat/processors/context-builder';
import { manageConversation } from '@/lib/chat/processors/conversation-manager';
import { handleLLMRequest } from '@/lib/chat/processors/llm-handler';
import { streamResponse } from '@/lib/chat/processors/response-streamer';
import type { ContextBuilderOptions, LLMHandlerOptions, StreamResponseOptions } from '@/types/chat';

describe('Chat API Processors Integration', () => {
  describe('buildContext', () => {
    it('should build context for text queries', async () => {
      const options: ContextBuilderOptions = {
        message: 'What is the schedule?',
        image: null,
        projectSlug: 'test-project',
        userRole: 'admin',
      };
      
      const context = await buildContext(options);
      
      expect(context).toHaveProperty('chunks');
      expect(context).toHaveProperty('contextPrompt');
      expect(context).toHaveProperty('documentNames');
      expect(context).toHaveProperty('retrievalLog');
      expect(Array.isArray(context.chunks)).toBe(true);
      expect(typeof context.contextPrompt).toBe('string');
    });
    
    it('should handle image-only queries', async () => {
      const options: ContextBuilderOptions = {
        message: null,
        image: 'base64-encoded-image-data',
        projectSlug: 'test-project',
        userRole: 'admin',
      };
      
      const context = await buildContext(options);
      
      expect(context).toHaveProperty('chunks');
      expect(context).toHaveProperty('contextPrompt');
      // Image queries may have different structure
    });
  });
  
  describe('manageConversation', () => {
    it('should create conversation when missing', async () => {
      const result = await manageConversation({
        userId: 'test-user',
        conversationId: null,
        projectSlug: 'test-project',
        message: 'Hello',
        userRole: 'client',
      });
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('projectId');
      expect(result).toHaveProperty('created');
      // If conversation was created, id should not be null
    });
    
    it('should reuse existing conversation', async () => {
      const existingConversationId = 'existing-conv-id';
      
      const result = await manageConversation({
        userId: 'test-user',
        conversationId: existingConversationId,
        projectSlug: 'test-project',
        message: 'Follow up',
        userRole: 'client',
      });
      
      expect(result.id).toBe(existingConversationId);
      expect(result.created).toBe(false); // Not newly created
    });
  });
  
  describe('handleLLMRequest', () => {
    it('should return streaming response metadata', async () => {
      // This is complex - you'll need to mock the LLM API calls
      // Focus on verifying the response structure
      
      const options: LLMHandlerOptions = {
        message: 'What is the schedule?',
        image: null,
        context: {
          chunks: [],
          documentNames: [],
          contextPrompt: 'Test context',
          retrievalLog: [],
        },
        conversationId: 'test-conv',
        projectSlug: 'test-project',
        userRole: 'admin',
      };
      
      // Mock LLM responses
      const response = await handleLLMRequest(options);
      
      expect(response).toHaveProperty('stream');
      expect(response).toHaveProperty('model');
      expect(response.stream).toBeInstanceOf(ReadableStream);
    });
  });
  
  describe('streamResponse', () => {
    it('should format SSE responses and metadata', async () => {
      // This is complex - you'll need to create a mock LLMResponse
      // Focus on verifying the response structure and headers
      
      const options: StreamResponseOptions = {
        llmResponse: {
          stream: new ReadableStream(),
          model: 'gpt-4',
        },
        conversation: {
          id: 'test-conv',
          projectId: 'test-project',
          created: false,
        },
        context: {
          chunks: [],
          documentNames: [],
          contextPrompt: 'Test',
          retrievalLog: [],
        },
        message: 'Test message',
        userId: 'test-user',
        userRole: 'admin',
      };
      
      const response = streamResponse(options);
      
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });
  });
});
```

### 9.2 Test Full Request Flow

**File:** `__tests__/api/chat/integration/full-flow.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { NextRequest } from 'next/server';

describe('Chat API Full Request Flow', () => {
  beforeEach(() => {
    // Set up mocks for all dependencies
    // Use your existing mocks from __tests__/api/chat/snapshots/mocks.ts
  });
  
  it('should handle complete request flow for a text query', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'What is the project schedule?',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    
    // Verify streaming works
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
  });
  
  it('should handle complete request flow for an image query', async () => {
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        image: 'base64-encoded-image',
        imageName: 'test.png',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const response = await POST(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
  
  it('should surface rate limit errors with headers', async () => {
    // Create multiple rapid requests to trigger rate limit
    // Or mock the rate limiter to return exceeded
    
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Mock rate limit exceeded
    const response = await POST(request);
    
    if (response.status === 429) {
      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('Retry-After')).toBeDefined();
    }
  });
  
  it('should surface query limit errors with tier metadata', async () => {
    // Mock user with exceeded query limit
    
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test',
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Mock query limit exceeded
    const response = await POST(request);
    
    if (response.status === 429) {
      const data = await response.json();
      expect(data).toHaveProperty('tier');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('remaining');
    }
  });
  
  it('should enforce restricted query responses for guests', async () => {
    // Mock guest user session
    // Use a restricted query (e.g., "What's the budget?")
    
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: "What's the budget?",
        projectSlug: 'test-project',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const response = await POST(request);
    
    // Should return access denied message
    const data = await response.json();
    expect(data).toHaveProperty('error');
    expect(data.error).toContain('access');
  });
});
```

**After completing all processor and full flow tests:**
1. ✅ Run tests: `npm run test:integration` or `npm run test`
2. ✅ Verify all tests pass
3. ✅ Commit with: `[CODEX] Phase 2: Add processor and full flow integration tests`

---

## Reference Files

**Read these to understand the modules:**
1. `lib/chat/middleware/` - All middleware modules (created by Claude Code)
2. `lib/chat/processors/` - All processor modules (created by Claude Code)
3. `app/api/chat/route.ts` - Refactored route using new modules
4. `types/chat.ts` - Type definitions (your work - use these!)
5. `__tests__/api/chat/snapshots/mocks.ts` - Existing mocks you can reuse

---

## Testing Tips

1. **Use Existing Mocks:** Your `mocks.ts` file already has comprehensive mocks. Import and use them.

2. **Test Structure:** Follow the pattern from your snapshot tests - they're well-structured.

3. **Mock Strategy:**
   - Mock external services (LLM APIs, database)
   - Mock rate limiter responses
   - Mock subscription checks
   - Use real middleware/processor functions (they're already extracted)

4. **Focus Areas:**
   - **Middleware tests:** Verify input validation, error handling, response formatting
   - **Processor tests:** Verify data transformation, context building, streaming
   - **Full flow tests:** Verify end-to-end request handling, error propagation

5. **Edge Cases:**
   - Missing data
   - Invalid inputs
   - Rate limit exceeded
   - Query limit exceeded
   - Maintenance mode
   - Restricted queries

---

## Commit Convention

All commits must use this format:
```
[CODEX] Phase 2: <description>
```

Examples:
- `[CODEX] Phase 2: Add middleware integration tests`
- `[CODEX] Phase 2: Add processor and full flow integration tests`

---

## After Completing

**You will have completed:**
- ✅ Step 1: Type definitions
- ✅ Step 3: Utility functions
- ✅ Step 5: Snapshot tests
- ✅ Step 7: Middleware integration tests
- ✅ Step 9: Processor & full flow integration tests
- ✅ Step 11: Vitest setup

**Phase 2 Development Tasks: 100% Complete!**

Then Cursor will handle:
- Step 12: Code review
- Step 13: Staging deployment
- Step 14: Gradual rollout
- Step 15: Browser testing

---

## Questions?

If you're stuck:
- Check `CODEX_PHASE2_TASKS.md` for detailed instructions
- Read the middleware/processor source code to understand what they do
- Use your existing mocks from `mocks.ts`
- Test one module at a time
- Ask for clarification if something is unclear

**Remember:** Focus on comprehensive test coverage. These integration tests are critical for ensuring the refactored code works correctly.

**You're ready to go! Start with Step 7 (Middleware tests), then move to Step 9 (Processor & Full Flow tests).**
