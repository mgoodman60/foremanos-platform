import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  getProjectSpecSections,
  getSubmittalsForSpecSection,
} from '@/lib/spec-section-service';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_MEP_SUBMITTALS_SPEC_SECTIONS');

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const specSection = searchParams.get('specSection');

    if (specSection) {
      // Get submittals for a specific spec section
      const submittals = await getSubmittalsForSpecSection(params.slug, specSection);
      return NextResponse.json({ submittals });
    }

    // Get all spec sections with counts
    const sections = await getProjectSpecSections(params.slug);
    return NextResponse.json({ sections });
  } catch (error) {
    logger.error('Error fetching spec sections', error);
    return NextResponse.json({ error: 'Failed to fetch spec sections' }, { status: 500 });
  }
}
