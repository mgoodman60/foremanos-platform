# UX/UI Audit Phase 2: Deferred Work

## Context

Phase 1 (completed) fixed 6 WCAG AA contrast failures in UI primitives, replaced ~310 hardcoded hex values across 29 authenticated-page files, added `client-primary`/`client-primary-dark` Tailwind aliases, and added 19 regression tests. This phase covers the remaining ~200 hex refs, canvas/SVG colors, keyboard navigation, and form accessibility gaps.

---

## Team: `ux-ui-audit-phase2`

| Teammate | Agent Type | Role | File Count |
|----------|-----------|------|------------|
| **token-remaining-components** | `coder` | Replace hardcoded hex in remaining feature components | ~20 files |
| **token-canvas-svg** | `coder` | Replace hex in Canvas/SVG/Recharts contexts with JS constants | ~10 files |
| **a11y-keyboard-forms** | `ui` | Add keyboard navigation to tables, aria-describedby to forms | ~8 files |
| **qa-tester** | `tester` | Extend regression tests, run full verification | Test files only |

---

## Workstream 1: Remaining Component Token Compliance (~200 hex refs)

### Token Replacement Rules (same as Phase 1)

| Hardcoded | Tailwind Class |
|-----------|---------------|
| `text-[#F8FAFC]` | `text-slate-50` |
| `text-[#F97316]` / `bg-[#F97316]` | `text-orange-500` / `bg-orange-500` |
| `hover:bg-[#EA580C]` | `hover:bg-orange-600` |
| `border-[#F97316]` | `border-orange-500` |
| `focus:ring-[#F97316]` | `focus:ring-orange-500` |
| `bg-[#003B71]` | `bg-client-primary` |
| `hover:bg-[#002855]` | `hover:bg-client-primary-dark` |
| `hover:bg-[#3d434b]` | `hover:bg-dark-hover` |
| `bg-[#2d333b]` | `bg-dark-card` |
| `bg-[#1F2328]` | `bg-dark-surface` |

### Files (token-remaining-components)

| File | Hex Count |
|------|-----------|
| `components/phase3-dashboard.tsx` | 23 |
| `components/room-browser.tsx` | 23 |
| `components/takeoff-learning-panel.tsx` | 19 |
| `components/schedule-progress-ribbon.tsx` | 16 |
| `components/takeoff-line-item-edit-modal.tsx` | 14 |
| `components/mep-equipment-browser.tsx` | 13 |
| `components/unit-price-manager.tsx` | 12 |
| `components/photo-library.tsx` | 11 |
| `components/takeoff-add-item-modal.tsx` | 11 |
| `components/admin/user-management.tsx` | 9 |
| `components/schedule/schedule-health-analyzer.tsx` | 9 |
| `components/schedule/gantt-chart.tsx` | 7 |
| `components/earthwork-calculator.tsx` | 8 |
| `components/schedule/export-settings-modal.tsx` | 6 |
| `components/takeoff-summary-modal.tsx` | 6 |
| `components/takeoff/TakeoffTable.tsx` | 6 |
| `components/takeoff/TakeoffFilters.tsx` | 5 |
| `components/scope-gap-analysis.tsx` | 5 |
| `components/photo-timeline.tsx` | 5 |
| `components/drawing-classification-browser.tsx` | 4 |
| `components/quick-capture-modal.tsx` | 4 |
| `components/plan-viewer-selector.tsx` | 4 (verify — may have been partially done in Phase 1) |
| `components/schedule/schedule-filters.tsx` | 4 |
| `components/schedule-update-review-modal.tsx` | 3 |
| `components/template-export-dialog.tsx` | 3 |
| `components/subcontractor-quotes.tsx` | 3 |
| `components/material-takeoff-manager.tsx` | 3 |
| `components/takeoff/TakeoffSummary.tsx` | 3 |
| `components/viewer/element-properties-panel.tsx` | 3 |
| `components/field-ops/ProjectHealthWidget.tsx` | 3 |

Plus ~15 files with 1-2 refs each (annotation-browser, detail-navigator, dimension-browser, job-cost-report, tools-menu, viewer/*, field-ops/*, etc.)

**Split suggestion**: Two agents, ~20 files each, sorted by hex count. Agent 1 takes the top 15 (heaviest), Agent 2 takes the remaining ~25 (lighter).

---

## Workstream 2: Canvas/SVG/Recharts Hex Colors

These files use hex values in JavaScript contexts (Canvas2D `.fillStyle`, SVG `stroke`/`fill`, Recharts component props) where Tailwind classes don't apply. Instead, import constants from `lib/design-tokens.ts` or `lib/chart-theme.ts`.

### Approach
1. Remove the "DO NOT import" comment from `lib/design-tokens.ts`
2. Import `chartColors`, `primaryColors`, or `semanticColors` from design-tokens where needed
3. Replace inline hex strings with imported constants

### Files (token-canvas-svg)

| File | Hex Count | Context |
|------|-----------|---------|
| `components/data-visualization.tsx` | 3 | Recharts stroke/fill props |
| `components/interactive-plan-viewer.tsx` | 4 | Canvas2D fillStyle/strokeStyle |
| `components/floor-plan-viewer.tsx` | 2 | Canvas2D context |
| `components/viewer/markup-tools.tsx` | 1 | SVG stroke |
| `components/viewer/measurement-tools.tsx` | 1 | SVG/Canvas |
| `components/viewer/section-tools.tsx` | 1 | SVG |
| `components/viewer/model-element-tree.tsx` | 1 | Inline style |
| `components/viewer/bim-data-panel.tsx` | 2 | Inline style |

### Also check (may have Recharts hex):
- `components/evm-dashboard.tsx` — chart section (Phase 1 did Tailwind classes but may have Recharts props)
- `components/schedule-progress-ribbon.tsx` — progress bar inline styles
- `components/budget/CostForecastWidget.tsx`
- `components/budget/BudgetDashboard.tsx`

---

## Workstream 3: Keyboard Navigation & Form Accessibility

### Task 1: Document Library Table Keyboard Navigation
**File**: `components/document-library.tsx`
- Add `aria-sort` attributes to sortable column headers
- Add keyboard row selection (arrow keys to navigate, Enter/Space to select)
- Add `role="grid"` or keep `role="table"` with proper `role="row"` and `role="cell"`

### Task 2: Universal aria-describedby on Forms
Audit all form components and ensure:
- Every input has an associated `<label>` via `htmlFor`
- Error messages use `aria-describedby` linkage
- Help text uses `aria-describedby` linkage

**Files to audit**:
- `components/budget-setup-modal.tsx`
- `components/crew-performance-form.tsx`
- `components/finalization-settings-modal.tsx`
- `components/weather-preferences-modal.tsx`
- `components/guest-credential-modal.tsx`
- `components/onboarding-wizard.tsx`
- All `components/field-ops/*` forms

### Task 3: Sortable Column Headers
Any component with sortable tables should have:
- `aria-sort="ascending"` / `aria-sort="descending"` / `aria-sort="none"` on `<th>` elements
- Keyboard trigger (Enter/Space) for sort toggling

**Files to check**:
- `components/document-library.tsx`
- `components/takeoff/TakeoffTable.tsx`
- `components/mep-equipment-browser.tsx`
- `components/unit-price-manager.tsx`

---

## Workstream 4: Testing

### New Tests to Write
1. Extend `__tests__/ui/hex-audit.test.ts` to scan ALL component files (not just UI primitives)
2. Add form accessibility tests asserting `aria-describedby` associations
3. Add keyboard navigation E2E tests for document-library table

### Verification
- `npm run build` — zero errors
- `npm test -- --run` — all tests pass
- `npx playwright test e2e/accessibility.spec.ts --project=chromium`

---

## Execution Order

```
Phase 1:  token-remaining-components (solo or split into 2 agents)
          token-canvas-svg (parallel — different files)
          a11y-keyboard-forms (parallel — different files)
          qa-tester writes extended tests concurrently

Phase 2:  qa-tester runs full verification after all agents complete
```

**No file overlap** between workstreams. token-remaining-components owns Tailwind-class files. token-canvas-svg owns Canvas/SVG/Recharts files. a11y-keyboard-forms owns table/form structure changes.

---

## Project-Scoped Pages Not Yet Addressed

These authenticated project sub-pages may also have hex values or accessibility gaps (lower priority, check during execution):

| Route | File |
|-------|------|
| `/project/[slug]/integrations` | `app/project/[slug]/integrations/page.tsx` (8 refs) |
| `/project/[slug]/contracts` | `app/project/[slug]/contracts/page.tsx` (14 refs) |
| `/project/[slug]/templates` | `app/project/[slug]/templates/page.tsx` (12 refs) |
| `/project/[slug]/subcontractors` | `app/project/[slug]/subcontractors/page.tsx` (10 refs) |
| `/project/[slug]/schedules` | `app/project/[slug]/schedules/page.tsx` (9 refs) |
| `/project/[slug]/evm` | `app/project/[slug]/evm/page.tsx` (8 refs) |
| `/project/[slug]/takeoffs` | `app/project/[slug]/takeoffs/page.tsx` (5 refs) |
| `/project/[slug]/executive` | `app/project/[slug]/executive/page.tsx` (1 ref) |
| `/project/[slug]/crews` | `app/project/[slug]/crews/page.tsx` (1 ref) |

These should be added to the token-remaining-components agent's file list.
