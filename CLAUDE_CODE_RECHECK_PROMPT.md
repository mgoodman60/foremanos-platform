# Claude Code - Recheck Work Prompt

## Situation

You started work before Codex completed Step 1 (type definitions). We need to verify your work is correct and compatible.

---

## Prompt for Claude Code

```
I need you to recheck your Phase 2 work because you started before Codex completed Step 1 (type definitions).

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

REFERENCE FILES:
- types/chat.ts - Type definitions (should exist if Codex completed Step 1)
- lib/chat/feature-flags.ts - Your Step 2 work
- lib/chat/middleware/ - Your Step 4 work
- CLAUDE_CODE_PHASE2_TASKS.md - Original task instructions

IMPORTANT:
- Do NOT proceed with Step 6 (processors) until this verification is complete
- Do NOT proceed if types/chat.ts is missing
- Fix any type compatibility issues before continuing
```

---

## What Claude Code Should Do

1. **Check if types/chat.ts exists**
   - If NO → Stop and report that Codex Step 1 must complete first
   - If YES → Continue verification

2. **Verify all completed work**
   - Check Step 2 (Feature Flags)
   - Check Step 4 (Middleware modules)
   - Verify TypeScript compiles
   - Verify no type errors

3. **Fix compatibility issues**
   - Update imports to use types from types/chat.ts
   - Replace any 'any' types
   - Fix TypeScript errors
   - Test everything still works

4. **Report status**
   - All good → Can proceed
   - Issues found → List and fix them
   - Blocked → Wait for Codex

---

## Expected Outcomes

### Scenario 1: types/chat.ts EXISTS
- Claude Code verifies work
- Fixes any type compatibility issues
- Reports "All work verified and compatible"
- Can proceed with Step 6 (processors)

### Scenario 2: types/chat.ts DOES NOT EXIST
- Claude Code reports "Blocked - waiting for Codex Step 1"
- Codex must complete Step 1 first
- Then Claude Code can verify and fix

### Scenario 3: types/chat.ts EXISTS but INCOMPATIBLE
- Claude Code identifies issues
- Fixes type imports and usage
- Commits fixes
- Reports "Issues fixed, ready to proceed"

---

## After Verification

Once Claude Code reports verification is complete:
- ✅ Can proceed with Step 6 (Extract Processors)
- ✅ All dependencies are met
- ✅ Type compatibility confirmed
