# Quick Handoff Guide - Multi-Agent Coordination

## The Problem
Every time we want to coordinate between Claude Code, Cursor, and Codex, we need to create task files. This guide makes it easy.

## The Solution: Automated Task Generation

### Step 1: Update Workflow Status
Make sure `.workflow-status.json` has the next agent's work assigned:
```json
{
  "currentWork": {
    "codex": {
      "status": "in-progress",
      "task": "Add unit tests",
      "files": ["types/takeoff.ts", "__tests__/"]
    }
  }
}
```

### Step 2: Generate Task Files

**Option A: Use PowerShell Script (Easiest)**
```powershell
.\scripts\handoff-to-agent.ps1 codex
```

**Option B: Use Node.js Directly**
```bash
node scripts/generate-agent-tasks.js codex
```

**Option C: Manual (if script doesn't work)**
- Copy `CODEX_QUICK_START.md` template
- Fill in details from `.workflow-status.json`
- Save as `{AGENT}_QUICK_START.md`

### Step 3: Give Agent the Prompt

**For Codex:**
```
Read and complete tasks in CODEX_QUICK_START.md
```

**For Cursor:**
```
Read and complete tasks in CURSOR_QUICK_START.md
```

**For Claude Code:**
```
Read and complete tasks in CLAUDE-CODE_QUICK_START.md
```

## Agent Names

- **codex** → Generates `CODEX_QUICK_START.md` and `CODEX_TASKS.md`
- **cursor** → Generates `CURSOR_QUICK_START.md` and `CURSOR_TASKS.md`
- **claude-code** → Generates `CLAUDE-CODE_QUICK_START.md` and `CLAUDE-CODE_TASKS.md`

## What Gets Generated

1. **`{AGENT}_QUICK_START.md`** - Simple, actionable instructions
   - Current task overview
   - Priority order
   - Quick steps
   - Key files

2. **`{AGENT}_TASKS.md`** - Detailed breakdown
   - Full context
   - Step-by-step instructions
   - Code examples
   - Testing setup
   - Success criteria

## Example Workflow

### Claude Code → Codex Handoff

1. **Claude Code completes work:**
   ```bash
   git commit -m "[CLAUDE CODE] Phase 1: Refactor component"
   ```

2. **Update workflow status:**
   - Edit `.workflow-status.json`
   - Mark `claude-code` as `completed`
   - Mark `codex` as `in-progress`

3. **Generate tasks:**
   ```powershell
   .\scripts\handoff-to-agent.ps1 codex
   ```

4. **Give Codex prompt:**
   ```
   Read and complete tasks in CODEX_QUICK_START.md
   ```

5. **Codex works and commits:**
   ```bash
   git commit -m "[CODEX] Phase 1: Add unit tests"
   ```

## Troubleshooting

**Script fails:**
- Check `.workflow-status.json` has work for the agent
- Agent name must match (case-insensitive)
- Try: `node scripts/generate-agent-tasks.js codex`

**Tasks not clear enough:**
- Manually edit the generated files
- Add more examples
- Reference specific file paths

**Agent still confused:**
- Simplify `{AGENT}_QUICK_START.md`
- Break tasks into smaller steps
- Add code examples

## Files Created

- `scripts/generate-agent-tasks.js` - Main generation script
- `scripts/handoff-to-agent.ps1` - PowerShell wrapper
- `.templates/agent-task-template.md` - Template file
- `WORKFLOW_TASK_GENERATION.md` - Full documentation

## See Also

- `WORKFLOW_TASK_GENERATION.md` - Detailed documentation
- `MULTI_AGENT_WORKFLOW.md` - Overall workflow guide
- `ROLE_ASSIGNMENTS.md` - Agent role definitions
