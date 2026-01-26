#!/usr/bin/env node

/**
 * OneDrive Daily Sync Script (Inline version)
 * Modified to run from within nextjs_space directory
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Import Prisma and OneDrive service
const { prisma } = require('./lib/db');
const { OneDriveService } = require('./lib/onedrive-service');

// Log directory
const LOG_DIR = path.resolve(__dirname, '../logs/onedrive_sync');

/**
 * Get the log file path for today
 */
function getTodayLogFile() {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `onedrive_sync_${today}.log`);
}

/**
 * Write a log entry to today's log file
 */
function writeLog(entry) {
  const logFile = getTodayLogFile();
  const logLine = JSON.stringify(entry) + '\n';
  
  try {
    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

/**
 * Sync documents for a single project
 */
async function syncProject(project) {
  const startTime = Date.now();
  const logEntry = {
    timestamp: new Date().toISOString(),
    projectId: project.id,
    projectName: project.name,
    projectSlug: project.slug,
    status: 'FAILURE',
  };

  try {
    console.log(`\n[${new Date().toISOString()}] Starting sync for project: ${project.name} (${project.slug})`);

    // Validate that we have the necessary tokens
    if (!project.oneDriveAccessToken || !project.oneDriveRefreshToken || !project.oneDriveTokenExpiry) {
      throw new Error('Missing OneDrive OAuth tokens');
    }

    // Create SyncHistory record (in_progress)
    const syncHistory = await prisma.syncHistory.create({
      data: {
        projectId: project.id,
        triggerType: 'scheduled',
        status: 'in_progress',
        startedAt: new Date(),
      },
    });

    // Initialize OneDrive service
    const oneDriveService = new OneDriveService({
      projectId: project.id,
      accessToken: project.oneDriveAccessToken,
      refreshToken: project.oneDriveRefreshToken,
      tokenExpiry: project.oneDriveTokenExpiry,
      folderId: project.oneDriveFolderId || undefined,
    });

    // Perform the sync
    const syncResult = await oneDriveService.syncDocuments();

    // Calculate duration
    const durationMs = Date.now() - startTime;

    // Determine status based on results
    let status = 'success';
    if (syncResult.errors.length > 0) {
      status = syncResult.added + syncResult.updated + syncResult.deleted > 0 ? 'partial' : 'failed';
    }

    // Update SyncHistory record
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status,
        filesAdded: syncResult.added,
        filesUpdated: syncResult.updated,
        filesDeleted: syncResult.deleted,
        filesSkipped: syncResult.skipped,
        errorMessage: syncResult.errors.length > 0 ? syncResult.errors.join('; ') : null,
        completedAt: new Date(),
      },
    });

    // Update project's lastSyncAt timestamp
    await prisma.project.update({
      where: { id: project.id },
      data: {
        lastSyncAt: new Date(),
      },
    });

    // Update log entry with success details
    logEntry.status = status === 'failed' ? 'FAILURE' : 'SUCCESS';
    logEntry.filesAdded = syncResult.added;
    logEntry.filesUpdated = syncResult.updated;
    logEntry.filesDeleted = syncResult.deleted;
    logEntry.filesSkipped = syncResult.skipped;
    logEntry.durationMs = durationMs;
    if (syncResult.errors.length > 0) {
      logEntry.errorMessage = syncResult.errors.join('; ');
    }

    console.log(`[${new Date().toISOString()}] Sync completed for ${project.name}:`);
    console.log(`  - Added: ${syncResult.added}`);
    console.log(`  - Updated: ${syncResult.updated}`);
    console.log(`  - Deleted: ${syncResult.deleted}`);
    console.log(`  - Skipped: ${syncResult.skipped}`);
    console.log(`  - Duration: ${durationMs}ms`);
    if (syncResult.errors.length > 0) {
      console.log(`  - Errors: ${syncResult.errors.length}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const durationMs = Date.now() - startTime;

    console.error(`[${new Date().toISOString()}] Error syncing project ${project.name}:`, errorMessage);

    // Update log entry with error
    logEntry.status = 'FAILURE';
    logEntry.errorMessage = errorMessage;
    logEntry.durationMs = durationMs;

    // Try to create a failed SyncHistory record
    try {
      await prisma.syncHistory.create({
        data: {
          projectId: project.id,
          triggerType: 'scheduled',
          status: 'failed',
          errorMessage: errorMessage,
          startedAt: new Date(startTime),
          completedAt: new Date(),
        },
      });
    } catch (historyError) {
      console.error('Failed to create SyncHistory record:', historyError);
    }

    // Try to update lastSyncAt even on failure
    try {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          lastSyncAt: new Date(),
        },
      });
    } catch (updateError) {
      console.error('Failed to update lastSyncAt:', updateError);
    }
  } finally {
    // Always write the log entry
    writeLog(logEntry);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(80));
  console.log(`OneDrive Daily Sync - Started at ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  try {
    // Ensure log directory exists
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    // Query all projects that need syncing
    const projects = await prisma.project.findMany({
      where: {
        oneDriveAccessToken: { not: null },
        syncEnabled: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        oneDriveAccessToken: true,
        oneDriveRefreshToken: true,
        oneDriveTokenExpiry: true,
        oneDriveFolderId: true,
      },
    });

    console.log(`Found ${projects.length} project(s) with auto-sync enabled`);

    if (projects.length === 0) {
      writeLog({
        timestamp: new Date().toISOString(),
        projectId: 'N/A',
        projectName: 'N/A',
        projectSlug: 'N/A',
        status: 'SKIPPED',
        errorMessage: 'No projects found with auto-sync enabled',
      });
      console.log('No projects to sync. Exiting.');
      return;
    }

    // Process each project sequentially
    for (const project of projects) {
      await syncProject(project);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`OneDrive Daily Sync - Completed at ${new Date().toISOString()}`);
    console.log('='.repeat(80));

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('FATAL ERROR:', errorMessage);
    console.error(error);

    // Write fatal error log
    writeLog({
      timestamp: new Date().toISOString(),
      projectId: 'SYSTEM',
      projectName: 'SYSTEM',
      projectSlug: 'SYSTEM',
      status: 'FAILURE',
      errorMessage: `FATAL: ${errorMessage}`,
    });

    process.exit(1);
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});
