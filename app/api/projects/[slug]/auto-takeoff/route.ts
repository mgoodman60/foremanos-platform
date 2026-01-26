/**
 * Auto-Takeoff Generation API
 * 
 * POST /api/projects/[slug]/auto-takeoff
 * Triggers automatic takeoff generation for all rooms in a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { autoGenerateTakeoffs } from '@/lib/auto-takeoff-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project and verify access
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
        ProjectMember: {
          include: { User: true }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user has access
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isOwner = project.ownerId === user.id;
    const isMember = project.ProjectMember.some((m: any) => m.userId === user.id);
    const isAdmin = user.role === 'admin' || user.role === 'client';

    if (!isOwner && !isMember && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    console.log(`[API] Starting auto-takeoff generation for project: ${slug}`);

    // Run auto-generation
    const result = await autoGenerateTakeoffs(slug);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Auto-takeoff error:', error);
    return NextResponse.json(
      { error: 'Failed to generate takeoffs', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Get project summary
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        Room: {
          where: { area: { not: null } },
          include: {
            FinishScheduleItem: true,
          },
        },
        MaterialTakeoff: {
          include: {
            TakeoffLineItem: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const roomsWithFinishes = project.Room.filter(r => r.FinishScheduleItem.length > 0);
    const totalTakeoffItems = project.MaterialTakeoff.reduce(
      (sum, t) => sum + t.TakeoffLineItem.length, 0
    );

    return NextResponse.json({
      projectName: project.name,
      totalRooms: project.Room.length,
      roomsWithFinishes: roomsWithFinishes.length,
      roomsWithoutFinishes: project.Room.length - roomsWithFinishes.length,
      totalTakeoffItems,
      takeoffs: project.MaterialTakeoff.map(t => ({
        id: t.id,
        name: t.name,
        itemCount: t.TakeoffLineItem.length,
        totalCost: t.totalCost,
      })),
    });
  } catch (error: any) {
    console.error('[API] Auto-takeoff status error:', error);
    return NextResponse.json(
      { error: 'Failed to get status', details: error.message },
      { status: 500 }
    );
  }
}
