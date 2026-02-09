import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRoomSheetDOCX, type RoomSheetData } from '@/lib/room-docx-generator';

// Mock PizZip
const mockPizZipInstance = {
  file: vi.fn().mockReturnThis(),
  generate: vi.fn().mockReturnValue(new Blob(['mock docx'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })),
};

vi.mock('pizzip', () => ({
  default: vi.fn(() => mockPizZipInstance),
}));

describe('room-docx-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockRoomData: RoomSheetData = {
    project: {
      name: 'Test Project',
      slug: 'test-project',
      address: '123 Main St',
      clientName: 'ACME Corp',
    },
    room: {
      id: 'room-1',
      name: 'Conference Room',
      roomNumber: '101',
      type: 'Office',
      floorNumber: 1,
      area: 250,
      gridLocation: 'A-1',
      status: 'In Progress',
      percentComplete: 75,
      notes: 'Special finish required',
      tradeType: 'Drywall',
      assignedTo: 'John Doe',
    },
    finishSchedule: {
      categories: ['Floor', 'Wall'],
      items: {
        Floor: [
          {
            finishType: 'Carpet',
            material: 'Nylon',
            manufacturer: 'Mohawk',
            modelNumber: 'M1234',
            color: 'Beige',
          },
        ],
        Wall: [
          {
            finishType: 'Paint',
            material: 'Latex',
            manufacturer: 'Sherwin Williams',
            modelNumber: 'SW7006',
            color: 'Extra White',
          },
        ],
      },
      totalItems: 2,
    },
    mepEquipment: {
      systems: ['hvac', 'electrical'],
      items: {
        hvac: [
          {
            name: 'VAV Box',
            equipmentTag: 'VAV-01',
            modelNumber: 'VAV-500',
            specifications: '500 CFM',
            notes: 'Above ceiling',
          },
        ],
        electrical: [
          {
            name: 'Panel',
            equipmentTag: 'EP-1A',
            modelNumber: 'P-200',
            specifications: '200A',
            notes: 'Main distribution',
          },
        ],
      },
      totalItems: 2,
    },
    takeoffItems: {
      categories: ['Drywall', 'Flooring'],
      items: {
        Drywall: [
          {
            itemName: '5/8" Type X',
            quantity: 1000,
            unit: 'SF',
            specification: 'Fire-rated',
            notes: 'Taped and finished',
          },
        ],
        Flooring: [
          {
            description: 'Carpet Tile',
            quantity: 250,
            unit: 'SF',
            notes: 'Pattern match required',
          },
        ],
      },
      totalItems: 2,
      totalCost: 5000,
    },
    revision: {
      number: 2,
      lastModifiedBy: 'admin',
      lastModifiedAt: '2024-01-15T10:00:00Z',
    },
    exportedAt: '2024-01-15T12:00:00Z',
  };

  describe('generateRoomSheetDOCX', () => {
    it('should generate a DOCX blob with all sections', async () => {
      const result = await generateRoomSheetDOCX(mockRoomData);

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('[Content_Types].xml', expect.any(String));
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('_rels/.rels', expect.any(String));
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('word/document.xml', expect.any(String));
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('word/_rels/document.xml.rels', expect.any(String));
      expect(mockPizZipInstance.file).toHaveBeenCalledWith('word/styles.xml', expect.any(String));
      expect(mockPizZipInstance.generate).toHaveBeenCalled();
    });

    it('should include project name in document', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall).toBeDefined();
      expect(documentXmlCall![1]).toContain('Test Project');
    });

    it('should include room details in document', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('101');
      expect(documentXmlCall![1]).toContain('Conference Room');
      expect(documentXmlCall![1]).toContain('250');
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalData: RoomSheetData = {
        project: {
          name: 'Minimal Project',
          slug: 'minimal',
        },
        room: {
          id: 'room-1',
          name: 'Room A',
          type: 'Office',
          status: 'Active',
          percentComplete: 50,
        },
        finishSchedule: {
          categories: [],
          items: {},
          totalItems: 0,
        },
        mepEquipment: {
          systems: [],
          items: {},
          totalItems: 0,
        },
        takeoffItems: {
          categories: [],
          items: {},
          totalItems: 0,
          totalCost: 0,
        },
        exportedAt: '2024-01-15T12:00:00Z',
      };

      const result = await generateRoomSheetDOCX(minimalData);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should include finish schedule with proper table formatting', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('FINISH SCHEDULE');
      expect(documentXmlCall![1]).toContain('Carpet');
      expect(documentXmlCall![1]).toContain('Paint');
      expect(documentXmlCall![1]).toContain('<w:tbl>');
    });

    it('should include MEP equipment section', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('MEP EQUIPMENT');
      expect(documentXmlCall![1]).toContain('VAV Box');
      expect(documentXmlCall![1]).toContain('Panel');
    });

    it('should include material takeoff section', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('MATERIAL TAKEOFF');
      expect(documentXmlCall![1]).toContain('5/8&quot; Type X');
      expect(documentXmlCall![1]).toContain('Carpet Tile');
    });

    it('should escape XML special characters', async () => {
      const dataWithSpecialChars: RoomSheetData = {
        ...mockRoomData,
        room: {
          ...mockRoomData.room,
          notes: 'Test & verify <safety> standards',
        },
      };

      await generateRoomSheetDOCX(dataWithSpecialChars);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('&amp;');
      expect(documentXmlCall![1]).toContain('&lt;');
      expect(documentXmlCall![1]).toContain('&gt;');
    });

    it('should clean underscores from item names', async () => {
      const dataWithUnderscores: RoomSheetData = {
        ...mockRoomData,
        finishSchedule: {
          categories: ['Floor'],
          items: {
            Floor: [
              {
                finishType: 'Vinyl_Tile',
                material: 'PVC_Material',
                manufacturer: 'Test_Mfg',
                modelNumber: 'M_1234',
                color: 'Gray_Blue',
              },
            ],
          },
          totalItems: 1,
        },
      };

      await generateRoomSheetDOCX(dataWithUnderscores);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('Vinyl Tile');
      expect(documentXmlCall![1]).toContain('PVC Material');
      expect(documentXmlCall![1]).not.toContain('_');
    });

    it('should include room notes when provided', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('Special finish required');
    });

    it('should group finish items by category', async () => {
      const dataWithMultipleCategories: RoomSheetData = {
        ...mockRoomData,
        finishSchedule: {
          categories: ['Floor', 'Wall', 'Ceiling'],
          items: {
            Floor: [{ finishType: 'Carpet', material: 'Nylon', manufacturer: 'Test', modelNumber: 'M1', color: 'Beige' }],
            Wall: [{ finishType: 'Paint', material: 'Latex', manufacturer: 'Test', modelNumber: 'M2', color: 'White' }],
            Ceiling: [{ finishType: 'ACT', material: 'Mineral Fiber', manufacturer: 'Test', modelNumber: 'M3', color: 'White' }],
          },
          totalItems: 3,
        },
      };

      await generateRoomSheetDOCX(dataWithMultipleCategories);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('Floor');
      expect(documentXmlCall![1]).toContain('Wall');
      expect(documentXmlCall![1]).toContain('Ceiling');
    });

    it('should handle empty categories gracefully', async () => {
      const dataWithEmptyCategory: RoomSheetData = {
        ...mockRoomData,
        finishSchedule: {
          categories: ['Floor', 'EmptyCategory'],
          items: {
            Floor: [{ finishType: 'Carpet', material: 'Nylon', manufacturer: 'Test', modelNumber: 'M1', color: 'Beige' }],
            EmptyCategory: [],
          },
          totalItems: 1,
        },
      };

      const result = await generateRoomSheetDOCX(dataWithEmptyCategory);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should include formatted area in square feet', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('250');
      expect(documentXmlCall![1]).toContain('SF');
    });

    it('should format floor number correctly', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('Floor 1');
    });

    it('should include all required Word document components', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      expect(mockPizZipInstance.file).toHaveBeenCalledWith(
        '[Content_Types].xml',
        expect.stringContaining('application/vnd.openxmlformats')
      );
      expect(mockPizZipInstance.file).toHaveBeenCalledWith(
        '_rels/.rels',
        expect.stringContaining('Relationships')
      );
      expect(mockPizZipInstance.file).toHaveBeenCalledWith(
        'word/styles.xml',
        expect.stringContaining('w:styles')
      );
    });

    it('should handle null/undefined values in item properties', async () => {
      const dataWithNulls: RoomSheetData = {
        ...mockRoomData,
        finishSchedule: {
          categories: ['Floor'],
          items: {
            Floor: [
              {
                finishType: null as any,
                material: undefined as any,
                manufacturer: 'Test',
                modelNumber: null as any,
                color: undefined as any,
              },
            ],
          },
          totalItems: 1,
        },
      };

      const result = await generateRoomSheetDOCX(dataWithNulls);

      expect(result).toBeInstanceOf(Blob);
    });

    it('should include progress percentage in room details', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('75%');
    });

    it('should include grid location in room details', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      expect(documentXmlCall![1]).toContain('A-1');
    });

    it('should format export date correctly', async () => {
      await generateRoomSheetDOCX(mockRoomData);

      const documentXmlCall = mockPizZipInstance.file.mock.calls.find(
        (call) => call[0] === 'word/document.xml'
      );
      // Should contain "Exported:" followed by a date
      expect(documentXmlCall![1]).toMatch(/Exported.*\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });
});
