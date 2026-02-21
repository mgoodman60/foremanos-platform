/**
 * Twilio Webhook Handler
 * Receives inbound SMS/MMS messages and parses them into daily report fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { parseSMSToReportFields, lookupUserByPhone } from '@/lib/sms-daily-report-service';
import { getCached, setCached } from '@/lib/redis';

const log = createScopedLogger('TWILIO_WEBHOOK');

function twimlResponse(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${escapeXml(message)}</Message></Response>`;
  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(request: NextRequest) {
  try {
    // Require TWILIO_AUTH_TOKEN — never process unsigned webhooks
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    if (!twilioAuthToken) {
      log.error('TWILIO_AUTH_TOKEN not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    // Parse Twilio form-encoded body
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string || '';
    const numMedia = parseInt(formData.get('NumMedia') as string || '0');

    if (!from) {
      return twimlResponse('Error: Missing sender information.');
    }

    // Validate Twilio request signature (HMAC-SHA1)
    const signature = request.headers.get('X-Twilio-Signature');
    if (!signature) {
      log.warn('Missing Twilio signature header');
      return new Response('Forbidden', { status: 403 });
    }

    const { createHmac } = await import('crypto');
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL || `${process.env.NEXTAUTH_URL}/api/webhooks/twilio`;
    // Build parameter string: sort params alphabetically, concatenate key+value
    const params: Record<string, string> = {};
    formData.forEach((value, key) => { params[key] = value.toString(); });
    const paramString = Object.keys(params).sort().map(k => k + params[k]).join('');
    const expectedSignature = createHmac('sha1', twilioAuthToken)
      .update(webhookUrl + paramString)
      .digest('base64');
    if (signature !== expectedSignature) {
      log.warn('Invalid Twilio signature', { from });
      return new Response('Forbidden', { status: 403 });
    }

    // Replay protection: reject requests older than 5 minutes
    const twilioTimestamp = request.headers.get('X-Twilio-Timestamp');
    if (twilioTimestamp) {
      // Handle both Unix epoch seconds and date strings
      const parsed = Number(twilioTimestamp);
      const requestTime = !isNaN(parsed) && parsed > 0
        ? parsed * 1000  // Unix epoch in seconds → milliseconds
        : new Date(twilioTimestamp).getTime();
      const now = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;
      if (!isNaN(requestTime) && Math.abs(now - requestTime) > fiveMinutesMs) {
        log.warn('Twilio request outside timestamp window', { twilioTimestamp, from });
        return new Response('Request expired', { status: 403 });
      }
    }

    // Deduplicate by MessageSid (Twilio may retry delivery)
    const messageSid = formData.get('MessageSid') as string || formData.get('SmsSid') as string;
    if (messageSid) {
      const dedupeKey = `twilio:processed:${messageSid}`;
      const alreadyProcessed = await getCached<string>(dedupeKey);
      if (alreadyProcessed) {
        log.info('Duplicate webhook ignored', { messageSid });
        return NextResponse.json({ status: 'duplicate' });
      }
      // Mark as processed with 24h TTL
      await setCached(dedupeKey, 'true', 86400);
    }

    // Look up user by phone number
    const user = await lookupUserByPhone(from);
    if (!user) {
      log.info('Unknown phone number', { from });
      return twimlResponse('Your phone number is not registered with any ForemanOS project. Contact your admin to set up SMS reporting.');
    }

    log.info('Inbound SMS received', { from, userId: user.userId, projectId: user.projectId, hasMedia: numMedia > 0 });

    // Parse the message
    const parsed = parseSMSToReportFields(body);

    // Log MMS media URLs if present
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = formData.get(`MediaUrl${i}`) as string;
        const mediaType = formData.get(`MediaContentType${i}`) as string;
        log.info('MMS media received', { mediaUrl, mediaType, userId: user.userId });
      }
    }

    // Build confirmation response
    let response: string;
    if (body.toLowerCase().trim() === 'ok') {
      response = 'Report confirmed! Your daily report has been saved.';
    } else {
      const parts: string[] = [];
      if (parsed.crewSize) parts.push(`${parsed.crewSize} crew`);
      if (parsed.equipment?.length) parts.push(parsed.equipment.join(', '));
      if (parsed.delays) parts.push(`delay logged`);
      if (numMedia > 0) parts.push(`${numMedia} photo(s) received`);

      const summary = parts.length > 0 ? `Got it! ${parts.join(', ')}. ` : 'Logged. ';
      response = `${summary}Anything else to add?`;
    }

    return twimlResponse(response);
  } catch (error) {
    log.error('Twilio webhook error', error as Error);
    return twimlResponse('Sorry, there was an error processing your message. Please try again.');
  }
}
