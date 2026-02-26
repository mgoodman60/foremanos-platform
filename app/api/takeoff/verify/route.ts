import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { verifyTakeoff, type TakeoffResult, type EnhancedChunk } from '@/lib/rag-enhancements';
import { createLogger } from '@/lib/logger';
const logger = createLogger('TAKEOFF_VERIFY');

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { takeoff, chunks } = body as { takeoff: TakeoffResult; chunks: EnhancedChunk[] };

    if (!takeoff || !takeoff.items || !Array.isArray(takeoff.items)) {
      return NextResponse.json({ error: 'Invalid takeoff data' }, { status: 400 });
    }

    // Verify takeoff
    const verificationResult = await verifyTakeoff(takeoff, chunks || []);

    return NextResponse.json({ verification: verificationResult });
  } catch (error) {
    logger.error('Error verifying takeoff', error);
    return NextResponse.json(
      { error: 'Failed to verify takeoff' },
      { status: 500 }
    );
  }
}
