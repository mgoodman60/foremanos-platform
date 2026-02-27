import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { applyQuestionAnswer } from '@/lib/quality-question-applier';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(`api:${session.user.id}`, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const documentId = params.id;
    const questions = await prisma.qualityQuestion.findMany({
      where: { documentId },
      include: {
        chunk: { select: { sheetNumber: true, discipline: true } },
      },
      orderBy: [{ applied: 'asc' }, { createdAt: 'asc' }],
    });

    const totalPending = questions.filter(q => !q.applied).length;
    const totalAnswered = questions.filter(q => q.applied).length;

    return NextResponse.json({
      documentId,
      questions: questions.map(q => ({
        id: q.id,
        pageNumber: q.pageNumber,
        field: q.field,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        answer: q.answer,
        applied: q.applied,
        confidenceBefore: q.confidenceBefore,
        confidenceAfter: q.confidenceAfter,
        sheetNumber: q.chunk?.sheetNumber || null,
        discipline: q.chunk?.discipline || null,
      })),
      totalPending,
      totalAnswered,
    });
  } catch (error) {
    logger.error('QUALITY_QUESTIONS', 'Error fetching questions', error as Error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(`improve:${session.user.id}`, { maxRequests: 20, windowSeconds: 3600 });
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const { answers } = body;
    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: 'answers array required' }, { status: 400 });
    }

    const documentId = params.id;
    const results: { questionId: string; fieldUpdated: string; scoreBefore: number; scoreAfter: number }[] = [];

    for (const { questionId, answer } of answers) {
      if (!questionId || !answer) continue;
      try {
        const result = await applyQuestionAnswer(questionId, answer, session.user.id);
        results.push({
          questionId,
          fieldUpdated: result.fieldUpdated,
          scoreBefore: result.qualityBefore,
          scoreAfter: result.qualityAfter,
        });
      } catch (err: unknown) {
        logger.warn('QUALITY_QUESTIONS', `Failed to apply answer for ${questionId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Update pending question count
    const pendingCount = await prisma.qualityQuestion.count({
      where: { documentId, applied: false },
    });
    await prisma.document.update({
      where: { id: documentId },
      data: { pendingQuestionCount: pendingCount },
    });

    return NextResponse.json({
      applied: results.length,
      qualityImprovements: results,
    });
  } catch (error) {
    logger.error('QUALITY_QUESTIONS', 'Error applying answers', error as Error);
    return NextResponse.json({ error: 'Failed to apply answers' }, { status: 500 });
  }
}
