# Orphaned Records Migration Guide

## Overview

This guide helps you identify and fix orphaned records before making schema changes that enforce NOT NULL constraints on currently nullable fields.

## Problem

The following fields are currently nullable but should be required:

1. **`Document.projectId`** (line 533 in `prisma/schema.prisma`)
   - Every document should belong to a project
   - Currently has a TODO comment to make it required

2. **`User.email`** (line 1702 in `prisma/schema.prisma`)
   - Every user should have an email address
   - Currently has a TODO comment to make it required

## Scripts

### 1. `audit-orphaned-records.ts`

**Purpose**: Identify records with NULL values in fields that should be required.

**Usage**:
```bash
npx tsx scripts/audit-orphaned-records.ts
```

**Output**:
- Count of orphaned records per model
- Sample data for first 10 records
- Related records that would be affected
- Recommendations for fixing
- Exit code 0 (safe to migrate) or 1 (orphans found)

**Example Output**:
```
📋 Auditing Document.projectId...
   Found: 7 documents without projectId
   Showing 7 sample(s):
   1. Site Survey.pdf (cmkzztu1p0009dizor0tis2ty)
      - File: Site Survey.pdf
      - Type: pdf
      - Processed: false
      - Deleted: NO
      - Created: 2026-01-29T21:55:51.517Z
   ...

👤 Auditing User.email...
   Found: 0 users without email

Document.projectId:
  Total orphaned records: 7
  Status: ⚠️  REQUIRES ACTION

User.email:
  Total orphaned records: 0
  Status: ✅ SAFE TO MIGRATE
```

### 2. `fix-orphaned-records.ts`

**Purpose**: Automatically fix orphaned records using configurable strategies.

**Usage**:

Dry run (preview changes):
```bash
npx tsx scripts/fix-orphaned-records.ts --dry-run
```

Apply fixes (assign to project):
```bash
npx tsx scripts/fix-orphaned-records.ts
```

Delete orphaned documents instead:
```bash
npx tsx scripts/fix-orphaned-records.ts --delete-orphaned-docs
```

**Strategies**:

#### Document.projectId
- **Default**: Assign to first available project, or create "Archived Documents" project
- **With `--delete-orphaned-docs`**: Delete all orphaned documents

#### User.email
- **Inactive users** (never logged in, not approved, no OAuth): DELETE
- **Active users**: Generate placeholder email: `username@placeholder.local`

## Migration Workflow

### Step 1: Audit Current State

Run the audit to identify orphaned records:
```bash
npx tsx scripts/audit-orphaned-records.ts
```

If exit code is 0, skip to Step 4 (no orphans found).

### Step 2: Review and Decide

Based on audit output, choose a fix strategy:

**For orphaned documents:**
- If they're test data → Use `--delete-orphaned-docs`
- If they should be preserved → Use default (assign to project)

**For orphaned users:**
- Script automatically handles this (deletes inactive, assigns emails to active)

### Step 3: Apply Fixes

**Dry run first** (recommended):
```bash
npx tsx scripts/fix-orphaned-records.ts --dry-run
```

Review the output, then apply:
```bash
npx tsx scripts/fix-orphaned-records.ts
```

Or delete orphaned documents:
```bash
npx tsx scripts/fix-orphaned-records.ts --delete-orphaned-docs
```

### Step 4: Verify

Re-run audit to confirm all orphans are fixed:
```bash
npx tsx scripts/audit-orphaned-records.ts
```

Should output:
```
✅ NO ORPHANED RECORDS FOUND
   Safe to proceed with schema migration.
```

### Step 5: Update Schema

Once audit shows 0 orphans, update `prisma/schema.prisma`:

**Before**:
```prisma
model Document {
  // ...
  projectId String? \ TODO: Should be required - needs migration
  // ...
}

model User {
  // ...
  email String? @unique \ TODO: Should be required - needs migration
  // ...
}
```

**After**:
```prisma
model Document {
  // ...
  projectId String  // Remove ? and TODO comment
  // ...
}

model User {
  // ...
  email String @unique  // Remove ? and TODO comment
  // ...
}
```

### Step 6: Create Migration

```bash
npx prisma migrate dev --name make-projectid-and-email-required
```

This will:
1. Generate a migration file with ALTER TABLE statements
2. Apply the migration to your database
3. Update Prisma Client

## Manual Fixes (Alternative)

If you prefer to fix records manually using SQL:

### Option 1: Delete orphaned documents
```sql
DELETE FROM "Document" WHERE "projectId" IS NULL;
```

### Option 2: Create archive project and assign
```sql
-- 1. Create archive project (replace <user-id> with actual admin user ID)
INSERT INTO "Project" (id, name, description, "ownerId", status, "startDate", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Archived Documents',
  'Auto-created for orphaned documents',
  '<user-id>',
  'on_hold',
  NOW(),
  NOW(),
  NOW()
);

-- 2. Get the project ID
SELECT id, name FROM "Project" WHERE name = 'Archived Documents';

-- 3. Assign orphaned documents (replace <project-id>)
UPDATE "Document"
SET "projectId" = '<project-id>'
WHERE "projectId" IS NULL;
```

### Fix users without email
```sql
-- Generate placeholder emails
UPDATE "User"
SET email = LOWER(username) || '@placeholder.local'
WHERE email IS NULL;
```

## Troubleshooting

### "No admin or project manager users found"

**Problem**: Cannot create archive project because no eligible owner exists.

**Solution**:
```bash
# Create an admin user first
npx tsx scripts/seed-test-user.ts

# Then run fix script
npx tsx scripts/fix-orphaned-records.ts
```

### Migration fails with constraint violation

**Problem**: Migration applied before fixing orphans.

**Solution**:
1. Rollback migration: `npx prisma migrate resolve --rolled-back <migration-name>`
2. Run fix script
3. Re-run migration

### "Duplicate key value violates unique constraint"

**Problem**: Multiple users trying to use the same email.

**Solution**:
```sql
-- Find duplicates
SELECT email, COUNT(*)
FROM "User"
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- Fix by appending user ID to duplicates
UPDATE "User"
SET email = LOWER(username) || '-' || id || '@placeholder.local'
WHERE email IN (
  SELECT email FROM "User"
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING COUNT(*) > 1
);
```

## Production Checklist

Before running in production:

- [ ] Backup database: `pg_dump -U user -d database > backup.sql`
- [ ] Run audit in production: `npx tsx scripts/audit-orphaned-records.ts`
- [ ] Test fix in staging environment first
- [ ] Run fix with `--dry-run` in production
- [ ] Review dry-run output carefully
- [ ] Apply fix during maintenance window
- [ ] Verify with audit script (should show 0 orphans)
- [ ] Apply Prisma migration
- [ ] Monitor application logs for errors
- [ ] Keep database backup for 7+ days

## Related Files

- `prisma/schema.prisma` - Database schema definition
- `scripts/audit-orphaned-records.ts` - Audit script
- `scripts/fix-orphaned-records.ts` - Fix script
- `lib/db.ts` - Prisma client singleton

## Exit Codes

### audit-orphaned-records.ts
- `0` - No orphans found (safe to migrate)
- `1` - Orphans found (must fix before migration)

### fix-orphaned-records.ts
- `0` - Success
- `1` - Error during execution

## Support

For issues or questions:
1. Check script output for detailed error messages
2. Review this README
3. Check Prisma logs: `DEBUG=prisma:* npx tsx scripts/...`
4. Examine database state directly: `npx prisma studio`
