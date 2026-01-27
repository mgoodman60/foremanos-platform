# ForemanOS - Multi-Agent Workflow Guide (Cursor-Optimized)

## Overview

This document defines how **You (Human)**, **Claude**, **Codex**, and **DeepAgent** collaborate on ForemanOS development. Both **Claude** and **Codex** can run either **in Cursor** or **separately**, with different advantages for each.

## Why Cursor Makes This Workflow Powerful

### Cursor's Unique AI Features

1. **Codebase Indexing**
   - Cursor automatically indexes your entire codebase
   - AI assistants (Claude, Codex) have instant access to all files
   - No need to manually provide context - Cursor does it automatically

2. **Native AI Chat**
   - Built-in chat interface (Claude can run natively in Cursor)
   - Full codebase awareness without file paths
   - Can reference files by semantic meaning, not just paths

3. **Inline AI Suggestions**
   - Real-time code suggestions as you type
   - Understands your project's patterns and conventions
   - Learns from your codebase structure

4. **Multi-File Context**
   - AI assistants can read multiple files simultaneously
   - Understands relationships between files
   - Better coordination through shared context

5. **Git Integration**
   - AI can see git history and changes
   - Understands what's been modified recently
   - Can coordinate based on commit history

## Agent Roles

### 👤 You (Human Developer in Cursor)
- Product decisions & feature prioritization
- Testing & QA
- Final code review & approval
- Strategic planning
- Deployment triggers
- **Cursor Advantage**: Use Cursor's chat to quickly understand what AI assistants have done

### 🤖 Claude (Can run in Cursor or separately)
- Architecture & design decisions
- Complex feature implementation
- Refactoring & code improvements
- Bug fixes & debugging
- Code reviews
- Technical documentation

**If running in Cursor:**
- Full codebase awareness, can read any file instantly
- Understands project structure automatically
- Semantic file finding
- Pattern recognition

**If running separately:**
- Uses status files for coordination
- May need explicit file paths
- Still benefits from clear documentation
- Can access codebase via API or file system

### ⚡ Codex (Can run in Cursor or separately)
- Scripts & utilities
- Data migrations
- Repetitive API endpoints
- Test generation
- Boilerplate code
- Quick fixes

**If running in Cursor:**
- Same codebase awareness as Claude
- Can read status files automatically
- Understands project structure

**If running separately:**
- Uses status files for coordination
- May need explicit file paths
- Still benefits from clear documentation

### 🚀 DeepAgent (Separate Deployment System)
- Pulling from GitHub
- Running database migrations
- Testing builds
- Deploying to production (foremanos.site)
- Fixing deployment issues
- Production monitoring

---

## Workflow: Flexible Agent Coordination

### Coordination Files

#### 1. `.workflow-status.json` (Real-time Status)
Tracks current work and prevents conflicts. Both Cursor and separate agents can read this.

```json
{
  "currentWork": {
    "agent": "claude",
    "task": "Implement budget export feature",
    "files": ["lib/budget-export.ts", "app/api/budget/export/route.ts"],
    "status": "in-progress",
    "started": "2026-01-27T10:00:00Z",
    "branch": "claude/budget-export",
    "environment": "cursor",
    "cursorContext": {
      "relatedFiles": ["lib/budget-service.ts", "components/budget/BudgetView.tsx"],
      "dependencies": ["@/lib/db", "@/lib/s3"]
    }
  },
  "queue": [
    {
      "agent": "codex",
      "task": "Generate test fixtures for budget API",
      "priority": "medium",
      "dependsOn": "claude/budget-export"
    }
  ],
  "deployment": {
    "status": "pending",
    "triggeredBy": "human",
    "branch": "main",
    "commit": "abc123",
    "deepAgentStatus": "queued"
  },
  "recent": []
}
```

#### 2. `WORKFLOW_LOG.md` (Historical Context)
Human-readable log. All agents can read this for context.

---

## Standard Workflow (Flexible for Both Environments)

### For Claude

#### If Running in Cursor:

1. **Check Status via Cursor Chat**
   ```
   You: "What's the current work status?"
   Claude: [Reads .workflow-status.json automatically]
   ```

2. **Understand Context via Cursor**
   - Cursor automatically indexes codebase
   - I can read related files without you providing paths
   - I understand project structure from Cursor's index

3. **Claim Work**
   - Update `.workflow-status.json` (I can do this via Cursor)
   - Set `environment: "cursor"`
   - Add `cursorContext` with related files I've identified

4. **Do Work**
   - Use Cursor's codebase awareness to find related files
   - Read multiple files simultaneously
   - Understand patterns from existing code
   - Write code following project conventions

5. **Complete Work**
   - Update status files
   - Commit with `[CLAUDE]` prefix
   - Add notes about what Codex should do next

#### If Running Separately:

1. **Check Status**
   ```bash
   # Read status file
   cat .workflow-status.json
   
   # Check recent commits
   git log --oneline -10
   
   # Pull latest
   git pull origin main
   ```

2. **Understand Context**
   - Read `WORKFLOW_LOG.md` for recent context
   - Read `CLAUDE_ONBOARDING.md` for project patterns
   - Check git history for recent changes
   - Read related files explicitly

3. **Claim Work**
   - Update `.workflow-status.json`
   - Set `environment: "separate"`
   - Document file paths you'll be working with

4. **Do Work**
   - Read files explicitly (need file paths)
   - Follow patterns from documentation
   - Use status files for coordination
   - Write code following project conventions

5. **Complete Work**
   - Update status files
   - Commit with `[CLAUDE]` prefix
   - Add notes about what Codex should do next

### For Codex

**If running in Cursor:**
- Same advantages as Claude (codebase awareness)
- Can read status files automatically
- Understands project structure

**If running separately:**
- Uses status files for coordination
- May need explicit file paths
- Still benefits from clear documentation

### For You (Human in Cursor)

1. **Use Cursor Chat to Check Status**
   ```
   You: "What's Claude working on?"
   Claude: [Reads .workflow-status.json and explains]
   ```

2. **Review Code in Cursor**
   - Cursor highlights changes
   - AI can explain what changed
   - See related files automatically

3. **Coordinate via Chat** (if Claude is in Cursor)
   ```
   You: "Claude, can you check if Codex's migration script is ready?"
   Claude: [Checks status, reads script, reports back]
   ```

4. **Trigger DeepAgent**
   - After review and merge
   - Tell DeepAgent: "pull and deploy"

### For DeepAgent

- Monitors GitHub or responds to commands
- Updates deployment status in `.workflow-status.json`
- Reports back via status file

---

## Cursor-Specific Coordination Features

### 1. Automatic Context Sharing (Cursor Only)

**How it works:**
- Cursor indexes your codebase
- When Claude works in Cursor, I automatically know:
  - Related files
  - Import patterns
  - Project structure
  - Recent changes

**Example:**
```
You: "Add a budget export feature"
Claude (in Cursor): [Automatically finds budget-service.ts, budget components, 
                     related API routes, understands patterns]
```

### 2. Semantic File Finding (Cursor Only)

**Instead of:**
- "Read lib/budget-service.ts" (requires knowing exact path)

**Cursor enables:**
- "Find the budget service file" (I find it automatically)
- "What files handle budget exports?" (I search semantically)
- "Show me all API routes for budgets" (I find them all)

### 3. Multi-Agent Awareness

**Both environments enable:**
- See what files other agents have modified (via git)
- Read other agents' work to understand what they do
- Suggest improvements to other agents' work
- Status files provide explicit coordination

**Example:**
```
Codex creates: scripts/migrate-budget-data.ts
Claude can: Read it (in Cursor automatically, separately with path),
            understand it, suggest improvements, or use it in new features
```

### 4. Pattern Recognition (Cursor Only)

**Cursor learns:**
- Your code patterns
- Component structure
- API route conventions
- Database query patterns

**Result:**
- AI assistants follow your patterns automatically
- Less coordination needed
- More consistent code

---

## Commit Message Conventions

### Format
```
[AGENT] Brief description

- Detailed change 1
- Detailed change 2
- Notes for next agent/human
- Environment: [cursor|separate]
- Cursor: [Any Cursor-specific notes if applicable]
```

### Examples

**Claude (in Cursor):**
```
[CLAUDE] Refactor budget service for better error handling

- Extracted error handling to separate utility
- Added retry logic for database operations
- Improved TypeScript types
- Environment: cursor
- Cursor: Found 3 related components that use this service automatically
- Ready for Codex to add tests
```

**Claude (separate):**
```
[CLAUDE] Refactor budget service for better error handling

- Extracted error handling to separate utility
- Added retry logic for database operations
- Improved TypeScript types
- Environment: separate
- Files modified: lib/budget-service.ts, lib/error-handler.ts
- Ready for Codex to add tests
```

**Codex:**
```
[CODEX] Generate test fixtures for budget API

- Created scripts/generate-budget-fixtures.ts
- Added sample data for testing
- Environment: [cursor|separate]
- Ready for use in test suite
```

---

## Conflict Prevention

### Before Starting Work

**If in Cursor:**
1. **Ask Cursor Chat**
   ```
   You: "Is anyone working on budget-related files?"
   Claude: [Checks .workflow-status.json, git status, 
            identifies any budget files being modified]
   ```

2. **Cursor's Git Integration**
   - See recent commits
   - Understand what's changed
   - Identify potential conflicts

3. **Automatic File Awareness**
   - Cursor knows which files are open
   - Knows what's been modified recently
   - Can warn about conflicts

**If separate:**
1. **Check Status Files**
   ```bash
   cat .workflow-status.json
   git status
   git log --oneline -10
   ```

2. **Check Git History**
   - See recent commits
   - Understand what's changed
   - Identify potential conflicts

3. **Manual File Awareness**
   - Check which files are in `currentWork`
   - Review recent commits
   - Identify potential conflicts

### File-Level Coordination

**Cursor makes this easier:**
- I can see if files are being edited
- I can check git status automatically
- I can identify related files that might conflict

**Separate requires:**
- Explicit checking of status files
- Manual git status checks
- Careful coordination via status files

---

## Best Practices

### For Claude

#### If in Cursor:
1. **Use Cursor's Codebase Awareness**
   - Don't ask for file paths - find them semantically
   - Read related files automatically
   - Understand patterns from existing code

2. **Leverage Cursor Chat**
   - Ask clarifying questions via chat
   - Explain what I'm doing
   - Coordinate with other agents

3. **Update Status Files**
   - Include `cursorContext` with related files found
   - Note patterns discovered
   - Document dependencies

#### If Separate:
1. **Use Status Files Explicitly**
   - Read `.workflow-status.json` before starting
   - Check `WORKFLOW_LOG.md` for context
   - Document file paths you're using

2. **Follow Documentation**
   - Read `CLAUDE_ONBOARDING.md` for patterns
   - Check `WORKFLOW_LOG.md` for recent work
   - Follow existing code patterns

3. **Update Status Files**
   - Keep `.workflow-status.json` current
   - Document in `WORKFLOW_LOG.md`
   - Include file paths in status

### For Codex

**If in Cursor:**
- Same as Claude - use codebase awareness
- Find files semantically
- Follow patterns automatically

**If separate:**
- Use status files explicitly
- Document file paths clearly
- Follow patterns from documentation

### For You (Human)

1. **Use Cursor Chat for Coordination** (if Claude is in Cursor)
   - "What's the current status?"
   - "What files is Claude working on?"
   - "Is Codex's script ready?"

2. **Leverage Cursor's Features**
   - See AI suggestions inline
   - Review changes with context
   - Understand relationships between files

3. **Coordinate Efficiently**
   - Cursor makes it easy to see what's happening
   - Chat interface for quick questions
   - Git integration shows recent work

---

## Quick Reference

### Status Files
- `.workflow-status.json` - Real-time status (all agents can read)
- `WORKFLOW_LOG.md` - Historical log (all agents can read for context)

### Branch Naming
- `claude/[feature-name]`
- `codex/[script-name]`
- `human/[feature-name]`

### Commit Prefixes
- `[CLAUDE]` - Claude's work
- `[CODEX]` - Codex's work
- `[HUMAN]` - Your direct work
- `[DEEPAGENT]` - Deployment notes

### Environment Indicators
- `environment: "cursor"` - Agent running in Cursor
- `environment: "separate"` - Agent running separately

### Cursor Commands (if Claude is in Cursor)

**Check Status:**
```
You: "What's the current work status?"
You: "What files is Claude modifying?"
You: "Show me recent commits"
```

**Coordinate Work:**
```
You: "Claude, check if Codex's migration is ready"
You: "What files does the budget export feature need?"
You: "Find all files related to budget API"
```

**Review Work:**
```
You: "Explain what Claude changed in the last commit"
You: "Show me differences in budget-service.ts"
You: "What components use the budget service?"
```

---

## Getting Started

1. **Cursor Setup** (if using Cursor)
   - Codebase is indexed automatically
   - AI chat is ready
   - Git integration is active

2. **Separate Setup** (if running separately)
   - Clone repository
   - Read onboarding docs
   - Set up environment

3. **Initialize Status Files**
   - Create `.workflow-status.json` (empty structure)
   - Create `WORKFLOW_LOG.md` (template)

4. **Start Working**
   - Check status files
   - Claim work
   - Update status as you work
   - Commit with proper prefixes

---

## Questions?

- **If in Cursor**: Ask Cursor chat: "What's the workflow status?"
- **If separate**: Check `.workflow-status.json`, `WORKFLOW_LOG.md`
- **All agents**: Use status files for coordination
