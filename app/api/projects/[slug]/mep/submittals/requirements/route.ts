/**
 * Requirements Extraction & Auto-Import API
 * GET - Extract all requirements from project schedules
 * POST - Auto-import requirements into a submittal
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import {
  extractAllRequirements,
  autoImportRequirements,
  getAvailableCategories,
} from '@/lib/submittal-requirement-service';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'full';

    if (mode === 'categories') {
      // Return just the available categories for the import dialog
      const categories = await getAvailableCategories(project.id);
      return NextResponse.json({ categories });
    }

    // Full extraction
    const requirements = await extractAllRequirements(project.id);
    return NextResponse.json(requirements);
  } catch (error) {
    console.error('Error extracting requirements:', error);
    return NextResponse.json(
      { error: 'Failed to extract requirements' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json();
    const { submittalId, categoryFilter, specSectionFilter } = body;

    if (!submittalId) {
      return NextResponse.json(
        { error: 'submittalId is required' },
        { status: 400 }
      );
    }

    // Verify submittal belongs to this project
    const submittal = await prisma.mEPSubmittal.findFirst({
      where: { id: submittalId, projectId: project.id },
    });

    if (!submittal) {
      return NextResponse.json(
        { error: 'Submittal not found in this project' },
        { status: 404 }
      );
    }

    // Perform auto-import
    const result = await autoImportRequirements(
      submittalId,
      categoryFilter,
      specSectionFilter
    );

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: 'REQUIREMENTS_IMPORTED',
        resource: 'submittal',
        resourceId: submittalId,
        userId: session.user.id,
        details: {
          imported: result.imported,
          skipped: result.skipped,
          categoryFilter,
          specSectionFilter,
        },
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error auto-importing requirements:', error);
    return NextResponse.json(
      { error: 'Failed to auto-import requirements' },
      { status: 500 }
    );
  }
}
