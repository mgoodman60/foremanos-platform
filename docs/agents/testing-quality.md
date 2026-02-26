# Testing & Quality — Agent Guide

Use this guide when adding, changing, or running tests. ForemanOS uses Vitest for unit/integration tests and Playwright for E2E tests.

## Commands

- **Full Vitest suite**: `npm test -- --run` (no watch). ~248 files, ~9500 tests.
- **Single file**: `npm test -- __tests__/lib/<module>.test.ts --run`
- **Smoke**: `npm test -- __tests__/smoke --run`
- **Integration**: `npm run test:integration`
- **Snapshot**: `npm run test:snapshot`
- **Playwright E2E**: `npx playwright test`
- **Single E2E**: `npx playwright test e2e/smoke.spec.ts --project=chromium`

## Vitest conventions

- **Mocks before imports**: Use `vi.hoisted()` for mocks that must exist before module imports.
- **Shared mocks**: Reusable mocks live in `__tests__/mocks/shared-mocks.ts`.
- **Example**:
  - `const mockPrisma = vi.hoisted(() => ({ document: { findUnique: vi.fn(), update: vi.fn() } }));`
  - `vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));`

## Known limitations

- fillPdfForm tests skipped (pdf-lib/Vitest compatibility).
- Upload tests skipped (FormData in Node environment).
- Vision-api-wrapper tests have retry delays (~6s each).

## When to add or update tests

- Add unit tests for new lib/ modules or significant branches in existing modules.
- Add or update E2E when changing critical user flows (login, project nav, document upload, daily report).
- After refactors, run the relevant test subset and fix any regressions before considering the change complete.

## References

- [CLAUDE.md](../../CLAUDE.md) — Testing section, Mock Pattern.
- [AGENTS.md](../../AGENTS.md) — Testing section, Run specific tests.
