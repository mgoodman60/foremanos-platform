/**
 * Unit Price Management API
 * 
 * GET - List all unit prices for a project
 * POST - Create or update a unit price
 * DELETE - Remove a unit price
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { saveUnitPrice, getProjectUnitPrices, DEFAULT_UNIT_PRICES, REGIONAL_MULTIPLIERS } from '@/lib/cost-calculation-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'default';
    const includeDefaults = searchParams.get('includeDefaults') === 'true';

    // Get project-specific prices
    const projectPrices = await getProjectUnitPrices(project.id, region);

    // Optionally include default prices
    const defaultPrices: any[] = [];
    if (includeDefaults) {
      const multiplier = REGIONAL_MULTIPLIERS[region] || 1.0;
      
      for (const [category, subCategories] of Object.entries(DEFAULT_UNIT_PRICES)) {
        for (const [subCategory, prices] of Object.entries(subCategories)) {
          // Check if there's a project override
          const hasOverride = projectPrices.some(
            p => p.category.toLowerCase() === category && 
                 p.subCategory?.toLowerCase() === subCategory
          );
          
          if (!hasOverride) {
            defaultPrices.push({
              id: `default-${category}-${subCategory}`,
              category,
              subCategory,
              unit: getDefaultUnit(category, subCategory),
              unitCost: prices.unitCost * multiplier,
              laborRate: prices.laborRate * multiplier,
              source: 'default',
              isProjectSpecific: false,
              isDefault: true,
            });
          }
        }
      }
    }

    return NextResponse.json({
      projectPrices,
      defaultPrices,
      regions: Object.keys(REGIONAL_MULTIPLIERS),
      currentRegion: region,
    });
  } catch (error: any) {
    console.error('[UnitPrices API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { category, subCategory, unit, unitCost, laborRate, region, supplier, notes } = body;

    if (!category || !unit || typeof unitCost !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: category, unit, unitCost' },
        { status: 400 }
      );
    }

    const result = await saveUnitPrice(
      {
        projectId: project.id,
        category,
        subCategory: subCategory || null,
        unit,
        unitCost,
        laborRate: laborRate || null,
        region: region || 'default',
        supplier: supplier || null,
        source: 'manual',
        notes: notes || null,
      },
      session.user.id
    );

    return NextResponse.json({
      success: true,
      id: result.id,
      created: result.created,
    });
  } catch (error: any) {
    console.error('[UnitPrices API] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save price' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const priceId = searchParams.get('id');

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID required' }, { status: 400 });
    }

    await prisma.unitPrice.delete({
      where: { id: priceId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[UnitPrices API] DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete price' },
      { status: 500 }
    );
  }
}

// Helper to get default unit for a category
function getDefaultUnit(category: string, subCategory: string): string {
  const unitMap: Record<string, Record<string, string>> = {
    'concrete': { 'slab-on-grade': 'CY', 'footings': 'CY', 'foundation-walls': 'CY', 'columns': 'CY', 'beams': 'CY', 'elevated-slab': 'CY', 'curbs': 'LF', 'formwork': 'SFCA' },
    'rebar': { 'rebar-light': 'TON', 'rebar-heavy': 'TON', 'wwf': 'SF', 'dowels': 'EA' },
    'masonry': { 'cmu': 'SF', 'brick': 'SF', 'grout': 'CF' },
    'steel': { 'wide-flange': 'TON', 'tube-steel': 'TON', 'angles': 'LF', 'channels': 'LF', 'metal-deck': 'SF', 'misc-steel': 'LBS' },
    'lumber': { 'studs': 'LF', 'joists': 'LF', 'rafters': 'LF', 'trusses': 'EA', 'beams': 'LF', 'sheathing': 'SF', 'blocking': 'LF' },
    'hvac': { 'ductwork-rect': 'LBS', 'ductwork-round': 'LF', 'diffusers': 'EA', 'ahu': 'EA', 'vav': 'EA', 'exhaust-fans': 'EA', 'insulation-mech': 'SF' },
    'plumbing': { 'copper-pipe': 'LF', 'pvc-pipe': 'LF', 'cast-iron': 'LF', 'fixtures': 'EA', 'water-heater': 'EA', 'valves': 'EA', 'pipe-insulation': 'LF' },
    'electrical': { 'conduit': 'LF', 'wire': 'LF', 'receptacles': 'EA', 'switches': 'EA', 'panels': 'EA', 'lighting': 'EA', 'fire-alarm': 'EA' },
  };
  
  return unitMap[category]?.[subCategory] || 'EA';
}
