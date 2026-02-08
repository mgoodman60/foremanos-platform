/**
 * Twilio Webhook Handler
 * Receives inbound SMS/MMS messages and parses them into daily report fields
 */

import { NextRequest } from 'next/server';
import { createScopedLogger } from '@/lib/logger';
import { parseSMSToReportFields, lookupUserByPhone } from '@/lib/sms-daily-report-service';

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
    // Parse Twilio form-encoded body
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string || '';
    const numMedia = parseInt(formData.get('NumMedia') as string || '0');

    if (!from) {
      return twimlResponse('Error: Missing sender information.');
    }

    // Validate Twilio request signature (HMAC-SHA1)
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    if (twilioAuthToken) {
      const signature = request.headers.get('X-Twilio-Signature');
      if (!signature) {
        log.warn('Missing Twilio signature header');
        return new Response('Forbidden', { status: 403 });
      }
      // Validate signature using HMAC-SHA1 per Twilio spec
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
    } else {
      log.warn('TWILIO_AUTH_TOKEN not configured — webhook signature validation disabled');
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
