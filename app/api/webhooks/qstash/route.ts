import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { processQueuedDocument } from '@/lib/document-processing-queue';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const receiver = process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
  ? new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    })
  : null;

export async function POST(request: Request) {
  try {
    const body = await request.text();

    // Verify QStash signature (HMAC) — prevents unauthorized triggers
    if (receiver) {
      const signature = request.headers.get('upstash-signature') || '';
      const isValid = await receiver.verify({ body, signature });
      if (!isValid) {
        logger.warn('QSTASH_WEBHOOK', 'Invalid signature on incoming request');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    const { documentId, type } = payload;

    if (type !== 'continue-processing' || !documentId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    logger.info('QSTASH_WEBHOOK', `Processing continuation for ${documentId}`);
    await processQueuedDocument(documentId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('QSTASH_WEBHOOK', 'Webhook processing error', error);
    // Return 500 so QStash retries
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
