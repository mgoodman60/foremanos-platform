/**
 * Tests for render-prompt-assembler
 * Validates data aggregation, prompt construction, and completeness scoring
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  room: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  mEPEquipment: { findMany: vi.fn(), count: vi.fn() },
  materialTakeoff: { findMany: vi.fn() },
  documentChunk: { findMany: vi.fn() },
  autodeskModel: { findMany: vi.fn(), count: vi.fn() },
  floorPlan: { count: vi.fn() },
  roomPhoto: { count: vi.fn() },
  windowScheduleItem: { count: vi.fn() },
  finishScheduleItem: { count: vi.fn() },
  doorScheduleItem: { count: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  assembleRenderPrompt,
  gatherRoomData,
  gatherExteriorData,
  gatherAerialData,
  gatherCADData,
  buildStylePrefix,
  buildViewSuffix,
  calculateDataCompleteness,
  extractColorFinishFromChunks,
  type RenderContext,
  type RenderStyle,
  type CameraAngle,
} from '@/lib/render-prompt-assembler';

// ── Test Fixtures ──────────────────────────────────────────────────────

function makeProjectData(overrides: Record<string, unknown> = {}) {
  return {
    architecturalStyle: 'Modern',
    buildingUse: 'Office',
    stories: 3,
    roofType: 'Flat',
    roofMaterial: 'TPO membrane',
    exteriorMaterials: { primary: 'Glass curtain wall', secondary: 'Brick veneer' },
    exteriorColorPalette: { Primary: 'Charcoal', Secondary: 'White', Accent: 'Orange' },
    siteContext: 'Urban downtown',
    locationCity: 'Austin',
    locationState: 'TX',
    landscapingNotes: 'Native Texas xeriscaping with live oaks',
    ...overrides,
  };
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-1',
    projectId: 'proj-1',
    name: 'Conference Room A',
    type: 'Conference',
    area: 450,
    floorNumber: 2,
    FinishScheduleItem: [
      { category: 'Floor', material: 'LVT', color: 'Grey Oak', finishType: 'Plank', manufacturer: 'Shaw' },
      { category: 'Wall', material: 'Paint', color: 'SW7015 Repose Gray', finishType: 'Eggshell', manufacturer: 'Sherwin-Williams' },
      { category: 'Ceiling', material: 'ACT', color: 'White', finishType: '2x4 Tegular', manufacturer: 'Armstrong' },
    ],
    DoorScheduleItem: [
      { doorNumber: 'D201', doorType: 'Single', doorMaterial: 'Wood', width: '3\'-0"', height: '7\'-0"', glazing: 'Half-lite' },
    ],
    WindowScheduleItem: [
      { windowNumber: 'W201', windowType: 'Fixed', width: '6\'-0"', height: '5\'-0"', frameMaterial: 'Aluminum', glazingType: 'IGU' },
    ],
    ...overrides,
  };
}

// ── Setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default stubs for completeness checks
  mockPrisma.autodeskModel.count.mockResolvedValue(0);
  mockPrisma.autodeskModel.findMany.mockResolvedValue([]);
  mockPrisma.roomPhoto.count.mockResolvedValue(0);
  mockPrisma.floorPlan.count.mockResolvedValue(0);
  mockPrisma.room.count.mockResolvedValue(0);
  mockPrisma.room.findMany.mockResolvedValue([]);
  mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
  mockPrisma.finishScheduleItem.count.mockResolvedValue(0);
  mockPrisma.doorScheduleItem.count.mockResolvedValue(0);
  mockPrisma.mEPEquipment.findMany.mockResolvedValue([]);
  mockPrisma.mEPEquipment.count.mockResolvedValue(0);
  mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
  mockPrisma.documentChunk.findMany.mockResolvedValue([]);
  mockPrisma.project.findUnique.mockResolvedValue(null);
  mockPrisma.room.findUnique.mockResolvedValue(null);
});

// ── 1. assembleRenderPrompt — viewType routing ─────────────────────────

describe('assembleRenderPrompt', () => {
  it('assembles exterior prompt with project data', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(12);
    mockPrisma.room.count.mockResolvedValue(15);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'exterior',
      style: 'photorealistic',
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.prompt).toContain('Photorealistic');
    expect(result.prompt).toContain('3-story');
    expect(result.prompt).toContain('Modern');
    expect(result.prompt).toContain('ROOF:');
    expect(result.prompt).toContain('Austin');
    expect(result.tokenEstimate).toBeGreaterThan(0);
    expect(result.dataCompleteness.score).toBeGreaterThan(0);
  });

  it('assembles interior prompt with room data', async () => {
    const room = makeRoom();
    mockPrisma.room.findUnique.mockResolvedValue(room);
    mockPrisma.mEPEquipment.findMany.mockResolvedValue([
      { name: 'VAV Box', equipmentType: 'HVAC', manufacturer: 'Trane', model: 'V100' },
    ]);
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.finishScheduleItem.count.mockResolvedValue(3);
    mockPrisma.doorScheduleItem.count.mockResolvedValue(1);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(1);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'interior',
      style: 'photorealistic',
      roomId: 'room-1',
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.prompt).toContain('Conference Room A');
    expect(result.prompt).toContain('FINISHES:');
    expect(result.prompt).toContain('LVT');
    expect(result.prompt).toContain('Door D201');
    expect(result.prompt).toContain('VAV Box');
    expect(result.dataSnapshot).toHaveProperty('roomName', 'Conference Room A');
  });

  it('assembles aerial prompt with floor plan and area data', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(20);
    mockPrisma.room.count.mockResolvedValue(30);
    mockPrisma.room.findMany.mockResolvedValue([{ area: 500 }, { area: 600 }]);
    mockPrisma.floorPlan.count.mockResolvedValue(3);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'aerial_site',
      style: 'aerial_perspective',
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.prompt).toContain('Aerial');
    expect(result.prompt).toContain('TOTAL BUILDING AREA: 1100 SF');
    expect(result.prompt).toContain('FLOOR PLANS: 3');
    expect(result.dataSnapshot).toHaveProperty('totalBuildingArea', 1100);
  });
});

// ── 2. Style prefixes ──────────────────────────────────────────────────

describe('buildStylePrefix', () => {
  const styles: RenderStyle[] = [
    'photorealistic', 'conceptual', 'sketch', 'dusk_twilight',
    'construction_phase', 'material_closeup', 'aerial_perspective', 'section_cut',
  ];

  it.each(styles)('returns a non-empty prefix for style: %s', (style) => {
    const prefix = buildStylePrefix(style);
    expect(prefix.length).toBeGreaterThan(20);
    expect(prefix).not.toContain('{phase}');
  });

  it('injects construction phase details for construction_phase style', () => {
    const prefix = buildStylePrefix('construction_phase', 'framing');
    expect(prefix).toContain('framing');
    expect(prefix).toContain('structural steel or wood framing');
  });

  it('uses generic fallback when construction phase is unrecognized', () => {
    const prefix = buildStylePrefix('construction_phase', 'demolition');
    expect(prefix).toContain('active construction activity');
  });

  it('uses generic fallback when no construction phase provided', () => {
    const prefix = buildStylePrefix('construction_phase');
    expect(prefix).toContain('active construction');
    expect(prefix).not.toContain('{phase}');
  });
});

// ── 3. Camera angle suffixes ───────────────────────────────────────────

describe('buildViewSuffix', () => {
  const angles: CameraAngle[] = ['eye_level', 'elevated', 'corner', 'worms_eye', 'overhead'];

  it.each(angles)('includes angle description for: %s', (angle) => {
    const suffix = buildViewSuffix('exterior', angle);
    expect(suffix.length).toBeGreaterThan(20);
  });

  it('returns view-only description when no camera angle provided', () => {
    const suffix = buildViewSuffix('interior');
    expect(suffix).toContain('Interior view');
    expect(suffix).not.toContain('Shot from');
  });

  it('returns aerial description for aerial_site', () => {
    const suffix = buildViewSuffix('aerial_site');
    expect(suffix).toContain('Aerial site plan view');
  });
});

// ── 4. Data gathering — room ───────────────────────────────────────────

describe('gatherRoomData', () => {
  it('returns structured room data with finishes', async () => {
    mockPrisma.room.findUnique.mockResolvedValue(makeRoom());
    mockPrisma.mEPEquipment.findMany.mockResolvedValue([]);

    const data = await gatherRoomData('proj-1', 'room-1');

    expect(data.roomName).toBe('Conference Room A');
    expect(data.area).toBe(450);
    expect(data.finishes).toHaveProperty('floor');
    expect((data.finishes as Record<string, Record<string, unknown>>).floor.material).toBe('LVT');
    expect((data.doors as unknown[]).length).toBe(1);
    expect((data.windows as unknown[]).length).toBe(1);
  });

  it('returns empty object when room not found', async () => {
    mockPrisma.room.findUnique.mockResolvedValue(null);

    const data = await gatherRoomData('proj-1', 'nonexistent');

    expect(data).toEqual({});
  });

  it('returns empty object when room belongs to different project', async () => {
    mockPrisma.room.findUnique.mockResolvedValue(makeRoom({ projectId: 'other-proj' }));

    const data = await gatherRoomData('proj-1', 'room-1');

    expect(data).toEqual({});
  });
});

// ── 5. Data gathering — exterior ───────────────────────────────────────

describe('gatherExteriorData', () => {
  it('returns project exterior fields', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(8);
    mockPrisma.room.count.mockResolvedValue(10);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const data = await gatherExteriorData('proj-1');

    expect(data.architecturalStyle).toBe('Modern');
    expect(data.roofType).toBe('Flat');
    expect(data.windowCount).toBe(8);
    expect(data.roomCount).toBe(10);
  });

  it('includes takeoff-derived materials', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData({ exteriorMaterials: null }));
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([
      {
        TakeoffLineItem: [
          { itemName: 'CMU Block', category: 'Masonry', material: 'CMU 8"', description: null },
        ],
      },
    ]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const data = await gatherExteriorData('proj-1');

    expect(data.takeoffMaterials).toEqual([
      { name: 'CMU Block', category: 'Masonry', material: 'CMU 8"' },
    ]);
  });

  it('returns empty object when project not found', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const data = await gatherExteriorData('nonexistent');

    expect(data).toEqual({});
  });
});

// ── 6. Data gathering — aerial ─────────────────────────────────────────

describe('gatherAerialData', () => {
  it('adds floor plan count and total area to exterior data', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(5);
    mockPrisma.room.findMany.mockResolvedValue([{ area: 1000 }, { area: 2000 }]);
    mockPrisma.floorPlan.count.mockResolvedValue(2);

    const data = await gatherAerialData('proj-1');

    expect(data.floorPlanCount).toBe(2);
    expect(data.totalBuildingArea).toBe(3000);
    expect(data.architecturalStyle).toBe('Modern');
  });
});

// ── 7. CAD data integration ────────────────────────────────────────────

describe('gatherCADData', () => {
  it('returns extracted metadata from BIM models', async () => {
    mockPrisma.autodeskModel.findMany.mockResolvedValue([
      { fileName: 'model.rvt', extractedMetadata: { levels: 3, grossArea: 45000 } },
    ]);

    const data = await gatherCADData('proj-1');

    expect(data).not.toBeNull();
    expect(data!.bimModels).toHaveLength(1);
    expect((data!.bimModels as unknown[])[0]).toHaveProperty('fileName', 'model.rvt');
  });

  it('returns null when no completed BIM models exist', async () => {
    mockPrisma.autodeskModel.findMany.mockResolvedValue([]);

    const data = await gatherCADData('proj-1');

    expect(data).toBeNull();
  });

  it('returns null when models have no extracted metadata', async () => {
    mockPrisma.autodeskModel.findMany.mockResolvedValue([
      { fileName: 'model.rvt', extractedMetadata: null },
    ]);

    const data = await gatherCADData('proj-1');

    expect(data).toBeNull();
  });
});

// ── 8. Data completeness ───────────────────────────────────────────────

describe('calculateDataCompleteness', () => {
  it('returns high score when all data is available', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.autodeskModel.count.mockResolvedValue(1);
    mockPrisma.roomPhoto.count.mockResolvedValue(5);

    const result = await calculateDataCompleteness('proj-1', 'exterior');

    expect(result.score).toBeGreaterThanOrEqual(80);
    const availableItems = result.items.filter(i => i.status === 'available');
    expect(availableItems.length).toBeGreaterThan(5);
  });

  it('returns low score when no data is available', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      architecturalStyle: null,
      buildingUse: null,
      stories: null,
      roofType: null,
      roofMaterial: null,
      exteriorMaterials: null,
      exteriorColorPalette: null,
      siteContext: null,
      landscapingNotes: null,
    });

    const result = await calculateDataCompleteness('proj-1', 'exterior');

    expect(result.score).toBeLessThan(20);
    const missingItems = result.items.filter(i => i.status === 'missing');
    expect(missingItems.length).toBeGreaterThan(5);
  });

  it('includes interior-specific items for interior viewType', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.room.findUnique.mockResolvedValue({ area: 300 });
    mockPrisma.finishScheduleItem.count.mockResolvedValue(3);
    mockPrisma.doorScheduleItem.count.mockResolvedValue(2);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(1);
    mockPrisma.mEPEquipment.count.mockResolvedValue(4);

    const result = await calculateDataCompleteness('proj-1', 'interior', 'room-1');

    const keys = result.items.map(i => i.key);
    expect(keys).toContain('roomDimensions');
    expect(keys).toContain('finishSchedule');
    expect(keys).toContain('doorWindowSchedule');
    expect(keys).toContain('mepEquipment');
  });

  it('marks roof as partial when only one of type/material is set', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(
      makeProjectData({ roofType: 'Hip', roofMaterial: null })
    );

    const result = await calculateDataCompleteness('proj-1', 'exterior');

    const roofItem = result.items.find(i => i.key === 'roof');
    expect(roofItem?.status).toBe('partial');
  });
});

// ── 9. Color/finish extraction ─────────────────────────────────────────

describe('extractColorFinishFromChunks', () => {
  it('extracts color info from document chunks', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        content: 'Wall color: SW7015 Repose Gray, Floor finish: LVT Grey Oak plank',
        Document: { name: 'Finish Schedule', category: 'specifications' },
      },
    ]);

    const result = await extractColorFinishFromChunks('proj-1');

    expect(result).toContain('Color and finish specifications');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes room-specific finish schedule items', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);
    mockPrisma.room.findMany.mockResolvedValue([
      {
        FinishScheduleItem: [
          { category: 'Floor', material: 'Carpet', color: 'Navy Blue' },
        ],
      },
    ]);

    const result = await extractColorFinishFromChunks('proj-1', 'Lobby');

    expect(result).toContain('Floor: Carpet (Navy Blue)');
  });

  it('returns empty string when no chunks or finishes found', async () => {
    mockPrisma.documentChunk.findMany.mockResolvedValue([]);

    const result = await extractColorFinishFromChunks('proj-1');

    expect(result).toBe('');
  });

  it('deduplicates color info from multiple chunks', async () => {
    // Two separate chunks with the same color reference
    mockPrisma.documentChunk.findMany.mockResolvedValue([
      {
        content: 'Floor finish: LVT Grey Oak',
        Document: { name: 'Spec A', category: 'specifications' },
      },
      {
        content: 'Floor finish: LVT Grey Oak',
        Document: { name: 'Spec B', category: 'specifications' },
      },
    ]);

    const result = await extractColorFinishFromChunks('proj-1');

    // Set dedup should collapse identical extracted strings
    const occurrences = (result.match(/Floor finish: LVT Grey Oak/g) || []).length;
    expect(occurrences).toBe(1);
  });
});

// ── 10. User overrides ─────────────────────────────────────────────────

describe('user overrides', () => {
  it('applies user overrides to data snapshot', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'exterior',
      style: 'photorealistic',
      userOverrides: { architecturalStyle: 'Art Deco', roofType: 'Mansard' },
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.dataSnapshot.architecturalStyle).toBe('Art Deco');
    expect(result.dataSnapshot.roofType).toBe('Mansard');
  });
});

// ── 11. PII stripping ──────────────────────────────────────────────────

describe('PII stripping', () => {
  it('does not include client name or project address in prompt', async () => {
    // The project data includes clientName and projectAddress in schema
    // but gatherExteriorData only selects safe fields
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'exterior',
      style: 'photorealistic',
    };

    const result = await assembleRenderPrompt(ctx);

    // Should not contain PII fields — these are not selected in queries
    expect(result.prompt).not.toContain('clientName');
    expect(result.prompt).not.toContain('projectAddress');
    // Should contain generic location
    expect(result.prompt).toContain('Austin');
  });
});

// ── 12. Prompt truncation ──────────────────────────────────────────────

describe('prompt truncation', () => {
  it('truncates prompt when exceeding 4000 characters', async () => {
    // Generate a very long landscaping description
    const longNotes = 'Extensive native landscaping with mature trees. '.repeat(100);
    mockPrisma.project.findUnique.mockResolvedValue(
      makeProjectData({ landscapingNotes: longNotes })
    );
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'exterior',
      style: 'photorealistic',
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.prompt.length).toBeLessThanOrEqual(4000);
    expect(result.prompt).toContain('Photorealistic');
    expect(result.prompt).toContain('INSTRUCTIONS:');
  });
});

// ── 13. Graceful degradation ───────────────────────────────────────────

describe('graceful degradation', () => {
  it('returns a prompt even when Prisma throws', async () => {
    mockPrisma.project.findUnique.mockRejectedValue(new Error('DB connection lost'));
    mockPrisma.autodeskModel.findMany.mockRejectedValue(new Error('DB connection lost'));

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'exterior',
      style: 'conceptual',
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.prompt).toContain('Conceptual');
    expect(result.prompt).toContain('INSTRUCTIONS:');
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it('gatherRoomData returns empty object on error', async () => {
    mockPrisma.room.findUnique.mockRejectedValue(new Error('DB error'));

    const data = await gatherRoomData('proj-1', 'room-1');

    expect(data).toEqual({});
  });

  it('gatherExteriorData returns empty object on error', async () => {
    mockPrisma.project.findUnique.mockRejectedValue(new Error('DB error'));

    const data = await gatherExteriorData('proj-1');

    expect(data).toEqual({});
  });

  it('extractColorFinishFromChunks returns empty string on error', async () => {
    mockPrisma.documentChunk.findMany.mockRejectedValue(new Error('DB error'));

    const result = await extractColorFinishFromChunks('proj-1');

    expect(result).toBe('');
  });
});

// ── 14. Minimal project ────────────────────────────────────────────────

describe('minimal project', () => {
  it('produces a reasonable prompt with no rooms, no finishes', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      architecturalStyle: null,
      buildingUse: null,
      stories: null,
      roofType: null,
      roofMaterial: null,
      exteriorMaterials: null,
      exteriorColorPalette: null,
      siteContext: null,
      locationCity: null,
      locationState: null,
      landscapingNotes: null,
    });
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'exterior',
      style: 'sketch',
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.prompt).toContain('Hand-drawn architectural sketch');
    expect(result.prompt).toContain('INSTRUCTIONS:');
    expect(result.prompt).not.toContain('BUILDING:');
    expect(result.prompt).not.toContain('ROOF:');
    expect(result.prompt).not.toContain('Unknown');
    expect(result.prompt).not.toContain('Not set');
  });

  it('produces a prompt for interior view without a room', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'interior',
      style: 'photorealistic',
      // No roomId — falls back to exterior-like gather
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.prompt).toContain('Photorealistic');
    expect(result.prompt).toContain('INSTRUCTIONS:');
  });
});

// ── 15. User notes ─────────────────────────────────────────────────────

describe('user notes', () => {
  it('includes user notes in the assembled prompt', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'exterior',
      style: 'dusk_twilight',
      userNotes: 'Show the main entrance with a dramatic canopy',
    };

    const result = await assembleRenderPrompt(ctx);

    expect(result.prompt).toContain('ADDITIONAL CONTEXT: Show the main entrance with a dramatic canopy');
  });
});

// ── 16. Token estimate ─────────────────────────────────────────────────

describe('token estimate', () => {
  it('estimates tokens as roughly prompt length / 4', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(makeProjectData());
    mockPrisma.materialTakeoff.findMany.mockResolvedValue([]);
    mockPrisma.windowScheduleItem.count.mockResolvedValue(0);
    mockPrisma.room.count.mockResolvedValue(0);
    mockPrisma.room.findMany.mockResolvedValue([]);

    const ctx: RenderContext = {
      projectId: 'proj-1',
      viewType: 'exterior',
      style: 'photorealistic',
    };

    const result = await assembleRenderPrompt(ctx);

    const expectedEstimate = Math.ceil(result.prompt.length / 4);
    expect(result.tokenEstimate).toBe(expectedEstimate);
  });
});
