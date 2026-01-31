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
app/api/          # 388 API routes organized by feature domain
lib/              # 200+ service modules (RAG, S3, Stripe, auth, etc.)
components/       # 280+ React components (Shadcn/Radix UI primitives)
prisma/           # Database schema and migrations
__tests__/        # Vitest tests (smoke, API, integration, snapshots)
e2e/              # Playwright E2E tests
.claude/agents/   # 18 custom Claude Code agents
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
| `lib/vision-api-multi-provider.ts` | Multi-provider vision with fallback (GPT-5.2, Claude 4.5) |
| `lib/rag-enhancements.ts` | Extended RAG with advanced retrieval strategies |
| `lib/budget-sync-service.ts` | Budget synchronization and AI extraction |
| `lib/workflow-service.ts` | Workflow orchestration and state transitions |
| `lib/report-finalization.ts` | Report generation finalization and export |

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
- `lib/chat/utils/` - Helpers (restricted query check)

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

- **Vitest**: 1083 tests in `__tests__/` (smoke, integration, snapshots)
- **Playwright**: 82 E2E tests in `e2e/`
- **Node.js v25 compatibility**: Uses `pool: 'forks'` in vitest.config.ts

### Lib Test Suites
| File | Coverage |
|------|----------|
| `__tests__/lib/rag.test.ts` | RAG scoring, query classification (67 tests) |
| `__tests__/lib/feature-sync-services.test.ts` | Room/door/MEP/scale sync (50 tests) |
| `__tests__/lib/document-auto-sync.test.ts` | Document sync orchestration (50 tests) |
| `__tests__/lib/webhook-service.test.ts` | Webhook dispatch, retries, signatures (44 tests) |
| `__tests__/lib/actual-cost-sync.test.ts` | Cost sync from pay apps/invoices (43 tests) |
| `__tests__/lib/budget-auto-sync.test.ts` | Budget AI extraction, sync (37 tests) |
| `__tests__/lib/access-control.test.ts` | Role-based access, document permissions (35 tests) |
| `__tests__/lib/redis.test.ts` | Redis ops, in-memory fallback (34 tests) |
| `__tests__/lib/rate-limiter.test.ts` | Redis + in-memory fallback (32 tests) |
| `__tests__/lib/stripe.test.ts` | Subscriptions, checkout, limits (31 tests) |
| `__tests__/lib/auth-options.test.ts` | NextAuth callbacks (30 tests) |
| `__tests__/lib/document-intelligence.test.ts` | Extraction, classification (30 tests) |
| `__tests__/lib/password-validator.test.ts` | Password rules, weak password detection (29 tests) |
| `__tests__/lib/intelligence-orchestrator.test.ts` | Multi-service orchestration (28 tests) |
| `__tests__/lib/takeoff-formatters.test.ts` | Quantity formatting (28 tests) |
| `__tests__/lib/schedule-parser.test.ts` | Schedule parsing and extraction (25 tests) |
| `__tests__/lib/daily-report-enhancements.test.ts` | Daily report features (24 tests) |
| `__tests__/lib/door-schedule-extractor.test.ts` | Door schedule extraction (24 tests) |
| `__tests__/lib/db-helpers.test.ts` | Retry logic, error handling (23 tests) |
| `__tests__/lib/mep-schedule-extractor.test.ts` | MEP schedule extraction (21 tests) |
| `__tests__/lib/s3.test.ts` | Path generation, utilities (21 tests) |
| `__tests__/lib/takeoff-calculations.test.ts` | Quantity calculations (21 tests) |
| `__tests__/lib/document-processor.test.ts` | PDF processing, extraction (20 tests) |
| `__tests__/lib/daily-report-sync-service.test.ts` | Daily report sync (18 tests) |
| `__tests__/lib/vision-api-multi-provider.test.ts` | Multi-provider vision API (17 tests) |
| `__tests__/lib/budget-sync-service.test.ts` | Budget sync service (16 tests) |
| `__tests__/lib/cost-rollup-service.test.ts` | Cost rollup calculations (16 tests) |
| `__tests__/lib/budget-extractor-ai.test.ts` | AI budget extraction (15 tests) |
| `__tests__/lib/subscription.test.ts` | Subscription management (14 tests) |
| `__tests__/lib/template-processor.test.ts` | PDF form filling, template merging (13 tests) |
| `__tests__/lib/schedule-extraction-service.test.ts` | Schedule extraction service (13 tests) |
| `__tests__/lib/llm-providers.test.ts` | LLM provider abstraction (12 tests) |

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
| `e2e/role-access-control.spec.ts` | Admin/client route access (13 tests) |
| `e2e/project-access.spec.ts` | Project-level permissions (11 tests) |
| `e2e/auth.spec.ts` | Authentication flows (9 tests) |
| `e2e/ui-design-system.spec.ts` | UI/accessibility (9 tests) |
| `e2e/smoke.spec.ts` | Basic app health (8 tests) |
| `e2e/api.spec.ts` | API endpoints (8 tests) |
| `e2e/user-approval-workflow.spec.ts` | User approval gate (6 tests) |
| `e2e/chat.spec.ts` | Chat interface (6 tests) |
| `e2e/session-logout.spec.ts` | Session management (6 tests) |
| `e2e/projects.spec.ts` | Project features (6 tests) |

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

18 specialized agents in `.claude/agents/`:

### Development Agents (6)
| Agent | Purpose |
|-------|---------|
| `security` | Vulnerability scanning, security audits, code review (OWASP, auth, injection) |
| `tester` | Run tests, generate tests, improve coverage |
| `documenter` | Project and API documentation |
| `database` | Prisma schema, migrations, query optimization |
| `fixer` | Bug fixes, build validation, dependency updates |
| `ui` | React components and design system |

### Specialized Agents (3)
| Agent | Purpose |
|-------|---------|
| `stripe-expert` | Stripe payment integration |
| `pdf-specialist` | PDF processing for construction drawings |
| `refactoring-agent` | Large-scale code refactoring |

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

11 skills available via `/command`:

| Command | Purpose |
|---------|---------|
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

When a user query matches these patterns, the corresponding agent is auto-invoked:

### Routing Table

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
Six tiers (Free → Enterprise) with query limits and model access configured in Stripe price IDs.

### Design Tokens
Use `lib/design-tokens.ts` for colors instead of hardcoded values:
```typescript
import { colors } from '@/lib/design-tokens';
// Use colors.primary.DEFAULT instead of '#3B82F6'
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - 32-char random string
- `NEXTAUTH_URL` - http://localhost:3000 for dev

Optional:
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` - AI providers
- `STRIPE_SECRET_KEY` - Payments
- `AWS_REGION`, `AWS_BUCKET_NAME` - S3 storage
- `REDIS_URL` - Caching (falls back to memory)
- `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET` - OneDrive integration
- `ONEDRIVE_TENANT_ID`, `ONEDRIVE_REDIRECT_URI` - OneDrive OAuth
- `RESEND_API_KEY` - Email service

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

## Recent Fixes (January 2026)

### Security Fixes
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

### Infrastructure & Testing
- **Test coverage**: Added 229+ new tests across budget, schedule, daily reports, and vision APIs
- **Claude Code agents**: Added 18 specialized agents to `.claude/agents/`
- **Design tokens**: Migrated to CSS variables in chart and UI components
- **Virus scanning**: Implemented `lib/virus-scanner.ts` for file upload security
- **Vercel compatibility**: Serverless function fixes and build optimizations

### New Service Modules
- **Vision API**: Multi-provider vision with fallback (`lib/vision-api-multi-provider.ts`)
- **Query caching**: Redis-backed LLM response caching (`lib/query-cache.ts`)
- **Analytics**: Project KPI and metrics service (`lib/analytics-service.ts`)
- **Workflow**: State machine for document processing (`lib/workflow-service.ts`)
