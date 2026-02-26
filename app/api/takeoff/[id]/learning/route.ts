/**
 * Phase 9: Takeoff Learning System API
 * 
 * Handles feedback, corrections, patterns, and suggestions for improving takeoff accuracy.
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  submitFeedback,
  submitCorrection,
  applyCorrection,
  rejectCorrection,
  getLearningStats,
  getPendingCorrections,
  generateSuggestions,
  getLearnedPatterns,
  deletePattern,
  getRecentFeedback,
  resolveFeedback,
  bulkApplySuggestions,
  getLearningSystemSummary,
} from '@/lib/takeoff-learning-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_LEARNING');

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summary';
    const takeoffId = params.id;

    switch (action) {
      case 'summary': {
        const summary = await getLearningSystemSummary(takeoffId);
        return NextResponse.json(summary);
      }

      case 'stats': {
        const stats = await getLearningStats(takeoffId);
        return NextResponse.json(stats);
      }

      case 'corrections': {
        const result = await getPendingCorrections(takeoffId);
        return NextResponse.json(result);
      }

      case 'suggestions': {
        const suggestions = await generateSuggestions(takeoffId);
        return NextResponse.json({ suggestions });
      }

      case 'patterns': {
        const category = searchParams.get('category') || undefined;
        const patterns = await getLearnedPatterns(category);
        return NextResponse.json({ patterns });
      }

      case 'feedback': {
        const limit = parseInt(searchParams.get('limit') || '20');
        const feedback = await getRecentFeedback(takeoffId, limit);
        return NextResponse.json({ feedback });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('[Learning API] GET Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action;
    const takeoffId = params.id;
    const userId = session.user.id as string;

    switch (action) {
      case 'submit-feedback': {
        const result = await submitFeedback({
          takeoffId,
          lineItemId: body.lineItemId,
          userId,
          feedbackType: body.feedbackType,
          rating: body.rating,
          comment: body.comment,
          context: body.context,
        });
        return NextResponse.json(result);
      }

      case 'submit-correction': {
        const result = await submitCorrection({
          takeoffId,
          lineItemId: body.lineItemId,
          userId,
          fieldName: body.fieldName,
          originalValue: body.originalValue,
          correctedValue: body.correctedValue,
          reason: body.reason,
        });
        return NextResponse.json(result);
      }

      case 'apply-correction': {
        const result = await applyCorrection(
          body.correctionId,
          userId,
          body.createPattern ?? false
        );
        return NextResponse.json(result);
      }

      case 'reject-correction': {
        const result = await rejectCorrection(body.correctionId, userId);
        return NextResponse.json(result);
      }

      case 'resolve-feedback': {
        const result = await resolveFeedback(body.feedbackId, userId);
        return NextResponse.json(result);
      }

      case 'delete-pattern': {
        const result = await deletePattern(body.patternId);
        return NextResponse.json(result);
      }

      case 'bulk-apply-suggestions': {
        const result = await bulkApplySuggestions(body.suggestions, userId);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('[Learning API] POST Error', error);
    return NextResponse.json(
      { error: 'Failed to process learning action' },
      { status: 500 }
    );
  }
}
