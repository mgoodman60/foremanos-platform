/**
 * Quantity Calculations API
 * 
 * GET /api/conversations/[id]/calculations
 * Retrieve all calculations for a conversation
 * 
 * POST /api/conversations/[id]/calculations
 * Add or update calculations with actions:
 *   - 'calculate': Trigger new calculation
 *   - 'confirm': User confirms a calculation
 *   - 'adjust': User adjusts a calculation
 *   - 'reject': User rejects a calculation
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('CONVERSATIONS_CALCULATIONS');
// Note: Old quantity-calculator feature has been deprecated
// Use the new Material Takeoff system instead:
// - Create takeoff: POST /api/projects/[slug]/takeoffs
// - Extract from document: POST /api/documents/[id]/extract-quantities
// - View takeoffs: GET /api/projects/[slug]/takeoffs

// type QuantityCalculation = any; // Deprecated - removed unused type

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      calculations: conversation.quantityCalculations || [],
      pending: conversation.calculationsPending,
    });
  } catch (error) {
    logger.error('Error fetching calculations', error);
    return NextResponse.json(
      { error: 'Failed to fetch calculations' },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  // This endpoint has been deprecated
  // Use the new Material Takeoff system instead
  return NextResponse.json({
    error: 'This endpoint has been deprecated',
    message: 'Please use the new Material Takeoff system:',
    endpoints: {
      'Create Takeoff': 'POST /api/projects/[slug]/takeoffs',
      'Extract Quantities': 'POST /api/documents/[id]/extract-quantities',
      'List Takeoffs': 'GET /api/projects/[slug]/takeoffs'
    }
  }, { status: 410 }); // 410 Gone
}