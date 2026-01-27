# Codex Phase 1 Tasks - Explicit Instructions

## Current Status
- **Branch:** `refactor/phase1-material-takeoff`
- **Phase:** Phase 1 - Material Takeoff Manager Refactoring
- **Claude Code Status:** ✅ Completed (reduced component from 2,289 to 1,537 lines)
- **Your Status:** 🔄 In Progress

## Your Tasks (Codex)

### ✅ Task 1: Fix `any` Types - ALREADY COMPLETED
The `any` types in `components/material-takeoff-manager.tsx` have already been fixed by Claude Code. All state variables now use proper types from `types/takeoff.ts`.

**No action needed for this task.**

---

### Task 2: Add Unit Tests

**Create these test files:**

#### Test 1: `__tests__/lib/takeoff-calculations.test.ts`

**What to test:**
- `calculateTakeoffTotals()` function
- `calculateCostSummary()` function
- `getCategorySummaries()` function
- `getTotalQuantityByUnit()` function
- `getTotalCost()` function

**Test Framework:** Use Jest and React Testing Library

**Example structure:**
```typescript
import { calculateTakeoffTotals, getTotalCost } from '@/lib/takeoff-calculations';
import type { TakeoffLineItem } from '@/types/takeoff';

describe('takeoff-calculations', () => {
  const mockItems: TakeoffLineItem[] = [
    {
      id: '1',
      category: 'Concrete',
      itemName: 'Concrete Slab',
      quantity: 100,
      unit: 'SF',
      unitCost: 5.50,
      totalCost: 550,
      verified: true
    },
    // Add more mock items
  ];

  describe('calculateTakeoffTotals', () => {
    it('should calculate total cost correctly', () => {
      const totals = calculateTakeoffTotals(mockItems);
      expect(totals.totalCost).toBe(550);
    });
    // Add more tests
  });
});
```

#### Test 2: `__tests__/lib/takeoff-formatters.test.ts`

**What to test:**
- `formatCurrency()` function
- `formatQuantity()` function
- `getConfidenceColor()` function

#### Test 3: `__tests__/hooks/useTakeoffData.test.ts`

**What to test:**
- Data fetching logic
- Auto-selection of first takeoff
- Error handling
- Loading states

**Use React Testing Library hooks testing:**
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useTakeoffData } from '@/hooks/useTakeoffData';

describe('useTakeoffData', () => {
  it('should fetch takeoffs on mount', async () => {
    // Mock fetch
    // Test hook
  });
});
```

**Commit:** `[CODEX] Phase 1: Add unit tests for takeoff utilities and hooks`

---

### Task 3: Enhance Type Definitions

**File:** `types/takeoff.ts`

**What to do:**
1. Add JSDoc comments to all exported interfaces
2. Ensure all types are properly exported
3. Add any missing type definitions if needed
4. Verify strict TypeScript compliance

**Example:**
```typescript
/**
 * Represents a single line item in a material takeoff
 * 
 * @interface TakeoffLineItem
 * @property {string} id - Unique identifier for the item
 * @property {string} category - Category/division the item belongs to
 * @property {string} itemName - Name of the material/item
 * @property {number} quantity - Quantity of the item
 * @property {string} unit - Unit of measurement (SF, LF, EA, etc.)
 * @property {number} [unitCost] - Cost per unit (optional)
 * @property {number} [totalCost] - Total cost (quantity × unitCost)
 * @property {boolean} verified - Whether the item has been verified
 */
export interface TakeoffLineItem {
  // ... existing properties
}
```

**Commit:** `[CODEX] Phase 1: Enhance type definitions with JSDoc comments`

---

## Files You'll Need to Read

1. `types/takeoff.ts` - For type definitions
2. `lib/takeoff-calculations.ts` - For calculation functions to test
3. `lib/takeoff-formatters.ts` - For formatter functions to test
4. `hooks/useTakeoffData.ts` - For hook to test
5. `components/material-takeoff-manager.tsx` - For finding `any` types

## Testing Setup

**Current Status:** No Jest/Vitest configured yet. You'll need to set up testing.

**Option 1: Use Vitest (Recommended for Next.js)**
```bash
# Install Vitest and React Testing Library
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

**Option 2: Use Jest (Traditional)**
```bash
# Install Jest and React Testing Library
npm install -D jest @testing-library/react @testing-library/jest-dom @types/jest ts-jest
```

**Create test config file** (choose one):
- `vitest.config.ts` for Vitest
- `jest.config.js` for Jest

**Add test script to package.json:**
```json
"scripts": {
  "test": "vitest" // or "jest" if using Jest
}
```

**Note:** If setting up tests is too complex, you can skip this for now and just add JSDoc comments. Tests can be added later.

## Success Criteria

✅ All `any` types replaced with proper types (ALREADY DONE)  
⏳ All tests pass (if you set up testing)  
✅ TypeScript compiles without errors  
⏳ JSDoc comments added to all types  
⏳ Tests have good coverage (aim for 60%+ if tests are added)

## Priority Order

1. **HIGH PRIORITY:** Add JSDoc comments to `types/takeoff.ts` (easiest, no setup needed)
2. **MEDIUM PRIORITY:** Set up testing framework (if you have time)
3. **MEDIUM PRIORITY:** Write unit tests (if testing is set up)

## After Completing

1. Update `.workflow-status.json` - mark Codex tasks as completed
2. Commit all changes with `[CODEX]` prefix
3. Push to branch: `refactor/phase1-material-takeoff`
4. Note: Cursor will review and test after you're done

## Questions?

If you're stuck:
- Check `PHASE1_PROGRESS.md` for context
- Read `ROLE_ASSIGNMENTS.md` for your role details
- Check existing test files in the project for patterns
