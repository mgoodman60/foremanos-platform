# ForemanOS Audit Remediation Plan

**Date:** 2026-02-11
**Owner:** Engineering
**Purpose:** Remediate audit findings with clear phases, acceptance criteria, and test gates.

## Goals
- Close high-risk security and data integrity gaps
- Restore API documentation accuracy
- Reduce type and lint debt with sustainable guardrails
- Stabilize E2E testing and build determinism

## Scope
- API routes under `app/api/**`
- Prisma schema and migrations
- Build and dependency tooling
- ESLint/TypeScript enforcement
- Test infrastructure and Playwright

## Phase 0: Decisions and Prereqs
**Outcomes**
- Confirm calendar endpoint access policy
- Choose package manager strategy
- Choose OpenAPI source of truth

**Decisions**
1. Calendar export access
   - Option A: Private, auth + project membership
   - Option B: Public, signed token with expiration
2. Package manager
   - Option A: npm with `package-lock.json`
   - Option B: yarn with `yarn.lock`
3. OpenAPI ownership
   - Option A: Generated from routes
   - Option B: Hand-maintained with CI diff enforcement

## Phase 1: Security and Integrity Fixes (High Priority)
**Tasks**
1. Add auth or signed access to `/api/projects/[slug]/calendar/[type]`
2. Review other public routes from unauth list for intentional exposure
3. Execute orphaned record fix
   - Run `scripts/audit-orphaned-records.ts`
   - Apply `scripts/fix-orphaned-records.ts`
   - Verify with `scripts/verify-schema-constraints.ts`
4. Make schema fields required
   - `Document.projectId`
   - `User.email`
5. Apply pending migration `add_processing_queue` if not deployed

**Acceptance Criteria**
- Calendar endpoint requires auth or validates signed token
- Orphaned record count is zero
- Migration applies cleanly
- No runtime errors in document flows

**Tests**
- Unit tests for calendar route authorization
- `npm test -- --run`
- `npm run test:integration`

## Phase 2: API Spec Alignment
**Tasks**
1. Decide spec strategy
2. Generate full OpenAPI (or update manually) to cover all routes
3. Add CI check to prevent drift

**Acceptance Criteria**
- OpenAPI path count matches route count
- CI fails on spec drift

**Tests**
- Add a CI task that compares route list to spec

## Phase 3: Tooling Consistency and Dependency Upgrades
**Tasks**
1. Align package manager
   - If npm: remove yarn config, unignore `package-lock.json`, update Vercel config
   - If yarn: add `yarn.lock`, update Vercel install command
2. Plan Next.js and webpack upgrades
   - Evaluate breaking changes
   - Upgrade to patched versions in a branch

**Acceptance Criteria**
- Single lockfile committed and used in CI
- `npm audit --production` clean or documented exceptions

**Tests**
- `npm run build`
- `npm test -- --run`

## Phase 4: Type Safety and Lint Debt Reduction
**Tasks**
1. Establish lint baseline and “new code must be clean” rules
2. Reduce `any` and unused vars in high-risk modules
3. Add stricter TS options for selected folders or new code

**Acceptance Criteria**
- ESLint warnings reduced by agreed target percentage
- No new `any` in new files without explicit justification

**Tests**
- `npm run lint`
- `npx tsc --noEmit --incremental false`

## Phase 5: E2E Stability and Coverage
**Tasks**
1. Rerun Playwright with explicit `PLAYWRIGHT_BASE_URL`
2. Increase timeout if needed
3. Add auth fixtures for authenticated flows

**Acceptance Criteria**
- `npx playwright test` completes and passes
- E2E runs deterministic in CI

## Phase 6: Performance and Schema Optimization (Optional)
**Tasks**
- Implement index recommendations in `DATABASE_HEALTH_REPORT.md`
- Address N+1 risks in high-traffic routes
- Add pagination to large list endpoints

**Acceptance Criteria**
- Query latency improvements on dashboard and document routes
- No regression in API response shape

## Risk Management
- Dependency upgrades may introduce breaking changes
- Schema migrations need production coordination and backups
- OpenAPI generation may require mapping route params and schemas

## Rollback Strategy
- Schema changes: rollback via Prisma migration resolution
- Dependency upgrades: revert lockfile and package versions
- Calendar auth: feature-flag or deploy as separate change

## Milestones
1. Week 1
   - Phase 0 decisions
   - Phase 1 security and integrity
2. Week 2
   - Phase 2 API spec alignment
   - Phase 3 tooling consistency
3. Week 3
   - Phase 4 lint and TS debt reduction
   - Phase 5 E2E stabilization
4. Week 4
   - Phase 6 performance optimizations

## Deliverables
- Updated OpenAPI spec with CI enforcement
- Migration applied and schema tightened
- Reduced lint and TypeScript debt
- Consistent package manager setup
- Stable Playwright runs
