# Team Invocation Checklist

> Copy this template and fill it out before invoking any agent team.

---

## 1. Task Definition

**What to build:**
<!-- One-paragraph description of the deliverable -->

**Acceptance criteria:**
<!-- Concrete pass/fail conditions — what does "done" look like? -->
- [ ] ...
- [ ] ...

**Scope boundaries:**
<!-- What is explicitly OUT of scope for this invocation? -->
- ...

---

## 2. Pre-flight

**Branch:** `feature/...`
**Data readiness:**
- [ ] Required files exist and are accessible
- [ ] Database schema is current (`npx prisma generate`)
- [ ] Environment variables set for relevant services
- [ ] No blocking build errors (`npm run build` passes)

**Prerequisites:**
<!-- Other teams or tasks that must complete first -->
- None / Team X must complete first because...

---

## 3. Team

**Team:** Team N — [Name]
**Lead:** `agent-name`
**Members:**

| Agent | Role | Key Deliverable |
|-------|------|-----------------|
| `lead-agent` | Lead | ... |
| `agent-2` | ... | ... |
| `agent-3` | ... | ... |

---

## 4. Task Breakdown

<!-- Numbered tasks for the shared task list. Order matters — earlier tasks may unblock later ones. -->

1. ...
2. ...
3. ...
4. ...

---

## 5. Verification

**Automated checks:**
- [ ] `npm run build` passes
- [ ] `npm test -- --run` passes (or specific test files)
- [ ] No new lint errors (`npm run lint`)

**Manual checks:**
- [ ] ...

---

## 6. Human Checkpoint

**Review before finalizing:**
<!-- What specifically needs human eyes before this work is merged/committed? -->
- [ ] ...

**Decision needed:**
<!-- Any choices the team should flag for human decision rather than deciding autonomously -->
- ...
