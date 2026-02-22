import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getFileUrl } from '@/lib/s3';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FILES_VIEW');

export const dynamic = 'force-dynamic';

// GET /api/files/view?path=...&isPublic=...
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const isPublic = searchParams.get('isPublic') === 'true';

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Generate URL (public or signed)
    const fileUrl = await getFileUrl(path, isPublic);

    // Redirect to the S3 URL
    return NextResponse.redirect(fileUrl);
  } catch (error) {
    logger.error('Failed to generate file URL', error);
    return NextResponse.json(
      { error: 'Failed to generate file URL' },
      { status: 500 }
    );
  }
}