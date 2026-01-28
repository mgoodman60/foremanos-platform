# Claude Code - Phase 2 Updated Prompt

## Current Status

**Codex has completed all unblocked work:**
- ✅ Step 1: Type definitions (`types/chat.ts`) - **READY FOR YOU TO USE**
- ✅ Step 3: Utility functions (`lib/chat/utils/`) - **READY FOR YOU TO USE**
- ✅ Step 5: Snapshot tests - Complete
- ✅ Step 11: Vitest setup - Complete

**Codex is BLOCKED waiting for:**
- ⏸️ Step 7: Middleware integration tests (waiting for YOUR Step 4)
- ⏸️ Step 9: Processor integration tests (waiting for YOUR Steps 6 & 8)

**Your current status:**
- ❌ Step 2: Feature flags - **NOT DONE** (no file exists)
- ❌ Step 4: Middleware modules - **NOT DONE** (no files exist) - **CRITICAL BLOCKER**
- ❌ Step 6: Processor modules - **NOT DONE**
- ❌ Step 8: Main route refactoring - **NOT DONE**

---

## 🚨 CRITICAL: You Must Complete Step 4 First

**Step 4 (Middleware Modules) is blocking Codex from completing their integration tests.**

Codex has already created:
- ✅ `types/chat.ts` with all the interfaces you need
- ✅ `lib/chat/utils/query-classifier.ts`
- ✅ `lib/chat/utils/restricted-query-check.ts`

**You MUST use these types and utilities - do NOT create your own.**

---

## Your Tasks (In Order)

### Step 2: Create Feature Flag System ⚠️ DO THIS FIRST

**Priority:** CRITICAL - Must be done before any refactoring

**Create:** `lib/chat/feature-flags.ts`

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 1

**What to create:**
```typescript
/**
 * Feature flags for gradual rollout of refactored chat API
 */
export const CHAT_REFACTOR_FLAGS = {
  USE_NEW_MIDDLEWARE: process.env.USE_NEW_CHAT_MIDDLEWARE === 'true',
  USE_NEW_PROCESSORS: process.env.USE_NEW_CHAT_PROCESSORS === 'true',
  USE_NEW_ROUTE: process.env.USE_NEW_CHAT_ROUTE === 'true',
  PARALLEL_EXECUTION: process.env.CHAT_PARALLEL_EXECUTION === 'true',
  PERCENTAGE_ROLLOUT: parseInt(process.env.CHAT_ROLLOUT_PERCENTAGE || '0'),
} as const;

export function shouldUseNewRoute(userId?: string | null): boolean {
  // Implementation from CLAUDE_CODE_PHASE2_TASKS.md
}
```

**Commit:** `[CLAUDE CODE] Phase 2: Add feature flag system for gradual rollout`

---

### Step 4: Extract Middleware Modules 🚨 CRITICAL - DO THIS NEXT

**Priority:** CRITICAL - This is blocking Codex

**Status:** ❌ NOT DONE - You must complete this immediately

**Create Directory:** `lib/chat/middleware/`

**Extract 5 modules from:** `app/api/chat/route.ts`

**IMPORTANT:** Use types from `types/chat.ts` (created by Codex). Do NOT define your own types.

#### 4.1 Maintenance Check

**Create:** `lib/chat/middleware/maintenance-check.ts`

**Extract from:** `app/api/chat/route.ts` lines 61-71

**Use this type from Codex:**
```typescript
import type { MaintenanceCheckResult } from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 2, Section 2.1

---

#### 4.2 Auth Check

**Create:** `lib/chat/middleware/auth-check.ts`

**Extract from:** `app/api/chat/route.ts` lines 77-102

**Use this type from Codex:**
```typescript
import type { AuthCheckResult } from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 2, Section 2.2

---

#### 4.3 Rate Limit Check

**Create:** `lib/chat/middleware/rate-limit-check.ts`

**Extract from:** `app/api/chat/route.ts` lines 73-99

**Use this type from Codex:**
```typescript
import type { RateLimitCheckResult } from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 2, Section 2.3

---

#### 4.4 Query Validation

**Create:** `lib/chat/middleware/query-validation.ts`

**Extract from:** `app/api/chat/route.ts` lines 104-120

**Use this type from Codex:**
```typescript
import type { QueryValidationResult } from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 2, Section 2.4

---

#### 4.5 Query Limit Check

**Create:** `lib/chat/middleware/query-limit-check.ts`

**Extract from:** `app/api/chat/route.ts` lines 122-138

**Use this type from Codex:**
```typescript
import type { QueryLimitCheckResult } from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 2, Section 2.5

---

**After completing all 5 middleware modules:**

1. ✅ Test each module in isolation
2. ✅ Verify TypeScript compiles without errors
3. ✅ Verify you're using types from `types/chat.ts` (not defining your own)
4. ✅ Commit with: `[CLAUDE CODE] Phase 2: Extract chat middleware modules`

**This unblocks Codex to complete Step 7 (Middleware integration tests).**

---

### Step 6: Extract Processor Modules

**Priority:** High

**Status:** ⏸️ Waiting for Step 4 to complete

**Create Directory:** `lib/chat/processors/`

**Extract 4 modules from:** `app/api/chat/route.ts`

**IMPORTANT:** Use types from `types/chat.ts` (created by Codex).

#### 6.1 Conversation Manager

**Create:** `lib/chat/processors/conversation-manager.ts`

**Extract from:** `app/api/chat/route.ts` lines 140-206

**Use this type from Codex:**
```typescript
import type { ConversationResult } from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 3, Section 3.1

---

#### 6.2 Context Builder (MOST COMPLEX)

**Create:** `lib/chat/processors/context-builder.ts`

**Extract from:** `app/api/chat/route.ts` lines 227-494

**This is ~250 lines - extract EXACTLY as it exists.**

**Use these types from Codex:**
```typescript
import type { 
  ContextBuilderOptions,
  BuiltContext,
  WebSearchResult 
} from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 3, Section 3.2

---

#### 6.3 LLM Handler

**Create:** `lib/chat/processors/llm-handler.ts`

**Extract from:** `app/api/chat/route.ts` lines 495-900+

**Use these types from Codex:**
```typescript
import type { 
  LLMHandlerOptions,
  LLMResponse 
} from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 3, Section 3.3

---

#### 6.4 Response Streamer

**Create:** `lib/chat/processors/response-streamer.ts`

**Extract from:** `app/api/chat/route.ts` lines 900-1200+

**Use this type from Codex:**
```typescript
import type { StreamResponseOptions } from '@/types/chat';
```

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 3, Section 3.4

---

**After completing all 4 processor modules:**

1. ✅ Test each module in isolation
2. ✅ Verify TypeScript compiles without errors
3. ✅ Verify you're using types from `types/chat.ts`
4. ✅ Commit with: `[CLAUDE CODE] Phase 2: Extract chat processor modules`

---

### Step 8: Refactor Main Route

**Priority:** Critical

**Status:** ⏸️ Waiting for Steps 4 & 6 to complete

**Modify:** `app/api/chat/route.ts`

**Target:** Reduce from 1,310 lines to ~300 lines

**What to do:**
1. Import all extracted middleware and processors
2. Use feature flags for gradual rollout
3. Keep old route handler as fallback
4. Use types from `types/chat.ts`

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 4

**Commit:** `[CLAUDE CODE] Phase 2: Refactor chat route to use middleware and processors`

**This unblocks Codex to complete Step 9 (Processor & full flow integration tests).**

---

### Step 10: Parallel Execution Handler (Optional)

**Priority:** Medium (recommended for safety)

**Status:** ⏸️ Waiting for Step 8 to complete

**Create:** `lib/chat/parallel-execution.ts`

**Purpose:** Run old and new code simultaneously, compare results

**Reference:** `CLAUDE_CODE_PHASE2_TASKS.md` - Task 5

**Commit:** `[CLAUDE CODE] Phase 2: Add parallel execution handler for safety validation`

---

### Step 16: Remove Old Code (After 7 Days)

**Priority:** Low (after stability period)

**Status:** ⏸️ Waiting for 7 days of stable operation at 100% rollout

**What to do:**
- Remove old route handler from `app/api/chat/route.ts`
- Clean up any unused code

**Commit:** `[CLAUDE CODE] Phase 2: Remove old code path after stable operation`

---

## Critical Rules

### DO:
- ✅ Extract code EXACTLY as it exists (no logic changes)
- ✅ Use types from `types/chat.ts` (created by Codex)
- ✅ Use utilities from `lib/chat/utils/` (created by Codex)
- ✅ Test each module after extraction
- ✅ Commit after each major extraction
- ✅ Maintain 100% backward compatibility

### DON'T:
- ❌ Change any business logic
- ❌ Define your own types (use `types/chat.ts`)
- ❌ Modify request/response formats
- ❌ Remove any error handling
- ❌ Skip testing

---

## Reference Files

**Read these first:**
1. `CLAUDE_CODE_PHASE2_TASKS.md` - Your detailed task instructions
2. `types/chat.ts` - Type definitions (created by Codex) - **USE THESE TYPES**
3. `lib/chat/utils/` - Utility functions (created by Codex) - **USE THESE UTILITIES**
4. `app/api/chat/route.ts` - Current implementation (1,310 lines to refactor)
5. `CODEX_PHASE2_STATUS.md` - See what Codex has completed

---

## Execution Order

1. **Step 2:** Feature flags (if not done)
2. **Step 4:** Middleware modules - **CRITICAL - DO THIS FIRST**
3. **Step 6:** Processor modules
4. **Step 8:** Main route refactoring
5. **Step 10:** Parallel execution (optional)
6. **Step 16:** Remove old code (after 7 days)

---

## Current Blocker Status

**You are blocking Codex on:**
- ⏸️ Step 7: Middleware integration tests (waiting for YOUR Step 4)
- ⏸️ Step 9: Processor integration tests (waiting for YOUR Steps 6 & 8)

**Codex has completed:**
- ✅ All type definitions you need
- ✅ All utility functions you need
- ✅ Test framework setup
- ✅ Snapshot tests

**You have everything you need to proceed. Start with Step 2, then Step 4.**

---

## Commit Convention

All commits must use this format:
```
[CLAUDE CODE] Phase 2: <description>
```

Examples:
- `[CLAUDE CODE] Phase 2: Add feature flag system for gradual rollout`
- `[CLAUDE CODE] Phase 2: Extract chat middleware modules`
- `[CLAUDE CODE] Phase 2: Extract chat processor modules`
- `[CLAUDE CODE] Phase 2: Refactor chat route to use middleware and processors`

---

## Questions?

If you're stuck:
- Check `CLAUDE_CODE_PHASE2_TASKS.md` for detailed instructions
- Read `types/chat.ts` to see available types
- Read `lib/chat/utils/` to see available utilities
- Read the original `app/api/chat/route.ts` to understand the logic
- Test each extraction in isolation before moving to the next

**Remember:** Extract EXACTLY as it exists. No logic changes. Use Codex's types and utilities.
