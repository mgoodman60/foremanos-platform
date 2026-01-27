# ForemanOS Improvement Specification Sheet

**Version:** 1.0  
**Date:** January 27, 2026  
**Status:** Planning Phase

---

## Executive Summary

This specification outlines improvements to existing ForemanOS features, focusing on code quality, maintainability, and performance. The primary goal is to refactor large components, improve TypeScript type safety, standardize error handling, and enhance overall code quality.

---

## Current State Analysis

### File Size Analysis

| File | Lines | Status | Priority |
|------|-------|--------|----------|
| `components/material-takeoff-manager.tsx` | 2,165 | Critical | High |
| `app/api/chat/route.ts` | 1,310 | Critical | High |
| `app/project/[slug]/page.tsx` | 1,225+ | High | Medium |

### Technical Debt Inventory

1. **Large Components** - 3 files over 1,000 lines
2. **TypeScript `any` Types** - 5+ instances in active code
3. **Inconsistent Error Handling** - Older API routes lack standardization
4. **Minimal Test Coverage** - No test suite currently

---

## Phase 1: Material Takeoff Manager Refactoring

### Current Component Analysis

**File:** `components/material-takeoff-manager.tsx` (2,165 lines)

**Responsibilities:**
- Takeoff data fetching and state management
- Line item filtering and search
- Category/CSI division grouping
- Bulk operations (verify, delete, edit)
- Export functionality (CSV, Excel)
- Budget synchronization
- MEP data extraction
- QA dashboard integration
- Labor planning
- Price management
- Aggregation across takeoffs
- Earthwork calculations

**State Management:**
- 20+ useState hooks
- Complex filtering logic
- Multiple modal states
- Selection management

### Refactoring Specification

#### 1.1 Component Structure

**Target Structure:**
```
components/takeoff/
├── MaterialTakeoffManager.tsx (orchestrator, ~200 lines)
├── TakeoffTable.tsx (~400 lines)
├── TakeoffFilters.tsx (~200 lines)
├── TakeoffActions.tsx (~300 lines)
├── TakeoffSummary.tsx (~150 lines)
├── TakeoffExport.tsx (~200 lines)
└── TakeoffModals.tsx (~150 lines)
```

#### 1.2 Custom Hooks

**Create:**
- `hooks/useTakeoffData.ts` - Data fetching and state
- `hooks/useTakeoffFilters.ts` - Filtering logic
- `hooks/useTakeoffSelection.ts` - Selection management
- `hooks/useTakeoffCalculations.ts` - Cost calculations

**Specification:**

**`hooks/useTakeoffData.ts`:**
```typescript
interface UseTakeoffDataReturn {
  takeoffs: MaterialTakeoff[];
  selectedTakeoff: MaterialTakeoff | null;
  loading: boolean;
  error: Error | null;
  fetchTakeoffs: () => Promise<void>;
  selectTakeoff: (takeoff: MaterialTakeoff) => void;
  refreshTakeoffs: () => Promise<void>;
}

export function useTakeoffData(projectSlug: string): UseTakeoffDataReturn
```

**`hooks/useTakeoffFilters.ts`:**
```typescript
interface UseTakeoffFiltersReturn {
  filteredItems: TakeoffLineItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  filterVerified: string;
  setFilterVerified: (verified: string) => void;
  viewMode: 'csi' | 'category';
  setViewMode: (mode: 'csi' | 'category') => void;
}

export function useTakeoffFilters(
  takeoff: MaterialTakeoff | null,
  allTakeoffs: MaterialTakeoff[]
): UseTakeoffFiltersReturn
```

#### 1.3 Utility Functions

**Create:**
- `lib/takeoff-calculations.ts` - Cost calculations, totals, summaries
- `lib/takeoff-formatters.ts` - Formatting for display and export
- `lib/takeoff-grouping.ts` - CSI division and category grouping

**Specification:**

**`lib/takeoff-calculations.ts`:**
```typescript
export function calculateTakeoffTotals(items: TakeoffLineItem[]): {
  totalCost: number;
  totalQuantity: number;
  itemCount: number;
  byCategory: Record<string, CategorySummary>;
}

export function calculateCSIDivisionTotals(
  items: TakeoffLineItem[],
  budgetItems: BudgetItem[]
): CSIDivisionSummary[]

export function calculateCostSummary(
  takeoffs: MaterialTakeoff[]
): CostSummary
```

**`lib/takeoff-formatters.ts`:**
```typescript
export function formatCurrency(amount: number): string
export function formatQuantity(quantity: number, unit: string): string
export function formatCSIDivision(division: CSIDivision): string
export function formatForExport(items: TakeoffLineItem[]): ExportRow[]
```

#### 1.4 Component Specifications

**`components/takeoff/TakeoffTable.tsx`:**

**Props:**
```typescript
interface TakeoffTableProps {
  items: TakeoffLineItem[];
  selectedItems: Set<string>;
  onSelectItem: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onEditItem: (item: TakeoffLineItem) => void;
  onDeleteItem: (id: string) => void;
  viewMode: 'csi' | 'category';
  expandedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
}
```

**Responsibilities:**
- Render line items in table format
- Handle row selection
- Display category/CSI grouping
- Show item details and actions

**`components/takeoff/TakeoffFilters.tsx`:**

**Props:**
```typescript
interface TakeoffFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterCategory: string;
  onCategoryChange: (category: string) => void;
  filterVerified: string;
  onVerifiedChange: (verified: string) => void;
  viewMode: 'csi' | 'category';
  onViewModeChange: (mode: 'csi' | 'category') => void;
  availableCategories: string[];
}
```

**Responsibilities:**
- Search input
- Category filter dropdown
- Verified status filter
- View mode toggle (CSI vs Category)

**`components/takeoff/TakeoffActions.tsx`:**

**Props:**
```typescript
interface TakeoffActionsProps {
  selectedItems: Set<string>;
  takeoff: MaterialTakeoff | null;
  onBulkVerify: () => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onBulkEdit: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
}
```

**Responsibilities:**
- Bulk action buttons
- Export functionality
- Action confirmation dialogs

### Implementation Requirements

1. **Maintain Backward Compatibility**
   - Keep same props interface for `MaterialTakeoffManager`
   - No breaking changes to parent components
   - Same API endpoints usage

2. **Performance Optimization**
   - Use React.memo for table rows
   - Memoize filtered items calculation
   - Lazy load modals
   - Virtual scrolling for large item lists

3. **Type Safety**
   - Remove all `any` types
   - Define proper interfaces for all data structures
   - Add type guards where needed

---

## Phase 2: Chat API Route Refactoring

### Current Route Analysis

**File:** `app/api/chat/route.ts` (1,310 lines)

**Responsibilities:**
- Authentication and authorization
- Rate limiting
- Query validation
- Document retrieval (RAG)
- LLM processing
- Response streaming
- Conversation management
- Error handling

**Main Sections:**
1. Middleware (auth, rate limit, validation) - ~200 lines
2. Context building (RAG, enhancements) - ~400 lines
3. LLM processing - ~300 lines
4. Response streaming - ~200 lines
5. Error handling - ~200 lines

### Refactoring Specification

#### 2.1 Middleware Extraction

**Create:** `lib/chat/middleware/`

**Files:**
- `lib/chat/middleware/auth-check.ts`
- `lib/chat/middleware/rate-limit-check.ts`
- `lib/chat/middleware/query-validation.ts`
- `lib/chat/middleware/maintenance-check.ts`

**Specification:**

**`lib/chat/middleware/auth-check.ts`:**
```typescript
export interface AuthCheckResult {
  session: Session | null;
  userId: string | null;
  userRole: 'admin' | 'client' | 'guest' | 'pending';
  projectId: string | null;
}

export async function checkAuth(
  request: NextRequest,
  projectSlug: string
): Promise<AuthCheckResult>
```

**`lib/chat/middleware/rate-limit-check.ts`:**
```typescript
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number;
}

export async function checkRateLimit(
  userId: string | null,
  clientIp: string
): Promise<RateLimitResult>
```

#### 2.2 Processor Extraction

**Create:** `lib/chat/processors/`

**Files:**
- `lib/chat/processors/context-builder.ts`
- `lib/chat/processors/llm-handler.ts`
- `lib/chat/processors/response-streamer.ts`
- `lib/chat/processors/conversation-manager.ts`

**Specification:**

**`lib/chat/processors/context-builder.ts`:**
```typescript
export interface ContextBuilderOptions {
  message: string;
  projectSlug: string;
  userRole: string;
  retrievalLimit?: number;
}

export interface BuiltContext {
  chunks: EnhancedChunk[];
  contextPrompt: string;
  retrievalLog: string[];
}

export async function buildContext(
  options: ContextBuilderOptions
): Promise<BuiltContext>
```

**`lib/chat/processors/llm-handler.ts`:**
```typescript
export interface LLMHandlerOptions {
  message: string;
  context: BuiltContext;
  conversationId: string | null;
  projectSlug: string;
}

export interface LLMResponse {
  stream: ReadableStream;
  model: string;
  tokensUsed?: number;
}

export async function handleLLMRequest(
  options: LLMHandlerOptions
): Promise<LLMResponse>
```

#### 2.3 Utility Extraction

**Create:** `lib/chat/utils/`

**Files:**
- `lib/chat/utils/query-classifier.ts`
- `lib/chat/utils/follow-up-generator.ts`
- `lib/chat/utils/response-formatter.ts`

**Specification:**

**`lib/chat/utils/query-classifier.ts`:**
```typescript
export interface QueryClassification {
  type: 'counting' | 'measurement' | 'calculation' | 'general';
  retrievalLimit: number;
  needsWebSearch: boolean;
}

export function classifyQuery(message: string): QueryClassification
```

### Refactored Route Structure

**Target:** `app/api/chat/route.ts` (~200-300 lines)

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Maintenance check
    await checkMaintenance();
    
    // 2. Auth check
    const auth = await checkAuth(request, projectSlug);
    
    // 3. Rate limit check
    const rateLimit = await checkRateLimit(auth.userId, clientIp);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }
    
    // 4. Query validation
    const validation = await validateQuery(body);
    if (!validation.valid) {
      return validationError(validation);
    }
    
    // 5. Build context
    const context = await buildContext({
      message,
      projectSlug,
      userRole: auth.userRole,
    });
    
    // 6. Handle LLM request
    const llmResponse = await handleLLMRequest({
      message,
      context,
      conversationId,
      projectSlug,
    });
    
    // 7. Stream response
    return streamResponse(llmResponse);
    
  } catch (error) {
    return handleError(error);
  }
}
```

---

## Phase 3: Project Page Refactoring

### Current Page Analysis

**File:** `app/project/[slug]/page.tsx` (1,225+ lines)

**Responsibilities:**
- Project data fetching
- Multiple modal states (15+ modals)
- Navigation between features
- Feature ribbon management
- Mobile/desktop layout switching

### Refactoring Specification

#### 3.1 Component Extraction

**Create:**
- `components/project/ProjectHeader.tsx`
- `components/project/ProjectNavigation.tsx`
- `components/project/ProjectModals.tsx`
- `components/project/ProjectContent.tsx`

#### 3.2 Hook Extraction

**Create:** `hooks/useProjectPage.ts`

**Specification:**
```typescript
interface UseProjectPageReturn {
  project: Project | null;
  loading: boolean;
  modals: ModalState;
  openModal: (modal: ModalType) => void;
  closeModal: (modal: ModalType) => void;
  activeFeature: string | null;
  setActiveFeature: (feature: string | null) => void;
}

export function useProjectPage(slug: string): UseProjectPageReturn
```

---

## Phase 4: TypeScript Type Improvements

### Current `any` Types to Fix

1. **`lib/email-service.ts`**
   - Line 112: `errorData: any`
   - **Fix:** Create `EmailErrorData` interface

2. **`components/material-takeoff-manager.tsx`**
   - Line 142: `costSummary: any`
   - Line 143: `mepData: any`
   - Line 145: `budgetItems: any[]`
   - **Fix:** Create proper interfaces

3. **`components/annotation-browser.tsx`**
   - Line 361: `as any` in Tabs
   - **Fix:** Proper type for view value

4. **`components/dimension-browser.tsx`**
   - Line 340: `as any` in Tabs
   - **Fix:** Proper type for view value

5. **`lib/report-finalization.ts`**
   - Line 959: `reportData as any`
   - **Fix:** Create `ReportData` interface

### Type Definitions Required

**Create:** `types/takeoff.ts`
```typescript
export interface CostSummary {
  totalCost: number;
  byCategory: Record<string, number>;
  byCSI: Record<string, number>;
  itemCount: number;
}

export interface MEPData {
  items: MEPItem[];
  totalCost: number;
  itemsCreated: number;
}

export interface BudgetItem {
  id: string;
  costCode: string;
  description: string;
  amount: number;
  category: string;
  // ... other fields
}
```

**Create:** `types/report.ts`
```typescript
export interface ReportData {
  date: string;
  weatherCondition?: string;
  workPerformed?: string;
  crewCount?: number;
  photos?: string[];
  // ... other fields
}
```

---

## Phase 5: Error Handling Standardization

### Standard Error Handler

**Create:** `lib/api-error-handler.ts`

**Specification:**
```typescript
export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export class ApiErrorHandler {
  static handle(error: unknown): NextResponse<ApiError>
  static handleDatabaseError(error: unknown): NextResponse<ApiError>
  static handleValidationError(error: unknown): NextResponse<ApiError>
  static handleAuthError(error: unknown): NextResponse<ApiError>
  static handleRateLimitError(error: unknown): NextResponse<ApiError>
}
```

### Error Response Format

**Standard Format:**
```typescript
{
  error: string;           // User-friendly message
  code: string;            // Error code (e.g., "VALIDATION_ERROR")
  statusCode: number;     // HTTP status code
  details?: {              // Optional technical details (dev only)
    field?: string;
    expected?: string;
    received?: string;
  };
  retryAfter?: number;     // For rate limit errors
}
```

### Routes to Update

**Priority Routes:**
1. `app/api/projects/[slug]/route.ts`
2. `app/api/documents/upload/route.ts`
3. `app/api/dashboard/route.ts`
4. All routes in `app/api/projects/[slug]/`

---

## Phase 6: Code Quality Improvements

### Component Optimization

**Target Components:**
- Large list components (use React.memo)
- Table rows (virtualize if >100 items)
- Modal components (lazy load)

**Specification:**
```typescript
// Example: Memoized table row
const TakeoffTableRow = React.memo(({ item, onEdit, onDelete }) => {
  // Component logic
}, (prevProps, nextProps) => {
  return prevProps.item.id === nextProps.item.id &&
         prevProps.item.verified === nextProps.item.verified;
});
```

### Documentation Requirements

**JSDoc Comments Required For:**
- All exported functions
- Complex algorithms
- API route handlers
- Custom hooks

**Format:**
```typescript
/**
 * Calculates total cost for a set of takeoff line items
 * 
 * @param items - Array of takeoff line items
 * @returns Object containing total cost, quantity, and item count
 * 
 * @example
 * const totals = calculateTakeoffTotals(lineItems);
 * console.log(totals.totalCost); // 125000.50
 */
export function calculateTakeoffTotals(items: TakeoffLineItem[]): TakeoffTotals
```

---

## Testing Requirements

### Unit Tests

**Create:** `__tests__/` directory structure

**Required Tests:**
- `__tests__/lib/takeoff-calculations.test.ts`
- `__tests__/lib/takeoff-formatters.test.ts`
- `__tests__/hooks/useTakeoffData.test.ts`
- `__tests__/lib/chat/utils/query-classifier.test.ts`

### Integration Tests

**Required Tests:**
- `__tests__/api/chat/route.test.ts`
- `__tests__/components/takeoff/TakeoffTable.test.tsx`

### Test Framework

- **Framework:** Vitest or Jest
- **React Testing:** @testing-library/react
- **Coverage Target:** 60% for new code

---

## Implementation Timeline

### Week 1: Material Takeoff Manager
- Days 1-2: Extract hooks and utilities
- Days 3-4: Create sub-components
- Day 5: Integration and testing

### Week 2: Chat API Route
- Days 1-2: Extract middleware
- Days 3-4: Extract processors
- Day 5: Refactor main route

### Week 3: Project Page & Types
- Days 1-2: Refactor project page
- Days 3-4: Fix TypeScript types
- Day 5: Testing

### Week 4: Error Handling & Polish
- Days 1-2: Standardize error handling
- Days 3-4: Component optimization
- Day 5: Documentation

---

## Success Criteria

### Quantitative Metrics

1. **File Size Reduction:**
   - `material-takeoff-manager.tsx`: 2,165 → <500 lines per component
   - `app/api/chat/route.ts`: 1,310 → <300 lines
   - `app/project/[slug]/page.tsx`: 1,225 → <400 lines

2. **Type Safety:**
   - Zero `any` types in active code
   - 100% TypeScript strict mode compliance

3. **Error Handling:**
   - 100% of API routes use standard error handler
   - Consistent error response format

4. **Test Coverage:**
   - 60% coverage for new/refactored code
   - All critical paths tested

### Qualitative Metrics

1. **Maintainability:**
   - Components <500 lines
   - Clear separation of concerns
   - Easy to understand and modify

2. **Performance:**
   - No performance regressions
   - Improved render times for large lists
   - Faster initial load

3. **Developer Experience:**
   - Clear component structure
   - Well-documented code
   - Easy to add new features

---

## Risk Assessment

### High Risk Areas

1. **Breaking Changes**
   - **Risk:** Refactoring may break existing functionality
   - **Mitigation:** Comprehensive testing, gradual rollout

2. **Performance Regression**
   - **Risk:** Component splitting may impact performance
   - **Mitigation:** Performance testing, React.memo usage

3. **Type Errors**
   - **Risk:** Fixing `any` types may reveal hidden bugs
   - **Mitigation:** Incremental fixes, thorough testing

### Low Risk Areas

1. **Error Handling Standardization**
   - Low risk, high value
   - Easy to roll back if issues

2. **Documentation**
   - No risk to functionality
   - Pure improvement

---

## Dependencies

### External Dependencies
- No new dependencies required
- Use existing React, Next.js, TypeScript

### Internal Dependencies
- Prisma schema (no changes needed)
- Existing utility functions
- Current API structure

---

## Rollback Plan

### If Issues Arise

1. **Git Revert**
   - Each phase committed separately
   - Easy to revert individual phases

2. **Feature Flags**
   - Consider feature flags for new components
   - Gradual rollout possible

3. **Monitoring**
   - Monitor error rates after deployment
   - Watch performance metrics

---

## Appendix

### File Structure After Refactoring

```
foremanos/
├── components/
│   ├── takeoff/
│   │   ├── MaterialTakeoffManager.tsx
│   │   ├── TakeoffTable.tsx
│   │   ├── TakeoffFilters.tsx
│   │   ├── TakeoffActions.tsx
│   │   ├── TakeoffSummary.tsx
│   │   ├── TakeoffExport.tsx
│   │   └── TakeoffModals.tsx
│   └── project/
│       ├── ProjectHeader.tsx
│       ├── ProjectNavigation.tsx
│       ├── ProjectModals.tsx
│       └── ProjectContent.tsx
├── hooks/
│   ├── useTakeoffData.ts
│   ├── useTakeoffFilters.ts
│   ├── useTakeoffSelection.ts
│   ├── useTakeoffCalculations.ts
│   └── useProjectPage.ts
├── lib/
│   ├── takeoff-calculations.ts
│   ├── takeoff-formatters.ts
│   ├── takeoff-grouping.ts
│   ├── api-error-handler.ts
│   └── chat/
│       ├── middleware/
│       │   ├── auth-check.ts
│       │   ├── rate-limit-check.ts
│       │   ├── query-validation.ts
│       │   └── maintenance-check.ts
│       ├── processors/
│       │   ├── context-builder.ts
│       │   ├── llm-handler.ts
│       │   ├── response-streamer.ts
│       │   └── conversation-manager.ts
│       └── utils/
│           ├── query-classifier.ts
│           ├── follow-up-generator.ts
│           └── response-formatter.ts
└── types/
    ├── takeoff.ts
    ├── report.ts
    └── api-errors.ts
```

### Code Examples

See individual component specifications above for detailed code examples.

---

## Approval

**Prepared by:** Claude (AI Assistant)  
**Review Status:** Pending  
**Next Steps:** Review and approve plan, then begin Phase 1 implementation
