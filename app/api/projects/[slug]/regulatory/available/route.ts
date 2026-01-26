import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  getApplicableRegulatoryCodes,
  getFreeRegulatoryCodes,
  calculateRegulatoryProcessingCost,
} from '@/lib/regulatory-documents';

/**
 * GET /api/projects/[slug]/regulatory/available
 * Get available regulatory documents for a location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') || undefined;
    const city = searchParams.get('city') || undefined;
    const country = searchParams.get('country') || 'United States';
    const freeOnly = searchParams.get('freeOnly') === 'true';

    const location = { state, city, country };

    // Get applicable codes
    const allCodes = getApplicableRegulatoryCodes(location);
    const freeCodes = getFreeRegulatoryCodes(location);
    const codes = freeOnly ? freeCodes : allCodes;

    // Calculate costs
    const costEstimate = calculateRegulatoryProcessingCost(codes);

    return NextResponse.json({
      location,
      codes,
      costEstimate,
      stats: {
        totalAvailable: allCodes.length,
        freeAvailable: freeCodes.length,
        paidRequired: allCodes.length - freeCodes.length,
      },
    });
  } catch (error) {
    console.error('Error fetching available regulatory codes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
