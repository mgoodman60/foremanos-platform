# ForemanOS

> AI-powered construction project management platform

## Overview

ForemanOS is an enterprise construction project management platform built for General Contractors, Superintendents, and Project Engineers. It combines multi-provider vision AI with a comprehensive field operations suite to bring intelligence to every phase of a construction project.

The platform extracts structured data from construction documents — plans, specifications, schedules, and drawings — using a discipline-aware vision pipeline. That extracted intelligence powers natural language queries, budget tracking, schedule analysis, and field reporting from a single interface.

ForemanOS is designed for teams managing complex, multi-trade projects where document volume is high and field conditions change daily. It reduces the manual effort of digging through PDFs, reconciling quantities, and tracking change orders by surfacing the right information at the right time.

---

## Key Features

### Document Intelligence

ForemanOS processes uploaded construction drawings through a vision AI pipeline that extracts 15 categories of structured intelligence per sheet. The pipeline classifies each sheet by discipline (Architectural, Structural, Mechanical, Electrical, Plumbing, Civil/Site, Schedule) and applies a tailored extraction prompt for that discipline.

Extracted data is stored per-sheet and made searchable, enabling queries like "show me all plumbing fixtures on Level 2" or "what are the fire-rated assembly requirements for the east stairwell."

The Document Detail Page provides a sheet navigator, 7 sub-panels of extracted intelligence (dimensions, fixtures, materials, cross-references, spatial data, schedules, processing logs), and confidence indicators per data point.

### AI Chat Assistant — "The Foreman"

The platform includes a RAG-powered AI assistant called "The Foreman" that answers natural language questions about the project. It retrieves relevant context from uploaded documents, daily reports, and project data before generating responses.

The assistant supports a slash command system (`/daily-report`, `/cost`, `/schedule`, `/rfi`) that loads full command definitions and skill context into the LLM. Skills from the optional AI Intelligence plugin are injected based on query intent.

Users can access The Foreman via a persistent floating action button, a drawer panel, or a dashboard widget that pre-fills the chat drawer with quick prompts.

### Field Operations

Daily reports follow a four-role RBAC hierarchy: VIEWER, REPORTER, SUPERVISOR, and ADMIN. Reports move through a state machine: DRAFT → SUBMITTED → APPROVED or REJECTED.

Field operations capabilities include:

- Daily report entry with crew, weather, equipment, material, and delay logging
- Photo documentation with 7-category classification (Progress, Safety, Quality, Weather, Delivery, Deficiency, Closeout)
- Weather day tracking with automatic schedule push-out for outdoor-sensitive tasks
- Punch list creation and tracking
- SMS-based daily log entry via Twilio for crews without app access
- Offline support via IndexedDB with sync queue for intermittent connectivity
- OneDrive archival of approved reports (PDF + DOCX + photos)

### Budget and Cost Management

Budget tracking covers the full lifecycle from original contract through change orders and pay applications. Key capabilities:

- Budget items with CSI cost codes, phase codes, and trade type classification
- AI-powered budget extraction from uploaded schedule-of-values documents
- Change order tracking with approval workflow
- Invoice and pay application management
- Earned value metrics: cost variance, schedule variance, SPI, CPI
- Cost alerts with configurable thresholds
- Actual cost sync from pay applications and invoices

### Schedule Management

Schedule data is extracted from uploaded Gantt charts and schedule drawings using AI, and can also be entered manually. Features include:

- Milestone tracking with critical path identification
- Lookahead schedules (Last Planner method)
- Weather day ledger with schedule impact tracking
- Float analysis and delay classification (8 delay types: Weather, Owner-Directed, Design/Spec, Material/Supply Chain, Sub Performance, Force Majeure, Permit/Regulatory, Differing Site Conditions)
- AI schedule extraction from construction drawings

### Room Browser and Floor Plans

The room browser provides an interactive floor plan view for navigating extracted room data. Features:

- Pan/zoom canvas powered by a custom `useFloorPlanCanvas` hook
- Four color modes: status, completion percentage, trade, and finishes
- MEP discipline overlays with per-discipline visibility, opacity, and line emphasis controls
- Room placement editor for click-and-drag room boundary definition
- Equipment markers within room hotspot bounds
- Heatmap view for density visualization
- Export to PNG (2x resolution) and PDF with header via `pdf-lib`

### Markup and Annotations

A PDF markup system built on PDF.js and Konva.js allows users to annotate construction documents directly in the browser. Capabilities include:

- Freehand drawing, shapes, text callouts, and measurement tools
- Annotation layers with collaborative markup support
- 6 Prisma models backing the annotation system
- 11 API routes for annotation CRUD and layer management

---

## Architecture

### System Overview

```
Browser (Next.js 14.2 App Router)
    |
    +-- Authentication (NextAuth.js JWT)
    |
    +-- API Layer (428 routes in app/api/)
    |       |
    |       +-- Business Logic (295 modules in lib/)
    |       |
    |       +-- Database (Prisma 6.7 → PostgreSQL via Neon)
    |       |
    |       +-- Object Storage (Cloudflare R2 / S3-compatible)
    |
    +-- Background Jobs (Trigger.dev v3)
            |
            +-- Document Processing Pipeline
            |       Haiku classify → Gemini 2.5 Pro extract
            |       → GPT-5.2 fallback → Opus fallback
            |
            +-- 10 Plugin Agent Tasks (project health, deadlines,
                data integrity, field intelligence, etc.)
```

### Directory Structure

```
app/
  api/              # 428 API routes organized by feature domain
  (auth)/           # Authentication pages
  project/[slug]/   # Project-scoped pages (documents, field ops, budget, schedule, rooms)

lib/                # 295 service modules
  rag/              # 25 modules — RAG retrieval, context generation, query classification
  mep-takeoff/      # 5 modules — MEP quantity takeoff generation
  sitework/         # 8 modules — Site work takeoff extraction
  report-finalization/  # 9 modules — Report PDF generation and archival
  plugin/           # 7 modules — AI intelligence plugin integration
  chat/             # Chat pipeline: middleware, processors, utils

components/         # 398 React components
  documents/        # 18 document intelligence components
  rooms/            # Floor plan viewer, placement editor, MEP overlays
  dashboard/        # Dashboard widgets, health indicators, schedule view

prisma/
  schema.prisma     # 112 Prisma models

src/trigger/        # Trigger.dev v3 long-running tasks
  process-document.ts       # Main document processing task (4 pages parallel)
  agents/                   # 10 plugin agent tasks

__tests__/          # Vitest tests (248 test files, 9533 tests)
e2e/                # Playwright E2E tests (23 spec files)
ai-intelligence/    # Git submodule — foreman-os plugin (42 skills, 10 agents)
.claude/agents/     # 24 custom Claude Code agents
```

### Database

112 Prisma models organized into these primary groups:

| Group | Key Models |
|-------|-----------|
| Users | User, Account, ActivityLog, AdminCorrection |
| Projects | Project, ProjectPhase, Document, ProcessingQueue |
| Budget | ProjectBudget, BudgetItem, Invoice, ChangeOrder, CostAlert |
| Schedule | Schedule, ScheduleTask, Milestone, LookAheadSchedule, WeatherDay |
| MEP | MEPSubmittal, MEPEquipment, MEPSchedule |
| Field Ops | DailyReport, FieldPhoto, PunchList, RFI, CrewTemplate, SMSMapping |
| Document Intelligence | DocumentChunk, DrawingType, DimensionAnnotation, MaterialTakeoff, Room, FloorPlan |
| Annotations | VisualAnnotation, AnnotationLayer, AnnotationReply, MarkupSession |

**Cascade rules on document deletion**: `MaterialTakeoff` cascades. `DoorScheduleItem`, `WindowScheduleItem`, `FinishScheduleItem`, `FloorPlan` set source to null (records preserved). `Room.sourceDocumentId` set to null (room preserved, source cleared).

### API Pattern

All API routes follow this middleware chain:

```
Auth Check → Rate Limit → Validation (Zod) → Business Logic → Response
```

Error responses use the standardized `apiError()` helper from `lib/api-error.ts`:

```typescript
import { apiError } from '@/lib/api-error';
return apiError('Not found', 404, 'NOT_FOUND');
// Returns: { error: 'Not found', code: 'NOT_FOUND' }
```

The main chat endpoint (`app/api/chat/route.ts`) runs a 10-step modular pipeline: Maintenance → Auth → RateLimit → Validation → QueryLimit → Conversation → RestrictedCheck → RAG → Cache → LLM Stream.

---

## Document Processing Pipeline

### How It Works

```
1. Upload (browser → presigned URL → Cloudflare R2)
2. Trigger.dev task triggered (process-document)
3. Haiku classifies discipline per page
4. Gemini 2.5 Pro extracts 15 categories of intelligence
5. Fallback chain invoked on failure (see below)
6. Post-processing enrichment runs in parallel (Promise.allSettled):
   - Cross-Reference Resolver
   - Drawing Schedule Parser
   - Fixture Extractor
   - Spatial Data Aggregator
7. Sheet Index Builder compiles navigable TOC
8. Quantity Calculator derives 2D/3D quantities
9. Calculated Takeoff Generator creates MaterialTakeoff line items
10. Intelligence stored per-chunk in DocumentChunk.metadata (JSON)
```

### Fallback Chain

```
Gemini 2.5 Pro (vision extraction)
    → GPT-5.2 (rasterized JPEG — if Gemini fails)
        → Claude Opus (native PDF — if GPT fails)
            → Claude Opus (rasterized image — final attempt)
```

Processing runs 4 pages concurrently via `Promise.allSettled` in the Trigger.dev task. The pipeline mode is controlled by the `PIPELINE_MODE` environment variable (`discipline-single-pass` by default; `three-pass-legacy` for the original Gemini Pro 3 → Gemini 2.5 Pro → Opus chain).

### 15 Extraction Categories

1. Visual Materials (hatching-derived material identification)
2. Line Type Semantics (wall types, partition classification)
3. Plumbing Fixtures (fixtures with room/tag/count)
4. Electrical Devices (panels, outlets, circuits, loads)
5. Spatial Data (spot elevations, grid spacing, slopes)
6. Symbol Recognition (construction symbol library — 230 symbols, 26 CSI categories)
7. Construction Intelligence (general building system intelligence)
8. Site Work and Concrete (earthwork, paving, concrete placements)
9. Drawing Schedule Tables (door, window, finish, equipment schedules)
10. HVAC and Mechanical (equipment, ductwork, VAV boxes)
11. Fire Protection (sprinkler heads, standpipes, fire-rated assemblies)
12. Landscape and Site Features (grading, planting, site amenities)
13. Enhanced Scale Data (scale factors, north arrows, sheet calibration)
14. Specification and Code References (spec sections, code citations)
15. Special Drawing Types (details, sections, enlarged plans, riser diagrams)

### Cost Per Page

| Pipeline Mode | Primary | GPT Fallback | Opus Fallback |
|--------------|---------|-------------|--------------|
| discipline-single-pass | ~$0.05 | ~$0.03 | ~$0.20 |
| three-pass-legacy | ~$0.16 | — | — |

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 14.2 (App Router, server + client components) |
| Language | TypeScript 5.8 (strict mode) |
| Database | PostgreSQL 14+ via Neon (serverless pooling) |
| ORM | Prisma 6.7 (112 models) |
| Authentication | NextAuth.js 4.x (JWT-based, no session adapter) |
| Object Storage | Cloudflare R2 (S3-compatible, zero egress fees) |
| Background Jobs | Trigger.dev v3 (1-hour task limit, Docker via Depot) |
| AI — Primary | Claude Opus 4.6 / Sonnet 4.5 (Anthropic) |
| AI — Vision | Gemini 2.5 Pro / Gemini Pro 3 (Google) |
| AI — Fallback | GPT-5.2 (OpenAI) |
| UI Components | Radix UI + Shadcn + Tailwind CSS 3.3 |
| State Management | Jotai (atoms), Zustand (stores), SWR (data fetching) |
| Forms | React Hook Form 7.53 + Zod 3.23 validation |
| PDF — Viewing | PDF.js (pdfjs-dist) |
| PDF — Generation | pdf-lib, PDFKit, @react-pdf/renderer |
| Annotations | Konva.js + react-konva |
| Charts | Recharts |
| Animation | Framer Motion |
| Offline Storage | IndexedDB via idb |
| Email | Resend (via lib/email-service.ts) |
| SMS | Twilio (daily report entry) |
| Payments | Stripe |
| Testing — Unit | Vitest 2.x + Testing Library |
| Testing — E2E | Playwright |
| Error Tracking | Sentry |
| Deployment | Vercel (auto-deploy from main) |
| Caching | Redis (ioredis) with in-memory fallback |

---

## Getting Started

### Prerequisites

- Node.js 20 or higher
- PostgreSQL 14 or higher (or a Neon account)
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd foremanos

# Install dependencies (also runs prisma generate via postinstall)
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your credentials (see Environment Variables section)

# Sync the database schema
npx prisma db push

# Seed a test user for local development
npm run seed:test-user

# Start the development server
npm run dev
# Available at http://localhost:3000
```

### Environment Variables

**Required**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (pooled) |
| `NEXTAUTH_SECRET` | 32-character random string for JWT signing |
| `NEXTAUTH_URL` | Base URL — `http://localhost:3000` for local dev |

**AI Providers (at least one required)**

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude Opus/Sonnet — primary LLM and fallback vision |
| `OPENAI_API_KEY` | GPT-5.2 — vision fallback and simple queries |
| `GOOGLE_API_KEY` | Gemini 2.5 Pro / Pro 3 — primary vision extraction |

**Object Storage (required for document upload)**

| Variable | Description |
|----------|-------------|
| `S3_ENDPOINT` | R2 endpoint: `https://<account-id>.r2.cloudflarestorage.com` |
| `AWS_REGION` | `auto` for Cloudflare R2 |
| `AWS_BUCKET_NAME` | Bucket name (e.g., `foremanos-documents`) |
| `AWS_ACCESS_KEY_ID` | R2 access key ID |
| `AWS_SECRET_ACCESS_KEY` | R2 secret access key |

**Optional Services**

| Variable | Description | Fallback |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | In-memory cache |
| `STRIPE_SECRET_KEY` | Stripe secret key | Payment features disabled |
| `CRON_SECRET` | Cron job authentication secret | Cron endpoints unprotected |
| `RESEND_API_KEY` | Resend email API key | Email notifications disabled |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | SMS entry disabled |
| `TWILIO_WEBHOOK_URL` | Twilio webhook endpoint | Defaults to `/api/webhooks/twilio` |
| `ONEDRIVE_CLIENT_ID` | Azure AD app client ID | OneDrive sync disabled |
| `ONEDRIVE_CLIENT_SECRET` | Azure AD app secret | OneDrive sync disabled |
| `ONEDRIVE_TENANT_ID` | Azure AD tenant ID | OneDrive sync disabled |
| `OPENWEATHERMAP_API_KEY` | Weather data API | Weather features disabled |
| `VIRUSTOTAL_API_KEY` | Virus scanning for uploads | Scanning skipped |

See `S3_SETUP_GUIDE.md` for detailed Cloudflare R2 configuration including CORS setup.

---

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server at localhost:3000 |
| `npm run build` | Production build (runs prisma generate first) |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest in watch mode |
| `npm test -- --run` | Run all tests once |
| `npm run test:integration` | Run chat integration tests |
| `npm run test:snapshot` | Run snapshot tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run seed:test-user` | Seed test user for local development |
| `npm run trigger:dev` | Start Trigger.dev local dev tunnel |
| `npx prisma studio` | Open Prisma database GUI |
| `npx prisma db push` | Sync schema changes to database |
| `npx prisma generate` | Regenerate Prisma client |
| `npx playwright test` | Run all E2E tests |
| `npx playwright test e2e/smoke.spec.ts --project=chromium` | Run single E2E spec |
| `npx tsx scripts/test-upload-pipeline.ts` | Verify E2E upload pipeline (production) |

### Testing

The test suite uses Vitest for unit and integration tests, and Playwright for end-to-end tests.

```bash
# Run all unit tests
npm test -- --run

# Run a single test file
npm test -- __tests__/lib/rag.test.ts --run

# Run E2E tests
npx playwright test

# Run smoke tests only
npm test -- __tests__/smoke --run
```

**Test suite stats**: 248 test files, 9533 tests (9458 passing, 75 skipped). Playwright: 23 E2E spec files.

**Mock pattern** — use `vi.hoisted()` for mocks that must be initialized before module imports:

```typescript
const mockPrisma = vi.hoisted(() => ({
  document: { findUnique: vi.fn(), update: vi.fn() }
}));
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
```

Shared mocks are centralized in `__tests__/mocks/shared-mocks.ts`.

### Deployment

**Vercel (Next.js app)**: Push to `main` triggers automatic deployment. Typical build time is ~3 minutes. Manual deploy: `npx vercel --prod`.

**Trigger.dev (background tasks)**: Deploy document processing and agent tasks separately:

```bash
npx trigger.dev@latest deploy --env prod --skip-update-check
```

This builds a Docker image on Depot and deploys to Trigger.dev Cloud. The SDK version must be pinned to exactly `4.3.3` — the CLI requires an exact match with the installed package.

### Code Conventions

**Structured logging** — use `lib/logger.ts` instead of `console.log`:

```typescript
import { logger } from '@/lib/logger';
logger.info('DOCUMENT_PROCESSOR', 'Processing started', { documentId });
logger.error('VISION_API', 'Extraction failed', error, { pageNumber });
```

Context prefixes use SCREAMING_SNAKE_CASE. For scoped loggers: `createScopedLogger('CONTEXT')`.

**Design tokens** — use `lib/design-tokens.ts` for colors instead of hardcoded hex values:

```typescript
import { colors } from '@/lib/design-tokens';
// colors.primary.DEFAULT, colors.success[600], etc.
```

**Unused variables** — prefix with `_` (e.g., `_session`, `_metadata`). ESLint is configured with `varsIgnorePattern: "^_"`. For typed interface destructuring: `{ propName: _propName }`, not `{ _propName }`.

**API errors** — use `apiError()` and `apiSuccess()` from `lib/api-error.ts` for consistent response shapes.

**Model constants** — all LLM model identifiers are centralized in `lib/model-config.ts`. Do not hardcode model strings elsewhere.

---

## Plugin System — AI Intelligence

The `ai-intelligence/` directory is an optional git submodule containing the foreman-os plugin. It provides domain-specific construction AI knowledge — 42 skills, 10 agents, 37 slash commands, and 21 field reference guides — all as markdown and JSON files with no executable code.

The platform integrates the plugin at six seams: chat skill injection, slash command routing, discipline-specific extraction prompts, vision quality thresholds, RAG reference search, and 10 Trigger.dev agent tasks. All integration points check `isPluginAvailable()` before loading and fall back to hardcoded behavior when the submodule is absent.

The 10 agent tasks cover: project health monitoring, deadline tracking, data integrity validation, dashboard intelligence, document orchestration, field intelligence advising, project data navigation, report quality auditing, superintendent assistance, and weekly planning coordination.

### Submodule Commands

```bash
# Initialize the submodule after cloning
git submodule update --init --recursive

# Pull the latest plugin changes
git submodule update --remote
```

The build script runs `git submodule update --init --recursive` automatically, so CI and Vercel deployments initialize the plugin without manual steps.

---

## Rate Limits

| Endpoint Group | Limit |
|---------------|-------|
| Chat | 20 messages/minute |
| Upload | 10 uploads/minute |
| API (general) | 60 requests/minute |
| Authentication | 5 login attempts per 5 minutes |
| Daily Report (SMS + web) | 30 submissions/hour |

Rate limiting uses Redis when available and falls back to an in-memory store. Configuration is in `lib/rate-limiter.ts`.

---

## License

Proprietary — All rights reserved.
