/**
 * Volume Calculator API
 * Calculates concrete, aggregate, and backfill volumes with costs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  calculateConcreteVolume,
  calculateAggregateVolume,
  calculateBackfillVolume,
  generateVolumeSummary,
  slabVolumeCY,
  footingVolumeCY,
  aggregateVolumeCY,
  cyToTons,
  ConcreteVolumeInput,
  AggregateVolumeInput,
  BackfillVolumeInput,
} from '@/lib/volume-calculator';

// POST: Calculate volumes
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { calculationType, region = 'morehead-ky' } = body;
    
    switch (calculationType) {
      case 'concrete': {
        const input: ConcreteVolumeInput = body.input;
        if (!input?.elementType || !input?.dimensions) {
          return NextResponse.json({ error: 'Missing elementType or dimensions' }, { status: 400 });
        }
        const result = calculateConcreteVolume(input, region);
        return NextResponse.json({ success: true, result });
      }
      
      case 'aggregate': {
        const input: AggregateVolumeInput = body.input;
        if (!input?.materialType || !input?.dimensions) {
          return NextResponse.json({ error: 'Missing materialType or dimensions' }, { status: 400 });
        }
        const result = calculateAggregateVolume(input, region);
        return NextResponse.json({ success: true, result });
      }
      
      case 'backfill': {
        const input: BackfillVolumeInput = body.input;
        if (!input?.excavationVolumeCY || !input?.materialType) {
          return NextResponse.json({ error: 'Missing excavationVolumeCY or materialType' }, { status: 400 });
        }
        const result = calculateBackfillVolume(input, region);
        return NextResponse.json({ success: true, result });
      }
      
      case 'quick-slab': {
        const { areaSF, thicknessInches, wastePercent = 5 } = body;
        if (!areaSF || !thicknessInches) {
          return NextResponse.json({ error: 'Missing areaSF or thicknessInches' }, { status: 400 });
        }
        const volumeCY = slabVolumeCY(areaSF, thicknessInches, wastePercent);
        return NextResponse.json({ success: true, volumeCY });
      }
      
      case 'quick-footing': {
        const { lengthFt, widthFt, depthFt, quantity = 1, wastePercent = 5 } = body;
        if (!lengthFt || !widthFt || !depthFt) {
          return NextResponse.json({ error: 'Missing footing dimensions' }, { status: 400 });
        }
        const volumeCY = footingVolumeCY(lengthFt, widthFt, depthFt, quantity, wastePercent);
        return NextResponse.json({ success: true, volumeCY });
      }
      
      case 'quick-aggregate': {
        const { areaSF, thicknessInches, compactionFactor = 1.10, wastePercent = 8 } = body;
        if (!areaSF || !thicknessInches) {
          return NextResponse.json({ error: 'Missing areaSF or thicknessInches' }, { status: 400 });
        }
        const volumeCY = aggregateVolumeCY(areaSF, thicknessInches, compactionFactor, wastePercent);
        const tons = cyToTons(volumeCY, body.material || 'dga');
        return NextResponse.json({ success: true, volumeCY, tons });
      }
      
      case 'summary': {
        const { concreteInputs = [], aggregateInputs = [], earthworkInputs = [] } = body;
        const result = generateVolumeSummary(concreteInputs, aggregateInputs, earthworkInputs, region);
        return NextResponse.json({ success: true, result });
      }
      
      default:
        return NextResponse.json({ error: 'Invalid calculationType' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Volume Calculator API Error]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Return available calculation types and material options
export async function GET() {
  return NextResponse.json({
    calculationTypes: [
      'concrete',
      'aggregate', 
      'backfill',
      'quick-slab',
      'quick-footing',
      'quick-aggregate',
      'summary'
    ],
    concreteElementTypes: [
      'slab', 'slab-on-grade', 'footing', 'spread-footing', 'grade-beam',
      'foundation-wall', 'column-rect', 'column-round', 'pier', 'beam',
      'curb-gutter', 'sidewalk'
    ],
    aggregateMaterialTypes: [
      { key: 'dga', name: 'Dense Grade Aggregate (DGA)', densityTonsPerCY: 1.4 },
      { key: 'crusher-run', name: 'Crusher Run', densityTonsPerCY: 1.35 },
      { key: 'aggregate-base', name: 'Aggregate Base Course (ABC)', densityTonsPerCY: 1.35 },
      { key: 'stone-57', name: '#57 Stone (3/4"-1")', densityTonsPerCY: 1.3 },
      { key: 'stone-2', name: '#2 Stone (2.5"-3")', densityTonsPerCY: 1.25 },
      { key: 'stone-3', name: '#3 Stone (1.5"-2.5")', densityTonsPerCY: 1.28 },
      { key: 'pea-gravel', name: 'Pea Gravel (3/8")', densityTonsPerCY: 1.35 },
      { key: 'rip-rap', name: 'Rip-Rap', densityTonsPerCY: 1.5 },
      { key: 'topsoil', name: 'Topsoil', densityTonsPerCY: 1.1 },
      { key: 'sand', name: 'Sand', densityTonsPerCY: 1.35 },
      { key: 'select-fill', name: 'Select/Structural Fill', densityTonsPerCY: 1.4 },
    ],
    backfillMaterialTypes: [
      { key: 'on-site', name: 'On-Site Material', shrinkage: 0.90 },
      { key: 'select', name: 'Select Fill', shrinkage: 0.92 },
      { key: 'structural', name: 'Structural Fill', shrinkage: 0.95 },
      { key: 'pipe-zone', name: 'Pipe Zone Bedding', shrinkage: 0.95 },
    ],
    examples: {
      concrete: {
        calculationType: 'concrete',
        input: {
          elementType: 'slab',
          dimensions: { area: 10000, thicknessInches: 4 },
          wasteFactorPercent: 5
        },
        region: 'morehead-ky'
      },
      aggregate: {
        calculationType: 'aggregate',
        input: {
          materialType: 'dga',
          dimensions: { area: 5000, thicknessInches: 6 },
          wasteFactorPercent: 8
        }
      },
      backfill: {
        calculationType: 'backfill',
        input: {
          excavationType: 'footing',
          excavationVolumeCY: 150,
          concreteVolumeCY: 80,
          materialType: 'select'
        }
      },
      quickSlab: {
        calculationType: 'quick-slab',
        areaSF: 10000,
        thicknessInches: 4,
        wastePercent: 5
      },
      quickAggregate: {
        calculationType: 'quick-aggregate',
        areaSF: 5000,
        thicknessInches: 6,
        material: 'dga'
      }
    }
  });
}
