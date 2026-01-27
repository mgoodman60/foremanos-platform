# Codex Quick Start - Phase 1 Tasks

## What You Need to Do (Simplified)

### ✅ Task 1: DONE - `any` types already fixed

### 📝 Task 2: Add JSDoc Comments (EASIEST - START HERE)

**File:** `types/takeoff.ts`

**What to do:**
1. Open `types/takeoff.ts`
2. Add JSDoc comments above each `export interface`
3. Document all properties

**Example:**
```typescript
/**
 * Represents a single line item in a material takeoff
 */
export interface TakeoffLineItem {
  /** Unique identifier for the item */
  id: string;
  /** Category/division the item belongs to */
  category: string;
  /** Name of the material/item */
  itemName: string;
  // ... etc
}
```

**Commit:** `[CODEX] Phase 1: Add JSDoc comments to takeoff types`

---

### 🧪 Task 3: Add Unit Tests (OPTIONAL - Can Skip if Complex)

**Only do this if you can easily set up testing. Otherwise, skip it.**

**Files to create:**
1. `__tests__/lib/takeoff-calculations.test.ts`
2. `__tests__/lib/takeoff-formatters.test.ts`  
3. `__tests__/hooks/useTakeoffData.test.ts`

**If testing setup is too complex, you can skip this task.**

---

## Quick Instructions for Codex

1. **Read this file first:** `CODEX_PHASE1_TASKS.md` (detailed instructions)
2. **Start with Task 2** (JSDoc comments) - it's the easiest
3. **Work on branch:** `refactor/phase1-material-takeoff`
4. **Commit with:** `[CODEX] Phase 1: ...` prefix
5. **Files you need:**
   - `types/takeoff.ts` - Add JSDoc comments here
   - `lib/takeoff-calculations.ts` - Read to understand what to test
   - `lib/takeoff-formatters.ts` - Read to understand what to test
   - `hooks/useTakeoffData.ts` - Read to understand what to test

## If You're Stuck

- The `any` types are already fixed - you don't need to do that
- Focus on JSDoc comments first (easiest task)
- Testing is optional if setup is complex
- Check `PHASE1_PROGRESS.md` for context
