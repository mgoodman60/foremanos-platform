#!/usr/bin/env tsx
/**
 * Verify Schema Constraints Script
 *
 * This script verifies that the database is ready for schema changes that
 * enforce NOT NULL constraints. It checks both the current data state and
 * the actual database constraints.
 *
 * Usage:
 *   npx tsx scripts/verify-schema-constraints.ts
 *
 * Exit codes:
 *   0 - All constraints can be safely applied
 *   1 - Issues found that must be resolved first
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ConstraintCheck {
  table: string;
  column: string;
  isNullable: boolean;
  nullCount: number;
  totalCount: number;
  status: 'READY' | 'BLOCKED';
}

/**
 * Check if a column can be made NOT NULL
 */
async function checkConstraint(
  table: string,
  column: string,
  model: string
): Promise<ConstraintCheck> {
  // Check current nullability from database
  const result = await prisma.$queryRawUnsafe<any[]>(`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_name = '${table}'
      AND column_name = '${column}'
  `);

  const isNullable = result[0]?.is_nullable === 'YES';

  // Count NULL values
  const nullCountResult = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${table}"
    WHERE "${column}" IS NULL
  `);

  const nullCount = parseInt(nullCountResult[0]?.count || '0');

  // Get total count
  const totalCountResult = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count
    FROM "${table}"
  `);

  const totalCount = parseInt(totalCountResult[0]?.count || '0');

  return {
    table,
    column,
    isNullable,
    nullCount,
    totalCount,
    status: nullCount === 0 ? 'READY' : 'BLOCKED',
  };
}

/**
 * Main verification function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                  SCHEMA CONSTRAINT VERIFICATION REPORT                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted at: ${new Date().toISOString()}\n`);

  const checks: ConstraintCheck[] = [];

  try {
    // Check Document.projectId
    console.log('🔍 Checking Document.projectId...');
    const docCheck = await checkConstraint('Document', 'projectId', 'Document');
    checks.push(docCheck);

    console.log(`   Table: ${docCheck.table}`);
    console.log(`   Column: ${docCheck.column}`);
    console.log(`   Currently nullable: ${docCheck.isNullable ? 'YES' : 'NO'}`);
    console.log(`   NULL values: ${docCheck.nullCount} of ${docCheck.totalCount} records`);
    console.log(`   Status: ${docCheck.status === 'READY' ? '✅ READY' : '⚠️  BLOCKED'}`);

    // Check User.email
    console.log('\n🔍 Checking User.email...');
    const userCheck = await checkConstraint('User', 'email', 'User');
    checks.push(userCheck);

    console.log(`   Table: ${userCheck.table}`);
    console.log(`   Column: ${userCheck.column}`);
    console.log(`   Currently nullable: ${userCheck.isNullable ? 'YES' : 'NO'}`);
    console.log(`   NULL values: ${userCheck.nullCount} of ${userCheck.totalCount} records`);
    console.log(`   Status: ${userCheck.status === 'READY' ? '✅ READY' : '⚠️  BLOCKED'}`);

    // Check for other potential issues
    console.log('\n🔍 Checking for related constraint issues...');

    // Check for documents without valid project references
    const invalidProjectRefs = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*) as count
      FROM "Document" d
      WHERE d."projectId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Project" p WHERE p.id = d."projectId"
        )
    `);
    const invalidProjCount = parseInt(invalidProjectRefs[0]?.count || '0');

    if (invalidProjCount > 0) {
      console.log(`   ⚠️  Found ${invalidProjCount} document(s) with invalid projectId references`);
      console.log('      These reference projects that no longer exist');
    } else {
      console.log('   ✅ All Document.projectId foreign keys are valid');
    }

    // Check for duplicate emails (would block unique constraint)
    const duplicateEmails = await prisma.$queryRawUnsafe<any[]>(`
      SELECT email, COUNT(*) as count
      FROM "User"
      WHERE email IS NOT NULL
      GROUP BY email
      HAVING COUNT(*) > 1
    `);

    if (duplicateEmails.length > 0) {
      console.log(`   ⚠️  Found ${duplicateEmails.length} duplicate email(s):`);
      duplicateEmails.forEach(dup => {
        console.log(`      - "${dup.email}" (${dup.count} users)`);
      });
    } else {
      console.log('   ✅ All User.email values are unique');
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('═'.repeat(80));

    const allReady = checks.every(c => c.status === 'READY') &&
                     invalidProjCount === 0 &&
                     duplicateEmails.length === 0;

    console.log('\nConstraints to be applied:');
    checks.forEach(check => {
      const emoji = check.status === 'READY' ? '✅' : '❌';
      console.log(`  ${emoji} ALTER TABLE "${check.table}" ALTER COLUMN "${check.column}" SET NOT NULL;`);
      if (check.status === 'BLOCKED') {
        console.log(`     Blocked by: ${check.nullCount} NULL value(s)`);
      }
    });

    if (invalidProjCount > 0) {
      console.log(`  ⚠️  Invalid foreign key references: ${invalidProjCount}`);
    }

    if (duplicateEmails.length > 0) {
      console.log(`  ⚠️  Duplicate email addresses: ${duplicateEmails.length}`);
    }

    console.log('\n' + '═'.repeat(80));

    if (allReady) {
      console.log('\n✅ ALL CHECKS PASSED');
      console.log('\nDatabase is ready for schema migration.');
      console.log('\nNext steps:');
      console.log('  1. Update prisma/schema.prisma (remove ? from fields)');
      console.log('  2. Run: npx prisma migrate dev --name make-fields-required');
      console.log('  3. Verify: npx prisma migrate status\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  CHECKS FAILED');
      console.log('\nDatabase is NOT ready for schema migration.');
      console.log('\nRequired actions:');

      if (checks.some(c => c.status === 'BLOCKED')) {
        console.log('  1. Fix NULL values:');
        console.log('     npx tsx scripts/fix-orphaned-records.ts');
      }

      if (invalidProjCount > 0) {
        console.log('  2. Fix invalid foreign keys:');
        console.log('     - Delete documents with non-existent projectId, or');
        console.log('     - Reassign to valid projects');
      }

      if (duplicateEmails.length > 0) {
        console.log('  3. Fix duplicate emails:');
        console.log('     - Update duplicate emails to be unique');
        console.log('     - Or merge/delete duplicate user accounts');
      }

      console.log('\n  4. Re-run verification:');
      console.log('     npx tsx scripts/verify-schema-constraints.ts\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
