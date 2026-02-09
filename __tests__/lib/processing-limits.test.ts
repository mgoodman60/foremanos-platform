import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateFileHash,
  needsProcessing,
  getProjectProcessingLimits,
  getUsageStats,
  canProcessPages,
  sendLimitNotification,
  queueDocumentForProcessing,
  getQueuedDocuments,
  calculateProcessingCost,
  getNextResetDate,
  getProcessingLimits,
  getRemainingPages,
  canProcessDocument,
  shouldResetQuota,
} from '@/lib/processing-limits';

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
  createScopedLogger: vi.fn(() => mockLogger),
}));

const mockSendEmail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/email-service', () => ({
  sendEmail: mockSendEmail,
}));

describe('processing-limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateFileHash', () => {
    it('should calculate SHA-256 hash of buffer', () => {
      const buffer = Buffer.from('test content');
      const hash = calculateFileHash(buffer);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64-character hex string
    });

    it('should produce consistent hashes for same content', () => {
      const buffer1 = Buffer.from('identical content');
      const buffer2 = Buffer.from('identical content');

      const hash1 = calculateFileHash(buffer1);
      const hash2 = calculateFileHash(buffer2);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const buffer1 = Buffer.from('content A');
      const buffer2 = Buffer.from('content B');

      const hash1 = calculateFileHash(buffer1);
      const hash2 = calculateFileHash(buffer2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('needsProcessing', () => {
    it('should return true for new document', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      const buffer = Buffer.from('test');
      const result = await needsProcessing('doc-1', buffer);

      expect(result).toBe(true);
    });

    it('should return true if never processed', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        processed: false,
        lastProcessedHash: null,
      });

      const buffer = Buffer.from('test');
      const result = await needsProcessing('doc-1', buffer);

      expect(result).toBe(true);
    });

    it('should return false if hash matches', async () => {
      const buffer = Buffer.from('test content');
      const hash = calculateFileHash(buffer);

      mockPrisma.document.findUnique.mockResolvedValue({
        processed: true,
        lastProcessedHash: hash,
      });

      const result = await needsProcessing('doc-1', buffer);

      expect(result).toBe(false);
    });

    it('should return true if hash differs (content changed)', async () => {
      const buffer = Buffer.from('new content');

      mockPrisma.document.findUnique.mockResolvedValue({
        processed: true,
        lastProcessedHash: 'old-hash-value',
      });

      const result = await needsProcessing('doc-1', buffer);

      expect(result).toBe(true);
    });
  });

  describe('getProjectProcessingLimits', () => {
    it('should retrieve project limits', async () => {
      const mockLimits = {
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockLimits);

      const result = await getProjectProcessingLimits('project-1');

      expect(result.dailyPageLimit).toBe(100);
      expect(result.monthlyPageLimit).toBe(1000);
      expect(result.queueEnabled).toBe(true);
      expect(result.alertThreshold).toBe(0.8);
      expect(result.emailOnLimitReached).toBe(true);
    });

    it('should throw error if project not found', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(getProjectProcessingLimits('nonexistent')).rejects.toThrow(
        'Project nonexistent not found'
      );
    });
  });

  describe('getUsageStats', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate daily and monthly usage', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([
          { pagesProcessed: 30, processingCost: 3.0 },
          { pagesProcessed: 20, processingCost: 2.0 },
        ]) // Daily
        .mockResolvedValueOnce([
          { pagesProcessed: 30, processingCost: 3.0 },
          { pagesProcessed: 20, processingCost: 2.0 },
          { pagesProcessed: 100, processingCost: 10.0 },
        ]); // Monthly

      const result = await getUsageStats('project-1');

      expect(result.dailyPages).toBe(50);
      expect(result.dailyCost).toBe(5.0);
      expect(result.monthlyPages).toBe(150);
      expect(result.monthlyCost).toBe(15.0);
      expect(result.dailyRemaining).toBe(50);
      expect(result.monthlyRemaining).toBe(850);
      expect(result.atLimit).toBe(false);
      expect(result.nearLimit).toBe(false);
    });

    it('should detect when at limit', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 50,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 50, processingCost: 5.0 }])
        .mockResolvedValueOnce([{ pagesProcessed: 50, processingCost: 5.0 }]);

      const result = await getUsageStats('project-1');

      expect(result.atLimit).toBe(true);
    });

    it('should detect near limit threshold', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 85, processingCost: 8.5 }])
        .mockResolvedValueOnce([{ pagesProcessed: 85, processingCost: 8.5 }]);

      const result = await getUsageStats('project-1');

      expect(result.nearLimit).toBe(true);
    });

    it('should handle projects with no processed documents', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getUsageStats('project-1');

      expect(result.dailyPages).toBe(0);
      expect(result.monthlyPages).toBe(0);
      expect(result.dailyRemaining).toBe(100);
      expect(result.monthlyRemaining).toBe(1000);
    });
  });

  describe('canProcessPages', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should allow processing within limits', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 30, processingCost: 3.0 }])
        .mockResolvedValueOnce([{ pagesProcessed: 30, processingCost: 3.0 }]);

      const result = await canProcessPages('project-1', 50);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny when daily limit exceeded', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 90, processingCost: 9.0 }])
        .mockResolvedValueOnce([{ pagesProcessed: 90, processingCost: 9.0 }]);

      const result = await canProcessPages('project-1', 20);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_limit_exceeded');
    });

    it('should deny when monthly limit exceeded', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 50, processingCost: 5.0 }])
        .mockResolvedValueOnce([{ pagesProcessed: 990, processingCost: 99.0 }]);

      const result = await canProcessPages('project-1', 20);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('monthly_limit_exceeded');
    });
  });

  describe('sendLimitNotification', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should send near limit notification', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        User_Project_ownerIdToUser: {
          email: 'owner@example.com',
        },
        emailOnLimitReached: true,
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 85, processingCost: 8.5 }])
        .mockResolvedValueOnce([{ pagesProcessed: 85, processingCost: 8.5 }]);

      await sendLimitNotification('project-1', 'near_limit');

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@example.com',
          subject: expect.stringContaining('Warning'),
        })
      );
    });

    it('should send daily limit notification', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        User_Project_ownerIdToUser: {
          email: 'owner@example.com',
        },
        emailOnLimitReached: true,
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 100, processingCost: 10.0 }])
        .mockResolvedValueOnce([{ pagesProcessed: 100, processingCost: 10.0 }]);

      await sendLimitNotification('project-1', 'daily_limit');

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Daily Processing Limit'),
        })
      );
    });

    it('should send monthly limit notification', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        User_Project_ownerIdToUser: {
          email: 'owner@example.com',
        },
        emailOnLimitReached: true,
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 50, processingCost: 5.0 }])
        .mockResolvedValueOnce([{ pagesProcessed: 1000, processingCost: 100.0 }]);

      await sendLimitNotification('project-1', 'monthly_limit');

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Monthly Processing Limit'),
        })
      );
    });

    it('should not send if notifications disabled', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        User_Project_ownerIdToUser: {
          email: 'owner@example.com',
        },
        emailOnLimitReached: false,
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
      });

      await sendLimitNotification('project-1', 'daily_limit');

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should not send if no owner email', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        User_Project_ownerIdToUser: null,
        emailOnLimitReached: true,
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
      });

      await sendLimitNotification('project-1', 'daily_limit');

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should handle email errors gracefully', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        name: 'Test Project',
        User_Project_ownerIdToUser: {
          email: 'owner@example.com',
        },
        emailOnLimitReached: true,
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockSendEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(sendLimitNotification('project-1', 'daily_limit')).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('queueDocumentForProcessing', () => {
    it('should queue document with default priority', async () => {
      mockPrisma.document.update.mockResolvedValue({});

      await queueDocumentForProcessing('doc-1');

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          queueStatus: 'queued',
          queuedAt: expect.any(Date),
          queuePriority: 5,
        },
      });
    });

    it('should queue document with custom priority', async () => {
      mockPrisma.document.update.mockResolvedValue({});

      await queueDocumentForProcessing('doc-1', 1);

      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queuePriority: 1,
          }),
        })
      );
    });
  });

  describe('getQueuedDocuments', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return queued documents within page limit', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([]) // Daily usage
        .mockResolvedValueOnce([]) // Monthly usage
        .mockResolvedValueOnce([
          {
            id: 'doc-1',
            name: 'Document 1',
            fileName: 'doc1.pdf',
            fileSize: 100 * 1024, // 100KB = ~1 page
          },
          {
            id: 'doc-2',
            name: 'Document 2',
            fileName: 'doc2.pdf',
            fileSize: 200 * 1024, // 200KB = ~2 pages
          },
        ]);

      const result = await getQueuedDocuments('project-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('doc-1');
      expect(result[0].pageEstimate).toBeGreaterThan(0);
    });

    it('should respect maxPages parameter', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      // Mock calls for getUsageStats (not needed but called internally)
      mockPrisma.document.findMany
        .mockResolvedValueOnce([]) // Daily usage
        .mockResolvedValueOnce([]) // Monthly usage
        .mockResolvedValueOnce([
          {
            id: 'doc-1',
            name: 'Document 1',
            fileName: 'doc1.pdf',
            fileSize: 100 * 1024, // Small enough to fit in maxPages=3
            queueStatus: 'queued',
          },
        ]);

      const result = await getQueuedDocuments('project-1', 3);

      expect(result).toHaveLength(1);
      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            queueStatus: 'queued',
          }),
        })
      );
    });

    it('should return empty array when no pages available', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([{ pagesProcessed: 100, processingCost: 10.0 }])
        .mockResolvedValueOnce([{ pagesProcessed: 100, processingCost: 10.0 }]);

      const result = await getQueuedDocuments('project-1');

      expect(result).toHaveLength(0);
    });

    it('should order by priority then queued date', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        dailyPageLimit: 100,
        monthlyPageLimit: 1000,
        queueEnabled: true,
        alertThreshold: 0.8,
        emailOnLimitReached: true,
      });

      mockPrisma.document.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await getQueuedDocuments('project-1');

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { queuePriority: 'asc' },
            { queuedAt: 'asc' },
          ],
        })
      );
    });
  });

  describe('calculateProcessingCost', () => {
    it('should calculate vision-ai cost', () => {
      const cost = calculateProcessingCost(10, 'vision-ai');
      expect(cost).toBe(0.1);
    });

    it('should calculate claude-haiku-ocr cost', () => {
      const cost = calculateProcessingCost(10, 'claude-haiku-ocr');
      expect(cost).toBe(0.01);
    });

    it('should calculate basic-ocr cost', () => {
      const cost = calculateProcessingCost(10, 'basic-ocr');
      expect(cost).toBe(0.03);
    });

    it('should handle zero pages', () => {
      const cost = calculateProcessingCost(0, 'vision-ai');
      expect(cost).toBe(0);
    });
  });

  describe('getNextResetDate', () => {
    it('should return first day of next month', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      const result = getNextResetDate();

      expect(result.getMonth()).toBe(1); // February (0-indexed)
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('Legacy compatibility functions', () => {
    it('canProcessDocument should return allowed', async () => {
      const result = await canProcessDocument('user-1', 10);
      expect(result.allowed).toBe(true);
    });

    it('getRemainingPages should return pages remaining', async () => {
      const result = await getRemainingPages(500);
      expect(result).toBe(500);
    });

    it('shouldResetQuota should return false', async () => {
      const result = await shouldResetQuota({});
      expect(result).toBe(false);
    });

    it('getProcessingLimits should return default limits', () => {
      const result = getProcessingLimits('free');
      expect(result.monthlyPageLimit).toBe(1000);
      expect(result.pagesPerMonth).toBe(1000);
    });
  });
});
