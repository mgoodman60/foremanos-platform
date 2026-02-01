# ForemanOS Platform Testing - Fix Spec Sheet

**Generated:** 2026-02-01
**Testing Method:** 9 Specialized Claude Code Agents
**Coverage:** Security, Budget, Schedule, Documents, Field Ops, MEP, Chat, Type Safety, Middleware

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 4 | 5 | 4 | 3 | 16 |
| Budget Management | 4 | 4 | 4 | 3 | 15 |
| Schedule Management | 6 | 9 | 9 | 14 | 38 |
| Document Processing | 3 | 7 | 8 | 0 | 18 |
| Field Operations | 6 | 7 | 7 | 13 | 33 |
| MEP Submittals | 3 | 4 | 5 | 9 | 21 |
| Chat Interface | 0 | 3 | 4 | 2 | 9 |
| Type Safety | 2 | 3 | 3 | 0 | 8 |
| Middleware | 3 | 2 | 2 | 2 | 9 |
| Code Quality | 1 | 0 | 0 | 0 | 1 |
| **TOTAL** | **32** | **44** | **46** | **46** | **168** |

---

## CRITICAL ISSUES (Fix Immediately)

### Security Critical (4)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| SEC-1 | `middleware.ts` | 18-26 | `/project/*` routes NOT protected (43 pages exposed) | Add `/project/:path*` to matcher |
| SEC-2 | `middleware.ts` | 18-26 | `/admin` not protected | Add `/admin/:path*` to matcher |
| SEC-3 | `app/api/maintenance/route.ts` | POST | No authentication - DoS attack vector | Add admin session check |
| SEC-4 | `next.config.js` | 1-20 | No security headers (CSP, HSTS, X-Frame-Options) | Add headers configuration |

### Budget Critical (4)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| BUD-1 | `lib/budget-sync-service.ts` | 107-114 | Division by zero in EVM calculations | Add zero guards on CPI/SPI |
| BUD-2 | `lib/budget-sync-service.ts` | 119-120 | Incorrect percent complete calculation | Fix EV/totalBudget formula |
| BUD-3 | `lib/cost-rollup-service.ts` | 244-274 | No transaction wrapper for updates | Wrap in `prisma.$transaction()` |
| BUD-4 | `lib/budget-sync-service.ts` | 374-404 | No error handling in createAlert | Add try-catch block |

### Schedule Critical (6)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| SCH-1 | `app/project/[slug]/schedules/page.tsx` | 129 | Task modal missing (no UI for task details) | Implement TaskDetailModal component |
| SCH-2 | `lib/schedule-analyzer.ts` | 34-41 | HTTP self-call fails in serverless | Import and call function directly |
| SCH-3 | `lib/master-schedule-generator.ts` | 685-710 | Recursive stack overflow risk | Add depth limit |
| SCH-4 | `lib/master-schedule-generator.ts` | 262-284 | Sequential DB inserts (N queries) | Use `createMany()` batch |
| SCH-5 | `lib/schedule-extraction-service.ts` | 2-94 | Wrong file naming (extracts MEP, not schedules) | Rename to equipment-schedule-extraction |
| SCH-6 | `lib/lookahead-service.ts` | 203-215 | Null reference on subcontractor.companyName | Add null check after early return |

### Document Processing Critical (3)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| DOC-1 | `lib/document-processor.ts` | 110-178 | Race condition (2 separate updates) | Combine into single transaction |
| DOC-2 | `lib/rag.ts` | 394-405 | Project isolation issue (findMany for slug) | Add unique constraint, use findUnique |
| DOC-3 | `lib/document-categorizer.ts` | 72-75 | Missing API key validation | Check `ABACUSAI_API_KEY` before request |

### Field Operations Critical (6)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| FLD-1 | `lib/daily-report-enhancements.ts` | 579 | Buffer→File type cast (voice fails) | Convert Buffer to File properly |
| FLD-2 | `lib/daily-report-enhancements.ts` | 617 | Unsafe JSON.parse | Add try-catch wrapper |
| FLD-3 | `lib/daily-report-sync-service.ts` | 245-276 | Race condition in labor upsert | Use proper unique key |
| FLD-4 | `lib/weather-automation.ts` | 174 | toLowerCase() on null conditions | Add null check |
| FLD-5 | `lib/weather-service.ts` | 132 | Type-unsafe API response | Add response validation |
| FLD-6 | `lib/daily-report-sync-service.ts` | 100-117 | Silent error swallowing | Propagate errors to caller |

### MEP Critical (3)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| MEP-1 | `lib/submittal-verification-service.ts` | 709-727 | N+1 query pattern | Batch updates with Promise.all |
| MEP-2 | `lib/spec-compliance-checker.ts` | 156-157 | Unprotected JSON.parse | Add try-catch |
| MEP-3 | `lib/mep-tracking-service.ts` | 498-501 | Null pointer on nextDueDate | Add null check |

### Middleware Critical (3)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| MID-1 | `middleware.ts` | 19 | `/project/:path*` missing (38 routes exposed) | Add to matcher |
| MID-2 | `middleware.ts` | 19 | `/admin/:path*` missing | Add to matcher |
| MID-3 | `middleware.ts` | 19 | `/profile/:path*` missing | Add to matcher |

### Code Quality Critical (1)

| ID | File | Issue | Fix |
|----|------|-------|-----|
| CQ-1 | Multiple (179 files) | 869 console.log calls in production | Replace with structured logger |

---

## HIGH PRIORITY ISSUES (Fix This Week)

### Security High (5)

| ID | File | Issue | Fix |
|----|------|-------|-----|
| SEC-5 | `app/api/documents/upload/route.ts:422` | Technical error details exposed | Remove technicalDetails from responses |
| SEC-6 | `lib/auth-options.ts:8-221` | Missing cookie security config | Add httpOnly, secure, sameSite |
| SEC-7 | `app/api/admin/process-queue/route.ts` | Secrets in query parameters | Move to X-Cron-Secret header |
| SEC-8 | `lib/rate-limiter.ts:221-242` | IP-based rate limit spoofable | Validate proxy headers |
| SEC-9 | `app/api/auth/reset-password/route.ts` | Weak password reset rate limiting | Create dedicated limit (3/15min) |

### Budget High (4)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| BUD-5 | `lib/budget-sync-service.ts` | 90-102 | Inconsistent actual cost aggregation | Reconcile two calculation methods |
| BUD-6 | `lib/cost-rollup-service.ts` | 48-49 | Null safety violations | Add `|| 0` to reduce operations |
| BUD-7 | `app/api/projects/[slug]/budget/dashboard/route.ts` | 113-116 | Schedule variance always zero | Fix PV/EV calculation |
| BUD-8 | `components/budget/ChangeOrderManager.tsx` | 154-180 | Missing validation | Add negative/NaN checks |

### Schedule High (9)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| SCH-7 | `components/schedule/gantt-chart.tsx` | 551-564 | Incorrect drag history | Move push to handleDragEnd |
| SCH-8 | `lib/schedule-analyzer.ts` | 28-157 | Missing error handling | Add try-catch around AI calls |
| SCH-9 | `lib/schedule-health-analyzer.ts` | 98-114 | Incorrect on-time rate | Check actualEndDate <= endDate |
| SCH-10 | `lib/schedule-parser.ts` | 176, 196 | Brittle regex parsing | Make whitespace flexible |
| SCH-11 | `lib/schedule-parser.ts` | 201-204 | Year inference bug | Handle December→January |
| SCH-12 | `lib/lookahead-service.ts` | 295-316 | No database transaction | Wrap in $transaction |
| SCH-13 | `lib/schedule-health-analyzer.ts` | 64 | Division by zero in metrics | Handle target === 0 |
| SCH-14 | `lib/schedule-improvement-analyzer.ts` | 435-457 | Infinite loop in circular check | Add max depth |
| SCH-15 | `lib/master-schedule-generator.ts` | 240-245 | Missing date validation | Validate endDate > startDate |

### Document High (7)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| DOC-4 | `lib/document-processor.ts` | 181-280 | Unsafe background processing | Refactor to async/await |
| DOC-5 | `lib/rag.ts` | 464-467 | Large in-memory sort | Use database pagination |
| DOC-6 | `lib/rag.ts` | 440-462 | Missing null check on documentId | Filter invalid chunks |
| DOC-7 | `lib/document-intelligence.ts` | 312-323 | N+1 query pattern | Batch cross-reference queries |
| DOC-8 | `lib/document-auto-sync.ts` | 79-104 | Sequential feature processing | Parallelize with Promise.allSettled |
| DOC-9 | `lib/contract-extraction-service.ts` | 74-142 | Missing PDF size validation | Add 10MB limit |
| DOC-10 | `components/sheet-index-browser.tsx` | 60-76 | No error feedback to user | Add error state |

### Field Operations High (7)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| FLD-7 | `lib/daily-report-enhancements.ts` | 98 | Unsafe type assertion on equipment | Add runtime validation |
| FLD-8 | `lib/daily-report-sync-service.ts` | 677-682 | Type-unsafe Prisma where clause | Use Prisma types |
| FLD-9 | `lib/photo-documentation.ts` | 217-228 | Type-unsafe photo where clause | Use proper types |
| FLD-10 | `lib/weather-service.ts` | 139-160 | Any type for API response | Add validation schema |
| FLD-11 | `lib/daily-report-sync-service.ts` | 510-660 | Missing transaction rollback | Wrap in $transaction |
| FLD-12 | `lib/weather-service.ts` | 108-130 | No retry logic | Add retry with backoff |
| FLD-13 | `lib/daily-report-enhancements.ts` | 506-512 | Days without incident flaw | Sort reports first |

### MEP High (4)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| MEP-4 | `app/api/projects/[slug]/mep/submittals/route.ts` | 40, 42 | Unsafe type casting | Validate against enum |
| MEP-5 | `app/api/projects/[slug]/mep/equipment/route.ts` | 42, 43 | Unsafe type casting | Validate against enum |
| MEP-6 | `app/api/projects/[slug]/mep/equipment/route.ts` | 110-115 | Missing enum validation | Validate equipmentType |
| MEP-7 | `app/api/projects/[slug]/mep/submittals/[id]/route.ts` | 47-127 | No role-based authorization | Add role check for approvals |

### Chat High (3)

| ID | File | Line | Issue | Fix |
|----|------|------|-------|-----|
| CHT-1 | `components/chat-interface.tsx` | 86 | `currentConversation: any` | Add ConversationMetadata interface |
| CHT-2 | `components/chat-interface.tsx` | 89 | `finalizationStatus: any` | Add FinalizationStatus interface |
| CHT-3 | `components/chat-interface.tsx` | 92 | `scheduleAnalysis: any` | Add ScheduleAnalysis interface |

### Type Safety High (3)

| ID | File | Issue | Fix |
|----|------|-------|-----|
| TYP-1 | `components/workflow-modal.tsx` | 15+ any usages | Add interfaces for state types |
| TYP-2 | `components/takeoff-budget-sync-modal.tsx` | 7 any usages | Add TakeoffItem, VarianceReport types |
| TYP-3 | `components/room-browser.tsx` | 10+ any usages | Add Room interfaces |

---

## TYPE SAFETY ISSUES BY COMPONENT

| Component | Any Count | Priority |
|-----------|-----------|----------|
| `workflow-modal.tsx` | 15+ | CRITICAL |
| `room-browser.tsx` | 10+ | CRITICAL |
| `takeoff-budget-sync-modal.tsx` | 7 | MEDIUM |
| `chat-interface.tsx` | 3 | HIGH |
| `sheet-index-browser.tsx` | 2 | MEDIUM |
| `plan-navigator.tsx` | 2 | LOW |
| `mobile-photo-upload.tsx` | 1 | LOW |
| `processing-progress-card.tsx` | 1 | LOW |
| `batch-upload-modal.tsx` | 0 | CLEAN |
| `document-library.tsx` | 0 | CLEAN |

---

## E2E TEST GAPS

| Area | Current Tests | Recommended | Gap |
|------|--------------|-------------|-----|
| Budget management | 3 (basic) | 15 | 12 |
| Schedule management | 2 (basic) | 15 | 13 |
| Document processing | 0 | 10 | 10 |
| Daily reports | 0 | 10 | 10 |
| MEP submittals | 0 | 8 | 8 |
| Takeoffs | 0 | 6 | 6 |
| Chat features | 6 | 16 | 10 |
| Security | 0 | 10 | 10 |
| **Total** | **11** | **90** | **~79** |

---

## CONSOLE.LOG DISTRIBUTION

| Directory | Files | Calls |
|-----------|-------|-------|
| `lib/` | 85 | 602 |
| `app/` | 86 | 233 |
| `components/` | 8 | 34 |
| **Total** | **179** | **869** |

**Top Offenders:**
- `lib/vision-api-multi-provider.ts` - 57 calls
- `lib/document-processor.ts` - 52 calls
- `lib/chat/processors/context-builder.ts` - 30 calls
- `lib/intelligence-orchestrator.ts` - 22 calls
- `lib/schedule-extractor-ai.ts` - 21 calls

---

## MIDDLEWARE FIX REQUIRED

```typescript
// Current (BROKEN)
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',  // WRONG - routes use /project (singular)
    '/settings/:path*',
    '/chat/:path*',
    '/chat',
  ],
};

// Fixed
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/project/:path*',    // ADD - 43 pages
    '/admin/:path*',      // ADD - admin dashboard
    '/profile/:path*',    // ADD - user profile
    '/settings/:path*',
    '/chat/:path*',
    '/chat',
  ],
};
```

---

## PRIORITY FIX ROADMAP

### Week 1: Critical Security & Data Integrity
1. Fix middleware matcher (SEC-1, SEC-2, MID-1, MID-2, MID-3)
2. Add auth to maintenance API (SEC-3)
3. Add security headers (SEC-4)
4. Fix budget division by zero (BUD-1)
5. Add transaction wrappers (BUD-3, SCH-12, FLD-11)

### Week 2: Critical Features & Type Safety
1. Implement task modal (SCH-1)
2. Fix HTTP self-call (SCH-2)
3. Fix voice transcription (FLD-1)
4. Add type interfaces for chat (CHT-1, CHT-2, CHT-3)
5. Fix N+1 queries (MEP-1, DOC-7)

### Week 3: High Priority Issues
1. Fix EVM calculations (BUD-7)
2. Fix schedule on-time rate (SCH-9)
3. Add error handling (SCH-8, DOC-4, FLD-2)
4. Add role-based auth for approvals (MEP-7)
5. Fix type safety in workflow-modal (TYP-1)

### Week 4: E2E Tests & Code Quality
1. Create budget E2E tests (15 tests)
2. Create schedule E2E tests (15 tests)
3. Create security E2E tests (10 tests)
4. Begin console.log replacement (start with top 5 files)

---

## FILES REQUIRING IMMEDIATE CHANGES

### Critical Priority (12 files)
1. `middleware.ts` - Add routes to matcher
2. `app/api/maintenance/route.ts` - Add auth
3. `next.config.js` - Add security headers
4. `lib/budget-sync-service.ts` - Fix calculations
5. `lib/cost-rollup-service.ts` - Add transactions
6. `app/project/[slug]/schedules/page.tsx` - Add task modal
7. `lib/schedule-analyzer.ts` - Fix HTTP call
8. `lib/document-processor.ts` - Fix race condition
9. `lib/daily-report-enhancements.ts` - Fix voice/JSON
10. `lib/weather-automation.ts` - Add null check
11. `lib/submittal-verification-service.ts` - Fix N+1
12. `components/chat-interface.tsx` - Add types

---

## NEW FILES TO CREATE

### E2E Tests (9 files)
1. `e2e/budget-management.spec.ts` - 15 tests
2. `e2e/schedule-management.spec.ts` - 15 tests
3. `e2e/document-processing.spec.ts` - 10 tests
4. `e2e/daily-reports.spec.ts` - 10 tests
5. `e2e/mep-submittals.spec.ts` - 8 tests
6. `e2e/takeoffs.spec.ts` - 6 tests
7. `e2e/chat-features.spec.ts` - 10 tests
8. `e2e/security-middleware.spec.ts` - 10 tests
9. `e2e/admin-access.spec.ts` - 6 tests

### Type Definitions (1 file)
1. `types/component-types.ts` - Shared interfaces

### Logging (1 file)
1. `lib/logger.ts` - Structured logging service (if not exists)

---

## VERIFICATION COMMANDS

```bash
# Run type check
npm run build

# Run existing tests
npm test -- --run

# Run E2E tests
npx playwright test

# Check for any types
npx tsc --noEmit | grep "any"

# Count console.log
grep -r "console.log" lib/ app/ components/ | wc -l
```

---

## SUMMARY

- **Total Issues Found:** 168
- **Critical Issues:** 32 (must fix before production)
- **High Priority:** 44 (fix within 1-2 weeks)
- **Medium Priority:** 46 (fix within 1 month)
- **Low Priority:** 46 (technical debt)
- **E2E Test Gap:** ~79 new tests needed
- **Console.log Cleanup:** 869 calls to replace
- **Type Safety:** ~46 `any` usages to fix

**Estimated Total Fix Effort:** 4-6 weeks with dedicated team
