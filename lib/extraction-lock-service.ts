/**
 * Extraction Lock Service
 * 
 * Prevents race conditions during document extraction processes.
 * Uses database-based locking with automatic expiration to prevent deadlocks.
 */

import { prisma } from './db';
import { createScopedLogger } from './logger';
import { v4 as uuidv4 } from 'uuid';

const log = createScopedLogger('EXTRACTION_LOCK');

export type ExtractionType = 'schedule' | 'budget' | 'takeoff' | 'mep' | 'doors' | 'windows' | 'room' | 'sitework';
export type ResourceType = 'document' | 'project';

const DEFAULT_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_CHECK_INTERVAL_MS = 500; // 500ms between lock attempts
const MAX_LOCK_ATTEMPTS = 10; // Maximum wait of ~5 seconds

export interface LockResult {
  acquired: boolean;
  lockId?: string;
  processId?: string;
  existingLock?: {
    processId: string;
    acquiredAt: Date;
    expiresAt: Date;
  };
}

/**
 * Acquire an extraction lock for a resource
 * @param resourceType - 'document' or 'project'
 * @param resourceId - The ID of the document or project
 * @param extractionType - The type of extraction (schedule, budget, etc.)
 * @param durationMs - How long the lock should be held (default 5 minutes)
 * @returns LockResult with acquired status and lock details
 */
export async function acquireLock(
  resourceType: ResourceType,
  resourceId: string,
  extractionType: ExtractionType,
  durationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<LockResult> {
  const processId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMs);

  try {
    // First, clean up any expired locks
    await cleanupExpiredLocks();

    // Try to create the lock (upsert to handle race conditions at DB level)
    const lock = await prisma.extractionLock.create({
      data: {
        resourceType,
        resourceId,
        extractionType,
        processId,
        expiresAt,
      },
    });

    log.info('Lock acquired', { extractionType, resourceType, resourceId, processId: processId.slice(0, 8) });
    
    return {
      acquired: true,
      lockId: lock.id,
      processId,
    };
  } catch (error: unknown) {
    // Unique constraint violation - lock already exists
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2002') {
      const existingLock = await prisma.extractionLock.findUnique({
        where: {
          resourceType_resourceId_extractionType: {
            resourceType,
            resourceId,
            extractionType,
          },
        },
      });

      if (existingLock) {
        // Check if the existing lock has expired
        if (existingLock.expiresAt < now) {
          log.info('Existing lock expired, attempting to take over');
          
          // Delete the expired lock and try again
          try {
            await prisma.extractionLock.delete({
              where: { id: existingLock.id },
            });
            // Recursive call to try acquiring again
            return acquireLock(resourceType, resourceId, extractionType, durationMs);
          } catch {
            // Another process might have taken it, that's fine
          }
        }

        log.info('Lock held by another process', { processId: existingLock.processId.slice(0, 8), acquiredAt: existingLock.acquiredAt.toISOString() });
        
        return {
          acquired: false,
          existingLock: {
            processId: existingLock.processId,
            acquiredAt: existingLock.acquiredAt,
            expiresAt: existingLock.expiresAt,
          },
        };
      }
    }

    log.error('Error acquiring lock', error as Error);
    throw error;
  }
}

/**
 * Attempt to acquire a lock with retry logic
 * Will wait and retry if the lock is held by another process
 */
export async function acquireLockWithRetry(
  resourceType: ResourceType,
  resourceId: string,
  extractionType: ExtractionType,
  options: {
    maxAttempts?: number;
    retryIntervalMs?: number;
    durationMs?: number;
  } = {}
): Promise<LockResult> {
  const maxAttempts = options.maxAttempts || MAX_LOCK_ATTEMPTS;
  const retryIntervalMs = options.retryIntervalMs || LOCK_CHECK_INTERVAL_MS;
  const durationMs = options.durationMs || DEFAULT_LOCK_DURATION_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await acquireLock(resourceType, resourceId, extractionType, durationMs);
    
    if (result.acquired) {
      return result;
    }

    if (attempt < maxAttempts) {
      log.info('Lock attempt failed, retrying', { attempt, maxAttempts, retryIntervalMs });
      await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
    }
  }

  log.warn('Failed to acquire lock after max attempts', { maxAttempts });
  return { acquired: false };
}

/**
 * Release an extraction lock
 * @param processId - The process ID that holds the lock
 * @param extractionType - Optional: only release locks of this type
 */
export async function releaseLock(
  processId: string,
  resourceType?: ResourceType,
  resourceId?: string,
  extractionType?: ExtractionType
): Promise<boolean> {
  try {
    const where: any = { processId };
    
    if (resourceType && resourceId && extractionType) {
      where.resourceType = resourceType;
      where.resourceId = resourceId;
      where.extractionType = extractionType;
    }

    const result = await prisma.extractionLock.deleteMany({ where });
    
    if (result.count > 0) {
      log.info('Released locks', { count: result.count, processId: processId.slice(0, 8) });
      return true;
    }
    
    return false;
  } catch (error) {
    log.error('Error releasing lock', error as Error);
    return false;
  }
}

/**
 * Release a lock by its ID
 */
export async function releaseLockById(lockId: string): Promise<boolean> {
  try {
    await prisma.extractionLock.delete({
      where: { id: lockId },
    });
    log.info('Released lock by ID', { lockId: lockId.slice(0, 8) });
    return true;
  } catch (error) {
    log.error('Error releasing lock by ID', error as Error);
    return false;
  }
}

/**
 * Check if a resource is currently locked
 */
export async function isLocked(
  resourceType: ResourceType,
  resourceId: string,
  extractionType: ExtractionType
): Promise<boolean> {
  const now = new Date();
  
  const lock = await prisma.extractionLock.findUnique({
    where: {
      resourceType_resourceId_extractionType: {
        resourceType,
        resourceId,
        extractionType,
      },
    },
  });

  // Lock exists and hasn't expired
  return lock !== null && lock.expiresAt > now;
}

/**
 * Get all active locks for a resource
 */
export async function getActiveLocks(
  resourceType: ResourceType,
  resourceId: string
): Promise<{ extractionType: string; processId: string; acquiredAt: Date; expiresAt: Date }[]> {
  const now = new Date();
  
  const locks = await prisma.extractionLock.findMany({
    where: {
      resourceType,
      resourceId,
      expiresAt: { gt: now },
    },
    select: {
      extractionType: true,
      processId: true,
      acquiredAt: true,
      expiresAt: true,
    },
  });

  return locks;
}

/**
 * Clean up expired locks
 */
export async function cleanupExpiredLocks(): Promise<number> {
  const now = new Date();
  
  const result = await prisma.extractionLock.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });

  if (result.count > 0) {
    log.info('Cleaned up expired locks', { count: result.count });
  }

  return result.count;
}

/**
 * Extend a lock's expiration time
 */
export async function extendLock(
  processId: string,
  resourceType: ResourceType,
  resourceId: string,
  extractionType: ExtractionType,
  additionalMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<boolean> {
  try {
    const lock = await prisma.extractionLock.findFirst({
      where: {
        processId,
        resourceType,
        resourceId,
        extractionType,
      },
    });

    if (!lock) {
      log.warn('Cannot extend - lock not found');
      return false;
    }

    const newExpiresAt = new Date(Date.now() + additionalMs);
    
    await prisma.extractionLock.update({
      where: { id: lock.id },
      data: { expiresAt: newExpiresAt },
    });

    log.info('Extended lock', { expiresAt: newExpiresAt.toISOString() });
    return true;
  } catch (error) {
    log.error('Error extending lock', error as Error);
    return false;
  }
}

/**
 * Wrapper to execute a function with lock protection
 * Automatically acquires and releases the lock
 */
export async function withLock<T>(
  resourceType: ResourceType,
  resourceId: string,
  extractionType: ExtractionType,
  fn: () => Promise<T>,
  options: {
    skipIfLocked?: boolean;
    waitForLock?: boolean;
    maxWaitAttempts?: number;
    lockDurationMs?: number;
  } = {}
): Promise<{ success: boolean; result?: T; skipped?: boolean; error?: string }> {
  const { skipIfLocked = true, waitForLock = false, maxWaitAttempts = 10, lockDurationMs } = options;

  let lockResult: LockResult;

  if (waitForLock) {
    lockResult = await acquireLockWithRetry(resourceType, resourceId, extractionType, {
      maxAttempts: maxWaitAttempts,
      durationMs: lockDurationMs,
    });
  } else {
    lockResult = await acquireLock(resourceType, resourceId, extractionType, lockDurationMs);
  }

  if (!lockResult.acquired) {
    if (skipIfLocked) {
      log.info('Skipping extraction - already in progress', { extractionType });
      return { success: true, skipped: true };
    }
    return { success: false, error: 'Could not acquire lock' };
  }

  try {
    const result = await fn();
    return { success: true, result };
  } catch (error: unknown) {
    log.error('Error during locked operation', error as Error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
  } finally {
    // Always release the lock
    if (lockResult.processId) {
      await releaseLock(lockResult.processId, resourceType, resourceId, extractionType);
    }
  }
}
