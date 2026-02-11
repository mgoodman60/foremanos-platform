import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createVerificationAuditLog,
  createBulkVerificationAuditLog,
  getProjectVerificationHistory,
  getVerificationLogDetails,
  createManualOverride,
  reviewManualOverride,
  getPendingOverrides,
  getLineItemOverrideHistory,
  type ResultsSummary,
} from '@/lib/verification-audit-service';

// Mock Prisma
const mockPrisma = vi.hoisted(() => ({
  verificationAuditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  manualOverride: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  submittalLineItem: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

describe('verification-audit-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVerificationAuditLog', () => {
    it('should create audit log for single submittal verification', async () => {
      const mockReport = {
        submittalId: 'submittal-1',
        submittalNumber: 'SUB-001',
        verifiedAt: new Date(),
        totalLineItems: 10,
        sufficientCount: 7,
        insufficientCount: 2,
        excessCount: 1,
        noRequirementCount: 0,
        overallStatus: 'REVIEW_NEEDED' as const,
        lineItemResults: [],
        criticalShortages: [],
      };

      mockPrisma.verificationAuditLog.create.mockResolvedValue({
        id: 'log-1',
        projectId: 'project-1',
        submittalId: 'submittal-1',
        verificationType: 'SINGLE_SUBMITTAL',
        triggeredBy: 'user-1',
        triggeredByName: 'John Doe',
        triggerReason: 'manual',
        resultsSummary: {},
        lineItemResults: [],
        overallStatus: 'REVIEW_NEEDED',
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 1000,
      });

      const logId = await createVerificationAuditLog(
        'project-1',
        'user-1',
        'John Doe',
        mockReport
      );

      expect(logId).toBe('log-1');
      expect(mockPrisma.verificationAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            submittalId: 'submittal-1',
            verificationType: 'SINGLE_SUBMITTAL',
            triggeredBy: 'user-1',
            triggeredByName: 'John Doe',
            overallStatus: 'REVIEW_NEEDED',
          }),
        })
      );
    });

    it('should calculate results summary correctly', async () => {
      const mockReport = {
        submittalId: 'submittal-1',
        submittalNumber: 'SUB-001',
        verifiedAt: new Date(),
        totalLineItems: 15,
        sufficientCount: 10,
        insufficientCount: 3,
        excessCount: 2,
        noRequirementCount: 0,
        overallStatus: 'FAIL' as const,
        lineItemResults: [],
        criticalShortages: [],
      };

      let capturedSummary: ResultsSummary | undefined;
      mockPrisma.verificationAuditLog.create.mockImplementation((args: any) => {
        capturedSummary = args.data.resultsSummary;
        return Promise.resolve({ id: 'log-1' });
      });

      await createVerificationAuditLog('project-1', 'user-1', 'John Doe', mockReport);

      expect(capturedSummary).toEqual({
        totalItems: 15,
        sufficient: 10,
        insufficient: 3,
        excess: 2,
        noRequirement: 0,
        unverified: 0, // 15 - (10 + 3 + 2 + 0) = 0
      });
    });

    it('should map overall status correctly', async () => {
      const statuses = [
        { input: 'PASS' as const, expected: 'PASS' },
        { input: 'FAIL' as const, expected: 'FAIL' },
        { input: 'REVIEW_NEEDED' as const, expected: 'REVIEW_NEEDED' },
      ];

      for (const { input, expected } of statuses) {
        mockPrisma.verificationAuditLog.create.mockResolvedValue({ id: 'log-1' });

        const mockReport = {
          submittalId: 'submittal-1',
          submittalNumber: 'SUB-001',
          verifiedAt: new Date(),
          totalLineItems: 5,
          sufficientCount: 5,
          insufficientCount: 0,
          excessCount: 0,
          noRequirementCount: 0,
          overallStatus: input,
          lineItemResults: [],
          criticalShortages: [],
        };

        await createVerificationAuditLog('project-1', 'user-1', 'John Doe', mockReport);

        expect(mockPrisma.verificationAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              overallStatus: expected,
            }),
          })
        );
      }
    });

    it('should record custom verification type', async () => {
      const mockReport = {
        submittalId: 'submittal-1',
        submittalNumber: 'SUB-001',
        verifiedAt: new Date(),
        totalLineItems: 10,
        sufficientCount: 10,
        insufficientCount: 0,
        excessCount: 0,
        noRequirementCount: 0,
        overallStatus: 'PASS' as const,
        lineItemResults: [],
        criticalShortages: [],
      };

      mockPrisma.verificationAuditLog.create.mockResolvedValue({ id: 'log-1' });

      await createVerificationAuditLog(
        'project-1',
        'user-1',
        'John Doe',
        mockReport,
        'RE_VERIFICATION',
        'auto-sync'
      );

      expect(mockPrisma.verificationAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationType: 'RE_VERIFICATION',
            triggerReason: 'auto-sync',
          }),
        })
      );
    });
  });

  describe('createBulkVerificationAuditLog', () => {
    it('should create bulk audit log with aggregated results', async () => {
      const mockReports = [
        {
          submittalId: 'submittal-1',
          submittalNumber: 'SUB-001',
          verifiedAt: new Date(),
          totalLineItems: 5,
          sufficientCount: 4,
          insufficientCount: 1,
          excessCount: 0,
          noRequirementCount: 0,
          overallStatus: 'FAIL' as const,
          lineItemResults: [{ lineItemId: '1', status: 'SUFFICIENT' }],
          criticalShortages: [],
        },
        {
          submittalId: 'submittal-2',
          submittalNumber: 'SUB-002',
          verifiedAt: new Date(),
          totalLineItems: 3,
          sufficientCount: 3,
          insufficientCount: 0,
          excessCount: 0,
          noRequirementCount: 0,
          overallStatus: 'PASS' as const,
          lineItemResults: [{ lineItemId: '2', status: 'SUFFICIENT' }],
          criticalShortages: [],
        },
      ];

      mockPrisma.verificationAuditLog.create.mockResolvedValue({ id: 'bulk-log-1' });

      const logId = await createBulkVerificationAuditLog(
        'project-1',
        'user-1',
        'John Doe',
        mockReports as any
      );

      expect(logId).toBe('bulk-log-1');
      expect(mockPrisma.verificationAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            verificationType: 'BULK_PROJECT',
            submittalId: null,
            resultsSummary: {
              totalItems: 8,
              sufficient: 7,
              insufficient: 1,
              excess: 0,
              noRequirement: 0,
              unverified: 0,
            },
            overallStatus: 'FAIL', // Has 1 insufficient
          }),
        })
      );
    });

    it('should determine overall status from aggregated results', async () => {
      const testCases = [
        {
          reports: [
            { insufficient: 0, excess: 0, sufficient: 5, noRequirement: 0, totalLineItems: 5, overallStatus: 'PASS' as const, lineItemResults: [] },
          ],
          expected: 'PASS',
        },
        {
          reports: [
            { insufficient: 1, excess: 0, sufficient: 4, noRequirement: 0, totalLineItems: 5, overallStatus: 'FAIL' as const, lineItemResults: [] },
          ],
          expected: 'FAIL',
        },
        {
          reports: [
            { insufficient: 0, excess: 1, sufficient: 4, noRequirement: 0, totalLineItems: 5, overallStatus: 'REVIEW_NEEDED' as const, lineItemResults: [] },
          ],
          expected: 'REVIEW_NEEDED',
        },
      ];

      for (const { reports, expected } of testCases) {
        vi.clearAllMocks();
        mockPrisma.verificationAuditLog.create.mockResolvedValue({ id: 'log-1' });

        const formattedReports = reports.map(r => ({
          submittalId: 'submittal-1',
          submittalNumber: 'SUB-001',
          verifiedAt: new Date(),
          totalLineItems: r.totalLineItems,
          sufficientCount: r.sufficient,
          insufficientCount: r.insufficient,
          excessCount: r.excess,
          noRequirementCount: r.noRequirement,
          overallStatus: r.overallStatus,
          lineItemResults: r.lineItemResults,
          criticalShortages: [] as any[],
        }));

        await createBulkVerificationAuditLog('project-1', 'user-1', 'John Doe', formattedReports);

        expect(mockPrisma.verificationAuditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              overallStatus: expected,
            }),
          })
        );
      }
    });

    it('should flatten all line item results', async () => {
      const mockReports = [
        {
          submittalId: 'submittal-1',
          submittalNumber: 'SUB-001',
          verifiedAt: new Date(),
          totalLineItems: 2,
          sufficientCount: 2,
          insufficientCount: 0,
          excessCount: 0,
          noRequirementCount: 0,
          overallStatus: 'PASS' as const,
          lineItemResults: [
            { lineItemId: '1', status: 'SUFFICIENT' },
            { lineItemId: '2', status: 'SUFFICIENT' },
          ],
          criticalShortages: [],
        },
        {
          submittalId: 'submittal-2',
          submittalNumber: 'SUB-002',
          verifiedAt: new Date(),
          totalLineItems: 1,
          sufficientCount: 1,
          insufficientCount: 0,
          excessCount: 0,
          noRequirementCount: 0,
          overallStatus: 'PASS' as const,
          lineItemResults: [
            { lineItemId: '3', status: 'SUFFICIENT' },
          ],
          criticalShortages: [],
        },
      ];

      let capturedLineItemResults: any[] | undefined;
      mockPrisma.verificationAuditLog.create.mockImplementation((args: any) => {
        capturedLineItemResults = args.data.lineItemResults;
        return Promise.resolve({ id: 'log-1' });
      });

      await createBulkVerificationAuditLog('project-1', 'user-1', 'John Doe', mockReports as any);

      expect(capturedLineItemResults).toHaveLength(3);
    });
  });

  describe('getProjectVerificationHistory', () => {
    it('should retrieve verification history with pagination', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          projectId: 'project-1',
          submittalId: 'submittal-1',
          verificationType: 'SINGLE_SUBMITTAL',
          triggeredByName: 'John Doe',
          triggerReason: 'manual',
          resultsSummary: {},
          overallStatus: 'PASS',
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 1000,
          submittal: { submittalNumber: 'SUB-001', title: 'Test Submittal' },
          _count: { overrides: 2 },
        },
      ];

      mockPrisma.verificationAuditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.verificationAuditLog.count.mockResolvedValue(10);

      const result = await getProjectVerificationHistory('project-1', {
        limit: 5,
        offset: 0,
      });

      expect(result.logs).toHaveLength(1);
      expect(result.totalCount).toBe(10);
      expect(result.hasMore).toBe(true);
      expect(result.logs[0].submittalNumber).toBe('SUB-001');
      expect(result.logs[0].overrideCount).toBe(2);
    });

    it('should filter by submittal ID', async () => {
      mockPrisma.verificationAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.verificationAuditLog.count.mockResolvedValue(0);

      await getProjectVerificationHistory('project-1', {
        submittalId: 'submittal-1',
      });

      expect(mockPrisma.verificationAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            submittalId: 'submittal-1',
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrisma.verificationAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.verificationAuditLog.count.mockResolvedValue(0);

      await getProjectVerificationHistory('project-1', {
        startDate,
        endDate,
      });

      expect(mockPrisma.verificationAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('should use default pagination values', async () => {
      mockPrisma.verificationAuditLog.findMany.mockResolvedValue([]);
      mockPrisma.verificationAuditLog.count.mockResolvedValue(0);

      await getProjectVerificationHistory('project-1');

      expect(mockPrisma.verificationAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        })
      );
    });

    it('should calculate hasMore correctly', async () => {
      const mockLog = {
        id: '1',
        projectId: 'project-1',
        submittalId: null,
        verificationType: 'SINGLE_SUBMITTAL',
        triggeredByName: 'Test',
        triggerReason: 'manual',
        resultsSummary: {},
        overallStatus: 'PASS',
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 1000,
        submittal: null,
        _count: { overrides: 0 },
      };

      // First call - return 20 logs (full page)
      const logs = Array.from({ length: 20 }, (_, i) => ({ ...mockLog, id: `log-${i}` }));
      mockPrisma.verificationAuditLog.findMany.mockResolvedValueOnce(logs);
      mockPrisma.verificationAuditLog.count.mockResolvedValueOnce(25);

      const result = await getProjectVerificationHistory('project-1', {
        limit: 20,
        offset: 0,
      });

      expect(result.hasMore).toBe(true); // 0 + 20 < 25

      // Second call - return 5 remaining logs
      const remainingLogs = Array.from({ length: 5 }, (_, i) => ({ ...mockLog, id: `log-${20 + i}` }));
      mockPrisma.verificationAuditLog.findMany.mockResolvedValueOnce(remainingLogs);
      mockPrisma.verificationAuditLog.count.mockResolvedValueOnce(25);

      const result2 = await getProjectVerificationHistory('project-1', {
        limit: 20,
        offset: 20,
      });

      expect(result2.hasMore).toBe(false); // 20 + 5 >= 25
    });
  });

  describe('getVerificationLogDetails', () => {
    it('should retrieve detailed log with line items and overrides', async () => {
      const mockLog = {
        id: 'log-1',
        projectId: 'project-1',
        submittalId: 'submittal-1',
        verificationType: 'SINGLE_SUBMITTAL',
        triggeredByName: 'John Doe',
        triggerReason: 'manual',
        resultsSummary: {},
        lineItemResults: [{ lineItemId: '1', status: 'SUFFICIENT' }],
        overallStatus: 'PASS',
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 1000,
        submittal: { submittalNumber: 'SUB-001', title: 'Test' },
        overrides: [
          {
            id: 'override-1',
            lineItemId: 'item-1',
            overrideType: 'QUANTITY_ADJUSTMENT',
            previousStatus: 'INSUFFICIENT',
            newStatus: 'SUFFICIENT',
            previousQty: 5,
            newQty: 10,
            overriddenByName: 'Jane Doe',
            justification: 'Updated requirement',
            approved: false,
            approvedByName: null,
            approvedAt: null,
            createdAt: new Date(),
            lineItem: { productName: 'Test Product' },
          },
        ],
      };

      mockPrisma.verificationAuditLog.findUnique.mockResolvedValue(mockLog);

      const result = await getVerificationLogDetails('log-1');

      expect(result).toBeDefined();
      expect(result?.log.id).toBe('log-1');
      expect(result?.lineItemResults).toHaveLength(1);
      expect(result?.overrides).toHaveLength(1);
      expect(result?.overrides[0].productName).toBe('Test Product');
    });

    it('should return null for non-existent log', async () => {
      mockPrisma.verificationAuditLog.findUnique.mockResolvedValue(null);

      const result = await getVerificationLogDetails('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createManualOverride', () => {
    it('should create manual override and update line item', async () => {
      mockPrisma.submittalLineItem.findUnique.mockResolvedValue({
        id: 'item-1',
        complianceStatus: 'INSUFFICIENT',
        requiredQty: 5,
      });

      mockPrisma.manualOverride.create.mockResolvedValue({
        id: 'override-1',
      });

      mockPrisma.submittalLineItem.update.mockResolvedValue({});

      const overrideId = await createManualOverride(
        'project-1',
        'item-1',
        'user-1',
        'John Doe',
        {
          overrideType: 'QUANTITY_ADJUSTMENT',
          newStatus: 'SUFFICIENT',
          newQty: 10,
          justification: 'Requirement updated',
        }
      );

      expect(overrideId).toBe('override-1');
      expect(mockPrisma.submittalLineItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            complianceStatus: 'SUFFICIENT',
            requiredQty: 10,
          }),
        })
      );
    });

    it('should throw error if line item not found', async () => {
      mockPrisma.submittalLineItem.findUnique.mockResolvedValue(null);

      await expect(
        createManualOverride('project-1', 'nonexistent', 'user-1', 'John Doe', {
          overrideType: 'STATUS_CHANGE',
          newStatus: 'SUFFICIENT',
          justification: 'Test',
        })
      ).rejects.toThrow('Line item not found');
    });

    it('should handle status override without quantity change', async () => {
      mockPrisma.submittalLineItem.findUnique.mockResolvedValue({
        id: 'item-1',
        complianceStatus: 'INSUFFICIENT',
        requiredQty: 5,
      });

      mockPrisma.manualOverride.create.mockResolvedValue({ id: 'override-1' });
      mockPrisma.submittalLineItem.update.mockResolvedValue({});

      await createManualOverride('project-1', 'item-1', 'user-1', 'John Doe', {
        overrideType: 'STATUS_CHANGE',
        newStatus: 'SUFFICIENT',
        justification: 'Status change only',
      });

      expect(mockPrisma.submittalLineItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            complianceStatus: 'SUFFICIENT',
            requiredQty: 5, // Unchanged
          }),
        })
      );
    });

    it('should attach document IDs to override', async () => {
      mockPrisma.submittalLineItem.findUnique.mockResolvedValue({
        id: 'item-1',
        complianceStatus: 'INSUFFICIENT',
        requiredQty: 5,
      });

      mockPrisma.manualOverride.create.mockResolvedValue({ id: 'override-1' });
      mockPrisma.submittalLineItem.update.mockResolvedValue({});

      await createManualOverride('project-1', 'item-1', 'user-1', 'John Doe', {
        overrideType: 'QUANTITY_ADJUSTMENT',
        newStatus: 'SUFFICIENT',
        justification: 'Per RFI response',
        documentIds: ['doc-1', 'doc-2'],
      });

      expect(mockPrisma.manualOverride.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentIds: ['doc-1', 'doc-2'],
          }),
        })
      );
    });
  });

  describe('reviewManualOverride', () => {
    it('should approve override', async () => {
      const mockOverride = {
        id: 'override-1',
        lineItemId: 'item-1',
        previousStatus: 'INSUFFICIENT',
        newStatus: 'SUFFICIENT',
        previousQty: 5,
        newQty: 10,
        lineItem: {},
      };

      mockPrisma.manualOverride.findUnique.mockResolvedValue(mockOverride);
      mockPrisma.manualOverride.update.mockResolvedValue({});

      await reviewManualOverride('override-1', 'reviewer-1', 'Reviewer', true, 'Looks good');

      expect(mockPrisma.manualOverride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'override-1' },
          data: expect.objectContaining({
            approved: true,
            approvedBy: 'reviewer-1',
            approvedByName: 'Reviewer',
            approvalNotes: 'Looks good',
          }),
        })
      );
    });

    it('should reject override and revert line item', async () => {
      const mockOverride = {
        id: 'override-1',
        lineItemId: 'item-1',
        previousStatus: 'INSUFFICIENT',
        newStatus: 'SUFFICIENT',
        previousQty: 5,
        newQty: 10,
        lineItem: {},
      };

      mockPrisma.manualOverride.findUnique.mockResolvedValue(mockOverride);
      mockPrisma.manualOverride.update.mockResolvedValue({});
      mockPrisma.submittalLineItem.update.mockResolvedValue({});

      await reviewManualOverride('override-1', 'reviewer-1', 'Reviewer', false, 'Incorrect');

      expect(mockPrisma.manualOverride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            approved: false,
          }),
        })
      );

      expect(mockPrisma.submittalLineItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'item-1' },
          data: expect.objectContaining({
            complianceStatus: 'INSUFFICIENT',
            requiredQty: 5,
          }),
        })
      );
    });

    it('should throw error if override not found', async () => {
      mockPrisma.manualOverride.findUnique.mockResolvedValue(null);

      await expect(
        reviewManualOverride('nonexistent', 'reviewer-1', 'Reviewer', true)
      ).rejects.toThrow('Override not found');
    });
  });

  describe('getPendingOverrides', () => {
    it('should retrieve pending overrides for project', async () => {
      const mockOverrides = [
        {
          id: 'override-1',
          lineItemId: 'item-1',
          overrideType: 'QUANTITY_ADJUSTMENT',
          previousStatus: 'INSUFFICIENT',
          newStatus: 'SUFFICIENT',
          previousQty: 5,
          newQty: 10,
          overriddenByName: 'John Doe',
          justification: 'Updated requirement',
          approved: false,
          approvedByName: null,
          approvedAt: null,
          createdAt: new Date(),
          lineItem: { productName: 'Test Product' },
        },
      ];

      mockPrisma.manualOverride.findMany.mockResolvedValue(mockOverrides);

      const result = await getPendingOverrides('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].approved).toBe(false);
      expect(result[0].productName).toBe('Test Product');
    });

    it('should filter for unapproved overrides only', async () => {
      mockPrisma.manualOverride.findMany.mockResolvedValue([]);

      await getPendingOverrides('project-1');

      expect(mockPrisma.manualOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            approved: false,
            approvedBy: null,
          }),
        })
      );
    });

    it('should sort by creation date descending', async () => {
      mockPrisma.manualOverride.findMany.mockResolvedValue([]);

      await getPendingOverrides('project-1');

      expect(mockPrisma.manualOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('getLineItemOverrideHistory', () => {
    it('should retrieve override history for specific line item', async () => {
      const mockOverrides = [
        {
          id: 'override-1',
          lineItemId: 'item-1',
          overrideType: 'QUANTITY_ADJUSTMENT',
          previousStatus: 'INSUFFICIENT',
          newStatus: 'SUFFICIENT',
          previousQty: 5,
          newQty: 10,
          overriddenByName: 'John Doe',
          justification: 'First override',
          approved: true,
          approvedByName: 'Manager',
          approvedAt: new Date(),
          createdAt: new Date('2024-01-01'),
          lineItem: { productName: 'Test Product' },
        },
        {
          id: 'override-2',
          lineItemId: 'item-1',
          overrideType: 'QUANTITY_ADJUSTMENT',
          previousStatus: 'SUFFICIENT',
          newStatus: 'INSUFFICIENT',
          previousQty: 10,
          newQty: 5,
          overriddenByName: 'Jane Doe',
          justification: 'Second override',
          approved: false,
          approvedByName: null,
          approvedAt: null,
          createdAt: new Date('2024-01-02'),
          lineItem: { productName: 'Test Product' },
        },
      ];

      mockPrisma.manualOverride.findMany.mockResolvedValue(mockOverrides);

      const result = await getLineItemOverrideHistory('item-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('override-1');
      expect(result[1].id).toBe('override-2');
    });

    it('should sort by creation date descending', async () => {
      mockPrisma.manualOverride.findMany.mockResolvedValue([]);

      await getLineItemOverrideHistory('item-1');

      expect(mockPrisma.manualOverride.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { lineItemId: 'item-1' },
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle zero line items in report', async () => {
      const mockReport = {
        submittalId: 'submittal-1',
        submittalNumber: 'SUB-001',
        verifiedAt: new Date(),
        totalLineItems: 0,
        sufficientCount: 0,
        insufficientCount: 0,
        excessCount: 0,
        noRequirementCount: 0,
        overallStatus: 'PASS' as const,
        lineItemResults: [],
        criticalShortages: [],
      };

      mockPrisma.verificationAuditLog.create.mockResolvedValue({ id: 'log-1' });

      await createVerificationAuditLog('project-1', 'user-1', 'John Doe', mockReport);

      expect(mockPrisma.verificationAuditLog.create).toHaveBeenCalled();
    });

    it('should handle empty bulk verification', async () => {
      mockPrisma.verificationAuditLog.create.mockResolvedValue({ id: 'log-1' });

      await createBulkVerificationAuditLog('project-1', 'user-1', 'John Doe', []);

      expect(mockPrisma.verificationAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resultsSummary: {
              totalItems: 0,
              sufficient: 0,
              insufficient: 0,
              excess: 0,
              noRequirement: 0,
              unverified: 0,
            },
          }),
        })
      );
    });

    it('should handle override without notes in review', async () => {
      const mockOverride = {
        id: 'override-1',
        lineItemId: 'item-1',
        previousStatus: 'INSUFFICIENT',
        newStatus: 'SUFFICIENT',
        previousQty: 5,
        newQty: 10,
        lineItem: {},
      };

      mockPrisma.manualOverride.findUnique.mockResolvedValue(mockOverride);
      mockPrisma.manualOverride.update.mockResolvedValue({});

      await reviewManualOverride('override-1', 'reviewer-1', 'Reviewer', true);

      expect(mockPrisma.manualOverride.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            approvalNotes: undefined,
          }),
        })
      );
    });

    it('should handle override without line item ID', async () => {
      const mockOverride = {
        id: 'override-1',
        lineItemId: null,
        previousStatus: 'INSUFFICIENT',
        newStatus: 'SUFFICIENT',
        previousQty: null,
        newQty: null,
        lineItem: null,
      };

      mockPrisma.manualOverride.findUnique.mockResolvedValue(mockOverride);
      mockPrisma.manualOverride.update.mockResolvedValue({});

      await reviewManualOverride('override-1', 'reviewer-1', 'Reviewer', false);

      // Should not attempt to update line item if lineItemId is null
      expect(mockPrisma.submittalLineItem.update).not.toHaveBeenCalled();
    });
  });
});
