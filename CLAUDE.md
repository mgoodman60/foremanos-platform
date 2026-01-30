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
npx playwright test      # Run E2E tests
npx playwright test e2e/smoke.spec.ts --project=chromium  # Single browser E2E
npx prisma studio        # Open database GUI
npx prisma db push       # Sync schema to database
npx prisma generate      # Regenerate Prisma client
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
.claude/agents/   # 14 custom Claude Code agents
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

- **Vitest**: Unit/integration tests in `__tests__/`
- **Playwright**: E2E tests in `e2e/`
- **Node.js v25 compatibility**: Uses `pool: 'forks'` in vitest.config.ts

Run specific test file:
```bash
npm test -- __tests__/smoke/health.test.ts --run
```

## Custom Agents

14 specialized agents in `.claude/agents/` for:
- `qa-smoke-tester` - Run smoke tests
- `build-validator` - Check build errors
- `security-scanner` - Security analysis
- `db-expert` - Prisma schema help
- `e2e-tester` - Playwright tests
- `integration-test-writer` - Create new tests

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
