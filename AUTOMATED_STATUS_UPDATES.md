# Automated Workflow Status Updates

This document explains how to automate workflow status updates so you don't have to manually update `.workflow-status.json` and `WORKFLOW_LOG.md`.

## How It Works

The automation system detects:
- **Commits** - Automatically updates status when you commit with `[CLAUDE]`, `[CODEX]`, or `[HUMAN]` prefixes
  - Works for all agents: Claude, Codex, and Human
  - Detects agent from commit message prefix
  - Updates status files automatically
- **Pushes** - Updates deployment status when you push
- **Git activity** - Tracks work based on commit messages

## Setup

### Option 1: Git Hooks (Automatic)

Git hooks run automatically after commits. The hook is already set up at `.git/hooks/post-commit`.

**To enable it:**
```powershell
# Make sure the hook is executable (on Windows, this may not be needed)
# The hook will run automatically after every commit
```

**What it does:**
- After you commit with `[CLAUDE]`, `[CODEX]`, or `[HUMAN]` prefix
- Automatically updates `.workflow-status.json`
- Moves completed work from `currentWork` to `recent`

### Option 2: Git Wrapper Script (Semi-Automatic)

Use the wrapper script instead of `git` directly:

```powershell
# Instead of: git commit -m "[CLAUDE] My task"
.\scripts\git-wrapper.ps1 commit -m "[CLAUDE] My task"

# Instead of: git push
.\scripts\git-wrapper.ps1 push
```

**What it does:**
- Runs the git command
- Automatically updates workflow status
- Shows status update messages

### Option 3: Claude Auto-Detection (Smart)

I (Claude) can automatically detect and update status when:
- You make commits with workflow prefixes
- You push to GitHub
- You tell me about your work

**Just tell me:**
- "I just committed [CLAUDE] task name"
- "Codex just committed [CODEX] task name"
- "I just pushed to main"
- "Update status from my latest commit"

I'll read the git log and update status automatically for any agent (Claude, Codex, or Human).

## What Gets Updated Automatically

### After Commit

If your commit message has `[CLAUDE]`, `[CODEX]`, or `[HUMAN]`:

1. **If you have `currentWork` set:**
   - Moves it to `recent` (marks as complete)
   - Adds commit hash and timestamp

2. **If no `currentWork`:**
   - Adds commit to `recent` list

### After Push

- Updates `deployment.status` to `ready`
- Records branch and commit hash

### Manual Updates Still Needed

You still need to manually update (or ask me):
- **Starting work** - Set `currentWork` when beginning a task
- **Adding to queue** - Queue items for other agents
- **Blockers** - Document when you're blocked

## Examples

### Example 1: Automatic Update After Commit (Claude)

```powershell
# 1. Start work (manual or ask Claude)
# Update status: "I'm starting work on budget export"

# 2. Do your work...

# 3. Commit with prefix
git commit -m "[CLAUDE] Implement budget export feature"

# ✅ Status automatically updated!
# - currentWork moved to recent
# - Commit hash and timestamp added
```

### Example 1b: Automatic Update After Commit (Codex)

```powershell
# 1. Start work (manual or ask Claude/Codex)
# Update status: "Codex is starting work on migration script"

# 2. Codex does the work...

# 3. Commit with prefix
git commit -m "[CODEX] Create migration script for budget data"

# ✅ Status automatically updated!
# - currentWork moved to recent (if Codex had currentWork set)
# - Commit hash and timestamp added
```

### Example 2: Using Wrapper Script

```powershell
# Claude
.\scripts\git-wrapper.ps1 commit -m "[CLAUDE] Fix chat bug"

# Codex
.\scripts\git-wrapper.ps1 commit -m "[CODEX] Generate test fixtures"

# ✅ Status updated automatically for both
```

### Example 3: Ask Claude

```powershell
# After committing
You: "Update status from my latest commit"
Claude: [Reads git log, updates status automatically]
# Works for [CLAUDE], [CODEX], and [HUMAN] commits
```

## Configuration

### Customize Auto-Detection

Edit `scripts/update-workflow-status.js` to:
- Change how commit messages are parsed
- Adjust what gets updated
- Add custom logic

### Disable Auto-Updates

To disable automatic updates:

1. **Remove git hook:**
   ```powershell
   Remove-Item .git\hooks\post-commit
   ```

2. **Don't use wrapper script:**
   - Just use `git` directly
   - Update status manually or ask Claude

## Best Practices

1. **Always use commit prefixes** - `[CLAUDE]`, `[CODEX]`, `[HUMAN]`
   - Enables automatic detection
   - Makes status updates work

2. **Set currentWork when starting** - Still manual or ask Claude
   - Automation handles completion
   - You handle starting

3. **Review auto-updates** - Check status files after commits
   - Make sure updates are correct
   - Adjust if needed

4. **Combine with manual updates** - Use both
   - Automation for commits/pushes
   - Manual/Claude for starting work, queue, blockers

## Troubleshooting

### Auto-updates not working?

1. **Check git hook:**
   ```powershell
   Test-Path .git\hooks\post-commit
   ```

2. **Check script exists:**
   ```powershell
   Test-Path scripts\update-workflow-status.js
   ```

3. **Test manually:**
   ```powershell
   node scripts/update-workflow-status.js commit
   ```

### Hook not running?

- On Windows, git hooks should work automatically
- If not, try using the wrapper script instead
- Or just ask Claude to update status

### Want more automation?

Ask Claude to:
- Create custom hooks
- Add more auto-detection
- Integrate with other tools

---

## Summary

**Automatic:**
- ✅ Status updates after commits (with `[CLAUDE]`, `[CODEX]`, or `[HUMAN]` prefixes)
- ✅ Works for all agents: Claude, Codex, and Human
- ✅ Deployment status after push
- ✅ Moving completed work to recent

**Still Manual (or ask Claude):**
- Starting work (set currentWork) - for any agent
- Adding to queue - for any agent
- Documenting blockers - for any agent

**Best of both worlds:**
- Automation handles routine updates
- You/Claude handle planning and coordination
