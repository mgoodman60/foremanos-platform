import { NextRequest, NextResponse } from 'next/server';
import { OneDriveService } from '@/lib/onedrive-service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// OAuth callback handler
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // project slug
    const error = searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/project/${state}?onedrive_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokens = await OneDriveService.exchangeCodeForTokens(code);

    // Find project by slug
    const project = await prisma.project.findUnique({
      where: { slug: state },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Save tokens to project
    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);
    await prisma.project.update({
      where: { id: project.id },
      data: {
        oneDriveAccessToken: tokens.accessToken,
        oneDriveRefreshToken: tokens.refreshToken,
        oneDriveTokenExpiry: tokenExpiry,
      },
    });

    // Redirect back to project page with success message
    return NextResponse.redirect(
      new URL(`/project/${state}?onedrive_connected=true`, request.url)
    );
  } catch (error) {
    console.error('Error in OneDrive OAuth callback:', error);
    return NextResponse.json(
      { error: 'Failed to complete OneDrive authentication' },
      { status: 500 }
    );
  }
}
