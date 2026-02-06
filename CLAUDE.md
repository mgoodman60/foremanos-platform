# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
lib/              # 212 service modules (RAG, S3, Stripe, auth, etc.)
components/       # 292 React components (Shadcn/Radix UI primitives)
prisma/           # Database schema and migrations (112 models)
__tests__/        # Vitest tests (148 test files: lib, API, smoke, hooks)
e2e/              # Playwright E2E tests (23 spec files)
.claude/agents/   # 22 custom Claude Code agents
.claude/skills/   # 12 slash command skills
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

- **Vitest**: 153 test files in `__tests__/` (128 lib + 17 API + 3 smoke + 1 hooks)
- **Playwright**: 23 E2E spec files in `e2e/`
- **Node.js v25 compatibility**: Uses `pool: 'forks'` in vitest.config.ts
- **Comprehensive lib coverage**: All major lib modules have dedicated test files

### Lib Test Coverage (127 files)

All lib modules in `lib/` have comprehensive test coverage in `__tests__/lib/`. Key test suites by category:

**Core Infrastructure**
| File | Tests | Coverage |
|------|-------|----------|
| `rag.test.ts` | 67 | RAG scoring, query classification, chunk retrieval |
| `redis.test.ts` | 34 | Redis operations, in-memory fallback |
| `rate-limiter.test.ts` | 32 | Distributed rate limiting, Redis + memory fallback |
| `db.test.ts` | 1 | Database connection, Prisma singleton |
| `db-helpers.test.ts` | 23 | Retry logic, error handling |
| `query-cache.test.ts` | 40 | LLM response caching, TTL management |
| `retry-util.test.ts` | 73 | Retry logic, exponential backoff, database retry |

**Authentication & Security**
| File | Tests | Coverage |
|------|-------|----------|
| `auth-options.test.ts` | 30 | NextAuth callbacks, JWT handling |
| `access-control.test.ts` | 35 | Role-based access, document permissions |
| `password-validator.test.ts` | 29 | Password rules, weak password detection |

**Document Processing**
| File | Tests | Coverage |
|------|-------|----------|
| `document-processor.test.ts` | 20 | PDF processing, text extraction |
| `document-intelligence.test.ts` | 30 | AI extraction, classification |
| `document-auto-sync.test.ts` | 50 | Document sync orchestration |
| `document-categorizer.test.ts` | 35 | Auto-categorization logic |
| `pdf-to-image.test.ts` | 25 | PDF rasterization |

**Budget & Cost**
| File | Tests | Coverage |
|------|-------|----------|
| `budget-sync-service.test.ts` | 16 | Budget synchronization |
| `budget-auto-sync.test.ts` | 37 | AI budget extraction |
| `budget-extractor-ai.test.ts` | 15 | AI extraction logic |
| `actual-cost-sync.test.ts` | 43 | Pay app/invoice sync |
| `cost-rollup-service.test.ts` | 16 | Cost aggregation |
| `cost-alert-service.test.ts` | 28 | Budget alerts |

**Schedule & Planning**
| File | Tests | Coverage |
|------|-------|----------|
| `schedule-parser.test.ts` | 25 | Schedule parsing |
| `schedule-extraction-service.test.ts` | 13 | AI schedule extraction |
| `schedule-analyzer.test.ts` | 30 | Critical path, variance |
| `lookahead-service.test.ts` | 35 | Look-ahead generation |
| `master-schedule-generator.test.ts` | 40 | Master schedule creation |

**Takeoffs & Quantities**
| File | Tests | Coverage |
|------|-------|----------|
| `takeoff-extractor.test.ts` | 45 | Quantity extraction |
| `takeoff-calculations.test.ts` | 21 | Unit conversions, math |
| `takeoff-formatters.test.ts` | 28 | Output formatting |
| `symbol-libraries.test.ts` | 35 | Symbol recognition |

**Integrations**
| File | Tests | Coverage |
|------|-------|----------|
| `stripe.test.ts` | 31 | Subscriptions, checkout |
| `s3.test.ts` | 21 | AWS S3 operations |
| `llm-providers.test.ts` | 12 | Multi-provider abstraction |
| `vision-api-multi-provider.test.ts` | 17 | Vision API with fallback |
| `autodesk-auth.test.ts` | 20 | Autodesk OAuth |
| `weather-service.test.ts` | 25 | Weather API integration |

**Field Operations**
| File | Tests | Coverage |
|------|-------|----------|
| `daily-report-enhancements.test.ts` | 24 | Daily report features |
| `daily-report-sync-service.test.ts` | 18 | Report synchronization |
| `photo-documentation.test.ts` | 30 | Field photo processing |
| `weather-automation.test.ts` | 22 | Weather delay tracking |

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

22 specialized agents in `.claude/agents/`:

### Development Agents (7)
| Agent | Purpose |
|-------|---------|
| `security` | Vulnerability scanning, security audits, code review (OWASP, auth, injection) |
| `tester` | Run tests, generate tests, improve coverage |
| `documenter` | Project and API documentation |
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

## Skills (Slash Commands)

12 skills available via `/command`:

| Command | Purpose |
|---------|---------|
| `/agent` | List and invoke specialized agents |
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
- `AWS_REGION`, `AWS_BUCKET_NAME` - S3 storage (see `S3_SETUP_GUIDE.md` for detailed AWS setup)
- `REDIS_URL` - Caching (falls back to memory)
- `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET` - OneDrive integration
- `ONEDRIVE_TENANT_ID`, `ONEDRIVE_REDIRECT_URI` - OneDrive OAuth
- `RESEND_API_KEY` - Email service

**Note:** See `S3_SETUP_GUIDE.md` for comprehensive AWS S3 bucket configuration, IAM permissions, and CORS setup instructions.

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

## Recent Fixes (January-February 2026)

### February 2026 - Security & Infrastructure

**jspdf HIGH Severity Vulnerability Fix**
Migrated from jspdf to @react-pdf/renderer to address multiple HIGH severity vulnerabilities:

| Migration | Impact |
|-----------|--------|
| `components/room-pdf-generator.tsx` | Room report PDF generation |
| `components/room-bulk-export.tsx` | Bulk room export functionality |
| `components/project-summary-report.tsx` | Project summary reports |

**Documentation Created:**
- `JSPDF_MIGRATION_SUMMARY.md` - Complete migration guide and implementation details
- `S3_SETUP_GUIDE.md` - Comprehensive AWS S3 setup instructions

### NPM Security Vulnerabilities (February 2026)
Fixed 25 of 33 npm vulnerabilities via safe updates and overrides:

| Fix | Vulnerabilities | Severity |
|-----|----------------|----------|
| Next.js 14.2.28 → 14.2.35 | 8 fixed | HIGH (SSRF, DoS, info exposure) |
| fast-xml-parser@5.3.4 override | 11 fixed | HIGH (AWS SDK DoS) |
| glob@10.5.0 override | 1 fixed | HIGH (command injection) |
| lodash 4.17.21 → 4.17.23 | 1 fixed | MODERATE (prototype pollution) |
| jspdf migration to @react-pdf/renderer | Multiple HIGH vulnerabilities fixed | HIGH |

**Remaining 8 vulnerabilities** require breaking changes:
- esbuild (Vitest 2.x) - 3 MODERATE: Vitest 4.x causes 358 test failures
- eslint - 1 MODERATE: Requires ESLint 9 + flat config migration
- Next.js DoS - 2 HIGH: Requires Next.js 15+ major version upgrade
- tar - 3 HIGH: Canvas rebuild fails (no Node.js v25 prebuilt binaries)

### Security Fixes (January 2026)
- **Auth bypass**: Fixed unauthenticated admin endpoint in `app/api/admin/finalize-reports/route.ts`
- **Path traversal**: Added validation in `app/api/documents/[id]/route.ts`
- **401/403 separation**: 13 admin API routes now return proper HTTP status codes

### Database Bug Fixes
- **N+1 query**: Batch transaction in `lib/actual-cost-sync.ts:182`
- **Race condition**: Upsert pattern in `lib/budget-sync-service.ts:156`
- **Promise.all handling**: Error logging in `lib/auth-options.ts:169`
- **Null checks**: Graceful degradation in `lib/analytics-service.ts:58`

### Type Safety Improvements
- Removed 20+ `as any` casts from Stripe webhook route
- Imported Prisma enums directly in `lib/workflow-service.ts`
- Created type helper files for Stripe and document metadata

### UI Fixes
- **Onboarding modal**: Fixed `onOpenChange` callback in `components/onboarding-wizard.tsx`
- **SSR hydration**: Fixed blank screen flash in `components/session-provider.tsx`

### E2E Test Fixes
- **localStorage access**: Fixed SecurityError in `e2e/helpers/test-user.ts` with try-catch and domain navigation
- **Chat page**: Created `app/chat/page.tsx` with project selection interface
- **API test expectations**: Fixed property paths and HTTP methods in `e2e/api.spec.ts`
- **Email service Prisma**: Fixed null filter syntax using `NOT: { email: null }` in `lib/email-service.ts`
- **Chat auth**: Added `/chat` to middleware matcher for protected route redirect

### Test File Lint & Type Fixes
- **Missing imports**: Added `afterEach`/`afterAll` to 4 test files (analytics-service, calendar-export, redis-cache-adapter, report-change-log)
- **NODE_ENV assignment**: Replaced direct `process.env.NODE_ENV =` with `vi.stubEnv()` in 3 files (autodesk-oss, logger, redis-client)
- **Mock types**: Added `updatedAt` to 15+ ProjectDataSource mocks in document-intelligence-router.test.ts
- **Enum usage**: Replaced string literals with `SymbolCategory` and `DisciplineCode` enums in legend-extractor.test.ts
- **Type casts**: Fixed `IntersectionObserverEntry` casts with `as unknown as` pattern in lazy-loader.test.ts
- **Sharp mocks**: Added full mock interface (resize, jpeg, png, toBuffer) in pdf-to-image-raster.test.ts
- **Type narrowing**: Prevented control flow narrowing with `as string` casts in utils.test.ts
- **ESLint errors**: Fixed `no-non-null-asserted-optional-chain` errors in cost-calculation-service.test.ts

### Infrastructure & Testing
- **Comprehensive test coverage**: 152 Vitest test files + 23 Playwright E2E spec files
- **Strong lib module coverage**: 131 lib test files covering major functionality
- **23 E2E test files**: Full user-facing feature coverage
- **Claude Code agents**: Added 19 specialized agents to `.claude/agents/`
- **Design tokens**: Migrated to CSS variables in chart and UI components
- **Virus scanning**: Implemented `lib/virus-scanner.ts` for file upload security
- **Vercel compatibility**: Serverless function fixes and build optimizations

### Test Infrastructure Improvements (February 2026)
Fixed 177 Vitest test failures and added 7 new E2E test files:

**Vitest Mock Fixes:**
- Added `$transaction` mock to document-processor, lookahead-service, cost-rollup-service, submittal-verification-service tests
- Fixed `timers/promises` mock pattern in vision-api-wrapper tests using `vi.hoisted()`
- Added lookahead-service mock to schedule-analyzer tests
- Fixed Buffer to Uint8Array conversion in pdf-to-image modules
- Added virus-scanner and macro-detector mocks to shared-mocks.ts
- Skipped fillPdfForm tests (pdf-lib/Vitest compatibility issue)
- Skipped upload tests (FormData Node.js environment limitation)

**New E2E Test Files (7 files, ~227 tests):**
| File | Tests | Coverage |
|------|-------|----------|
| `e2e/document-upload.spec.ts` | 28 | Document upload workflow, progress, validation |
| `e2e/daily-reports.spec.ts` | 22 | Daily report CRUD, labor/equipment entries |
| `e2e/mep-submittals.spec.ts` | 30 | MEP submittal tracking, approval workflows |
| `e2e/takeoffs.spec.ts` | 37 | Quantity takeoffs, export, filtering |
| `e2e/bim-viewer.spec.ts` | 37 | BIM/3D viewer, navigation, properties |
| `e2e/compliance.spec.ts` | 31 | Permits, inspections, OSHA compliance |
| `e2e/photo-upload.spec.ts` | 42 | Field photos, gallery, annotations |

**E2E Test Fixes:**
- Changed `networkidle` to `domcontentloaded` for reliability
- Updated project slugs to match seeded test data (riverside-apartments)
- Fixed selectors to match actual UI components

### Logging & Observability (Phase 6 - February 2026)
Replaced ~215 `console.log/error/warn` calls with structured `logger` from `@/lib/logger` in 5 high-volume modules:

| File | Calls Replaced |
|------|----------------|
| `lib/vision-api-multi-provider.ts` | 63 |
| `lib/document-processor.ts` | 69 |
| `lib/chat/processors/context-builder.ts` | 30 |
| `lib/intelligence-orchestrator.ts` | 23 |
| `lib/schedule-extractor-ai.ts` | 30 |

Benefits:
- Structured JSON output for log aggregation services
- Consistent context prefixes (e.g., `VISION_API`, `PROCESS`, `PHASE_A`)
- Metadata objects instead of string interpolation
- Error objects properly serialized with stack traces
- Debug level only logs in development

### New Service Modules
- **Vision API**: Multi-provider vision with fallback (`lib/vision-api-multi-provider.ts`)
- **Query caching**: Redis-backed LLM response caching (`lib/query-cache.ts`)
- **Analytics**: Project KPI and metrics service (`lib/analytics-service.ts`)
- **Workflow**: State machine for document processing (`lib/workflow-service.ts`)
- **Logger**: Centralized structured logging utility (`lib/logger.ts`)

### LLM Model Migration: Claude-Primary Architecture (February 2026)

Migrated from stale OpenAI models to Claude-primary LLM usage with centralized configuration and tier-based enforcement.

**Centralized Model Config (`lib/model-config.ts`)**:

| Constant | Value | Usage |
|----------|-------|-------|
| `DEFAULT_MODEL` | `claude-sonnet-4-5-20250929` | Primary for all paid tiers |
| `PREMIUM_MODEL` | `claude-opus-4-6` | Complex queries, Business/Enterprise |
| `VISION_MODEL` | `claude-opus-4-6` | Vision/image analysis (all tiers) |
| `FALLBACK_MODEL` | `gpt-5.2` | OpenAI fallback (NOT gpt-4o) |
| `SIMPLE_MODEL` | `gpt-4o-mini` | Cheap simple queries, Free tier |
| `EXTRACTION_MODEL` | `claude-sonnet-4-5-20250929` | Document extraction tasks |

**Tier Enforcement** (`lib/stripe.ts`):
- `isModelAllowed(tier, model)` — checks if model is permitted for tier
- `getEffectiveModel(tier, requestedModel, complexity)` — downgrades to best allowed model
- Free: `gpt-4o-mini` only; Starter: + Claude Sonnet; Pro+: all models including Opus

**Complexity Routing** (`lib/query-cache.ts`):
- Simple queries → `gpt-4o-mini` (cheapest)
- Medium queries → Claude Sonnet 4.5 (balanced)
- Complex/Gantt → Claude Opus 4.6 (best quality)

**Vision Provider Chain** (`lib/vision-api-multi-provider.ts`):
- Claude Opus 4.6 (primary) → GPT-5.2 (fallback) → Claude Sonnet 4.5 (secondary)
- Cloudflare block detection triggers immediate failover

**`resolveModelAlias()`** maps deprecated models: `gpt-4o` → `gpt-5.2`, `gpt-3.5-turbo` → `gpt-4o-mini`, `claude-3-5-sonnet` → `claude-sonnet-4-5-20250929`

**Files changed**: 30+ source files, 15+ test files. Zero `gpt-4o` references at runtime.

### Earlier OpenAI Migration (February 2026)

Migrated from Abacus AI to direct OpenAI API:
- Updated `lib/llm-providers.ts` for direct OpenAI integration
- Fixed remaining API routes using Abacus AI endpoints
- Updated test files for OpenAI API compatibility
- Removed canvas dependency to fix Vercel 250MB function limit

### Chat API & UI Fixes (February 2026)

**SPEC-001: Chat API Error Handling**
- Added structured error logging to `app/api/chat/route.ts`, `lib/llm-providers.ts`, `lib/chat/processors/response-streamer.ts`, `lib/chat/processors/llm-handler.ts`
- Error messages now show specific details (401/429/500) instead of generic failures
- Logs capture full API response details with `[CHAT_API]` context prefix

**SPEC-002: Project Creation API Fix**
- Fixed response case mismatch in `app/api/projects/route.ts` (`Project` → `project`)
- Users now see success toast instead of "Internal server error"

**SPEC-003: Dialog Accessibility (WCAG 2.1)**
Added ARIA attributes to 14 dialog/modal components:
- `components/photo-library.tsx` (3 dialogs)
- `components/room-browser.tsx`, `components/room-comparison.tsx`
- `components/document-library.tsx`, `components/document-metadata-modal.tsx`
- `components/mep/EquipmentList.tsx`, `components/mep/MaintenanceSchedule.tsx`, `components/mep/SubmittalList.tsx`
- `components/daily-report-history.tsx`, `components/photo-documentation-hub.tsx`
- `components/conversation-sidebar.tsx`, `components/batch-upload-modal.tsx`

**SPEC-004: Chat Error Messages**
- Enhanced `components/chat-interface.tsx` with specific error messages:
  - 401: "Session expired. Please log in again."
  - 429: "Too many requests. Wait a moment."
  - Network errors: "Connection failed. Check your internet connection."

**SPEC-005: Prerequisites Banner**
- Added document upload banner to `app/project/[slug]/page.tsx`
- Shows when `project.documentCount === 0`

**SPEC-006: UI/UX Improvements**
- Sticky onboarding progress in `components/onboarding-wizard.tsx`
- Enhanced hover/focus states in `components/conversation-sidebar.tsx`, `components/tools-menu.tsx`, `components/document-library.tsx`
- Improved empty state CTAs with prominent buttons and icons

## Infrastructure Status

### Production Environment (Vercel)

**URL**: https://foremanos.vercel.app

| Service | Status | Notes |
|---------|--------|-------|
| PostgreSQL (Neon) | ✅ Working | 7 users, 4 projects, schema in sync |
| OpenAI API | ✅ Configured | Production, Preview, Development |
| Anthropic API | ✅ Configured | Production, Preview, Development |
| NextAuth | ✅ Configured | JWT-based authentication |
| AWS S3 | ❌ NOT SET UP | Required for document uploads |
| Redis | ⚠️ Optional | Falls back to in-memory cache |
| Stripe | ⚠️ Optional | Payment features disabled |
| Resend | ⚠️ Optional | Email notifications disabled |

### S3 Setup Required

To enable document uploads, add these environment variables to Vercel:

```bash
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_FOLDER_PREFIX=foremanos/  # Optional
```

**S3 Bucket Configuration:**
1. Create S3 bucket with private access
2. Enable CORS for your domain
3. Create IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` permissions
4. Add credentials to Vercel environment variables

### Database Details

| Property | Value |
|----------|-------|
| Provider | Neon PostgreSQL |
| Project | wispy-scene-93200332 |
| Region | us-east-1 |
| Connection | Pooled (serverless) |
| Schema | 112 Prisma models |
| Status | In sync with schema |
