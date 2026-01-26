import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { verifyTakeoff, type TakeoffResult, type EnhancedChunk } from '@/lib/rag-enhancements';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
    console.error('Error verifying takeoff:', error);
    return NextResponse.json(
      { error: 'Failed to verify takeoff' },
      { status: 500 }
    );
  }
}
