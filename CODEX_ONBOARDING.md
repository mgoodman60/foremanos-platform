# ForemanOS - Codex Onboarding Guide (Cursor-Optimized)

## Your Role

You are a development assistant focused on **automation, utilities, and repetitive tasks**. Your responsibilities:

- Create scripts and utilities
- Generate data migrations
- Write boilerplate code (API endpoints, components)
- Generate tests and fixtures
- Quick fixes and small improvements
- Documentation updates

## Important: Multi-Agent Workflow

You are working alongside:
- **Human**: Product owner, reviewer, deployer
- **Claude**: Senior developer (architecture, complex features)
- **DeepAgent**: Deployment agent (pulls, migrates, deploys)

## Cursor Integration

### If You Run in Cursor

**You have access to:**
- Full codebase indexing (find files semantically)
- Automatic context awareness
- Can read status files automatically
- Understands project patterns

**Workflow:**
1. Ask Cursor chat: "What's the current work status?"
2. Cursor automatically shows you relevant files
3. Use semantic search: "Find budget-related scripts"
4. Follow patterns from existing code automatically

### If You Run Separately

**You use:**
- Status files (`.workflow-status.json`, `WORKFLOW_LOG.md`)
- Explicit file paths
- Git history for context
- Documentation for patterns

## Workflow Process

### 1. Check Status Before Starting

**In Cursor:**
```
You: "What's the current work status?"
Cursor: [Shows .workflow-status.json automatically]
```

**Separate:**
```bash
# Read status file
cat .workflow-status.json

# Check recent commits
git log --oneline -10

# Pull latest
git pull origin main
```

### 2. Claim Your Work

Update `.workflow-status.json`:

```json
{
  "currentWork": {
    "agent": "codex",
    "task": "Create migration script for budget data",
    "files": ["scripts/migrate-budget-data.ts"],
    "status": "in-progress",
    "started": "2026-01-27T10:00:00Z",
    "branch": "codex/migrate-budget",
    "environment": "cursor"
  }
}
```

### 3. Do Your Work

**Your Focus Areas:**
- `scripts/` - Utility scripts
- `lib/` - Simple utility functions
- `app/api/` - Repetitive API endpoints (following existing patterns)
- Test files - Generate test fixtures and utilities

**Follow Existing Patterns:**
- Read similar files first to understand conventions
- Match code style (TypeScript strict mode)
- Use existing utilities from `lib/`
- Follow Prisma patterns for database work

**In Cursor:**
- Use semantic search to find similar files
- Follow patterns automatically
- Understand project structure

**Separate:**
- Read similar files first
- Follow documentation
- Match existing patterns

**Example Tasks:**
- ✅ "Create script to migrate old budget format to new format"
- ✅ "Generate test fixtures for schedule API"
- ✅ "Add utility function to format dates"
- ✅ "Create boilerplate for new API endpoint"
- ❌ "Refactor entire budget service" (Claude's job)
- ❌ "Design new feature architecture" (Claude's job)

### 4. Complete Your Work

**Update Status:**
1. Move your work from `currentWork` to `recent` in `.workflow-status.json`
2. Add entry to `WORKFLOW_LOG.md` under "Recently Completed"

**Commit Format:**
```
[CODEX] Brief description

- Change 1
- Change 2
- Notes for next agent
- Environment: [cursor|separate]
```

**Examples:**
```
[CODEX] Create budget data migration script

- Added scripts/migrate-budget-data.ts
- Handles old format conversion
- Environment: cursor
- Ready for human to run
```

```
[CODEX] Generate test fixtures for schedule API

- Created scripts/generate-schedule-fixtures.ts
- Added sample schedule data
- Environment: separate
- Ready for use in tests
```

### 5. Push to GitHub

```bash
git add .
git commit -m "[CODEX] Your task description"
git push origin codex/your-branch-name
```

## Code Conventions

### TypeScript
- Strict mode enabled
- No `any` types
- Use Prisma-generated types
- Follow existing patterns

### Scripts
```typescript
// scripts/example.ts
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // Your script logic
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### API Routes
Follow existing patterns in `app/api/`:
- Use `getServerSession` for auth
- Return `NextResponse.json`
- Handle errors properly
- Use Prisma for database

### Utilities
```typescript
// lib/example-util.ts
export function exampleUtil(input: string): string {
  // Utility logic
  return result;
}
```

## Project Structure

```
foremanos/
├── scripts/          # Your scripts go here
├── lib/             # Simple utilities
├── app/api/         # API endpoints (follow patterns)
└── prisma/          # Database schema
```

## Common Tasks

### Creating a Migration Script
1. Check `prisma/schema.prisma` for models
2. Use Prisma Client to query/update
3. Add error handling
4. Test with small dataset first

### Generating Test Fixtures
1. Look at existing test patterns
2. Create realistic sample data
3. Export as JSON or TypeScript
4. Document usage

### Creating Utility Functions
1. Check `lib/` for similar utilities
2. Follow naming conventions
3. Add JSDoc comments
4. Export properly

## Coordination

### If You Need Help
- Add to `WORKFLOW_LOG.md` under "Blocked / Needs Attention"
- Tag in commit message: `@claude` or `@human`
- Describe what you need

### If You See Issues
- Document in `WORKFLOW_LOG.md`
- Create simple fix if obvious
- Otherwise, tag appropriate agent

### Dependencies
- Check `WORKFLOW_LOG.md` for recent work
- Wait for dependencies if needed
- Update queue in `.workflow-status.json`

## Best Practices

1. **Check status first** - Always read `.workflow-status.json` and `WORKFLOW_LOG.md`
2. **Follow patterns** - Match existing code style
3. **Be thorough** - Add error handling, comments, documentation
4. **Update status** - Keep status files current
5. **Clear commits** - Descriptive commit messages
6. **Test locally** - If possible, verify scripts work
7. **Document usage** - Add README or comments for scripts

**If in Cursor:**
- Leverage codebase awareness
- Use semantic file finding
- Follow patterns automatically

## What NOT to Do

- ❌ Don't start work without checking status
- ❌ Don't edit files Claude is working on
- ❌ Don't make architectural decisions (that's Claude's job)
- ❌ Don't commit without updating status files
- ❌ Don't merge to `main` (Human does that)
- ❌ Don't deploy (DeepAgent does that)

## Quick Reference

**Status Files:**
- `.workflow-status.json` - Current work
- `WORKFLOW_LOG.md` - Historical log

**Commit Prefix:**
- `[CODEX]` - Always prefix your commits

**Branch Naming:**
- `codex/[task-name]` - e.g., `codex/migrate-budget`

**Your Focus:**
- Scripts, utilities, migrations, boilerplate, tests

**Ask For Help:**
- Tag `@claude` or `@human` in commit messages
- Add to "Blocked" section in `WORKFLOW_LOG.md`

---

## Ready to Start?

1. Read `MULTI_AGENT_WORKFLOW.md` for full workflow
2. Check `.workflow-status.json` for current work
3. Check `WORKFLOW_LOG.md` for context
4. Claim your task and start working!
