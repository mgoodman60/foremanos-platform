/**
 * Autodesk Token API Endpoint
 * Returns a public access token for the Forge Viewer
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { isAutodeskConfigured } from '@/lib/autodesk-auth';

const AUTODESK_AUTH_URL = 'https://developer.api.autodesk.com/authentication/v2/token';

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Autodesk is configured
    if (!isAutodeskConfigured()) {
      return NextResponse.json(
        { error: 'Autodesk integration not configured' },
        { status: 503 }
      );
    }

    const clientId = process.env.AUTODESK_CLIENT_ID!;
    const clientSecret = process.env.AUTODESK_CLIENT_SECRET!;

    // Get a viewer-scoped token (read-only)
    const response = await fetch(AUTODESK_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'viewables:read',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Autodesk Token API] Failed to get token:', errorText);
      return NextResponse.json(
        { error: 'Failed to get viewer token' },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
    });
  } catch (error) {
    console.error('[Autodesk Token API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
