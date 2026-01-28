# Phase 2: Agent Prompts - Ready to Use

## ⚠️ IMPORTANT: Per-Step Execution

**We now use per-step prompts for better control.**

**Use this file:** `PHASE2_PROMPTS_PER_STEP.md` - Individual prompts for each step

**This file contains:** Batch prompts (for reference only)

---

## Quick Start

**For per-step execution (RECOMMENDED):**
1. Open `PHASE2_PROMPTS_PER_STEP.md`
2. Find the step you need to execute
3. Copy that step's prompt
4. Give it to the appropriate agent
5. Wait for completion before running the next step

**For batch execution (if needed):**
Copy and paste the batch prompts below directly to Claude Code and Codex.

---

## 🤖 PROMPT FOR CODEX (START FIRST)

```
I need you to work on Phase 2: Chat API Refactoring for ForemanOS.

CRITICAL: You must start FIRST because Claude Code needs the type definitions you'll create.

Your tasks are detailed in: CODEX_PHASE2_TASKS.md

EXECUTION ORDER (from PHASE2_EXECUTION_ORDER.md):
- Step 1: Create types/chat.ts with comprehensive JSDoc comments (2-3 hours)
- Step 3: Create utility functions (query-classifier, restricted-query-check) (2-3 hours)
- Step 5: Create snapshot tests (3-4 hours)
- Step 7: Create middleware integration tests (3-4 hours)
- Step 9: Create processor & full flow integration tests (4-5 hours)
- Step 11: Set up Vitest if needed (1-2 hours)

START WITH STEP 1: Type Definitions
- This is CRITICAL - Claude Code cannot proceed without these types
- Create types/chat.ts with all interfaces from CODEX_PHASE2_TASKS.md Task 1
- Add comprehensive JSDoc comments to every interface
- Ensure TypeScript compiles without errors
- Commit with: [CODEX] Phase 2: Add comprehensive chat type definitions with JSDoc

After Step 1, you can proceed with the remaining tasks in order.

IMPORTANT:
- Read CODEX_PHASE2_TASKS.md for detailed instructions
- Test everything you create
- Commit with [CODEX] Phase 2: prefix
- Do NOT manually update .workflow-status.json (automated system handles it)

Reference files:
- CODEX_PHASE2_TASKS.md - Your detailed task instructions
- PHASE2_EXECUTION_ORDER.md - Execution sequence
- types/takeoff.ts - Example of well-documented types (Phase 1)
- app/api/chat/route.ts - Current implementation (understand the structure)
```

---

## 🤖 PROMPT FOR CLAUDE CODE (RECHECK FIRST, THEN CONTINUE)

```
I need you to work on Phase 2: Chat API Refactoring for ForemanOS.

IMPORTANT: You started work before Codex completed Step 1 (type definitions). 
You must FIRST recheck and verify your completed work, then continue with remaining tasks.

================================================================================
PART 1: RECHECK AND VERIFY YOUR COMPLETED WORK
================================================================================

CRITICAL TASKS:

1. VERIFY DEPENDENCIES:
   - Check if types/chat.ts exists (created by Codex in Step 1)
   - If it DOES NOT exist:
     * STOP all work
     * Report that Codex Step 1 must be completed first
     * Wait for types/chat.ts to be created
   - If it DOES exist:
     * Continue with verification below

2. VERIFY YOUR COMPLETED WORK:

   A. Step 2: Feature Flags (lib/chat/feature-flags.ts)
      - [ ] File exists
      - [ ] TypeScript compiles without errors
      - [ ] No references to types that don't exist
      - [ ] Commit has [CLAUDE CODE] Phase 2: prefix
   
   B. Step 4: Middleware Modules
      - [ ] All 5 middleware files exist:
        * lib/chat/middleware/maintenance-check.ts
        * lib/chat/middleware/auth-check.ts
        * lib/chat/middleware/rate-limit-check.ts
        * lib/chat/middleware/query-validation.ts
        * lib/chat/middleware/query-limit-check.ts
      - [ ] Each file imports types from types/chat.ts (if types exist)
      - [ ] TypeScript compiles without errors
      - [ ] No 'any' types used (use proper types from types/chat.ts)
      - [ ] Commit has [CLAUDE CODE] Phase 2: prefix

3. FIX ANY ISSUES:

   If types/chat.ts EXISTS but your code has issues:
   - Update imports to use types from types/chat.ts
   - Replace any 'any' types with proper types
   - Fix any TypeScript compilation errors
   - Test each module still works
   - Commit fixes with: [CLAUDE CODE] Phase 2: Fix type compatibility issues

   If types/chat.ts DOES NOT EXIST:
   - DO NOT proceed with fixes
   - Report that Codex must complete Step 1 first
   - Wait for types/chat.ts to be created

4. VERIFY TYPE COMPATIBILITY:

   For each middleware module, check:
   - [ ] Uses AuthCheckResult from types/chat.ts (if available)
   - [ ] Uses RateLimitCheckResult from types/chat.ts (if available)
   - [ ] Uses QueryValidationResult from types/chat.ts (if available)
   - [ ] Uses QueryLimitCheckResult from types/chat.ts (if available)
   - [ ] Uses MaintenanceCheckResult from types/chat.ts (if available)
   - [ ] No hardcoded type definitions (should import from types/chat.ts)

5. REPORT STATUS:

   After verification, report:
   - ✅ All work is correct and compatible
   - ⚠️ Issues found (list them)
   - ❌ Blocked - types/chat.ts missing (wait for Codex)

================================================================================
PART 2: CONTINUE WITH REMAINING TASKS (After Verification Complete)
================================================================================

ONLY proceed with Part 2 if:
- ✅ types/chat.ts exists
- ✅ All verification checks pass
- ✅ Type compatibility confirmed

Your remaining tasks are detailed in: CLAUDE_CODE_PHASE2_TASKS.md

EXECUTION ORDER (from PHASE2_EXECUTION_ORDER.md):
- Step 6: Extract processor modules (6-8 hours) - NEXT
- Step 8: Refactor main route.ts (4-6 hours)
- Step 10: Create parallel execution handler (2-3 hours, optional)
- Step 16: Remove old code (1 hour, after 7 days of stability)

START WITH STEP 6: Extract Processor Modules
- Extract 4 processor modules from app/api/chat/route.ts:
  * lib/chat/processors/conversation-manager.ts
  * lib/chat/processors/context-builder.ts (MOST COMPLEX - ~250 lines)
  * lib/chat/processors/llm-handler.ts (~200 lines)
  * lib/chat/processors/response-streamer.ts (~150 lines)
- Extract code EXACTLY as it exists (no logic changes)
- Use types from types/chat.ts for all interfaces
- Test each module after extraction
- Commit with: [CLAUDE CODE] Phase 2: Extract chat processor modules

Then Step 8: Refactor Main Route
- Reduce app/api/chat/route.ts from 1,310 to ~300 lines
- Use all extracted middleware and processors
- Use types from types/chat.ts
- Keep old route handler as fallback
- Commit with: [CLAUDE CODE] Phase 2: Refactor chat route to use middleware and processors

Then Step 10: Parallel Execution Handler (Optional but Recommended)
- Create lib/chat/parallel-execution.ts
- Implement response comparison logic
- Commit with: [CLAUDE CODE] Phase 2: Add parallel execution handler for safety validation

IMPORTANT:
- Read CLAUDE_CODE_PHASE2_TASKS.md for detailed instructions
- Extract code EXACTLY as it exists - NO logic changes
- Maintain 100% backward compatibility
- Use types from types/chat.ts (do NOT define your own types)
- Test each extraction before moving to the next
- Commit with [CLAUDE CODE] Phase 2: prefix
- Do NOT manually update .workflow-status.json (automated system handles it)

Reference files:
- CLAUDE_CODE_PHASE2_TASKS.md - Your detailed task instructions
- PHASE2_EXECUTION_ORDER.md - Execution sequence
- app/api/chat/route.ts - Current implementation (1,310 lines to refactor)
- types/chat.ts - Type definitions (created by Codex in Step 1) - USE THESE TYPES
```

---

## 🖥️ PROMPT FOR CURSOR (This Assistant - After Steps 1-11 Complete)

```
Phase 2: Chat API Refactoring - Code Review & Deployment

All development work (Steps 1-11) is complete. Now I need you to:

EXECUTION ORDER (from PHASE2_EXECUTION_ORDER.md):
- Step 12: Code Review (2-3 hours)
- Step 13: Staging Deployment & 48-hour monitoring
- Step 14: Gradual Rollout (10% → 25% → 50% → 100%, 5-7 days)
- Step 15: Browser Testing (2-3 hours)
- Step 16: Coordinate Claude Code to remove old code (after 7 days)

START WITH STEP 12: Code Review
- Review all refactored code
- Verify TypeScript types
- Check error handling
- Assess performance impact
- Commit with: [CURSOR] Phase 2: Review chat API refactoring

Then Step 13: Staging Deployment
- Deploy to staging environment
- Run full test suite
- Monitor for 48 hours
- Commit with: [CURSOR] Phase 2: Deploy to staging and monitor

Then Step 14: Gradual Rollout
- Enable parallel execution (0% traffic, compare results) - 24 hours
- Enable new middleware (10% traffic) - 48 hours
- Increase to 25% traffic - 24 hours
- Enable new processors (50% traffic) - 48 hours
- Increase to 100% traffic - 7 days monitoring
- Commit with: [CURSOR] Phase 2: Execute gradual rollout

Then Step 15: Browser Testing
- Test chat functionality in browser
- Verify RAG retrieval
- Test rate limiting
- Test streaming
- Test error scenarios
- Commit with: [CURSOR] Phase 2: Test and approve chat API refactoring

Finally Step 16: Coordinate Cleanup
- After 7 days of stable operation at 100%
- Coordinate with Claude Code to remove old code
- Commit with: [CLAUDE CODE] Phase 2: Remove old code path after stable operation

Reference files:
- phase_2_chat_api_refactoring_spec_6bfdfb7d.plan.md - Full specification
- PHASE2_EXECUTION_ORDER.md - Execution sequence
- Guard rails documentation in the plan
```

---

## 📋 Execution Checklist

### For Codex:
- [ ] Step 1: Type definitions created (BLOCKS Claude Code)
- [ ] Step 3: Utility functions created
- [ ] Step 5: Snapshot tests created
- [ ] Step 7: Middleware integration tests created
- [ ] Step 9: Processor & full flow integration tests created
- [ ] Step 11: Test framework set up (if needed)

### For Claude Code:
- [ ] Step 2: Feature flags created (BLOCKS refactoring)
- [ ] Step 4: Middleware modules extracted
- [ ] Step 6: Processor modules extracted
- [ ] Step 8: Main route refactored
- [ ] Step 10: Parallel execution handler created (optional)
- [ ] Step 16: Old code removed (after 7 days)

### For Cursor:
- [ ] Step 12: Code review completed
- [ ] Step 13: Staging deployment & monitoring (48 hours)
- [ ] Step 14: Gradual rollout (5-7 days)
- [ ] Step 15: Browser testing completed
- [ ] Step 16: Coordinated cleanup

---

## 🚨 Critical Dependencies

```
1. Codex MUST start first (Step 1: Types)
   ↓
2. Claude Code can start after Codex Step 1 (Step 2: Feature Flags)
   ↓
3. Claude Code extracts modules (Steps 4, 6, 8)
   ↓
4. Codex creates tests (Steps 5, 7, 9)
   ↓
5. Cursor reviews and deploys (Steps 12-15)
   ↓
6. Claude Code removes old code (Step 16, after 7 days)
```

---

## 📚 Reference Documents

1. **PHASE2_EXECUTION_ORDER.md** - Exact execution sequence
2. **CODEX_PHASE2_TASKS.md** - Codex detailed instructions
3. **CLAUDE_CODE_PHASE2_TASKS.md** - Claude Code detailed instructions
4. **PHASE2_AGENT_PROMPTS.md** - Quick reference guide
5. **phase_2_chat_api_refactoring_spec_6bfdfb7d.plan.md** - Full specification

---

## ⚡ Quick Handoff Commands

### Per-Step Execution (RECOMMENDED):

**Step 1: Codex - Type Definitions**
```
[Open PHASE2_PROMPTS_PER_STEP.md, copy Step 1 prompt, give to Codex]
```

**Step 2: Claude Code - Feature Flags** (after Step 1 completes)
```
[Open PHASE2_PROMPTS_PER_STEP.md, copy Step 2 prompt, give to Claude Code]
```

**Step 3: Codex - Utility Functions** (after Step 1 completes)
```
[Open PHASE2_PROMPTS_PER_STEP.md, copy Step 3 prompt, give to Codex]
```

**Continue with remaining steps from PHASE2_PROMPTS_PER_STEP.md**

### Batch Execution (Alternative):

**Start Codex (all steps):**
```
[Copy the Codex batch prompt above and paste to Codex]
```

**Start Claude Code (all steps, after Codex Step 1):**
```
[Copy the Claude Code batch prompt above and paste to Claude Code]
```

**Start Cursor Review (after Steps 1-11 complete):**
```
[Copy the Cursor prompt above]
```

---

## 📋 Execution Checklist

**Per-Step Method:**
- [ ] Step 1: Codex - Type Definitions
- [ ] Step 2: Claude Code - Feature Flags
- [ ] Step 3: Codex - Utility Functions
- [ ] Step 4: Claude Code - Middleware
- [ ] Step 5: Codex - Snapshot Tests
- [ ] Step 6: Claude Code - Processors
- [ ] Step 7: Codex - Middleware Tests
- [ ] Step 8: Claude Code - Main Route
- [ ] Step 9: Codex - Processor Tests
- [ ] Step 10: Claude Code - Parallel Execution (optional)
- [ ] Step 11: Codex - Test Framework (if needed)
- [ ] Step 12: Cursor - Code Review
- [ ] Steps 13-16: Cursor - Deployment & Rollout

---

**Total Timeline:** 3-4 weeks (including monitoring periods)

**Current Status:** Ready to start - Use `PHASE2_PROMPTS_PER_STEP.md` for Step 1
