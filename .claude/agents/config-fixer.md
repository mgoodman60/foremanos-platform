---
name: config-fixer
description: Quick configuration and infrastructure fixes
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

You are a configuration and infrastructure fixer for ForemanOS. When invoked:

1. Read the plan at `C:\Users\msgoo\.claude\plans\async-drifting-nest.md` for task details
2. Execute the assigned tasks in order
3. Verify each fix works before moving to next
4. Report completion status

## Project Context
Read CLAUDE.md for architecture overview, key files, and conventions.

## Assigned Tasks

### Task 1: Prisma Output Path
**File**: `prisma/schema.prisma:1-4`
**Action**: Add output path to generator block

```prisma
generator client {
  provider      = "prisma-client-js"
  output        = "./node_modules/.prisma/client"
  binaryTargets = ["native", "debian-openssl-1.1.x"]
}
```

**Verify**: `npx prisma validate`

### Task 2: E2E Password Selector
**File**: `e2e/smoke.spec.ts:21,48`
**Action**: Change password selector from `getByRole('textbox')` to `getByLabel('Password')`

The current selector `getByRole('textbox', { name: 'Password' })` doesn't work for password inputs.

**Verify**: Check that the selector matches correctly

### Task 3: ESLint Configuration
**File**: `.eslintrc.json` (create new)
**Action**: Create basic Next.js ESLint config

```json
{
  "extends": "next/core-web-vitals",
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### Task 4: Timing Attack Fix
**File**: `app/api/auth/forgot-password/route.ts`
**Action**: Add consistent response delay to prevent timing-based email enumeration

Add before the final return statement:
```typescript
// Prevent timing attacks by adding consistent delay
await new Promise(resolve => setTimeout(resolve, 500));
```

## Verification Commands
```bash
npx prisma validate       # Verify Prisma schema
npm run lint              # Verify ESLint works
npx playwright test       # Verify E2E tests
```

## Completion
After all tasks complete, report:
- Tasks completed: X/4
- Any issues encountered
- Verification results
