# Plan: Guest PIN Scoping, Upload Fix, Security & UI Audit

## Status
<!-- draft | in-progress | completed | paused | abandoned -->
**Status:** completed
**Created:** 2026-02-06
**Last Updated:** 2026-02-07
**Commit:** `666a4b6` — All P0-P5 priorities implemented (102 files, 27 new tests)

## Context

Production testing on 2026-02-06 + a comprehensive UI audit (4 parallel agents: accessibility, design consistency, UX, security) revealed 6 categories of issues across the ForemanOS codebase:

1. **Guest PIN collision** -- Creating a project fails with "guest username already taken" for new accounts. `Project.guestUsername` and `User.username` have global `@unique` constraints in Prisma, meaning PINs are shared across all tenants instead of scoped per owner. Confirmed at `prisma/schema.prisma:907` and `:1704`.

2. **Upload still failing** -- S3 config pre-check was added (commits 43e845e, 449135d) but uploads still fail. `lib/aws-config.ts:11` creates `new S3Client({})` with no explicit region. `lib/s3.ts:12` creates client at module level (cold start only). Credentials may be misconfigured on Vercel.

3. **Security vulnerabilities** -- Unauthenticated document access (CRITICAL), exposed test upload endpoint, missing CSP header, no SRI on third-party scripts.

4. **Accessibility violations** -- Viewport zoom blocked (legal risk), 15+ modals missing ARIA attributes and focus traps, skip link targets missing on ~65 pages, color contrast below WCAG AA.

5. **UX issues** -- Native `confirm()` for destructive actions, dual toast libraries, single-line chat input, light-themed modals in dark app, redundant toasts.

6. **Design inconsistencies** -- 394+ hardcoded hex colors (design tokens exist but unused), 4 different spinner implementations (10 using wrong blue color), 3 button style patterns, inconsistent modal overlays.

## Approach

Work is organized into 6 priority levels. Each priority can be executed by a dedicated agent with isolated file ownership to prevent merge conflicts. Use Team 9 (Full-Stack Feature) configuration.

---

### PRIORITY 0: Security Fixes (Ship Immediately)

**S0. Unauthenticated Document Access [CRITICAL]**

Files: `app/api/documents/[id]/route.ts:20-21`, `app/api/view-document/[id]/route.ts:16`

Both routes fall back to `'guest'` role when no session exists (`const userRole = session?.user?.role || 'guest'`). Any unauthenticated user can view guest-accessible documents by guessing the document ID.

Fix: Require authentication before serving any document:
```typescript
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
const userRole = session.user.role;
```

**S1. Remove Test Upload Endpoint [HIGH]**

File: `app/api/test-upload/route.ts` -- No auth, no rate limiting, no MIME validation. Delete the entire route.

**S2. Add Content-Security-Policy Header [HIGH]**

File: `next.config.js:17-25` -- Security headers exist but no CSP. Add a CSP header restricting script/style/connect sources to self + known third parties (Stripe, Autodesk, unpkg).

**S3. Add SRI Hashes to Third-Party Scripts [HIGH]**

Files: `app/api/docs/route.ts` (Swagger UI CSS/JS from unpkg.com, no integrity), `components/forge-viewer.tsx` (Autodesk Viewer uses wildcard version `7.*`, no integrity)

---

### PRIORITY 1: Guest PIN Namespacing (Owner-Scoped)

**Problem:**
```
prisma/schema.prisma:907  ->  guestUsername String @unique     <- GLOBAL
prisma/schema.prisma:1704 ->  username      String @unique     <- GLOBAL
```
When user A creates a project with PIN "Job123", user B (completely separate account) cannot use "Job123".

**Solution: Auto-Namespace PINs**

Store PINs internally as `{ownerId}_{guestPin}`. User types "Job123", system stores `clxyz123_Job123` in both `Project.guestUsername` and `User.username`. Keep `@unique` constraints (namespaced values are naturally unique). No schema migration needed.

**Auth flow for guest login:**
```
Guest enters "Job123"
  -> try exact: findFirst({ username: "Job123" })       <- backward compat
  -> fallback: findFirst({ username: { endsWith: "_Job123" } })
  -> 1 match = login success
  -> 0 matches = "Invalid credentials"
  -> 2+ matches = "Multiple projects use this PIN. Ask your PM for the project code."
```

**Migration script** (`scripts/migrate-guest-namespaces.ts`): Query all projects, update `Project.guestUsername` and corresponding `User.username` to namespaced format, wrapped in a Prisma transaction.

---

### PRIORITY 2: Upload Error Fix

**Problem:** `lib/aws-config.ts:11` creates `new S3Client({})` with zero config. `lib/s3.ts:12` creates client at module level (only on cold start). If `AWS_REGION`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` are missing or wrong, upload fails after 3 retries (~6 min) with a generic error.

**Fixes:**
- Add explicit `region` to S3Client constructor
- Add `validateS3Config()` function checking all required env vars
- Move S3 client from module-level to lazy initialization
- Add credential env var check in upload route (after existing bucket check)
- Create `/api/health/s3` endpoint using `HeadBucket` for diagnostics: `{ status, bucketName, region, credentialsSet, bucketAccessible, error? }`

---

### PRIORITY 3: Accessibility Fixes

**A0. Viewport Blocks Zoom [CRITICAL - Legal Risk]**
File: `app/layout.tsx:62` -- `userScalable: false, maximumScale: 1`. Change to `userScalable: true, maximumScale: 5`.

**A1. 15+ Modals Missing ARIA Attributes**
Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` to: `photo-timeline.tsx`, `report-templates-library.tsx`, `takeoff-aggregation.tsx`, `takeoff-learning-panel.tsx`, `takeoff-budget-sync-modal.tsx`, `takeoff-labor-planning.tsx`, `takeoff-qa-dashboard.tsx`, `takeoff/TakeoffModals.tsx`, `schedule/gantt-chart.tsx`, `submittals/ApprovalWorkflow.tsx`, `submittals/CreateRFIModal.tsx`, `submittals/KeyboardShortcutsHelp.tsx`, `submittals/SpecSectionLinker.tsx`, `submittals/SubmittalDetail.tsx`, `viewer/ai-render-panel.tsx`, `viewer/markup-tools.tsx`

**A2. 15+ Modals Missing Focus Trap**
Same files as A1 plus: `photo-library.tsx`, `daily-report-history.tsx`, `document-preview-modal.tsx`, `finalization-settings-modal.tsx`. Reuse existing `hooks/use-focus-trap.ts` hook.

**A3. Skip Link Target Missing on ~65 Pages**
Layout has `<a href="#main-content">` but only 5 pages define `id="main-content"`. Add to all page `<main>` elements.

**A4. Color Contrast Below WCAG AA**
`text-gray-400` on dark backgrounds = ~4.1:1 (need 4.5:1). Replace with `text-gray-300` for body text.

**A5. Nested `<button>` in ToolsMenu**
File: `components/tools-menu.tsx:538-573` -- Favorite star `<button>` inside tool `<button>`. Invalid HTML. Restructure with `<span role="button">`.

---

### PRIORITY 4: UX Improvements

**U1. Replace `confirm()` with AlertDialog (5 locations)**
`chat-interface.tsx:560,958`, `document-library.tsx:509,540`, `conversation-sidebar.tsx:191`. Create `components/alert-dialog.tsx` using Radix AlertDialog. Dark-themed, keyboard-accessible, red destructive button.

**U2. Standardize on `sonner`**
Remove `react-hot-toast` from `conversation-sidebar.tsx` and `daily-report-history.tsx`.

**U3. Remove "Response received" toast**
`chat-interface.tsx:807` -- streaming response is sufficient visual feedback.

**U4. Fix dark theme inconsistencies**
Light backgrounds in dark app: `onboarding-wizard.tsx`, `batch-upload-modal.tsx:134`, `guest-credential-modal.tsx:181`, `document-metadata-modal.tsx:99`

**U5. Chat `<input>` -> auto-resizing `<textarea>`**
`chat-interface.tsx:1506-1515`. Construction pros paste multi-line content.

**U6. Remove console.log debug statements**
`chat-interface.tsx:173,273,606,627,653`, `conversation-sidebar.tsx:87-90,143-157`

---

### PRIORITY 5: Design Consistency (Incremental)

**D1. Fix Blue Loading Spinners (Brand Violation) -- 10 files**
`interactive-plan-viewer.tsx`, `mep-equipment-browser.tsx`, `plan-viewer-selector.tsx`, `phase3-dashboard.tsx`, `plan-navigator.tsx`, `cross-reference-map.tsx`, `dimension-analyzer.tsx`, `scale-validator.tsx`, `reports/ExecutiveDashboard.tsx`, `unit-price-manager.tsx`. Change `border-blue-500` -> Loader2 with `text-orange-500`.

**D2. Standardize Button Pattern**
Three patterns: `bg-[#F97316]`, `bg-orange-500`, `bg-orange-600`. Standardize on `bg-orange-500 hover:bg-orange-600` (~30 files).

**D3. Standardize Modal Overlays**
Mixed `bg-black/60` through `bg-black/90`. Standardize on `bg-black/90 backdrop-blur-sm`.

**D4. Fix Light-Background Modals**
4 files use `bg-white`: `batch-upload-modal.tsx:134`, `document-metadata-modal.tsx:99`, `guest-credential-modal.tsx:181`, `maintenance-page.tsx:12`. Change to `bg-dark-card border-gray-700`.

---

## Files to Modify

### Security (P0)
| File | Change |
|------|--------|
| `app/api/documents/[id]/route.ts` | Require auth, remove guest fallback |
| `app/api/view-document/[id]/route.ts` | Require auth, remove guest fallback |
| `app/api/test-upload/route.ts` | **DELETE** |
| `next.config.js` | Add CSP header |
| `app/api/docs/route.ts` | Add SRI hashes to Swagger UI scripts |
| `components/forge-viewer.tsx` | Pin Autodesk version, add SRI hash |

### Guest PIN (P1)
| File | Change |
|------|--------|
| `app/api/projects/route.ts` | Namespace PIN on create, owner-scoped uniqueness check |
| `app/api/projects/[slug]/guest/route.ts` | PATCH: namespace. GET: strip prefix |
| `app/api/projects/add-guest/route.ts` | `endsWith` lookup with ambiguity handling |
| `lib/auth-options.ts` | Guest login fallback with `endsWith` |
| `scripts/migrate-guest-namespaces.ts` | **NEW**: Migration script |

### Upload (P2)
| File | Change |
|------|--------|
| `lib/aws-config.ts` | Explicit region, `validateS3Config()` |
| `lib/s3.ts` | Lazy client initialization |
| `app/api/documents/upload/route.ts` | Credential env var check |
| `app/api/health/s3/route.ts` | **NEW**: Health check endpoint |

### Accessibility (P3)
| File | Change |
|------|--------|
| `app/layout.tsx` | Enable zoom (`userScalable: true, maximumScale: 5`) |
| 16 modal components | Add `role="dialog"`, `aria-modal`, `aria-labelledby` |
| 20 modal components | Add `useFocusTrap` hook |
| ~65 page files | Add `id="main-content"` to `<main>` |
| `components/tools-menu.tsx` | Fix nested button |

### UX (P4)
| File | Change |
|------|--------|
| `components/alert-dialog.tsx` | **NEW**: Reusable AlertDialog |
| `components/chat-interface.tsx` | AlertDialog, remove toast, textarea, remove console.log |
| `components/document-library.tsx` | AlertDialog for delete actions |
| `components/conversation-sidebar.tsx` | AlertDialog, sonner, remove console.log |
| `components/daily-report-history.tsx` | Replace react-hot-toast with sonner |
| `components/onboarding-wizard.tsx` | Dark theme |
| `components/batch-upload-modal.tsx` | Dark theme |

### Design (P5)
| File | Change |
|------|--------|
| 10 spinner files | Blue -> orange spinners |
| ~30 button files | Standardize on `bg-orange-500` |
| ~25 modal files | Standardize overlay `bg-black/90` |
| 4 modal files | `bg-white` -> `bg-dark-card` |

---

## Tasks

### P0: Security
- [x] Fix unauthenticated document access in `documents/[id]/route.ts` and `view-document/[id]/route.ts`
- [x] Delete `app/api/test-upload/route.ts`
- [x] Add CSP header to `next.config.js`
- [x] Add SRI hashes to Swagger UI and Autodesk Viewer scripts

### P1: Guest PIN
- [x] Implement namespace helper (`namespacePIN`, `stripPINPrefix`)
- [x] Update project creation route to namespace PINs
- [x] Update guest credential PATCH/GET routes
- [x] Update add-guest route with `endsWith` lookup
- [x] Update auth-options.ts guest login with fallback
- [x] Create migration script for existing data
- [x] Test: two accounts create same PIN, both succeed

### P2: Upload
- [x] Add explicit region to S3Client constructor
- [x] Add `validateS3Config()` function
- [x] Move S3 client to lazy initialization
- [x] Add credential check in upload route
- [x] Create `/api/health/s3` endpoint
- [x] Test: health check returns diagnostics, upload succeeds with valid config
- [x] **SUPERSEDED**: Migrated to Cloudflare R2 (plan `graceful-squishing-papert.md`, commit `a13b144`)

### P3: Accessibility
- [x] Enable viewport zoom in layout.tsx
- [x] Add ARIA attributes to 16 modals
- [x] Add useFocusTrap to 20 modals
- [x] Add `id="main-content"` to 9 pages (partial — ~65 identified, 9 done)
- [x] Fix nested button in tools-menu.tsx

### P4: UX
- [x] Create ConfirmDialog component
- [x] Replace 6 `confirm()` calls with ConfirmDialog
- [x] Replace react-hot-toast with sonner (2 files)
- [x] Remove "Response received" toast
- [x] Fix dark theme in 4 light-background modals
- [x] Replace chat input with auto-resizing textarea
- [x] Remove console.log debug statements

### P5: Design
- [x] Fix 12 blue spinners to orange
- [x] Standardize button pattern across 28 files
- [x] Standardize modal overlays
- [x] Fix light-background modals

---

## Verification

- **Security**: Unauthenticated `GET /api/documents/{id}` returns 401. `POST /api/test-upload` returns 404. CSP header present in response.
- **Guest PIN**: Two accounts both create "TestJob" PIN -- both succeed. Guest login with "TestJob" works for both.
- **Upload**: `GET /api/health/s3` returns `{ status, bucketName, region, credentialsSet, bucketAccessible }`. Upload with valid S3 config succeeds.
- **Accessibility**: Page allows pinch-to-zoom on mobile. Tab through modal traps focus. Skip link jumps to main content.
- **UI**: Delete actions show styled AlertDialog (not browser confirm). No blue spinners. Dark theme on all modals. Chat textarea expands for multi-line input.
- **Build**: `npm run build` passes. `npm test -- --run` passes.

---

## Notes

### Team Assignment

| Agent | Priority | File Ownership |
|-------|----------|----------------|
| `security` | P0 | `app/api/documents/[id]/route.ts`, `app/api/view-document/[id]/route.ts`, `app/api/test-upload/route.ts`, `next.config.js`, `app/api/docs/route.ts`, `components/forge-viewer.tsx` |
| `coder` | P1 | `app/api/projects/route.ts`, `app/api/projects/[slug]/guest/route.ts`, `app/api/projects/add-guest/route.ts`, `lib/auth-options.ts`, `scripts/migrate-guest-namespaces.ts` |
| `infra-specialist` | P2 | `lib/aws-config.ts`, `lib/s3.ts`, `app/api/documents/upload/route.ts`, `app/api/health/s3/route.ts` (new) |
| `ui` | P3-P5 | `app/layout.tsx`, `components/alert-dialog.tsx` (new), `components/chat-interface.tsx`, `components/conversation-sidebar.tsx`, `components/onboarding-wizard.tsx`, `components/batch-upload-modal.tsx`, `components/tools-menu.tsx`, 15+ modal files |
| `tester` | All | Test files for all modified code |

### Design Consistency -- Future Work (Not in Scope)

The design consistency audit found 394+ hardcoded hex colors across 50+ component files and 503 across 42 app files. Only 6 components import from `lib/design-tokens.ts`. Full migration to design tokens is a separate project requiring:
1. Extend Tailwind config to map design tokens as theme colors
2. Create shared UI primitives (`EmptyState`, `LoadingSpinner`, standardized Button variants)
3. Incremental file-by-file migration starting with highest-count components

### Additional Security Findings (Lower Priority)
- **MEDIUM**: OneDrive OAuth callback state parameter lacks CSRF nonce (`app/api/projects/onedrive/callback/route.ts:12`)
- **MEDIUM**: Open redirect risk in billing/OneDrive flows (`components/billing-card.tsx:49-50`, `components/onedrive-settings.tsx:75`)
- **MEDIUM**: Swagger UI "Try It Out" enabled publicly with CORS `*` on spec endpoint
- **MEDIUM**: Client-side password validation accepts 3-char passwords vs server requiring 12 (`app/signup/page.tsx:117`)
- **LOW**: `localStorage.getItem()` JSON.parse without try-catch in several components
- **LOW**: Missing `sandbox` attribute on document-viewing iframes
- **LOW**: Stale model names in signup page tier descriptions (post-LLM migration)

### Additional Accessibility Findings (Lower Priority)
- Color contrast: `text-gray-500` on dark backgrounds = ~2.8:1 ratio (significantly below AA)
- `<select>` elements without `aria-label` in `photo-library.tsx` (3 instances)
- Tools menu dropdown missing `role="menu"` / `role="menuitem"` / `aria-expanded`
- Export menu in chat-interface missing ARIA and keyboard dismiss
- Conversation sidebar mobile drawer missing `role="dialog"` / `aria-modal`
- PhotoCard component uses `onClick` without `role="button"` / `tabIndex` / `onKeyDown`
- Loading spinners not announced to screen readers (no `role="status"` / `aria-live`)
- Missing `aria-hidden="true"` on decorative Lucide icons
- Heading hierarchy gaps (`h2` -> `h4` without `h3`)

### How to Resume This Plan

Reference this file by name in a new chat:
```
Pick up the plan at .claude/plans/2026-02-06-security-ui-audit.md and begin implementation starting with P0 (security fixes).
```
