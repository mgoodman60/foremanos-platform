/**
 * API Route: POST /api/projects/[slug]/classify-drawings
 * Classify all drawings in a project
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { classifyProjectDrawings } from '@/lib/drawing-classifier';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_CLASSIFY_DRAWINGS');

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { slug } = params;
    const body = await req.json();
    const { forceReprocess = false, useVision = false } = body;
    
    logger.info('[classify-drawings] Starting classification for project', { slug });
    logger.info('[classify-drawings] Options', { forceReprocess, useVision });
    
    // Classify all drawings
    const results = await classifyProjectDrawings(slug, {
      forceReprocess,
      useVision
    });
    
    logger.info('[classify-drawings] Classification complete', { count: results.length });
    
    // Calculate statistics
    const stats = {
      total: results.length,
      byType: {} as Record<string, number>,
      bySubtype: {} as Record<string, number>,
      averageConfidence: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0
    };
    
    let totalConfidence = 0;
    
    for (const result of results) {
      const { type, subtype, confidence } = result.classification;
      
      // Count by type
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      // Count by subtype
      stats.bySubtype[subtype] = (stats.bySubtype[subtype] || 0) + 1;
      
      // Track confidence levels
      totalConfidence += confidence;
      if (confidence >= 0.8) stats.highConfidence++;
      else if (confidence >= 0.5) stats.mediumConfidence++;
      else stats.lowConfidence++;
    }
    
    stats.averageConfidence = results.length > 0 ? totalConfidence / results.length : 0;
    
    return NextResponse.json({
      success: true,
      results,
      stats,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[classify-drawings] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to classify drawings',
        details: safeErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
