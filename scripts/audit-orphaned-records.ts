#!/usr/bin/env tsx
/**
 * Orphaned Records Audit Script
 *
 * This script identifies records that have nullable fields which should be required
 * before making schema changes to enforce NOT NULL constraints.
 *
 * Current issues being audited:
 * - Document.projectId (should be required but currently nullable)
 * - User.email (should be required but currently nullable)
 *
 * Usage:
 *   npx tsx scripts/audit-orphaned-records.ts
 *
 * Exit codes:
 *   0 - No orphaned records found (safe to migrate)
 *   1 - Orphaned records found (must fix before migration)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditResult {
  model: string;
  field: string;
  count: number;
  samples: any[];
}

/**
 * Audit documents without a projectId
 */
async function auditDocumentsWithoutProject(): Promise<AuditResult> {
  console.log('\n📋 Auditing Document.projectId...');

  const orphanedDocuments = await prisma.document.findMany({
    where: {
      projectId: { equals: null } as any,
    },
    select: {
      id: true,
      name: true,
      fileName: true,
      fileType: true,
      createdAt: true,
      updatedAt: true,
      processed: true,
      deletedAt: true,
    },
    take: 10, // Limit samples to first 10
    orderBy: {
      createdAt: 'desc',
    },
  });

  const totalCount = await prisma.document.count({
    where: {
      projectId: { equals: null } as any,
    },
  });

  console.log(`   Found: ${totalCount} documents without projectId`);

  if (totalCount > 0) {
    console.log(`   Showing ${Math.min(10, totalCount)} sample(s):`);
    orphanedDocuments.forEach((doc, idx) => {
      console.log(`   ${idx + 1}. ${doc.name} (${doc.id})`);
      console.log(`      - File: ${doc.fileName}`);
      console.log(`      - Type: ${doc.fileType}`);
      console.log(`      - Processed: ${doc.processed}`);
      console.log(`      - Deleted: ${doc.deletedAt ? 'YES (soft-deleted)' : 'NO'}`);
      console.log(`      - Created: ${doc.createdAt.toISOString()}`);
    });
  }

  return {
    model: 'Document',
    field: 'projectId',
    count: totalCount,
    samples: orphanedDocuments,
  };
}

/**
 * Audit users without an email
 */
async function auditUsersWithoutEmail(): Promise<AuditResult> {
  console.log('\n👤 Auditing User.email...');

  const orphanedUsers = await (prisma.user.findMany as any)({
    where: {
      email: { equals: null },
    },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      emailVerified: true,
      approved: true,
      subscriptionTier: true,
      Account: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
    },
    take: 10,
    orderBy: {
      createdAt: 'desc',
    },
  }) as any[];

  const totalCount = await prisma.user.count({
    where: {
      email: { equals: null } as any,
    },
  });

  console.log(`   Found: ${totalCount} users without email`);

  if (totalCount > 0) {
    console.log(`   Showing ${Math.min(10, totalCount)} sample(s):`);
    orphanedUsers.forEach((user, idx) => {
      console.log(`   ${idx + 1}. @${user.username} (${user.id})`);
      console.log(`      - Role: ${user.role}`);
      console.log(`      - Approved: ${user.approved}`);
      console.log(`      - Email Verified: ${user.emailVerified}`);
      console.log(`      - Last Login: ${user.lastLoginAt ? user.lastLoginAt.toISOString() : 'Never'}`);
      console.log(`      - Subscription: ${user.subscriptionTier}`);
      console.log(`      - OAuth Accounts: ${user.Account.length}`);
      if (user.Account.length > 0) {
        user.Account.forEach(acc => {
          console.log(`        • ${acc.provider} (${acc.providerAccountId})`);
        });
      }
      console.log(`      - Created: ${user.createdAt.toISOString()}`);
    });
  }

  return {
    model: 'User',
    field: 'email',
    count: totalCount,
    samples: orphanedUsers,
  };
}

/**
 * Check for related records that would be affected
 */
async function checkRelatedRecords(documentIds: string[], userIds: string[]) {
  console.log('\n🔗 Checking related records...');

  if (documentIds.length > 0) {
    const chunks = await prisma.documentChunk.count({
      where: { documentId: { in: documentIds } },
    });
    console.log(`   - DocumentChunks affected: ${chunks}`);

    const takeoffs = await prisma.materialTakeoff.count({
      where: { documentId: { in: documentIds } },
    });
    console.log(`   - MaterialTakeoffs affected: ${takeoffs}`);
  }

  if (userIds.length > 0) {
    const projects = await prisma.project.count({
      where: { ownerId: { in: userIds } },
    });
    console.log(`   - Projects owned: ${projects}`);

    const conversations = await prisma.conversation.count({
      where: { userId: { in: userIds } },
    });
    console.log(`   - Conversations: ${conversations}`);
  }
}

/**
 * Generate recommendations based on audit results
 */
function generateRecommendations(results: AuditResult[]): void {
  console.log('\n\n📊 AUDIT SUMMARY');
  console.log('='.repeat(80));

  const hasOrphans = results.some(r => r.count > 0);

  results.forEach(result => {
    console.log(`\n${result.model}.${result.field}:`);
    console.log(`  Total orphaned records: ${result.count}`);

    if (result.count > 0) {
      console.log(`  Status: ⚠️  REQUIRES ACTION`);
    } else {
      console.log(`  Status: ✅ SAFE TO MIGRATE`);
    }
  });

  console.log('\n' + '='.repeat(80));

  if (!hasOrphans) {
    console.log('\n✅ NO ORPHANED RECORDS FOUND');
    console.log('   All nullable fields that should be required have valid data.');
    console.log('   Safe to proceed with schema migration.\n');
    return;
  }

  console.log('\n⚠️  ORPHANED RECORDS DETECTED');
  console.log('\nRECOMMENDATIONS:\n');

  const docResult = results.find(r => r.model === 'Document');
  if (docResult && docResult.count > 0) {
    console.log('📋 Document.projectId:');
    console.log('   Option 1: Delete orphaned documents');
    console.log('     DELETE FROM "Document" WHERE "projectId" IS NULL;');
    console.log('');
    console.log('   Option 2: Assign to a default/archive project');
    console.log('     1. Create an "Archived Documents" project');
    console.log('     2. UPDATE "Document" SET "projectId" = \'<archive-project-id>\'');
    console.log('        WHERE "projectId" IS NULL;');
    console.log('');
    console.log('   Option 3: Migrate soft-deleted docs to a separate table');
    console.log('     - Move documents with deletedAt IS NOT NULL to DeletedDocument table');
    console.log('');
  }

  const userResult = results.find(r => r.model === 'User');
  if (userResult && userResult.count > 0) {
    console.log('👤 User.email:');
    console.log('   Option 1: Generate placeholder emails');
    console.log('     UPDATE "User" SET "email" = CONCAT(\'user-\', "id", \'@placeholder.local\')');
    console.log('     WHERE "email" IS NULL;');
    console.log('');
    console.log('   Option 2: Extract from OAuth accounts');
    console.log('     - Check if Account table has email for these users');
    console.log('     - Use OAuth provider email as primary email');
    console.log('');
    console.log('   Option 3: Delete inactive users without email');
    console.log('     - Safe to delete if lastLoginAt IS NULL AND approved = false');
    console.log('     - DELETE FROM "User" WHERE "email" IS NULL');
    console.log('       AND "lastLoginAt" IS NULL AND "approved" = false;');
    console.log('');
  }

  console.log('⚠️  IMPORTANT:');
  console.log('   1. Backup your database before making any changes');
  console.log('   2. Test fixes in development environment first');
  console.log('   3. Re-run this audit after applying fixes');
  console.log('   4. Only proceed with schema migration when audit shows 0 orphans\n');
}

/**
 * Main audit function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    ORPHANED RECORDS AUDIT REPORT                           ║');
  console.log('║                                                                            ║');
  console.log('║  Identifies nullable fields that should be required before schema changes ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted at: ${new Date().toISOString()}`);

  const results: AuditResult[] = [];

  try {
    // Audit Document.projectId
    const docResult = await auditDocumentsWithoutProject();
    results.push(docResult);

    // Audit User.email
    const userResult = await auditUsersWithoutEmail();
    results.push(userResult);

    // Check related records
    const documentIds = docResult.samples.map((s: any) => s.id);
    const userIds = userResult.samples.map((s: any) => s.id);

    if (documentIds.length > 0 || userIds.length > 0) {
      await checkRelatedRecords(documentIds, userIds);
    }

    // Generate recommendations
    generateRecommendations(results);

    // Exit with appropriate code
    const hasOrphans = results.some(r => r.count > 0);
    if (hasOrphans) {
      console.log('Exit code: 1 (orphaned records found)\n');
      process.exit(1);
    } else {
      console.log('Exit code: 0 (no orphaned records)\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
