# Plan: Auto-Routing Agent Teams

## Status
**Status:** completed
**Created:** 2026-02-06
**Prerequisite:** `.claude/plans/2026-02-06-agent-teams-strategy.md` (completed — 9 teams designed, docs/templates done)

## Context

Agent teams should activate automatically based on the user's intent — not manual commands. When someone says "let's work on UI" or "let's build a new feature," Claude should recognize this warrants a team and spin one up. Same pattern as agent auto-selection (keywords → agent), but for teams (task intent → team creation).

**What exists:**
- Feature flag enabled: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json`
- 8 team compositions documented in CLAUDE.md and AGENTS_GUIDE.md (Team 9 not yet added)
- 24 agents ready to be spawned as teammates
- Templates in `.claude/plans/templates/` (team-invocation.md, implementation-spec.md)
- `content-writer` agent created, `ui` agent has Bash

**What's missing:**
- Auto-routing rules that map user intent → team
- Orchestration instructions that tell Claude how to create and run the team
- A `/team` skill with spawn prompts and coordination logic
- An orchestrator-first directive in CLAUDE.md telling Claude to delegate, not implement
- Team 9 (Full-Stack Feature) added to all docs

**Reference docs:**
- Official agent teams docs: https://code.claude.com/docs/en/agent-teams
- Strategy doc: `.claude/plans/2026-02-06-agent-teams-strategy.md`

---

## Step 1: Create `/team` Skill with Full Orchestration

**File:** `.claude/skills/team/SKILL.md` **(new)**

This skill is the execution engine. It contains:

### A. Team Definitions with Spawn Prompts

For each of the 9 teams: slug, teammate names, agent types, and **complete spawn prompts** that give each teammate everything they need (role, task, key files, communication instructions).

### B. Orchestration Steps

Clear instructions Claude follows to:
1. `TeamCreate(team_name: "<slug>")`
2. Spawn research/review teammates first, then implementation teammates
3. Break the user's request into 5-6 tasks per teammate (right-sized)
4. Ensure each teammate owns distinct files (no conflicts)
5. Use delegate mode — coordinate, don't implement
6. Require plan approval for schema changes or risky modifications
7. Monitor (messages arrive automatically), redirect if stuck
8. Synthesize results when all tasks complete
9. Shutdown teammates and cleanup via `TeamDelete`

### C. Name/Number Aliases

Support `/team 4`, `/team quality`, `/team qr` — all route to the same team.

### D. List Mode

`/team` with no args prints the summary table.

### E. All 9 Team Definitions

| # | Slug | Teammates | Lead |
|---|------|-----------|------|
| 1 | `uiux-feature` | `ux-researcher` (ux-design), `ui-builder` (ui), `api-wirer` (coder), `qa` (tester) | ux-researcher |
| 2 | `construction-pipeline` | `doc-intel` (document-intelligence), `qty-surveyor` (quantity-surveyor), `sync-lead` (data-sync), `doc-writer` (documenter), `qa` (tester) | doc-intel |
| 3 | `backend-api` | `api-dev` (coder), `db-dev` (database), `qa` (tester) | api-dev |
| 4 | `quality-resilience` | `test-lead` (tester), `sec-reviewer` (security), `resilience-reviewer` (resilience-architect), `bug-fixer` (fixer) | test-lead |
| 5 | `project-ops` | `controls-lead` (project-controls), `reports` (analytics-reports), `field-lead` (field-operations), `sync-lead` (data-sync), `photo-review` (photo-analyst) | controls-lead |
| 6 | `docs-marketing` | `doc-lead` (documenter), `researcher` (ux-design), `writer` (content-writer) | doc-lead |
| 7 | `migration-upgrade` | `refactor-lead` (refactoring-agent), `dep-fixer` (fixer), `qa` (tester), `sec-check` (security) | refactor-lead |
| 8 | `compliance-safety` | `compliance-lead` (compliance-checker), `field-lead` (field-operations), `submittal-lead` (submittal-tracker), `photo-review` (photo-analyst) | compliance-lead |
| 9 | `full-stack-feature` | `planner` (coder), `researcher` (ux-design), `db-dev` (database), `ui-builder` (ui), `qa` (tester), `sec-check` (security) | planner |

---

## Step 2: Add Team Auto-Routing to CLAUDE.md

**File:** `CLAUDE.md` — expand the existing `## Agent Teams` section

Add a **Team Auto-Selection** block (same pattern as the existing Agent Auto-Selection section). This tells Claude: when the user's request matches these patterns, **automatically create the team** instead of using a single agent.

### Routing Rules

| User Says | Team | Why |
|-----------|------|-----|
| "Let's work on UI", "build a new page", "add a component", "redesign the..." | Team 1 (UI/UX) | Multi-step: research → design → build → test |
| "Improve extraction", "fix the RAG", "takeoff accuracy", "new discipline" | Team 2 (Pipeline) | Coordinated: prompts + formulas + scoring + tests |
| "Add a new API endpoint", "build the backend for...", "new feature" (backend-scoped) | Team 3 (API) | Schema + route + tests as atomic unit |
| "Pre-deploy check", "validate before release", "run quality checks" | Team 4 (Quality) | Parallel: tests + security + resilience + fixes |
| "Generate reports", "project metrics", "sprint status" | Team 5 (Ops) | Data flow: field → sync → controls → reports |
| "Write docs", "marketing copy", "changelog", "landing page content" | Team 6 (Docs) | Research + technical docs + copy |
| "Upgrade Next.js", "migrate to ESLint 9", "fix vulnerabilities" | Team 7 (Migration) | Incremental: analyze → update → test → verify |
| "Safety audit", "permit check", "OSHA compliance" | Team 8 (Compliance) | Cross-domain: photos + field + permits + submittals |
| "Add a feature", "build a new...", "implement...", "let's add...", "new feature" | Team 9 (Feature) | Full-stack: schema → API → UI → tests → security |

### Team 9 — Full-Stack Feature (new)

**Slug:** `full-stack-feature`
**Teammates (6):**

| Name | Agent Type | Role |
|------|-----------|------|
| `planner` | `coder` | Lead — breaks feature into API contract + UI spec, builds API routes |
| `researcher` | `ux-design` | Research patterns, competitive analysis, design spec, accessibility |
| `db-dev` | `database` | Schema changes, migrations, indexes |
| `ui-builder` | `ui` | React components, pages, design tokens |
| `qa` | `tester` | Unit tests + E2E tests |
| `sec-check` | `security` | Vulnerability scan on new code (read-only) |

**Execution order:**
1. `researcher` explores patterns and writes design spec
2. `db-dev` designs schema + `planner` plans API contract (parallel)
3. `planner` builds API routes + `ui-builder` builds components (parallel, distinct files)
4. `qa` writes tests as deliverables land
5. `sec-check` reviews all new code for vulnerabilities
6. `planner` synthesizes and reports to user

**Routes on:** "add a feature", "build a new...", "implement...", "let's add...", "new feature", "I want to add..."

### Escalation Rule

**Single agent vs team:** Use a single agent for focused, single-file tasks. Auto-escalate to a team when the task:
- Spans 3+ files or concerns
- Involves research → implementation → testing
- Would benefit from parallel exploration
- The user says "let's work on..." (implies a session, not a quick fix)

---

## Step 3: Add Orchestrator-First Directive to CLAUDE.md

**File:** `CLAUDE.md` — add a new `## Operating Mode` section right after the opening line (`This file provides guidance...`), before `## Build & Development Commands`

This is the top-level behavioral directive. Claude reads CLAUDE.md at session start, so this shapes all behavior:

```markdown
## Operating Mode

**Claude operates as an orchestrator.** Do not write implementation code directly.
Delegate all coding work to specialized agents or agent teams.

### Decision Framework

**Use an agent team when:**
- The task involves 3+ independent workstreams (e.g., frontend + backend + tests)
- Code review is needed across multiple concerns (security, performance, coverage)
- Debugging where multiple hypotheses should be tested simultaneously
- Research or investigation where different angles should be explored in parallel
- Refactoring multiple modules that don't share files
- The user says "let's work on..." (implies a session, not a quick fix)

**Use a single agent (subagent) when:**
- A focused, single-concern task (one file, one module)
- The result just needs to be reported back
- Workers don't need to talk to each other

**Handle directly (no agent) when:**
- Trivial fixes (typo, single-line config change)
- Answering questions about the codebase
- The user explicitly says to do it directly

### What Claude Does Directly
- Read and analyze code (for planning and review)
- Run verification commands (build, test, lint) to check agent work
- Create/edit configuration and documentation files (CLAUDE.md, agents, skills, plans)
- Orchestrate agents and teams (spawn, assign, monitor, synthesize)
- Answer questions about the codebase
- Commit and push (when asked)

### Agent Team Best Practices
- Assign each teammate distinct files to avoid conflicts
- Use delegate mode when coordinating 3+ teammates
- Give each teammate specific context in their spawn prompt (they don't inherit conversation history)
- Aim for 5-6 tasks per teammate
- Require plan approval for risky or schema-changing work
- Start research/review teammates before implementation teammates
```

---

## Step 4: Update Agent Skill + Fix Stale Notes

**File:** `.claude/skills/agent/skill.md` — Add `content-writer` to Development Agents table
**File:** `.claude/plans/2026-02-06-agent-teams-strategy.md` — Fix "ui currently lacks Bash" note (already fixed), add Team 9 definition

---

## Step 5: Update AGENTS_GUIDE.md with Team 9

**File:** `.claude/AGENTS_GUIDE.md`

- Add Team 9 row to Teams Summary table
- Add Team 9 composition line
- Update "8" references to "9" where applicable

---

## Files Summary

| File | Change |
|------|--------|
| `.claude/skills/team/SKILL.md` | **New** — team orchestration skill with spawn prompts for all 9 teams |
| `CLAUDE.md` | Add Operating Mode directive + auto-routing rules + Team 9 to Agent Teams section |
| `.claude/AGENTS_GUIDE.md` | Add Team 9 to teams section |
| `.claude/plans/2026-02-06-agent-teams-strategy.md` | Add Team 9 definition + fix stale notes |
| `.claude/skills/agent/skill.md` | Add `content-writer` to listing |

---

## Verification

1. Say "let's work on UI" → Claude auto-creates Team 1, spawns 4 teammates, assigns tasks
2. Say "run pre-deploy checks" → Claude auto-creates Team 4, spawns tester/security/resilience/fixer
3. Say "add a button to the sidebar" → Claude delegates to `ui` agent (not a team, not doing it itself)
4. Say "fix a typo in README" → Claude does it directly (trivial exception)
5. `/team` lists all 9 teams
6. Teams shut down and clean up after completing work
7. Say "I want to add a new feature for equipment tracking" → Claude auto-creates Team 9 with 6 teammates
8. Claude never writes application code itself unless explicitly told to
