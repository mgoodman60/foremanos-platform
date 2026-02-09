/**
 * Tests for Fixture Extractor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockPrisma = vi.hoisted(() => ({
  documentChunk: {
    findMany: vi.fn(),
  },
  document: {
    findUnique: vi.fn(),
    update: vi.fn(),
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

// Import after mocks
import { extractFixtures } from '@/lib/fixture-extractor';

describe('Fixture Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractFixtures', () => {
    it('should extract and aggregate plumbing fixtures by room', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '101', tag: 'WC-1' },
              { type: 'LAV', room: '101', tag: 'LAV-1' },
            ],
          },
        },
        {
          id: 'chunk2',
          sheetNumber: 'P-1.2',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '102', tag: 'WC-2' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result).toEqual({
        plumbingFixtureCount: 3,
        electricalDeviceCount: 0,
        roomsWithFixtures: 2,
      });

      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-id' },
        data: {
          sheetIndex: expect.objectContaining({
            fixtures: expect.objectContaining({
              plumbing: expect.any(Object),
              summary: {
                plumbingTotal: 3,
                electricalTotal: 0,
                roomsWithFixtures: 2,
              },
            }),
          }),
        },
      });
    });

    it('should extract and aggregate electrical devices by room', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'E-1.1',
          metadata: {
            electricalDevices: [
              { type: 'OUTLET', room: '201', tag: 'R-1' },
              { type: 'SWITCH', room: '201', tag: 'S-1' },
            ],
          },
        },
        {
          id: 'chunk2',
          sheetNumber: 'E-1.2',
          metadata: {
            electricalDevices: [
              { type: 'OUTLET', room: '202', tag: 'R-2' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result).toEqual({
        plumbingFixtureCount: 0,
        electricalDeviceCount: 3,
        roomsWithFixtures: 2,
      });
    });

    it('should handle both plumbing and electrical fixtures together', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'M-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '301', tag: 'WC-1' },
            ],
            electricalDevices: [
              { type: 'OUTLET', room: '301', tag: 'R-1' },
              { type: 'SWITCH', room: '302', tag: 'S-1' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result).toEqual({
        plumbingFixtureCount: 1,
        electricalDeviceCount: 2,
        roomsWithFixtures: 2,
      });
    });

    it('should group fixtures with no room as unassigned', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'FD', tag: 'FD-1' }, // No room specified
              { type: 'WC', room: '101', tag: 'WC-1' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result).toEqual({
        plumbingFixtureCount: 2,
        electricalDeviceCount: 0,
        roomsWithFixtures: 2, // '101' + 'unassigned'
      });

      const updateCall = mockPrisma.document.update.mock.calls[0][0];
      const fixturesData = updateCall.data.sheetIndex.fixtures;
      expect(fixturesData.plumbing).toHaveProperty('unassigned');
      expect(fixturesData.plumbing.unassigned).toHaveLength(1);
    });

    it('should include sourceSheet in aggregated fixture data', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-2.3',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '101', tag: 'WC-1' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      await extractFixtures('doc-id', 'project-id');

      const updateCall = mockPrisma.document.update.mock.calls[0][0];
      const fixturesData = updateCall.data.sheetIndex.fixtures;
      expect(fixturesData.plumbing['101'][0]).toHaveProperty('sourceSheet', 'P-2.3');
    });

    it('should handle chunks with no metadata', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: null,
        },
        {
          id: 'chunk2',
          sheetNumber: 'P-1.2',
          metadata: undefined,
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result).toEqual({
        plumbingFixtureCount: 0,
        electricalDeviceCount: 0,
        roomsWithFixtures: 0,
      });
    });

    it('should handle chunks with empty fixture arrays', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [],
            electricalDevices: [],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result).toEqual({
        plumbingFixtureCount: 0,
        electricalDeviceCount: 0,
        roomsWithFixtures: 0,
      });
    });

    it('should merge with existing sheetIndex data', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '101', tag: 'WC-1' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({
        sheetIndex: {
          existingData: 'preserved',
          sheets: ['Sheet 1', 'Sheet 2'],
        },
      });

      mockPrisma.document.update.mockResolvedValueOnce({});

      await extractFixtures('doc-id', 'project-id');

      const updateCall = mockPrisma.document.update.mock.calls[0][0];
      expect(updateCall.data.sheetIndex).toHaveProperty('existingData', 'preserved');
      expect(updateCall.data.sheetIndex).toHaveProperty('sheets');
      expect(updateCall.data.sheetIndex).toHaveProperty('fixtures');
    });

    it('should handle null sheetIndex from database', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '101', tag: 'WC-1' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: null });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result.plumbingFixtureCount).toBe(1);
      expect(mockPrisma.document.update).toHaveBeenCalled();
    });

    it('should warn if document update fails', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '101', tag: 'WC-1' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockRejectedValueOnce(new Error('Database error'));

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result.plumbingFixtureCount).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'FIXTURE_EXTRACTOR',
        'Failed to store fixture summary',
        expect.objectContaining({ error: 'Database error' })
      );
    });

    it('should count total fixtures correctly across multiple rooms', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '101', tag: 'WC-1' },
              { type: 'LAV', room: '101', tag: 'LAV-1' },
              { type: 'WC', room: '102', tag: 'WC-2' },
            ],
            electricalDevices: [
              { type: 'OUTLET', room: '101', tag: 'R-1' },
              { type: 'SWITCH', room: '102', tag: 'S-1' },
              { type: 'OUTLET', room: '103', tag: 'R-2' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result.plumbingFixtureCount).toBe(3);
      expect(result.electricalDeviceCount).toBe(3);
      expect(result.roomsWithFixtures).toBe(3); // Rooms 101, 102, 103
    });

    it('should log extraction start and completion', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '101', tag: 'WC-1' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      await extractFixtures('doc-123', 'project-456');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'FIXTURE_EXTRACTOR',
        'Starting fixture extraction',
        { documentId: 'doc-123' }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'FIXTURE_EXTRACTOR',
        'Fixture extraction complete',
        {
          documentId: 'doc-123',
          plumbingFixtureCount: 1,
          electricalDeviceCount: 0,
          roomsWithFixtures: 1,
        }
      );
    });

    it('should handle fixtures across multiple chunks for same room', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              { type: 'WC', room: '101', tag: 'WC-1' },
            ],
          },
        },
        {
          id: 'chunk2',
          sheetNumber: 'P-1.2',
          metadata: {
            plumbingFixtures: [
              { type: 'LAV', room: '101', tag: 'LAV-1' },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      await extractFixtures('doc-id', 'project-id');

      const updateCall = mockPrisma.document.update.mock.calls[0][0];
      const fixturesData = updateCall.data.sheetIndex.fixtures;

      // Room 101 should have both fixtures
      expect(fixturesData.plumbing['101']).toHaveLength(2);
      expect(fixturesData.plumbing['101'][0].sourceSheet).toBe('P-1.1');
      expect(fixturesData.plumbing['101'][1].sourceSheet).toBe('P-1.2');
    });

    it('should preserve all fixture properties when aggregating', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([
        {
          id: 'chunk1',
          sheetNumber: 'P-1.1',
          metadata: {
            plumbingFixtures: [
              {
                type: 'WC',
                room: '101',
                tag: 'WC-1',
                manufacturer: 'Kohler',
                model: 'K-3999',
                location: 'North Wall',
              },
            ],
          },
        },
      ]);

      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      await extractFixtures('doc-id', 'project-id');

      const updateCall = mockPrisma.document.update.mock.calls[0][0];
      const fixture = updateCall.data.sheetIndex.fixtures.plumbing['101'][0];

      expect(fixture).toMatchObject({
        type: 'WC',
        room: '101',
        tag: 'WC-1',
        manufacturer: 'Kohler',
        model: 'K-3999',
        location: 'North Wall',
        sourceSheet: 'P-1.1',
      });
    });

    it('should return zero counts when no chunks exist', async () => {
      mockPrisma.documentChunk.findMany.mockResolvedValueOnce([]);
      mockPrisma.document.findUnique.mockResolvedValueOnce({ sheetIndex: {} });
      mockPrisma.document.update.mockResolvedValueOnce({});

      const result = await extractFixtures('doc-id', 'project-id');

      expect(result).toEqual({
        plumbingFixtureCount: 0,
        electricalDeviceCount: 0,
        roomsWithFixtures: 0,
      });
    });
  });
});
