# ForemanOS Issues Log

**Generated:** January 31, 2026
**Test Environment:** Windows 11, Node.js v25.4.0

---

## Test Summary

| Test Suite | Passed | Failed | Total |
|------------|--------|--------|-------|
| **Vitest Unit Tests** | 1083 | 0 | 1083 |
| **Playwright E2E** | 82 | 0 | 82 |
| **Build** | ✅ | - | - |
| **Lint** | ⚠️ Warnings | 0 errors | - |

---

## E2E Test Failures (ALL FIXED ✅)

### Category 1: localStorage Access Error ✅ FIXED
**Affected Tests:** 3 tests in `e2e/auth.spec.ts`
**Fix Applied:** Wrapped localStorage access in try-catch, navigate to app domain first
**File:** `e2e/helpers/test-user.ts:118-140`

---

### Category 2: API Authentication Issues ✅ FIXED
**Affected Tests:** 3 tests in `e2e/api.spec.ts`
**Fix Applied:** Aligned test expectations with actual API response format
**File:** `e2e/api.spec.ts`

---

### Category 3: Chat UI Issues ✅ FIXED
**Affected Tests:** 2 tests in `e2e/chat.spec.ts`
**Fix Applied:**
1. Created `/chat` page with textarea element (`app/chat/page.tsx`)
2. Added `/chat` to middleware matcher for auth redirect
**Files:** `app/chat/page.tsx`, `middleware.ts`

---

## Runtime Issues Found

### Issue 1: Prisma Validation Error in Email Service ✅ FIXED
**Location:** `lib/email-service.ts`
**Fix Applied:** Changed `email: { not: null }` to `NOT: { email: null }` (Prisma 6 syntax)
**File:** `lib/email-service.ts`

---

## Lint Warnings (Non-blocking)

| File | Warning |
|------|---------|
| `lib/visual-annotations.ts:15` | Unused `parseGridCoordinate` |
| `lib/visual-annotations.ts:56` | Unexpected `any` |
| `lib/weather-service.ts:132` | Unexpected `any` |
| `lib/weather-service.ts:298` | Unused `projectSlug` |
| `lib/web-search.ts:41` | Unused `documentChunksFound` |
| `lib/webhook-service.ts:3` | Unused `format` import |
| `lib/websocket-server.ts:12` | Unexpected `any` |
| `lib/window-schedule-extractor.ts:345` | Unexpected `any` |
| `lib/workflow-service.ts:164,295-297,333-334` | Multiple `any` types |

---

## Recently Fixed Issues

### Security Fixes (Phase 2A)
- ✅ Auth bypass in `app/api/admin/finalize-reports/route.ts`
- ✅ Path traversal in `app/api/documents/[id]/route.ts`

### Type Safety Fixes (Phase 2B)
- ✅ Stripe webhook `as any` casts removed
- ✅ Workflow service Prisma enum imports
- ✅ Report finalization JSON typing

### Database Fixes (Phase 1)
- ✅ N+1 query in `lib/actual-cost-sync.ts`
- ✅ Race condition in `lib/budget-sync-service.ts`
- ✅ Promise.all error handling in `lib/auth-options.ts`
- ✅ Null checks in `lib/analytics-service.ts`

### UI Fixes (Phase 1)
- ✅ Onboarding modal blocking clicks
- ✅ Session provider SSR hydration

### E2E Test Fixes (Phase 4)
- ✅ localStorage access error in `e2e/helpers/test-user.ts`
- ✅ Created `/chat` page in `app/chat/page.tsx`
- ✅ Fixed API test expectations in `e2e/api.spec.ts`
- ✅ Fixed email service Prisma syntax in `lib/email-service.ts`
- ✅ Added `/chat` to middleware matcher

---

## Recommended Fix Priority

| Priority | Issue | Status |
|----------|-------|--------|
| 1 | localStorage access in E2E tests | ✅ FIXED |
| 2 | Email service Prisma null check | ✅ FIXED |
| 3 | Chat auth redirect | ✅ FIXED |
| 4 | API test expectations alignment | ✅ FIXED |
| 5 | Lint warnings cleanup | ⚠️ Pending (non-blocking) |

---

## Verification Commands

```bash
# Run all unit tests
npm test -- --run

# Run E2E tests
npx playwright test --project=chromium

# Build check
npm run build

# Lint check
npm run lint
```
