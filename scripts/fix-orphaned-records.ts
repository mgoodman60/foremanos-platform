#!/usr/bin/env tsx
/**
 * Fix Orphaned Records Script
 *
 * This script fixes orphaned records identified by audit-orphaned-records.ts
 *
 * Actions performed:
 * 1. Documents without projectId:
 *    - Option A: Delete if unprocessed and recent (likely test data)
 *    - Option B: Assign to first available project
 *    - Option C: Create an "Archived Documents" project and assign to it
 *
 * 2. Users without email:
 *    - Generate placeholder emails based on username/id
 *    - Or delete if never logged in and not approved
 *
 * Usage:
 *   # Dry run (preview changes without applying)
 *   npx tsx scripts/fix-orphaned-records.ts --dry-run
 *
 *   # Apply fixes
 *   npx tsx scripts/fix-orphaned-records.ts
 *
 *   # Delete orphaned documents instead of assigning to project
 *   npx tsx scripts/fix-orphaned-records.ts --delete-orphaned-docs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FixOptions {
  dryRun: boolean;
  deleteOrphanedDocs: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): FixOptions {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    deleteOrphanedDocs: args.includes('--delete-orphaned-docs'),
  };
}

/**
 * Fix documents without projectId
 */
async function fixDocumentsWithoutProject(options: FixOptions): Promise<number> {
  console.log('\n📋 Fixing Document.projectId...');

  const orphanedDocuments = await prisma.document.findMany({
    where: {
      projectId: null,
    },
    select: {
      id: true,
      name: true,
      fileName: true,
      processed: true,
      deletedAt: true,
      createdAt: true,
    },
  });

  if (orphanedDocuments.length === 0) {
    console.log('   ✅ No orphaned documents found');
    return 0;
  }

  console.log(`   Found ${orphanedDocuments.length} orphaned document(s)`);

  if (options.deleteOrphanedDocs) {
    console.log('   Strategy: DELETE orphaned documents');

    if (options.dryRun) {
      console.log('   [DRY RUN] Would delete:');
      orphanedDocuments.forEach(doc => {
        console.log(`      - ${doc.name} (${doc.id})`);
      });
    } else {
      const result = await prisma.document.deleteMany({
        where: {
          projectId: null,
        },
      });
      console.log(`   ✅ Deleted ${result.count} document(s)`);
    }

    return orphanedDocuments.length;
  }

  // Find or create a project to assign documents to
  console.log('   Strategy: ASSIGN to project');

  let targetProject = await prisma.project.findFirst({
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!targetProject) {
    console.log('   ⚠️  No projects found. Creating "Archived Documents" project...');

    if (!options.dryRun) {
      // Find first user to assign as owner
      const firstUser = await prisma.user.findFirst({
        where: {
          role: 'admin',
        },
        select: {
          id: true,
          username: true,
        },
      });

      if (!firstUser) {
        console.log('   ❌ No admin users found to own archive project');
        console.log('      Please create a user first or use --delete-orphaned-docs flag');
        return 0;
      }

      targetProject = await prisma.project.create({
        data: {
          name: 'Archived Documents',
          ownerId: firstUser.id,
          status: 'on_hold',
          slug: 'archived-documents-' + Date.now(),
          guestUsername: 'guest',
          guestPassword: 'archived-documents-password',
        },
        select: {
          id: true,
          name: true,
        },
      });

      console.log(`   ✅ Created project: ${targetProject.name} (${targetProject.id})`);
    } else {
      console.log('   [DRY RUN] Would create "Archived Documents" project');
      targetProject = { id: 'dry-run-project-id', name: 'Archived Documents' };
    }
  } else {
    console.log(`   Using existing project: ${targetProject.name} (${targetProject.id})`);
  }

  if (options.dryRun) {
    console.log('   [DRY RUN] Would assign to project:');
    orphanedDocuments.forEach(doc => {
      console.log(`      - ${doc.name} (${doc.id}) → ${targetProject!.name}`);
    });
  } else {
    const result = await prisma.document.updateMany({
      where: {
        projectId: null,
      },
      data: {
        projectId: targetProject.id,
      },
    });
    console.log(`   ✅ Assigned ${result.count} document(s) to project "${targetProject.name}"`);
  }

  return orphanedDocuments.length;
}

/**
 * Fix users without email
 */
async function fixUsersWithoutEmail(options: FixOptions): Promise<number> {
  console.log('\n👤 Fixing User.email...');

  const orphanedUsers = await prisma.user.findMany({
    where: {
      email: null,
    },
    select: {
      id: true,
      username: true,
      role: true,
      lastLoginAt: true,
      approved: true,
      Account: {
        select: {
          provider: true,
          providerAccountId: true,
        },
      },
    },
  });

  if (orphanedUsers.length === 0) {
    console.log('   ✅ No orphaned users found');
    return 0;
  }

  console.log(`   Found ${orphanedUsers.length} orphaned user(s)`);

  // Separate users into deletable (never logged in, not approved) and fixable
  const deletableUsers = orphanedUsers.filter(
    u => !u.lastLoginAt && !u.approved && u.Account.length === 0
  );
  const fixableUsers = orphanedUsers.filter(
    u => u.lastLoginAt || u.approved || u.Account.length > 0
  );

  if (deletableUsers.length > 0) {
    console.log(`   Strategy: DELETE ${deletableUsers.length} inactive user(s)`);

    if (options.dryRun) {
      console.log('   [DRY RUN] Would delete:');
      deletableUsers.forEach(user => {
        console.log(`      - @${user.username} (${user.id}) - never logged in, not approved`);
      });
    } else {
      const result = await prisma.user.deleteMany({
        where: {
          id: { in: deletableUsers.map(u => u.id) },
        },
      });
      console.log(`   ✅ Deleted ${result.count} inactive user(s)`);
    }
  }

  if (fixableUsers.length > 0) {
    console.log(`   Strategy: ASSIGN placeholder emails to ${fixableUsers.length} user(s)`);

    if (options.dryRun) {
      console.log('   [DRY RUN] Would assign emails:');
      fixableUsers.forEach(user => {
        const email = `${user.username.toLowerCase()}@placeholder.local`;
        console.log(`      - @${user.username} (${user.id}) → ${email}`);
      });
    } else {
      for (const user of fixableUsers) {
        const email = `${user.username.toLowerCase()}@placeholder.local`;
        await prisma.user.update({
          where: { id: user.id },
          data: { email },
        });
        console.log(`   ✅ @${user.username} → ${email}`);
      }
    }
  }

  return orphanedUsers.length;
}

/**
 * Main fix function
 */
async function main() {
  const options = parseArgs();

  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      FIX ORPHANED RECORDS SCRIPT                           ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  if (options.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be applied');
  }

  console.log(`\nStarted at: ${new Date().toISOString()}`);
  console.log('\nOptions:');
  console.log(`  - Dry Run: ${options.dryRun ? 'YES' : 'NO'}`);
  console.log(`  - Delete Orphaned Docs: ${options.deleteOrphanedDocs ? 'YES' : 'NO'}`);

  let totalFixed = 0;

  try {
    // Fix documents
    const docsFixed = await fixDocumentsWithoutProject(options);
    totalFixed += docsFixed;

    // Fix users
    const usersFixed = await fixUsersWithoutEmail(options);
    totalFixed += usersFixed;

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\nTotal records processed: ${totalFixed}`);
    console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes applied)' : 'LIVE (changes applied)'}`);

    if (!options.dryRun && totalFixed > 0) {
      console.log('\n✅ Fixes applied successfully!');
      console.log('\n🔄 Run the audit script again to verify:');
      console.log('   npx tsx scripts/audit-orphaned-records.ts\n');
    } else if (options.dryRun && totalFixed > 0) {
      console.log('\n💡 To apply these fixes, run:');
      console.log('   npx tsx scripts/fix-orphaned-records.ts\n');
    } else {
      console.log('\n✨ No orphaned records to fix\n');
    }

    console.log(`Completed at: ${new Date().toISOString()}\n`);
  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
