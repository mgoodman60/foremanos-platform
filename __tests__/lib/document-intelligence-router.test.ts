import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock Prisma with vi.hoisted to ensure it's available before module imports
const mockPrisma = vi.hoisted(() => ({
  projectDataSource: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Import functions after mocks
import {
  DATA_SOURCE_PRIORITY,
  DataSourceType,
  FeatureType,
  determineSourceType,
  getExtractableFeatures,
  shouldOverrideExisting,
  recordDataSource,
  getProjectDataSources,
  routeDocumentToProcessors,
} from '@/lib/document-intelligence-router';
import { prisma } from '@/lib/db';

// ============================================
// Test: Data Source Priority Constants
// ============================================

describe('Document Intelligence Router - Constants', () => {
  it('should have correct priority values', () => {
    expect(DATA_SOURCE_PRIORITY.dwg).toBe(100);
    expect(DATA_SOURCE_PRIORITY.rvt).toBe(95);
    expect(DATA_SOURCE_PRIORITY.ifc).toBe(90);
    expect(DATA_SOURCE_PRIORITY.pdf_cad).toBe(80);
    expect(DATA_SOURCE_PRIORITY.xlsx).toBe(70);
    expect(DATA_SOURCE_PRIORITY.pdf_scan).toBe(60);
    expect(DATA_SOURCE_PRIORITY.docx).toBe(50);
    expect(DATA_SOURCE_PRIORITY.manual).toBe(40);
  });

  it('should have DWG as highest priority', () => {
    const priorities = Object.values(DATA_SOURCE_PRIORITY);
    const maxPriority = Math.max(...priorities);
    expect(DATA_SOURCE_PRIORITY.dwg).toBe(maxPriority);
  });

  it('should have manual as lowest priority', () => {
    const priorities = Object.values(DATA_SOURCE_PRIORITY);
    const minPriority = Math.min(...priorities);
    expect(DATA_SOURCE_PRIORITY.manual).toBe(minPriority);
  });
});

// ============================================
// Test: Determine Source Type
// ============================================

describe('Document Intelligence Router - determineSourceType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should identify DWG files correctly', () => {
    expect(determineSourceType('floor-plan.dwg')).toBe('dwg');
    expect(determineSourceType('SITE.DWG')).toBe('dwg');
  });

  it('should identify DXF files as DWG type', () => {
    expect(determineSourceType('drawing.dxf')).toBe('dwg');
    expect(determineSourceType('EXPORT.DXF')).toBe('dwg');
  });

  it('should identify Revit files correctly', () => {
    expect(determineSourceType('building.rvt')).toBe('rvt');
    expect(determineSourceType('family.rfa')).toBe('rvt');
    expect(determineSourceType('MODEL.RVT')).toBe('rvt');
  });

  it('should identify IFC files correctly', () => {
    expect(determineSourceType('model.ifc')).toBe('ifc');
    expect(determineSourceType('EXPORT.IFC')).toBe('ifc');
  });

  it('should identify Excel files correctly', () => {
    expect(determineSourceType('budget.xlsx')).toBe('xlsx');
    expect(determineSourceType('schedule.xls')).toBe('xlsx');
    expect(determineSourceType('COST.XLSX')).toBe('xlsx');
  });

  it('should identify Word files correctly', () => {
    expect(determineSourceType('specs.docx')).toBe('docx');
    expect(determineSourceType('report.doc')).toBe('docx');
    expect(determineSourceType('NOTES.DOCX')).toBe('docx');
  });

  it('should identify PDFs with plan/drawing categories as CAD exports', () => {
    expect(determineSourceType('floor.pdf', 'architectural_plans')).toBe('pdf_cad');
    expect(determineSourceType('site.pdf', 'site_plans')).toBe('pdf_cad');
    expect(determineSourceType('mep.pdf', 'mep_drawings')).toBe('pdf_cad');
    expect(determineSourceType('electrical.pdf', 'electrical_plans')).toBe('pdf_cad');
    expect(determineSourceType('plumbing.pdf', 'plumbing_plans')).toBe('pdf_cad');
    expect(determineSourceType('hvac.pdf', 'hvac_plans')).toBe('pdf_cad');
    expect(determineSourceType('struct.pdf', 'structural_plans')).toBe('pdf_cad');
  });

  it('should identify PDFs without plan/drawing categories as scans', () => {
    expect(determineSourceType('budget.pdf', 'budget_cost')).toBe('pdf_scan');
    expect(determineSourceType('schedule.pdf', 'schedule')).toBe('pdf_scan');
    expect(determineSourceType('specs.pdf', 'specifications')).toBe('pdf_scan');
  });

  it('should identify PDFs without category as scans', () => {
    expect(determineSourceType('document.pdf')).toBe('pdf_scan');
    expect(determineSourceType('file.pdf', null)).toBe('pdf_scan');
  });

  it('should default to manual for unknown file types', () => {
    expect(determineSourceType('file.txt')).toBe('manual');
    expect(determineSourceType('data.json')).toBe('manual');
    expect(determineSourceType('image.png')).toBe('manual');
    expect(determineSourceType('noextension')).toBe('manual');
  });

  it('should handle files with multiple dots', () => {
    expect(determineSourceType('floor.plan.dwg')).toBe('dwg');
    expect(determineSourceType('v2.1.final.rvt')).toBe('rvt');
  });

  it('should handle case-insensitive extensions', () => {
    expect(determineSourceType('FILE.DWG')).toBe('dwg');
    expect(determineSourceType('File.Pdf', 'architectural_plans')).toBe('pdf_cad');
  });
});

// ============================================
// Test: Get Extractable Features
// ============================================

describe('Document Intelligence Router - getExtractableFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('by category', () => {
    it('should extract features for architectural plans', () => {
      const features = getExtractableFeatures('architectural_plans', 'floor.pdf');
      expect(features).toContain('scale');
      expect(features).toContain('dimensions');
      expect(features).toContain('rooms');
      expect(features).toContain('doors');
      expect(features).toContain('windows');
      expect(features).toContain('legends');
      expect(features).toContain('title_blocks');
    });

    it('should extract features for structural plans', () => {
      const features = getExtractableFeatures('structural_plans', 'struct.pdf');
      expect(features).toContain('scale');
      expect(features).toContain('dimensions');
      expect(features).toContain('materials');
      expect(features).toContain('legends');
    });

    it('should extract features for MEP drawings', () => {
      const features = getExtractableFeatures('mep_drawings', 'mep.pdf');
      expect(features).toContain('scale');
      expect(features).toContain('mep_electrical');
      expect(features).toContain('mep_plumbing');
      expect(features).toContain('mep_hvac');
      expect(features).toContain('legends');
    });

    it('should extract features for electrical plans', () => {
      const features = getExtractableFeatures('electrical_plans', 'elec.pdf');
      expect(features).toContain('scale');
      expect(features).toContain('mep_electrical');
      expect(features).toContain('legends');
    });

    it('should extract features for plumbing plans', () => {
      const features = getExtractableFeatures('plumbing_plans', 'plumb.pdf');
      expect(features).toContain('scale');
      expect(features).toContain('mep_plumbing');
      expect(features).toContain('legends');
    });

    it('should extract features for HVAC plans', () => {
      const features = getExtractableFeatures('hvac_plans', 'hvac.pdf');
      expect(features).toContain('scale');
      expect(features).toContain('mep_hvac');
      expect(features).toContain('legends');
    });

    it('should extract features for site plans', () => {
      const features = getExtractableFeatures('site_plans', 'site.pdf');
      expect(features).toContain('scale');
      expect(features).toContain('dimensions');
      expect(features).toContain('legends');
    });

    it('should extract features for budget documents', () => {
      const features = getExtractableFeatures('budget_cost', 'budget.xlsx');
      expect(features).toContain('budget');
      expect(features).toContain('materials');
    });

    it('should extract features for schedule documents', () => {
      const features = getExtractableFeatures('schedule', 'schedule.pdf');
      expect(features).toContain('schedule');
    });

    it('should extract features for specifications', () => {
      const features = getExtractableFeatures('specifications', 'specs.pdf');
      expect(features).toContain('materials');
    });

    it('should extract features for door schedules', () => {
      const features = getExtractableFeatures('door_schedule', 'doors.xlsx');
      expect(features).toContain('doors');
    });

    it('should extract features for window schedules', () => {
      const features = getExtractableFeatures('window_schedule', 'windows.xlsx');
      expect(features).toContain('windows');
    });

    it('should extract features for finish schedules', () => {
      const features = getExtractableFeatures('finish_schedule', 'finishes.xlsx');
      expect(features).toContain('materials');
      expect(features).toContain('rooms');
    });
  });

  describe('by filename patterns', () => {
    it('should detect budget from filename', () => {
      expect(getExtractableFeatures(null, 'project-budget.pdf')).toContain('budget');
      expect(getExtractableFeatures(null, 'cost-estimate.xlsx')).toContain('budget');
      expect(getExtractableFeatures(null, 'budget_v2.pdf')).toContain('budget');
    });

    it('should detect schedule from filename', () => {
      expect(getExtractableFeatures(null, 'project-schedule.pdf')).toContain('schedule');
      expect(getExtractableFeatures(null, 'timeline.xlsx')).toContain('schedule');
      expect(getExtractableFeatures(null, 'gantt-chart.pdf')).toContain('schedule');
    });

    it('should detect doors from filename', () => {
      expect(getExtractableFeatures(null, 'door-schedule.xlsx')).toContain('doors');
      expect(getExtractableFeatures(null, 'doors.pdf')).toContain('doors');
    });

    it('should detect windows from filename', () => {
      expect(getExtractableFeatures(null, 'window-schedule.xlsx')).toContain('windows');
      expect(getExtractableFeatures(null, 'windows.pdf')).toContain('windows');
    });

    it('should detect electrical from filename', () => {
      expect(getExtractableFeatures(null, 'electrical-plan.pdf')).toContain('mep_electrical');
      expect(getExtractableFeatures(null, 'elec-layout.dwg')).toContain('mep_electrical');
      expect(getExtractableFeatures(null, 'power-distribution.pdf')).toContain('mep_electrical');
    });

    it('should detect plumbing from filename', () => {
      expect(getExtractableFeatures(null, 'plumbing-plan.pdf')).toContain('mep_plumbing');
      expect(getExtractableFeatures(null, 'plumb-layout.dwg')).toContain('mep_plumbing');
      expect(getExtractableFeatures(null, 'water-system.pdf')).toContain('mep_plumbing');
      expect(getExtractableFeatures(null, 'sanitary-sewer.pdf')).toContain('mep_plumbing');
    });

    it('should detect HVAC from filename', () => {
      expect(getExtractableFeatures(null, 'hvac-plan.pdf')).toContain('mep_hvac');
      expect(getExtractableFeatures(null, 'mechanical-layout.dwg')).toContain('mep_hvac');
      expect(getExtractableFeatures(null, 'heating-system.pdf')).toContain('mep_hvac');
      expect(getExtractableFeatures(null, 'cooling-layout.pdf')).toContain('mep_hvac');
    });

    it('should detect floor plans from filename', () => {
      const features = getExtractableFeatures(null, 'floor-plan.pdf');
      expect(features).toContain('rooms');
      expect(features).toContain('scale');
      expect(features).toContain('dimensions');
    });

    it('should detect arch plans from filename', () => {
      const features = getExtractableFeatures(null, 'arch-plan-level-2.pdf');
      expect(features).toContain('rooms');
      expect(features).toContain('scale');
      expect(features).toContain('dimensions');
    });

    it('should detect layout from filename', () => {
      const features = getExtractableFeatures(null, 'layout-first-floor.pdf');
      expect(features).toContain('rooms');
      expect(features).toContain('scale');
      expect(features).toContain('dimensions');
    });

    it('should detect DWG files and add scale/dimensions', () => {
      const features = getExtractableFeatures(null, 'drawing.dwg');
      expect(features).toContain('scale');
      expect(features).toContain('dimensions');
    });

    it('should be case-insensitive for patterns', () => {
      expect(getExtractableFeatures(null, 'BUDGET.pdf')).toContain('budget');
      expect(getExtractableFeatures(null, 'DOOR-SCHEDULE.xlsx')).toContain('doors');
      expect(getExtractableFeatures(null, 'ELECTRICAL.pdf')).toContain('mep_electrical');
    });
  });

  it('should combine category and filename features', () => {
    const features = getExtractableFeatures('architectural_plans', 'door-schedule.pdf');
    expect(features).toContain('scale'); // from category
    expect(features).toContain('rooms'); // from category
    expect(features).toContain('doors'); // from both category and filename
  });

  it('should deduplicate features', () => {
    const features = getExtractableFeatures('door_schedule', 'door-schedule.xlsx');
    const doorCount = features.filter(f => f === 'doors').length;
    expect(doorCount).toBe(1); // Should only appear once
  });

  it('should handle null category gracefully', () => {
    const features = getExtractableFeatures(null, 'budget.xlsx');
    expect(features).toContain('budget');
    expect(Array.isArray(features)).toBe(true);
  });

  it('should handle unknown category gracefully', () => {
    const features = getExtractableFeatures('unknown_category', 'file.pdf');
    expect(Array.isArray(features)).toBe(true);
  });

  it('should return empty array for no matches', () => {
    const features = getExtractableFeatures(null, 'random-file.txt');
    expect(features).toEqual([]);
  });
});

// ============================================
// Test: Should Override Existing
// ============================================

describe('Document Intelligence Router - shouldOverrideExisting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow override when no existing data source', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);

    const result = await shouldOverrideExisting('project-1', 'scale', 'dwg');

    expect(result.shouldOverride).toBe(true);
    expect(result.existingSource).toBeUndefined();
    expect(result.existingConfidence).toBeUndefined();
    expect(prisma.projectDataSource.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        featureType: 'scale',
      },
      orderBy: { confidence: 'desc' },
    });
  });

  it('should allow override when new source has higher confidence', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue({
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-old',
      featureType: 'scale',
      sourceType: 'pdf_scan',
      confidence: 60,
      metadata: {},
      extractedAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await shouldOverrideExisting('project-1', 'scale', 'dwg');

    expect(result.shouldOverride).toBe(true);
    expect(result.existingSource).toBe('pdf_scan');
    expect(result.existingConfidence).toBe(60);
  });

  it('should not allow override when new source has lower confidence', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue({
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-old',
      featureType: 'scale',
      sourceType: 'dwg',
      confidence: 100,
      metadata: {},
      extractedAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await shouldOverrideExisting('project-1', 'scale', 'pdf_scan');

    expect(result.shouldOverride).toBe(false);
    expect(result.existingSource).toBe('dwg');
    expect(result.existingConfidence).toBe(100);
  });

  it('should not allow override when new source has equal confidence', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue({
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-old',
      featureType: 'budget',
      sourceType: 'xlsx',
      confidence: 70,
      metadata: {},
      extractedAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await shouldOverrideExisting('project-1', 'budget', 'xlsx');

    expect(result.shouldOverride).toBe(false);
    expect(result.existingSource).toBe('xlsx');
    expect(result.existingConfidence).toBe(70);
  });

  it('should handle different feature types', async () => {
    const features: FeatureType[] = ['scale', 'dimensions', 'rooms', 'doors', 'budget', 'schedule'];

    for (const feature of features) {
      vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);
      const result = await shouldOverrideExisting('project-1', feature, 'dwg');
      expect(result.shouldOverride).toBe(true);
    }
  });

  it('should query correct project and feature', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);

    await shouldOverrideExisting('project-123', 'mep_electrical', 'rvt');

    expect(prisma.projectDataSource.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-123',
        featureType: 'mep_electrical',
      },
      orderBy: { confidence: 'desc' },
    });
  });
});

// ============================================
// Test: Record Data Source
// ============================================

describe('Document Intelligence Router - recordDataSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new data source when none exists', async () => {
    const mockCreated = {
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-1',
      featureType: 'scale',
      sourceType: 'dwg',
      confidence: 100,
      metadata: {},
      extractedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    };

    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue(mockCreated);

    await recordDataSource('project-1', 'doc-1', 'scale', 'dwg');

    expect(prisma.projectDataSource.upsert).toHaveBeenCalledWith({
      where: {
        projectId_featureType: {
          projectId: 'project-1',
          featureType: 'scale',
        },
      },
      create: {
        projectId: 'project-1',
        documentId: 'doc-1',
        featureType: 'scale',
        sourceType: 'dwg',
        confidence: 100,
        metadata: {},
        extractedAt: expect.any(Date),
      },
      update: {
        documentId: 'doc-1',
        sourceType: 'dwg',
        confidence: 100,
        metadata: {},
        extractedAt: expect.any(Date),
      },
    });
  });

  it('should update existing data source', async () => {
    const mockUpdated = {
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-2',
      featureType: 'scale',
      sourceType: 'rvt',
      confidence: 95,
      metadata: { updated: true },
      extractedAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue(mockUpdated);

    await recordDataSource('project-1', 'doc-2', 'scale', 'rvt', { updated: true });

    expect(prisma.projectDataSource.upsert).toHaveBeenCalled();
    const call = vi.mocked(prisma.projectDataSource.upsert).mock.calls[0][0];
    expect(call.update.documentId).toBe('doc-2');
    expect(call.update.sourceType).toBe('rvt');
    expect(call.update.confidence).toBe(95);
    expect(call.update.metadata).toEqual({ updated: true });
  });

  it('should record metadata when provided', async () => {
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const metadata = {
      extractedBy: 'vision-api',
      pageNumbers: [1, 2, 3],
      accuracy: 0.95,
    };

    await recordDataSource('project-1', 'doc-1', 'rooms', 'pdf_cad', metadata);

    const call = vi.mocked(prisma.projectDataSource.upsert).mock.calls[0][0];
    expect(call.create.metadata).toEqual(metadata);
    expect(call.update.metadata).toEqual(metadata);
  });

  it('should use empty object when metadata not provided', async () => {
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    await recordDataSource('project-1', 'doc-1', 'doors', 'xlsx');

    const call = vi.mocked(prisma.projectDataSource.upsert).mock.calls[0][0];
    expect(call.create.metadata).toEqual({});
    expect(call.update.metadata).toEqual({});
  });

  it('should set correct confidence based on source type', async () => {
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    await recordDataSource('project-1', 'doc-1', 'budget', 'xlsx');

    const call = vi.mocked(prisma.projectDataSource.upsert).mock.calls[0][0];
    expect(call.create.confidence).toBe(70); // xlsx priority
    expect(call.update.confidence).toBe(70);
  });

  it('should handle all source types correctly', async () => {
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const sourceTypes: Array<{ type: DataSourceType; expectedConfidence: number }> = [
      { type: 'dwg', expectedConfidence: 100 },
      { type: 'rvt', expectedConfidence: 95 },
      { type: 'ifc', expectedConfidence: 90 },
      { type: 'pdf_cad', expectedConfidence: 80 },
      { type: 'xlsx', expectedConfidence: 70 },
      { type: 'pdf_scan', expectedConfidence: 60 },
      { type: 'docx', expectedConfidence: 50 },
      { type: 'manual', expectedConfidence: 40 },
    ];

    for (const { type, expectedConfidence } of sourceTypes) {
      vi.clearAllMocks();
      await recordDataSource('project-1', 'doc-1', 'scale', type);

      const call = vi.mocked(prisma.projectDataSource.upsert).mock.calls[0][0];
      expect(call.create.confidence).toBe(expectedConfidence);
    }
  });

  it('should set extractedAt timestamp', async () => {
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const beforeTime = new Date();
    await recordDataSource('project-1', 'doc-1', 'schedule', 'pdf_cad');
    const afterTime = new Date();

    const call = vi.mocked(prisma.projectDataSource.upsert).mock.calls[0][0];
    const extractedAt = call.create.extractedAt as Date;

    expect(extractedAt).toBeInstanceOf(Date);
    expect(extractedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(extractedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });
});

// ============================================
// Test: Get Project Data Sources
// ============================================

describe('Document Intelligence Router - getProjectDataSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retrieve all data sources for a project', async () => {
    const mockDataSources = [
      {
        id: 'ds-1',
        projectId: 'project-1',
        documentId: 'doc-1',
        featureType: 'scale',
        sourceType: 'dwg',
        confidence: 100,
        metadata: {},
        extractedAt: new Date(),
        updatedAt: new Date(),
        Document: {
          id: 'doc-1',
          fileName: 'floor-plan.dwg',
          category: 'architectural_plans',
        },
      },
      {
        id: 'ds-2',
        projectId: 'project-1',
        documentId: 'doc-2',
        featureType: 'budget',
        sourceType: 'xlsx',
        confidence: 70,
        metadata: {},
        extractedAt: new Date(),
        updatedAt: new Date(),
        Document: {
          id: 'doc-2',
          fileName: 'budget.xlsx',
          category: 'budget_cost',
        },
      },
    ];

    vi.mocked(prisma.projectDataSource.findMany).mockResolvedValue(mockDataSources);

    const result = await getProjectDataSources('project-1');

    expect(result).toEqual(mockDataSources);
    expect(prisma.projectDataSource.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1' },
      include: {
        Document: {
          select: { id: true, fileName: true, category: true },
        },
      },
      orderBy: { featureType: 'asc' },
    });
  });

  it('should return empty array when no data sources exist', async () => {
    vi.mocked(prisma.projectDataSource.findMany).mockResolvedValue([]);

    const result = await getProjectDataSources('project-1');

    expect(result).toEqual([]);
  });

  it('should include document details in results', async () => {
    const mockDataSources = [
      {
        id: 'ds-1',
        projectId: 'project-1',
        documentId: 'doc-1',
        featureType: 'rooms',
        sourceType: 'rvt',
        confidence: 95,
        metadata: {},
        extractedAt: new Date(),
        updatedAt: new Date(),
        Document: {
          id: 'doc-1',
          fileName: 'building.rvt',
          category: 'architectural_plans',
        },
      },
    ];

    vi.mocked(prisma.projectDataSource.findMany).mockResolvedValue(mockDataSources);

    const result = await getProjectDataSources('project-1');

    expect(result[0].Document).toBeDefined();
    expect(result[0].Document.id).toBe('doc-1');
    expect(result[0].Document.fileName).toBe('building.rvt');
    expect(result[0].Document.category).toBe('architectural_plans');
  });

  it('should order results by featureType', async () => {
    vi.mocked(prisma.projectDataSource.findMany).mockResolvedValue([]);

    await getProjectDataSources('project-1');

    expect(prisma.projectDataSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { featureType: 'asc' },
      })
    );
  });
});

// ============================================
// Test: Route Document to Processors
// ============================================

describe('Document Intelligence Router - routeDocumentToProcessors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should route DWG file and trigger all features', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const result = await routeDocumentToProcessors(
      'doc-1',
      'project-1',
      'floor-plan.dwg',
      'architectural_plans'
    );

    expect(result.features).toContain('scale');
    expect(result.features).toContain('dimensions');
    expect(result.features).toContain('rooms');
    expect(result.features).toContain('doors');
    expect(result.features).toContain('windows');
    expect(result.features).toContain('legends');
    expect(result.features).toContain('title_blocks');
    expect(result.triggered).toEqual(result.features); // All should trigger (no existing)
  });

  it('should not trigger features when existing source has higher confidence', async () => {
    // Mock existing DWG source (highest confidence)
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue({
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-old',
      featureType: 'scale',
      sourceType: 'dwg',
      confidence: 100,
      metadata: {},
      extractedAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await routeDocumentToProcessors(
      'doc-2',
      'project-1',
      'floor.pdf',
      'architectural_plans'
    );

    expect(result.features).toContain('scale');
    expect(result.triggered).not.toContain('scale'); // Should not trigger (lower confidence)
  });

  it('should trigger features when new source has higher confidence', async () => {
    // Mock existing PDF scan source (lower confidence)
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue({
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-old',
      featureType: 'scale',
      sourceType: 'pdf_scan',
      confidence: 60,
      metadata: {},
      extractedAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const result = await routeDocumentToProcessors(
      'doc-2',
      'project-1',
      'floor-plan.dwg',
      'architectural_plans'
    );

    expect(result.triggered).toContain('scale'); // Should upgrade from pdf_scan to dwg
  });

  it('should record data source for triggered features', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    await routeDocumentToProcessors(
      'doc-1',
      'project-1',
      'budget.xlsx',
      'budget_cost'
    );

    expect(prisma.projectDataSource.upsert).toHaveBeenCalled();
    const calls = vi.mocked(prisma.projectDataSource.upsert).mock.calls;

    // Should record for budget and materials features
    expect(calls.some(call => call[0].create.featureType === 'budget')).toBe(true);
    expect(calls.some(call => call[0].create.featureType === 'materials')).toBe(true);
  });

  it('should handle multiple features correctly', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const result = await routeDocumentToProcessors(
      'doc-1',
      'project-1',
      'mep.pdf',
      'mep_drawings'
    );

    expect(result.features.length).toBeGreaterThan(1);
    expect(result.features).toContain('scale');
    expect(result.features).toContain('mep_electrical');
    expect(result.features).toContain('mep_plumbing');
    expect(result.features).toContain('mep_hvac');
    expect(result.features).toContain('legends');
  });

  it('should log routing decisions', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    await routeDocumentToProcessors(
      'doc-1',
      'project-1',
      'floor.dwg',
      'architectural_plans'
    );

    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('should log upgrade decisions', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue({
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-old',
      featureType: 'scale',
      sourceType: 'pdf_scan',
      confidence: 60,
      metadata: {},
      extractedAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    await routeDocumentToProcessors(
      'doc-2',
      'project-1',
      'floor.dwg',
      'architectural_plans'
    );

    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('should log keeping existing decisions', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue({
      id: 'ds-1',
      projectId: 'project-1',
      documentId: 'doc-old',
      featureType: 'scale',
      sourceType: 'dwg',
      confidence: 100,
      metadata: {},
      extractedAt: new Date(),
      updatedAt: new Date(),
    });

    await routeDocumentToProcessors(
      'doc-2',
      'project-1',
      'floor.pdf',
      'architectural_plans'
    );

    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('should handle documents with no category', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const result = await routeDocumentToProcessors(
      'doc-1',
      'project-1',
      'random.txt',
      null
    );

    expect(result.features).toEqual([]);
    expect(result.triggered).toEqual([]);
  });

  it('should combine category and filename features', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const result = await routeDocumentToProcessors(
      'doc-1',
      'project-1',
      'electrical-budget.xlsx',
      'budget_cost'
    );

    expect(result.features).toContain('budget'); // from both category and filename
    expect(result.features).toContain('materials'); // from category
    expect(result.features).toContain('mep_electrical'); // from filename
  });

  it('should return features and triggered lists', async () => {
    // Mock findFirst to return different values based on feature type
    vi.mocked(prisma.projectDataSource.findFirst).mockImplementation((async (args: any) => {
      const featureType = args?.where?.featureType;

      if (featureType === 'budget') {
        // budget - has existing with lower confidence
        return {
          id: 'ds-1',
          projectId: 'project-1',
          documentId: 'doc-old',
          featureType: 'budget',
          sourceType: 'docx',
          confidence: 50,
          metadata: {},
          extractedAt: new Date(),
          updatedAt: new Date(),
        };
      }

      if (featureType === 'materials') {
        // materials - has existing with higher confidence
        return {
          id: 'ds-2',
          projectId: 'project-1',
          documentId: 'doc-old',
          featureType: 'materials',
          sourceType: 'dwg',
          confidence: 100,
          metadata: {},
          extractedAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Other features - no existing
      return null;
    }) as any);
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const result = await routeDocumentToProcessors(
      'doc-1',
      'project-1',
      'budget-estimate.xlsx',
      'budget_cost'
    );

    // All features should be detected
    expect(result.features).toContain('budget');
    expect(result.features).toContain('materials');

    // Only some should trigger based on confidence
    expect(result.triggered).toContain('budget'); // xlsx (70) > docx (50)
    expect(result.triggered).not.toContain('materials'); // xlsx (70) < dwg (100)
  });

  it('should handle mixed override scenarios', async () => {
    let callCount = 0;
    vi.mocked(prisma.projectDataSource.findFirst).mockImplementation((async () => {
      callCount++;
      if (callCount === 1) return null; // First feature - no existing
      if (callCount === 2) { // Second feature - lower confidence existing
        return {
          id: 'ds-1',
          projectId: 'project-1',
          documentId: 'doc-old',
          featureType: 'dimensions',
          sourceType: 'pdf_scan',
          confidence: 60,
          metadata: {},
          extractedAt: new Date(),
          updatedAt: new Date(),
        };
      }
      // Other features - higher confidence existing
      return {
        id: 'ds-2',
        projectId: 'project-1',
        documentId: 'doc-old',
        featureType: 'rooms',
        sourceType: 'dwg',
        confidence: 100,
        metadata: {},
        extractedAt: new Date(),
        updatedAt: new Date(),
      };
    }) as any);
    vi.mocked(prisma.projectDataSource.upsert).mockResolvedValue({} as any);

    const result = await routeDocumentToProcessors(
      'doc-1',
      'project-1',
      'floor.pdf',
      'architectural_plans'
    );

    expect(result.features.length).toBeGreaterThan(0);
    expect(result.triggered.length).toBeLessThan(result.features.length);
  });
});

// ============================================
// Test: Edge Cases and Error Handling
// ============================================

describe('Document Intelligence Router - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty filename gracefully', () => {
    const sourceType = determineSourceType('');
    expect(sourceType).toBe('manual');
  });

  it('should handle filename without extension', () => {
    const sourceType = determineSourceType('document');
    expect(sourceType).toBe('manual');
  });

  it('should handle very long filenames', () => {
    const longName = 'a'.repeat(1000) + '.dwg';
    const sourceType = determineSourceType(longName);
    expect(sourceType).toBe('dwg');
  });

  it('should handle special characters in filenames', () => {
    expect(determineSourceType('floor-plan_v2.1 (final).dwg')).toBe('dwg');
    expect(determineSourceType('M&E Schedule.xlsx')).toBe('xlsx');
    // door_schedule category doesn't include 'plan' or 'drawing', so it returns pdf_scan
    expect(determineSourceType('door-schedule@2024.pdf', 'door_schedule')).toBe('pdf_scan');
  });

  it('should handle unicode characters in filenames', () => {
    expect(determineSourceType('plan-étage.dwg')).toBe('dwg');
    expect(determineSourceType('预算.xlsx')).toBe('xlsx');
  });

  it('should handle null in getExtractableFeatures gracefully', () => {
    const features = getExtractableFeatures(null, '');
    expect(Array.isArray(features)).toBe(true);
  });

  it('should handle database errors in shouldOverrideExisting', async () => {
    vi.mocked(prisma.projectDataSource.findFirst).mockRejectedValue(
      new Error('Database connection failed')
    );

    await expect(shouldOverrideExisting('project-1', 'scale', 'dwg'))
      .rejects.toThrow('Database connection failed');
  });

  it('should handle database errors in recordDataSource', async () => {
    vi.mocked(prisma.projectDataSource.upsert).mockRejectedValue(
      new Error('Upsert failed')
    );

    await expect(recordDataSource('project-1', 'doc-1', 'scale', 'dwg'))
      .rejects.toThrow('Upsert failed');
  });

  it('should handle database errors in getProjectDataSources', async () => {
    vi.mocked(prisma.projectDataSource.findMany).mockRejectedValue(
      new Error('Query failed')
    );

    await expect(getProjectDataSources('project-1'))
      .rejects.toThrow('Query failed');
  });

  it('should handle partial failures in routeDocumentToProcessors', async () => {
    let callCount = 0;
    vi.mocked(prisma.projectDataSource.findFirst).mockImplementation((async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Database timeout');
      }
      return null;
    }) as any);
    vi.mocked(prisma.projectDataSource.upsert).mockRejectedValue(new Error('Upsert failed'));

    // The error will be from upsert, not findFirst, since upsert happens after findFirst
    await expect(
      routeDocumentToProcessors('doc-1', 'project-1', 'floor.dwg', 'architectural_plans')
    ).rejects.toThrow();
  });
});
