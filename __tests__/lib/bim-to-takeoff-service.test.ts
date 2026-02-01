import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies using vi.hoisted
const mocks = vi.hoisted(() => ({
  prisma: {
    materialTakeoff: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    autodeskModel: {
      findUnique: vi.fn(),
    },
    takeoffLineItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
  categorizeElement: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/bim-metadata-extractor', async () => {
  const actual = await vi.importActual('@/lib/bim-metadata-extractor');
  return {
    ...actual,
    categorizeElement: mocks.categorizeElement,
  };
});

describe('BIM to Takeoff Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importBIMToTakeoff', () => {
    it('should create new takeoff when none exists', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Walls': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Wall-Standard',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 100 },
          },
        ],
        summary: { structural: 1, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test-model.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({
        id: 'takeoff-1',
        projectId: 'project-1',
        name: 'BIM Takeoff - test-model.rvt',
      });
      mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      const result = await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.materialTakeoff.findFirst).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          name: { startsWith: 'BIM Takeoff - ' },
          description: { contains: 'model-1' },
        },
      });

      expect(mocks.prisma.materialTakeoff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'project-1',
          name: 'BIM Takeoff - test-model.rvt',
          status: 'in_progress',
          createdBy: 'user-1',
          extractedBy: 'autodesk_bim',
        }),
      });

      expect(result.takeoffId).toBe('takeoff-1');
      expect(result.importedItems).toBe(1);
      expect(result.skippedItems).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should update existing takeoff and clear old line items', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Doors': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Door-1',
            category: 'Revit Doors',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 0, architectural: 1, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue({
        id: 'existing-takeoff-1',
        projectId: 'project-1',
        name: 'BIM Takeoff - test-model.rvt',
      });
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test-model.rvt',
        uploadedBy: 'user-1',
      });
      mocks.categorizeElement.mockReturnValue({ category: 'architectural', subcategory: 'doors' });
      mocks.prisma.takeoffLineItem.deleteMany.mockResolvedValue({ count: 5 });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'existing-takeoff-1' });

      const result = await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.deleteMany).toHaveBeenCalledWith({
        where: { takeoffId: 'existing-takeoff-1' },
      });

      expect(result.takeoffId).toBe('existing-takeoff-1');
    });

    it('should aggregate elements by type/name/category/unit/material', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 3,
        categories: { 'Revit Walls': 3 },
        elements: [
          {
            dbId: 1,
            name: 'Wall-Standard',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 100 },
            material: 'Concrete',
          },
          {
            dbId: 2,
            name: 'Wall-Standard',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 150 },
            material: 'Concrete',
          },
          {
            dbId: 3,
            name: 'Wall-Standard',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 200 },
            material: 'Brick',
          },
        ],
        summary: { structural: 3, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({
        id: 'takeoff-1',
        projectId: 'project-1',
      });
      mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 2 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      const result = await importBIMToTakeoff('project-1', 'model-1', bimData);

      // Should create 2 line items: one for Concrete (100+150=250), one for Brick (200)
      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            itemName: 'Wall-Standard',
            quantity: 250, // 100 + 150
            material: 'Concrete',
          }),
          expect.objectContaining({
            itemName: 'Wall-Standard',
            quantity: 200,
            material: 'Brick',
          }),
        ]),
      });

      expect(result.importedItems).toBe(2);
    });

    it('should map CSI divisions correctly for structural elements', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Structural Columns': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Column-1',
            category: 'Revit Structural Columns',
            properties: {},
          },
        ],
        summary: { structural: 1, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'columns' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            category: '03 - Concrete',
            metadata: expect.objectContaining({
              csiDivision: '03',
            }),
          }),
        ]),
      });
    });

    it('should map CSI divisions correctly for MEP elements', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 3,
        categories: { 'MEP': 3 },
        elements: [
          {
            dbId: 1,
            name: 'Duct-1',
            category: 'Revit Ducts',
            properties: {},
            dimensions: { length: 100 },
          },
          {
            dbId: 2,
            name: 'Pipe-1',
            category: 'Revit Pipes',
            properties: {},
            dimensions: { length: 50 },
          },
          {
            dbId: 3,
            name: 'Light-1',
            category: 'Revit Lighting Fixtures',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 3, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement
        .mockReturnValueOnce({ category: 'mep', subcategory: 'ductwork' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'piping' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'lighting' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 3 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            category: '23 - HVAC',
            metadata: expect.objectContaining({
              csiDivision: '23',
            }),
          }),
          expect.objectContaining({
            category: '22 - Plumbing',
            metadata: expect.objectContaining({
              csiDivision: '22',
            }),
          }),
          expect.objectContaining({
            category: '26 - Electrical',
            metadata: expect.objectContaining({
              csiDivision: '26',
            }),
          }),
        ]),
      });
    });

    it('should use default CSI division for unknown categories', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Unknown': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Unknown-1',
            category: 'Unknown',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 0, architectural: 0, site: 0, other: 1 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'other', subcategory: 'unknown' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            category: '01 - General Requirements',
            metadata: expect.objectContaining({
              csiDivision: '01',
            }),
          }),
        ]),
      });
    });

    it('should infer SF unit for area-based elements', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Floors': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Floor-1',
            category: 'Revit Floors',
            properties: {},
            dimensions: { area: 1000 },
          },
        ],
        summary: { structural: 1, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'floors' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            unit: 'SF',
            quantity: 1000,
          }),
        ]),
      });
    });

    it('should infer LF unit for linear elements', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Pipes': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Pipe-1',
            category: 'Revit Pipes',
            properties: {},
            dimensions: { length: 50 },
          },
        ],
        summary: { structural: 0, mep: 1, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'mep', subcategory: 'piping' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            unit: 'LF',
            quantity: 50,
          }),
        ]),
      });
    });

    it('should infer CY unit for volume-based elements', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Structural Foundations': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Foundation-1',
            category: 'Revit Structural Foundations',
            properties: {},
            dimensions: { volume: 27 },
          },
        ],
        summary: { structural: 1, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'foundations' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            unit: 'CY',
            quantity: 27,
          }),
        ]),
      });
    });

    it('should infer EA unit for count-based elements', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Doors': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Door-36x84',
            category: 'Revit Doors',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 0, architectural: 1, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'architectural', subcategory: 'doors' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            unit: 'EA',
            quantity: 1,
          }),
        ]),
      });
    });

    it('should extract quantity from materialQuantity if dimensions not available', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Walls': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Wall-1',
            category: 'Revit Walls',
            properties: {},
            materialQuantity: 75.5,
          },
        ],
        summary: { structural: 1, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            quantity: 75.5,
          }),
        ]),
      });
    });

    it('should round quantities to 2 decimal places', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Walls': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Wall-1',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 123.456789 },
          },
        ],
        summary: { structural: 1, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            quantity: 123.46,
          }),
        ]),
      });
    });

    it('should set confidence to 0.9 for BIM data', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Doors': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Door-1',
            category: 'Revit Doors',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 0, architectural: 1, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'architectural', subcategory: 'doors' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            confidence: 0.9,
            sourceType: 'bim',
          }),
        ]),
      });
    });

    it('should store element metadata including dbIds', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 3,
        categories: { 'Revit Doors': 3 },
        elements: [
          {
            dbId: 101,
            name: 'Door-Standard',
            category: 'Revit Doors',
            properties: {},
          },
          {
            dbId: 102,
            name: 'Door-Standard',
            category: 'Revit Doors',
            properties: {},
          },
          {
            dbId: 103,
            name: 'Door-Standard',
            category: 'Revit Doors',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 0, architectural: 3, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'architectural', subcategory: 'doors' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              elementCount: 3,
              dbIds: [101, 102, 103],
            }),
          }),
        ]),
      });
    });

    it('should limit dbIds to first 100 elements', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const elements = Array.from({ length: 150 }, (_, i) => ({
        dbId: i + 1,
        name: 'Door-Standard',
        category: 'Revit Doors',
        properties: {},
      }));

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 150,
        categories: { 'Revit Doors': 150 },
        elements,
        summary: { structural: 0, mep: 0, architectural: 150, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'architectural', subcategory: 'doors' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      const createCall = mocks.prisma.takeoffLineItem.createMany.mock.calls[0][0];
      const dbIds = createCall.data[0].metadata.dbIds;

      expect(dbIds).toHaveLength(100);
      expect(dbIds[0]).toBe(1);
      expect(dbIds[99]).toBe(100);
    });

    it('should include level and material in line item description', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Walls': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Wall-Standard',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 100 },
            material: 'Concrete Block',
            level: 'Level 1',
          },
        ],
        summary: { structural: 1, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'structural', subcategory: 'walls' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            description: '1 Wall-Standard elements (Concrete Block)',
            material: 'Concrete Block',
            level: 'Level 1',
          }),
        ]),
      });
    });

    it('should handle elements without material gracefully', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Doors': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Door-1',
            category: 'Revit Doors',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 0, architectural: 1, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'architectural', subcategory: 'doors' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.takeoffLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            description: '1 Door-1 elements',
            material: null,
          }),
        ]),
      });
    });

    it('should track skipped items and errors when element processing fails', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 2,
        categories: { 'Revit Walls': 2 },
        elements: [
          {
            dbId: 1,
            name: 'Wall-1',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 100 },
          },
          {
            dbId: 2,
            name: 'Wall-2',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 150 },
          },
        ],
        summary: { structural: 2, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });

      // First element succeeds, second fails
      mocks.categorizeElement
        .mockReturnValueOnce({ category: 'structural', subcategory: 'walls' })
        .mockImplementationOnce(() => {
          throw new Error('Categorization failed');
        });

      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      const result = await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(result.importedItems).toBe(1);
      expect(result.skippedItems).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to process element 2');
    });

    it('should update takeoff status to completed', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Doors': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Door-1',
            category: 'Revit Doors',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 0, architectural: 1, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'architectural', subcategory: 'doors' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.materialTakeoff.update).toHaveBeenCalledWith({
        where: { id: 'takeoff-1' },
        data: expect.objectContaining({
          status: 'completed',
        }),
      });
    });

    it('should use system as createdBy when model has no uploadedBy', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'Revit Doors': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Door-1',
            category: 'Revit Doors',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 0, architectural: 1, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: null,
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement.mockReturnValue({ category: 'architectural', subcategory: 'doors' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 1 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(mocks.prisma.materialTakeoff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          createdBy: 'system',
        }),
      });
    });

    it('should handle empty BIM data', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: [],
        totalElements: 0,
        categories: {},
        elements: [],
        summary: { structural: 0, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      const result = await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(result.importedItems).toBe(0);
      expect(result.skippedItems).toBe(0);
      expect(mocks.prisma.takeoffLineItem.createMany).not.toHaveBeenCalled();
    });

    it('should count categories in result', async () => {
      const { importBIMToTakeoff } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 3,
        categories: { 'Revit Walls': 1, 'Revit Doors': 1, 'Revit Windows': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Wall-1',
            category: 'Revit Walls',
            properties: {},
            dimensions: { area: 100 },
          },
          {
            dbId: 2,
            name: 'Door-1',
            category: 'Revit Doors',
            properties: {},
          },
          {
            dbId: 3,
            name: 'Window-1',
            category: 'Revit Windows',
            properties: {},
          },
        ],
        summary: { structural: 1, mep: 0, architectural: 2, site: 0, other: 0 },
      };

      mocks.prisma.materialTakeoff.findFirst.mockResolvedValue(null);
      mocks.prisma.autodeskModel.findUnique.mockResolvedValue({
        id: 'model-1',
        fileName: 'test.rvt',
        uploadedBy: 'user-1',
      });
      mocks.prisma.materialTakeoff.create.mockResolvedValue({ id: 'takeoff-1' });
      mocks.categorizeElement
        .mockReturnValueOnce({ category: 'structural', subcategory: 'walls' })
        .mockReturnValueOnce({ category: 'architectural', subcategory: 'doors' })
        .mockReturnValueOnce({ category: 'architectural', subcategory: 'windows' });
      mocks.prisma.takeoffLineItem.createMany.mockResolvedValue({ count: 3 });
      mocks.prisma.materialTakeoff.update.mockResolvedValue({ id: 'takeoff-1' });

      const result = await importBIMToTakeoff('project-1', 'model-1', bimData);

      expect(result.categories).toEqual(
        expect.objectContaining({
          Masonry: 1,
          Openings: 2,
        })
      );
    });
  });

  describe('extractMEPEquipment', () => {
    it('should extract mechanical equipment', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 2,
        categories: { 'MEP': 2 },
        elements: [
          {
            dbId: 1,
            name: 'Air Handler',
            category: 'Revit Mechanical Equipment',
            properties: {},
          },
          {
            dbId: 2,
            name: 'Duct-1',
            category: 'Revit Ducts',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 2, architectural: 0, site: 0, other: 0 },
      };

      mocks.categorizeElement
        .mockReturnValueOnce({ category: 'mep', subcategory: 'mechanical_equipment' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'ductwork' });

      const result = extractMEPEquipment(bimData);

      expect(result.mechanical).toHaveLength(2);
      expect(result.electrical).toHaveLength(0);
      expect(result.plumbing).toHaveLength(0);
      expect(result.fireProtection).toHaveLength(0);
    });

    it('should extract electrical equipment', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 3,
        categories: { 'MEP': 3 },
        elements: [
          {
            dbId: 1,
            name: 'Panel',
            category: 'Revit Electrical Equipment',
            properties: {},
          },
          {
            dbId: 2,
            name: 'Light-1',
            category: 'Revit Lighting Fixtures',
            properties: {},
          },
          {
            dbId: 3,
            name: 'Conduit-1',
            category: 'Revit Conduits',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 3, architectural: 0, site: 0, other: 0 },
      };

      mocks.categorizeElement
        .mockReturnValueOnce({ category: 'mep', subcategory: 'electrical_equipment' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'lighting' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'conduits' });

      const result = extractMEPEquipment(bimData);

      expect(result.mechanical).toHaveLength(0);
      expect(result.electrical).toHaveLength(3);
      expect(result.plumbing).toHaveLength(0);
      expect(result.fireProtection).toHaveLength(0);
    });

    it('should extract plumbing equipment', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 2,
        categories: { 'MEP': 2 },
        elements: [
          {
            dbId: 1,
            name: 'Sink',
            category: 'Revit Plumbing Fixtures',
            properties: {},
          },
          {
            dbId: 2,
            name: 'Pipe-1',
            category: 'Revit Pipes',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 2, architectural: 0, site: 0, other: 0 },
      };

      mocks.categorizeElement
        .mockReturnValueOnce({ category: 'mep', subcategory: 'plumbing_fixtures' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'piping' });

      const result = extractMEPEquipment(bimData);

      expect(result.mechanical).toHaveLength(0);
      expect(result.electrical).toHaveLength(0);
      expect(result.plumbing).toHaveLength(2);
      expect(result.fireProtection).toHaveLength(0);
    });

    it('should extract fire protection equipment', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 1,
        categories: { 'MEP': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Sprinkler-1',
            category: 'Revit Sprinklers',
            properties: {},
          },
        ],
        summary: { structural: 0, mep: 1, architectural: 0, site: 0, other: 0 },
      };

      mocks.categorizeElement.mockReturnValue({ category: 'mep', subcategory: 'fire_protection' });

      const result = extractMEPEquipment(bimData);

      expect(result.mechanical).toHaveLength(0);
      expect(result.electrical).toHaveLength(0);
      expect(result.plumbing).toHaveLength(0);
      expect(result.fireProtection).toHaveLength(1);
    });

    it('should skip non-MEP elements', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 2,
        categories: { 'Structural': 1, 'MEP': 1 },
        elements: [
          {
            dbId: 1,
            name: 'Wall-1',
            category: 'Revit Walls',
            properties: {},
          },
          {
            dbId: 2,
            name: 'Duct-1',
            category: 'Revit Ducts',
            properties: {},
          },
        ],
        summary: { structural: 1, mep: 1, architectural: 0, site: 0, other: 0 },
      };

      mocks.categorizeElement
        .mockReturnValueOnce({ category: 'structural', subcategory: 'walls' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'ductwork' });

      const result = extractMEPEquipment(bimData);

      expect(result.mechanical).toHaveLength(1);
      expect(result.mechanical[0].name).toBe('Duct-1');
    });

    it('should handle empty BIM data', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: [],
        totalElements: 0,
        categories: {},
        elements: [],
        summary: { structural: 0, mep: 0, architectural: 0, site: 0, other: 0 },
      };

      const result = extractMEPEquipment(bimData);

      expect(result.mechanical).toHaveLength(0);
      expect(result.electrical).toHaveLength(0);
      expect(result.plumbing).toHaveLength(0);
      expect(result.fireProtection).toHaveLength(0);
    });

    it('should categorize mixed MEP elements correctly', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 7,
        categories: { 'MEP': 7 },
        elements: [
          { dbId: 1, name: 'AHU-1', category: 'MEP', properties: {} },
          { dbId: 2, name: 'Panel-1', category: 'MEP', properties: {} },
          { dbId: 3, name: 'Sink-1', category: 'MEP', properties: {} },
          { dbId: 4, name: 'Sprinkler-1', category: 'MEP', properties: {} },
          { dbId: 5, name: 'Duct-1', category: 'MEP', properties: {} },
          { dbId: 6, name: 'Wire-1', category: 'MEP', properties: {} },
          { dbId: 7, name: 'Pipe-1', category: 'MEP', properties: {} },
        ],
        summary: { structural: 0, mep: 7, architectural: 0, site: 0, other: 0 },
      };

      mocks.categorizeElement
        .mockReturnValueOnce({ category: 'mep', subcategory: 'mechanical_equipment' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'electrical_equipment' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'plumbing_fixtures' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'fire_protection' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'ductwork' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'wire' })
        .mockReturnValueOnce({ category: 'mep', subcategory: 'piping' });

      const result = extractMEPEquipment(bimData);

      expect(result.mechanical).toHaveLength(2);
      expect(result.electrical).toHaveLength(2);
      expect(result.plumbing).toHaveLength(2);
      expect(result.fireProtection).toHaveLength(1);
    });

    it('should handle all mechanical subcategories', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 7,
        categories: { 'MEP': 7 },
        elements: Array.from({ length: 7 }, (_, i) => ({
          dbId: i + 1,
          name: `Element-${i + 1}`,
          category: 'MEP',
          properties: {},
        })),
        summary: { structural: 0, mep: 7, architectural: 0, site: 0, other: 0 },
      };

      const subcategories = [
        'mechanical_equipment',
        'ductwork',
        'duct_fittings',
        'duct_accessories',
        'air_terminals',
        'flex_ducts',
        'mechanical',
      ];

      subcategories.forEach((sub) => {
        mocks.categorizeElement.mockReturnValueOnce({ category: 'mep', subcategory: sub });
      });

      const result = extractMEPEquipment(bimData);

      expect(result.mechanical).toHaveLength(7);
    });

    it('should handle all electrical subcategories', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 7,
        categories: { 'MEP': 7 },
        elements: Array.from({ length: 7 }, (_, i) => ({
          dbId: i + 1,
          name: `Element-${i + 1}`,
          category: 'MEP',
          properties: {},
        })),
        summary: { structural: 0, mep: 7, architectural: 0, site: 0, other: 0 },
      };

      const subcategories = [
        'electrical_equipment',
        'electrical_fixtures',
        'lighting',
        'cable_trays',
        'conduits',
        'wire',
        'electrical',
      ];

      subcategories.forEach((sub) => {
        mocks.categorizeElement.mockReturnValueOnce({ category: 'mep', subcategory: sub });
      });

      const result = extractMEPEquipment(bimData);

      expect(result.electrical).toHaveLength(7);
    });

    it('should handle all plumbing subcategories', async () => {
      const { extractMEPEquipment } = await import('@/lib/bim-to-takeoff-service');

      const bimData = {
        modelUrn: 'test-urn',
        extractedAt: '2024-01-15T00:00:00Z',
        viewableGuids: ['guid-1'],
        totalElements: 6,
        categories: { 'MEP': 6 },
        elements: Array.from({ length: 6 }, (_, i) => ({
          dbId: i + 1,
          name: `Element-${i + 1}`,
          category: 'MEP',
          properties: {},
        })),
        summary: { structural: 0, mep: 6, architectural: 0, site: 0, other: 0 },
      };

      const subcategories = [
        'plumbing_fixtures',
        'piping',
        'pipe_fittings',
        'pipe_accessories',
        'flex_pipes',
        'plumbing',
      ];

      subcategories.forEach((sub) => {
        mocks.categorizeElement.mockReturnValueOnce({ category: 'mep', subcategory: sub });
      });

      const result = extractMEPEquipment(bimData);

      expect(result.plumbing).toHaveLength(6);
    });
  });
});
