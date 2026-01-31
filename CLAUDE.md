# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev              # Start development server (localhost:3000)
npm run build            # Build for production (runs prisma generate first)
npm run lint             # Run ESLint
npm test                 # Run Vitest tests
npm test -- --run        # Run tests once without watch mode
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
app/api/          # 385+ API routes organized by feature domain
lib/              # 100+ service modules (RAG, S3, Stripe, auth, etc.)
components/       # 277+ React components (Shadcn/Radix UI primitives)
prisma/           # Database schema and migrations
__tests__/        # Vitest tests (smoke, integration, snapshots)
e2e/              # Playwright E2E tests
.claude/agents/   # 28 custom Claude Code agents
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

### External Services

| Service | Required | Fallback |
|---------|----------|----------|
| PostgreSQL | Yes | None |
| AWS S3 | Yes | None |
| Anthropic/OpenAI | Yes | Either works |
| Redis | No | In-memory cache |
| Stripe | No | Features disabled |

## Testing

- **Vitest**: 690 tests in `__tests__/` (smoke, integration, snapshots)
- **Playwright**: E2E tests in `e2e/`
- **Node.js v25 compatibility**: Uses `pool: 'forks'` in vitest.config.ts

Key test suites:
| File | Coverage |
|------|----------|
| `__tests__/lib/rag.test.ts` | RAG scoring, query classification (67 tests) |
| `__tests__/lib/rate-limiter.test.ts` | Redis + in-memory fallback (32 tests) |
| `__tests__/lib/auth-options.test.ts` | NextAuth callbacks (30 tests) |
| `__tests__/lib/stripe.test.ts` | Subscriptions, checkout, limits (31 tests) |
| `__tests__/lib/takeoff-formatters.test.ts` | Quantity formatting (28 tests) |
| `__tests__/lib/db-helpers.test.ts` | Retry logic, error handling (23 tests) |
| `__tests__/lib/s3.test.ts` | Path generation, utilities (21 tests) |
| `__tests__/lib/takeoff-calculations.test.ts` | Quantity calculations (21 tests) |
| `__tests__/lib/document-processor.test.ts` | PDF processing, extraction (20 tests) |

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

28 specialized agents in `.claude/agents/`:

| Agent | Purpose |
|-------|---------|
| `code-reviewer` | Reviews code for quality, patterns, security |
| `docs-writer` | Updates project documentation |
| `dependency-updater` | Updates npm packages, handles breaking changes |
| `refactoring-agent` | Large-scale refactoring (renames, moves) |
| `build-validator` | Check build errors |
| `security-scanner` | Security analysis |
| `security-hardener` | Security fixes implementation |
| `db-expert` | Prisma schema help |
| `integration-test-writer` | Create new tests |
| `qa-smoke-tester` | Run smoke tests |
| `e2e-tester` | Playwright tests |
| `issue-fixer` | Systematic issue resolution |
| `config-fixer` | Configuration and infrastructure fixes |
| `ui-designer` | Component design and accessibility |
| `api-documenter` | API documentation |
| `perf-optimizer` | Performance optimization |
| `project-controls` | Schedule, budget, EVM, forecasting |
| `quantity-surveyor` | Material takeoffs, pricing |
| `document-intelligence` | OCR, RAG, document extraction |
| `field-operations` | Daily reports, progress tracking |
| `data-sync` | Cross-system data synchronization |

## Construction Agent Auto-Selection

When a user query matches these patterns, automatically use the corresponding agent:

### Routing Table

| Agent | Trigger Keywords | File Context |
|-------|-----------------|--------------|
| `data-sync` | sync, integration, data mismatch, EVM refresh, rollup | `lib/*-sync-service.ts` |
| `project-controls` | EVM, budget sync, schedule, critical path, CPI, SPI, forecast | `lib/schedule-*.ts`, `lib/budget-*.ts` |
| `quantity-surveyor` | takeoff, quantity, extraction, pricing, waste factor, material | `lib/takeoff-*.ts` |
| `document-intelligence` | OCR, document processing, RAG, semantic search, PDF | `lib/document-processor.ts`, `lib/rag.ts` |
| `field-operations` | daily report, weather delay, labor, equipment, progress photo | `lib/daily-report-*.ts` |

### Priority Order (when multiple match)
1. **data-sync** - Explicit sync/integration requests
2. **project-controls** - EVM, schedules, budgets
3. **quantity-surveyor** - Quantities, takeoffs, pricing
4. **document-intelligence** - Document processing, search
5. **field-operations** - Daily reports, field data

### Agent Chaining

| Workflow | Chain | Trigger Example |
|----------|-------|-----------------|
| Document → Budget | `document-intelligence` → `quantity-surveyor` → `project-controls` | "Extract quantities and update budget" |
| Daily Report Sync | `field-operations` → `data-sync` → `project-controls` | "Sync daily report and show EVM" |
| Full Refresh | `document-intelligence` → `data-sync` | "Reprocess documents and sync all" |

### Auto-Invocation Rules
- "Calculate EVM" → `project-controls`
- "Extract quantities from drawings" → `document-intelligence` then `quantity-surveyor`
- "Sync daily report" → `field-operations` then `data-sync`
- "Takeoff pricing issue" → `quantity-surveyor`
- "OCR not working" → `document-intelligence`

### Data Flow

```
document-intelligence
    ↓ extracts data
quantity-surveyor ←→ project-controls
    ↓ quantities        ↓ budgets
field-operations ←←←
    ↓ daily reports
data-sync (orchestrates all)
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

## Known Quirks

### Windows Webpack Path Warnings
On Windows, webpack may show spurious warnings about exports not found (e.g., `downloadFile` from `@/lib/s3`). This is caused by path case sensitivity differences (`C:\Users` vs `c:\Users`) in webpack's static analysis. These warnings are cosmetic - the exports exist and TypeScript validates correctly. Routes work at runtime.
