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
__tests__/            # Vitest tests (225 test files: 182 lib + 32 API + 3 smoke)
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
| `lib/rag-enhancements.ts` | Barrel re-export → `lib/rag/` (14 modules: types, query-classification, measurement-extraction, takeoff-extraction, symbol-legend, mep-coordination, compliance-checking, scale-detection, abbreviations, spatial-analysis, system-topology, isometric-views, symbol-learning, export-utilities) |
| `lib/budget-sync-service.ts` | Budget synchronization and AI extraction |
| `lib/workflow-service.ts` | Workflow orchestration and state transitions |
| `lib/report-finalization.ts` | Barrel re-export → `lib/report-finalization/` (8 modules: types, validation, pdf-generation, document-library, onedrive-export, rag-indexing, schedule-processing, orchestrator) |
| `lib/logger.ts` | Structured logging utility with context and metadata |
| `lib/intelligence-orchestrator.ts` | Phase A/B/C intelligence extraction orchestration |
| `lib/intelligence-score-calculator.ts` | 5-dimension intelligence scoring engine with checklist generation |
| `lib/schedule-extractor-ai.ts` | AI-powered schedule/Gantt chart extraction |
| `lib/daily-report-permissions.ts` | Role-based access control for daily reports (VIEWER, REPORTER, SUPERVISOR, ADMIN) |
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
- `DailyReport` — Now includes soft delete (`deletedAt`), rejection fields, OneDrive sync fields, photos JSON
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

**Phases 1-6B: Complete Field Operations Workflow (ALL PHASES COMPLETE)**

ForemanOS includes a comprehensive daily report system with enterprise-grade permissions, archival, search, mobile entry, offline support, and a unified detail view.

**Core Features**:
- **RBAC (Phase 1)**: 4-role hierarchy (VIEWER, REPORTER, SUPERVISOR, ADMIN) with status-based permissions
  - Status state machine: DRAFT → SUBMITTED → APPROVED/REJECTED
  - Soft delete with audit trail
  - XSS sanitization for user input
- **Weather Day Tracking (Phase 2)**: Ledger system with automatic schedule push-out for outdoor tasks
  - Rain/snow/wind delays tracked per project
  - WeatherDay records auto-created from daily report delays
  - Schedule integration for critical path impact
- **OneDrive Archival (Phase 3)**: Auto-upload triggered on APPROVED status
  - PDF + DOCX report generation
  - Photo bundling with metadata
  - Tiered retention: thumbnails forever, full-res deleted after OneDrive sync
- **RAG Search (Phase 4)**: Daily reports indexed for chat queries
  - Chunking strategy: summary + sections + crew + weather
  - Query routing: "yesterday's progress" → DailyReportChunk
  - Daily report chunks wired into `context-builder.ts` for chat context
- **SMS Entry (Phase 5)**: Text-based log submission via Twilio
  - Phone-to-user mapping (SMSMapping model)
  - SMSConfigPanel accessible in project settings page
  - Structured parsing: crew, hours, notes, weather
  - Smart defaults from crew templates
- **Crew Templates (Phase 5)**: Reusable crew compositions
  - Trade-specific defaults
  - Auto-populate from recent reports
- **On-Demand Photo Analysis (Phase 6A)**: Haiku default, Opus on request
  - Safety/progress/quality checks
  - Async analysis with status tracking
- **Unified View + Mobile (Phase 6B)**: Detail page, offline support, mobile responsive
  - Detail page at `/project/[slug]/field-ops/daily-reports/[id]`
  - Inline editing for all report sections (weather, labor, equipment, progress, delays, safety, notes)
  - Activity timeline showing status changes, edits, and sync events
  - Side-by-side comparison (today vs yesterday) with diff highlighting
  - PWA offline support: IndexedDB drafts, service worker caching, background sync queue
  - SyncStatusIndicator badge (online/offline/syncing/saved-locally)
  - Mobile responsive: 375px minimum, grid stacking at `sm:`, 44px tap targets
  - Quick Entry: one-tap "Same as yesterday" carryover

**Downstream Triggers on Status Change**:
- **APPROVED**: RAG indexing → budget/schedule sync → OneDrive archival → email notification
- **REJECTED**: email notification with rejection reason/notes
- **SUBMITTED**: email notification to reviewers
- **Bulk approve**: same triggers applied per-report in the loop
- All triggers are best-effort (try/catch, non-blocking) using dynamic imports

**Cron Jobs**:
- Photo cleanup: `0 3 * * *` → `/api/cron/photo-cleanup` (registered in `vercel.json`)
- ProcessingQueue cleanup: `0 4 * * *` → `/api/cron/processing-queue-cleanup` (deletes completed/failed entries >30 days)

### Document Intelligence Pipeline (Feb 2026)

**Sprints 1-8: Full Extraction, Enrichment, Calculations & UI (ALL SPRINTS COMPLETE)**

Enhanced document processing pipeline extracting 15 categories of visual intelligence from construction plans via vision AI (Claude Opus 4.6 / GPT-5.2), with post-processing enrichment, quantity calculations, and a full document detail UI.

**Pipeline Architecture**:
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

**Vision Extraction Categories** (enhanced prompt in `lib/document-processor-batch.ts`):
- Visual Materials (hatching → material identification)
- Line Type Semantics (solid, dashed, demolition, centerline)
- Plumbing Fixtures (WC, lavatory, floor drain, etc.)
- Electrical Devices (receptacles, switches, light fixtures, panels)
- Spatial Data (contextual dimensions, heights, thicknesses, spot elevations, levels, grid spacing, slopes)
- Symbol Recognition (section cuts, detail callouts, elevation markers, revision clouds, match lines)
- Construction Intelligence (trades, fire-rated assemblies, coordination points, phasing)
- Site Work & Concrete (footings, slabs, rebar, grading, utilities, pavement)
- Drawing Schedule Tables (door/window/finish/equipment/structural schedules parsed as tabular data)
- HVAC/Mechanical (ductwork, diffusers, equipment, piping, controls)
- Fire Protection (sprinkler heads, pipe, alarm devices, dampers, riser data)
- Landscape & Site Features (plant schedules, irrigation, hardscape, retaining walls)
- Enhanced Scale Data (multiple scales per page, NTS detection, graphical scale bars)
- Specification & Code References (CSI sections, building codes, keynotes, abbreviations)
- Special Drawing Types (general notes, RCPs, life safety, roof plans, stair/elevator details)

**Post-Processing Enrichment** (called from `lib/intelligence-orchestrator.ts` after Phase C):
- **Cross-Reference Resolver** (`lib/cross-reference-resolver.ts`): Matches detail/section/elevation references to known sheet numbers, builds sheet-to-sheet adjacency map
- **Drawing Schedule Parser** (`lib/drawing-schedule-parser.ts`): Parses extracted schedule tables into DoorScheduleItem, WindowScheduleItem, FinishScheduleItem, MEPEquipment records with `sourceDocumentId` traceability
- **Fixture Extractor** (`lib/fixture-extractor.ts`): Creates structured plumbing/electrical fixture records from extraction metadata, deduplicates by tag + sourceDocumentId
- **Spatial Data Aggregator** (`lib/spatial-data-aggregator.ts`): Builds room dimension maps, level maps, grid maps across all sheets
- **Sheet Index Builder** (`lib/sheet-index-builder.ts`): Generates navigable sheet TOC stored on Document.sheetIndex
- Enrichment uses `Promise.allSettled` for resilience — individual module failures don't block others

**Quantity Calculation Engine** (`lib/quantity-calculator.ts`):
- 2D: room area, wall perimeter, opening areas, net wall area, fixture counts
- 3D: slab volume, footing volume, wall volume, excavation/backfill volume
- Auto-generates MaterialTakeoff line items with `status: 'draft'` and `confidence` scores
- Division-by-zero guards on all calculation functions
- CSI MasterFormat category mapping (03 30 00 Concrete, 09 00 00 Architectural, 22 00 00 Plumbing, 26 00 00 Electrical)

**Revision Comparison** (`lib/revision-comparator.ts`):
- Triggered from `lib/document-auto-sync.ts` for `plans_drawings` category documents
- Compares sheet numbers across old and new documents in same project
- Generates per-sheet diffs: dimensions changed, rooms added/removed, fixtures moved, notes modified

**Schema Changes**:
- `MaterialTakeoff` → `onDelete: Cascade` on Document relation
- `DoorScheduleItem`, `WindowScheduleItem`, `FinishScheduleItem`, `FloorPlan` → `onDelete: SetNull` on Document relation
- `Room.sourceDocumentId` added (String?, relation to Document with `onDelete: SetNull`)
- `Document.sheetIndex` added (Json?, compiled sheet TOC)
- Room dedup key: `roomNumber + sourceDocumentId` (prevents cross-document contamination)

**API Endpoints**:
- `GET /api/documents/[id]/intelligence` — Aggregated intelligence data (11 parallel Prisma queries, project access check, rate limiting)
- `GET /api/documents/search` — Full-text search on DocumentChunk.content with discipline/drawingType filters, paginated
- `GET /api/cron/processing-queue-cleanup` — Prune old ProcessingQueue entries (CRON_SECRET auth)

**Document Detail Page** (`/project/[slug]/documents/[id]`):
- Server component wrapper → `DocumentDetailPage` client component
- `SheetNavigator` sidebar (sheets grouped by discipline with confidence indicators)
- `SheetDetailPanel` (title block, drawing type, cross-references, dimensions, fixtures, materials, schedule tables, spatial data)
- `IntelligenceSummary` (aggregate stats grid)
- `ProcessingLogPanel` (phases, duration, cost, errors)
- Responsive: 375px minimum, collapsible accordion sections on mobile

**Document Library Enrichment** (`components/document-library.tsx`):
- `DocumentIntelligenceBadges` (discipline pills, sheet count, confidence indicator per document)
- `ExtractionFeedbackBanner` (post-processing summary with stats, auto-dismisses after 30s)
- `DocumentFilterBar` (text search + category + discipline + drawing type + confidence filters)

**Document Intelligence Components** (in `components/documents/`):
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

### Codebase Health Sprint (Feb 2026) — ALL 5 SPRINTS COMPLETE

Comprehensive codebase quality initiative addressing TypeScript errors, logging, file splitting, and test coverage.

**Sprint 1**: Fixed 17 TS errors + migrated 692 `console.log` → structured `logger` across 117 lib files
**Sprint 2**: Split `rag-enhancements.ts` (4,612 lines) + `rag.ts` (3,314 lines) into 25 modules in `lib/rag/`
**Sprint 3**: Split `mep-takeoff-generator.ts` (1,973→5 modules in `lib/mep-takeoff/`), `sitework-takeoff-extractor.ts` (1,895→8 modules in `lib/sitework/`), `report-finalization.ts` (1,058→9 modules in `lib/report-finalization/`)
**Sprint 4**: Added 20 test files for critical business logic (+632 tests)
**Sprint 5**: Added 19 lib test files + 4 API route tests (+502 tests)

**Key outcomes**: Zero TS errors, zero `console.log` in `lib/`, no file exceeds ~900 lines, 221→222 test files, 7572→8706 tests. All barrel re-exports preserve original import paths — zero consumer changes needed.

### Dashboard Polish Sprint (Feb 2026) — COMPLETE

Full dashboard refinement: branding, widget reorganization, intelligence scoring, document preview, room browser enhancements, and mobile polish. 5-agent team execution (foreman-chat, dashboard-widgets, intelligence-fix, preview-fix, room-browser).

**30 files changed**: 21 modified + 9 new + 1 deleted, +3,427/-685 lines

**Key changes**:
- **Foreman branding**: All "AI Assistant"/"Ask AI" → "The Foreman"/"Ask the Foreman" across FAB, drawer, sidebar, mobile, skip links, keyboard shortcuts
- **FAB upgrade**: Circle → pill with animated glow ring (`@keyframes foreman-glow`), `aiDrawerPrefill` custom event for pre-fill
- **AskForemanWidget**: Dashboard card with conversation history, quick prompts, input → drawer pre-fill
- **Dashboard reorg**: `DashboardGreeting` (time-aware), `QuickActionsBar` (4 pills), `CompactHealthWidget` (1-col), `ExpandedScheduleWidget` (2-col with "What's Happening Today?" bar)
- **New widgets**: `KeyDatesTimeline`, budget sparkline, data freshness dots, density toggle (localStorage `dashboard_density`)
- **Intelligence scoring**: 5-dimension engine replacing sheet-count scoring (`lib/intelligence-score-calculator.ts`), `IntelligenceChecklist` UI, health integration (60/40 blend)
- **Document preview**: Fetch-first with blob URLs, content-type routing, structured API error codes, 30s timeout
- **Room browser**: Floor labels, area display, MEPEquipment table merge, expandable details, finish grouping (floor/wall/ceiling with paint gallons), heatmap view, trade badges
- **Mobile**: Capture long-press menu (Photo/Daily Report/Punch List), pull-to-refresh

**Dashboard Components** (in `components/dashboard/`):
| Component | Purpose |
|-----------|---------|
| `project-overview.tsx` | Main dashboard grid with density toggle and budget sparkline |
| `dashboard-widget.tsx` | Widget shell with `colSpan`, `customContent`, `lastFetched`, `compact` props |
| `dashboard-greeting.tsx` | Time-aware greeting with project completion % and attention items |
| `quick-actions-bar.tsx` | 4 pill buttons: Upload Doc, New Daily Report, Open Schedule, Ask the Foreman |
| `ask-foreman-widget.tsx` | Chat card with conversations, quick prompts, input → drawer pre-fill |
| `compact-health-widget.tsx` | 1-col health score with mini progress bars and freshness dot |
| `expanded-schedule-widget.tsx` | 2-col schedule with "Today" bar, key dates, 7-day velocity sparkline |
| `key-dates-timeline.tsx` | Horizontal scrollable timeline with color-coded urgency dots |
| `ai-insights-card.tsx` | Legacy AI insights card (replaced by AskForemanWidget on dashboard) |
| `empty-states.tsx` | Empty state displays for widgets |
| `recent-activity-feed.tsx` | Recent project activity feed |

## Testing

- **Vitest**: 225 test files, 8845 tests total (8845 passing, 41 skipped)
  - 182 lib tests (`__tests__/lib/`)
  - 32 API tests (`__tests__/api/`)
  - 3 smoke tests (`__tests__/smoke/`)
  - 1 hooks test (`__tests__/hooks/`)
  - 3 coverage gap tests
- **Playwright**: 23 E2E spec files in `e2e/`
- **Node.js v25 compatibility**: Uses `pool: 'forks'` in vitest.config.ts
- **Comprehensive lib coverage**: All major lib modules have dedicated test files

### Test Coverage

182 lib test files in `__tests__/lib/` with comprehensive coverage across all major modules (core infra, auth, documents, budget, schedule, takeoffs, integrations, field ops, document intelligence, MEP, analytics, drawing intelligence). Run specific tests with `npm test -- __tests__/lib/<module>.test.ts --run`.

**Daily Report Test Files** (Phases 1-6B):
| File | Coverage | Tests |
|------|----------|-------|
| `__tests__/lib/daily-report-permissions.test.ts` | Role-based permissions, status transitions, sanitization | Phase 1 |
| `__tests__/lib/weather-day-tracker.test.ts` | Weather day CRUD, schedule push-out | Phase 2 |
| `__tests__/lib/daily-report-onedrive-sync.test.ts` | OneDrive upload orchestration | Phase 3 |
| `__tests__/lib/photo-retention-service.test.ts` | Photo retention, tiered cleanup | Phase 3 |
| `__tests__/lib/daily-report-indexer.test.ts` | Report chunking, RAG indexing | Phase 4 |
| `__tests__/lib/rag-enhancements-daily-report.test.ts` | Query routing for reports | Phase 4 |
| `__tests__/lib/crew-templates-smart-defaults.test.ts` | Crew templates, smart defaults | Phase 5 |
| `__tests__/lib/sms-daily-report-service.test.ts` | SMS parsing, phone lookup | Phase 5 |
| `__tests__/lib/daily-report-coverage-gaps.test.ts` | Coverage gap scenarios | Phase 6A |
| `__tests__/lib/offline-store.test.ts` | IndexedDB drafts, sync queue operations | Phase 6B |
| `__tests__/api/projects/daily-reports/route.test.ts` | Daily report API CRUD (updated for RBAC) | Updated |
| `__tests__/api/projects/daily-reports/[id]/route.test.ts` | Single report ops + downstream trigger mocks | Updated |
| `__tests__/api/daily-reports/daily-reports-rbac.test.ts` | RBAC enforcement + trigger verification | Updated |

**Document Intelligence Test Files** (Pipeline Sprints 1-8):
| File | Coverage |
|------|----------|
| `__tests__/lib/cross-reference-resolver.test.ts` | Sheet-to-sheet reference resolution |
| `__tests__/lib/drawing-schedule-parser.test.ts` | Schedule table parsing → structured records |
| `__tests__/lib/fixture-extractor.test.ts` | Plumbing/electrical fixture extraction |
| `__tests__/lib/spatial-data-aggregator.test.ts` | Dimensional data aggregation across sheets |
| `__tests__/lib/sheet-index-builder.test.ts` | Sheet TOC generation |
| `__tests__/lib/quantity-calculator.test.ts` | 2D/3D quantity calculations, dimension parsing |
| `__tests__/lib/document-auto-sync.test.ts` | Document sync + revision comparison wiring |
| `__tests__/lib/vision-api-quality.test.ts` | Quality scoring with 16 structural fields |
| `__tests__/api/documents/intelligence.test.ts` | Intelligence endpoint (auth, access, data aggregation) |
| `__tests__/api/documents/search.test.ts` | Document search endpoint (filters, pagination) |
| `__tests__/api/cron/processing-queue-cleanup.test.ts` | Cron cleanup (CRON_SECRET auth, 30-day threshold) |
| `__tests__/lib/intelligence-score-calculator.test.ts` | 5-dimension scoring engine, checklist generation, Prisma metrics (50 tests) |

**Codebase Health Sprint 4 Test Files** (Critical Business Logic):
| File | Tests | Coverage |
|------|-------|----------|
| `__tests__/lib/email-service.test.ts` | 28 | Email sending, templates, error handling |
| `__tests__/lib/onedrive-service.test.ts` | 26 | OneDrive upload, auth, folder creation |
| `__tests__/lib/workflow-service.test.ts` | 31 | Workflow state transitions |
| `__tests__/lib/export-service.test.ts` | 28 | Data export formats |
| `__tests__/lib/design-tokens.test.ts` | 55 | Color palette, spacing, token consistency |
| `__tests__/lib/document-processor-batch.test.ts` | 17 | Batch processing pipeline |
| `__tests__/lib/schedule-extractor-ai.test.ts` | 24 | AI schedule extraction |
| `__tests__/lib/photo-analyzer.test.ts` | 38 | Photo analysis pipeline |
| `__tests__/lib/regulatory-documents.test.ts` | 22 | Regulatory doc caching and linking |
| `__tests__/lib/title-block-extractor.test.ts` | 36 | Title block parsing |
| `__tests__/lib/volume-calculator.test.ts` | 57 | 2D/3D volume calculations |
| `__tests__/lib/spatial-correlation.test.ts` | 49 | Spatial correlation scoring |
| `__tests__/lib/verification-audit-service.test.ts` | 30 | Verification audit logic |
| `__tests__/lib/earthwork-calculator.test.ts` | 40 | Cut/fill calculations |
| `__tests__/lib/room-extractor.test.ts` | 26 | Room data extraction |
| `__tests__/lib/project-health-service.test.ts` | 24 | Project health metrics |
| `__tests__/lib/trade-inference.test.ts` | 18 | Trade detection from content |
| `__tests__/lib/room-docx-generator.test.ts` | 19 | Room schedule DOCX generation |
| `__tests__/lib/daily-report-docx-generator.test.ts` | 27 | Daily report DOCX generation |
| `__tests__/lib/processing-limits.test.ts` | 37 | Processing rate limits |

**Codebase Health Sprint 5 Test Files** (MEP, Takeoffs, Drawing Intelligence & API Routes):
| File | Tests | Coverage |
|------|-------|----------|
| `__tests__/lib/mep-takeoff-extraction.test.ts` | 18 | MEP takeoff extraction pipeline |
| `__tests__/lib/mep-extraction-service.test.ts` | 25 | MEP extraction service |
| `__tests__/lib/fixture-extractor.test.ts` | 15 | Fixture extraction from drawings |
| `__tests__/lib/hardware-set-extractor.test.ts` | 25 | Hardware set parsing |
| `__tests__/lib/window-schedule-extractor.test.ts` | 25 | Window schedule extraction |
| `__tests__/lib/symbol-learner.test.ts` | 31 | Symbol recognition learning |
| `__tests__/lib/adaptive-symbol-learning.test.ts` | 27 | Adaptive symbol learning |
| `__tests__/lib/takeoff-memory-service.test.ts` | 41 | Takeoff memory/caching |
| `__tests__/lib/auto-takeoff-generator.test.ts` | 21 | Auto takeoff generation |
| `__tests__/lib/takeoff-qa-service.test.ts` | 41 | Takeoff QA validation |
| `__tests__/lib/drawing-classifier.test.ts` | 41 | Drawing type classification |
| `__tests__/lib/dimension-intelligence.test.ts` | 56 | Dimension parsing and intelligence |
| `__tests__/lib/schedule-health-analyzer.test.ts` | 20 | Schedule health metrics |
| `__tests__/lib/predictive-scheduling.test.ts` | 25 | Predictive schedule analysis |
| `__tests__/lib/change-order-budget-service.test.ts` | 22 | Change order budget impact |
| `__tests__/api/dashboard/route.test.ts` | 12 | Dashboard API endpoint |
| `__tests__/api/admin/analytics/route.test.ts` | 12 | Admin analytics endpoint |
| `__tests__/api/admin/users/route.test.ts` | 26 | Admin user management |
| `__tests__/api/conversations/list/route.test.ts` | 20 | Conversation listing |

### API Test Suites
| Directory | Coverage |
|-----------|----------|
| `__tests__/api/auth/` | Authentication endpoints |
| `__tests__/api/chat/` | Chat API routes |
| `__tests__/api/documents/` | Document CRUD operations |
| `__tests__/api/projects/` | Project management endpoints |
| `__tests__/api/stripe/` | Stripe webhook and checkout |
| `__tests__/api/cron/` | Cron job endpoints (processing-queue-cleanup) |
| `__tests__/api/projects/daily-reports/` | Daily report CRUD with RBAC enforcement |
| `__tests__/api/dashboard/` | Dashboard data aggregation |
| `__tests__/api/admin/` | Admin analytics, user management |
| `__tests__/api/conversations/` | Conversation listing and management |

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
    ↓ extracts 15 categories (vision AI)
    ↓ enrichment: cross-refs → schedule parser → fixture extractor → spatial aggregator
quantity-surveyor ←→ project-controls
    ↓ quantities (2D/3D calc engine)   ↓ budgets/schedule
    ↓ auto-draft MaterialTakeoff       ↓
field-operations ←←←
    ↓ daily reports
data-sync (orchestrates all, triggers revision comparison)
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
