/**
 * Daily Report Carryover API
 * Gets yesterday's data to pre-populate today's report
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getYesterdayCarryover } from '@/lib/daily-report-enhancements';

export async function GET(
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

    const carryover = await getYesterdayCarryover(project.id);

    if (!carryover) {
      return NextResponse.json({
        success: true,
        carryover: null,
        message: 'No previous report found',
      });
    }

    return NextResponse.json({
      success: true,
      carryover,
    });
  } catch (error) {
    console.error('[Carryover API] Error:', error);
    return NextResponse.json({ error: 'Failed to get carryover data' }, { status: 500 });
  }
}
