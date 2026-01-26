import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.date || !body.crewSize || body.hoursWorked === undefined) {
      return NextResponse.json(
        { error: 'Date, crew size, and hours worked are required' },
        { status: 400 }
      );
    }

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify crew exists and belongs to project
    const crew = await prisma.crew.findFirst({
      where: {
        id,
        projectId: project.id,
      },
    });

    if (!crew) {
      return NextResponse.json({ error: 'Crew not found' }, { status: 404 });
    }

    // Calculate productivity rate if units provided
    let productivityRate = undefined;
    if (body.unitsProduced && body.hoursWorked > 0) {
      productivityRate = body.unitsProduced / body.hoursWorked;
    }

    // Create performance record
    const performance = await prisma.crewPerformance.create({
      data: {
        crewId: id,
        date: new Date(body.date),
        crewSize: body.crewSize,
        hoursWorked: body.hoursWorked,
        tasksCompleted: body.ScheduleTaskCompleted || 0,
        unitsProduced: body.unitsProduced,
        productivityRate,
        safetyIncidents: body.safetyIncidents || 0,
        qualityIssues: body.qualityIssues || 0,
        reworkRequired: body.reworkRequired || false,
        weatherDelay: body.weatherDelay || false,
        weatherNotes: body.weatherNotes,
        notes: body.notes,
        recordedBy: session.user.id,
      },
    });

    return NextResponse.json({ performance }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating performance record:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Performance record already exists for this crew and date' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create performance record' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get performance records
    const records = await prisma.crewPerformance.findMany({
      where: {
        crewId: id,
        Crew: {
          projectId: project.id,
        },
      },
      orderBy: {
        date: 'desc',
      },
      take: limit,
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Error fetching performance records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance records' },
      { status: 500 }
    );
  }
}
