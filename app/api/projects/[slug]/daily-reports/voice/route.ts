/**
 * Voice Transcription API for Daily Reports
 * Converts voice recordings to structured report content
 */

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { transcribeVoiceToReport } from '@/lib/daily-report-enhancements';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_DAILY_REPORTS_VOICE');

export async function POST(request: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check membership — REPORTER+ can use voice
    const { getDailyReportRole, canCreateReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canCreateReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { audioBase64, currentReport } = body;

    if (!audioBase64) {
      return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
    }

    const result = await transcribeVoiceToReport(audioBase64, currentReport || {});

    return NextResponse.json({
      success: true,
      transcription: result.transcription,
      structured: result.structured,
    });
  } catch (error) {
    logger.error('[Voice API] Error', error);
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}
