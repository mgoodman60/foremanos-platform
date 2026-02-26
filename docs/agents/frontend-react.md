# Frontend React / Next.js — Agent Guide

Use this guide when working on React components, project pages, or the Next.js App Router under `app/project/[slug]/` or `components/`.

## Server vs client component boundaries

- **All 14 project `page.tsx` files are Server Components** — no `'use client'` in any `app/project/[slug]/**/page.tsx`.
- **Pattern**: Each page is an async Server Component that calls `getProject(slug)` from `lib/data/get-project.ts`, then renders a single client child (e.g. `DocumentsPageContent`, `RoomsPageContent`).
- **Do not add `'use client'` to a page.tsx.** Put interactive logic in the corresponding `*-page-content.tsx` (or similar) client component and pass data as props.

## Project page pattern

```
app/project/[slug]/[feature]/page.tsx (async SC)
  -> getProject(params.slug)
  -> <FeaturePageContent project={project} userRole={...} />
```

Example: `app/project/[slug]/documents/page.tsx` -> `DocumentsPageContent`; `app/project/[slug]/rooms/page.tsx` -> `RoomsPageContent`.

## Dashboard (streaming)

The project dashboard (`app/project/[slug]/page.tsx`) uses streaming with independent Suspense boundaries per widget. Server widget wrappers live in `components/dashboard/server-widgets.tsx`. Client widgets accept optional `initialData`; when provided, they skip their own fetch. Skeletons are in `components/dashboard/widget-skeletons.tsx`.

## Key component areas

- **components/dashboard/** — Server widgets, client widgets, toolbar, Ask Foreman drawer.
- **components/document-library/** — Orchestrator in index.tsx; sub-components: document-grid, upload-zone, bulk-actions-toolbar, delete-confirm-dialog, types. Uses custom hooks for selection and processing progress.
- **components/room-browser/** — Orchestrator plus room filters, room list by floor, room card, bulk actions, comparison modal, MEP/finish tables.
- **components/plan-navigator/** — Sheet index, reference list, reference network tab; pure helpers in discipline-utils.ts.
- **components/floor-plan-viewer/** — Viewer toolbar, room grid, DWG panel, status-helpers.ts.

## React performance conventions

- **useMemo** — Used for derived/filtered/sorted data to avoid recomputation on every render.
- **useCallback** — Used for event handlers passed to memoized children or stable dependency arrays.
- **React.memo** — Applied to leaf/presentational components with stable props. Use lib/design-tokens.ts for colors.

## Data flow

Server to client: data from getProject() and lib/data/ flows into page props then into client components. Avoid re-fetching in the client data the server already provided (e.g. pass projectSlug as a prop). Keep form/selection/UI state in client components; use server for initial load and mutations via API routes.

## References

- [CLAUDE.md](../../CLAUDE.md) — Project Page Architecture, Server Data Layer, Document Intelligence Pipeline.
- [AGENTS.md](../../AGENTS.md) — Code Conventions, Gotchas.
