/**
 * Orphaned Document Recovery System
 * Automatically detects and recovers documents that failed to queue during upload
 */

import { prisma } from './db';
import { processDocument } from './document-processor';
import { ProcessingQueueStatus } from '@prisma/client';

export interface OrphanedDocument {
  id: string;
  name: string;
  fileName: string;
  projectId: string;
  createdAt: Date;
  cloud_storage_path: string | null;
}

/**
 * Find documents that appear to be orphaned (stuck in processing)
 * A document is considered orphaned if:
 * 1. processed = false
 * 2. Has 0 chunks
 * 3. Has no active processing queue entry
 * 4. Was created more than 5 minutes ago
 */
export async function findOrphanedDocuments(): Promise<OrphanedDocument[]> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Find unprocessed documents with no chunks
    const unprocessedDocs = await prisma.document.findMany({
      where: {
        processed: false,
        createdAt: { lt: fiveMinutesAgo },
        deletedAt: null,
        cloud_storage_path: { not: null },
      },
      select: {
        id: true,
        name: true,
        fileName: true,
        projectId: true,
        createdAt: true,
        cloud_storage_path: true,
        _count: {
          select: { DocumentChunk: true },
        },
      },
    });

    // Filter to only documents with 0 chunks
    const docsWithNoChunks = unprocessedDocs.filter(
      (doc: any) => doc._count.DocumentChunk === 0
    );

    if (docsWithNoChunks.length === 0) {
      return [];
    }

    // Check which ones have no active queue entry
    const queueEntries = await prisma.processingQueue.findMany({
      where: {
        documentId: { in: docsWithNoChunks.map((d: any) => d.id) },
        status: { in: [ProcessingQueueStatus.queued, ProcessingQueueStatus.processing] },
      },
      select: { documentId: true },
    });

    const docsInQueue = new Set(queueEntries.map((q: any) => q.documentId));

    // Return only documents not in queue
    const orphanedDocs = docsWithNoChunks
      .filter((doc: any) => !docsInQueue.has(doc.id))
      .map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        fileName: doc.fileName,
        projectId: doc.projectId || '',
        createdAt: doc.createdAt,
        cloud_storage_path: doc.cloud_storage_path,
      }));

    return orphanedDocs;
  } catch (error) {
    console.error('[ORPHAN RECOVERY] Error finding orphaned documents:', error);
    return [];
  }
}

/**
 * Recover a single orphaned document by reprocessing it
 */
export async function recoverOrphanedDocument(documentId: string): Promise<boolean> {
  try {
    console.log(`[ORPHAN RECOVERY] Starting recovery for document ${documentId}`);

    // Verify document exists and has a file
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        cloud_storage_path: true,
        processed: true,
      },
    });

    if (!document) {
      console.log(`[ORPHAN RECOVERY] Document ${documentId} not found`);
      return false;
    }

    if (!document.cloud_storage_path) {
      console.log(`[ORPHAN RECOVERY] Document ${documentId} has no file`);
      return false;
    }

    if (document.processed) {
      console.log(`[ORPHAN RECOVERY] Document ${documentId} is already processed`);
      return false;
    }

    // Delete any existing chunks (cleanup)
    await prisma.documentChunk.deleteMany({
      where: { documentId },
    });

    // Delete any failed queue entries
    await prisma.processingQueue.deleteMany({
      where: {
        documentId,
        status: { in: [ProcessingQueueStatus.failed, ProcessingQueueStatus.completed] },
      },
    });

    // Start processing
    await processDocument(documentId);

    console.log(`[ORPHAN RECOVERY] Successfully initiated recovery for ${document.name}`);
    return true;
  } catch (error) {
    console.error(`[ORPHAN RECOVERY] Error recovering document ${documentId}:`, error);
    return false;
  }
}

/**
 * Scan for and recover all orphaned documents
 * Returns the number of documents recovered
 */
export async function recoverAllOrphanedDocuments(): Promise<number> {
  try {
    console.log('[ORPHAN RECOVERY] Starting scan for orphaned documents...');

    const orphanedDocs = await findOrphanedDocuments();

    if (orphanedDocs.length === 0) {
      console.log('[ORPHAN RECOVERY] No orphaned documents found');
      return 0;
    }

    console.log(`[ORPHAN RECOVERY] Found ${orphanedDocs.length} orphaned documents:`);
    orphanedDocs.forEach((doc) => {
      console.log(`  - ${doc.name} (${doc.id}) - Created: ${doc.createdAt}`);
    });

    let recoveredCount = 0;

    // Recover each document
    for (const doc of orphanedDocs) {
      const success = await recoverOrphanedDocument(doc.id);
      if (success) {
        recoveredCount++;
      }
      // Add a small delay between recoveries to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `[ORPHAN RECOVERY] Recovery complete: ${recoveredCount}/${orphanedDocs.length} documents recovered`
    );
    return recoveredCount;
  } catch (error) {
    console.error('[ORPHAN RECOVERY] Error during recovery scan:', error);
    return 0;
  }
}

/**
 * Get statistics about orphaned documents
 */
export async function getOrphanedDocumentStats(): Promise<{
  count: number;
  oldestOrphan: Date | null;
  totalOrphanedDocs: OrphanedDocument[];
}> {
  try {
    const orphanedDocs = await findOrphanedDocuments();

    if (orphanedDocs.length === 0) {
      return {
        count: 0,
        oldestOrphan: null,
        totalOrphanedDocs: [],
      };
    }

    const oldestOrphan = orphanedDocs.reduce((oldest, doc) => {
      return doc.createdAt < oldest ? doc.createdAt : oldest;
    }, orphanedDocs[0].createdAt);

    return {
      count: orphanedDocs.length,
      oldestOrphan,
      totalOrphanedDocs: orphanedDocs,
    };
  } catch (error) {
    console.error('[ORPHAN RECOVERY] Error getting stats:', error);
    return {
      count: 0,
      oldestOrphan: null,
      totalOrphanedDocs: [],
    };
  }
}
