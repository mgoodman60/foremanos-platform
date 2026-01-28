# Phase 2: Trigger Guide - When to Run Each Prompt

## How to Use

1. **Check trigger conditions** before running each step
2. **Verify deliverables** after each step completes
3. **Run next prompt** only when triggers are met

---

## Step-by-Step Trigger Map

### Step 1: Codex - Type Definitions
**Trigger:** ✅ START HERE - No prerequisites
**Run When:** Beginning of Phase 2
**After Completion:** ✅ Can trigger Step 2 (Claude Code) OR Step 3 (Codex)

---

### Step 2: Claude Code - Feature Flags
**Trigger:** ✅ Step 1 completed
- [ ] `types/chat.ts` exists
- [ ] Step 1 committed with `[CODEX] Phase 2:` prefix
**Run When:** After Step 1 is done
**After Completion:** ✅ Can trigger Step 4 (Claude Code)

---

### Step 3: Codex - Utility Functions
**Trigger:** ✅ Step 1 completed
- [ ] `types/chat.ts` exists
**Run When:** After Step 1 is done (can run in parallel with Step 2)
**After Completion:** ✅ Can trigger Step 5 (Codex) after Step 4 completes

---

### Step 4: Claude Code - Extract Middleware
**Trigger:** ✅ Step 2 completed
- [ ] `lib/chat/feature-flags.ts` exists
- [ ] Step 2 committed with `[CLAUDE CODE] Phase 2:` prefix
**Run When:** After Step 2 is done
**After Completion:** ✅ Can trigger Step 6 (Claude Code) OR Step 7 (Codex)

---

### Step 5: Codex - Snapshot Tests
**Trigger:** ✅ Step 1 completed
- [ ] `types/chat.ts` exists
**Run When:** After Step 1 is done (can run in parallel with Step 4)
**After Completion:** ✅ Can trigger Step 7 (Codex) after Step 6 completes

---

### Step 6: Claude Code - Extract Processors
**Trigger:** ✅ Step 4 completed
- [ ] All 5 middleware modules exist
- [ ] Step 4 committed with `[CLAUDE CODE] Phase 2:` prefix
**Run When:** After Step 4 is done
**After Completion:** ✅ Can trigger Step 8 (Claude Code) OR Step 9 (Codex)

---

### Step 7: Codex - Middleware Integration Tests
**Trigger:** ✅ Step 4 completed
- [ ] All 5 middleware modules exist
**Run When:** After Step 4 is done (can run in parallel with Step 6)
**After Completion:** ✅ Can trigger Step 9 (Codex) after Step 8 completes

---

### Step 8: Claude Code - Refactor Main Route
**Trigger:** ✅ Step 6 completed
- [ ] All 4 processor modules exist
- [ ] Step 6 committed with `[CLAUDE CODE] Phase 2:` prefix
**Run When:** After Step 6 is done
**After Completion:** ✅ Can trigger Step 9 (Codex) OR Step 10 (Claude Code)

---

### Step 9: Codex - Processor & Full Flow Tests
**Trigger:** ✅ Step 8 completed
- [ ] `app/api/chat/route.ts` is ~300 lines
- [ ] Step 8 committed with `[CLAUDE CODE] Phase 2:` prefix
**Run When:** After Step 8 is done
**After Completion:** ✅ Can trigger Step 12 (Cursor)

---

### Step 10: Claude Code - Parallel Execution (Optional)
**Trigger:** ✅ Step 8 completed
- [ ] `app/api/chat/route.ts` is refactored
**Run When:** After Step 8 is done (can run in parallel with Step 9)
**After Completion:** ✅ Can trigger Step 12 (Cursor) after Step 9 completes

---

### Step 11: Codex - Test Framework Setup (If Needed)
**Trigger:** ✅ Check if Vitest is configured
- [ ] Check `package.json` for Vitest
- [ ] Check for `vitest.config.ts`
**Run When:** Anytime (only if Vitest not configured)
**After Completion:** ✅ No blocking dependencies

---

### Step 12: Cursor - Code Review
**Trigger:** ✅ Steps 1-11 completed
- [ ] Step 1: `types/chat.ts` exists
- [ ] Step 2: `lib/chat/feature-flags.ts` exists
- [ ] Step 4: All middleware modules exist
- [ ] Step 6: All processor modules exist
- [ ] Step 8: `app/api/chat/route.ts` is ~300 lines
- [ ] Step 9: Integration tests exist
**Run When:** After Steps 1-11 are done
**After Completion:** ✅ Can trigger Step 13 (Cursor)

---

## Visual Trigger Flow

```
START
  ↓
Step 1 (Codex) ──────────────┐
  ↓                           │
Step 2 (Claude Code)          │
  ↓                           │
Step 4 (Claude Code)          │
  ↓                           │
Step 6 (Claude Code)          │
  ↓                           │
Step 8 (Claude Code)          │
  ↓                           │
Step 9 (Codex) ───────────────┘
  ↓
Step 12 (Cursor)
  ↓
Steps 13-16 (Cursor)
```

**Parallel Paths:**
- Step 3 (Codex) can run after Step 1
- Step 5 (Codex) can run after Step 1
- Step 7 (Codex) can run after Step 4
- Step 10 (Claude Code) can run after Step 8
- Step 11 (Codex) can run anytime if needed

---

## Quick Decision Tree

**Q: Which step should I run next?**
1. Check `.workflow-status.json` for completed steps
2. Find the first incomplete step
3. Check its trigger conditions
4. If triggers are met → Run that step's prompt
5. If triggers not met → Complete prerequisite steps first

**Q: Can I run steps in parallel?**
- ✅ Steps 3, 5, 7, 10, 11 can run in parallel (see trigger map above)
- ❌ Steps 1, 2, 4, 6, 8, 9, 12 must run sequentially

**Q: How do I know when a step is complete?**
- Check the step's deliverables checklist
- Verify files exist
- Verify commits have proper prefixes
- Check `.workflow-status.json` (auto-updated)

---

## Example Execution Sequence

**Day 1:**
1. ✅ Run Step 1 prompt → Codex creates types
2. ✅ Verify Step 1 complete → types/chat.ts exists
3. ✅ Run Step 2 prompt → Claude Code creates feature flags
4. ✅ Run Step 3 prompt → Codex creates utilities (parallel)

**Day 2:**
5. ✅ Verify Step 2 complete → feature-flags.ts exists
6. ✅ Run Step 4 prompt → Claude Code extracts middleware
7. ✅ Run Step 5 prompt → Codex creates snapshots (parallel)

**Day 3:**
8. ✅ Verify Step 4 complete → middleware modules exist
9. ✅ Run Step 6 prompt → Claude Code extracts processors
10. ✅ Run Step 7 prompt → Codex creates middleware tests (parallel)

**Continue following trigger map...**

---

## Reference Files

- **`PHASE2_PROMPTS_PER_STEP.md`** - Individual prompts for each step
- **`PHASE2_EXECUTION_ORDER.md`** - Detailed execution order
- **`.workflow-status.json`** - Current status (auto-updated)
