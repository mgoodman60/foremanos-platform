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
npx tsx scripts/test-upload-pipeline.ts                        # E2E upload pipeline verification (production)
npx tsx scripts/test-upload-pipeline.ts --url http://localhost:3000  # E2E upload pipeline verification (local)
```

## Architecture Overview

**ForemanOS** is an AI-powered construction project management platform with:
- **Next.js 14.2** App Router (server/client components)
- **Prisma 6.7** ORM with **112 database models**
- **PostgreSQL 14+** with serverless connection pooling
- **NextAuth.js** JWT-based authentication (no session adapter)

### Core Directories

```
app/api/              # 406 API routes organized by feature domain
lib/                  # 277 service modules (RAG, S3, Stripe, auth, offline-store, intelligence, etc.)
  lib/rag/            # 19 split modules (from rag.ts + rag-enhancements.ts barrel re-exports)
  lib/mep-takeoff/    # 5 split modules (from mep-takeoff-generator.ts barrel re-export)
  lib/sitework/       # 8 split modules (from sitework-takeoff-extractor.ts barrel re-export)
  lib/report-finalization/  # 9 split modules (from report-finalization.ts barrel re-export)
components/           # 337 React components (Shadcn/Radix UI primitives + dashboard + document intelligence)
prisma/               # Database schema and migrations (112 models)
__tests__/            # Vitest tests (241 test files: 182 lib + 32 API + 3 smoke)
e2e/                  # Playwright E2E tests (23 spec files)
.claude/agents/       # 24 custom Claude Code agents
.claude/skills/       # 14 project slash commands + 24 installed skills (see below)
```

### Key Service Modules

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma singleton with connection management |
| `lib/auth-options.ts` | NextAuth configuration |
| `lib/rag.ts` | Barrel re-export → `lib/rag/` (5 modules: core-types, document-retrieval, context-generation, query-classifiers, phase-instructions) |
| `lib/rag-enhancements.ts` | Barrel re-export → `lib/rag/` (14 modules: types, query-classification, measurement-extraction, takeoff-extraction, symbol-legend, mep-coordination, compliance-checking, scale-detection, abbreviations, spatial-analysis, system-topology, isometric-views, symbol-learning, export-utilities) |
| `lib/s3.ts` | AWS S3 operations with timeout/retry |
| `lib/rate-limiter.ts` | Distributed rate limiting (Redis with memory fallback) |
| `lib/document-processor.ts` | Document processing pipeline |
| `lib/stripe.ts` | Lazy-loaded Stripe integration + tier enforcement |
| `lib/design-tokens.ts` | Centralized color palette and spacing |
| `lib/llm-providers.ts` | Multi-provider LLM abstraction |
| `lib/model-config.ts` | Centralized LLM model constants (single source of truth) |
| `lib/logger.ts` | Structured logging utility with context and metadata |
| `lib/query-cache.ts` | Redis-backed query caching for LLM cost reduction |
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
| `lib/vision-api-multi-provider.ts` | Multi-provider vision with fallback (Claude Opus → GPT-5.2 → Sonnet) |
| `lib/budget-sync-service.ts` | Budget synchronization and AI extraction |
| `lib/workflow-service.ts` | Workflow orchestration and state transitions |
| `lib/report-finalization.ts` | Barrel re-export → `lib/report-finalization/` (8 modules: types, validation, pdf-generation, document-library, onedrive-export, rag-indexing, schedule-processing, orchestrator) |
| `lib/intelligence-orchestrator.ts` | Phase A/B/C intelligence extraction orchestration |
| `lib/intelligence-score-calculator.ts` | 5-dimension intelligence scoring engine with checklist generation |
| `lib/schedule-extractor-ai.ts` | AI-powered schedule/Gantt chart extraction |
| `lib/daily-report-permissions.ts` | RBAC for daily reports (VIEWER, REPORTER, SUPERVISOR, ADMIN) |
| `lib/weather-day-tracker.ts` | Weather day tracking with schedule push-out for outdoor tasks |
| `lib/daily-report-onedrive-sync.ts` | Auto-upload to OneDrive on report approval (PDF + DOCX + Photos) |
| `lib/photo-retention-service.ts` | 7-day tiered retention with OneDrive archival |
| `lib/daily-report-indexer.ts` | RAG chunking/indexing for daily reports |
| `lib/sms-daily-report-service.ts` | SMS-based daily log entry via Twilio |
| `lib/crew-templates-smart-defaults.ts` | Reusable crew templates with smart defaults |
| `lib/offline-store.ts` | IndexedDB wrapper (idb) for offline draft storage + sync queue |
| `lib/daily-report-sync-service.ts` | Daily report cost/schedule sync with WeatherDay creation |
| `lib/cross-reference-resolver.ts` | Resolve sheet-to-sheet references within a document |
| `lib/drawing-schedule-parser.ts` | Parse drawing schedule tables → structured model records |
| `lib/fixture-extractor.ts` | Extract plumbing/electrical/HVAC/fire fixtures → project records |
| `lib/spatial-data-aggregator.ts` | Aggregate dimensional/spatial data across sheets |
| `lib/sheet-index-builder.ts` | Build navigable sheet TOC per document |
| `lib/revision-comparator.ts` | Detect changes between document revisions |
| `lib/quantity-calculator.ts` | 2D/3D quantity calculation engine (areas, volumes, linear footage) |
| `lib/quantity-calculation-orchestrator.ts` | Run calculations per room/zone, confidence scoring, CSI rollups |
| `lib/calculated-takeoff-generator.ts` | Auto-generate MaterialTakeoff line items from calculated quantities |
| `lib/mep-takeoff-generator.ts` | Barrel re-export → `lib/mep-takeoff/` (4 modules: types, pricing-database, extraction, triggers) |
| `lib/sitework-takeoff-extractor.ts` | Barrel re-export → `lib/sitework/` (7 modules: patterns, unit-conversion, drawing-classification, extraction, quantity-derivation, geotech-integration, cad-integration) |
| `lib/discipline-colors.ts` | Shared discipline → color/icon mapping |

277 total service modules in `lib/` — see directory for full listing.

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
  - `context-builder.ts` - RAG retrieval, Phase A/3A/3C enrichment, daily report chunks, web search
- `lib/chat/utils/` - Helpers (restricted query check, query classifier)

### Database Models (Prisma)

Key model groups in `prisma/schema.prisma`:
- **Users**: User, Account, ActivityLog
- **Projects**: Project, ProjectPhase, Document
- **Budget**: ProjectBudget, BudgetItem, Invoice, ChangeOrder, CostAlert
- **Schedule**: Schedule, ScheduleTask, Milestone, LookAheadSchedule
- **MEP**: MEPSubmittal, MEPEquipment, MEPSchedule
- **Field Ops**: DailyReport, FieldPhoto, PunchList, RFI, WeatherDay, CrewTemplate, SMSMapping, DailyReportChunk

**Required Fields**: `Document.projectId` and `User.email` are required (non-nullable).

**Document Intelligence Models**:
- `DocumentChunk` — Per-sheet extracted content + metadata JSON (15 extraction categories stored in `metadata`)
- `DrawingType` — Drawing type classification with confidence scores
- `DimensionAnnotation` — Extracted dimension annotations
- `DetailCallout` — Detail callout references (resolved cross-references)
- `SheetLegend` — Sheet legend data
- `EnhancedAnnotation` — Enhanced annotations from vision extraction
- `MaterialTakeoff` → `TakeoffLineItem` — Auto-generated quantity takeoffs (cascade delete on Document)
- `Room.sourceDocumentId` — Source tracking for cross-document dedup

**Cascade Rules** (Document deletion):
- `MaterialTakeoff` → `onDelete: Cascade` (deletes with document)
- `DoorScheduleItem`, `WindowScheduleItem`, `FinishScheduleItem`, `FloorPlan` → `onDelete: SetNull` (preserves record, clears source)
- `Room` → `onDelete: SetNull` on `sourceDocumentId` (preserves room, clears source)

**Daily Report Models**:
- `DailyReport` — Includes soft delete (`deletedAt`), rejection fields, OneDrive sync fields, photos JSON
- `DailyReportChunk` — RAG chunks for daily report search
- `WeatherDay` — Weather day ledger with schedule impact tracking
- `CrewTemplate` — Reusable crew compositions with smart defaults
- `SMSMapping` — Phone-to-user mapping for SMS entry

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
| Twilio | No | SMS entry disabled |

### Daily Report Feature Architecture

Comprehensive field operations workflow (Phases 1-6B complete):
- **RBAC**: 4-role hierarchy (VIEWER/REPORTER/SUPERVISOR/ADMIN), status state machine (DRAFT → SUBMITTED → APPROVED/REJECTED), soft delete, XSS sanitization
- **Weather Day Tracking**: Ledger + automatic schedule push-out for outdoor tasks
- **OneDrive Archival**: Auto-upload on APPROVED (PDF + DOCX + photos), tiered retention
- **RAG Search**: Daily reports indexed, query routing in `context-builder.ts`
- **SMS Entry**: Twilio, phone mapping (SMSMapping), structured parsing, crew templates
- **Offline/Mobile**: IndexedDB drafts, service worker, PWA, detail page at `/project/[slug]/field-ops/daily-reports/[id]`

Downstream triggers on APPROVED: RAG indexing → budget/schedule sync → OneDrive → email. All triggers are best-effort (try/catch, non-blocking).

**Cron Jobs**: Photo cleanup (`0 3 * * *`), ProcessingQueue cleanup (`0 4 * * *`).

### Document Intelligence Pipeline

Pipeline extracting 15 categories of visual intelligence from construction plans via vision AI (Claude Opus 4.6 / GPT-5.2):

```
Upload → Vision Extraction (15 categories) → Phase A/B/C Intelligence
    ↓
Post-Processing Enrichment (Promise.allSettled):
  Cross-Reference Resolver → Drawing Schedule Parser → Fixture Extractor → Spatial Data Aggregator
    ↓
Sheet Index Builder → Quantity Calculator → Calculated Takeoff Generator
    ↓
Document Detail Page (UI) + Library Badges + Search/Filter
```

**15 Vision Extraction Categories**: Visual Materials, Line Type Semantics, Plumbing Fixtures, Electrical Devices, Spatial Data, Symbol Recognition, Construction Intelligence, Site Work & Concrete, Drawing Schedule Tables, HVAC/Mechanical, Fire Protection, Landscape & Site Features, Enhanced Scale Data, Specification & Code References, Special Drawing Types.

**Quantity Calculation Engine** (`lib/quantity-calculator.ts`): 2D/3D calculations (areas, volumes, perimeters), auto-generates MaterialTakeoff line items, CSI MasterFormat mapping.

**Schema Notes**: `Document.sheetIndex` (Json?, compiled sheet TOC). Room dedup key: `roomNumber + sourceDocumentId`.

**API Endpoints**:
- `GET /api/documents/[id]/intelligence` — Aggregated intelligence data (11 parallel Prisma queries)
- `GET /api/documents/search` — Full-text search with discipline/drawingType filters
- `GET /api/cron/processing-queue-cleanup` — Prune old ProcessingQueue entries

**Document Detail Page** (`/project/[slug]/documents/[id]`): SheetNavigator sidebar, SheetDetailPanel (7 sub-panels), IntelligenceSummary, ProcessingLogPanel. 18 components in `components/documents/`.

| Component | Purpose |
|-----------|---------|
| `DocumentDetailPage.tsx` | Main client component — fetches intelligence API, manages sheet selection |
| `SheetNavigator.tsx` | Left sidebar listing sheets grouped by discipline |
| `SheetDetailPanel.tsx` | Selected sheet's full intelligence display (7 sub-panels) |
| `TitleBlockCard.tsx` | Parsed title block data (project, drawn by, date, revision) |
| `CrossReferenceMap.tsx` | Clickable cross-reference chips for sheet navigation |
| `DimensionTable.tsx` | Contextual dimensions with types (horizontal, vertical, height) |
| `FixtureTable.tsx` | Plumbing/electrical fixture table with room/tag/count |
| `MaterialsPanel.tsx` | Hatching-derived materials with confidence indicators |
| `ScheduleTableView.tsx` | Door/window/finish/equipment schedule table renderer |
| `SpatialDataPanel.tsx` | Spot elevations, levels, grid spacing, slopes |
| `ConfidenceIndicator.tsx` | Reusable green/yellow/red confidence dot with tooltip |
| `IntelligenceSummary.tsx` | Aggregate stats grid (sheets, confidence, disciplines, rooms, fixtures) |
| `ProcessingLogPanel.tsx` | Processing metadata (phases, duration, cost, errors) |
| `DocumentIntelligenceBadges.tsx` | Per-document intelligence badges in library list |
| `ExtractionFeedbackBanner.tsx` | Post-processing completion summary banner |
| `DocumentFilterBar.tsx` | Search + multi-select filter controls for document library |
| `IntelligenceChecklist.tsx` | 9-item actionable checklist with progress bar and re-analyze button |
| `markup-annotation.tsx` | Markup annotation overlay for document viewing |

## Testing

241 test files (182 lib + 32 API + 3 smoke + 1 hooks + 3 coverage gap), 9417 tests total (9343 passing, 74 skipped). 23 Playwright E2E spec files in `e2e/`.

- **TypeScript 5.8.3**: Strict mode enabled
- **Node.js v25 compatibility**: Uses `pool: 'forks'` in vitest.config.ts

Run specific tests:
```bash
npm test -- __tests__/lib/<module>.test.ts --run
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

## Custom Agents, Teams & Auto-Selection

24 specialized agents in `.claude/agents/` (8 development, 6 specialized, 9 construction domain).
9 predefined team configurations for multi-agent coordination.
Auto-selection routes queries to the right agent/team based on keywords.

See `.claude/AGENTS_GUIDE.md` for full agent definitions, team compositions, workflows, routing tables, and data flow diagrams.

## Project Skills (Slash Commands)

14 project-level skills available via `/command`:

| Command | Purpose |
|---------|---------|
| `/agent` | List and invoke specialized agents |
| `/team` | Create and manage agent teams |
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

**Construction Plan Intelligence**: Triggers on work touching `lib/document-processor-batch.ts`, `lib/intelligence-orchestrator.ts`, `lib/rag.ts`, `lib/takeoff-memory-service.ts`, `lib/symbol-learner.ts`, or schema changes to Document/DocumentChunk/DrawingType/SheetLegend/MaterialTakeoff models. Read `.claude/skills/construction-plan-intelligence/SKILL.md` first. Asset library: `assets/construction_symbols_library.json` (230 symbols, 26 CSI categories).

## Important Patterns

### Graceful Degradation
Redis, Stripe, and other optional services fail gracefully with in-memory fallbacks or disabled features.

### RAG Scoring System
`lib/rag.ts` uses a 1000+ point scoring system with:
- 60+ construction terminology phrases
- 25+ measurement patterns
- Notes section prioritization
- Adaptive chunk retrieval (12-20 based on query type)
- Scoring boosts for document intelligence content: materials, fire-rated assemblies, trades, plumbing/electrical fixtures, spatial data, hatching patterns

### Rate Limits
Defined in `lib/rate-limiter.ts`:
- CHAT: 20 messages/minute
- UPLOAD: 10 uploads/minute
- API: 60 requests/minute
- AUTH: 5 login attempts/5 minutes
- DAILY_REPORT: 30 submissions/hour (SMS and web)

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
- `TWILIO_AUTH_TOKEN` - SMS daily report entry
- `TWILIO_WEBHOOK_URL` - Twilio webhook endpoint (optional, defaults to `/api/webhooks/twilio`)

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

### LLM Model Config (actively referenced)
Centralized in `lib/model-config.ts`. Key points:
- `resolveModelAlias()` maps deprecated models (gpt-4o, gpt-3.5-turbo, claude-3-5-sonnet) to current ones
- Tier enforcement via `getEffectiveModel()` in `lib/stripe.ts`
- Vision provider chain: Claude Opus 4.6 → GPT-5.2 → Claude Sonnet 4.5

### Known Test Limitations
- `fillPdfForm` tests skipped (pdf-lib/Vitest compatibility issue)
- Upload tests skipped (FormData Node.js environment limitation)
- Vision-api-wrapper tests have retry delays (~6s each)
- Use `vi.hoisted()` for mocks needed before module imports (see Mock Pattern above)

## Infrastructure Status

### Repository & Deployment

- **Branch**: `main` (single branch; feature branches merged and cleaned up as of Feb 2026)
- **Deploy**: Push to `main` triggers Vercel production deployment
- **Manual deploy**: `npx vercel --prod`

### Production Environment (Vercel)

**URL**: https://foremanos.vercel.app

| Service | Status | Notes |
|---------|--------|-------|
| PostgreSQL (Neon) | Working | 7 users, 4 projects, schema in sync |
| OpenAI API | Configured | Production, Preview, Development |
| Anthropic API | Configured | Production, Preview, Development |
| NextAuth | Configured | JWT-based authentication |
| Cloudflare R2 | Configured | S3-compatible object storage (zero egress fees) |
| Redis | Optional | Falls back to in-memory cache |
| Stripe | Optional | Payment features disabled |
| Resend | Optional | Email notifications disabled |

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

24 skills installed (7 frontend, 3 backend, 6 marketing, 2 meta/testing, 6 construction domain). Skills are auto-loaded by the system prompt when trigger conditions match. Read a skill's `SKILL.md` for full guidance before applying.

### Skill Notes

- **Skills location**: Community skills install to `~/.agents/skills/<name>/` and are symlinked to `~/.claude/skills/<name>/`. Custom skills reside directly in `~/.claude/skills/<name>/`.
- **Loading**: Skills are loaded on-demand when their trigger conditions match. Read the skill's `SKILL.md` before applying its guidance.
- **`tailwind-design-system`**: Targets Tailwind v4. CVA (Class Variance Authority) patterns from this skill are still valuable for ForemanOS which runs Tailwind v3.
- **`frontend-design`**: Consumer-oriented aesthetic guidance. Best for login/onboarding/dashboard work, less suited for data-dense admin panels.
- **`agent-browser`**: This is a tool skill that adds browser automation capabilities. It may reach for the browser when simpler approaches (API calls, direct file reads) suffice. Prefer simpler approaches first.
- **`accessibility-compliance`**: Most valuable when building interfaces for government or public-sector construction clients who require WCAG AA/AAA compliance.
- **`material-pricing` + `agent-browser`**: These two skills pair well together. `material-pricing` provides the domain knowledge for construction supplier pricing, while `agent-browser` enables live web scraping from supplier sites (Ferguson, Graybar, Grainger, etc.).
