# ForemanOS

AI-powered construction project management platform. Extracts intelligence from construction documents (plans, specs, schedules) using multi-provider vision AI, and provides a comprehensive project management interface with budgets, schedules, field operations, and real-time analytics.

## Tech Stack

- **Framework**: Next.js 14.2 (App Router)
- **Database**: PostgreSQL 14+ via Prisma 6.7 (112 models)
- **Language**: TypeScript 5.8
- **Auth**: NextAuth.js (JWT-based)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Background Jobs**: Trigger.dev v3
- **AI**: Claude Opus/Sonnet, GPT-5.2, Gemini Pro 3 / 2.5 Pro
- **UI**: Tailwind CSS 3.3 + Radix UI + Shadcn components

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm

## Quick Start

```bash
git clone <repo-url> && cd foremanos
npm install
cp .env.example .env.local   # Configure environment variables
npx prisma generate
npx prisma db push            # Sync schema to database
npm run dev                   # http://localhost:3000
```

## Key Directories

```
app/api/              # 406 API routes
lib/                  # 277 service modules
components/           # 337 React components
prisma/               # Database schema (112 models)
src/trigger/          # Trigger.dev background tasks
__tests__/            # Vitest tests (245+ files, 9400+ tests)
e2e/                  # Playwright E2E tests (23 specs)
```

## Testing

```bash
npm test -- --run                                  # Run all tests
npm test -- __tests__/lib/<module>.test.ts --run    # Single test file
npx playwright test                                # E2E tests
```

## Deployment

- Push to `main` triggers Vercel auto-deploy
- Trigger.dev: `npx trigger.dev@latest deploy --env prod --skip-update-check`

## Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - 32-char random string
- `NEXTAUTH_URL` - Base URL (http://localhost:3000 for dev)

**Optional:**
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` - AI providers
- `S3_ENDPOINT`, `AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - Storage (R2/S3)
- `REDIS_URL` - Caching (falls back to in-memory)
- `STRIPE_SECRET_KEY` - Payments
- `CRON_SECRET` - Cron job authentication
- `RESEND_API_KEY` - Email notifications
- `TWILIO_AUTH_TOKEN` - SMS daily report entry
- `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_TENANT_ID` - OneDrive integration

See `CLAUDE.md` for comprehensive architecture documentation, `S3_SETUP_GUIDE.md` for storage setup.
