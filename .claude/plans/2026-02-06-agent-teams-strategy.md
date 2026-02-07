# Plan: Agent Teams Strategy for ForemanOS

## Status
**Status:** completed
**Created:** 2026-02-06
**Last Updated:** 2026-02-06

## Context

ForemanOS has 24 individual agents, 13 skills, 389 API routes, 299 components, 213 lib modules, and 112 Prisma models. Agent teams (new in Claude 4.6) allow multiple agents to work in parallel with shared task lists and coordination. The goal is to identify which team configurations would provide the highest ROI -- both for this project and as reusable patterns.

**Current pain points that teams address:**
- Model/config changes cascade across 30+ files (manual, error-prone)
- Construction extraction pipeline has 10 documented quality gaps requiring coordinated work
- Sync services have race conditions and N+1 queries that need end-to-end validation
- Test infrastructure needs parallel execution for faster feedback loops
- UI/UX work spans research -> design -> implementation -> accessibility -> testing

---

## Team 1: UI/UX Feature Team

**Purpose:** End-to-end UI feature delivery -- from research through implementation and testing.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `ux-design` | Research patterns, design specs, accessibility requirements |
| Implementer | `ui` | Build React components using design tokens |
| Coder | `coder` | Wire up API integration, state management |
| QA | `tester` | Write E2E tests, validate ARIA compliance |

**Workflow:**
1. UX-design researches patterns (has WebSearch/WebFetch) and writes a design spec
2. UI implements components following `lib/design-tokens.ts` palette
3. Coder connects to API routes and handles data flow
4. Tester writes Playwright E2E tests + validates accessibility

**Notes:**
- `ui` agent gets Bash added to its tools so it can verify builds independently
- Single agents remain available for smaller tasks -- teams are for multi-step work
- Team invocation template provides guardrails (task definition, acceptance criteria, scope)

**Best for:** New pages, feature modules, component library additions, accessibility overhauls

---

## Team 2: Construction Intelligence Pipeline Team

**Purpose:** Coordinated improvements to the document extraction -> RAG -> takeoff pipeline.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `document-intelligence` | Vision prompts, OCR, RAG scoring |
| Specialist | `quantity-surveyor` | Takeoff formulas, material quantities, symbol recognition |
| Orchestrator | `data-sync` | Pipeline flow, cross-system updates |
| Docs | `documenter` | Reference doc sync after code changes |
| QA | `tester` | Golden query snapshots, extraction regression tests |

**Workflow:**
1. Document-intelligence improves vision prompts per discipline (9 template types)
2. Quantity-surveyor validates takeoff formulas against `references/takeoff_formulas.md`
3. Data-sync ensures extracted data flows correctly through the pipeline
4. Documenter diffs changed code against reference docs and updates them
5. Tester runs golden query snapshots + extraction regression tests
6. Human review checkpoint before finalizing

**Mitigations:**

*Reference doc drift:* `documenter` is on the team specifically to sync reference docs after code changes. Team lead can't mark task complete until docs are verified current. Tester cross-checks extraction behavior against reference doc expectations.

*RAG scoring sensitivity:* Scoring snapshot tests -- tester runs "golden queries" (known queries with known-correct top results) before and after changes. Any drift in top-3 results gets flagged. Scoring changes are made one category at a time (e.g., only plumbing terms) to limit blast radius. Every change logged with before/after values and rationale for easy rollback.

*Domain validation:* Golden test fixtures -- a library of known-correct extractions from real plan sets. Sanity check rules from `validation_rules.md` (e.g., "concrete volume should be 0.5-2.0 CY per 100 SF of slab") run automatically. Human checkpoint at the end -- team presents summary for your sniff-test review.

**Best for:** Extraction gap fixes, RAG tuning, new discipline support, takeoff accuracy improvements

---

## Team 3: Back-End API Team

**Purpose:** Schema + API routes + unit tests delivered as one atomic unit. Pairs with Team 1 for full-stack features.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `coder` | API routes following middleware pattern, business logic |
| Backend | `database` | Prisma schema, migrations, query optimization |
| QA | `tester` | Unit tests for API routes + schema validation |

**Workflow:**
1. Database designs schema changes and creates migrations
2. Coder implements API route following the middleware pattern (Auth -> Rate Limit -> Validation -> Logic -> Response)
3. Tester writes unit tests for API + schema
4. Human review on migration diff before finalizing

**Mitigations:**

*Migration risk:* Migration safety checklist -- schema changes reviewed before `prisma db push`, rollback plan documented, run in dev first, `database` agent presents migration diff for human approval before executing. Never drop columns/tables without confirming data backup.

*Requirements clarity:* Implementation spec sheet filled out before team starts -- API contract (endpoints, request/response shapes), schema changes, acceptance criteria. This spec also serves as the handoff document to Team 1 when building full-stack features.

**Full-stack workflow (Team 3 + Team 1):**
1. Write implementation spec sheet (API contract, schema changes, UI requirements)
2. Invoke Team 3 -> builds schema + API + unit tests
3. Invoke Team 1 -> builds UI consuming the API + E2E tests
4. Optionally invoke Team 4 -> validates the whole thing

**Best for:** New API endpoints, schema additions, CRUD backends, data layer changes

---

## Team 4: Quality & Resilience Team

**Purpose:** Pre-deployment validation -- tests, security, error handling, build verification.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `tester` | Run full test suite, identify regressions |
| Security | `security` | OWASP scan, auth review, injection checks |
| Resilience | `resilience-architect` | Error handling, retry logic, graceful degradation |
| Fixer | `fixer` | Fix any issues found by the other three |

**Workflow:**
1. Tester runs `npm test -- --run` and `npm run build` in parallel
2. Security scans changed files for vulnerabilities (read-only)
3. Resilience-architect audits error handling patterns in changed code
4. Fixer addresses all issues found, then tester re-validates

**Best for:** Pre-release checks, post-refactor validation, dependency updates, security audits

---

## Team 5: Project Operations Team

**Purpose:** Automated project health -- daily reports, schedule analysis, cost tracking, KPI dashboards.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `project-controls` | Budget/schedule variance, EVM, cash flow |
| Reports | `analytics-reports` | KPI dashboards, data visualization, CSV exports |
| Field | `field-operations` | Daily reports, weather tracking, labor data ingestion |
| Sync | `data-sync` | Cross-system synchronization, consistency validation |
| Visual | `photo-analyst` | Progress detection, safety flags from field photos |

**Workflow:**
1. Pre-flight: data readiness check (see mitigations below)
2. Photo-analyst analyzes field photos for progress % and safety flags
3. Field-operations populates field data (daily reports, weather, labor) incorporating photo analysis
4. Data-sync runs sync services in defined order, validates consistency after each step
5. Project-controls calculates schedule variance, EVM metrics, cost alerts
6. Analytics-reports generates dashboards and exportable reports

**Mitigations:**

*Data ingestion:* Existing team members cover 90% of ingestion -- `field-operations` handles field data entry, `data-sync` triggers sync services to derive budget/cost data, `project-controls` populates schedule baselines. For the 10% requiring raw document processing (PDFs -> extracted data), run `document-intelligence` solo or invoke Team 2 as a prerequisite before Team 5 starts. Team template includes a "Data Readiness" pre-flight check.

*Sync race conditions:* Enforced sync execution order -- field data -> daily reports -> budget sync -> schedule sync -> cost rollup -> analytics. `data-sync` validates consistency after each step (record counts, cross-table totals). If stale or inconsistent data is detected, team halts and reports rather than generating incorrect dashboards.

*Dev vs production usefulness:* During development, team builds the operations features (report code, dashboard components, sync logic). For testing, use seed data via `npm run seed:test-user` or have `field-operations` generate synthetic test data. Team is useful in both phases -- building features in dev, running them in production.

**Best for:** Sprint planning, cost/schedule analysis features, report generation, data pipeline improvements

---

## Team 6: Documentation & Marketing Team

**Purpose:** Generate product documentation, feature descriptions, and marketing content.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `documenter` | API docs, JSDoc, technical documentation |
| Research | `ux-design` | Competitive analysis, user value propositions (WebSearch) |
| Writer | `content-writer` **(new agent)** | Marketing copy, feature descriptions, landing pages |

**Workflow:**
1. UX-design researches competitor positioning and user needs via web
2. Documenter generates API documentation and feature descriptions from code
3. Content-writer creates marketing copy, feature descriptions, and landing page content
4. Human review for brand voice and tone consistency

**Best for:** README updates, API documentation, feature release notes, changelog generation, landing pages

---

## Team 7: Migration & Upgrade Team

**Purpose:** Major dependency upgrades and breaking change migrations.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `refactoring-agent` | Large-scale code changes, codemods, breaking change analysis |
| Fixer | `fixer` | Dependency resolution, build error fixes |
| QA | `tester` | Run full test suite after each incremental change |
| Security | `security` | Verify upgrades resolve target vulns without introducing new ones |

**Workflow:**
1. Refactoring-agent analyzes breaking changes and creates migration plan
2. Fixer handles dependency updates and resolves compatibility issues
3. Tester runs suite after each incremental change (catch regressions early)
4. Security verifies the upgrade resolved target vulnerabilities

**Mitigations:**

*Incremental approach:* Changes are made one dependency at a time, with tester validating after each step. No big-bang upgrades.

*Rollback safety:* Each incremental change is committed separately so any step can be reverted without losing other progress.

**Best for:** Next.js major upgrades, Vitest major upgrades, ESLint flat config migration, dependency vulnerability remediation

---

## Team 8: Compliance & Safety Team

**Purpose:** Construction compliance workflow -- permits, inspections, OSHA, and safety documentation.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `compliance-checker` | Permits, inspections, OSHA compliance |
| Field | `field-operations` | Daily safety reports, site conditions |
| Submittals | `submittal-tracker` | RFIs, spec compliance, approvals |
| Visual | `photo-analyst` | Safety violation detection from field photos |

**Workflow:**
1. Photo-analyst reviews site photos for safety violations
2. Field-operations documents site conditions and safety observations
3. Compliance-checker cross-references against OSHA requirements and permit conditions
4. Submittal-tracker ensures all required documentation is filed

**Note:** `photo-analyst` is read-only -- `compliance-checker` handles any code changes needed.

**Best for:** Safety audits, permit tracking, OSHA compliance reviews, closeout documentation

---

## Team 9: Full-Stack Feature Team

**Purpose:** End-to-end feature delivery -- from research and schema through API, UI, tests, and security review.

| Role | Agent | Responsibility |
|------|-------|----------------|
| Lead | `coder` | Break feature into API contract + UI spec, build API routes |
| Research | `ux-design` | Research patterns, competitive analysis, design spec, accessibility |
| Backend | `database` | Schema changes, migrations, indexes |
| Frontend | `ui` | React components, pages, design tokens |
| QA | `tester` | Unit tests + E2E tests |
| Security | `security` | Vulnerability scan on new code (read-only) |

**Workflow:**
1. UX-design researches patterns and writes a design spec (parallel with step 2)
2. Database designs schema + Coder plans API contract (parallel)
3. Coder builds API routes + UI builds components (parallel, distinct files)
4. Tester writes tests as deliverables land
5. Security reviews all new code for vulnerabilities
6. Coder synthesizes results and reports to user

**Best for:** New features that span schema + API + UI + tests. Use when the feature is well-defined enough to work on all layers simultaneously rather than sequentially (Team 3 -> Team 1).

---

## Comparison Matrix

| Team | Agents | Cost | ForemanOS Value | General Value | Frequency |
|------|--------|------|-----------------|---------------|-----------|
| 1. UI/UX Feature | 4 | High | **High** | **High** | Per feature |
| 2. Construction Pipeline | 5 | High | **Critical** | Low | Per extraction gap |
| 3. Back-End API | 3 | Medium | **High** | **High** | Per feature |
| 4. Quality & Resilience | 4 | Medium | **High** | **High** | Pre-deploy |
| 5. Project Operations | 5 | Medium | **High** | Medium | Sprint/weekly |
| 6. Docs & Marketing | 3 | Low | Medium | **High** | Release cycle |
| 7. Migration & Upgrade | 4 | Medium | **High** | **High** | Per major upgrade |
| 8. Compliance & Safety | 4 | Medium | **High** | Low | Per audit/review |
| 9. Full-Stack Feature | 6 | High | **High** | **High** | Per feature |

---

## New Agent to Create

**`content-writer`** -- Marketing copy, feature descriptions, landing pages, changelog entries. Brand voice consistency.
- Tools: Read, Write, Edit, Grep, Glob
- File: `.claude/agents/content-writer.md`

## Agent Modification

**`ui`** -- Add `Bash` to tools list so it can run builds independently.
- File: `.claude/agents/ui.md`
- Change: `tools: Read, Write, Edit, Grep, Glob` -> `tools: Read, Write, Edit, Grep, Glob, Bash`

## Templates to Create

1. **Team Invocation Template** -- Guardrails checklist for every team invocation (task definition, acceptance criteria, scope boundaries, verification step)
2. **Implementation Spec Sheet** -- API contract, schema changes, UI requirements, acceptance criteria. Bridge between Team 3 (back-end) and Team 1 (front-end) for full-stack work.
3. **Migration Safety Checklist** -- Schema review, rollback plan, dev-first validation, human approval gate.

## Tasks
- [x] Research current agent ecosystem (23 agents, 13 skills)
- [x] Identify project pain points and development workflows
- [x] Design 8 team proposals with mitigations
- [x] Create plans directory infrastructure
- [x] Create `content-writer` agent in `.claude/agents/content-writer.md`
- [x] Add Bash to `ui` agent tools in `.claude/agents/ui.md`
- [x] Create team invocation template in `.claude/plans/templates/team-invocation.md`
- [x] Create implementation spec sheet template in `.claude/plans/templates/implementation-spec.md`
- [x] Update `.claude/AGENTS_GUIDE.md` with all 8 team definitions, routing, and usage patterns
- [x] Update `CLAUDE.md` with teams section
- [ ] Test Team 1 (UI/UX) with a small task
- [ ] Test Team 4 (Quality & Resilience) with a pre-deploy check

## Verification

- Invoke at least 2 teams with small test tasks to validate coordination
- Verify agents can communicate via `SendMessage`
- Confirm task list creation/management works across all members
- Verify `content-writer` agent loads and responds correctly
- Verify `ui` agent can now run Bash commands

## Notes

**Key agent constraints:**
- `security` is read-only (can't modify code)
- `photo-analyst` has no Bash access (read-only)
- `ux-design` is the only agent with WebSearch/WebFetch
- `ui` has Bash access for independent build verification

**Teams are ephemeral** -- created per task via `TeamCreate`, torn down when done. The "implementation" is defining patterns, documenting usage, and updating AGENTS_GUIDE.md.
