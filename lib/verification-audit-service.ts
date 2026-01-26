/**
 * Verification Audit Service
 * 
 * Tracks all verification activities, manual overrides, and provides
 * historical audit trail for compliance and accountability.
 */

import { prisma } from './db';
import type { 
  VerificationType, 
  VerificationOverallStatus, 
  QuantityComplianceStatus,
  OverrideType 
} from '@prisma/client';
import { SubmittalVerificationReport, VerificationResult } from './submittal-verification-service';

// =============================================================================
// INTERFACES
// =============================================================================

export interface AuditLogEntry {
  id: string;
  verificationType: VerificationType;
  submittalId: string | null;
  submittalNumber?: string;
  triggeredByName: string | null;
  triggerReason: string | null;
  resultsSummary: ResultsSummary;
  overallStatus: VerificationOverallStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  overrideCount: number;
}

export interface ResultsSummary {
  totalItems: number;
  sufficient: number;
  insufficient: number;
  excess: number;
  noRequirement: number;
  unverified: number;
}

export interface OverrideEntry {
  id: string;
  lineItemId: string | null;
  productName?: string;
  overrideType: OverrideType;
  previousStatus: QuantityComplianceStatus;
  newStatus: QuantityComplianceStatus;
  previousQty: number | null;
  newQty: number | null;
  overriddenByName: string | null;
  justification: string;
  approved: boolean;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export interface VerificationHistoryResponse {
  logs: AuditLogEntry[];
  totalCount: number;
  hasMore: boolean;
}

// =============================================================================
// AUDIT LOG CREATION
// =============================================================================

/**
 * Create an audit log entry for a verification run
 */
export async function createVerificationAuditLog(
  projectId: string,
  userId: string,
  userName: string,
  report: SubmittalVerificationReport,
  verificationType: VerificationType = 'SINGLE_SUBMITTAL',
  triggerReason: string = 'manual'
): Promise<string> {
  const startTime = new Date();
  
  // Calculate summary
  const summary: ResultsSummary = {
    totalItems: report.totalLineItems,
    sufficient: report.sufficientCount,
    insufficient: report.insufficientCount,
    excess: report.excessCount,
    noRequirement: report.noRequirementCount,
    unverified: report.totalLineItems - (
      report.sufficientCount + 
      report.insufficientCount + 
      report.excessCount + 
      report.noRequirementCount
    )
  };

  // Map overall status
  const overallStatus = mapOverallStatus(report.overallStatus);

  const auditLog = await prisma.verificationAuditLog.create({
    data: {
      projectId,
      submittalId: report.submittalId,
      verificationType,
      triggeredBy: userId,
      triggeredByName: userName,
      triggerReason,
      resultsSummary: summary as object,
      lineItemResults: report.lineItemResults as object[],
      overallStatus,
      startedAt: startTime,
      completedAt: new Date(),
      durationMs: Date.now() - startTime.getTime(),
    }
  });

  return auditLog.id;
}

/**
 * Create an audit log for bulk verification
 */
export async function createBulkVerificationAuditLog(
  projectId: string,
  userId: string,
  userName: string,
  reports: SubmittalVerificationReport[],
  triggerReason: string = 'manual'
): Promise<string> {
  const startTime = new Date();
  
  // Aggregate summaries
  const aggregateSummary: ResultsSummary = reports.reduce((acc, report) => {
    acc.totalItems += report.totalLineItems;
    acc.sufficient += report.sufficientCount;
    acc.insufficient += report.insufficientCount;
    acc.excess += report.excessCount;
    acc.noRequirement += report.noRequirementCount;
    return acc;
  }, {
    totalItems: 0,
    sufficient: 0,
    insufficient: 0,
    excess: 0,
    noRequirement: 0,
    unverified: 0
  });

  // Determine overall status
  let overallStatus: VerificationOverallStatus = 'PASS';
  if (aggregateSummary.insufficient > 0) {
    overallStatus = 'FAIL';
  } else if (aggregateSummary.excess > 0) {
    overallStatus = 'REVIEW_NEEDED';
  }

  // Flatten all line item results
  const allLineItemResults = reports.flatMap(r => r.lineItemResults);

  const auditLog = await prisma.verificationAuditLog.create({
    data: {
      projectId,
      submittalId: null, // Bulk verification doesn't target single submittal
      verificationType: 'BULK_PROJECT',
      triggeredBy: userId,
      triggeredByName: userName,
      triggerReason,
      resultsSummary: aggregateSummary as object,
      lineItemResults: allLineItemResults as object[],
      overallStatus,
      startedAt: startTime,
      completedAt: new Date(),
      durationMs: Date.now() - startTime.getTime(),
      notes: `Verified ${reports.length} submittals`
    }
  });

  return auditLog.id;
}

// =============================================================================
// AUDIT LOG RETRIEVAL
// =============================================================================

/**
 * Get verification history for a project
 */
export async function getProjectVerificationHistory(
  projectId: string,
  options: {
    limit?: number;
    offset?: number;
    submittalId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<VerificationHistoryResponse> {
  const { limit = 20, offset = 0, submittalId, startDate, endDate } = options;

  const where: Record<string, unknown> = { projectId };
  
  if (submittalId) {
    where.submittalId = submittalId;
  }
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
    if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
  }

  const [logs, totalCount] = await Promise.all([
    prisma.verificationAuditLog.findMany({
      where,
      include: {
        submittal: {
          select: { submittalNumber: true, title: true }
        },
        _count: {
          select: { overrides: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }),
    prisma.verificationAuditLog.count({ where })
  ]);

  const formattedLogs: AuditLogEntry[] = logs.map(log => ({
    id: log.id,
    verificationType: log.verificationType,
    submittalId: log.submittalId,
    submittalNumber: log.submittal?.submittalNumber,
    triggeredByName: log.triggeredByName,
    triggerReason: log.triggerReason,
    resultsSummary: log.resultsSummary as unknown as ResultsSummary,
    overallStatus: log.overallStatus,
    startedAt: log.startedAt,
    completedAt: log.completedAt,
    durationMs: log.durationMs,
    overrideCount: log._count.overrides
  }));

  return {
    logs: formattedLogs,
    totalCount,
    hasMore: offset + logs.length < totalCount
  };
}

/**
 * Get detailed verification log with line item results
 */
export async function getVerificationLogDetails(
  logId: string
): Promise<{
  log: AuditLogEntry;
  lineItemResults: VerificationResult[];
  overrides: OverrideEntry[];
} | null> {
  const log = await prisma.verificationAuditLog.findUnique({
    where: { id: logId },
    include: {
      submittal: {
        select: { submittalNumber: true, title: true }
      },
      overrides: {
        include: {
          lineItem: {
            select: { productName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!log) return null;

  const formattedOverrides: OverrideEntry[] = log.overrides.map(o => ({
    id: o.id,
    lineItemId: o.lineItemId,
    productName: o.lineItem?.productName,
    overrideType: o.overrideType,
    previousStatus: o.previousStatus,
    newStatus: o.newStatus,
    previousQty: o.previousQty,
    newQty: o.newQty,
    overriddenByName: o.overriddenByName,
    justification: o.justification,
    approved: o.approved,
    approvedByName: o.approvedByName,
    approvedAt: o.approvedAt,
    createdAt: o.createdAt
  }));

  return {
    log: {
      id: log.id,
      verificationType: log.verificationType,
      submittalId: log.submittalId,
      submittalNumber: log.submittal?.submittalNumber,
      triggeredByName: log.triggeredByName,
      triggerReason: log.triggerReason,
      resultsSummary: log.resultsSummary as unknown as ResultsSummary,
      overallStatus: log.overallStatus,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      durationMs: log.durationMs,
      overrideCount: log.overrides.length
    },
    lineItemResults: log.lineItemResults as unknown as VerificationResult[],
    overrides: formattedOverrides
  };
}

// =============================================================================
// MANUAL OVERRIDES
// =============================================================================

/**
 * Create a manual override for a line item
 */
export async function createManualOverride(
  projectId: string,
  lineItemId: string,
  userId: string,
  userName: string,
  data: {
    overrideType: OverrideType;
    newStatus: QuantityComplianceStatus;
    newQty?: number;
    justification: string;
    documentIds?: string[];
    verificationLogId?: string;
  }
): Promise<string> {
  // Get current line item status
  const lineItem = await prisma.submittalLineItem.findUnique({
    where: { id: lineItemId },
    select: { complianceStatus: true, requiredQty: true }
  });

  if (!lineItem) {
    throw new Error('Line item not found');
  }

  // Create the override record
  const override = await prisma.manualOverride.create({
    data: {
      projectId,
      lineItemId,
      verificationLogId: data.verificationLogId,
      overrideType: data.overrideType,
      previousStatus: lineItem.complianceStatus,
      newStatus: data.newStatus,
      previousQty: lineItem.requiredQty,
      newQty: data.newQty,
      overriddenBy: userId,
      overriddenByName: userName,
      justification: data.justification,
      documentIds: data.documentIds || []
    }
  });

  // Update the line item with new status/qty
  await prisma.submittalLineItem.update({
    where: { id: lineItemId },
    data: {
      complianceStatus: data.newStatus,
      requiredQty: data.newQty ?? lineItem.requiredQty,
      verificationNotes: `Manual override: ${data.justification}`
    }
  });

  return override.id;
}

/**
 * Approve or reject a manual override
 */
export async function reviewManualOverride(
  overrideId: string,
  reviewerId: string,
  reviewerName: string,
  approved: boolean,
  notes?: string
): Promise<void> {
  const override = await prisma.manualOverride.findUnique({
    where: { id: overrideId },
    include: { lineItem: true }
  });

  if (!override) {
    throw new Error('Override not found');
  }

  // Update override status
  await prisma.manualOverride.update({
    where: { id: overrideId },
    data: {
      approved,
      approvedBy: reviewerId,
      approvedByName: reviewerName,
      approvedAt: new Date(),
      approvalNotes: notes
    }
  });

  // If rejected, revert the line item to previous status
  if (!approved && override.lineItemId) {
    await prisma.submittalLineItem.update({
      where: { id: override.lineItemId },
      data: {
        complianceStatus: override.previousStatus,
        requiredQty: override.previousQty,
        verificationNotes: `Override rejected: ${notes || 'No reason provided'}`
      }
    });
  }
}

/**
 * Get pending overrides for a project (requiring approval)
 */
export async function getPendingOverrides(
  projectId: string
): Promise<OverrideEntry[]> {
  const overrides = await prisma.manualOverride.findMany({
    where: {
      projectId,
      approved: false,
      approvedBy: null
    },
    include: {
      lineItem: {
        select: { productName: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return overrides.map(o => ({
    id: o.id,
    lineItemId: o.lineItemId,
    productName: o.lineItem?.productName,
    overrideType: o.overrideType,
    previousStatus: o.previousStatus,
    newStatus: o.newStatus,
    previousQty: o.previousQty,
    newQty: o.newQty,
    overriddenByName: o.overriddenByName,
    justification: o.justification,
    approved: o.approved,
    approvedByName: o.approvedByName,
    approvedAt: o.approvedAt,
    createdAt: o.createdAt
  }));
}

// =============================================================================
// HELPERS
// =============================================================================

function mapOverallStatus(status: 'PASS' | 'FAIL' | 'REVIEW_NEEDED'): VerificationOverallStatus {
  switch (status) {
    case 'PASS': return 'PASS';
    case 'FAIL': return 'FAIL';
    case 'REVIEW_NEEDED': return 'REVIEW_NEEDED';
    default: return 'INCOMPLETE';
  }
}

/**
 * Get override history for a specific line item
 */
export async function getLineItemOverrideHistory(
  lineItemId: string
): Promise<OverrideEntry[]> {
  const overrides = await prisma.manualOverride.findMany({
    where: { lineItemId },
    include: {
      lineItem: {
        select: { productName: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return overrides.map(o => ({
    id: o.id,
    lineItemId: o.lineItemId,
    productName: o.lineItem?.productName,
    overrideType: o.overrideType,
    previousStatus: o.previousStatus,
    newStatus: o.newStatus,
    previousQty: o.previousQty,
    newQty: o.newQty,
    overriddenByName: o.overriddenByName,
    justification: o.justification,
    approved: o.approved,
    approvedByName: o.approvedByName,
    approvedAt: o.approvedAt,
    createdAt: o.createdAt
  }));
}
