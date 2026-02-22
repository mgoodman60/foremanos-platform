/**
 * Dynamic Pricing API
 * 
 * POST: Initiate price search for all materials
 * PUT: Apply selected price updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  initiatePriceUpdateSession,
  applyPriceUpdates,
  searchMaterialPrices,
  generatePriceComparisonReport,
  PriceUpdateSession
} from '@/lib/dynamic-pricing-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PRICING');

export const maxDuration = 120; // 2 minutes for price searching

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { action, items } = body;

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (action === 'search') {
      // Initiate full price search session
      logger.info('Initiating price search for project', { slug });
      const session = await initiatePriceUpdateSession(slug);
      
      return NextResponse.json({
        success: true,
        session,
        message: `Found pricing data for ${session.itemsToUpdate.length} items`
      });
    }

    if (action === 'search-selected' && items?.length > 0) {
      // Search prices for specific items only
      logger.info('Searching prices for selected items', { count: items.length });
      
      const results = await searchMaterialPrices(items, {
        city: project.locationCity || undefined,
        state: project.locationState || undefined,
        zip: project.locationZip || undefined
      });

      return NextResponse.json({
        success: true,
        results,
        projectLocation: {
          city: project.locationCity,
          state: project.locationState,
          zip: project.locationZip
        }
      });
    }

    if (action === 'export-report') {
      // Generate price comparison report
      const sessionData = body.session as PriceUpdateSession;
      const report = generatePriceComparisonReport(sessionData);
      
      return NextResponse.json({
        success: true,
        report,
        format: 'markdown'
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error', error);
    return NextResponse.json(
      { error: 'Failed to process pricing request' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'No price updates provided' },
        { status: 400 }
      );
    }

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Apply the price updates
    logger.info('Applying price updates', { count: updates.length });
    const result = await applyPriceUpdates(project.id, updates);

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: (session.user as any).id,
        action: 'PRICE_UPDATE',
        resource: 'takeoff',
        resourceId: project.id,
        details: { message: `Updated prices for ${result.updated} items`, updatedCount: result.updated, failedCount: result.failed }
      }
    });

    return NextResponse.json({
      success: true,
      updated: result.updated,
      failed: result.failed,
      message: `Successfully updated ${result.updated} item prices`
    });
  } catch (error) {
    logger.error('Error applying updates', error);
    return NextResponse.json(
      { error: 'Failed to apply price updates' },
      { status: 500 }
    );
  }
}
