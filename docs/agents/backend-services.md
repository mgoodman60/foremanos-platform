# Backend Services / lib — Agent Guide

Use this guide when working on API routes under `app/api/`, service modules in `lib/`, or server-side data fetching.

## API route pattern

Every API route follows this order:

1. **Auth check** — Use `getServerSession(authOptions)` or the project’s `requireAuth()` / route-specific auth.
2. **Rate limit** — Apply rate limiting where defined (see `lib/rate-limiter.ts`).
3. **Validation** — Validate query/body with Zod on POST/PUT; use `z.coerce` for query params where appropriate.
4. **Business logic** — Call services, Prisma, etc.
5. **Response** — Return JSON; use `apiError()` and `apiSuccess()` from `lib/api-error.ts` for consistent error shapes.

Example:

```typescript
import { apiError } from '@/lib/api-error';
return apiError('Not found', 404, 'NOT_FOUND');
```

Use Zod for input validation on POST/PUT routes.

## Key service modules (lib/)

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma singleton; lazy-loaded for Trigger.dev Docker builds |
| `lib/auth.ts` | `requireAuth()` — shared server auth helper |
| `lib/auth-options.ts` | NextAuth configuration |
| `lib/logger.ts` | Structured logger — use this instead of `console.log` / `console.error` in server code |
| `lib/api-error.ts` | `apiError()`, `apiSuccess()` for API responses |
| `lib/rate-limiter.ts` | Distributed rate limiting (Redis with in-memory fallback) |
| `lib/s3.ts` | AWS S3 / Cloudflare R2 operations (timeout, retry) |
| `lib/design-tokens.ts` | Centralized color palette — use tokens in UI code |
| `lib/plugin/index.ts` | Plugin barrel (skill-loader, agent-executor, reference-loader, etc.) |

## Server data layer (lib/data/)

Used by Server Components only; no API routes in the request path for SC data.

- `get-project.ts` — `getProject(slug)` — auth + project lookup (shared by all project pages).
- `get-documents.ts`, `get-budget-data.ts`, `get-schedule-data.ts`, `get-field-ops.ts`, `get-intelligence.ts`, `get-dashboard-data.ts` — cache()-wrapped Prisma queries for dashboard and project pages.

When adding new server-only data needs for a page, add or extend a function in `lib/data/` and call it from the Server Component; do not add unnecessary client fetches for data the server can provide.

## Logging

In server-side code (including API routes and `lib/` modules):

```typescript
import { logger } from '@/lib/logger';
logger.info('CONTEXT_NAME', 'What happened', { key: 'value' });
logger.error('CONTEXT_NAME', 'What failed', error, { meta });
```

Use SCREAMING_SNAKE_CASE for the context name. Do not use `console.log` / `console.error` in new server code.

## RAG and chat

- **lib/rag/** — Document retrieval, context generation, query classifiers (barrel re-exports from `lib/rag.ts` and `lib/rag-enhancements.ts`).
- **lib/chat/** — Chat pipeline: middleware (maintenance, auth, rate limit, validation, query limit), processors (conversation, RAG, cache, LLM stream). Context building and plugin integration live in `lib/chat/processors/context-builder.ts`.

## Unused variables and Prisma

- Prefix unused variables/params with `_` (ESLint is configured to allow this).
- Prisma: JSON fields may require `as unknown as Type`; relation filters use PascalCase model names (`Document`, not `document`). `InputJsonValue` does not accept `Record<string, unknown>` — use a compatible record type.

## References

- [CLAUDE.md](../../CLAUDE.md) — Key Service Modules, Server Data Layer, API Route Pattern, Chat Modular Pipeline.
- [AGENTS.md](../../AGENTS.md) — Code Conventions, Key Files You'll Touch Often.
