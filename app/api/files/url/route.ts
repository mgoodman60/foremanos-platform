import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getFileUrl } from '@/lib/s3';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FILES_URL');

export const dynamic = 'force-dynamic';

// GET /api/files/url - Get signed URL for a file
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
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    const url = await getFileUrl(path, isPublic);
    
    return NextResponse.json({ url });
  } catch (error) {
    logger.error('Failed to get file URL', error);
    return NextResponse.json(
      { error: 'Failed to get file URL' },
      { status: 500 }
    );
  }
}
