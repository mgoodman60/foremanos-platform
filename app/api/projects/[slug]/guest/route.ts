import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import bcrypt from 'bcryptjs';
import { namespacePIN, stripPINPrefix } from '@/lib/guest-pin-utils';

export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/guest - Get guest credentials and activity
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        User_Project_ownerIdToUser: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is owner or admin
    if (project.ownerId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get guest user
    const guestUser = await prisma.user.findUnique({
      where: { username: project.guestUsername },
    });

    // Get guest activity logs
    const activityLogs = guestUser ? await prisma.activityLog.findMany({
      where: {
        userId: guestUser.id,
        action: 'user_login',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    }) : [];

    return NextResponse.json({
      guestUsername: stripPINPrefix(project.guestUsername),
      guestPassword: project.guestPassword,
      hasPassword: !!project.guestPassword,
      lastLogin: guestUser?.lastLoginAt,
      activityLogs: activityLogs.map((log: any) => ({
        id: log.id,
        timestamp: log.createdAt,
        ipAddress: log.ipAddress,
      })),
    });
  } catch (error) {
    console.error('Error fetching guest credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/[slug]/guest - Update guest credentials
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;
    const body = await request.json();
    const { guestUsername, guestPassword, generatePassword } = body;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is owner or admin
    if (project.ownerId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate random password if requested
    let newPassword = guestPassword;
    if (generatePassword) {
      newPassword = Math.random().toString(36).slice(-8);
    }

    // Namespace the new guest PIN if provided
    const namespacedNewPin = guestUsername
      ? namespacePIN(session.user.id, guestUsername)
      : undefined;

    // Update project guest credentials
    const updateData: any = {};
    if (namespacedNewPin) updateData.guestUsername = namespacedNewPin;
    if (newPassword !== undefined) updateData.guestPassword = newPassword;

    const updatedProject = await prisma.project.update({
      where: { slug },
      data: updateData,
    });

    // Update guest user if username changed
    if (namespacedNewPin && namespacedNewPin !== project.guestUsername) {
      // Find old guest user
      const oldGuestUser = await prisma.user.findUnique({
        where: { username: project.guestUsername },
      });

      if (oldGuestUser) {
        // Update username
        await prisma.user.update({
          where: { id: oldGuestUser.id },
          data: { username: namespacedNewPin },
        });
      }
    }

    // Update guest user password
    if (newPassword !== undefined) {
      const guestUser = await prisma.user.findUnique({
        where: { username: updatedProject.guestUsername },
      });

      if (guestUser) {
        const hashedPassword = newPassword ? await bcrypt.hash(newPassword, 10) : null;
        await prisma.user.update({
          where: { id: guestUser.id },
          data: { password: hashedPassword },
        });
      }
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'guest_credentials_updated',
      resource: 'project',
      resourceId: project.id,
      details: {
        projectName: project.name,
        guestUsername: updatedProject.guestUsername,
      },
    });

    return NextResponse.json({
      success: true,
      guestUsername: stripPINPrefix(updatedProject.guestUsername),
      guestPassword: newPassword,
      generatedPassword: generatePassword ? newPassword : undefined,
    });
  } catch (error) {
    console.error('Error updating guest credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[slug]/guest - Revoke guest access
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = params;

    // Find project
    const project = await prisma.project.findUnique({
      where: { slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is owner or admin
    if (project.ownerId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate new random guest username to revoke access
    const newGuestUsername = `revoked_${Date.now()}`;

    await prisma.project.update({
      where: { slug },
      data: {
        guestUsername: newGuestUsername,
        guestPassword: null,
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'guest_access_revoked',
      resource: 'project',
      resourceId: project.id,
      details: {
        projectName: project.name,
        oldGuestUsername: project.guestUsername,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking guest access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
