/**
 * Voice Transcription API for Daily Reports
 * Converts voice recordings to structured report content
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { transcribeVoiceToReport } from '@/lib/daily-report-enhancements';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findFirst({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
    console.error('[Voice API] Error:', error);
    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}
