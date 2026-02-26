import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractMEPSchedules } from '@/lib/mep-schedule-extractor';
import { safeErrorMessage } from '@/lib/api-error';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_EXTRACT_MEP_SCHEDULES');

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Verify project access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: { include: { User: true } }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    logger.info('Extracting MEP schedules for project', { slug });

    // Run the MEP schedule extraction
    const result = await extractMEPSchedules(slug);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: result.errors?.join(', ') || 'No MEP schedules found',
        schedulesFound: result.schedulesFound
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: `Extracted MEP schedule data successfully`,
      schedulesFound: result.schedulesFound,
      summary: {
        lightFixtures: result.lightFixtures.length,
        plumbingFixtures: result.plumbingFixtures.length,
        hvacEquipment: result.hvacEquipment.length,
        abbreviations: result.abbreviations.length
      },
      // Include sample data for UI preview
      samples: {
        lightFixtures: result.lightFixtures.slice(0, 3),
        plumbingFixtures: result.plumbingFixtures.slice(0, 3),
        hvacEquipment: result.hvacEquipment.slice(0, 3),
        abbreviations: result.abbreviations.slice(0, 10)
      }
    });

  } catch (error: unknown) {
    logger.error('MEP schedule extraction error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to extract MEP schedules') },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    const project = await prisma.project.findUnique({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get stored MEP schedule data
    const dataSource = await prisma.projectDataSource.findUnique({
      where: {
        projectId_featureType: {
          projectId: project.id,
          featureType: 'mep_schedules'
        }
      }
    });

    if (!dataSource?.metadata) {
      return NextResponse.json({
        extracted: false,
        message: 'MEP schedules not yet extracted. Click "Extract MEP Schedules" to process.'
      });
    }

    const data = dataSource.metadata as any;

    return NextResponse.json({
      extracted: true,
      extractedAt: data.extractedAt,
      summary: data.summary,
      lightFixtures: data.lightFixtures || [],
      plumbingFixtures: data.plumbingFixtures || [],
      hvacEquipment: data.hvacEquipment || [],
      abbreviations: data.abbreviations || []
    });

  } catch (error: unknown) {
    logger.error('Get MEP schedules error', error);
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Failed to get MEP schedules') },
      { status: 500 }
    );
  }
}
