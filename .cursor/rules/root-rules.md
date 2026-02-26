# ForemanOS — Root rules for AI agents

When working in this repo, follow these rules and use the central agent guide for details.

## Golden rules

1. **Don't break the build.** Run `npm run build` before considering any change complete.
2. **Don't break existing tests.** Run `npm test -- --run` (full suite).
3. **Don't commit or push without being asked.** Vercel auto-deploys on push to `main`.
4. **Don't add packages without mentioning it.** Update `package.json`; Vercel needs it.
5. **Prefer editing existing files** over creating new ones unless necessary.
6. **Don't over-engineer.** No speculative abstractions or feature flags for hypotheticals.

## Where to read more

- **Central guide**: [AGENT_GUIDE.md](../../AGENT_GUIDE.md) — Overview, workflow, and index of sub-guides.
- **Sub-guides** (in `docs/agents/`):
  - [frontend-react.md](../../docs/agents/frontend-react.md) — React / Next.js, server vs client, dashboard streaming, key components.
  - [backend-services.md](../../docs/agents/backend-services.md) — lib/, API routes, logging, RAG/chat.
  - [document-pipeline.md](../../docs/agents/document-pipeline.md) — Document/vision pipeline; read before touching.
  - [database-schema.md](../../docs/agents/database-schema.md) — Prisma schema, migrations, cascade rules.
  - [testing-quality.md](../../docs/agents/testing-quality.md) — Vitest, Playwright, mocks.
- **Deep dives**: [CLAUDE.md](../../CLAUDE.md), [AGENTS.md](../../AGENTS.md).
