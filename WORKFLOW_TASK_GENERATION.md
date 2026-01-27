# Workflow Task Generation Guide

## Problem
Every time we want to coordinate between Claude Code, Cursor, and Codex, we need to manually create task files. This is repetitive and error-prone.

## Solution
Use the automated task generation system.

## Quick Usage

### Generate Tasks for Codex
```bash
node scripts/generate-agent-tasks.js codex
```

### Generate Tasks for Cursor
```bash
node scripts/generate-agent-tasks.js cursor
```

### Generate Tasks for Claude Code
```bash
node scripts/generate-agent-tasks.js "claude-code"
```

## What It Does

1. **Reads `.workflow-status.json`** - Gets current work assignments
2. **Reads `ROLE_ASSIGNMENTS.md`** - Gets detailed task breakdown
3. **Generates two files:**
   - `{AGENT}_QUICK_START.md` - Simple, actionable instructions
   - `{AGENT}_TASKS.md` - Detailed task breakdown

## Manual Alternative

If the script doesn't work or you need custom tasks:

1. **Copy the template:**
   - Use `.templates/agent-task-template.md` as a starting point
   - Or copy from an existing `{AGENT}_TASKS.md` file

2. **Fill in the details:**
   - Current phase
   - Specific tasks
   - Files to work with
   - Success criteria

3. **Save as:**
   - `{AGENT}_QUICK_START.md` (simple version)
   - `{AGENT}_TASKS.md` (detailed version)

## Standard Task File Structure

### Quick Start File (`{AGENT}_QUICK_START.md`)
- Current task overview
- Priority order
- Quick instructions
- Key files list
- Commit format

### Detailed Tasks File (`{AGENT}_TASKS.md`)
- Full context
- Step-by-step instructions
- Code examples
- Testing setup
- Success criteria
- Troubleshooting

## When to Generate Tasks

**Generate tasks when:**
- Starting a new phase
- Handing off work to another agent
- Agent is stuck and needs clearer instructions
- Work assignments change

**Don't generate if:**
- Agent is already working and making progress
- Tasks are very simple (can communicate via commit messages)
- Work is nearly complete

## Best Practices

1. **Update `.workflow-status.json` first** - So the script knows what to generate
2. **Be specific in task descriptions** - Include file paths, line numbers, examples
3. **Include context** - Reference related files, previous work
4. **Set clear priorities** - What to do first, what can wait
5. **Provide examples** - Show expected code patterns, commit formats

## Integration with Workflow

This system integrates with:
- `.workflow-status.json` - Current work status
- `ROLE_ASSIGNMENTS.md` - Role definitions
- `PHASE1_PROGRESS.md` (or similar) - Phase context
- Commit message automation - Uses commit prefixes

## Example Workflow

1. **Claude Code completes work:**
   ```bash
   git commit -m "[CLAUDE CODE] Phase 1: Refactor component"
   ```

2. **Update workflow status:**
   - Mark Claude Code as completed
   - Mark Codex as in-progress

3. **Generate tasks for Codex:**
   ```bash
   node scripts/generate-agent-tasks.js codex
   ```

4. **Give Codex the prompt:**
   ```
   Read and complete tasks in CODEX_QUICK_START.md
   ```

5. **Codex works and commits:**
   ```bash
   git commit -m "[CODEX] Phase 1: Add unit tests"
   ```

6. **Repeat for next agent**

## Troubleshooting

**Script fails:**
- Check `.workflow-status.json` has current work for the agent
- Ensure agent name matches (case-insensitive, but use exact format)

**Tasks not clear:**
- Manually edit the generated files
- Add more context from `ROLE_ASSIGNMENTS.md`
- Include code examples

**Agent still confused:**
- Simplify the quick start file
- Break tasks into smaller steps
- Add more examples
- Reference specific file paths and line numbers
