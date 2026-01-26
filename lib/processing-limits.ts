/**
 * Processing Limits & Cost Control Service
 * 
 * Implements daily/monthly page limits, queueing, and deduplication
 * to optimize scheduled task costs.
 */

import { prisma } from './db';
import crypto from 'crypto';
import { sendEmail } from './email-service';

export interface ProcessingLimits {
  dailyPageLimit: number;
  monthlyPageLimit: number;
  queueEnabled: boolean;
  alertThreshold: number;
  emailOnLimitReached: boolean;
  batchProcessingTime?: string;
}

export interface UsageStats {
  dailyPages: number;
  monthlyPages: number;
  dailyCost: number;
  monthlyCost: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  atLimit: boolean;
  nearLimit: boolean; // At or above alertThreshold
}

/**
 * Calculate SHA-256 hash of file content
 */
export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Check if document needs processing based on hash comparison
 */
export async function needsProcessing(
  documentId: string,
  fileBuffer: Buffer
): Promise<boolean> {
  const currentHash = calculateFileHash(fileBuffer);
  
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      lastProcessedHash: true,
      processed: true,
    },
  });

  if (!document) {
    return true; // New document, needs processing
  }

  if (!document.processed) {
    return true; // Never processed
  }

  if (document.lastProcessedHash === currentHash) {
    console.log(`[PROCESSING_LIMITS] Document ${documentId} unchanged (hash match), skipping`);
    return false; // Content unchanged
  }

  console.log(`[PROCESSING_LIMITS] Document ${documentId} changed (hash mismatch), needs reprocessing`);
  return true;
}

/**
 * Get processing limits for a project
 */
export async function getProjectProcessingLimits(projectId: string): Promise<ProcessingLimits> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      dailyPageLimit: true,
      monthlyPageLimit: true,
      queueEnabled: true,
      alertThreshold: true,
      emailOnLimitReached: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  return {
    dailyPageLimit: project.dailyPageLimit,
    monthlyPageLimit: project.monthlyPageLimit,
    queueEnabled: project.queueEnabled,
    alertThreshold: project.alertThreshold,
    emailOnLimitReached: project.emailOnLimitReached,
  };
}

/**
 * Get current usage stats for a project
 */
export async function getUsageStats(projectId: string): Promise<UsageStats> {
  const limits = await getProjectProcessingLimits(projectId);
  
  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get start of month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Get daily usage
  const dailyDocs = await prisma.document.findMany({
    where: {
      projectId,
      processed: true,
      processedAt: { gte: today },
    },
    select: {
      pagesProcessed: true,
      processingCost: true,
    },
  });

  const dailyPages = dailyDocs.reduce((sum: any, doc: any) => sum + (doc.pagesProcessed || 0), 0);
  const dailyCost = dailyDocs.reduce((sum: any, doc: any) => sum + (doc.processingCost || 0), 0);

  // Get monthly usage
  const monthlyDocs = await prisma.document.findMany({
    where: {
      projectId,
      processed: true,
      processedAt: { gte: monthStart },
    },
    select: {
      pagesProcessed: true,
      processingCost: true,
    },
  });

  const monthlyPages = monthlyDocs.reduce((sum: any, doc: any) => sum + (doc.pagesProcessed || 0), 0);
  const monthlyCost = monthlyDocs.reduce((sum: any, doc: any) => sum + (doc.processingCost || 0), 0);

  // Calculate remaining
  const dailyRemaining = Math.max(0, limits.dailyPageLimit - dailyPages);
  const monthlyRemaining = Math.max(0, limits.monthlyPageLimit - monthlyPages);

  // Check if at/near limits
  const atLimit = dailyPages >= limits.dailyPageLimit || monthlyPages >= limits.monthlyPageLimit;
  const nearLimit = 
    (dailyPages / limits.dailyPageLimit) >= limits.alertThreshold ||
    (monthlyPages / limits.monthlyPageLimit) >= limits.alertThreshold;

  return {
    dailyPages,
    monthlyPages,
    dailyCost,
    monthlyCost,
    dailyRemaining,
    monthlyRemaining,
    atLimit,
    nearLimit,
  };
}

/**
 * Check if project can process more pages today
 */
export async function canProcessPages(
  projectId: string,
  pageCount: number
): Promise<{
  allowed: boolean;
  reason?: string;
  dailyRemaining: number;
  monthlyRemaining: number;
}> {
  const stats = await getUsageStats(projectId);

  // Check daily limit
  if (stats.dailyPages + pageCount > (await getProjectProcessingLimits(projectId)).dailyPageLimit) {
    return {
      allowed: false,
      reason: 'daily_limit_exceeded',
      dailyRemaining: stats.dailyRemaining,
      monthlyRemaining: stats.monthlyRemaining,
    };
  }

  // Check monthly limit
  if (stats.monthlyPages + pageCount > (await getProjectProcessingLimits(projectId)).monthlyPageLimit) {
    return {
      allowed: false,
      reason: 'monthly_limit_exceeded',
      dailyRemaining: stats.dailyRemaining,
      monthlyRemaining: stats.monthlyRemaining,
    };
  }

  return {
    allowed: true,
    dailyRemaining: stats.dailyRemaining,
    monthlyRemaining: stats.monthlyRemaining,
  };
}

/**
 * Send email alert when limits are reached or near threshold
 */
export async function sendLimitNotification(
  projectId: string,
  type: 'near_limit' | 'daily_limit' | 'monthly_limit'
): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        User_Project_ownerIdToUser: true,
      },
    });

    if (!project || !project.User_Project_ownerIdToUser || !project.User_Project_ownerIdToUser.email || !project.emailOnLimitReached) {
      return; // Notifications disabled or no owner email
    }

    const stats = await getUsageStats(projectId);
    const limits = await getProjectProcessingLimits(projectId);

    let subject: string;
    let message: string;

    switch (type) {
      case 'near_limit':
        const percentUsed = Math.round((stats.dailyPages / limits.dailyPageLimit) * 100);
        subject = `Processing Limit Warning - ${project.name}`;
        message = `
          <p>Your project "${project.name}" has reached ${percentUsed}% of its daily processing limit.</p>
          <p><strong>Current Usage:</strong></p>
          <ul>
            <li>Daily: ${stats.dailyPages}/${limits.dailyPageLimit} pages (${stats.dailyRemaining} remaining)</li>
            <li>Monthly: ${stats.monthlyPages}/${limits.monthlyPageLimit} pages (${stats.monthlyRemaining} remaining)</li>
          </ul>
          <p>Consider increasing your limits or deferring non-urgent document processing.</p>
        `;
        break;

      case 'daily_limit':
        subject = `Daily Processing Limit Reached - ${project.name}`;
        message = `
          <p>Your project "${project.name}" has reached its daily processing limit.</p>
          <p><strong>Current Usage:</strong></p>
          <ul>
            <li>Daily: ${stats.dailyPages}/${limits.dailyPageLimit} pages</li>
            <li>Monthly: ${stats.monthlyPages}/${limits.monthlyPageLimit} pages</li>
          </ul>
          <p>New documents will be queued and processed tomorrow at ${limits.batchProcessingTime || '03:00'}.</p>
          <p>To process urgent documents immediately, use the "Process Now" button.</p>
        `;
        break;

      case 'monthly_limit':
        subject = `Monthly Processing Limit Reached - ${project.name}`;
        message = `
          <p>Your project "${project.name}" has reached its monthly processing limit.</p>
          <p><strong>Current Usage:</strong></p>
          <ul>
            <li>Monthly: ${stats.monthlyPages}/${limits.monthlyPageLimit} pages</li>
            <li>Total Cost: $${stats.monthlyCost.toFixed(2)}</li>
          </ul>
          <p>No more documents will be processed until next month.</p>
          <p>Contact support if you need to increase your monthly limit.</p>
        `;
        break;
    }

    await sendEmail({
      to: project.User_Project_ownerIdToUser.email,
      subject,
      body: message, // Plain text version
      html: message, // HTML version
    });

    console.log(`[PROCESSING_LIMITS] Sent ${type} notification to ${project.User_Project_ownerIdToUser.email}`);
  } catch (error) {
    console.error('[PROCESSING_LIMITS] Failed to send notification:', error);
  }
}

/**
 * Queue document for batch processing
 */
export async function queueDocumentForProcessing(
  documentId: string,
  priority: number = 5
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      queueStatus: 'queued',
      queuedAt: new Date(),
      queuePriority: priority,
    },
  });

  console.log(`[PROCESSING_LIMITS] Queued document ${documentId} for batch processing (priority: ${priority})`);
}

// ============================================================================
// LEGACY COMPATIBILITY - Stub functions for old quota system
// ============================================================================

export async function canProcessDocument(userId: string, pageCount: number): Promise<{ allowed: boolean; reason?: string }> {
  console.log('[PROCESSING_LIMITS] canProcessDocument - stub for legacy compatibility');
  return { allowed: true };
}

export async function getRemainingPages(pagesUsed: number, tier?: string): Promise<number> {
  console.log('[PROCESSING_LIMITS] getRemainingPages - stub for legacy compatibility');
  return Math.max(0, 1000 - pagesUsed);
}

export async function shouldResetQuota(user: any): Promise<boolean> {
  console.log('[PROCESSING_LIMITS] shouldResetQuota - stub for legacy compatibility');
  return false;
}

export function getNextResetDate(): Date {
  const next = new Date();
  next.setMonth(next.getMonth() + 1, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function calculateProcessingCost(pages: number, processorType: string): number {
  const costPerPage = processorType === 'gpt-4o-vision' ? 0.01 :
                      processorType === 'claude-haiku-ocr' ? 0.001 :
                      0.003; // basic-ocr
  return pages * costPerPage;
}

// Legacy function for user-based limits (old quota system)
export function getProcessingLimits(tier: string): { monthlyPageLimit: number; pagesPerMonth: number } {
  console.log('[PROCESSING_LIMITS] getProcessingLimits(tier) - stub for legacy user quota');
  return { monthlyPageLimit: 1000, pagesPerMonth: 1000 };
}

/**
 * Get queued documents ready for processing (respects daily limits)
 */
export async function getQueuedDocuments(
  projectId: string,
  maxPages?: number
): Promise<Array<{
  id: string;
  name: string;
  fileName: string;
  pageEstimate: number;
}>> {
  // Get project limits
  const stats = await getUsageStats(projectId);
  const limits = await getProjectProcessingLimits(projectId);

  // Calculate how many pages we can process today
  const availablePages = maxPages || stats.dailyRemaining;

  if (availablePages <= 0) {
    console.log(`[PROCESSING_LIMITS] No pages available for processing (daily limit reached)`);
    return [];
  }

  // Get queued documents ordered by priority
  const queuedDocs = await prisma.document.findMany({
    where: {
      projectId,
      queueStatus: 'queued',
    },
    orderBy: [
      { queuePriority: 'asc' }, // Lower priority number = higher priority
      { queuedAt: 'asc' }, // Older queued docs first
    ],
    select: {
      id: true,
      name: true,
      fileName: true,
      fileSize: true,
    },
  });

  // Estimate pages and select documents up to available limit
  const selectedDocs: Array<{
    id: string;
    name: string;
    fileName: string;
    pageEstimate: number;
  }> = [];

  let totalPages = 0;

  for (const doc of queuedDocs) {
    // Rough estimate: 100KB per page
    const pageEstimate = Math.max(1, Math.ceil((doc.fileSize || 0) / (100 * 1024)));

    if (totalPages + pageEstimate <= availablePages) {
      selectedDocs.push({
        id: doc.id,
        name: doc.name,
        fileName: doc.fileName,
        pageEstimate,
      });
      totalPages += pageEstimate;
    } else {
      break; // Would exceed limit
    }
  }

  console.log(`[PROCESSING_LIMITS] Selected ${selectedDocs.length} documents (est. ${totalPages} pages) for processing`);

  return selectedDocs;
}
