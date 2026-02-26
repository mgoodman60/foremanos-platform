/**
 * SMS Configuration API
 * Manages phone number mappings and SMS toggle for daily reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('SMS_CONFIG');

export async function GET(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
      select: { id: true, smsEnabled: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // RBAC: SUPERVISOR+ can view
    const { getDailyReportRole, canApproveReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canApproveReport(role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const mappings = await prisma.sMSMapping.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, username: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ mappings, smsEnabled: project.smsEnabled });
  } catch (error) {
    log.error('GET SMS config failed', error as Error);
    return NextResponse.json({ error: 'Failed to get SMS config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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

    // RBAC: ADMIN only
    const { getDailyReportRole, canDeleteReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canDeleteReport(role)) {
      return NextResponse.json({ error: 'Access denied - ADMIN only' }, { status: 403 });
    }

    const { userId, phoneNumber } = await request.json();

    // Validate E.164 phone format
    if (!phoneNumber || !/^\+\d{10,15}$/.test(phoneNumber)) {
      return NextResponse.json({ error: 'Invalid phone number format. Use E.164 (e.g., +15551234567)' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const mapping = await prisma.sMSMapping.create({
      data: { projectId: project.id, userId, phoneNumber },
      include: { user: { select: { id: true, username: true, email: true } } },
    });

    return NextResponse.json({ mapping });
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2002') {
      return NextResponse.json({ error: 'Phone number already mapped to this project' }, { status: 409 });
    }
    log.error('POST SMS mapping failed', error as Error);
    return NextResponse.json({ error: 'Failed to create SMS mapping' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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

    // RBAC: ADMIN only
    const { getDailyReportRole, canDeleteReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canDeleteReport(role)) {
      return NextResponse.json({ error: 'Access denied - ADMIN only' }, { status: 403 });
    }

    const { smsEnabled } = await request.json();
    if (typeof smsEnabled !== 'boolean') {
      return NextResponse.json({ error: 'smsEnabled must be a boolean' }, { status: 400 });
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { smsEnabled },
    });

    return NextResponse.json({ smsEnabled });
  } catch (error) {
    log.error('PATCH SMS config failed', error as Error);
    return NextResponse.json({ error: 'Failed to update SMS config' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
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

    // RBAC: ADMIN only
    const { getDailyReportRole, canDeleteReport } = await import('@/lib/daily-report-permissions');
    const role = await getDailyReportRole(session.user.id, project.id);
    if (!role || !canDeleteReport(role)) {
      return NextResponse.json({ error: 'Access denied - ADMIN only' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter required' }, { status: 400 });
    }

    // Verify mapping belongs to this project
    const mapping = await prisma.sMSMapping.findUnique({ where: { id } });
    if (!mapping || mapping.projectId !== project.id) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    await prisma.sMSMapping.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('DELETE SMS mapping failed', error as Error);
    return NextResponse.json({ error: 'Failed to delete SMS mapping' }, { status: 500 });
  }
}
