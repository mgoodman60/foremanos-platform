/**
 * API Route: GET /api/projects/[slug]/drawing-types
 * Get drawing type classifications for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { safeErrorMessage } from '@/lib/api-error';
import {
  getProjectDrawingTypes,
  getDrawingTypeStats,
  DrawingType,
  DrawingSubtype
} from '@/lib/drawing-classifier';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DRAWING_TYPES');

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { slug } = params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'list';
    
    if (action === 'stats') {
      // Get statistics
      const stats = await getDrawingTypeStats(slug);
      return NextResponse.json({
        success: true,
        stats
      });
    }
    
    if (action === 'list') {
      // Get filtered list
      const type = searchParams.get('type') as DrawingType | null;
      const subtype = searchParams.get('subtype') as DrawingSubtype | null;
      const minConfidence = searchParams.get('minConfidence');
      
      const filters: any = {};
      if (type) filters.type = type;
      if (subtype) filters.subtype = subtype;
      if (minConfidence) filters.minConfidence = parseFloat(minConfidence);
      
      const results = await getProjectDrawingTypes(slug, filters);
      
      return NextResponse.json({
        success: true,
        results,
        count: results.length
      });
    }
    
    if (action === 'summary') {
      // Get summary with all data
      const results = await getProjectDrawingTypes(slug);
      const stats = await getDrawingTypeStats(slug);
      
      return NextResponse.json({
        success: true,
        results,
        stats
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    logger.error('[drawing-types] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to get drawing types',
        details: safeErrorMessage(error)
      },
      { status: 500 }
    );
  }
}
