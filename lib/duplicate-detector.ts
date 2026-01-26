import { prisma } from './db';
import crypto from 'crypto';

/**
 * Calculate hash of file buffer for duplicate detection
 */
export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Find duplicate documents in a project based on file hash or name+size
 * @param projectId The project ID to search within
 * @param fileHash Optional file hash to match
 * @param fileName Optional file name to match
 * @param fileSize Optional file size to match
 * @returns Array of duplicate document IDs
 */
export async function findDuplicates(
  projectId: string,
  fileHash?: string,
  fileName?: string,
  fileSize?: number
): Promise<string[]> {
  const documents = await prisma.document.findMany({
    where: {
      projectId,
      deletedAt: null, // Exclude soft-deleted documents
    },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      oneDriveHash: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc', // Keep oldest document
    },
  });

  const duplicateIds: string[] = [];
  const seenHashes = new Set<string>();
  const seenFileSignatures = new Set<string>();

  for (const doc of documents) {
    let isDuplicate = false;

    // Check by file hash (most reliable)
    if (fileHash && doc.oneDriveHash === fileHash) {
      if (seenHashes.has(fileHash)) {
        isDuplicate = true;
      } else {
        seenHashes.add(fileHash);
      }
    } else if (doc.oneDriveHash) {
      if (seenHashes.has(doc.oneDriveHash)) {
        isDuplicate = true;
      } else {
        seenHashes.add(doc.oneDriveHash);
      }
    }

    // Check by file name + size (fallback for documents without hash)
    if (!isDuplicate && !doc.oneDriveHash) {
      const signature = `${doc.fileName}-${doc.fileSize || 0}`;
      if (fileName && fileSize) {
        const newSignature = `${fileName}-${fileSize}`;
        if (signature === newSignature && seenFileSignatures.has(signature)) {
          isDuplicate = true;
        }
      }
      
      if (seenFileSignatures.has(signature)) {
        isDuplicate = true;
      } else {
        seenFileSignatures.add(signature);
      }
    }

    if (isDuplicate) {
      duplicateIds.push(doc.id);
    }
  }

  return duplicateIds;
}

/**
 * Remove duplicate documents from a project
 * @param projectId The project ID to clean
 * @returns Object with counts of removed duplicates
 */
export async function removeDuplicates(projectId: string): Promise<{
  removed: number;
  kept: number;
  errors: string[];
}> {
  const result = {
    removed: 0,
    kept: 0,
    errors: [] as string[],
  };

  try {
    // Get all documents in the project
    const documents = await prisma.document.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        oneDriveHash: true,
        createdAt: true,
        DocumentChunk: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Process oldest first
      },
    });

    // Track unique documents
    const uniqueByHash = new Map<string, string>(); // hash -> documentId
    const uniqueBySignature = new Map<string, string>(); // fileName-size -> documentId
    const duplicateIds: string[] = [];

    for (const doc of documents) {
      let isDuplicate = false;

      // Check by hash (most reliable)
      if (doc.oneDriveHash) {
        if (uniqueByHash.has(doc.oneDriveHash)) {
          isDuplicate = true;
          console.log(`Duplicate found by hash: ${doc.fileName} (${doc.id})`);
        } else {
          uniqueByHash.set(doc.oneDriveHash, doc.id);
        }
      } else {
        // Fallback to fileName + fileSize
        const signature = `${doc.fileName}-${doc.fileSize || 0}`;
        if (uniqueBySignature.has(signature)) {
          isDuplicate = true;
          console.log(`Duplicate found by signature: ${doc.fileName} (${doc.id})`);
        } else {
          uniqueBySignature.set(signature, doc.id);
        }
      }

      if (isDuplicate) {
        duplicateIds.push(doc.id);
      } else {
        result.kept++;
      }
    }

    // Soft delete duplicates
    if (duplicateIds.length > 0) {
      const deleteResult = await prisma.document.updateMany({
        where: {
          id: { in: duplicateIds },
        },
        data: {
          deletedAt: new Date(),
        },
      });

      result.removed = deleteResult.count;
      console.log(`Removed ${result.removed} duplicate documents from project ${projectId}`);
    }
  } catch (error) {
    const errorMsg = `Error removing duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Check if a document would be a duplicate before uploading
 * @param projectId The project ID
 * @param fileName The file name
 * @param fileSize The file size in bytes
 * @param fileHash Optional file hash
 * @returns Boolean indicating if duplicate exists
 */
export async function isDuplicate(
  projectId: string,
  fileName: string,
  fileSize: number,
  fileHash?: string
): Promise<boolean> {
  const whereClause: any = {
    projectId,
    deletedAt: null,
  };

  // Check by hash first (most reliable)
  if (fileHash) {
    whereClause.oneDriveHash = fileHash;
    const existing = await prisma.document.findFirst({
      where: whereClause,
    });
    if (existing) return true;
  }

  // Fallback to fileName + fileSize
  const existing = await prisma.document.findFirst({
    where: {
      projectId,
      fileName,
      fileSize,
      deletedAt: null,
    },
  });

  return !!existing;
}
