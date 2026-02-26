import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logActivity } from '@/lib/audit-log';
import { revokeUserSessions } from '@/lib/jwt-revocation';
import bcrypt from 'bcryptjs';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ADMIN_USERS');

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { role, email, username, password } = body;

    const updateData: any = {};
    if (role) updateData.role = role;
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Fetch existing user to detect role changes
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { role: true },
    });

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    });

    // Revoke sessions when role changes to force re-authentication
    if (role && existingUser && role !== existingUser.role) {
      await revokeUserSessions(params.id).catch((error: unknown) => {
        logger.warn('Failed to revoke sessions after role change', { userId: params.id, error: String(error) });
      });
    }

    await logActivity({
      userId: session.user.id,
      action: 'user_updated',
      resource: 'user',
      resourceId: params.id,
      details: {
        updatedFields: Object.keys(updateData),
      },
      request,
    });

    return NextResponse.json({
      message: 'User updated successfully',
      User: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Failed to update user', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthenticated' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Prevent deleting self
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    await prisma.user.delete({
      where: { id: params.id },
    });

    await logActivity({
      userId: session.user.id,
      action: 'user_deleted',
      resource: 'user',
      resourceId: params.id,
      details: {
        deletedUser: user.username,
      },
      request,
    });

    return NextResponse.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete user', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
