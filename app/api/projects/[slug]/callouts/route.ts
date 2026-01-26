import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { getProjectCallouts, getSheetCallouts, searchCallouts, getCalloutStats } from '@/lib/detail-callout-extractor';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const sheetNumber = searchParams.get('sheetNumber');
    const type = searchParams.get('type');
    const targetSheet = searchParams.get('targetSheet');
    const validOnly = searchParams.get('validOnly') === 'true';

    const project = await prisma.project.findUnique({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (action === 'list') {
      const result = await getProjectCallouts(project.id);
      return NextResponse.json(result);
    }

    if (action === 'sheet' && sheetNumber) {
      const callouts = await getSheetCallouts(project.id, sheetNumber);
      return NextResponse.json({ callouts });
    }

    if (action === 'search') {
      const callouts = await searchCallouts(project.id, {
        type: type || undefined,
        targetSheet: targetSheet || undefined,
        validOnly
      });
      return NextResponse.json({ callouts });
    }

    if (action === 'stats') {
      const stats = await getCalloutStats(project.id);
      return NextResponse.json(stats);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error getting callouts:', error);
    return NextResponse.json(
      { error: 'Failed to get callouts' },
      { status: 500 }
    );
  }
}
