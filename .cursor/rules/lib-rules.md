# lib/ — Backend services

When editing code under `lib/` or API routes under `app/api/`:

- **Logging**: Use `logger` from `lib/logger.ts`; do not use `console.log` or `console.error` in new server code. Context names: SCREAMING_SNAKE_CASE.
- **API errors**: Use `apiError()` and `apiSuccess()` from `lib/api-error.ts` for consistent responses.
- **API route order**: Auth check → Rate limit → Validation → Business logic → Response. Use Zod for POST/PUT validation.
- **Unused variables**: Prefix with `_` (ESLint allows this).

See [docs/agents/backend-services.md](../../docs/agents/backend-services.md) for full backend patterns.
