# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Operating Mode

**Claude operates as an orchestrator.** Do not write implementation code directly.
Delegate all coding work to specialized agents or agent teams.

### Decision Framework

**Use an agent team when:**
- The task involves 3+ independent workstreams (e.g., frontend + backend + tests)
- Code review is needed across multiple concerns (security, performance, coverage)
- Debugging where multiple hypotheses should be tested simultaneously
- Research or investigation where different angles should be explored in parallel
- Refactoring multiple modules that don't share files
- The user says "let's work on..." (implies a session, not a quick fix)

**Use a single agent (subagent) when:**
- A focused, single-concern task (one file, one module)
- The result just needs to be reported back
- Workers don't need to talk to each other

**Handle directly (no agent) when:**
- Trivial fixes (typo, single-line config change)
- Answering questions about the codebase
- The user explicitly says to do it directly

### What Claude Does Directly
- Read and analyze code (for planning and review)
- Run verification commands (build, test, lint) to check agent work
- Create/edit configuration and documentation files (CLAUDE.md, agents, skills, plans)
- Orchestrate agents and teams (spawn, assign, monitor, synthesize)
- Answer questions about the codebase
- Commit and push (when asked)

### Agent Team Best Practices
- Assign each teammate distinct files to avoid conflicts
- Use delegate mode when coordinating 3+ teammates
- Give each teammate specific context in their spawn prompt (they don't inherit conversation history)
- Aim for 5-6 tasks per teammate
- Require plan approval for risky or schema-changing work
- Start research/review teammates before implementation teammates

## Build & Development Commands

```bash
npm run dev              # Start development server (localhost:3000)
npm run build            # Build for production (runs prisma generate first)
npm run lint             # Run ESLint
npm test                 # Run Vitest tests
npm test -- --run        # Run tests once without watch mode
npm run test:watch       # Run tests in watch mode
npm test -- __tests__/smoke --run   # Run smoke tests only
npm run test:integration     # Run chat integration tests
npm run test:snapshot        # Run snapshot tests
npx playwright test      # Run E2E tests
npx playwright test e2e/smoke.spec.ts --project=chromium  # Single browser E2E
npx prisma studio        # Open database GUI
npx prisma db push       # Sync schema to database
npx prisma generate      # Regenerate Prisma client
npm run seed:test-user   # Seed test user for development
```

## Architecture Overview

**ForemanOS** is an AI-powered construction project management platform with:
- **Next.js 14.2** App Router (server/client components)
- **Prisma 6.7** ORM with **112 database models**
- **PostgreSQL 14+** with serverless connection pooling
- **NextAuth.js** JWT-based authentication (no session adapter)

### Core Directories

```
app/api/          # 389 API routes organized by feature domain
lib/              # 213 service modules (RAG, S3, Stripe, auth, etc.)
components/       # 299 React components (Shadcn/Radix UI primitives)
prisma/           # Database schema and migrations (112 models)
__tests__/        # Vitest tests (163 test files: 133 lib + 24 API + 3 smoke + 1 hooks)
e2e/              # Playwright E2E tests (23 spec files)
.claude/agents/   # 24 custom Claude Code agents
.claude/skills/   # 13 project slash commands + 24 installed skills (see below)
```

### Key Service Modules

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma singleton with connection management |
| `lib/auth-options.ts` | NextAuth configuration |
| `lib/rag.ts` | RAG retrieval with 1000+ point scoring system |
| `lib/s3.ts` | AWS S3 operations with timeout/retry |
| `lib/rate-limiter.ts` | Distributed rate limiting (Redis with memory fallback) |
| `lib/document-processor.ts` | Document processing pipeline |
| `lib/stripe.ts` | Lazy-loaded Stripe integration |
| `lib/design-tokens.ts` | Centralized color palette and spacing |
| `lib/llm-providers.ts` | Multi-provider LLM abstraction |
| `lib/password-validator.ts` | Password strength validation |
| `lib/template-processor.ts` | PDF form filling with pdf-lib |
| `lib/onedrive-service.ts` | OneDrive upload via Microsoft Graph API |
| `lib/email-service.ts` | Welcome emails and notifications (Resend) |
| `lib/access-control.ts` | Role-based document access control |
| `lib/actual-cost-sync.ts` | Cost sync from pay apps, invoices, derived data |
| `lib/budget-auto-sync.ts` | AI budget extraction and sync |
| `lib/document-auto-sync.ts` | Document sync orchestration |
| `lib/feature-sync-services.ts` | Room/door/MEP/scale/schedule sync |
| `lib/analytics-service.ts` | Project KPIs, schedule/cost variance, metrics dashboard |
| `lib/query-cache.ts` | Redis-backed query caching for LLM cost reduction |
| `lib/model-config.ts` | Centralized LLM model constants (single source of truth) |
| `lib/vision-api-multi-provider.ts` | Multi-provider vision with fallback (Claude Opus, GPT-5.2, Claude Sonnet) |
| `lib/rag-enhancements.ts` | Extended RAG with advanced retrieval strategies |
| `lib/budget-sync-service.ts` | Budget synchronization and AI extraction |
| `lib/workflow-service.ts` | Workflow orchestration and state transitions |
| `lib/report-finalization.ts` | Report generation finalization and export |
| `lib/logger.ts` | Structured logging utility with context and metadata |
| `lib/intelligence-orchestrator.ts` | Phase A/B/C intelligence extraction orchestration |
| `lib/schedule-extractor-ai.ts` | AI-powered schedule/Gantt chart extraction |

### Type Helper Files

| File | Purpose |
|------|---------|
| `types/stripe-mappings.ts` | Stripe → Prisma type conversions |
| `types/document-metadata.ts` | DocumentChunk metadata interface |

### API Route Pattern

All API routes follow this middleware pattern:
```
Auth Check → Rate Limit → Validation → Business Logic → Response
```

Main chat endpoint (`app/api/chat/route.ts`) includes:
- Maintenance mode detection
- Subscription limit enforcement
- RAG context building
- LLM streaming response

### Chat Modular Pipeline (`lib/chat/`)

10-step architecture in `app/api/chat/route.ts`:
```
Middleware: Maintenance → Auth → RateLimit → Validation → QueryLimit
Processors: Conversation → RestrictedCheck → RAG → Cache → LLM Stream
```

- `lib/chat/middleware/` - Request validation and auth
- `lib/chat/processors/` - Business logic and streaming
  - `context-builder.ts` - RAG retrieval, Phase A/3A/3C enrichment, web search
- `lib/chat/utils/` - Helpers (restricted query check, query classifier)

### Database Models (Prisma)

Key model groups in `prisma/schema.prisma`:
- **Users**: User, Account, ActivityLog
- **Projects**: Project, ProjectPhase, Document
- **Budget**: ProjectBudget, BudgetItem, Invoice, ChangeOrder, CostAlert
- **Schedule**: Schedule, ScheduleTask, Milestone, LookAheadSchedule
- **MEP**: MEPSubmittal, MEPEquipment, MEPSchedule
- **Field Ops**: DailyReport, FieldPhoto, PunchList, RFI

**Required Fields**: `Document.projectId` and `User.email` are required (non-nullable).

### External Services

| Service | Required | Fallback |
|---------|----------|----------|
| PostgreSQL | Yes | None |
| AWS S3 | Yes | None |
| Anthropic/OpenAI | Yes | Either works |
| Redis | No | In-memory cache |
| Stripe | No | Features disabled |
| OneDrive | No | Upload disabled |
| Resend | No | Email disabled |

## Testing

- **Vitest**: 163 test files in `__tests__/` (133 lib + 24 API + 3 smoke + 1 hooks)
- **Playwright**: 23 E2E spec files in `e2e/`
- **Node.js v25 compatibility**: Uses `pool: 'forks'` in vitest.config.ts
- **Comprehensive lib coverage**: All major lib modules have dedicated test files

### Test Coverage

133 lib test files in `__tests__/lib/` with comprehensive coverage across all major modules (core infra, auth, documents, budget, schedule, takeoffs, integrations, field ops). Run specific tests with `npm test -- __tests__/lib/<module>.test.ts --run`.

### API Test Suites
| Directory | Coverage |
|-----------|----------|
| `__tests__/api/auth/` | Authentication endpoints |
| `__tests__/api/chat/` | Chat API routes |
| `__tests__/api/documents/` | Document CRUD operations |
| `__tests__/api/projects/` | Project management endpoints |
| `__tests__/api/stripe/` | Stripe webhook and checkout |

### Smoke Tests
| File | Coverage |
|------|----------|
| `__tests__/smoke/` | Health checks, auth flows, serverless routes (16 tests) |

### E2E Test Suites
| File | Coverage |
|------|----------|
| `e2e/document-upload.spec.ts` | Document upload workflow (28 tests) |
| `e2e/daily-reports.spec.ts` | Daily report management (22 tests) |
| `e2e/mep-submittals.spec.ts` | MEP submittal tracking (30 tests) |
| `e2e/takeoffs.spec.ts` | Quantity takeoff features (37 tests) |
| `e2e/bim-viewer.spec.ts` | BIM/3D model viewer (37 tests) |
| `e2e/compliance.spec.ts` | Compliance tracking (31 tests) |
| `e2e/photo-upload.spec.ts` | Field photo documentation (42 tests) |
| `e2e/role-access-control.spec.ts` | Admin/client route access (13 tests) |
| `e2e/upload-progress.spec.ts` | Upload progress UI & ARIA (17 tests) |
| `e2e/accessibility.spec.ts` | Skip links, focus trap, ARIA (16 tests) |
| `e2e/forms-validation.spec.ts` | Form validation & accessibility (22 tests) |
| `e2e/budget-management.spec.ts` | Budget CRUD and workflows |
| `e2e/schedule-management.spec.ts` | Schedule features |
| `e2e/project-access.spec.ts` | Project-level permissions (11 tests) |
| `e2e/auth.spec.ts` | Authentication flows (9 tests) |
| `e2e/ui-design-system.spec.ts` | UI/accessibility (9 tests) |
| `e2e/smoke.spec.ts` | Basic app health (8 tests) |
| `e2e/api.spec.ts` | API endpoints (8 tests) |
| `e2e/user-approval-workflow.spec.ts` | User approval gate (6 tests) |
| `e2e/chat.spec.ts` | Chat interface (6 tests) |
| `e2e/session-logout.spec.ts` | Session management (6 tests) |
| `e2e/projects.spec.ts` | Project features (6 tests) |
| `e2e/security-middleware.spec.ts` | Security headers and CSP |

Run specific test file:
```bash
npm test -- __tests__/lib/rag.test.ts --run
```

### Mock Pattern
Use `vi.hoisted()` for mocks needed before module imports:
```typescript
const mockPrisma = vi.hoisted(() => ({
  document: { findUnique: vi.fn(), update: vi.fn() }
}));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
```

Shared mocks are centralized in `__tests__/mocks/shared-mocks.ts` for reuse across test files.

## Custom Agents

24 specialized agents in `.claude/agents/`:

### Development Agents (8)
| Agent | Purpose |
|-------|---------|
| `security` | Vulnerability scanning, security audits, code review (OWASP, auth, injection) |
| `tester` | Run tests, generate tests, improve coverage |
| `documenter` | Project and API documentation |
| `content-writer` | Marketing copy, feature descriptions, landing pages, changelogs |
| `database` | Prisma schema, migrations, query optimization |
| `fixer` | Bug fixes, build validation, dependency updates |
| `ui` | React components and design system |
| `ux-design` | User research, design specs, accessibility audits, user flows |

### Specialized Agents (6)
| Agent | Purpose |
|-------|---------|
| `stripe-expert` | Stripe payment integration |
| `pdf-specialist` | PDF processing for construction drawings |
| `refactoring-agent` | Large-scale code refactoring |
| `infra-specialist` | Vercel deployment, bundle optimization, DevOps |
| `analytics-reports` | Report generation, data visualization, KPI dashboards |
| `resilience-architect` | Error handling, retry strategies, graceful degradation, observability |

### Construction Domain Agents (9)
| Agent | Purpose |
|-------|---------|
| `project-controls` | Schedule, budget, EVM, cash flow, reports |
| `quantity-surveyor` | Takeoffs, pricing, symbol recognition, bids |
| `document-intelligence` | OCR, RAG, extraction, contract analysis |
| `field-operations` | Daily reports, progress, weather tracking |
| `data-sync` | Cross-system sync, cascade updates |
| `submittal-tracker` | Submittals, RFIs, spec compliance |
| `compliance-checker` | Permits, inspections, OSHA, closeout |
| `bim-specialist` | Autodesk/BIM integration, clash detection |
| `photo-analyst` | Field photo analysis for progress/safety |

## Agent Teams

9 predefined team configurations for coordinated multi-agent work. Teams are ephemeral — created per task, torn down when done. Use `/team` to list teams or `/team <number> <task>` to invoke one.

| # | Team | Agents | Purpose |
|---|------|--------|---------|
| 1 | UI/UX Feature | `ux-design`, `ui`, `coder`, `tester` | End-to-end UI feature delivery |
| 2 | Construction Pipeline | `document-intelligence`, `quantity-surveyor`, `data-sync`, `documenter`, `tester` | Extraction and RAG pipeline improvements |
| 3 | Back-End API | `coder`, `database`, `tester` | Schema + API routes + unit tests |
| 4 | Quality & Resilience | `tester`, `security`, `resilience-architect`, `fixer` | Pre-deployment validation |
| 5 | Project Operations | `project-controls`, `analytics-reports`, `field-operations`, `data-sync`, `photo-analyst` | Reports, metrics, data pipelines |
| 6 | Docs & Marketing | `documenter`, `ux-design`, `content-writer` | Documentation and marketing content |
| 7 | Migration & Upgrade | `refactoring-agent`, `fixer`, `tester`, `security` | Major dependency upgrades |
| 8 | Compliance & Safety | `compliance-checker`, `field-operations`, `submittal-tracker`, `photo-analyst` | Safety audits, permits, OSHA |
| 9 | Full-Stack Feature | `coder`, `ux-design`, `database`, `ui`, `tester`, `security` | Full-stack: schema + API + UI + tests |

**Full-stack workflow:** Team 3 (API) → Team 1 (UI) → Team 4 (QA), or Team 9 for all-in-one

See `.claude/AGENTS_GUIDE.md` for full team definitions, workflows, and invocation patterns.
Templates: `.claude/plans/templates/team-invocation.md`, `.claude/plans/templates/implementation-spec.md`

### Team Auto-Selection

When the user's request matches these patterns, **automatically create the team** instead of using a single agent.

| User Says | Team | Why |
|-----------|------|-----|
| "Let's work on UI", "build a new page", "add a component", "redesign the..." | Team 1 (UI/UX) | Multi-step: research → design → build → test |
| "Improve extraction", "fix the RAG", "takeoff accuracy", "new discipline" | Team 2 (Pipeline) | Coordinated: prompts + formulas + scoring + tests |
| "Add a new API endpoint", "build the backend for...", "new feature" (backend-scoped) | Team 3 (API) | Schema + route + tests as atomic unit |
| "Pre-deploy check", "validate before release", "run quality checks" | Team 4 (Quality) | Parallel: tests + security + resilience + fixes |
| "Generate reports", "project metrics", "sprint status" | Team 5 (Ops) | Data flow: field → sync → controls → reports |
| "Write docs", "marketing copy", "changelog", "landing page content" | Team 6 (Docs) | Research + technical docs + copy |
| "Upgrade Next.js", "migrate to ESLint 9", "fix vulnerabilities" | Team 7 (Migration) | Incremental: analyze → update → test → verify |
| "Safety audit", "permit check", "OSHA compliance" | Team 8 (Compliance) | Cross-domain: photos + field + permits + submittals |
| "Add a feature", "build a new...", "implement...", "let's add...", "new feature" | Team 9 (Feature) | Full-stack: schema → API → UI → tests → security |

### Single Agent vs Team Escalation

Use a **single agent** for focused, single-file tasks. Auto-escalate to a **team** when the task:
- Spans 3+ files or concerns
- Involves research → implementation → testing
- Would benefit from parallel exploration
- The user says "let's work on..." (implies a session, not a quick fix)

## Project Skills (Slash Commands)

14 project-level skills available via `/command`:

| Command | Purpose |
|---------|---------|
| `/agent` | List and invoke specialized agents |
| `/team` | Create and manage agent teams (see Team Auto-Selection above) |
| `/build` | Run build and report errors |
| `/test` | Run tests with optional filter |
| `/review` | Code review current changes |
| `/explore` | Explore codebase structure |
| `/setup` | Environment setup wizard |
| `/docs` | Generate documentation |
| `/migrate` | Database migration helper |
| `/api` | API route scaffolding |
| `/daily` | Daily standup summary |
| `/commit` | Smart commit with message |
| `/check` | Quick health check (lint, types, tests) |
| `/construction-plan-intelligence` | Construction document processing pipeline enhancement |

### Construction Plan Intelligence Skill

**Trigger:** Any work touching `lib/document-processor-batch.ts`, `lib/intelligence-orchestrator.ts`, `lib/rag.ts`, `lib/takeoff-memory-service.ts`, `lib/symbol-learner.ts`, or Prisma schema changes to `Document`, `DocumentChunk`, `DrawingType`, `SheetLegend`, or `MaterialTakeoff` models.

**Before making changes to these files**, always read `.claude/skills/construction-plan-intelligence/SKILL.md` first. It defines 10 specific extraction quality gaps, implementation priorities, and integration points with line-number precision.

**Reference files** (9 files in `references/`):

| File | Purpose |
|------|---------|
| `discipline_prompts.md` | Per-discipline vision prompt templates |
| `cross_reference_patterns.md` | Drawing cross-reference resolution logic |
| `takeoff_formulas.md` | Material quantity formulas, waste factors, sanity checks |
| `query_routing.md` | RAG query-to-sheet-type routing table |
| `assembly_patterns.md` | Wall/ceiling/floor assembly resolution and CSI keynote mapping |
| `schema_migrations.md` | New Prisma models (`DrawingCrossReference`, `SheetContinuity`) |
| `continuity_patterns.md` | Multi-page drawing continuation detection |
| `revision_tracking.md` | Revision delta detection and comparison logic |
| `validation_rules.md` | Scale plausibility checks and extraction validation |

**Asset library:** `assets/construction_symbols_library.json` — 230 symbols across 26 CSI MasterFormat categories. Used for vision prompt injection (load only relevant division symbols per discipline), symbol learner baseline vocabulary, and assembly keynote resolution.

## Agent Auto-Selection

When a user query matches these patterns, the corresponding agent is auto-invoked.

**See `.claude/AGENTS_GUIDE.md` for detailed workflows and examples.**

### Development Agent Routing

| Agent | Trigger Keywords |
|-------|-----------------|
| `tester` | test, coverage, generate tests, failing tests, run tests |
| `fixer` | fix, bug, error, broken, failing, debug, build error |
| `security` | security, vulnerability, audit, OWASP, injection, XSS |
| `documenter` | document, JSDoc, API docs, README |
| `ux-design` | UX, user flow, usability, accessibility audit, WCAG, heuristic |
| `analytics-reports` | report, KPI, dashboard, chart, EVM, export CSV, analytics |
| `resilience-architect` | error handling, retry, circuit breaker, graceful degradation, logging |

### Construction Domain Agent Routing

| Agent | Trigger Keywords |
|-------|-----------------|
| `data-sync` | sync, cascade, data flow, update across |
| `project-controls` | budget, schedule, EVM, cash flow, variance, look-ahead |
| `quantity-surveyor` | takeoff, quantity, pricing, bid analysis |
| `document-intelligence` | OCR, RAG, document, contract review |
| `field-operations` | daily report, weather delay, labor tracking |
| `bim-specialist` | BIM, Revit, clash detection, model |
| `photo-analyst` | site photos, progress photos, safety check |

### Data Flow

```
document-intelligence
    ↓ extracts data
quantity-surveyor ←→ project-controls
    ↓ quantities        ↓ budgets/schedule
field-operations ←←←
    ↓ daily reports
data-sync (orchestrates all)
    ↓
bim-specialist ←→ photo-analyst
```

## Important Patterns

### Graceful Degradation
Redis, Stripe, and other optional services fail gracefully with in-memory fallbacks or disabled features.

### RAG Scoring System
`lib/rag.ts` uses a 1000+ point scoring system with:
- 60+ construction terminology phrases
- 25+ measurement patterns
- Notes section prioritization
- Adaptive chunk retrieval (12-20 based on query type)

### Rate Limits
Defined in `lib/rate-limiter.ts`:
- CHAT: 20 messages/minute
- UPLOAD: 10 uploads/minute
- API: 60 requests/minute
- AUTH: 5 login attempts/5 minutes

### Subscription Tiers
Six tiers (Free → Enterprise) with query limits and model access configured in Stripe price IDs. Tier enforcement via `getEffectiveModel()` in `lib/stripe.ts` automatically downgrades models based on subscription level. Model constants centralized in `lib/model-config.ts`.

### Design Tokens
Use `lib/design-tokens.ts` for colors instead of hardcoded values:
```typescript
import { colors } from '@/lib/design-tokens';
// Use colors.primary.DEFAULT instead of '#3B82F6'
```

### Structured Logging
Use `lib/logger.ts` instead of `console.log/error/warn` for production observability:
```typescript
import { logger } from '@/lib/logger';

// Info level - general information
logger.info('CONTEXT', 'Message describing action', { key: value });

// Warning level - potential issues
logger.warn('CONTEXT', 'Warning message', { details });

// Error level - errors with optional error object
logger.error('CONTEXT', 'Error message', error, { additionalMeta });

// Scoped logger for a specific context
import { createScopedLogger } from '@/lib/logger';
const log = createScopedLogger('DOCUMENT_PROCESSOR');
log.info('Processing started');
log.error('Failed', error);
```

Context prefixes should be SCREAMING_SNAKE_CASE (e.g., `VISION_API`, `DOCUMENT_PROCESSOR`, `PHASE_A`).

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - 32-char random string
- `NEXTAUTH_URL` - http://localhost:3000 for dev

Optional:
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` - AI providers
- `STRIPE_SECRET_KEY` - Payments
- `S3_ENDPOINT` - S3-compatible endpoint URL (required for Cloudflare R2, e.g., `https://<account-id>.r2.cloudflarestorage.com`)
- `AWS_REGION` - AWS region or `auto` for R2 (also used for Cloudflare R2)
- `AWS_BUCKET_NAME` - S3/R2 bucket name (also used for Cloudflare R2)
- `AWS_ACCESS_KEY_ID` - S3/R2 access key (also used for Cloudflare R2)
- `AWS_SECRET_ACCESS_KEY` - S3/R2 secret key (also used for Cloudflare R2)
- `REDIS_URL` - Caching (falls back to memory)
- `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET` - OneDrive integration
- `ONEDRIVE_TENANT_ID`, `ONEDRIVE_REDIRECT_URI` - OneDrive OAuth
- `RESEND_API_KEY` - Email service

**Note:** See `S3_SETUP_GUIDE.md` for comprehensive Cloudflare R2 (recommended) or AWS S3 bucket configuration. R2 offers zero egress fees and simpler setup without IAM policies or CORS configuration.

## Known Quirks

### Windows Webpack Path Warnings
On Windows, webpack may show spurious warnings about exports not found (e.g., `downloadFile` from `@/lib/s3`). This is caused by path case sensitivity differences (`C:\Users` vs `c:\Users`) in webpack's static analysis. These warnings are cosmetic - the exports exist and TypeScript validates correctly. Routes work at runtime.

### Windows Prisma Build (EPERM Error)
If you see `EPERM: operation not permitted, rename query_engine-windows.dll.node`:
```powershell
# Close VSCode, then in PowerShell:
taskkill /F /IM node.exe
Remove-Item -Recurse -Force node_modules\.prisma
npx prisma generate
npm run build
```

## Recent Changes & Known Blockers

### Remaining NPM Vulnerabilities (8 — require breaking changes)
- esbuild (Vitest 2.x) - 3 MODERATE: Vitest 4.x causes 358 test failures
- eslint - 1 MODERATE: Requires ESLint 9 + flat config migration
- Next.js DoS - 2 HIGH: Requires Next.js 15+ major version upgrade
- tar - 3 HIGH: Canvas rebuild fails (no Node.js v25 prebuilt binaries)

### LLM Model Config (actively referenced)
Centralized in `lib/model-config.ts`. See `model-config.ts` for all constants. Key points:
- `resolveModelAlias()` maps deprecated models (gpt-4o, gpt-3.5-turbo, claude-3-5-sonnet) to current ones
- Tier enforcement via `getEffectiveModel()` in `lib/stripe.ts`
- Vision provider chain: Claude Opus 4.6 → GPT-5.2 → Claude Sonnet 4.5

### Known Test Limitations
- `fillPdfForm` tests skipped (pdf-lib/Vitest compatibility issue)
- Upload tests skipped (FormData Node.js environment limitation)
- Vision-api-wrapper tests have retry delays (~6s each)
- Use `vi.hoisted()` for mocks needed before module imports (see Mock Pattern above)

## Infrastructure Status

### Production Environment (Vercel)

**URL**: https://foremanos.vercel.app

| Service | Status | Notes |
|---------|--------|-------|
| PostgreSQL (Neon) | ✅ Working | 7 users, 4 projects, schema in sync |
| OpenAI API | ✅ Configured | Production, Preview, Development |
| Anthropic API | ✅ Configured | Production, Preview, Development |
| NextAuth | ✅ Configured | JWT-based authentication |
| Cloudflare R2 | ✅ Configured | S3-compatible object storage (zero egress fees) |
| Redis | ⚠️ Optional | Falls back to in-memory cache |
| Stripe | ⚠️ Optional | Payment features disabled |
| Resend | ⚠️ Optional | Email notifications disabled |

### R2 Setup (Cloudflare)

ForemanOS now uses Cloudflare R2 for object storage (S3-compatible with zero egress fees). To configure:

```bash
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_REGION=auto
AWS_BUCKET_NAME=foremanos-documents
AWS_ACCESS_KEY_ID=<r2-access-key>
AWS_SECRET_ACCESS_KEY=<r2-secret-key>
AWS_FOLDER_PREFIX=foremanos/  # Optional
```

**R2 Configuration:**
1. Create Cloudflare account and R2 bucket
2. Generate R2 API token with Object Read & Write permissions
3. Add credentials to Vercel environment variables
4. Run `npx tsx scripts/setup-r2-cors.ts` to configure CORS (required for browser uploads)

See `S3_SETUP_GUIDE.md` for detailed setup instructions (Option B: Cloudflare R2).

### Database Details

| Property | Value |
|----------|-------|
| Provider | Neon PostgreSQL |
| Project | wispy-scene-93200332 |
| Region | us-east-1 |
| Connection | Pooled (serverless) |
| Schema | 112 Prisma models |
| Status | In sync with schema |

## Installed Skills (Community + Custom)

24 additional skills installed via the skills CLI, organized by category. These extend Claude's capabilities with specialized domain knowledge, workflows, and tool integrations. Skills are loaded automatically when trigger conditions match the user's query.

24 skills installed (7 frontend, 3 backend, 6 marketing, 2 meta/testing, 6 construction domain). Skills are auto-loaded by the system prompt when trigger conditions match. Read a skill's `SKILL.md` for full guidance before applying.

### Skill Notes

- **Skills location**: Community skills install to `~/.agents/skills/<name>/` and are symlinked to `~/.claude/skills/<name>/`. Custom skills reside directly in `~/.claude/skills/<name>/`.
- **Loading**: Skills are loaded on-demand when their trigger conditions match. Read the skill's `SKILL.md` before applying its guidance.
- **`tailwind-design-system`**: Targets Tailwind v4. CVA (Class Variance Authority) patterns from this skill are still valuable for ForemanOS which runs Tailwind v3.
- **`frontend-design`**: Consumer-oriented aesthetic guidance. Best for login/onboarding/dashboard work, less suited for data-dense admin panels.
- **`agent-browser`**: This is a tool skill that adds browser automation capabilities. It may reach for the browser when simpler approaches (API calls, direct file reads) suffice. Prefer simpler approaches first.
- **`accessibility-compliance`**: Most valuable when building interfaces for government or public-sector construction clients who require WCAG AA/AAA compliance.
- **`material-pricing` + `agent-browser`**: These two skills pair well together. `material-pricing` provides the domain knowledge for construction supplier pricing, while `agent-browser` enables live web scraping from supplier sites (Ferguson, Graybar, Grainger, etc.).
