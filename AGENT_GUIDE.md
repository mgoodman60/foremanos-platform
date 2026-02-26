# ForemanOS Agent Guide

This guide is for any AI coding agent (Cursor, Copilot, Claude, etc.) working in the ForemanOS repo. It gives a fast orientation, the non‑negotiable rules, and links to deeper docs for each major area of the system.

For a full architectural deep dive (all models, services, and pipelines), read `CLAUDE.md`. For cross‑agent fundamentals and golden rules, see `AGENTS.md`.

---

## Golden rules (must follow)

These are the top rules every agent must follow. The more detailed list lives in `AGENTS.md`.

- **Build & tests**: Don’t break the build (`npm run build`) or existing tests (`npm test -- --run`).
- **No unsolicited commits/pushes**: Only commit or push when the user explicitly asks.
- **Dependencies**: Don’t add packages without calling it out and updating `package.json`.
- **Minimal surface area**: Prefer editing existing files over creating new ones unless the change clearly needs a new file.
- **Respect conventions**: Follow existing patterns for logging (`lib/logger.ts`), API routes, Prisma models, and React component structure.
- **Don’t over‑engineer**: Avoid speculative abstractions and unused flexibility; match the project’s current style.

See `AGENTS.md` → “Golden Rules” for the full version.

---

## Key directories and files

- `app/` – Next.js App Router, API routes under `app/api/**`, project pages under `app/project/[slug]/**`.
- `components/` – React components (dashboard widgets, document library, room browser, plan navigator, floor‑plan viewer, layout).
- `lib/` – Backend services (auth, RAG, S3/R2, logging, rate limiting, document/vision pipeline, analytics, etc.).
- `prisma/` – Prisma schema and migrations.
- `__tests__/` – Vitest unit and integration tests.
- `e2e/` – Playwright E2E tests.
- `src/trigger/` – Trigger.dev tasks for document processing and agents.

For a more detailed directory map and key file list, see `AGENTS.md` → “Directory Structure” and “Key Files You’ll Touch Often”.

---

## How to approach changes (agent workflow)

1. **Orient yourself**
   - Skim this guide and `AGENTS.md`.
   - For anything touching architecture, also skim the relevant section of `CLAUDE.md`.
2. **Find the right area**
   - For React/UI changes, start with the frontend guide in `docs/agents/frontend-react.md`.
   - For backend/services or APIs, see `docs/agents/backend-services.md`.
   - For document intelligence or Trigger.dev tasks, see `docs/agents/document-pipeline.md`.
   - For schema or data model work, see `docs/agents/database-schema.md`.
   - For tests, see `docs/agents/testing-quality.md`.
3. **Plan before editing**
   - Identify the smallest set of files you need to touch.
   - Preserve existing patterns (naming, error handling, logging, test layout).
4. **Implement conservatively**
   - Keep changes focused and incremental.
   - Prefer reusing helpers and utilities over adding new ones.
5. **Verify**
   - Run the appropriate commands from `AGENTS.md` / `CLAUDE.md` (build, tests, lint) for the files you touched.
6. **Summarize clearly**
   - Describe what changed, why, and any follow‑ups, without restating entire diffs.

---

## Sub‑guides for specific areas

Use these short guides when working in a particular part of the system:

- **Frontend React / Next.js**
  - `docs/agents/frontend-react.md`
  - Covers:
    - App Router patterns (`app/project/[slug]/**`).
    - Server vs client component boundaries.
    - Streaming dashboard widgets (e.g. `components/dashboard/server-widgets.tsx`).
    - Large orchestrators like `components/document-library/index.tsx` and their subcomponents.
    - React performance conventions (`useMemo`, `useCallback`, `React.memo`).

- **Backend services / lib/**
  - `docs/agents/backend-services.md`
  - Covers:
    - Service layout in `lib/`.
    - Auth, logging, S3/R2, RAG, rate limiting.
    - API route patterns under `app/api/**`.

- **Document intelligence pipeline**
  - `docs/agents/document-pipeline.md`
  - Covers:
    - Vision/document processing orchestrators.
    - Key modules in `lib/document-processor*`, `lib/vision-api-multi-provider.ts`, and `src/trigger/**`.
    - Where to be extra careful and which docs to read first.

- **Database schema / Prisma**
  - `docs/agents/database-schema.md`
  - Covers:
    - How to work with `prisma/schema.prisma`.
    - Migration and `prisma db push` practices.
    - Important cascade rules and constraints.

- **Testing & quality**
  - `docs/agents/testing-quality.md`
  - Covers:
    - Running and structuring Vitest unit/integration tests.
    - Running and structuring Playwright E2E tests.
    - Shared mocks and patterns (`vi.hoisted`, test helpers).

---

## Deep‑dive references

When you need more detail:

- `CLAUDE.md` – Full architecture overview, model list, service catalog, and detailed document pipeline.
- `AGENTS.md` – Cross‑agent golden rules, directory map, key files, and critical subsystems.
- Existing docs in `docs/` – product and UI/UX recommendations (`docs/ui-improvement-recommendations.md`, etc.).

---

## Keeping this guide up to date

- When you make **structural changes** (new major feature areas, large refactors), update:
  - The relevant sub‑guide under `docs/agents/`.
  - Any affected links or summaries in this file.
- Prefer **adding a new sub‑guide** over making one guide excessively long.
- If you introduce a new “critical path” subsystem (similar to the document pipeline), add:
  - A short section here describing where its guide lives.
  - A new `docs/agents/<area>.md` focused on how agents should work with it.

