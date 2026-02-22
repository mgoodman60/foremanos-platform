/**
 * Takeoff Cost Calculation API
 * 
 * POST - Apply auto-calculated costs to takeoff line items
 * GET - Get cost summary for a takeoff
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { calculateTakeoffCosts, applyCalculatedCosts } from '@/lib/cost-calculation-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_CALCULATE');

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const takeoffId = params.id;
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || 'default';

    const summary = await calculateTakeoffCosts(takeoffId, region);

    return NextResponse.json(summary);
  } catch (error: unknown) {
    logger.error('[Calculate API] GET error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errMsg || 'Failed to calculate costs' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const takeoffId = params.id;
    const body = await request.json();
    const region = body.region || 'default';

    // Apply calculated costs to items without existing prices
    const result = await applyCalculatedCosts(takeoffId, region);

    // Get updated summary
    const summary = await calculateTakeoffCosts(takeoffId, region);

    return NextResponse.json({
      success: true,
      updated: result.updated,
      skipped: result.skipped,
      summary,
    });
  } catch (error: unknown) {
    logger.error('[Calculate API] POST error', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: errMsg || 'Failed to apply costs' },
      { status: 500 }
    );
  }
}
