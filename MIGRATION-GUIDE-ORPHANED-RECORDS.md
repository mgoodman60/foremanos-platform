# Orphaned Records Migration Guide

## Executive Summary

**Current Status**: Database has **7 orphaned documents** that must be fixed before making `Document.projectId` required.

**Impact**:
- `User.email` is ready to be made required (0 orphans found)
- `Document.projectId` is blocked (7 orphans found)

**Recommendation**: Run fix script to assign orphaned documents to a project, then apply schema migration.

---

## Quick Start

### 1. Audit Current State
```bash
npx tsx scripts/audit-orphaned-records.ts
```

**Current Result**:
- ❌ Document.projectId: 7 orphaned records
- ✅ User.email: 0 orphaned records

### 2. Preview Fixes (Dry Run)
```bash
npx tsx scripts/fix-orphaned-records.ts --dry-run
```

### 3. Apply Fixes
```bash
# Option A: Assign to project (recommended for preserving data)
npx tsx scripts/fix-orphaned-records.ts

# Option B: Delete orphaned documents (if they're test data)
npx tsx scripts/fix-orphaned-records.ts --delete-orphaned-docs
```

### 4. Verify
```bash
npx tsx scripts/verify-schema-constraints.ts
```

Should show:
```
✅ ALL CHECKS PASSED
Database is ready for schema migration.
```

### 5. Update Schema
Edit `prisma/schema.prisma`:

**Line 533** - Change:
```prisma
projectId String? \ TODO: Should be required - needs migration
```
To:
```prisma
projectId String
```

**Line 1702** - Change:
```prisma
email String? @unique \ TODO: Should be required - needs migration
```
To:
```prisma
email String @unique
```

### 6. Create Migration
```bash
npx prisma migrate dev --name make-projectid-and-email-required
```

---

## Detailed Analysis

### Current Database State

**Total Records**:
- Users: 4
- Projects: 0
- Documents: 7 (all orphaned)

**Orphaned Documents Found**:
1. Site Survey.pdf (cmkzztu1p0009dizor0tis2ty)
2. Schedule.pdf (cmkzzttzu0008dizo1hcss15y)
3. Plans.pdf (cmkzzttxh0007dizoihflzaad)
4. Geotech.pdf (cmkzzttvi0006dizocva7vlk4)
5. Project Overview.docx (cmkzzttto0005dizo1q7podap)
6. Critical Path Plan.docx (cmkzzttrt0004dizod8g5wxtm)
7. Budget.pdf (cmkzzttox0003dizokeu8i84w)

**Characteristics**:
- All created on: 2026-01-29 21:55:51 (test data)
- All unprocessed (processed: false)
- None soft-deleted (deletedAt: null)
- No DocumentChunks or MaterialTakeoffs attached

### Fix Strategies

#### Strategy A: Assign to Project (Default)
**What it does**:
- Creates an "Archived Documents" project
- Assigns all orphaned documents to this project
- Preserves all document data and metadata

**Best for**:
- Production environments
- When documents might have value later
- When unsure about deleting

**Command**:
```bash
npx tsx scripts/fix-orphaned-records.ts
```

#### Strategy B: Delete Orphaned Documents
**What it does**:
- Permanently deletes all orphaned documents
- Cascades to related DocumentChunks, MaterialTakeoffs, etc.

**Best for**:
- Development/test environments
- When documents are confirmed test data
- Clean slate approach

**Command**:
```bash
npx tsx scripts/fix-orphaned-records.ts --delete-orphaned-docs
```

---

## Scripts Reference

### 1. `audit-orphaned-records.ts`
**Purpose**: Identify orphaned records

**Features**:
- Counts NULL values in fields that should be required
- Shows sample records (up to 10)
- Checks related records that would be affected
- Provides fix recommendations
- Exit code indicates readiness (0 = ready, 1 = blocked)

**Output Example**:
```
📋 Auditing Document.projectId...
   Found: 7 documents without projectId

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
**Purpose**: Automatically fix orphaned records

**Options**:
- `--dry-run` - Preview changes without applying
- `--delete-orphaned-docs` - Delete instead of assigning to project

**Fix Logic**:

**Documents**:
- Default: Assign to first project or create "Archived Documents" project
- With `--delete-orphaned-docs`: Delete permanently

**Users**:
- Inactive (never logged in, not approved, no OAuth): DELETE
- Active: Generate placeholder email `username@placeholder.local`

**Output Example**:
```
📋 Fixing Document.projectId...
   Found 7 orphaned document(s)
   Strategy: ASSIGN to project
   ✅ Assigned 7 document(s) to project "Archived Documents"

📊 SUMMARY
Total records processed: 7
Mode: LIVE (changes applied)

✅ Fixes applied successfully!
```

### 3. `verify-schema-constraints.ts`
**Purpose**: Comprehensive database readiness check

**Checks**:
1. NULL values in columns to be made NOT NULL
2. Invalid foreign key references
3. Duplicate values in unique columns
4. Current database constraint state

**Output Example**:
```
🔍 Checking Document.projectId...
   Currently nullable: YES
   NULL values: 0 of 7 records
   Status: ✅ READY

🔍 Checking User.email...
   Currently nullable: YES
   NULL values: 0 of 4 records
   Status: ✅ READY

✅ ALL CHECKS PASSED
Database is ready for schema migration.

Next steps:
  1. Update prisma/schema.prisma (remove ? from fields)
  2. Run: npx prisma migrate dev --name make-fields-required
  3. Verify: npx prisma migrate status
```

---

## Complete Workflow

### Development Environment

```bash
# Step 1: Audit
npx tsx scripts/audit-orphaned-records.ts

# Step 2: Preview fix
npx tsx scripts/fix-orphaned-records.ts --dry-run

# Step 3: Apply fix (choose one)
npx tsx scripts/fix-orphaned-records.ts                    # Assign to project
npx tsx scripts/fix-orphaned-records.ts --delete-orphaned-docs  # Delete

# Step 4: Verify
npx tsx scripts/verify-schema-constraints.ts

# Step 5: Update schema (manual edit)
# Edit prisma/schema.prisma lines 533 and 1702

# Step 6: Create migration
npx prisma migrate dev --name make-projectid-and-email-required

# Step 7: Verify migration
npx prisma migrate status
```

### Production Environment

```bash
# Before deployment:
# 1. Backup database
pg_dump -U postgres -d foremanos > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Audit in production
npx tsx scripts/audit-orphaned-records.ts

# 3. Dry run fix
npx tsx scripts/fix-orphaned-records.ts --dry-run

# 4. Review output carefully

# During maintenance window:
# 5. Apply fix
npx tsx scripts/fix-orphaned-records.ts

# 6. Verify
npx tsx scripts/verify-schema-constraints.ts

# 7. Apply migration
npx prisma migrate deploy

# 8. Monitor application logs
# 9. Keep backup for 7+ days
```

---

## Troubleshooting

### Error: "No admin or project manager users found"

**Problem**: Fix script cannot create "Archived Documents" project because no owner exists.

**Solution**:
```bash
# Create admin user
npx tsx scripts/seed-test-user.ts

# Then retry fix
npx tsx scripts/fix-orphaned-records.ts
```

### Error: Migration fails with constraint violation

**Problem**: Migration applied before fixing orphans.

**Solution**:
```bash
# 1. Rollback migration
npx prisma migrate resolve --rolled-back <migration-name>

# 2. Fix orphans
npx tsx scripts/fix-orphaned-records.ts

# 3. Verify
npx tsx scripts/verify-schema-constraints.ts

# 4. Re-run migration
npx prisma migrate dev --name make-projectid-and-email-required
```

### Error: "Duplicate key value violates unique constraint"

**Problem**: Multiple users have same email (or NULL).

**Solution**:
```sql
-- Find duplicates
SELECT email, COUNT(*)
FROM "User"
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- Fix by appending user ID
UPDATE "User"
SET email = LOWER(username) || '-' || id || '@placeholder.local'
WHERE email IN (
  SELECT email FROM "User"
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING COUNT(*) > 1
);
```

---

## Manual SQL Alternatives

If you prefer manual database updates:

### Delete Orphaned Documents
```sql
DELETE FROM "Document" WHERE "projectId" IS NULL;
```

### Create Archive Project and Assign
```sql
-- 1. Create project (get user ID first)
SELECT id, username, role FROM "User" WHERE role IN ('admin', 'project_manager') LIMIT 1;

-- 2. Insert project (replace <USER_ID>)
INSERT INTO "Project" (id, name, description, "ownerId", status, "startDate", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Archived Documents',
  'Auto-created for orphaned documents during schema migration',
  '<USER_ID>',
  'on_hold',
  NOW(),
  NOW(),
  NOW()
)
RETURNING id;

-- 3. Assign documents (replace <PROJECT_ID>)
UPDATE "Document"
SET "projectId" = '<PROJECT_ID>'
WHERE "projectId" IS NULL;
```

### Generate Placeholder Emails
```sql
UPDATE "User"
SET email = LOWER(username) || '@placeholder.local'
WHERE email IS NULL;
```

---

## Files Created

1. **`scripts/audit-orphaned-records.ts`** - Audit script
2. **`scripts/fix-orphaned-records.ts`** - Fix script
3. **`scripts/verify-schema-constraints.ts`** - Verification script
4. **`scripts/README-ORPHANED-RECORDS.md`** - Detailed documentation
5. **`MIGRATION-GUIDE-ORPHANED-RECORDS.md`** - This file

---

## Schema Changes to Apply

After fixing orphans, update `prisma/schema.prisma`:

### Document Model (Line 533)
**Before**:
```prisma
model Document {
  id                    String                  @id @default(cuid())
  name                  String
  fileName              String
  fileType              String
  oneDriveId            String?                 @unique
  accessLevel           String                  @default("guest")
  filePath              String?
  fileUrl               String?
  lastModified          DateTime?
  fileSize              Int?
  processed             Boolean                 @default(false)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt
  projectId             String? \ TODO: Should be required - needs migration
  // ... rest of fields
}
```

**After**:
```prisma
model Document {
  id                    String                  @id @default(cuid())
  name                  String
  fileName              String
  fileType              String
  oneDriveId            String?                 @unique
  accessLevel           String                  @default("guest")
  filePath              String?
  fileUrl               String?
  lastModified          DateTime?
  fileSize              Int?
  processed             Boolean                 @default(false)
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt
  projectId             String
  // ... rest of fields
}
```

### User Model (Line 1702)
**Before**:
```prisma
model User {
  id                                                  String                     @id @default(cuid())
  email                                               String?                    @unique \ TODO: Should be required - needs migration
  username                                            String                     @unique
  // ... rest of fields
}
```

**After**:
```prisma
model User {
  id                                                  String                     @id @default(cuid())
  email                                               String                     @unique
  username                                            String                     @unique
  // ... rest of fields
}
```

---

## Expected Migration SQL

After schema update, Prisma will generate:

```sql
-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "projectId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
```

---

## Next Steps

1. ✅ Scripts created and tested
2. ⏳ Fix orphaned records (7 documents)
3. ⏳ Update Prisma schema
4. ⏳ Create migration
5. ⏳ Deploy to production

**Recommended**: Start with development environment, test thoroughly, then apply to production during maintenance window.
