# AGENTS.md — Cross-Agent Project Guide for ForemanOS

This document is the onboarding guide for any AI coding agent (Codex, Copilot, Cursor, etc.) working on ForemanOS. Claude Code is the **primary agent** and maintains the authoritative project knowledge in `CLAUDE.md`. This file summarizes what you need to operate safely and consistently.

> **Read `CLAUDE.md` first.** It contains the full architecture overview, all 112 Prisma models, 295 service modules, 428 API routes, testing patterns, and deployment details. This file is a supplementary quick-reference, not a replacement.

---

## What Is ForemanOS?

AI-powered construction project management platform. Think "Procore meets AI" — document intelligence, daily field reports, budget tracking, scheduling, and a chat assistant ("The Foreman") that answers questions about project documents.

**Stack**: Next.js 14.2 App Router, Prisma 6.7, PostgreSQL (Neon), Cloudflare R2 (S3-compatible), NextAuth JWT, Trigger.dev v3 for long-running tasks, Vitest + Playwright for testing.

---

## Golden Rules

1. **Don't break the build.** Run `npm run build` before considering any change complete.
2. **Don't break existing tests.** Run `npm test -- --run` (full suite: 248 files, ~9500 tests, ~73s).
3. **Don't commit without being asked.** The user will tell you when to commit.
4. **Don't push without being asked.** Vercel auto-deploys on push to `main`.
5. **Don't install packages without mentioning it.** Packages must be in `package.json` (not just `node_modules`) or Vercel builds will fail.
6. **Don't create files unless necessary.** Prefer editing existing files.
7. **Don't add docstrings, comments, or type annotations to code you didn't change.**
8. **Don't over-engineer.** No extra abstractions, no "future-proofing," no feature flags for hypotheticals.

---

## Directory Structure (Quick Reference)

```
app/api/              # 428 API routes (auth → rate limit → validate → logic → response)
lib/                  # 295 service modules (the backend brain)
lib/plugin/           # 7 modules — AI intelligence plugin integration
components/           # 398 React components (Shadcn/Radix UI)
prisma/               # 112-model schema (sync with `npx prisma db push`)
__tests__/            # Vitest unit/integration tests
e2e/                  # Playwright E2E tests
src/trigger/          # Trigger.dev v3 tasks (document processing + 10 plugin agent tasks)
ai-intelligence/      # Git submodule — foreman-os plugin (42 skills, 10 agents, 37 commands)
.claude/              # Claude Code agents, skills, plans (Claude-specific tooling)
```

---

## Key Files You'll Touch Often

| File | What It Does |
|------|-------------|
| `lib/db.ts` | Prisma singleton — lazy-loaded for Trigger.dev Docker builds |
| `lib/model-config.ts` | All LLM model constants (single source of truth) |
| `lib/vision-api-multi-provider.ts` | Vision API provider chain with fallback logic |
| `lib/document-processor-batch.ts` | Document processing pipeline orchestrator |
| `lib/logger.ts` | Structured logger — use this, never `console.log` |
| `lib/api-error.ts` | Standardized API error responses |
| `lib/auth-options.ts` | NextAuth configuration |
| `lib/s3.ts` | AWS S3 / Cloudflare R2 operations |
| `lib/design-tokens.ts` | Color palette — use tokens, not hex codes |
| `lib/plugin/index.ts` | Plugin integration barrel (skills, agents, commands, references) |
| `prisma/schema.prisma` | Database schema (112 models) |

---

## Code Conventions

### Logging
```typescript
import { logger } from '@/lib/logger';
logger.info('CONTEXT_NAME', 'What happened', { key: 'value' });
logger.error('CONTEXT_NAME', 'What failed', error, { meta });
// Context names are SCREAMING_SNAKE_CASE
```

### Unused Variables
Prefix with `_` — ESLint is configured for `varsIgnorePattern: "^_"`.
```typescript
const { propName: _propName } = props;  // destructured from typed interface
catch (_error: unknown) { /* intentionally ignored */ }
```

### API Routes
All routes follow: Auth Check → Rate Limit → Validation → Business Logic → Response.
```typescript
import { apiError } from '@/lib/api-error';
return apiError('Not found', 404, 'NOT_FOUND');
// Returns: { error: 'Not found', code: 'NOT_FOUND' }
```

Use Zod for input validation on POST/PUT routes.

### Testing
```typescript
// Use vi.hoisted() for mocks needed before module imports
const mockPrisma = vi.hoisted(() => ({
  document: { findUnique: vi.fn(), update: vi.fn() }
}));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
```

Run specific tests: `npm test -- __tests__/lib/<module>.test.ts --run`

### Prisma
- JSON fields require `as unknown as Type` double-cast
- Relation filters use PascalCase (`Document`, not `document`)
- `InputJsonValue` doesn't accept `Record<string, unknown>` — use `Record<string, string | number | boolean | string[] | null>`

---

## Document Processing Pipeline (Critical Path)

This is the most complex subsystem. **Do not modify without understanding the full chain.**

### Default Mode: `discipline-single-pass`

```
Haiku classify (~0.2s, $0.0002)
  → Gemini 2.5 Pro vision (~15s, $0.05)        # primary extraction
  → GPT-5.2 rasterized JPEG (~10s, $0.03)      # first fallback
  → analyzeWithOpusFallback                      # final fallback
      Attempt 1: Opus native PDF (single try, 120s timeout)
      Attempt 2: Opus rasterized image (single try)
  → Trigger.dev task-level retry                 # if everything fails
```

### Legacy Mode: `three-pass-legacy` (via `PIPELINE_MODE` env var)

```
Gemini Pro 3 → Gemini 2.5 Pro → Opus interpretation
  → analyzeWithSmartRouting (full provider chain, expensive)
```

### Key Files
- `lib/discipline-classifier.ts` — Haiku classification
- `lib/discipline-prompts.ts` — 8 discipline-specific prompts
- `lib/document-processor-batch.ts` — Pipeline orchestrator
- `lib/vision-api-multi-provider.ts` — Provider chain + fallback functions
- `src/trigger/process-document.ts` — Trigger.dev task (4 pages concurrently)

### Don't
- Send raw PDF bytes to GPT-5.2 (it only accepts images — rasterize first)
- Add retry loops inside `analyzeWithOpusFallback` (it's intentionally lean)
- Modify `analyzeWithSmartRouting` without checking its 3 legacy callers

---

## Build & Deploy

```bash
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build (includes prisma generate)
npm run lint             # ESLint
npm test -- --run        # Full test suite (no watch)
npx prisma db push       # Sync schema to database
npx prisma generate      # Regenerate Prisma client
```

**Deployment**: Push to `main` → Vercel auto-deploys (~5 min build). Do NOT push without user approval.

**Trigger.dev deploy** (for document processing changes):
```bash
npx trigger.dev@latest deploy --env prod --skip-update-check
```

---

## Gotchas & Landmines

| Issue | Details |
|-------|---------|
| Windows webpack warnings | Spurious "export not found" warnings for `@/lib/s3` — cosmetic, ignore |
| Prisma EPERM on Windows | Kill node processes, delete `node_modules/.prisma`, regenerate |
| `rasterizeSinglePage` | Takes 3 args: `(pdfBuffer, pageNumber, options)` — not 2 |
| Lucide icons | Use `LucideIcon` type, `size`/`color` props — not `style` |
| `pdf-lib` colors | Use `rgb(r, g, b)` helper — not raw color objects |
| Glob with brackets | Windows Glob can't find `[id]` paths — use `ls` via shell instead |
| VisionProvider type | Strict union: `'gemini-3-pro-preview' | 'gemini-2.5-pro' | 'claude-opus-4-6' | 'gpt-5.2' | 'claude-sonnet-4-5'` |
| TypeScript 5.8.3 | Don't upgrade to 5.9 (130 Buffer/ArrayBuffer errors) |
| Trigger.dev SDK | Pinned to exact `4.3.3` (CLI requires exact match) |
| `.env.local` keys | Strip trailing `\n` — Vercel CLI artifact causes 401s |

---

## What Claude Manages

Claude Code is the primary agent and maintains:
- `CLAUDE.md` — authoritative project documentation
- `.claude/agents/` — 24 specialized agents (tester, fixer, coder, security, etc.)
- `.claude/skills/` — 14 slash commands + 24 installed skills
- `.claude/plans/` — Implementation plans for active work
- Agent teams for multi-workstream coordination
- Memory files at `~/.claude/projects/.../memory/`

When Claude and another agent both work on the codebase:
- **Claude's conventions win** if there's a conflict
- **Don't modify `.claude/` directory contents** — that's Claude's workspace
- **Don't modify `CLAUDE.md`** without coordinating with the user
- **Do follow all conventions** in this file and `CLAUDE.md`

---

## Environment Variables

**Required**: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

**For document processing**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`

**For storage**: `S3_ENDPOINT`, `AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

**Optional**: `REDIS_URL`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `TWILIO_AUTH_TOKEN`, `CRON_SECRET`

See `CLAUDE.md` for the full list with descriptions.

---

## Current State (Feb 2026)

- **Clean `main` branch** — all feature work merged, no outstanding worktrees
- **Test suite**: 248 files, ~9500 tests (~9400 passing, ~75 skipped, 0 failing)
- **Build**: Clean, 0 TypeScript errors
- **Recent work**: Document processing pipeline optimization (Gemini 2.5 Pro swap, GPT-5.2 rasterization fix, Smart Routing optimization)
- **No active feature branches** — work directly on `main` with commits
