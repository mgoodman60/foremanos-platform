import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { extractAllSchedules } from '@/lib/schedule-extraction-service';

// POST: Trigger schedule extraction for a project
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await extractAllSchedules(params.slug);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error extracting schedules:', error);
    return NextResponse.json({ error: 'Failed to extract schedules' }, { status: 500 });
  }
}

// GET: Get extraction status/summary
export async function GET(
  _req: NextRequest,
  { params: _params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return a summary of what would be extracted
    // This is a lightweight check without actually running extraction
    return NextResponse.json({
      available: true,
      scheduleTypes: ['doors', 'windows', 'mep'],
      message: 'Schedule extraction is available for this project',
    });
  } catch (error) {
    console.error('Error checking extraction status:', error);
    return NextResponse.json({ error: 'Failed to check extraction status' }, { status: 500 });
  }
}
