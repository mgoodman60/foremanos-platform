#!/usr/bin/env tsx
/**
 * Orphaned Document Recovery Script
 * 
 * This script checks for documents that were uploaded but never queued for processing,
 * and automatically recovers them by initiating processing.
 * 
 * Usage:
 *   tsx scripts/recover-orphaned-documents.ts
 * 
 * Can be run manually or scheduled via cron:
 *   # Run every hour
 *   0 * * * * cd /path/to/project && tsx scripts/recover-orphaned-documents.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { recoverAllOrphanedDocuments } from '../lib/orphaned-document-recovery';
import { prisma } from '../lib/db';

async function main() {
  console.log('\n=== Orphaned Document Recovery ===');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    const recoveredCount = await recoverAllOrphanedDocuments();

    console.log('\n=== Recovery Summary ===');
    console.log(`Total documents recovered: ${recoveredCount}`);
    console.log(`Completed at: ${new Date().toISOString()}`);

    if (recoveredCount > 0) {
      console.log('\n✅ Recovery successful!');
    } else {
      console.log('\n✨ No orphaned documents found');
    }
  } catch (error) {
    console.error('\n❌ Recovery failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
