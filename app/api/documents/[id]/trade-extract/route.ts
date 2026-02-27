import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import { runTradeFocusedExtraction, type TradeFocus } from '@/lib/trade-focused-extractor';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(`trade-extract:${session.user.id}`, { maxRequests: 5, windowSeconds: 3600 });
    if (!rateLimitCheck.success) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const { focuses, escalateTier, pageRange } = body;

    if (!Array.isArray(focuses) || focuses.length === 0) {
      return NextResponse.json({ error: 'focuses array required' }, { status: 400 });
    }

    const documentId = params.id;
    const result = await runTradeFocusedExtraction(
      documentId,
      focuses as TradeFocus[],
      { escalateTier: !!escalateTier, pageRange }
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error('TRADE_EXTRACT', 'Error running trade-focused extraction', error as Error);
    return NextResponse.json({ error: 'Failed to run trade extraction' }, { status: 500 });
  }
}
