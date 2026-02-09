/**
 * Fixture Extractor
 * Parses plumbingFixtures[] and electricalDevices[] from DocumentChunk metadata
 * into summary records, grouped by room and type.
 */

import { prisma } from './db';
import { logger } from '@/lib/logger';
import { classifyLocation } from '@/lib/exterior-equipment-classifier';

export interface FixtureExtractionResult {
  plumbingFixtureCount: number;
  electricalDeviceCount: number;
  roomsWithFixtures: number;
}

/**
 * Extract and aggregate fixture data from document chunks
 * Stores summary on the Document's sheetIndex JSON field
 */
export async function extractFixtures(
  documentId: string,
  projectId: string
): Promise<FixtureExtractionResult> {
  logger.info('FIXTURE_EXTRACTOR', 'Starting fixture extraction', { documentId });

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    select: { id: true, sheetNumber: true, metadata: true },
  });

  const plumbingByRoom: Record<string, any[]> = {};
  const electricalByRoom: Record<string, any[]> = {};

  for (const chunk of chunks) {
    const meta = chunk.metadata as any;
    if (!meta) continue;

    // Aggregate plumbing fixtures
    if (meta.plumbingFixtures?.length > 0) {
      for (const fixture of meta.plumbingFixtures) {
        const room = fixture.room || 'unassigned';
        const locType = classifyLocation(room, fixture.type);
        const effectiveRoom = (locType === 'exterior' || locType === 'site' || locType === 'roof')
          ? `EXTERIOR:${room}`
          : room;
        if (!plumbingByRoom[effectiveRoom]) plumbingByRoom[effectiveRoom] = [];
        plumbingByRoom[effectiveRoom].push({
          ...fixture,
          sourceSheet: chunk.sheetNumber,
        });
      }
    }

    // Aggregate electrical devices
    if (meta.electricalDevices?.length > 0) {
      for (const device of meta.electricalDevices) {
        const room = device.room || 'unassigned';
        const locType = classifyLocation(room, device.type);
        const effectiveRoom = (locType === 'exterior' || locType === 'site' || locType === 'roof')
          ? `EXTERIOR:${room}`
          : room;
        if (!electricalByRoom[effectiveRoom]) electricalByRoom[effectiveRoom] = [];
        electricalByRoom[effectiveRoom].push({
          ...device,
          sourceSheet: chunk.sheetNumber,
        });
      }
    }
  }

  // Count totals
  const plumbingFixtureCount = Object.values(plumbingByRoom).reduce((sum, arr) => sum + arr.length, 0);
  const electricalDeviceCount = Object.values(electricalByRoom).reduce((sum, arr) => sum + arr.length, 0);
  const allRooms = new Set([...Object.keys(plumbingByRoom), ...Object.keys(electricalByRoom)]);

  // Store fixture summary on document
  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { sheetIndex: true },
    });
    const currentIndex = (doc?.sheetIndex as any) || {};

    await prisma.document.update({
      where: { id: documentId },
      data: {
        sheetIndex: {
          ...currentIndex,
          fixtures: {
            plumbing: plumbingByRoom,
            electrical: electricalByRoom,
            summary: {
              plumbingTotal: plumbingFixtureCount,
              electricalTotal: electricalDeviceCount,
              roomsWithFixtures: allRooms.size,
            },
          },
        } as any,
      },
    });
  } catch (error) {
    logger.warn('FIXTURE_EXTRACTOR', 'Failed to store fixture summary', { error: (error as Error).message });
  }

  logger.info('FIXTURE_EXTRACTOR', 'Fixture extraction complete', {
    documentId, plumbingFixtureCount, electricalDeviceCount, roomsWithFixtures: allRooms.size,
  });

  return { plumbingFixtureCount, electricalDeviceCount, roomsWithFixtures: allRooms.size };
}
