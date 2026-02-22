import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { TradeType } from '@prisma/client';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_BUDGET_AUTO_ASSIGN_TRADES');

// Mapping of keywords to trade types based on CSI divisions
const TRADE_KEYWORD_MAP: Record<TradeType, string[]> = {
  general_contractor: [
    'mobilization', 'demobilization', 'superintendent', 'supervision',
    'general conditions', 'temporary', 'permits', 'fees', 'insurance',
    'builders risk', 'cleaning', 'dumpster', 'toilet', 'office trailer',
    'connex', 'tools', 'supplies', 'warranty', 'punchlist', 'bond',
    'overhead', 'profit', 'contingency', 'general', 'project manager',
  ],
  site_utilities: [
    'site', 'grading', 'excavation', 'earthwork', 'backfill', 'survey',
    'staking', 'geotech', 'boring', 'storm', 'sanitary', 'utility',
    'water main', 'sewer', 'underground', 'detention', 'retention',
    'paving', 'asphalt', 'concrete drive', 'curb', 'sidewalk', 'parking',
    'landscaping', 'erosion', 'silt fence', 'stone', 'aggregate',
  ],
  concrete_masonry: [
    'concrete', 'masonry', 'block', 'brick', 'foundation', 'footer',
    'slab', 'precast', 'tilt', 'rebar', 'reinforcing', 'formwork',
    'cmu', 'grout', 'cast-in-place', 'pour', 'flatwork',
  ],
  structural_steel: [
    'steel', 'structural', 'metal building', 'pemb', 'joist', 'deck',
    'erection', 'welding', 'anchor', 'column', 'beam', 'girder',
    'truss', 'bar joist', 'metal deck',
  ],
  carpentry_framing: [
    'carpentry', 'framing', 'rough carpentry', 'finish carpentry',
    'wood', 'lumber', 'millwork', 'casework', 'cabinet', 'trim',
    'door frame', 'blocking', 'sheathing', 'subfloor',
  ],
  drywall_finishes: [
    'drywall', 'gypsum', 'sheetrock', 'stud', 'metal stud', 'framing',
    'insulation', 'batt', 'acoustic', 'ceiling', 'act', 'grid',
    'tape', 'texture', 'finish', 'interior',
  ],
  roofing: [
    'roof', 'roofing', 'shingle', 'membrane', 'tpo', 'epdm',
    'standing seam', 'flashing', 'gutter', 'downspout', 'soffit',
    'fascia', 'skylight', 'waterproof',
  ],
  glazing_windows: [
    'window', 'glass', 'glazing', 'storefront', 'curtain wall',
    'door', 'hollow metal', 'hardware', 'entrance', 'overhead door',
    'coiling', 'roll-up', 'automatic',
  ],
  painting_coating: [
    'paint', 'painting', 'coating', 'stain', 'wallcover', 'primer',
    'epoxy', 'sealant', 'caulk', 'fireproofing',
  ],
  flooring: [
    'floor', 'flooring', 'tile', 'carpet', 'vct', 'lvt', 'vinyl',
    'terrazzo', 'epoxy floor', 'polish', 'stained concrete',
    'base', 'rubber base', 'transition',
  ],
  plumbing: [
    'plumb', 'plumbing', 'pipe', 'piping', 'fixture', 'water heater',
    'toilet', 'lavatory', 'sink', 'faucet', 'valve', 'backflow',
    'domestic water', 'sanitary', 'drain', 'vent', 'gas', 'medical gas',
  ],
  hvac_mechanical: [
    'hvac', 'mechanical', 'air conditioning', 'heating', 'cooling',
    'ductwork', 'ahu', 'rtu', 'vav', 'diffuser', 'grille',
    'exhaust', 'ventilation', 'controls', 'thermostat', 'chiller',
    'boiler', 'pump', 'fan', 'coil',
  ],
  electrical: [
    'electric', 'electrical', 'wire', 'wiring', 'conduit', 'panel',
    'breaker', 'switch', 'outlet', 'receptacle', 'lighting', 'light',
    'fixture', 'generator', 'transformer', 'meter', 'service',
    'fire alarm', 'low voltage', 'data', 'telecom', 'security',
    'access control', 'av', 'audio', 'video', 'ecomm',
  ],
};

function classifyItemToTrade(name: string, costCode?: string): TradeType | null {
  const searchText = `${name} ${costCode || ''}`.toLowerCase();
  
  for (const [tradeType, keywords] of Object.entries(TRADE_KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return tradeType as TradeType;
      }
    }
  }
  
  return null;
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

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        ProjectBudget: {
          include: {
            BudgetItem: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.ProjectBudget) {
      return NextResponse.json({ error: 'No budget found' }, { status: 404 });
    }

    const results = {
      assigned: 0,
      skipped: 0,
      byTrade: {} as Record<string, number>,
    };

    // Process each budget item
    for (const item of project.ProjectBudget.BudgetItem) {
      // Skip if already assigned
      if (item.tradeType) {
        results.skipped++;
        continue;
      }

      const tradeType = classifyItemToTrade(item.name, item.costCode || undefined);
      
      if (tradeType) {
        await prisma.budgetItem.update({
          where: { id: item.id },
          data: { tradeType },
        });
        
        results.assigned++;
        results.byTrade[tradeType] = (results.byTrade[tradeType] || 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Auto-assigned ${results.assigned} items to trades`,
    });
  } catch (error: unknown) {
    logger.error('Error auto-assigning trades', error);
    return NextResponse.json(
      { error: 'Failed to auto-assign trades' },
      { status: 500 }
    );
  }
}
