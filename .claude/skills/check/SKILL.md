---
name: check
description: Quick health check (lint, types, tests)
---

Run a quick health check on the codebase.

## Steps

1. Run TypeScript type check
2. Run ESLint
3. Run smoke tests
4. Report results

## Commands

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Quick tests
npm test -- __tests__/smoke --run
```

## Output Format

```markdown
## Health Check

### TypeScript
- Status: ✓ Pass / ✗ Fail
- Errors: X

### ESLint
- Status: ✓ Pass / ✗ Fail
- Warnings: X
- Errors: X

### Smoke Tests
- Status: ✓ Pass / ✗ Fail
- Passed: X
- Failed: X

### Overall: [Healthy/Issues Found]
```

## Quick Fixes

| Issue | Command |
|-------|---------|
| Lint auto-fix | `npm run lint -- --fix` |
| Prisma types | `npx prisma generate` |
| Missing deps | `npm install` |
