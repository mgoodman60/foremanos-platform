import { describe, it, expect, beforeEach, vi } from 'vitest';
import { format, parseISO } from 'date-fns';
import type {
  WorkByTradeEntry,
  CrewEntry,
  ReportData,
  PhotoEntry,
  WeatherSnapshot,
  MaterialDelivery,
  EquipmentEntry,
  ScheduleUpdateEntry,
  QuantityCalculation,
} from '@/lib/types/report-data';

// Mock all dependencies using vi.hoisted pattern
const mocks = vi.hoisted(() => ({
  prisma: {
    conversation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    document: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    documentChunk: {
      create: vi.fn(),
    },
    chatMessage: {
      findMany: vi.fn(),
    },
    scheduleUpdate: {
      create: vi.fn(),
    },
    scheduleTask: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    schedule: {
      update: vi.fn(),
    },
  },
  getFileUrl: vi.fn(),
  generatePresignedUploadUrl: vi.fn(),
  uploadFile: vi.fn(),
  createScopedLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
  ReactPDF: {
    renderToBuffer: vi.fn(),
  },
  React: {
    createElement: vi.fn(),
  },
  DailyReportPDF: vi.fn(),
  OneDriveService: {
    fromProject: vi.fn(),
  },
  analyzeScheduleImpact: vi.fn(),
  processLaborFromDailyReport: vi.fn(),
  processMaterialsFromDailyReport: vi.fn(),
  extractActualsFromDailyReport: vi.fn(),
  performDailyCostRollup: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/s3', () => ({
  getFileUrl: mocks.getFileUrl,
  generatePresignedUploadUrl: mocks.generatePresignedUploadUrl,
  uploadFile: mocks.uploadFile,
}));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: mocks.createScopedLogger,
}));
vi.mock('@react-pdf/renderer', () => ({
  renderToBuffer: mocks.ReactPDF.renderToBuffer,
}));
vi.mock('react', () => ({
  createElement: mocks.React.createElement,
}));
vi.mock('@/lib/pdf-template', () => ({
  DailyReportPDF: mocks.DailyReportPDF,
}));
vi.mock('@/lib/onedrive-service', () => ({
  OneDriveService: mocks.OneDriveService,
}));
vi.mock('@/lib/schedule-analyzer', () => ({
  analyzeScheduleImpact: mocks.analyzeScheduleImpact,
}));
vi.mock('@/lib/labor-extraction-service', () => ({
  processLaborFromDailyReport: mocks.processLaborFromDailyReport,
}));
vi.mock('@/lib/material-extraction-service', () => ({
  processMaterialsFromDailyReport: mocks.processMaterialsFromDailyReport,
}));
vi.mock('@/lib/schedule-actuals-service', () => ({
  extractActualsFromDailyReport: mocks.extractActualsFromDailyReport,
}));
vi.mock('@/lib/cost-rollup-service', () => ({
  performDailyCostRollup: mocks.performDailyCostRollup,
}));

// Import after mocks are set up
import {
  hasReportData,
  isUserActive,
  updateLastActivity,
  finalizeReport,
  getReportsReadyForFinalization,
  getFinalizationStatus,
} from '@/lib/report-finalization';

// Mock data
const mockConversation = {
  id: 'conv-1',
  projectId: 'project-1',
  conversationType: 'daily_report',
  dailyReportDate: new Date('2024-01-15'),
  finalized: false,
  finalizationWarned: false,
  lastActivityAt: new Date(),
  createdAt: new Date('2024-01-15T08:00:00Z'),
  reportData: {
    workByTrade: [
      {
        trade: 'Concrete',
        company: 'ABC Concrete',
        description: 'Foundation pour',
        location: 'Building A',
        crewSize: 5,
      },
    ],
    crew: [
      { company: 'ABC Concrete', count: 5 },
      { company: 'XYZ Steel', count: 3 },
    ],
    notes: 'Good progress today',
  } as ReportData,
  weatherSnapshots: [
    {
      time: '08:00',
      temperature: 72,
      conditions: 'Sunny',
      humidity: 45,
      windSpeed: 5,
    },
  ] as WeatherSnapshot[],
  photos: [
    {
      id: 'photo-1',
      cloud_storage_path: 'projects/test/photo1.jpg',
      isPublic: false,
      caption: 'Foundation work',
      location: 'Building A',
    },
  ] as PhotoEntry[],
  scheduleUpdates: [
    {
      activity: 'Foundation',
      plannedStatus: 'In Progress',
      actualStatus: 'Complete',
    },
  ] as ScheduleUpdateEntry[],
  quantityCalculations: [
    {
      type: 'concrete',
      description: 'Foundation slab',
      location: 'Building A',
      actualQuantity: 50,
      unit: 'CY',
    },
  ] as QuantityCalculation[],
  materialDeliveries: [
    {
      sub: 'ABC Concrete',
      material: 'Concrete',
      quantity: 50,
    },
  ] as MaterialDelivery[],
  equipmentData: [
    {
      name: 'Excavator',
      type: 'Heavy Equipment',
    },
  ] as EquipmentEntry[],
  ChatMessage: [
    { id: 'msg-1', userRole: 'system', message: 'Introduction' },
    { id: 'msg-2', userRole: 'user', message: 'Started foundation work' },
  ],
  Project: {
    id: 'project-1',
    name: 'Test Project',
    slug: 'test-project',
    projectAddress: '123 Main St',
    projectManager: 'John Doe',
    superintendent: 'Jane Smith',
    clientName: 'Test Client',
    architectEngineer: 'Test Architect',
    dailyReportsFolderId: null,
    timezone: 'America/New_York',
    finalizationTime: '18:00',
    dailyReportEnabled: true,
    syncEnabled: false,
    oneDriveAccessToken: null,
    oneDriveFolderPath: 'ForemanOS',
    scheduleAutoUpdateEnabled: false,
    scheduleAutoApplyThreshold: 85,
    scheduleRequireManualReview: true,
    Schedule: [],
  },
  User: {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    companyLogo: null,
  },
};

describe('Report Finalization Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasReportData', () => {
    it('should return true when conversation has messages and report data', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await hasReportData('conv-1');

      expect(result).toBe(true);
      expect(mocks.prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        select: {
          reportData: true,
          weatherSnapshots: true,
          photos: true,
          scheduleUpdates: true,
          quantityCalculations: true,
          ChatMessage: {
            select: { id: true },
            take: 2,
          },
        },
      });
    });

    it('should return true when conversation has weather data', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        reportData: null,
        weatherSnapshots: [{ time: '08:00', temperature: 70 }],
        photos: null,
        scheduleUpdates: null,
        quantityCalculations: null,
        ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
      });

      const result = await hasReportData('conv-1');

      expect(result).toBe(true);
    });

    it('should return true when conversation has photos', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        reportData: null,
        weatherSnapshots: null,
        photos: [{ id: 'photo-1', cloud_storage_path: 'test.jpg' }],
        scheduleUpdates: null,
        quantityCalculations: null,
        ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
      });

      const result = await hasReportData('conv-1');

      expect(result).toBe(true);
    });

    it('should return false when conversation not found', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue(null);

      const result = await hasReportData('conv-1');

      expect(result).toBe(false);
    });

    it('should return false when conversation has only one message', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        reportData: { workByTrade: [] },
        weatherSnapshots: null,
        photos: null,
        scheduleUpdates: null,
        quantityCalculations: null,
        ChatMessage: [{ id: 'msg-1' }], // Only intro message
      });

      const result = await hasReportData('conv-1');

      expect(result).toBe(false);
    });

    it('should return false when conversation has no meaningful data', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        reportData: null,
        weatherSnapshots: null,
        photos: null,
        scheduleUpdates: null,
        quantityCalculations: null,
        ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
      });

      const result = await hasReportData('conv-1');

      expect(result).toBe(false);
    });

    it('should return false when reportData is empty object', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        reportData: {},
        weatherSnapshots: null,
        photos: null,
        scheduleUpdates: null,
        quantityCalculations: null,
        ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
      });

      const result = await hasReportData('conv-1');

      expect(result).toBe(false);
    });

    it('should return false when photos array is empty', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        reportData: null,
        weatherSnapshots: null,
        photos: [],
        scheduleUpdates: null,
        quantityCalculations: null,
        ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
      });

      const result = await hasReportData('conv-1');

      expect(result).toBe(false);
    });

    it('should return true when conversation has schedule updates', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        reportData: null,
        weatherSnapshots: null,
        photos: null,
        scheduleUpdates: [{ activity: 'Test', plannedStatus: 'Active' }],
        quantityCalculations: null,
        ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
      });

      const result = await hasReportData('conv-1');

      expect(result).toBe(true);
    });

    it('should return true when conversation has quantity calculations', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        reportData: null,
        weatherSnapshots: null,
        photos: null,
        scheduleUpdates: null,
        quantityCalculations: [{ type: 'concrete', actualQuantity: 50 }],
        ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
      });

      const result = await hasReportData('conv-1');

      expect(result).toBe(true);
    });
  });

  describe('isUserActive', () => {
    it('should return true when user is active within threshold', async () => {
      const recentActivity = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        lastActivityAt: recentActivity,
      });

      const result = await isUserActive('conv-1', 5);

      expect(result).toBe(true);
    });

    it('should return false when user is inactive beyond threshold', async () => {
      const oldActivity = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        lastActivityAt: oldActivity,
      });

      const result = await isUserActive('conv-1', 5);

      expect(result).toBe(false);
    });

    it('should return false when lastActivityAt is null', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        lastActivityAt: null,
      });

      const result = await isUserActive('conv-1', 5);

      expect(result).toBe(false);
    });

    it('should return false when conversation not found', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue(null);

      const result = await isUserActive('conv-1', 5);

      expect(result).toBe(false);
    });

    it('should use default threshold of 5 minutes when not specified', async () => {
      const recentActivity = new Date(Date.now() - 4 * 60 * 1000); // 4 minutes ago
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        lastActivityAt: recentActivity,
      });

      const result = await isUserActive('conv-1'); // No threshold specified

      expect(result).toBe(true);
    });

    it('should handle boundary condition at exact threshold', async () => {
      const exactThreshold = new Date(Date.now() - 5 * 60 * 1000); // Exactly 5 minutes ago
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        lastActivityAt: exactThreshold,
      });

      const result = await isUserActive('conv-1', 5);

      expect(result).toBe(false); // Should be false at exact boundary
    });
  });

  describe('updateLastActivity', () => {
    it('should update lastActivityAt timestamp', async () => {
      mocks.prisma.conversation.update.mockResolvedValue({
        id: 'conv-1',
        lastActivityAt: new Date(),
      });

      await updateLastActivity('conv-1');

      expect(mocks.prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { lastActivityAt: expect.any(Date) },
      });
    });

    it('should handle update errors', async () => {
      mocks.prisma.conversation.update.mockRejectedValue(new Error('Database error'));

      await expect(updateLastActivity('conv-1')).rejects.toThrow('Database error');
    });
  });

  describe('finalizeReport', () => {
    beforeEach(() => {
      // Set up default successful mocks
      mocks.prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      mocks.prisma.conversation.update.mockResolvedValue({
        ...mockConversation,
        finalized: true,
      });
      mocks.getFileUrl.mockResolvedValue('https://s3.example.com/photo.jpg');
      mocks.uploadFile.mockResolvedValue('projects/test/report.pdf');
      mocks.ReactPDF.renderToBuffer.mockResolvedValue(Buffer.from('PDF content'));
      mocks.React.createElement.mockReturnValue({} as any);
      mocks.prisma.document.create.mockResolvedValue({
        id: 'doc-1',
        name: 'Daily Report',
      });
      mocks.prisma.document.findFirst.mockResolvedValue({ id: 'doc-1' });
      mocks.prisma.documentChunk.create.mockResolvedValue({ id: 'chunk-1' });
      mocks.processLaborFromDailyReport.mockResolvedValue({
        entriesSaved: 2,
        linkedToBudget: 1,
        totalLaborCost: 1000,
      });
      mocks.processMaterialsFromDailyReport.mockResolvedValue({
        entriesSaved: 1,
        linkedToBudget: 1,
        totalMaterialCost: 5000,
      });
      mocks.extractActualsFromDailyReport.mockResolvedValue({
        updatedTasks: ['task-1'],
      });
      mocks.performDailyCostRollup.mockResolvedValue({
        success: true,
        summary: { totalCost: 6000 },
        budgetItemsUpdated: 2,
      });
      // Mock project.findUnique for schedule updates
      mocks.prisma.project.findUnique.mockResolvedValue(null);
    });

    it('should successfully finalize a report with all steps', async () => {
      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
        skipWarning: false,
      });

      expect(result.success).toBe(true);
      expect(result.finalized).toBe(true);
      expect(result.documentId).toBe('doc-1');
      expect(result.ragIndexed).toBe(true);

      // Verify PDF generation was called
      expect(mocks.ReactPDF.renderToBuffer).toHaveBeenCalled();
      expect(mocks.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('daily-report-'),
        false
      );

      // Verify document library save
      expect(mocks.prisma.document.create).toHaveBeenCalled();

      // Verify conversation was updated as finalized
      expect(mocks.prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          finalized: true,
          finalizedAt: expect.any(Date),
          finalizedBy: 'user-1',
          finalizationMethod: 'manual',
          isReadOnly: true,
          workflowState: 'finalized',
        }),
      });
    });

    it('should return error when conversation not found', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue(null);

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(false);
      expect(result.finalized).toBe(false);
      expect(result.error).toBe('Conversation not found');
    });

    it('should return warning when report already finalized', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        finalized: true,
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(false);
      expect(result.finalized).toBe(true);
      expect(result.warning).toBe('Report already finalized');
    });

    it('should return warning when report has no data', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        reportData: null,
        weatherSnapshots: null,
        photos: null,
        scheduleUpdates: null,
        quantityCalculations: null,
        ChatMessage: [{ id: 'msg-1' }],
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(false);
      expect(result.finalized).toBe(false);
      expect(result.warning).toBe('No data to finalize');
    });

    it('should warn and delay when user is active during auto finalization', async () => {
      const recentActivity = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        lastActivityAt: recentActivity,
        finalizationWarned: false,
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        method: 'auto',
        skipWarning: false,
      });

      expect(result.success).toBe(false);
      expect(result.finalized).toBe(false);
      expect(result.warning).toBe('User active - finalization delayed');

      // Verify warning flag was set
      expect(mocks.prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { finalizationWarned: true },
      });
    });

    it('should skip user activity check for manual finalization', async () => {
      const recentActivity = new Date(Date.now() - 2 * 60 * 1000);
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        lastActivityAt: recentActivity,
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(result.finalized).toBe(true);
    });

    it('should skip user activity check when skipWarning is true', async () => {
      const recentActivity = new Date(Date.now() - 2 * 60 * 1000);
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        lastActivityAt: recentActivity,
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        method: 'auto',
        skipWarning: true,
      });

      expect(result.success).toBe(true);
      expect(result.finalized).toBe(true);
    });

    it('should export to OneDrive when sync is enabled', async () => {
      const mockOneDriveService = {
        uploadFile: vi.fn().mockResolvedValue({ success: true }),
      };
      mocks.OneDriveService.fromProject.mockResolvedValue(mockOneDriveService);
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          syncEnabled: true,
          oneDriveAccessToken: 'token123',
        },
      });

      // Mock fetch for PDF download
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(result.onedriveExported).toBe(true);
      expect(mockOneDriveService.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('Daily_Report_'),
        expect.stringContaining('Daily Reports')
      );
    });

    it('should handle OneDrive export failure gracefully', async () => {
      mocks.OneDriveService.fromProject.mockResolvedValue(null);
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          syncEnabled: true,
          oneDriveAccessToken: 'token123',
        },
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(result.onedriveExported).toBe(false);
    });

    it('should create Daily Reports folder if it does not exist', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          dailyReportsFolderId: null,
        },
      });

      const newFolder = { id: 'folder-1', name: 'Daily Reports' };
      mocks.prisma.document.create.mockResolvedValueOnce(newFolder);

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);

      // Verify folder was created
      expect(mocks.prisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Daily Reports',
          fileType: 'folder',
          accessLevel: 'admin',
        }),
      });

      // Verify project was updated with folder ID
      expect(mocks.prisma.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: { dailyReportsFolderId: 'folder-1' },
      });
    });

    it('should process schedule updates when enabled', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          scheduleAutoUpdateEnabled: true,
          Schedule: [
            {
              id: 'schedule-1',
              autoUpdateEnabled: true,
            },
          ],
        },
      });

      // Mock the project lookup by slug
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        scheduleAutoUpdateEnabled: true,
        scheduleAutoApplyThreshold: 85,
        scheduleRequireManualReview: true,
        Schedule: [
          {
            id: 'schedule-1',
            autoUpdateEnabled: true,
          },
        ],
      });

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        { userRole: 'user', message: 'Foundation work completed' },
      ]);

      mocks.analyzeScheduleImpact.mockResolvedValue({
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'task-1',
            currentStatus: 'In Progress',
            suggestedStatus: 'Complete',
            currentPercentComplete: 50,
            suggestedPercentComplete: 100,
            confidence: 90,
            reasoning: 'Foundation work completed',
            impactType: 'progress',
            severity: 'medium',
          },
        ],
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.analyzeScheduleImpact).toHaveBeenCalled();
    });

    it('should handle schedule update errors gracefully', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          scheduleAutoUpdateEnabled: true,
        },
      });

      mocks.analyzeScheduleImpact.mockRejectedValue(new Error('Schedule analysis failed'));

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      // Should still succeed even if schedule updates fail
      expect(result.success).toBe(true);
      expect(result.finalized).toBe(true);
    });

    it('should extract labor data after finalization', async () => {
      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.processLaborFromDailyReport).toHaveBeenCalledWith(
        'conv-1',
        'project-1',
        expect.any(Date)
      );
    });

    it('should handle labor extraction errors gracefully', async () => {
      mocks.processLaborFromDailyReport.mockRejectedValue(new Error('Labor extraction failed'));

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      // Should still succeed even if labor extraction fails
      expect(result.success).toBe(true);
      expect(result.finalized).toBe(true);
    });

    it('should extract material data after finalization', async () => {
      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.processMaterialsFromDailyReport).toHaveBeenCalledWith(
        'conv-1',
        'project-1',
        expect.any(Date)
      );
    });

    it('should handle material extraction errors gracefully', async () => {
      mocks.processMaterialsFromDailyReport.mockRejectedValue(new Error('Material extraction failed'));

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      // Should still succeed even if material extraction fails
      expect(result.success).toBe(true);
      expect(result.finalized).toBe(true);
    });

    it('should extract schedule actuals after finalization', async () => {
      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.extractActualsFromDailyReport).toHaveBeenCalled();
    });

    it('should perform daily cost rollup after finalization', async () => {
      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.performDailyCostRollup).toHaveBeenCalledWith(
        'project-1',
        expect.any(Date),
        'user-1'
      );
    });

    it('should handle cost rollup errors gracefully', async () => {
      mocks.performDailyCostRollup.mockRejectedValue(new Error('Cost rollup failed'));

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      // Should still succeed even if cost rollup fails
      expect(result.success).toBe(true);
      expect(result.finalized).toBe(true);
    });

    it('should use system as finalizer when userId is not provided', async () => {
      // Mock conversation with old lastActivityAt so user is not active
      const inactiveConversation = {
        ...mockConversation,
        lastActivityAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      };
      mocks.prisma.conversation.findUnique.mockResolvedValue(inactiveConversation);

      const result = await finalizeReport({
        conversationId: 'conv-1',
        method: 'auto',
      });

      expect(result.success).toBe(true);
      expect(mocks.prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          finalizedBy: 'system',
        }),
      });
    });

    it('should handle PDF generation errors', async () => {
      mocks.ReactPDF.renderToBuffer.mockRejectedValue(new Error('PDF generation failed'));

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(false);
      expect(result.finalized).toBe(false);
      expect(result.error).toContain('PDF generation failed');
    });

    it('should handle S3 upload errors', async () => {
      mocks.uploadFile.mockRejectedValue(new Error('S3 upload failed'));

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(false);
      expect(result.finalized).toBe(false);
      expect(result.error).toContain('S3 upload failed');
    });

    it('should index report data for RAG', async () => {
      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(result.ragIndexed).toBe(true);
      expect(mocks.prisma.documentChunk.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: expect.stringContaining('Daily Report'),
          metadata: expect.objectContaining({
            conversationId: 'conv-1',
            type: 'daily_report',
          }),
        }),
      });
    });

    it('should handle missing project gracefully when indexing RAG', async () => {
      mocks.prisma.document.findFirst.mockResolvedValue(null);

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      // RAG indexing should fail gracefully but not prevent finalization
    });
  });

  describe('getReportsReadyForFinalization', () => {
    it('should return reports ready for finalization', async () => {
      // Create a date that's 18:02 in the current moment
      const now = new Date();
      now.setHours(18, 2, 0, 0);

      vi.useFakeTimers();
      vi.setSystemTime(now);

      mocks.prisma.project.findMany.mockResolvedValue([
        {
          id: 'project-1',
          slug: 'test-project',
          timezone: 'UTC',
          finalizationTime: '18:00',
          dailyReportEnabled: true,
        },
      ]);

      mocks.prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv-1' },
        { id: 'conv-2' },
      ]);

      const result = await getReportsReadyForFinalization();

      vi.useRealTimers();

      expect(result).toEqual(['conv-1', 'conv-2']);
      expect(mocks.prisma.project.findMany).toHaveBeenCalledWith({
        where: { dailyReportEnabled: true },
        select: expect.objectContaining({
          id: true,
          slug: true,
          timezone: true,
          finalizationTime: true,
        }),
      });
    });

    it('should only return unfinalized reports', async () => {
      const now = new Date();
      now.setHours(18, 2, 0, 0);

      vi.useFakeTimers();
      vi.setSystemTime(now);

      mocks.prisma.project.findMany.mockResolvedValue([
        {
          id: 'project-1',
          slug: 'test-project',
          timezone: 'UTC',
          finalizationTime: '18:00',
          dailyReportEnabled: true,
        },
      ]);

      mocks.prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv-1' },
      ]);

      const result = await getReportsReadyForFinalization();

      vi.useRealTimers();

      expect(mocks.prisma.conversation.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          finalized: false,
        }),
        select: { id: true },
      });
    });

    it('should return empty array when no projects have daily reports enabled', async () => {
      const now = new Date();
      now.setHours(18, 2, 0, 0);

      vi.useFakeTimers();
      vi.setSystemTime(now);

      mocks.prisma.project.findMany.mockResolvedValue([]);

      const result = await getReportsReadyForFinalization();

      vi.useRealTimers();

      expect(result).toEqual([]);
    });

    it('should skip projects outside finalization time window', async () => {
      const now = new Date();
      now.setHours(17, 0, 0, 0); // 17:00 - Before finalization time

      vi.useFakeTimers();
      vi.setSystemTime(now);

      mocks.prisma.project.findMany.mockResolvedValue([
        {
          id: 'project-1',
          slug: 'test-project',
          timezone: 'UTC',
          finalizationTime: '18:00',
          dailyReportEnabled: true,
        },
      ]);

      const result = await getReportsReadyForFinalization();

      vi.useRealTimers();

      expect(result).toEqual([]);
    });

    it('should handle different timezones correctly', async () => {
      const now = new Date();
      now.setHours(18, 2, 0, 0);

      vi.useFakeTimers();
      vi.setSystemTime(now);

      mocks.prisma.project.findMany.mockResolvedValue([
        {
          id: 'project-1',
          slug: 'test-project-utc',
          timezone: 'UTC',
          finalizationTime: '18:00',
          dailyReportEnabled: true,
        },
      ]);

      mocks.prisma.conversation.findMany.mockResolvedValue([]);

      await getReportsReadyForFinalization();

      vi.useRealTimers();

      // Should call conversation query for projects in finalization window
      expect(mocks.prisma.conversation.findMany).toHaveBeenCalled();
    });
  });

  describe('getFinalizationStatus', () => {
    it('should return finalization status for a conversation', async () => {
      const mockStatus = {
        id: 'conv-1',
        finalized: true,
        finalizedAt: new Date('2024-01-15T18:00:00Z'),
        finalizationMethod: 'auto',
        documentId: 'doc-1',
        onedriveExported: true,
        onedriveExportPath: 'ForemanOS/Daily Reports/report.pdf',
        ragIndexed: true,
        lastActivityAt: new Date('2024-01-15T17:55:00Z'),
        finalizationWarned: false,
      };

      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockStatus,
        reportData: { workByTrade: [] },
        ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
      });

      const result = await getFinalizationStatus('conv-1');

      expect(result).toMatchObject({
        id: 'conv-1',
        finalized: true,
        finalizedAt: expect.any(Date),
        finalizationMethod: 'auto',
        documentId: 'doc-1',
        onedriveExported: true,
        ragIndexed: true,
        hasData: expect.any(Boolean),
        isUserActive: expect.any(Boolean),
      });
    });

    it('should return null when conversation not found', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue(null);

      const result = await getFinalizationStatus('conv-1');

      expect(result).toBeNull();
    });

    it('should include hasData and isUserActive flags', async () => {
      const recentActivity = new Date(Date.now() - 2 * 60 * 1000);
      mocks.prisma.conversation.findUnique
        .mockResolvedValueOnce({
          id: 'conv-1',
          finalized: false,
          lastActivityAt: recentActivity,
          reportData: { workByTrade: [{ trade: 'Concrete' }] },
          weatherSnapshots: null,
          photos: null,
          scheduleUpdates: null,
          quantityCalculations: null,
          ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
        })
        .mockResolvedValueOnce({
          // For hasReportData check
          reportData: { workByTrade: [{ trade: 'Concrete' }] },
          weatherSnapshots: null,
          photos: null,
          scheduleUpdates: null,
          quantityCalculations: null,
          ChatMessage: [{ id: 'msg-1' }, { id: 'msg-2' }],
        })
        .mockResolvedValueOnce({
          // For isUserActive check
          lastActivityAt: recentActivity,
        });

      const result = await getFinalizationStatus('conv-1');

      expect(result).toMatchObject({
        hasData: true,
        isUserActive: true,
      });
    });
  });

  describe('PDF Generation Edge Cases', () => {
    it('should handle conversation without project', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: null,
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing company logo gracefully', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        User: {
          ...mockConversation.User,
          companyLogo: null,
        },
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      // Should not call getFileUrl for company logo
      expect(mocks.getFileUrl).not.toHaveBeenCalledWith(null, expect.anything());
    });

    it('should handle empty arrays in report data', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        reportData: {
          workByTrade: [],
          crew: [],
        },
        weatherSnapshots: [],
        photos: [],
        scheduleUpdates: [],
        quantityCalculations: [],
        materialDeliveries: [],
        equipmentData: [],
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
    });

    it('should format dates correctly in PDF data', async () => {
      const testDate = new Date('2024-01-15T12:00:00Z');
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        dailyReportDate: testDate,
      });

      await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(mocks.React.createElement).toHaveBeenCalledWith(
        mocks.DailyReportPDF,
        expect.objectContaining({
          data: expect.objectContaining({
            reportDate: expect.stringContaining('2024'),
          }),
        })
      );
    });
  });

  describe('Schedule Update Processing', () => {
    it('should store suggestions as pending when below confidence threshold', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          scheduleAutoUpdateEnabled: true,
          scheduleAutoApplyThreshold: 90,
          Schedule: [{ id: 'schedule-1', autoUpdateEnabled: true }],
        },
      });

      // Mock the project lookup by slug for schedule updates
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        scheduleAutoUpdateEnabled: true,
        scheduleAutoApplyThreshold: 90,
        scheduleRequireManualReview: true,
        Schedule: [{ id: 'schedule-1', autoUpdateEnabled: true }],
      });

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        { userRole: 'user', message: 'Some progress made' },
      ]);

      mocks.analyzeScheduleImpact.mockResolvedValue({
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'task-1',
            currentStatus: 'In Progress',
            suggestedStatus: 'Complete',
            currentPercentComplete: 50,
            suggestedPercentComplete: 75,
            confidence: 70, // Below 90% threshold
            reasoning: 'Low confidence update',
            impactType: 'progress',
            severity: 'low',
          },
        ],
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.prisma.scheduleUpdate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'pending',
          confidence: 70,
        }),
      });
    });

    it('should require manual review even for high-confidence suggestions when enabled', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          scheduleAutoUpdateEnabled: true,
          scheduleAutoApplyThreshold: 85,
          scheduleRequireManualReview: true,
          Schedule: [{ id: 'schedule-1', autoUpdateEnabled: true }],
        },
      });

      // Mock the project lookup by slug for schedule updates
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        scheduleAutoUpdateEnabled: true,
        scheduleAutoApplyThreshold: 85,
        scheduleRequireManualReview: true,
        Schedule: [{ id: 'schedule-1', autoUpdateEnabled: true }],
      });

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        { userRole: 'user', message: 'Foundation completed' },
      ]);

      mocks.analyzeScheduleImpact.mockResolvedValue({
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'task-1',
            currentStatus: 'In Progress',
            suggestedStatus: 'Complete',
            currentPercentComplete: 50,
            suggestedPercentComplete: 100,
            confidence: 95,
            reasoning: 'High confidence update',
            impactType: 'completion',
            severity: 'high',
          },
        ],
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.prisma.scheduleUpdate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'pending', // Pending even though high confidence
        }),
      });
    });

    it('should auto-apply high-confidence suggestions when manual review disabled', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          scheduleAutoUpdateEnabled: true,
          scheduleAutoApplyThreshold: 85,
          scheduleRequireManualReview: false,
          Schedule: [{ id: 'schedule-1', autoUpdateEnabled: true }],
        },
      });

      // Mock the project lookup by slug for schedule updates
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        scheduleAutoUpdateEnabled: true,
        scheduleAutoApplyThreshold: 85,
        scheduleRequireManualReview: false,
        Schedule: [{ id: 'schedule-1', autoUpdateEnabled: true }],
      });

      mocks.prisma.chatMessage.findMany.mockResolvedValue([
        { userRole: 'user', message: 'Foundation completed' },
      ]);

      mocks.prisma.scheduleTask.findFirst.mockResolvedValue({
        id: 'task-db-1',
        taskId: 'task-1',
        status: 'In Progress',
        percentComplete: 50,
      });

      mocks.analyzeScheduleImpact.mockResolvedValue({
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'task-1',
            currentStatus: 'In Progress',
            suggestedStatus: 'Complete',
            currentPercentComplete: 50,
            suggestedPercentComplete: 100,
            confidence: 95,
            reasoning: 'High confidence update',
            impactType: 'completion',
            severity: 'high',
          },
        ],
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.prisma.scheduleUpdate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'auto_applied',
          appliedAt: expect.any(Date),
        }),
      });
      expect(mocks.prisma.scheduleTask.update).toHaveBeenCalledWith({
        where: { id: 'task-db-1' },
        data: {
          status: 'Complete',
          percentComplete: 100,
        },
      });
    });

    it('should skip schedule updates when auto-update disabled', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          scheduleAutoUpdateEnabled: false,
        },
      });

      // Mock project lookup to return disabled auto-update
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        scheduleAutoUpdateEnabled: false,
        scheduleAutoApplyThreshold: 85,
        scheduleRequireManualReview: true,
        Schedule: [],
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.analyzeScheduleImpact).not.toHaveBeenCalled();
    });

    it('should skip when no active schedule exists', async () => {
      mocks.prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        Project: {
          ...mockConversation.Project,
          scheduleAutoUpdateEnabled: true,
          Schedule: [],
        },
      });

      // Mock project lookup to return no active schedules
      mocks.prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        scheduleAutoUpdateEnabled: true,
        scheduleAutoApplyThreshold: 85,
        scheduleRequireManualReview: true,
        Schedule: [], // No active schedules
      });

      const result = await finalizeReport({
        conversationId: 'conv-1',
        userId: 'user-1',
        method: 'manual',
      });

      expect(result.success).toBe(true);
      expect(mocks.analyzeScheduleImpact).not.toHaveBeenCalled();
    });
  });
});
