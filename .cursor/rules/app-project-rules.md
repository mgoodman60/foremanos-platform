# Project pages (app/project/[slug]/)

When editing project pages or their client content components:

- **Do not add `'use client'` to any `page.tsx`.** All 14 project pages are Server Components.
- **Pattern**: `page.tsx` is async, calls `getProject(slug)` from `lib/data/get-project.ts`, then renders a single client component (e.g. `DocumentsPageContent`, `RoomsPageContent`) with props.
- **Data flow**: Pass project identity and initial data from the server; avoid re-fetching in the client what the server already provided (e.g. pass `projectSlug` as a prop).

See [docs/agents/frontend-react.md](../../docs/agents/frontend-react.md) for full frontend patterns.
