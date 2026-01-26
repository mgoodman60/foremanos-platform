/**
 * Window Schedule API Endpoint
 * 
 * GET - Retrieve all windows for a project
 * POST - Extract window schedule from documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { processWindowScheduleForProject } from '@/lib/window-schedule-extractor';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get window schedule items
    const windows = await prisma.windowScheduleItem.findMany({
      where: { projectId: project.id },
      include: {
        Room: { select: { name: true, roomNumber: true } },
        Document: { select: { name: true } },
      },
      orderBy: [{ windowNumber: 'asc' }],
    });

    // Group by type
    const byType: Record<string, any[]> = {};
    windows.forEach((w) => {
      const type = w.windowType || 'Standard';
      if (!byType[type]) byType[type] = [];
      byType[type].push(w);
    });

    return NextResponse.json({
      success: true,
      total: windows.length,
      windows,
      byType,
      types: Object.keys(byType),
    });
  } catch (error: any) {
    console.error('[Window Schedule API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch window schedule' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log(`[Window Schedule API] Starting extraction for project: ${slug}`);

    // Extract window schedule from documents
    const result = await processWindowScheduleForProject(project.id);

    return NextResponse.json({
      success: result.success,
      windowsExtracted: result.windowsExtracted,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('[Window Schedule API] Extraction error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to extract window schedule' },
      { status: 500 }
    );
  }
}
