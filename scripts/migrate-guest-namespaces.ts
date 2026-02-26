/**
 * Migration Script: Guest PIN Namespacing
 * Migrates existing un-namespaced guest PINs to the new format: "{ownerId}_{pin}"
 *
 * Run with: npx ts-node scripts/migrate-guest-namespaces.ts
 * Or: npx tsx scripts/migrate-guest-namespaces.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateGuestNamespaces() {
  const projects = await prisma.project.findMany({
    // @ts-expect-error strictNullChecks migration
    where: { guestUsername: { not: null } },
  });

  console.log(`Found ${projects.length} projects with guest usernames`);

  let migrated = 0;
  let skipped = 0;

  for (const project of projects) {
    // Skip if already namespaced (contains underscore after a CUID-like prefix)
    if (project.guestUsername && project.guestUsername.includes('_') && project.guestUsername.indexOf('_') > 10) {
      skipped++;
      continue;
    }

    if (!project.guestUsername || !project.ownerId) {
      skipped++;
      continue;
    }

    const namespacedPin = `${project.ownerId}_${project.guestUsername}`;

    try {
      await prisma.$transaction([
        prisma.project.update({
          where: { id: project.id },
          data: { guestUsername: namespacedPin },
        }),
        prisma.user.updateMany({
          where: { username: project.guestUsername },
          data: { username: namespacedPin },
        }),
      ]);
      migrated++;
      console.log(`Migrated: ${project.guestUsername} -> ${namespacedPin}`);
    } catch (error) {
      console.error(`Failed to migrate project ${project.id}:`, error);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
}

migrateGuestNamespaces()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
