import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock Prisma with vi.hoisted to ensure it's available before module imports
const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  projectDataSource: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  schedule: {
    updateMany: vi.fn(),
  },
  room: {
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock feature sync services
const mockSyncServices = vi.hoisted(() => ({
  syncScaleData: vi.fn(),
  syncRoomData: vi.fn(),
  syncDoorData: vi.fn(),
  syncMEPData: vi.fn(),
  syncScheduleData: vi.fn(),
  syncDimensionData: vi.fn(),
  syncLegendData: vi.fn(),
  syncMaterialsData: vi.fn(),
}));

vi.mock('@/lib/feature-sync-services', () => mockSyncServices);

// Mock budget auto-sync
const mockBudgetSync = vi.hoisted(() => ({
  processUploadedBudgetDocument: vi.fn(),
}));

vi.mock('@/lib/budget-auto-sync', () => mockBudgetSync);

// Mock document intelligence router
const mockRouter = vi.hoisted(() => ({
  getExtractableFeatures: vi.fn(),
  determineSourceType: vi.fn(),
  shouldOverrideExisting: vi.fn(),
  DATA_SOURCE_PRIORITY: {
    dwg: 100,
    rvt: 95,
    ifc: 90,
    pdf_cad: 80,
    pdf_scan: 60,
    xlsx: 70,
    docx: 50,
    manual: 40,
  },
}));

vi.mock('@/lib/document-intelligence-router', () => mockRouter);
vi.mock('@/lib/revision-comparator', () => ({
  compareRevisions: vi.fn().mockResolvedValue({ hasOverlap: false, overlappingSheets: [], diffs: [] }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import functions after mocks
import {
  processDocumentForSync,
  syncAllProjectDocuments,
  handleDocumentDeletion,
  getProjectSyncStatus,
} from '@/lib/document-auto-sync';

describe('Document Auto-Sync - processDocumentForSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockRouter.determineSourceType.mockReturnValue('pdf_cad');
    mockRouter.getExtractableFeatures.mockReturnValue(['scale', 'rooms']);
    mockRouter.shouldOverrideExisting.mockResolvedValue({
      shouldOverride: true,
      existingSource: undefined,
      existingConfidence: undefined,
    });
  });

  describe('Feature routing and orchestration', () => {
    it('should process document successfully and route to scale service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
      mockSyncServices.syncScaleData.mockResolvedValue({
        updated: true,
        scale: '1/4" = 1\'-0"',
        ratio: 48,
      });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.documentId).toBe('doc-1');
      expect(result.fileName).toBe('Floor-Plan.pdf');
      expect(result.sourceType).toBe('pdf_cad');
      expect(result.confidence).toBe(80);
      expect(result.featuresProcessed).toContain('scale');
      expect(result.errors).toHaveLength(0);
      expect(mockSyncServices.syncScaleData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad');
    });

    it('should route to room sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['rooms']);
      mockSyncServices.syncRoomData.mockResolvedValue({
        updated: 5,
        created: 2,
      });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('rooms');
      expect(result.results['rooms']).toEqual({ updated: 5, created: 2 });
      expect(mockSyncServices.syncRoomData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad');
    });

    it('should route to door sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Door-Schedule.pdf',
        category: 'door_schedule',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['doors']);
      mockSyncServices.syncDoorData.mockResolvedValue({
        extracted: true,
        count: 12,
      });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('doors');
      expect(mockSyncServices.syncDoorData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad');
    });

    it('should route windows to door sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Window-Schedule.pdf',
        category: 'window_schedule',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['windows']);
      mockSyncServices.syncDoorData.mockResolvedValue({
        extracted: true,
        count: 8,
      });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('windows');
      expect(mockSyncServices.syncDoorData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad');
    });

    it('should route to MEP electrical service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Electrical-Plan.pdf',
        category: 'electrical_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['mep_electrical']);
      mockSyncServices.syncMEPData.mockResolvedValue({ extracted: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('mep_electrical');
      expect(mockSyncServices.syncMEPData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad', 'mep_electrical');
    });

    it('should route to MEP plumbing service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Plumbing-Plan.pdf',
        category: 'plumbing_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['mep_plumbing']);
      mockSyncServices.syncMEPData.mockResolvedValue({ extracted: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('mep_plumbing');
      expect(mockSyncServices.syncMEPData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad', 'mep_plumbing');
    });

    it('should route to MEP HVAC service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'HVAC-Plan.pdf',
        category: 'hvac_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['mep_hvac']);
      mockSyncServices.syncMEPData.mockResolvedValue({ extracted: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('mep_hvac');
      expect(mockSyncServices.syncMEPData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad', 'mep_hvac');
    });

    it('should route to budget sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Budget.xlsx',
        category: 'budgets',
      });

      mockRouter.determineSourceType.mockReturnValue('xlsx');
      mockRouter.getExtractableFeatures.mockReturnValue(['budget']);
      mockBudgetSync.processUploadedBudgetDocument.mockResolvedValue({
        processed: true,
        items: 25,
      });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('budget');
      expect(mockBudgetSync.processUploadedBudgetDocument).toHaveBeenCalledWith('doc-1', 'project-1');
    });

    it('should route to schedule sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Schedule.xlsx',
        category: 'schedule',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['schedule']);
      mockSyncServices.syncScheduleData.mockResolvedValue({ extracted: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('schedule');
      expect(mockSyncServices.syncScheduleData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad');
    });

    it('should route to dimension sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['dimensions']);
      mockSyncServices.syncDimensionData.mockResolvedValue({ extracted: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('dimensions');
      expect(mockSyncServices.syncDimensionData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad');
    });

    it('should route to legend sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['legends']);
      mockSyncServices.syncLegendData.mockResolvedValue({ extracted: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('legends');
      expect(mockSyncServices.syncLegendData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad');
    });

    it('should handle title_blocks feature without sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['title_blocks']);

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('title_blocks');
      expect(result.results['title_blocks']).toEqual({ extracted: true });
    });

    it('should route to materials sync service', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Material-Schedule.pdf',
        category: 'specifications',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['materials']);
      mockSyncServices.syncMaterialsData.mockResolvedValue({ extracted: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('materials');
      expect(mockSyncServices.syncMaterialsData).toHaveBeenCalledWith('project-1', 'doc-1', 'pdf_cad');
    });
  });

  describe('Confidence-based override logic', () => {
    it('should skip feature when existing source has higher confidence', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan-Scan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.determineSourceType.mockReturnValue('pdf_scan');
      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
      mockRouter.shouldOverrideExisting.mockResolvedValue({
        shouldOverride: false,
        existingSource: 'dwg',
        existingConfidence: 100,
      });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).not.toContain('scale');
      expect(result.featuresSkipped).toContain('scale (existing: dwg)');
      expect(mockSyncServices.syncScaleData).not.toHaveBeenCalled();
    });

    it('should process feature when new source has higher confidence', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.dwg',
        category: 'architectural_plans',
      });

      mockRouter.determineSourceType.mockReturnValue('dwg');
      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
      mockRouter.shouldOverrideExisting.mockResolvedValue({
        shouldOverride: true,
        existingSource: 'pdf_scan',
        existingConfidence: 60,
      });
      mockSyncServices.syncScaleData.mockResolvedValue({ updated: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('scale');
      expect(result.featuresSkipped).toHaveLength(0);
      expect(mockSyncServices.syncScaleData).toHaveBeenCalled();
    });

    it('should process feature when no existing source exists', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
      mockRouter.shouldOverrideExisting.mockResolvedValue({
        shouldOverride: true,
      });
      mockSyncServices.syncScaleData.mockResolvedValue({ updated: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toContain('scale');
      expect(mockSyncServices.syncScaleData).toHaveBeenCalled();
    });

    it('should apply DWG source priority correctly', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Architectural.dwg',
        category: 'architectural_plans',
      });

      mockRouter.determineSourceType.mockReturnValue('dwg');
      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
      mockSyncServices.syncScaleData.mockResolvedValue({ updated: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.confidence).toBe(100);
      expect(result.sourceType).toBe('dwg');
    });

    it('should apply Revit source priority correctly', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Building.rvt',
        category: 'architectural_plans',
      });

      mockRouter.determineSourceType.mockReturnValue('rvt');
      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
      mockSyncServices.syncScaleData.mockResolvedValue({ updated: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.confidence).toBe(95);
      expect(result.sourceType).toBe('rvt');
    });

    it('should apply IFC source priority correctly', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Model.ifc',
        category: 'architectural_plans',
      });

      mockRouter.determineSourceType.mockReturnValue('ifc');
      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
      mockSyncServices.syncScaleData.mockResolvedValue({ updated: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.confidence).toBe(90);
      expect(result.sourceType).toBe('ifc');
    });

    it('should apply Excel source priority correctly', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Budget.xlsx',
        category: 'budgets',
      });

      mockRouter.determineSourceType.mockReturnValue('xlsx');
      mockRouter.getExtractableFeatures.mockReturnValue(['budget']);
      mockBudgetSync.processUploadedBudgetDocument.mockResolvedValue({ processed: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.confidence).toBe(70);
      expect(result.sourceType).toBe('xlsx');
    });

    it('should skip multiple features when existing sources are higher confidence', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan-Scan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.determineSourceType.mockReturnValue('pdf_scan');
      mockRouter.getExtractableFeatures.mockReturnValue(['scale', 'rooms', 'dimensions']);
      mockRouter.shouldOverrideExisting.mockResolvedValue({
        shouldOverride: false,
        existingSource: 'dwg',
        existingConfidence: 100,
      });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toHaveLength(0);
      expect(result.featuresSkipped.length).toBe(3);
      expect(result.featuresSkipped).toContain('scale (existing: dwg)');
      expect(result.featuresSkipped).toContain('rooms (existing: dwg)');
      expect(result.featuresSkipped).toContain('dimensions (existing: dwg)');
    });

    it('should mix processed and skipped features based on confidence', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['scale', 'rooms']);

      // Scale should be skipped, rooms should be processed
      mockRouter.shouldOverrideExisting.mockImplementation(async (projectId, feature) => {
        if (feature === 'scale') {
          return { shouldOverride: false, existingSource: 'dwg', existingConfidence: 100 };
        }
        return { shouldOverride: true };
      });

      mockSyncServices.syncRoomData.mockResolvedValue({ updated: 5, created: 2 });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.featuresProcessed).toEqual(['rooms']);
      expect(result.featuresSkipped).toEqual(['scale (existing: dwg)']);
      expect(mockSyncServices.syncRoomData).toHaveBeenCalled();
      expect(mockSyncServices.syncScaleData).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should throw error when document not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(processDocumentForSync('nonexistent', 'project-1'))
        .rejects.toThrow('Document nonexistent not found');
    });

    it('should collect errors for failed feature syncs', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['scale', 'rooms']);
      mockSyncServices.syncScaleData.mockRejectedValue(new Error('Scale extraction failed'));
      mockSyncServices.syncRoomData.mockResolvedValue({ updated: 5, created: 2 });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.errors).toContain('scale: Scale extraction failed');
      expect(result.featuresProcessed).toContain('rooms');
      expect(result.featuresProcessed).not.toContain('scale');
    });

    it('should handle non-Error exceptions in feature sync', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
      mockSyncServices.syncScaleData.mockRejectedValue('String error');

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.errors).toContain('scale: String error');
    });

    it('should continue processing after feature sync error', async () => {
      mockPrisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        fileName: 'Floor-Plan.pdf',
        category: 'architectural_plans',
      });

      mockRouter.getExtractableFeatures.mockReturnValue(['scale', 'rooms', 'dimensions']);
      mockSyncServices.syncScaleData.mockRejectedValue(new Error('Scale failed'));
      mockSyncServices.syncRoomData.mockResolvedValue({ updated: 5, created: 2 });
      mockSyncServices.syncDimensionData.mockResolvedValue({ extracted: true });

      const result = await processDocumentForSync('doc-1', 'project-1');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('scale:');
      expect(result.featuresProcessed).toContain('rooms');
      expect(result.featuresProcessed).toContain('dimensions');
    });
  });
});

describe('Document Auto-Sync - syncAllProjectDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRouter.determineSourceType.mockReturnValue('pdf_cad');
    mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
    mockRouter.shouldOverrideExisting.mockResolvedValue({ shouldOverride: true });
    mockSyncServices.syncScaleData.mockResolvedValue({ updated: true });
  });

  it('should process all documents in a project', async () => {
    const mockDocuments = [
      { id: 'doc-1', fileName: 'Plan-A.pdf', category: 'architectural_plans', createdAt: new Date('2024-01-01') },
      { id: 'doc-2', fileName: 'Plan-B.pdf', category: 'architectural_plans', createdAt: new Date('2024-01-02') },
      { id: 'doc-3', fileName: 'Plan-C.pdf', category: 'architectural_plans', createdAt: new Date('2024-01-03') },
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
    mockPrisma.document.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(mockDocuments.find(doc => doc.id === where.id))
    );

    const result = await syncAllProjectDocuments('project-1');

    expect(result.processed).toBe(3);
    expect(result.results).toHaveLength(3);
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        processed: true,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should return empty results for project with no documents', async () => {
    mockPrisma.document.findMany.mockResolvedValue([]);

    const result = await syncAllProjectDocuments('project-1');

    expect(result.processed).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('should handle errors for individual documents gracefully', async () => {
    const mockDocuments = [
      { id: 'doc-1', fileName: 'Plan-A.pdf', category: 'architectural_plans', createdAt: new Date() },
      { id: 'doc-2', fileName: 'Plan-B.pdf', category: 'architectural_plans', createdAt: new Date() },
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
    mockPrisma.document.findUnique
      .mockResolvedValueOnce(mockDocuments[0])  // doc-1 main lookup
      .mockResolvedValueOnce({ category: 'architectural_plans' })  // doc-1 revision comparator lookup
      .mockResolvedValueOnce(null); // doc-2 not found

    const result = await syncAllProjectDocuments('project-1');

    expect(result.processed).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[1].errors[0]).toContain('Document doc-2 not found');
  });

  it('should handle non-Error exceptions in document processing', async () => {
    const mockDocuments = [
      { id: 'doc-1', fileName: 'Plan-A.pdf', category: 'architectural_plans', createdAt: new Date() },
    ];

    mockPrisma.document.findMany.mockResolvedValue(mockDocuments);
    mockPrisma.document.findUnique.mockRejectedValue('Database error');

    const result = await syncAllProjectDocuments('project-1');

    expect(result.processed).toBe(1);
    expect(result.results[0].errors).toEqual(['Database error']);
  });
});

describe('Document Auto-Sync - handleDocumentDeletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRouter.determineSourceType.mockReturnValue('pdf_cad');
    mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
    mockSyncServices.syncScaleData.mockResolvedValue({ updated: true });
  });

  describe('Deletion handling with fallback sources', () => {
    it('should re-sync from next-best source when document is deleted', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'scale', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([
        { id: 'doc-2', fileName: 'Floor-Plan-Scan.pdf', category: 'architectural_plans' },
      ]);

      mockRouter.determineSourceType.mockReturnValue('pdf_scan');
      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresAffected).toEqual(['scale']);
      expect(result.featuresResynced).toEqual(['scale']);
      expect(result.featuresCleared).toHaveLength(0);
      expect(mockPrisma.projectDataSource.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', featureType: 'scale', documentId: 'doc-1' },
      });
      expect(mockSyncServices.syncScaleData).toHaveBeenCalledWith('project-1', 'doc-2', 'pdf_scan');
    });

    it('should clear feature data when no alternative source exists', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'scale', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([]); // No other documents

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresAffected).toEqual(['scale']);
      expect(result.featuresResynced).toHaveLength(0);
      expect(result.featuresCleared).toEqual(['scale']);
      expect(mockPrisma.projectDataSource.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1', featureType: 'scale', documentId: 'doc-1' },
      });
    });

    it('should select highest priority alternative source', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'scale', sourceType: 'dwg', confidence: 100 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([
        { id: 'doc-2', fileName: 'Floor-Plan.pdf', category: 'architectural_plans' },
        { id: 'doc-3', fileName: 'Floor-Plan-Scan.pdf', category: 'architectural_plans' },
        { id: 'doc-4', fileName: 'Floor-Plan.rvt', category: 'architectural_plans' },
      ]);

      mockRouter.determineSourceType
        .mockReturnValueOnce('pdf_cad')
        .mockReturnValueOnce('pdf_scan')
        .mockReturnValueOnce('rvt');

      mockRouter.getExtractableFeatures.mockReturnValue(['scale']);

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      // Should select rvt (95) over pdf_cad (80) and pdf_scan (60)
      expect(result.featuresResynced).toEqual(['scale']);
      expect(mockSyncServices.syncScaleData).toHaveBeenCalledWith('project-1', 'doc-4', 'rvt');
    });

    it('should handle multiple affected features', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'scale', sourceType: 'pdf_cad', confidence: 80 },
        { featureType: 'rooms', sourceType: 'pdf_cad', confidence: 80 },
        { featureType: 'dimensions', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([
        { id: 'doc-2', fileName: 'Floor-Plan.pdf', category: 'architectural_plans' },
      ]);

      mockRouter.getExtractableFeatures.mockReturnValue(['scale', 'rooms', 'dimensions']);
      mockSyncServices.syncRoomData.mockResolvedValue({ updated: 5, created: 0 });
      mockSyncServices.syncDimensionData.mockResolvedValue({ extracted: true });

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresAffected).toEqual(['scale', 'rooms', 'dimensions']);
      expect(result.featuresResynced).toEqual(['scale', 'rooms', 'dimensions']);
      expect(result.featuresCleared).toHaveLength(0);
    });

    it('should skip features not supported by alternative documents', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'scale', sourceType: 'pdf_cad', confidence: 80 },
        { featureType: 'rooms', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([
        { id: 'doc-2', fileName: 'Budget.xlsx', category: 'budgets' },
      ]);

      mockRouter.determineSourceType.mockReturnValue('xlsx');
      mockRouter.getExtractableFeatures.mockReturnValue(['budget']); // Doesn't support scale or rooms

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresAffected).toEqual(['scale', 'rooms']);
      expect(result.featuresResynced).toHaveLength(0);
      expect(result.featuresCleared).toEqual(['scale', 'rooms']);
    });

    it('should handle partial re-sync with mixed results', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'scale', sourceType: 'pdf_cad', confidence: 80 },
        { featureType: 'rooms', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([
        { id: 'doc-2', fileName: 'Site-Plan.pdf', category: 'site_plans' },
      ]);

      mockRouter.getExtractableFeatures.mockReturnValue(['scale']); // Only scale, not rooms
      mockSyncServices.syncScaleData.mockResolvedValue({ updated: true });

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresResynced).toEqual(['scale']);
      expect(result.featuresCleared).toEqual(['rooms']);
    });

    it('should exclude deleted document from alternatives', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'scale', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([
        { id: 'doc-2', fileName: 'Floor-Plan.pdf', category: 'architectural_plans' },
      ]);

      await handleDocumentDeletion('doc-1', 'project-1');

      expect(mockPrisma.document.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          processed: true,
          deletedAt: null,
          id: { not: 'doc-1' },
        },
        select: { id: true, fileName: true, category: true },
      });
    });

    it('should handle errors during re-sync gracefully', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'scale', sourceType: 'pdf_cad', confidence: 80 },
        { featureType: 'rooms', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([
        { id: 'doc-2', fileName: 'Floor-Plan.pdf', category: 'architectural_plans' },
      ]);

      mockRouter.getExtractableFeatures.mockReturnValue(['scale', 'rooms']);
      mockSyncServices.syncScaleData.mockRejectedValue(new Error('Sync failed'));
      mockSyncServices.syncRoomData.mockResolvedValue({ updated: 5, created: 0 });

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresResynced).toEqual(['rooms']);
      expect(result.errors).toContain('scale: Sync failed');
    });

    it('should return early when no data sources found', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([]);

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresAffected).toHaveLength(0);
      expect(result.featuresResynced).toHaveLength(0);
      expect(result.featuresCleared).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockPrisma.document.findMany).not.toHaveBeenCalled();
    });

    it('should handle top-level errors gracefully', async () => {
      mockPrisma.projectDataSource.findMany.mockRejectedValue(new Error('Database error'));

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresAffected).toHaveLength(0);
      expect(result.errors).toContain('Database error');
    });

    it('should handle non-Error exceptions in deletion handler', async () => {
      mockPrisma.projectDataSource.findMany.mockRejectedValue('String error');

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.errors).toContain('String error');
    });
  });

  describe('Feature-specific cleanup', () => {
    it('should deactivate schedules when clearing schedule feature', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'schedule', sourceType: 'xlsx', confidence: 70 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1' });

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresCleared).toEqual(['schedule']);
      expect(mockPrisma.schedule.updateMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        data: { isActive: false },
      });
    });

    it('should preserve budget structure when clearing budget feature', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'budget', sourceType: 'xlsx', confidence: 70 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1' });

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresCleared).toEqual(['budget']);
      // Should not delete budget items (manual entries preserved)
    });

    it('should clear room data when clearing rooms feature', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'rooms', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1' });

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresCleared).toEqual(['rooms']);
    });

    it('should clear MEP electrical data', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'mep_electrical', sourceType: 'pdf_cad', confidence: 80 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1' });

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresCleared).toEqual(['mep_electrical']);
    });

    it('should skip cleanup when project not found', async () => {
      mockPrisma.projectDataSource.findMany.mockResolvedValue([
        { featureType: 'schedule', sourceType: 'xlsx', confidence: 70 },
      ]);

      mockPrisma.document.findMany.mockResolvedValue([]);
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const result = await handleDocumentDeletion('doc-1', 'project-1');

      expect(result.featuresCleared).toEqual(['schedule']);
      expect(mockPrisma.schedule.updateMany).not.toHaveBeenCalled();
    });
  });
});

describe('Document Auto-Sync - getProjectSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRouter.determineSourceType.mockReturnValue('pdf_cad');
    mockRouter.getExtractableFeatures.mockReturnValue(['scale']);
  });

  it('should return status for all features', async () => {
    mockPrisma.projectDataSource.findMany.mockResolvedValue([
      {
        featureType: 'scale',
        sourceType: 'dwg',
        confidence: 100,
        extractedAt: new Date('2024-01-01'),
        Document: { fileName: 'Floor-Plan.dwg' },
      },
    ]);

    mockPrisma.document.findMany.mockResolvedValue([
      { id: 'doc-1', fileName: 'Floor-Plan.dwg', category: 'architectural_plans' },
    ]);

    const status = await getProjectSyncStatus('project-1');

    expect(status.features.scale).toEqual({
      hasData: true,
      sourceType: 'dwg',
      confidence: 100,
      documentName: 'Floor-Plan.dwg',
      extractedAt: new Date('2024-01-01'),
    });

    expect(status.features.rooms).toEqual({
      hasData: false,
      sourceType: null,
      confidence: 0,
      documentName: null,
      extractedAt: null,
    });
  });

  it('should include all feature types in status', async () => {
    mockPrisma.projectDataSource.findMany.mockResolvedValue([]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const status = await getProjectSyncStatus('project-1');

    const expectedFeatures = [
      'scale', 'dimensions', 'rooms', 'doors', 'windows',
      'mep_electrical', 'mep_plumbing', 'mep_hvac',
      'budget', 'schedule', 'legends', 'title_blocks', 'materials'
    ];

    expect(Object.keys(status.features).sort()).toEqual(expectedFeatures.sort());
  });

  it('should return document list with extractable features', async () => {
    mockPrisma.projectDataSource.findMany.mockResolvedValue([]);
    mockPrisma.document.findMany.mockResolvedValue([
      { id: 'doc-1', fileName: 'Floor-Plan.pdf', category: 'architectural_plans' },
      { id: 'doc-2', fileName: 'Budget.xlsx', category: 'budgets' },
    ]);

    mockRouter.determineSourceType
      .mockReturnValueOnce('pdf_cad')
      .mockReturnValueOnce('xlsx');

    mockRouter.getExtractableFeatures
      .mockReturnValueOnce(['scale', 'rooms', 'dimensions'])
      .mockReturnValueOnce(['budget']);

    const status = await getProjectSyncStatus('project-1');

    expect(status.documents).toHaveLength(2);
    expect(status.documents[0]).toEqual({
      id: 'doc-1',
      fileName: 'Floor-Plan.pdf',
      sourceType: 'pdf_cad',
      confidence: 80,
      features: ['scale', 'rooms', 'dimensions'],
    });
    expect(status.documents[1]).toEqual({
      id: 'doc-2',
      fileName: 'Budget.xlsx',
      sourceType: 'xlsx',
      confidence: 70,
      features: ['budget'],
    });
  });

  it('should handle empty project gracefully', async () => {
    mockPrisma.projectDataSource.findMany.mockResolvedValue([]);
    mockPrisma.document.findMany.mockResolvedValue([]);

    const status = await getProjectSyncStatus('project-1');

    expect(status.features).toBeDefined();
    expect(status.documents).toEqual([]);
  });
});
