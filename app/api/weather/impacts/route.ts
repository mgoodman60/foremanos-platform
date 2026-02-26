import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
const logger = createLogger('WEATHER_IMPACTS');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: session.user.id },
          {
            ProjectMember: {
              some: {
                userId: session.user.id
              }
            }
          }
        ]
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch weather impacts
    const impacts = await prisma.weatherImpact.findMany({
      where: {
        projectId,
        reportDate: {
          gte: startDate
        }
      },
      orderBy: {
        reportDate: 'desc'
      }
    });

    return NextResponse.json({ impacts });
  } catch (error) {
    logger.error('Error fetching weather impacts', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather impacts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      reportDate,
      avgTemperature,
      maxTemperature,
      minTemperature,
      precipitation,
      windSpeed,
      conditions,
      workStopped,
      delayHours,
      affectedTrades,
      laborCost,
      equipmentCost,
      materialCost,
      totalCost,
      productivityPercent,
      tasksCompleted,
      tasksPlanned,
      notes,
      alternativeWork
    } = body;

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: session.user.id
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or unauthorized' },
        { status: 404 }
      );
    }

    // Create weather impact record
    const impact = await prisma.weatherImpact.create({
      data: {
        projectId,
        reportDate: new Date(reportDate),
        avgTemperature,
        maxTemperature,
        minTemperature,
        precipitation,
        windSpeed,
        conditions,
        workStopped: workStopped || false,
        delayHours,
        affectedTrades,
        laborCost,
        equipmentCost,
        materialCost,
        totalCost,
        productivityPercent,
        tasksCompleted,
        tasksPlanned,
        notes,
        alternativeWork
      }
    });

    return NextResponse.json({ impact }, { status: 201 });
  } catch (error) {
    logger.error('Error creating weather impact', error);
    return NextResponse.json(
      { error: 'Failed to create weather impact' },
      { status: 500 }
    );
  }
}
