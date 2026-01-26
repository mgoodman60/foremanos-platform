/**
 * Autodesk Platform Services (APS) Authentication Service
 * Handles OAuth 2.0 token management for Forge API access
 */

interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
}

let cachedToken: AuthToken | null = null;

const AUTODESK_AUTH_URL = 'https://developer.api.autodesk.com/authentication/v2/token';

/**
 * Get a valid access token for Autodesk APIs
 * Uses client credentials flow (2-legged OAuth)
 */
export async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token (with 5-minute buffer)
  if (cachedToken && cachedToken.expires_at > Date.now() + 300000) {
    return cachedToken.access_token;
  }

  const clientId = process.env.AUTODESK_CLIENT_ID;
  const clientSecret = process.env.AUTODESK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Autodesk credentials not configured');
  }

  try {
    const response = await fetch(AUTODESK_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'data:read data:write data:create bucket:read bucket:create viewables:read',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Autodesk Auth] Token request failed:', errorText);
      throw new Error(`Failed to get Autodesk token: ${response.status}`);
    }

    const data = await response.json();
    
    cachedToken = {
      access_token: data.access_token,
      token_type: data.token_type,
      expires_in: data.expires_in,
      expires_at: Date.now() + (data.expires_in * 1000),
    };

    console.log('[Autodesk Auth] Token obtained, expires in', data.expires_in, 'seconds');
    return cachedToken.access_token;
  } catch (error) {
    console.error('[Autodesk Auth] Error getting token:', error);
    throw error;
  }
}

/**
 * Clear the cached token (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/**
 * Check if Autodesk credentials are configured
 */
export function isAutodeskConfigured(): boolean {
  return !!(process.env.AUTODESK_CLIENT_ID && process.env.AUTODESK_CLIENT_SECRET);
}
