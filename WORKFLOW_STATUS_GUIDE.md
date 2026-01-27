# How to Update Workflow Status

Quick guide for updating `.workflow-status.json` and `WORKFLOW_LOG.md`.

## When to Update

- **Before starting work** - Claim your task
- **While working** - Update progress if needed
- **After completing work** - Mark as done
- **When deploying** - Update deployment status

---

## Updating `.workflow-status.json`

### Starting Work

**Example: Claude starting a feature**

```json
{
  "currentWork": {
    "agent": "claude",
    "task": "Implement budget export feature",
    "files": ["lib/budget-export.ts", "app/api/budget/export/route.ts"],
    "status": "in-progress",
    "started": "2026-01-27T14:30:00Z",
    "branch": "claude/budget-export",
    "environment": "cursor"
  },
  "queue": [],
  ...
}
```

**Example: Codex starting a script**

```json
{
  "currentWork": {
    "agent": "codex",
    "task": "Create migration script for budget data",
    "files": ["scripts/migrate-budget-data.ts"],
    "status": "in-progress",
    "started": "2026-01-27T14:30:00Z",
    "branch": "codex/migrate-budget",
    "environment": "cursor"
  },
  ...
}
```

### Completing Work

**Move from `currentWork` to `recent`:**

```json
{
  "currentWork": null,
  "recent": [
    {
      "agent": "claude",
      "task": "Implement budget export feature",
      "completed": "2026-01-27T16:00:00Z",
      "commit": "abc123",
      "branch": "claude/budget-export"
    }
  ],
  ...
}
```

### Adding to Queue

```json
{
  "queue": [
    {
      "agent": "codex",
      "task": "Generate test fixtures for budget API",
      "priority": "medium",
      "dependsOn": "claude/budget-export"
    }
  ],
  ...
}
```

### Deployment Status

**When ready to deploy:**

```json
{
  "deployment": {
    "status": "ready",
    "triggeredBy": "human",
    "branch": "main",
    "commit": "abc123"
  },
  ...
}
```

**After DeepAgent deploys:**

```json
{
  "deployment": {
    "status": "deployed",
    "triggeredBy": "human",
    "branch": "main",
    "commit": "abc123",
    "deepAgentStatus": "completed",
    "deployedAt": "2026-01-27T17:00:00Z"
  },
  ...
}
```

---

## Updating `WORKFLOW_LOG.md`

### Starting Work

Add to "🟢 Active Work" section:

```markdown
## 🟢 Active Work

### [2026-01-27 14:30] Claude
**Task**: Implement budget export feature
**Files**: `lib/budget-export.ts`, `app/api/budget/export/route.ts`
**Status**: In progress
**Branch**: `claude/budget-export`
**ETA**: 2 hours

---
```

### Completing Work

Move from "🟢 Active Work" to "✅ Recently Completed":

```markdown
## ✅ Recently Completed

### [2026-01-27 16:00] Claude
**Task**: Implement budget export feature
**Files**: `lib/budget-export.ts`, `app/api/budget/export/route.ts`
**Commit**: `abc123`
**Notes**: Ready for review and testing

---
```

### Blockers

Add to "🟡 Blocked / Needs Attention":

```markdown
## 🟡 Blocked / Needs Attention

### [2026-01-27 15:00] Claude
**Issue**: Need database migration before feature work
**Action**: Waiting for Codex to create migration script
**Blocked by**: `codex/migrate-budget`

---
```

### Queue Items

Add to "📋 Queue":

```markdown
## 📋 Queue

1. **Codex**: Generate test fixtures for budget API (depends on: claude/budget-export)
2. **Claude**: Review and refactor schedule component
3. **Human**: Test budget export feature

---
```

---

## Quick Examples

### Example 1: Starting a Task

**1. Update `.workflow-status.json`:**
```json
"currentWork": {
  "agent": "claude",
  "task": "Fix bug in chat interface",
  "files": ["components/chat-interface.tsx"],
  "status": "in-progress",
  "started": "2026-01-27T14:30:00Z",
  "branch": "claude/fix-chat-bug",
  "environment": "cursor"
}
```

**2. Update `WORKFLOW_LOG.md`:**
```markdown
## 🟢 Active Work

### [2026-01-27 14:30] Claude
**Task**: Fix bug in chat interface
**Files**: `components/chat-interface.tsx`
**Status**: In progress
**Branch**: `claude/fix-chat-bug`

---
```

### Example 2: Completing a Task

**1. Update `.workflow-status.json`:**
```json
"currentWork": null,
"recent": [
  {
    "agent": "claude",
    "task": "Fix bug in chat interface",
    "completed": "2026-01-27T15:00:00Z",
    "commit": "def456",
    "branch": "claude/fix-chat-bug"
  }
]
```

**2. Update `WORKFLOW_LOG.md`:**
- Remove from "🟢 Active Work"
- Add to "✅ Recently Completed"

---

## Tips

1. **Always update both files** - JSON for structure, Markdown for readability
2. **Use timestamps** - ISO format: `2026-01-27T14:30:00Z`
3. **Be descriptive** - Clear task names and file lists
4. **Update immediately** - When starting/completing work
5. **Keep it current** - Don't let status get stale

---

## Using Cursor Chat

You can also ask me (Claude) to update status:

```
You: "Update status - I'm starting work on budget export feature"
Claude: [Updates both files automatically]
```

Or:

```
You: "Mark the budget export feature as complete, commit abc123"
Claude: [Moves from currentWork to recent]
```

---

## Quick Reference

**File**: `.workflow-status.json`
- **Purpose**: Machine-readable status
- **Update**: When starting/completing work, deploying

**File**: `WORKFLOW_LOG.md`
- **Purpose**: Human-readable log
- **Update**: Same as JSON, but in markdown format

**Both files should stay in sync!**
