# Phase 2: Per-Step Prompts - Execute One at a Time

## How to Use

1. **Execute prompts in order** - Each step has its own prompt
2. **Wait for completion** - Don't run the next prompt until the current step is done
3. **Check trigger conditions** - Some steps can only run after others complete
4. **Verify deliverables** - Check that each step's deliverables are met before proceeding

---

## Step 1: Codex - Type Definitions (CRITICAL FIRST STEP)

**Status:** ⚠️ BLOCKS Claude Code - Must complete before Step 2

**When to Run:** Start of Phase 2

**Prompt for Codex:**
```
I need you to complete Step 1 of Phase 2: Chat API Refactoring.

TASK: Create types/chat.ts with comprehensive type definitions

This is CRITICAL - Claude Code cannot proceed without these types.

What to do:
1. Read CODEX_PHASE2_TASKS.md - Task 1 for detailed instructions
2. Create types/chat.ts with all interfaces listed in the task file
3. Add comprehensive JSDoc comments to EVERY interface
4. Ensure TypeScript compiles without errors
5. Commit with: [CODEX] Phase 2: Add comprehensive chat type definitions with JSDoc

Deliverables:
- ✅ types/chat.ts created
- ✅ All interfaces defined with JSDoc
- ✅ TypeScript compiles without errors
- ✅ Committed with proper prefix

Reference:
- CODEX_PHASE2_TASKS.md - Task 1 (detailed instructions)
- types/takeoff.ts - Example of well-documented types (Phase 1)
- app/api/chat/route.ts - Current implementation (to understand structure)

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify `types/chat.ts` exists and has all interfaces
- ✅ Verify TypeScript compiles
- ✅ Verify commit has `[CODEX] Phase 2:` prefix
- ✅ **TRIGGER:** Now you can run Step 2 (Claude Code)

---

## Step 2: Claude Code - Feature Flags

**Status:** ⚠️ BLOCKS Refactoring - Must complete before Step 4

**When to Run:** After Step 1 is complete

**Trigger Check:**
- [ ] Step 1 completed (types/chat.ts exists)
- [ ] Step 1 committed with `[CODEX] Phase 2:` prefix

**Prompt for Claude Code:**
```
I need you to complete Step 2 of Phase 2: Chat API Refactoring.

TASK: Create feature flag system for gradual rollout

This is CRITICAL - Must be in place before any refactoring begins.

What to do:
1. Read CLAUDE_CODE_PHASE2_TASKS.md - Task 1 for detailed instructions
2. Create lib/chat/feature-flags.ts
3. Implement feature flag system as specified
4. Commit with: [CLAUDE CODE] Phase 2: Add feature flag system for gradual rollout

Deliverables:
- ✅ lib/chat/feature-flags.ts created
- ✅ Feature flag system implemented
- ✅ Committed with proper prefix

Reference:
- CLAUDE_CODE_PHASE2_TASKS.md - Task 1 (detailed instructions)
- types/chat.ts - Type definitions (created by Codex in Step 1)

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify `lib/chat/feature-flags.ts` exists
- ✅ Verify feature flags are implemented
- ✅ Verify commit has `[CLAUDE CODE] Phase 2:` prefix
- ✅ **TRIGGER:** Now you can run Step 3 (Codex) OR Step 4 (Claude Code)

---

## Step 3: Codex - Utility Functions

**Status:** Can run in parallel with Step 2 (after Step 1)

**When to Run:** After Step 1 is complete (can run while Step 2 is in progress)

**Trigger Check:**
- [ ] Step 1 completed (types/chat.ts exists)

**Prompt for Codex:**
```
I need you to complete Step 3 of Phase 2: Chat API Refactoring.

TASK: Create utility functions (query-classifier, restricted-query-check)

What to do:
1. Read CODEX_PHASE2_TASKS.md - Task 2 for detailed instructions
2. Create lib/chat/utils/query-classifier.ts
3. Create lib/chat/utils/restricted-query-check.ts
4. Test both utility functions
5. Commit with: [CODEX] Phase 2: Add query classifier utility
6. Commit with: [CODEX] Phase 2: Add restricted query check utility

Deliverables:
- ✅ lib/chat/utils/query-classifier.ts created and tested
- ✅ lib/chat/utils/restricted-query-check.ts created and tested
- ✅ Committed with proper prefix

Reference:
- CODEX_PHASE2_TASKS.md - Task 2 (detailed instructions)
- app/api/chat/route.ts - Current implementation (to understand logic)

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify both utility files exist and are tested
- ✅ Verify commits have `[CODEX] Phase 2:` prefix
- ✅ **TRIGGER:** Can proceed to Step 5 (Codex) after Step 4 completes

---

## Step 4: Claude Code - Extract Middleware Modules

**Status:** ⚠️ BLOCKS Processors - Must complete before Step 6

**When to Run:** After Step 2 is complete

**Trigger Check:**
- [ ] Step 2 completed (feature flags exist)
- [ ] Step 1 completed (types/chat.ts exists)

**Prompt for Claude Code:**
```
I need you to complete Step 4 of Phase 2: Chat API Refactoring.

TASK: Extract 5 middleware modules from app/api/chat/route.ts

What to do:
1. Read CLAUDE_CODE_PHASE2_TASKS.md - Task 2 for detailed instructions
2. Extract these 5 modules:
   - lib/chat/middleware/maintenance-check.ts
   - lib/chat/middleware/auth-check.ts
   - lib/chat/middleware/rate-limit-check.ts
   - lib/chat/middleware/query-validation.ts
   - lib/chat/middleware/query-limit-check.ts
3. Extract code EXACTLY as it exists (no logic changes)
4. Test each module after extraction
5. Commit with: [CLAUDE CODE] Phase 2: Extract chat middleware modules

Deliverables:
- ✅ All 5 middleware modules extracted
- ✅ Each module tested in isolation
- ✅ Committed with proper prefix

Reference:
- CLAUDE_CODE_PHASE2_TASKS.md - Task 2 (detailed instructions)
- app/api/chat/route.ts - Current implementation (1,310 lines)
- types/chat.ts - Type definitions (created by Codex)

CRITICAL: Extract code EXACTLY as it exists - NO logic changes.

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify all 5 middleware modules exist
- ✅ Verify each module is tested
- ✅ Verify commit has `[CLAUDE CODE] Phase 2:` prefix
- ✅ **TRIGGER:** Now you can run Step 5 (Codex) OR Step 6 (Claude Code)

---

## Step 5: Codex - Snapshot Tests Setup

**Status:** Can run in parallel with Step 4 (after Step 1)

**When to Run:** After Step 1 is complete (can run while Step 4 is in progress)

**Trigger Check:**
- [ ] Step 1 completed (types/chat.ts exists)

**Prompt for Codex:**
```
I need you to complete Step 5 of Phase 2: Chat API Refactoring.

TASK: Create snapshot test framework and initial snapshots

What to do:
1. Read CODEX_PHASE2_TASKS.md - Task 3 for detailed instructions
2. Create __tests__/api/chat/snapshots/ directory
3. Set up snapshot test framework
4. Create initial snapshots for:
   - Text queries (general, counting, measurement, calculation)
   - Error scenarios (missing message, missing projectSlug, etc.)
5. Commit with: [CODEX] Phase 2: Add snapshot tests for chat API

Deliverables:
- ✅ Snapshot test framework set up
- ✅ Initial snapshots captured
- ✅ Committed with proper prefix

Reference:
- CODEX_PHASE2_TASKS.md - Task 3 (detailed instructions)
- app/api/chat/route.ts - Current implementation (to capture snapshots)

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify snapshot tests exist and pass
- ✅ Verify commit has `[CODEX] Phase 2:` prefix
- ✅ **TRIGGER:** Can proceed to Step 7 (Codex) after Step 6 completes

---

## Step 6: Claude Code - Extract Processor Modules

**Status:** ⚠️ BLOCKS Main Route - Must complete before Step 8

**When to Run:** After Step 4 is complete

**Trigger Check:**
- [ ] Step 4 completed (middleware modules exist)
- [ ] Step 1 completed (types/chat.ts exists)

**Prompt for Claude Code:**
```
I need you to complete Step 6 of Phase 2: Chat API Refactoring.

TASK: Extract 4 processor modules from app/api/chat/route.ts

This is the MOST COMPLEX extraction.

What to do:
1. Read CLAUDE_CODE_PHASE2_TASKS.md - Task 3 for detailed instructions
2. Extract these 4 modules:
   - lib/chat/processors/conversation-manager.ts
   - lib/chat/processors/context-builder.ts (MOST COMPLEX - ~250 lines)
   - lib/chat/processors/llm-handler.ts (~200 lines)
   - lib/chat/processors/response-streamer.ts (~150 lines)
3. Extract code EXACTLY as it exists (no logic changes)
4. Test each module after extraction
5. Commit with: [CLAUDE CODE] Phase 2: Extract chat processor modules

Deliverables:
- ✅ All 4 processor modules extracted
- ✅ Each module tested in isolation
- ✅ Committed with proper prefix

Reference:
- CLAUDE_CODE_PHASE2_TASKS.md - Task 3 (detailed instructions)
- app/api/chat/route.ts - Current implementation (1,310 lines)
- types/chat.ts - Type definitions (created by Codex)

CRITICAL: Extract code EXACTLY as it exists - NO logic changes.

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify all 4 processor modules exist
- ✅ Verify each module is tested
- ✅ Verify commit has `[CLAUDE CODE] Phase 2:` prefix
- ✅ **TRIGGER:** Now you can run Step 7 (Codex) OR Step 8 (Claude Code)

---

## Step 7: Codex - Integration Tests for Middleware

**Status:** Can run in parallel with Step 6 (after Step 4)

**When to Run:** After Step 4 is complete (can run while Step 6 is in progress)

**Trigger Check:**
- [ ] Step 4 completed (middleware modules exist)

**Prompt for Codex:**
```
I need you to complete Step 7 of Phase 2: Chat API Refactoring.

TASK: Create integration tests for middleware modules

What to do:
1. Read CODEX_PHASE2_TASKS.md - Task 4, Section 4.1 for detailed instructions
2. Create __tests__/api/chat/integration/middleware.test.ts
3. Test all middleware modules:
   - checkAuth
   - checkRateLimitMiddleware
   - validateQuery
   - checkQueryLimitMiddleware
4. Commit with: [CODEX] Phase 2: Add middleware integration tests

Deliverables:
- ✅ Middleware integration tests created
- ✅ All middleware modules tested
- ✅ Committed with proper prefix

Reference:
- CODEX_PHASE2_TASKS.md - Task 4, Section 4.1 (detailed instructions)
- lib/chat/middleware/ - Middleware modules (created by Claude Code)

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify middleware integration tests exist and pass
- ✅ Verify commit has `[CODEX] Phase 2:` prefix
- ✅ **TRIGGER:** Can proceed to Step 9 (Codex) after Step 8 completes

---

## Step 8: Claude Code - Refactor Main Route

**Status:** ⚠️ BLOCKS Integration Tests - Must complete before Step 9

**When to Run:** After Step 6 is complete

**Trigger Check:**
- [ ] Step 6 completed (processor modules exist)
- [ ] Step 4 completed (middleware modules exist)
- [ ] Step 2 completed (feature flags exist)

**Prompt for Claude Code:**
```
I need you to complete Step 8 of Phase 2: Chat API Refactoring.

TASK: Refactor app/api/chat/route.ts to use extracted modules

This is the FINAL refactoring step - wire everything together.

What to do:
1. Read CLAUDE_CODE_PHASE2_TASKS.md - Task 4 for detailed instructions
2. Refactor app/api/chat/route.ts from 1,310 to ~300 lines
3. Use all extracted middleware and processors
4. Implement feature flags
5. Keep old route handler as fallback
6. Commit with: [CLAUDE CODE] Phase 2: Refactor chat route to use middleware and processors

Deliverables:
- ✅ app/api/chat/route.ts reduced to ~300 lines
- ✅ Uses all extracted modules
- ✅ Feature flags implemented
- ✅ Old route handler kept as fallback
- ✅ Committed with proper prefix

Reference:
- CLAUDE_CODE_PHASE2_TASKS.md - Task 4 (detailed instructions)
- All extracted middleware and processor modules
- lib/chat/feature-flags.ts - Feature flags

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify route.ts is ~300 lines
- ✅ Verify all modules are used
- ✅ Verify feature flags are implemented
- ✅ Verify commit has `[CLAUDE CODE] Phase 2:` prefix
- ✅ **TRIGGER:** Now you can run Step 9 (Codex) OR Step 10 (Claude Code)

---

## Step 9: Codex - Integration Tests for Processors & Full Flow

**Status:** ⚠️ BLOCKS Code Review - Must complete before Step 12

**When to Run:** After Step 8 is complete

**Trigger Check:**
- [ ] Step 8 completed (main route refactored)
- [ ] Step 6 completed (processor modules exist)

**Prompt for Codex:**
```
I need you to complete Step 9 of Phase 2: Chat API Refactoring.

TASK: Create integration tests for processors and full request flow

What to do:
1. Read CODEX_PHASE2_TASKS.md - Task 4, Sections 4.2 and 4.3 for detailed instructions
2. Create __tests__/api/chat/integration/processors.test.ts
3. Create __tests__/api/chat/integration/full-flow.test.ts
4. Test all processor modules and complete request flow
5. Commit with: [CODEX] Phase 2: Add processor and full flow integration tests

Deliverables:
- ✅ Processor integration tests created
- ✅ Full flow integration tests created
- ✅ All critical paths tested
- ✅ Committed with proper prefix

Reference:
- CODEX_PHASE2_TASKS.md - Task 4, Sections 4.2 and 4.3 (detailed instructions)
- lib/chat/processors/ - Processor modules (created by Claude Code)
- app/api/chat/route.ts - Refactored route (created by Claude Code)

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify processor and full flow tests exist and pass
- ✅ Verify commit has `[CODEX] Phase 2:` prefix
- ✅ **TRIGGER:** Now you can run Step 10 (Claude Code) OR Step 12 (Cursor)

---

## Step 10: Claude Code - Parallel Execution Handler (Optional)

**Status:** Optional but recommended for safety

**When to Run:** After Step 8 is complete (can run in parallel with Step 9)

**Trigger Check:**
- [ ] Step 8 completed (main route refactored)

**Prompt for Claude Code:**
```
I need you to complete Step 10 of Phase 2: Chat API Refactoring.

TASK: Create parallel execution handler for safety validation

This is OPTIONAL but recommended for gradual rollout safety.

What to do:
1. Read CLAUDE_CODE_PHASE2_TASKS.md - Task 5 for detailed instructions
2. Create lib/chat/parallel-execution.ts
3. Implement response comparison logic
4. Commit with: [CLAUDE CODE] Phase 2: Add parallel execution handler for safety validation

Deliverables:
- ✅ Parallel execution handler created
- ✅ Response comparison logic implemented
- ✅ Committed with proper prefix

Reference:
- CLAUDE_CODE_PHASE2_TASKS.md - Task 5 (detailed instructions)

STOP after completing this step. Do NOT proceed to other steps yet.
```

**After Completion:**
- ✅ Verify parallel execution handler exists
- ✅ Verify commit has `[CLAUDE CODE] Phase 2:` prefix
- ✅ **TRIGGER:** Can proceed to Step 12 (Cursor) after Step 9 completes

---

## Step 11: Codex - Test Framework Setup (If Needed)

**Status:** Only if Vitest is not already configured

**When to Run:** Anytime after Step 1 (can run in parallel with other steps)

**Trigger Check:**
- [ ] Check if Vitest is already configured
- [ ] If not configured, run this step

**Prompt for Codex:**
```
I need you to complete Step 11 of Phase 2: Chat API Refactoring.

TASK: Set up Vitest testing framework (if not already configured)

ONLY do this if Vitest is not already set up in the project.

What to do:
1. Check if Vitest is already configured (check package.json, vitest.config.ts)
2. If NOT configured:
   - Read CODEX_PHASE2_TASKS.md - Task 5 for detailed instructions
   - Set up Vitest
   - Add test scripts to package.json
   - Commit with: [CODEX] Phase 2: Set up Vitest testing framework
3. If already configured, skip this step

Deliverables:
- ✅ Vitest configured (if needed)
- ✅ Test scripts added to package.json (if needed)
- ✅ Committed with proper prefix (if changes made)

Reference:
- CODEX_PHASE2_TASKS.md - Task 5 (detailed instructions)

STOP after completing this step (or skip if already configured).
```

**After Completion:**
- ✅ Verify Vitest is configured (if it wasn't before)
- ✅ Verify commit has `[CODEX] Phase 2:` prefix (if changes made)
- ✅ **TRIGGER:** No blocking dependencies

---

## Step 12: Cursor - Code Review

**Status:** ⚠️ BLOCKS Deployment - Must complete before Step 13

**When to Run:** After Steps 1-11 are complete

**Trigger Check:**
- [ ] Step 1 completed (types/chat.ts)
- [ ] Step 2 completed (feature flags)
- [ ] Step 4 completed (middleware)
- [ ] Step 6 completed (processors)
- [ ] Step 8 completed (main route)
- [ ] Step 9 completed (integration tests)

**Prompt for Cursor (This Assistant):**
```
Phase 2: Chat API Refactoring - Code Review

All development work (Steps 1-11) is complete. Now I need you to do a comprehensive code review.

TASK: Review all refactored code before deployment

What to do:
1. Review all refactored code
2. Verify TypeScript types
3. Check error handling
4. Assess performance impact
5. Commit with: [CURSOR] Phase 2: Review chat API refactoring

Deliverables:
- ✅ All code reviewed
- ✅ TypeScript types verified
- ✅ Error handling verified
- ✅ Performance impact assessed
- ✅ Committed with proper prefix

Reference:
- phase_2_chat_api_refactoring_spec_6bfdfb7d.plan.md - Full specification
- All refactored files

STOP after completing this step. Do NOT proceed to deployment yet.
```

**After Completion:**
- ✅ Verify code review is complete
- ✅ Verify commit has `[CURSOR] Phase 2:` prefix
- ✅ **TRIGGER:** Now you can run Step 13 (Cursor)

---

## Steps 13-16: Cursor - Deployment & Rollout

**Status:** Deployment and rollout phases

**When to Run:** After Step 12 is complete

**See:** `PHASE2_EXECUTION_ORDER.md` for Steps 13-16 details

**Note:** These steps involve staging deployment, gradual rollout, browser testing, and cleanup. They are managed by Cursor (this assistant) and follow the plan specification.

---

## Quick Reference: Trigger Points

| Step | Agent | Blocks | Can Run After |
|------|-------|--------|---------------|
| 1 | Codex | Step 2 | Start |
| 2 | Claude Code | Step 4 | Step 1 |
| 3 | Codex | - | Step 1 |
| 4 | Claude Code | Step 6 | Step 2 |
| 5 | Codex | - | Step 1 |
| 6 | Claude Code | Step 8 | Step 4 |
| 7 | Codex | - | Step 4 |
| 8 | Claude Code | Step 9 | Step 6 |
| 9 | Codex | Step 12 | Step 8 |
| 10 | Claude Code | - | Step 8 |
| 11 | Codex | - | Step 1 (if needed) |
| 12 | Cursor | Step 13 | Steps 1-11 |

---

## Execution Flow

```
Step 1 (Codex) → Step 2 (Claude Code)
                ↓
Step 3 (Codex) ─┘
                ↓
Step 4 (Claude Code) → Step 6 (Claude Code)
                ↓              ↓
Step 5 (Codex) ─┘              ↓
                                ↓
Step 7 (Codex) ────────────────┘
                ↓
Step 8 (Claude Code) → Step 9 (Codex)
                ↓              ↓
Step 10 (Claude Code) ────────┘
                ↓
Step 11 (Codex) ─┘
                ↓
Step 12 (Cursor) → Steps 13-16 (Cursor)
```

---

## Important Notes

1. **One prompt at a time** - Execute each step's prompt individually
2. **Wait for completion** - Don't run the next prompt until current step is done
3. **Check triggers** - Verify trigger conditions before running each step
4. **Verify deliverables** - Check that each step's deliverables are met
5. **Commit prefixes** - Always use proper commit prefixes for tracking
