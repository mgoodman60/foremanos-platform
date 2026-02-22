import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createLogger } from '@/lib/logger';

const logger = createLogger('DOCS_SPEC');

export const dynamic = 'force-dynamic';

/**
 * GET /api/docs/spec
 * Serves the OpenAPI 3.1 specification for ForemanOS API
 *
 * Returns YAML format for Swagger UI consumption
 */
export async function GET() {
  try {
    // Read the OpenAPI spec from the project root
    const openapiPath = join(process.cwd(), 'openapi.yaml');
    const openapiContent = readFileSync(openapiPath, 'utf8');

    return new NextResponse(openapiContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-yaml',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.error('Failed to serve OpenAPI spec', error);
    return NextResponse.json(
      {
        error: 'Failed to load API documentation',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
