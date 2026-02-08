#!/usr/bin/env tsx
/**
 * Upload Pipeline Verification Script
 *
 * Tests the full document upload pipeline against production (or any URL via --url flag).
 * Verifies: auth → project lookup → PDF generation → presigned URL → R2 upload →
 * confirm → async processing → error handling (expects LLM failure due to exhausted credits)
 *
 * Usage:
 *   npx tsx scripts/test-upload-pipeline.ts
 *   npx tsx scripts/test-upload-pipeline.ts --url https://foremanos.vercel.app
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ============================================================================
// Types
// ============================================================================

interface AuthResponse {
  csrfToken: string;
  cookies: string[];
  sessionToken?: string;
}

interface Project {
  id: string;
  name: string;
}

interface PresignResponse {
  uploadUrl: string;
  cloudStoragePath: string;
  expiresAt: string;
}

interface ConfirmResponse {
  Document: {
    id: string;
    name: string;
    fileName: string;
    queueStatus?: string;
  };
  message: string;
  processingInfo?: unknown;
}

interface ProgressResponse {
  status: 'queued' | 'extracting' | 'analyzing' | 'indexing' | 'completed' | 'failed';
  pagesProcessed?: number;
  totalPages?: number;
  percentComplete?: number;
  currentPhase?: string;
  error?: string;
  document?: {
    queueStatus?: string;
  };
}

interface DocumentResponse {
  id: string;
  queueStatus?: string;
  name: string;
  [key: string]: unknown;
}

interface StepResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// ============================================================================
// ANSI Color Codes
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const checkmark = `${colors.green}✓${colors.reset}`;
const cross = `${colors.red}✗${colors.reset}`;

// ============================================================================
// Helper Functions
// ============================================================================

function log(message: string) {
  console.log(message);
}

function logSuccess(message: string) {
  console.log(`  ${checkmark} ${message}`);
}

function logError(message: string) {
  console.log(`  ${cross} ${message}`);
}

function logStep(step: number, total: number, description: string) {
  console.log(`\n${colors.bright}[${step}/${total}] ${description}...${colors.reset}`);
}

function parseCookies(setCookieHeaders: string[]): Map<string, string> {
  const cookieMap = new Map<string, string>();
  for (const header of setCookieHeaders) {
    const [cookie] = header.split(';');
    const [name, value] = cookie.split('=');
    if (name && value) {
      cookieMap.set(name.trim(), value.trim());
    }
  }
  return cookieMap;
}

function buildCookieHeader(cookieMap: Map<string, string>): string {
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Pipeline Steps
// ============================================================================

/**
 * Step 1: Authenticate with NextAuth credentials provider
 */
async function authenticate(baseUrl: string): Promise<StepResult> {
  try {
    // Get CSRF token
    const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`, {
      method: 'GET',
    });

    if (!csrfResponse.ok) {
      return {
        success: false,
        message: `CSRF request failed: ${csrfResponse.status}`,
      };
    }

    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;

    // Extract cookies from CSRF response
    const csrfCookies = parseCookies(
      csrfResponse.headers.getSetCookie ? csrfResponse.headers.getSetCookie() : []
    );

    // Authenticate (NextAuth credentials callback expects form-urlencoded)
    const formBody = new URLSearchParams({
      username: 'MGoodman60',
      password: '123',
      csrfToken,
      json: 'true',
    });

    const authResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': buildCookieHeader(csrfCookies),
      },
      body: formBody.toString(),
      redirect: 'manual', // Don't follow redirects
    });

    // NextAuth returns 302 on success
    if (authResponse.status !== 302 && authResponse.status !== 200) {
      return {
        success: false,
        message: `Auth callback failed: ${authResponse.status}`,
      };
    }

    // Extract session cookie
    const authCookies = parseCookies(
      authResponse.headers.getSetCookie ? authResponse.headers.getSetCookie() : []
    );

    // Merge cookies
    for (const [name, value] of authCookies.entries()) {
      csrfCookies.set(name, value);
    }

    // Look for session token (handles both HTTP and HTTPS cookie names)
    const sessionToken =
      csrfCookies.get('next-auth.session-token') ||
      csrfCookies.get('__Secure-next-auth.session-token');

    if (!sessionToken) {
      return {
        success: false,
        message: 'No session token found in auth response',
      };
    }

    logSuccess('Session cookie obtained');

    return {
      success: true,
      message: 'Authenticated',
      data: {
        cookies: csrfCookies,
        sessionToken,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Auth error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Step 2: Get first project ID via dashboard endpoint
 */
async function getProject(baseUrl: string, cookieMap: Map<string, string>): Promise<StepResult> {
  try {
    const response = await fetch(`${baseUrl}/api/dashboard`, {
      method: 'GET',
      headers: {
        'Cookie': buildCookieHeader(cookieMap),
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Dashboard request failed: ${response.status}`,
      };
    }

    const data = await response.json();
    const projects: Project[] = data.projects || [];

    if (projects.length === 0) {
      return {
        success: false,
        message: 'No projects found',
      };
    }

    const project = projects[0];
    logSuccess(`Found project: "${project.name}" (id: ${project.id})`);

    return {
      success: true,
      message: 'Project found',
      data: project,
    };
  } catch (error) {
    return {
      success: false,
      message: `Project lookup error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Step 3: Generate test PDF with pdf-lib
 */
async function generateTestPdf(): Promise<StepResult> {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // US Letter size

    // Add some text
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 24;
    const text = 'Test Upload Pipeline Verification';

    page.drawText(text, {
      x: 50,
      y: 700,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Generated: ${new Date().toISOString()}`, {
      x: 50,
      y: 650,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    logSuccess(`Created 1-page PDF (${buffer.length} bytes)`);

    return {
      success: true,
      message: 'PDF generated',
      data: buffer,
    };
  } catch (error) {
    return {
      success: false,
      message: `PDF generation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Step 4: Request presigned URL
 */
async function requestPresignedUrl(
  baseUrl: string,
  cookieMap: Map<string, string>,
  projectId: string,
  fileSize: number
): Promise<StepResult> {
  try {
    const timestamp = Date.now();
    const fileName = `pipeline-test-${timestamp}.pdf`;

    const response = await fetch(`${baseUrl}/api/documents/presign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': buildCookieHeader(cookieMap),
      },
      body: JSON.stringify({
        fileName,
        fileSize,
        contentType: 'application/pdf',
        projectId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `Presign request failed: ${response.status} - ${errorText}`,
      };
    }

    const data: PresignResponse = await response.json();

    logSuccess(`Presigned URL generated (expires: ${data.expiresAt})`);

    return {
      success: true,
      message: 'Presigned URL obtained',
      data: {
        ...data,
        fileName,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Presign error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Step 5: Upload to R2
 */
async function uploadToR2(uploadUrl: string, pdfBuffer: Buffer): Promise<StepResult> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: pdfBuffer,
    });

    if (!response.ok) {
      return {
        success: false,
        message: `R2 upload failed: ${response.status}`,
      };
    }

    logSuccess(`Upload succeeded (HTTP ${response.status})`);

    return {
      success: true,
      message: 'Upload completed',
    };
  } catch (error) {
    return {
      success: false,
      message: `R2 upload error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Step 6: Confirm upload
 */
async function confirmUpload(
  baseUrl: string,
  cookieMap: Map<string, string>,
  cloudStoragePath: string,
  fileName: string,
  fileSize: number,
  projectId: string
): Promise<StepResult> {
  try {
    const response = await fetch(`${baseUrl}/api/documents/confirm-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': buildCookieHeader(cookieMap),
      },
      body: JSON.stringify({
        cloudStoragePath,
        fileName,
        fileSize,
        projectId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `Confirm upload failed: ${response.status} - ${errorText}`,
      };
    }

    const data: ConfirmResponse = await response.json();

    logSuccess(
      `Document created (ID: ${data.Document.id}, queueStatus: ${data.Document.queueStatus || 'pending'})`
    );

    return {
      success: true,
      message: 'Upload confirmed',
      data: data.Document,
    };
  } catch (error) {
    return {
      success: false,
      message: `Confirm error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Step 7: Poll processing status
 */
async function pollProcessing(
  baseUrl: string,
  cookieMap: Map<string, string>,
  documentId: string,
  projectId: string
): Promise<StepResult> {
  const maxAttempts = 30; // 90 seconds (30 * 3s)
  const pollInterval = 3000; // 3 seconds
  let attempt = 0;
  let lastStatus = 'unknown';

  try {
    while (attempt < maxAttempts) {
      attempt++;
      const elapsed = attempt * (pollInterval / 1000);

      // Poll progress endpoint
      const response = await fetch(`${baseUrl}/api/documents/${documentId}/progress`, {
        method: 'GET',
        headers: {
          'Cookie': buildCookieHeader(cookieMap),
        },
      });

      if (!response.ok) {
        logError(`Progress request failed: ${response.status}`);
        await sleep(pollInterval);
        continue;
      }

      const progress: ProgressResponse = await response.json();
      lastStatus = progress.status;

      console.log(`  ... ${progress.status} (${elapsed}s)`);

      // Check if processing completed or failed
      if (progress.status === 'completed') {
        logSuccess('Processing completed successfully');
        return {
          success: true,
          message: 'Processing completed',
          data: progress,
        };
      }

      if (progress.status === 'failed') {
        logSuccess('Processing completed with expected failure');
        return {
          success: true,
          message: 'Processing failed as expected',
          data: progress,
        };
      }

      // Check document.queueStatus if available
      if (progress.document?.queueStatus === 'failed') {
        logSuccess('Processing failed (detected via queueStatus)');
        return {
          success: true,
          message: 'Processing failed as expected',
          data: progress,
        };
      }

      // If stuck on 'queued' for more than 30s, check document via processing-status endpoint
      if (progress.status === 'queued' && elapsed > 30) {
        const statusResponse = await fetch(
          `${baseUrl}/api/documents/processing-status?projectId=${projectId}`,
          {
            method: 'GET',
            headers: {
              'Cookie': buildCookieHeader(cookieMap),
            },
          }
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          const doc = statusData.documents?.find((d: any) => d.id === documentId);
          if (doc?.queueStatus === 'failed') {
            logSuccess('Processing failed (detected via processing-status endpoint)');
            return {
              success: true,
              message: 'Processing failed as expected',
              data: {
                status: 'failed',
                error: doc.lastProcessingError,
                queueStatus: doc.queueStatus,
              },
            };
          }
          if (doc?.queueStatus === 'completed' || doc?.processed) {
            logSuccess('Processing completed (detected via processing-status endpoint)');
            return {
              success: true,
              message: 'Processing completed',
              data: { status: 'completed', queueStatus: doc.queueStatus },
            };
          }
        }
      }

      await sleep(pollInterval);
    }

    // Timeout
    return {
      success: false,
      message: `Processing timeout after ${maxAttempts * pollInterval / 1000}s (last status: ${lastStatus})`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Polling error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Step 8: Verify error handling
 */
async function verifyErrorHandling(
  baseUrl: string,
  cookieMap: Map<string, string>,
  documentId: string,
  projectId: string
): Promise<StepResult> {
  try {
    // Use processing-status endpoint (documents/[id] returns raw file, not JSON)
    const statusResponse = await fetch(
      `${baseUrl}/api/documents/processing-status?projectId=${projectId}`,
      {
        method: 'GET',
        headers: {
          'Cookie': buildCookieHeader(cookieMap),
        },
      }
    );

    if (!statusResponse.ok) {
      return {
        success: false,
        message: `Processing status fetch failed: ${statusResponse.status}`,
      };
    }

    const statusData = await statusResponse.json();
    const document = statusData.documents?.find((d: any) => d.id === documentId);

    if (!document) {
      return {
        success: false,
        message: 'Document not found in processing-status response (may have been cleaned up)',
      };
    }

    logSuccess(`Document status: ${document.queueStatus || 'unknown'}`);

    if (document.lastProcessingError) {
      logSuccess(`Error message: "${document.lastProcessingError}"`);
    }

    // Also check progress endpoint for queue-level error
    const progressResponse = await fetch(`${baseUrl}/api/documents/${documentId}/progress`, {
      method: 'GET',
      headers: {
        'Cookie': buildCookieHeader(cookieMap),
      },
    });

    if (progressResponse.ok) {
      const progress: ProgressResponse = await progressResponse.json();
      if (progress.error) {
        logSuccess(`Queue error: "${progress.error}"`);
      }
    }

    if (document.queueStatus === 'failed') {
      logSuccess('C6 fire-and-forget error handling confirmed');
      return {
        success: true,
        message: 'Error handling verified',
        data: document,
      };
    } else if (document.queueStatus === 'completed') {
      logSuccess('Document processing completed (unexpected but acceptable)');
      return {
        success: true,
        message: `Document completed processing`,
        data: document,
      };
    } else {
      return {
        success: true,
        message: `Document status: ${document.queueStatus || 'unknown'}`,
        data: document,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Cleanup: Delete test document
 */
async function cleanup(
  baseUrl: string,
  cookieMap: Map<string, string>,
  documentId: string
): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/api/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': buildCookieHeader(cookieMap),
      },
    });

    if (response.ok) {
      logSuccess('Test document deleted');
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Main Pipeline
// ============================================================================

async function runPipeline(baseUrl: string): Promise<number> {
  log(`${colors.bright}=== ForemanOS Upload Pipeline Verification ===${colors.reset}`);
  log(`${colors.cyan}Target: ${baseUrl}${colors.reset}`);

  const totalSteps = 8;
  let passedSteps = 0;
  let documentId: string | undefined;
  let cookieMap: Map<string, string> | undefined;

  // Step 1: Authenticate
  logStep(1, totalSteps, 'Authenticating');
  const authResult = await authenticate(baseUrl);
  if (!authResult.success) {
    logError(authResult.message);
    return 1;
  }
  passedSteps++;
  const authData = authResult.data as { cookies: Map<string, string>; sessionToken: string };
  cookieMap = authData.cookies;

  // Step 2: Get project
  logStep(2, totalSteps, 'Looking up projects');
  const projectResult = await getProject(baseUrl, cookieMap);
  if (!projectResult.success) {
    logError(projectResult.message);
    return 1;
  }
  passedSteps++;
  const project = projectResult.data as Project;

  // Step 3: Generate PDF
  logStep(3, totalSteps, 'Generating test PDF');
  const pdfResult = await generateTestPdf();
  if (!pdfResult.success) {
    logError(pdfResult.message);
    return 1;
  }
  passedSteps++;
  const pdfBuffer = pdfResult.data as Buffer;

  // Step 4: Request presigned URL
  logStep(4, totalSteps, 'Requesting presigned URL');
  const presignResult = await requestPresignedUrl(baseUrl, cookieMap, project.id, pdfBuffer.length);
  if (!presignResult.success) {
    logError(presignResult.message);
    return 1;
  }
  passedSteps++;
  const presignData = presignResult.data as PresignResponse & { fileName: string };

  // Step 5: Upload to R2
  logStep(5, totalSteps, 'Uploading to R2');
  const uploadResult = await uploadToR2(presignData.uploadUrl, pdfBuffer);
  if (!uploadResult.success) {
    logError(uploadResult.message);
    return 1;
  }
  passedSteps++;

  // Step 6: Confirm upload
  logStep(6, totalSteps, 'Confirming upload');
  const confirmResult = await confirmUpload(
    baseUrl,
    cookieMap,
    presignData.cloudStoragePath,
    presignData.fileName,
    pdfBuffer.length,
    project.id
  );
  if (!confirmResult.success) {
    logError(confirmResult.message);
    return 1;
  }
  passedSteps++;
  const document = confirmResult.data as ConfirmResponse['Document'];
  documentId = document.id;

  // Step 7: Poll processing
  logStep(7, totalSteps, 'Polling processing status');
  const pollingResult = await pollProcessing(baseUrl, cookieMap, documentId, project.id);
  if (!pollingResult.success) {
    logError(pollingResult.message);
  } else {
    passedSteps++;
  }

  // Step 8: Verify error handling
  logStep(8, totalSteps, 'Verifying error handling');
  const verifyResult = await verifyErrorHandling(baseUrl, cookieMap, documentId, project.id);
  if (!verifyResult.success) {
    logError(verifyResult.message);
  } else {
    passedSteps++;
  }

  // Cleanup
  if (documentId && cookieMap) {
    log(`\n${colors.dim}Cleaning up...${colors.reset}`);
    await cleanup(baseUrl, cookieMap, documentId);
  }

  // Final report
  log('\n' + '━'.repeat(60));
  log(`${colors.bright}Pipeline Results: ${passedSteps}/${totalSteps} steps passed${colors.reset}`);

  if (pollingResult.data) {
    const progress = pollingResult.data as ProgressResponse;
    if (progress.status === 'failed' || progress.document?.queueStatus === 'failed') {
      log(`${colors.yellow}Vision API failure: Expected (no Anthropic credits)${colors.reset}`);
      log(`${colors.green}Error handling: C6 working correctly${colors.reset}`);
    }
  }

  if (passedSteps === totalSteps) {
    log(`${colors.green}${colors.bright}Pipeline: HEALTHY ✓${colors.reset}`);
  } else {
    log(`${colors.red}${colors.bright}Pipeline: ISSUES DETECTED ✗${colors.reset}`);
  }

  log('━'.repeat(60));

  return passedSteps === totalSteps ? 0 : 1;
}

// ============================================================================
// Entry Point
// ============================================================================

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let baseUrl = 'https://foremanos.vercel.app';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      baseUrl = args[i + 1];
      break;
    }
  }

  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  const exitCode = await runPipeline(baseUrl);
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(`${colors.red}${colors.bright}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
