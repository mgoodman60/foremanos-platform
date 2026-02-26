/**
 * Predictive Scheduling API
 * Handles schedule predictions and risk analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  runFullSchedulePrediction,
  getProjectPredictions,
  analyzeProjectRisks,
  recordActualOutcome,
} from '@/lib/predictive-scheduling';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PREDICTIONS');

/**
 * GET /api/projects/[slug]/predictions
 * Get predictions and risks for a project
 */
export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 20;

    if (action === 'risks') {
      const risks = await analyzeProjectRisks(project.id);
      return NextResponse.json({ success: true, risks });
    }

    const predictions = await getProjectPredictions(project.id, { limit });

    return NextResponse.json({
      success: true,
      predictions,
      total: predictions.length,
    });
  } catch (error) {
    logger.error('GET error', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[slug]/predictions
 * Generate a new schedule prediction
 */
export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { targetDate, taskDescription, action, predictionId, actualDate } = body;

    // Record actual outcome for model training
    if (action === 'recordOutcome' && predictionId && actualDate) {
      await recordActualOutcome(predictionId, new Date(actualDate));
      return NextResponse.json({
        success: true,
        message: 'Outcome recorded for model training',
      });
    }

    // Run full prediction
    const { predictionId: newPredictionId, result, risks } = await runFullSchedulePrediction(
      project.id,
      targetDate ? new Date(targetDate) : undefined,
      taskDescription
    );

    return NextResponse.json({
      success: true,
      predictionId: newPredictionId,
      prediction: {
        ...result,
        predictedCompletionDate: result.predictedCompletionDate.toISOString(),
      },
      risks,
    });
  } catch (error) {
    logger.error('POST error', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}
