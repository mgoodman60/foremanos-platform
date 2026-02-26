import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { analyzeScheduleHealth, applyAutoFix } from '@/lib/schedule-health-analyzer';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_SCHEDULE_HEALTH');

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const report = await analyzeScheduleHealth(slug);

    return NextResponse.json(report);
  } catch (error) {
    logger.error('Error analyzing schedule health', error);
    return NextResponse.json(
      { error: 'Failed to analyze schedule health' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { action, issueId } = await req.json();

    if (action === 'auto-fix' && issueId) {
      const result = await applyAutoFix(slug, issueId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Error applying schedule fix', error);
    return NextResponse.json(
      { error: 'Failed to apply fix' },
      { status: 500 }
    );
  }
}
