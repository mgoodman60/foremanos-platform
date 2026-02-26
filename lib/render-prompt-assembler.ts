/**
 * Render Prompt Assembler
 * Aggregates project data from multiple sources and constructs
 * detailed architectural visualization prompts for image generation.
 */

import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('RENDER_PROMPT');

// ── Types ──────────────────────────────────────────────────────────────

export type RenderViewType = 'exterior' | 'interior' | 'aerial_site';
export type RenderStyle =
  | 'photorealistic' | 'conceptual' | 'sketch' | 'dusk_twilight'
  | 'construction_phase' | 'material_closeup' | 'aerial_perspective' | 'section_cut';
export type CameraAngle = 'eye_level' | 'elevated' | 'corner' | 'worms_eye' | 'overhead';

export interface RenderContext {
  projectId: string;
  viewType: RenderViewType;
  style: RenderStyle;
  cameraAngle?: CameraAngle;
  roomId?: string;
  userNotes?: string;
  userOverrides?: Record<string, string>;
  constructionPhase?: string;
}

export interface DataCompletenessItem {
  label: string;
  key: string;
  status: 'available' | 'partial' | 'missing';
  detail?: string;
}

export interface AssembledPrompt {
  prompt: string;
  dataSnapshot: Record<string, unknown>;
  tokenEstimate: number;
  dataCompleteness: {
    score: number;
    items: DataCompletenessItem[];
  };
}

// ── Constants ──────────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 4000;

const STYLE_PREFIXES: Record<RenderStyle, string> = {
  photorealistic:
    'Photorealistic architectural photograph taken with a professional DSLR camera. Sharp focus, natural lighting, accurate material textures and reflections. No text, labels, or annotations.',
  conceptual:
    'Conceptual architectural rendering with clean lines, soft shadows, and muted color palette. Design-intent visualization showing massing and spatial relationships.',
  sketch:
    'Hand-drawn architectural sketch in pencil and charcoal on textured paper. Loose confident lines, subtle shading, architectural presentation quality.',
  dusk_twilight:
    'Twilight architectural photograph at golden hour. Warm ambient sky, long dramatic shadows, interior lights glowing through windows, professional real estate photography quality.',
  construction_phase:
    'Construction progress photograph showing the building at {phase} stage. Realistic construction site with {phaseDetails}.',
  material_closeup:
    'Close-up architectural detail photograph. Macro view showing material textures, joints, and finishes at 1:1 scale. Studio-quality material documentation.',
  aerial_perspective:
    'Aerial bird\'s-eye architectural photograph taken from a drone at 45-degree angle. Shows building, surrounding site, landscaping, and neighborhood context.',
  section_cut:
    'Architectural cross-section rendering showing interior spatial relationships, wall assemblies, floor-to-floor heights, and structural elements. Technical illustration quality with color-coded materials.',
};

const CONSTRUCTION_PHASE_DETAILS: Record<string, string> = {
  foundation: 'exposed footings, formwork, rebar, excavation, and fresh concrete pours',
  framing: 'structural steel or wood framing, open walls, temporary bracing, and scaffolding',
  rough_in: 'MEP rough-in visible in open walls, conduit runs, ductwork, and plumbing lines',
  drywall: 'drywall installation in progress, taped joints, some areas primed, construction dust',
  finishes: 'interior finishes being installed, flooring, trim work, paint, and final fixtures',
};

const CAMERA_ANGLE_DESCRIPTIONS: Record<CameraAngle, string> = {
  eye_level: 'Shot from eye level (5\'6" height), natural human perspective.',
  elevated: 'Shot from an elevated vantage point, approximately 15-20 feet above ground.',
  corner: 'Three-quarter corner view showing two facades of the building.',
  worms_eye: 'Low angle shot looking upward, emphasizing height and vertical elements.',
  overhead: 'Directly overhead top-down view.',
};

const VIEW_DESCRIPTIONS: Record<RenderViewType, string> = {
  exterior: 'Exterior view of the building showing the primary facade, entry, and surrounding landscape.',
  interior: 'Interior view showing the room space, furnishings context, finishes, and natural light.',
  aerial_site: 'Aerial site plan view showing the building footprint, parking, landscaping, and surrounding context.',
};

const COLOR_KEYWORDS = [
  'color', 'finish', 'paint', 'stain', 'sherwin', 'benjamin moore',
  'wall finish', 'floor finish', 'ceiling finish', 'trim color',
  'accent color', 'base color', 'tile color', 'carpet color',
  'lvt', 'vinyl', 'laminate', 'wood tone', 'grey', 'gray', 'beige',
  'white', 'cream', 'tan', 'blue', 'green', 'neutral', 'warm', 'cool',
];

const COLOR_PATTERNS = [
  /(?:wall|ceiling|floor|trim|accent|base)\s*(?:color|finish|paint)[\s:]+([A-Za-z0-9\s\-#]+)/gi,
  /(?:sherwin[\s-]?williams|benjamin[\s-]?moore|ppg|behr)[\s:]+([A-Za-z0-9\s\-#]+)/gi,
  /(?:paint|finish)[\s:]+(?:color\s*)?([A-Za-z0-9\s\-#]+)/gi,
  /(?:lvt|vct|carpet|tile|flooring)[\s:]+([A-Za-z0-9\s\-]+)/gi,
];

// ── Main Entry Point ───────────────────────────────────────────────────

export async function assembleRenderPrompt(context: RenderContext): Promise<AssembledPrompt> {
  const { projectId, viewType, style, cameraAngle, roomId, userNotes, userOverrides, constructionPhase } = context;

  log.info('Assembling render prompt', { projectId, viewType, style });

  let dataSnapshot: Record<string, unknown> = {};

  try {
    if (viewType === 'interior' && roomId) {
      dataSnapshot = await gatherRoomData(projectId, roomId);
    } else if (viewType === 'aerial_site') {
      dataSnapshot = await gatherAerialData(projectId);
    } else {
      dataSnapshot = await gatherExteriorData(projectId);
    }
  } catch (err) {
    log.error('Failed to gather data, proceeding with empty snapshot', err);
  }

  const cadData = await gatherCADData(projectId);
  if (cadData) {
    dataSnapshot.cadData = cadData;
  }

  if (userOverrides) {
    for (const [key, value] of Object.entries(userOverrides)) {
      dataSnapshot[key] = value;
    }
  }

  const completeness = await calculateDataCompleteness(projectId, viewType, roomId);

  const stylePrefix = buildStylePrefix(style, constructionPhase);
  const viewSuffix = buildViewSuffix(viewType, cameraAngle);

  let prompt = buildPromptBody(stylePrefix, viewSuffix, viewType, dataSnapshot, userNotes);

  if (prompt.length > MAX_PROMPT_LENGTH) {
    prompt = truncatePrompt(prompt, stylePrefix, viewSuffix);
  }

  const tokenEstimate = Math.ceil(prompt.length / 4);

  log.info('Prompt assembled', { tokenEstimate, completenessScore: completeness.score });

  return {
    prompt,
    dataSnapshot,
    tokenEstimate,
    dataCompleteness: completeness,
  };
}

// ── Data Gathering ─────────────────────────────────────────────────────

export async function gatherRoomData(projectId: string, roomId: string): Promise<Record<string, unknown>> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        FinishScheduleItem: true,
        DoorScheduleItem: true,
        WindowScheduleItem: true,
      },
    });

    if (!room || room.projectId !== projectId) {
      log.warn('Room not found or project mismatch', { roomId, projectId });
      return {};
    }

    const mepEquipment = await prisma.mEPEquipment.findMany({
      where: { projectId, room: room.name },
      select: { name: true, equipmentType: true, manufacturer: true, model: true },
    });

    const finishes: Record<string, unknown> = {};
    for (const fi of room.FinishScheduleItem) {
      const cat = fi.category?.toLowerCase() || 'other';
      finishes[cat] = {
        material: fi.material,
        color: fi.color,
        finishType: fi.finishType,
        manufacturer: fi.manufacturer,
      };
    }

    const doors = room.DoorScheduleItem.map(d => ({
      doorNumber: d.doorNumber,
      doorType: d.doorType,
      material: d.doorMaterial,
      width: d.width,
      height: d.height,
      glazing: d.glazing,
    }));

    const windows = room.WindowScheduleItem.map(w => ({
      windowNumber: w.windowNumber,
      windowType: w.windowType,
      width: w.width,
      height: w.height,
      frameMaterial: w.frameMaterial,
      glazingType: w.glazingType,
    }));

    return {
      roomName: room.name,
      roomType: room.type,
      area: room.area,
      floorNumber: room.floorNumber,
      finishes,
      doors,
      windows,
      mepEquipment: mepEquipment.map(e => ({
        name: e.name,
        type: e.equipmentType,
        manufacturer: e.manufacturer,
        model: e.model,
      })),
    };
  } catch (err) {
    log.error('Failed to gather room data', err, { roomId, projectId });
    return {};
  }
}

export async function gatherExteriorData(projectId: string): Promise<Record<string, unknown>> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        architecturalStyle: true,
        buildingUse: true,
        stories: true,
        roofType: true,
        roofMaterial: true,
        exteriorMaterials: true,
        exteriorColorPalette: true,
        siteContext: true,
        locationCity: true,
        locationState: true,
        landscapingNotes: true,
      },
    });

    if (!project) {
      log.warn('Project not found for exterior data', { projectId });
      return {};
    }

    const takeoffs = await prisma.materialTakeoff.findMany({
      where: { projectId },
      include: {
        TakeoffLineItem: {
          where: {
            OR: [
              { category: { contains: 'concrete', mode: 'insensitive' } },
              { category: { contains: 'roofing', mode: 'insensitive' } },
              { category: { contains: 'siding', mode: 'insensitive' } },
              { category: { contains: 'exterior', mode: 'insensitive' } },
              { category: { contains: 'masonry', mode: 'insensitive' } },
            ],
          },
          select: { itemName: true, category: true, material: true, description: true },
          take: 10,
        },
      },
      take: 5,
    });

    const windowAggregate = await prisma.windowScheduleItem.count({
      where: { projectId },
    });

    const roomCount = await prisma.room.count({
      where: { projectId },
    });

    const maxFloor = await prisma.room.findMany({
      where: { projectId, floorNumber: { not: null } },
      select: { floorNumber: true },
      orderBy: { floorNumber: 'desc' },
      take: 1,
    });

    const exteriorMaterials = takeoffs.flatMap(t =>
      t.TakeoffLineItem.map(li => ({
        name: li.itemName,
        category: li.category,
        material: li.material,
      }))
    );

    // Gather structured data from document chunks (vision metadata)
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          projectId,
          fileType: 'pdf',
        },
        // @ts-expect-error strictNullChecks migration
        metadata: { not: null },
      },
      select: { metadata: true },
      take: 20,
    });

    const visionExtractedData: Record<string, any> = {
      facadeMaterials: [],
      roofDetails: [],
      landscaping: [],
    };

    for (const chunk of chunks) {
      const meta = chunk.metadata as Record<string, any> | null;
      if (!meta) continue;

      // Exterior elevation data
      const elevData = meta.specialDrawingData?.exteriorElevation;
      if (elevData?.facadeMaterials && Array.isArray(elevData.facadeMaterials)) {
        for (const facade of elevData.facadeMaterials) {
          if (facade.material) {
            visionExtractedData.facadeMaterials.push({
              material: facade.material,
              finish: facade.finish,
              location: facade.location,
            });
          }
        }
      }

      // Roof data
      const roofData = meta.specialDrawingData?.roofData;
      if (roofData) {
        visionExtractedData.roofDetails.push({
          type: roofData.roofType,
          material: roofData.material,
          pitch: roofData.pitch,
        });
      }

      // Landscape data
      const landscape = meta.siteAndConcrete?.landscapeData;
      if (landscape) {
        if (landscape.plantSchedule && Array.isArray(landscape.plantSchedule)) {
          const plants = landscape.plantSchedule
            .filter((p: any) => p.species)
            .map((p: any) => ({ species: p.species, quantity: p.quantity }));
          visionExtractedData.landscaping.push(...plants);
        }
        if (landscape.hardscape && Array.isArray(landscape.hardscape)) {
          for (const h of landscape.hardscape) {
            if (h.material) {
              visionExtractedData.landscaping.push({
                type: h.type || 'hardscape',
                material: h.material,
                finish: h.finish,
              });
            }
          }
        }
      }
    }

    // Build result fields object
    const fields = {
      architecturalStyle: project.architecturalStyle,
      buildingUse: project.buildingUse,
      stories: project.stories || (maxFloor[0]?.floorNumber ?? null),
      roofType: project.roofType,
      roofMaterial: project.roofMaterial,
      exteriorMaterials: project.exteriorMaterials,
      exteriorColorPalette: project.exteriorColorPalette,
      siteContext: project.siteContext,
      locationCity: project.locationCity,
      locationState: project.locationState,
      landscapingNotes: project.landscapingNotes,
      windowsSummary: undefined as string | undefined,
    };

    // Pull structured extraction data from document metadata to fill in missing fields
    try {
      for (const chunk of chunks) {
        const meta = chunk.metadata as Record<string, any> | null;
        if (!meta) continue;

        // Exterior elevation data → facade description
        const elevData = meta.specialDrawingData?.exteriorElevation;
        if (elevData) {
          if (elevData.facadeMaterials?.length > 0 && !fields.exteriorMaterials) {
            const facadeMaterialsText = elevData.facadeMaterials
              .map((f: any) => `${f.material}${f.location ? ` (${f.location})` : ''}`)
              .join('; ');
            fields.exteriorMaterials = facadeMaterialsText;
          }
          if (elevData.windowPattern && !fields.windowsSummary) {
            fields.windowsSummary = elevData.windowPattern;
          }
          if (elevData.storiesVisible && !fields.stories) {
            fields.stories = typeof elevData.storiesVisible === 'number' ? elevData.storiesVisible : parseInt(elevData.storiesVisible, 10) || null;
          }
        }

        // Roof data
        const roofData = meta.specialDrawingData?.roofData;
        if (roofData) {
          if (roofData.roofType && !fields.roofType) {
            fields.roofType = roofData.roofType;
          }
          if (roofData.material && !fields.roofMaterial) {
            fields.roofMaterial = roofData.material;
          }
        }

        // Landscape data
        const landscape = meta.siteAndConcrete?.landscapeData;
        if (landscape && !fields.landscapingNotes) {
          const landscapeParts: string[] = [];
          if (landscape.plantSchedule?.length > 0) {
            const plants = landscape.plantSchedule
              .filter((p: any) => p.species)
              .slice(0, 5)
              .map((p: any) => p.species);
            if (plants.length > 0) landscapeParts.push(`Plants: ${plants.join(', ')}`);
          }
          if (landscape.existingTrees?.length > 0) {
            const trees = landscape.existingTrees
              .filter((t: any) => t.species)
              .slice(0, 3)
              .map((t: any) => t.species);
            if (trees.length > 0) landscapeParts.push(`Trees: ${trees.join(', ')}`);
          }
          if (landscape.hardscape?.length > 0) {
            const hard = landscape.hardscape
              .filter((h: any) => h.material)
              .slice(0, 3)
              .map((h: any) => `${h.type || 'surface'}: ${h.material}`);
            if (hard.length > 0) landscapeParts.push(hard.join(', '));
          }
          if (landscapeParts.length > 0) {
            fields.landscapingNotes = landscapeParts.join('. ');
          }
        }
      }
    } catch (metaError) {
      // Non-blocking: metadata enrichment is supplementary
      log.warn('Failed to extract metadata for exterior data', { projectId, error: (metaError as Error).message });
    }

    return {
      architecturalStyle: fields.architecturalStyle,
      buildingUse: fields.buildingUse,
      stories: fields.stories,
      roofType: fields.roofType,
      roofMaterial: fields.roofMaterial,
      exteriorMaterials: fields.exteriorMaterials,
      exteriorColorPalette: fields.exteriorColorPalette,
      siteContext: fields.siteContext,
      locationCity: fields.locationCity,
      locationState: fields.locationState,
      landscapingNotes: fields.landscapingNotes,
      windowsSummary: fields.windowsSummary,
      takeoffMaterials: exteriorMaterials,
      windowCount: windowAggregate,
      roomCount,
      visionExtractedData: visionExtractedData.facadeMaterials.length > 0 || visionExtractedData.roofDetails.length > 0 || visionExtractedData.landscaping.length > 0
        ? visionExtractedData
        : undefined,
    };
  } catch (err) {
    log.error('Failed to gather exterior data', err, { projectId });
    return {};
  }
}

export async function gatherAerialData(projectId: string): Promise<Record<string, unknown>> {
  try {
    const exteriorData = await gatherExteriorData(projectId);

    const floorPlanCount = await prisma.floorPlan.count({
      where: { projectId },
    });

    const rooms = await prisma.room.findMany({
      where: { projectId, area: { not: null } },
      select: { area: true },
    });
    const totalArea = rooms.reduce((sum, r) => sum + (r.area || 0), 0);

    return {
      ...exteriorData,
      floorPlanCount,
      totalBuildingArea: totalArea > 0 ? totalArea : null,
    };
  } catch (err) {
    log.error('Failed to gather aerial data', err, { projectId });
    return {};
  }
}

export async function gatherCADData(projectId: string): Promise<Record<string, unknown> | null> {
  try {
    const models = await prisma.autodeskModel.findMany({
      where: { projectId, status: 'complete' },
      select: { extractedMetadata: true, fileName: true },
      take: 3,
    });

    if (models.length === 0) return null;

    const metadata = models
      .filter(m => m.extractedMetadata)
      .map(m => ({
        fileName: m.fileName,
        metadata: m.extractedMetadata,
      }));

    if (metadata.length === 0) return null;

    return { bimModels: metadata };
  } catch (err) {
    log.error('Failed to gather CAD data', err, { projectId });
    return null;
  }
}

// ── Color/Finish Extraction from Document Chunks ───────────────────────

export async function extractColorFinishFromChunks(projectId: string, roomName?: string): Promise<string> {
  try {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          projectId,
          fileType: 'pdf',
        },
        OR: COLOR_KEYWORDS.map(keyword => ({
          content: { contains: keyword, mode: 'insensitive' as const },
        })),
      },
      select: {
        content: true,
        metadata: true,
        Document: {
          select: { name: true, category: true },
        },
      },
      take: 10,
    });

    const colorInfo: string[] = [];

    for (const chunk of chunks) {
      for (const pattern of COLOR_PATTERNS) {
        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
        const matches = chunk.content.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length < 50) {
            colorInfo.push(match[0].trim());
          }
        }
      }
    }

    // Also extract structured data from vision metadata
    for (const chunk of chunks) {
      const meta = chunk.metadata as Record<string, any> | null;
      if (!meta) continue;

      // Visual materials (from hatching analysis)
      if (meta.visualMaterials && Array.isArray(meta.visualMaterials)) {
        for (const vm of meta.visualMaterials) {
          if (vm.material && vm.locations?.length > 0) {
            colorInfo.push(`${vm.material} (${vm.locations.join(', ')})`);
          }
        }
      }

      // Exterior elevation data
      const elevData = meta.specialDrawingData?.exteriorElevation;
      if (elevData?.facadeMaterials && Array.isArray(elevData.facadeMaterials)) {
        for (const facade of elevData.facadeMaterials) {
          if (facade.material) {
            const parts = [facade.material];
            if (facade.finish) parts.push(facade.finish);
            if (facade.location) parts.push(`at ${facade.location}`);
            colorInfo.push(parts.join(', '));
          }
        }
      }

      // Roof data
      const roofData = meta.specialDrawingData?.roofData;
      if (roofData?.material) {
        colorInfo.push(`Roof: ${roofData.material}${roofData.roofType ? ` (${roofData.roofType})` : ''}`);
      }

      // Landscape data
      const landscape = meta.siteAndConcrete?.landscapeData;
      if (landscape) {
        if (landscape.plantSchedule && Array.isArray(landscape.plantSchedule)) {
          const plantNames = landscape.plantSchedule
            .filter((p: any) => p.species)
            .map((p: any) => p.species)
            .slice(0, 5);
          if (plantNames.length > 0) {
            colorInfo.push(`Landscaping: ${plantNames.join(', ')}`);
          }
        }
        if (landscape.existingTrees && Array.isArray(landscape.existingTrees)) {
          const treeNames = landscape.existingTrees
            .filter((t: any) => t.species && t.toRemain)
            .map((t: any) => `${t.species}${t.caliper ? ` (${t.caliper})` : ''}`)
            .slice(0, 5);
          if (treeNames.length > 0) {
            colorInfo.push(`Existing trees: ${treeNames.join(', ')}`);
          }
        }
        if (landscape.hardscape && Array.isArray(landscape.hardscape)) {
          for (const h of landscape.hardscape) {
            if (h.material) {
              colorInfo.push(`Hardscape: ${h.type || 'surface'} - ${h.material}${h.finish ? `, ${h.finish}` : ''}`);
            }
          }
        }
      }
    }

    if (roomName) {
      const rooms = await prisma.room.findMany({
        where: {
          projectId,
          OR: [
            { name: { contains: roomName, mode: 'insensitive' } },
            { type: { contains: roomName, mode: 'insensitive' } },
          ],
        },
        include: {
          FinishScheduleItem: true,
        },
        take: 5,
      });

      for (const room of rooms) {
        if (room.FinishScheduleItem && room.FinishScheduleItem.length > 0) {
          for (const finish of room.FinishScheduleItem) {
            if (finish.category && finish.material) {
              colorInfo.push(`${finish.category}: ${finish.material}${finish.color ? ` (${finish.color})` : ''}`);
            } else if (finish.color) {
              colorInfo.push(`${finish.category || 'Finish'}: ${finish.color}`);
            }
          }
        }
      }
    }

    const uniqueInfo = [...new Set(colorInfo)].slice(0, 8);

    if (uniqueInfo.length > 0) {
      return `Color and finish specifications from plans: ${uniqueInfo.join(', ')}.`;
    }

    return '';
  } catch (err) {
    log.error('Error extracting color/finish info', err, { projectId, roomName });
    return '';
  }
}

// ── Style & View Builders ──────────────────────────────────────────────

export function buildStylePrefix(style: RenderStyle, constructionPhase?: string): string {
  let prefix = STYLE_PREFIXES[style] || STYLE_PREFIXES.photorealistic;

  if (style === 'construction_phase' && constructionPhase) {
    const phase = constructionPhase.toLowerCase();
    const details = CONSTRUCTION_PHASE_DETAILS[phase] || 'active construction activity';
    prefix = prefix.replace('{phase}', phase).replace('{phaseDetails}', details);
  } else if (style === 'construction_phase') {
    prefix = prefix.replace('{phase}', 'active construction').replace('{phaseDetails}', 'active construction activity');
  }

  return prefix;
}

export function buildViewSuffix(viewType: RenderViewType, cameraAngle?: CameraAngle): string {
  const viewDesc = VIEW_DESCRIPTIONS[viewType] || VIEW_DESCRIPTIONS.exterior;
  const angleDesc = cameraAngle ? CAMERA_ANGLE_DESCRIPTIONS[cameraAngle] : '';
  return angleDesc ? `${viewDesc} ${angleDesc}` : viewDesc;
}

// ── Data Completeness Calculation ──────────────────────────────────────

export async function calculateDataCompleteness(
  projectId: string,
  viewType: RenderViewType,
  roomId?: string
): Promise<{ score: number; items: DataCompletenessItem[] }> {
  const items: DataCompletenessItem[] = [];

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        architecturalStyle: true,
        buildingUse: true,
        stories: true,
        roofType: true,
        roofMaterial: true,
        exteriorMaterials: true,
        exteriorColorPalette: true,
        siteContext: true,
        landscapingNotes: true,
      },
    });

    // Architectural style
    items.push({
      label: 'Architectural Style',
      key: 'architecturalStyle',
      status: project?.architecturalStyle ? 'available' : 'missing',
      detail: project?.architecturalStyle || undefined,
    });

    // Exterior materials
    items.push({
      label: 'Exterior Materials',
      key: 'exteriorMaterials',
      status: project?.exteriorMaterials ? 'available' : 'missing',
    });

    // Color palette
    items.push({
      label: 'Color Palette',
      key: 'exteriorColorPalette',
      status: project?.exteriorColorPalette ? 'available' : 'missing',
    });

    // Roof type/material
    items.push({
      label: 'Roof Type & Material',
      key: 'roof',
      status: project?.roofType && project?.roofMaterial
        ? 'available'
        : project?.roofType || project?.roofMaterial
          ? 'partial'
          : 'missing',
    });

    // Landscaping notes
    items.push({
      label: 'Landscaping Notes',
      key: 'landscapingNotes',
      status: project?.landscapingNotes ? 'available' : 'missing',
    });

    // Site context
    items.push({
      label: 'Site Context',
      key: 'siteContext',
      status: project?.siteContext ? 'available' : 'missing',
    });

    // Room-specific checks for interior view
    if (viewType === 'interior' && roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { area: true },
      });

      items.push({
        label: 'Room Dimensions',
        key: 'roomDimensions',
        status: room?.area ? 'available' : 'missing',
      });

      const finishCount = await prisma.finishScheduleItem.count({
        where: { roomId },
      });
      items.push({
        label: 'Finish Schedule',
        key: 'finishSchedule',
        status: finishCount > 0 ? 'available' : 'missing',
        detail: finishCount > 0 ? `${finishCount} items` : undefined,
      });

      const doorCount = await prisma.doorScheduleItem.count({
        where: { roomId },
      });
      const windowCount = await prisma.windowScheduleItem.count({
        where: { roomId },
      });
      items.push({
        label: 'Door & Window Schedule',
        key: 'doorWindowSchedule',
        status: doorCount > 0 || windowCount > 0
          ? 'available'
          : 'missing',
        detail: doorCount > 0 || windowCount > 0
          ? `${doorCount} doors, ${windowCount} windows`
          : undefined,
      });

      const mepCount = await prisma.mEPEquipment.count({
        where: { projectId },
      });
      items.push({
        label: 'MEP Equipment',
        key: 'mepEquipment',
        status: mepCount > 0 ? 'available' : 'missing',
      });
    }

    // CAD/BIM model
    const cadCount = await prisma.autodeskModel.count({
      where: { projectId, status: 'complete' },
    });
    items.push({
      label: 'CAD/BIM Model',
      key: 'cadModel',
      status: cadCount > 0 ? 'available' : 'missing',
    });

    // Project photos
    const photoCount = await prisma.roomPhoto.count({
      where: { projectId },
    });
    items.push({
      label: 'Project Photos',
      key: 'projectPhotos',
      status: photoCount > 0 ? 'available' : 'missing',
      detail: photoCount > 0 ? `${photoCount} photos` : undefined,
    });

    // Calculate score
    const availableCount = items.filter(i => i.status === 'available').length;
    const partialCount = items.filter(i => i.status === 'partial').length;
    const total = items.length;
    const score = total > 0
      ? Math.round(((availableCount + partialCount * 0.5) / total) * 100)
      : 0;

    return { score, items };
  } catch (err) {
    log.error('Failed to calculate data completeness', err, { projectId });
    return { score: 0, items };
  }
}

// ── Prompt Body Builder ────────────────────────────────────────────────

function buildPromptBody(
  stylePrefix: string,
  viewSuffix: string,
  viewType: RenderViewType,
  data: Record<string, unknown>,
  userNotes?: string
): string {
  const sections: string[] = [];

  sections.push(stylePrefix);
  sections.push('');
  sections.push(viewSuffix);

  // Building description
  const buildingParts: string[] = [];
  if (data.stories) buildingParts.push(`${data.stories}-story`);
  if (data.architecturalStyle) buildingParts.push(String(data.architecturalStyle));
  if (data.buildingUse) buildingParts.push(String(data.buildingUse));
  if (buildingParts.length > 0) {
    sections.push('');
    sections.push(`BUILDING: ${buildingParts.join(' ')}`);
  }

  // Roof
  if (data.roofType || data.roofMaterial) {
    const roofParts = [data.roofType, data.roofMaterial].filter(Boolean);
    sections.push(`ROOF: ${roofParts.join(', ')}`);
  }

  // Exterior materials from project metadata
  if (data.exteriorMaterials && typeof data.exteriorMaterials === 'object') {
    const materials = data.exteriorMaterials as Record<string, unknown>;
    const materialLines = Object.entries(materials)
      .filter(([, v]) => v)
      .map(([k, v]) => `- ${k}: ${v}`);
    if (materialLines.length > 0) {
      sections.push('');
      sections.push('EXTERIOR MATERIALS:');
      sections.push(...materialLines);
    }
  }

  // Takeoff-derived materials
  if (Array.isArray(data.takeoffMaterials) && data.takeoffMaterials.length > 0) {
    const takeoffLines = data.takeoffMaterials
      .filter((m: Record<string, unknown>) => m.name || m.material)
      .map((m: Record<string, unknown>) => {
        const parts = [m.name, m.material].filter(Boolean);
        return `- ${parts.join(': ')}`;
      });
    if (takeoffLines.length > 0 && !data.exteriorMaterials) {
      sections.push('');
      sections.push('MATERIALS:');
      sections.push(...takeoffLines.slice(0, 6));
    }
  }

  // Color palette
  if (data.exteriorColorPalette && typeof data.exteriorColorPalette === 'object') {
    const palette = data.exteriorColorPalette as Record<string, unknown>;
    const colorParts = Object.entries(palette)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`);
    if (colorParts.length > 0) {
      sections.push('');
      sections.push(`COLOR PALETTE: ${colorParts.join(', ')}`);
    }
  }

  // Interior finishes (for room views)
  if (viewType === 'interior' && data.finishes && typeof data.finishes === 'object') {
    const finishes = data.finishes as Record<string, Record<string, unknown>>;
    const finishLines: string[] = [];
    for (const [cat, info] of Object.entries(finishes)) {
      const parts = [info.material, info.color, info.finishType].filter(Boolean);
      if (parts.length > 0) {
        finishLines.push(`- ${cat}: ${parts.join(', ')}`);
      }
    }
    if (finishLines.length > 0) {
      sections.push('');
      sections.push('FINISHES:');
      sections.push(...finishLines);
    }
  }

  // Room info
  if (viewType === 'interior' && data.roomName) {
    if (data.area) {
      sections.push('');
      sections.push(`ROOM: ${data.roomName} (${data.roomType || 'General'}), ${data.area} SF`);
    }
  }

  // Doors and windows
  const openingsLines: string[] = [];
  if (Array.isArray(data.doors) && data.doors.length > 0) {
    for (const d of data.doors as Record<string, unknown>[]) {
      const parts = [d.doorType, d.material].filter(Boolean);
      if (d.width && d.height) parts.push(`${d.width}x${d.height}`);
      if (d.glazing) parts.push(`glazed: ${d.glazing}`);
      openingsLines.push(`- Door ${d.doorNumber}: ${parts.join(', ')}`);
    }
  }
  if (Array.isArray(data.windows) && data.windows.length > 0) {
    for (const w of data.windows as Record<string, unknown>[]) {
      const parts = [w.windowType, w.frameMaterial].filter(Boolean);
      if (w.width && w.height) parts.push(`${w.width}x${w.height}`);
      openingsLines.push(`- Window ${w.windowNumber}: ${parts.join(', ')}`);
    }
  }
  if (data.windowCount && !Array.isArray(data.windows)) {
    openingsLines.push(`- ${data.windowCount} windows total`);
  }
  if (openingsLines.length > 0) {
    sections.push('');
    sections.push('OPENINGS:');
    sections.push(...openingsLines.slice(0, 8));
  }

  // MEP equipment (visible items)
  if (Array.isArray(data.mepEquipment) && data.mepEquipment.length > 0) {
    const eqLines = (data.mepEquipment as Record<string, unknown>[])
      .slice(0, 5)
      .map(e => `- ${e.name} (${e.type})${e.manufacturer ? `, ${e.manufacturer}` : ''}`);
    sections.push('');
    sections.push('FIXTURES & EQUIPMENT:');
    sections.push(...eqLines);
  }

  // Landscaping
  if (data.landscapingNotes) {
    sections.push('');
    sections.push(`LANDSCAPING: ${data.landscapingNotes}`);
  }

  // Site context
  if (data.siteContext) {
    sections.push('');
    sections.push(`SITE CONTEXT: ${data.siteContext}`);
  }

  // Location (generic — no exact addresses)
  if (data.locationCity || data.locationState) {
    const locParts = [data.locationCity, data.locationState].filter(Boolean);
    sections.push(`LOCATION: ${locParts.join(', ')}`);
  }

  // Aerial-specific
  if (viewType === 'aerial_site') {
    if (data.totalBuildingArea) {
      sections.push(`TOTAL BUILDING AREA: ${data.totalBuildingArea} SF`);
    }
    if (data.floorPlanCount) {
      sections.push(`FLOOR PLANS: ${data.floorPlanCount}`);
    }
  }

  // User notes
  if (userNotes) {
    sections.push('');
    sections.push(`ADDITIONAL CONTEXT: ${userNotes}`);
  }

  // Closing instructions
  sections.push('');
  sections.push(
    'INSTRUCTIONS: Professional architectural rendering. No text, labels, watermarks, or annotations in the image. Accurate proportions and realistic materials. This is an AI-generated visualization for design reference only.'
  );

  return sections.join('\n');
}

// ── Prompt Truncation ──────────────────────────────────────────────────

function truncatePrompt(prompt: string, stylePrefix: string, viewSuffix: string): string {
  const lines = prompt.split('\n');

  // Preserve the essential sections: style prefix, view, building, and closing instructions
  const essentialStart = [stylePrefix, '', viewSuffix];
  const closingLine = 'INSTRUCTIONS: Professional architectural rendering. No text, labels, watermarks, or annotations in the image. Accurate proportions and realistic materials. This is an AI-generated visualization for design reference only.';

  // Budget: max length minus essential start and closing
  const essentialLength = essentialStart.join('\n').length + closingLine.length + 4; // +4 for newlines
  const budget = MAX_PROMPT_LENGTH - essentialLength;

  // Collect middle sections up to budget
  const middleLines: string[] = [];
  let currentLength = 0;

  // Skip lines that are part of style prefix or view suffix (already counted)
  let pastPrefix = false;
  for (const line of lines) {
    if (!pastPrefix) {
      if (line === viewSuffix) {
        pastPrefix = true;
      }
      continue;
    }
    if (line.startsWith('INSTRUCTIONS:')) break;

    if (currentLength + line.length + 1 <= budget) {
      middleLines.push(line);
      currentLength += line.length + 1;
    }
  }

  return [...essentialStart, ...middleLines, '', closingLine].join('\n');
}
