import { Client } from '@upstash/qstash';
import { logger } from '@/lib/logger';

const qstashClient = process.env.QSTASH_TOKEN
  ? new Client({ token: process.env.QSTASH_TOKEN })
  : null;

/**
 * Schedule continuation processing for a document.
 * Uses QStash for guaranteed delivery, falls back to fire-and-forget fetch.
 */
export async function scheduleProcessingContinuation(documentId: string): Promise<boolean> {
  const targetUrl = `${process.env.NEXTAUTH_URL || 'https://foremanos.vercel.app'}/api/webhooks/qstash`;

  if (qstashClient) {
    try {
      await qstashClient.publishJSON({
        url: targetUrl,
        body: { documentId, type: 'continue-processing' },
        retries: 3,
      });
      logger.info('QSTASH', `Continuation scheduled for ${documentId}`);
      return true;
    } catch (err) {
      logger.error('QSTASH', `Failed to publish, falling back to fetch`, err as Error);
    }
  }

  // Fallback: fire-and-forget fetch (existing behavior)
  const fallbackUrl = `${process.env.NEXTAUTH_URL || 'https://foremanos.vercel.app'}/api/admin/process-queue`;
  fetch(fallbackUrl, {
    method: 'POST',
    headers: { 'x-continuation': 'true' },
  }).catch(() => {});
  logger.info('QSTASH', `Fallback fetch fired for ${documentId}`);
  return false;
}
