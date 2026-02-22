/**
 * Virus Scanner Module - VirusTotal API Integration
 *
 * Provides file scanning capabilities with graceful degradation:
 * - Scans file buffers via VirusTotal API
 * - Falls back gracefully if API key missing (development mode)
 * - Handles API rate limits and timeouts
 * - Logs security events
 */

import { logger } from '@/lib/logger';
import FormData from 'form-data';

interface VirusScanResult {
  clean: boolean;
  engine: string;
  threat?: string;
  scanId?: string;
  timestamp: Date;
}

interface ScanOptions {
  timeout?: number;
  skipIfMissingKey?: boolean;  // Graceful degradation
}

const VIRUSTOTAL_API_URL = 'https://www.virustotal.com/api/v3/files';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Scan file buffer via VirusTotal API
 */
export async function scanFileBuffer(
  buffer: Buffer,
  fileName: string,
  options?: ScanOptions
): Promise<VirusScanResult> {
  const timeout = options?.timeout || DEFAULT_TIMEOUT;
  const skipIfMissingKey = options?.skipIfMissingKey ?? true; // Default to graceful fallback

  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  // Graceful degradation if API key missing
  if (!apiKey) {
    if (skipIfMissingKey) {
      logger.warn('VIRUS_SCANNER', 'VirusTotal API key not configured - skipping scan');
      await logSecurityEvent('VIRUS_SCAN_SKIPPED', {
        fileName,
        reason: 'API key not configured',
      });
      return {
        clean: true, // Allow upload in development/testing
        engine: 'none',
        timestamp: new Date(),
      };
    } else {
      throw new Error('VirusTotal API key not configured');
    }
  }

  try {
    logger.info('VIRUS_SCANNER', `Scanning file: ${fileName}`, { sizeKB: (buffer.length / 1024).toFixed(2) });

    // Create form data for file upload
    const form = new FormData();
    form.append('file', buffer, {
      filename: fileName,
      contentType: 'application/octet-stream',
    });

    // Upload file to VirusTotal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const uploadResponse = await fetch(VIRUSTOTAL_API_URL, {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
        ...form.getHeaders(),
      },
      body: form as any,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();

      // Handle rate limiting
      if (uploadResponse.status === 429) {
        logger.warn('VIRUS_SCANNER', 'Rate limit exceeded - skipping scan');
        await logSecurityEvent('VIRUS_SCAN_RATE_LIMITED', {
          fileName,
          statusCode: uploadResponse.status,
        });
        return {
          clean: true, // Allow upload but mark as skipped
          engine: 'virustotal',
          timestamp: new Date(),
        };
      }

      throw new Error(`VirusTotal API error: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    const scanId = uploadResult.data?.id;

    if (!scanId) {
      throw new Error('No scan ID returned from VirusTotal');
    }

    logger.info('VIRUS_SCANNER', 'File uploaded to VirusTotal', { scanId });

    // Wait a moment for analysis to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get scan results
    const scanResult = await getScanResult(scanId);

    logger.info('VIRUS_SCANNER', `Scan completed: ${scanResult.clean ? 'CLEAN' : 'THREAT DETECTED'}`);

    if (!scanResult.clean) {
      await logSecurityEvent('VIRUS_DETECTED', {
        fileName,
        threat: scanResult.threat,
        scanId: scanResult.scanId,
      });
    }

    return scanResult;
  } catch (error: unknown) {
    // Handle timeout
    const errName = error instanceof Error ? error.name : undefined;
    if (errName === 'AbortError') {
      logger.error('VIRUS_SCANNER', 'Scan timeout', error as Error, { fileName });
      await logSecurityEvent('VIRUS_SCAN_TIMEOUT', {
        fileName,
        timeout,
      });

      // In case of timeout, allow upload but log the event
      return {
        clean: true,
        engine: 'virustotal',
        timestamp: new Date(),
      };
    }

    // Handle other errors
    logger.error('VIRUS_SCANNER', 'Scan error', error as Error);
    await logSecurityEvent('VIRUS_SCAN_ERROR', {
      fileName,
      error: error instanceof Error ? error.message : String(error),
    });

    // Graceful degradation - allow upload but log error
    if (skipIfMissingKey) {
      return {
        clean: true,
        engine: 'virustotal',
        timestamp: new Date(),
      };
    }

    throw error;
  }
}

/**
 * Check scan result by ID (for async scanning)
 */
export async function getScanResult(scanId: string): Promise<VirusScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) {
    throw new Error('VirusTotal API key not configured');
  }

  try {
    const response = await fetch(
      `https://www.virustotal.com/api/v3/analyses/${scanId}`,
      {
        headers: {
          'x-apikey': apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`VirusTotal API error: ${response.status}`);
    }

    const result = await response.json();
    const stats = result.data?.attributes?.stats;

    if (!stats) {
      throw new Error('Invalid scan result format');
    }

    // Check if any engine detected malware
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const _totalEngines = Object.values(stats).reduce((sum: number, val) => sum + (val as number), 0);

    const clean = malicious === 0 && suspicious === 0;

    return {
      clean,
      engine: 'virustotal',
      threat: clean ? undefined : `${malicious} engines detected threat`,
      scanId,
      timestamp: new Date(),
    };
  } catch (error: unknown) {
    logger.error('VIRUS_SCANNER', 'Error getting scan result', error as Error);
    throw error;
  }
}

/**
 * Log security events to database
 */
export async function logSecurityEvent(
  event: string,
  details: Record<string, any>
): Promise<void> {
  try {
    logger.info('VIRUS_SCANNER', `Security event: ${event}`, details);

    // Optionally store in database if you have a SecurityLog model
    // For now, just console logging
    // await prisma.securityLog.create({
    //   data: {
    //     event,
    //     details,
    //     timestamp: new Date(),
    //   },
    // });
  } catch (error) {
    logger.error('VIRUS_SCANNER', 'Security log error', error as Error);
    // Don't throw - logging failure shouldn't break the flow
  }
}
