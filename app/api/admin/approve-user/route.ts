import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { logActivity, createNotification } from '@/lib/audit-log';
import { sendApprovalEmail, sendRejectionEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

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
    const { userId, approve } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (approve) {
      // Approve user
      await prisma.user.update({
        where: { id: userId },
        data: {
          approved: true,
          role: 'client', // Promote to client role
          approvedBy: session.user.id,
        },
      });

      // Log the approval
      await logActivity({
        userId: session.user.id,
        action: 'user_approved',
        resource: 'user',
        resourceId: userId,
        details: {
          approvedUser: user.username,
        },
        request,
      });

      // Notify the user
      await createNotification({
        userId,
        type: 'account_approved',
        subject: 'Account Approved',
        body: 'Congratulations! Your ForemanOS account has been approved. You can now log in and start using the platform.',
      });

      // Send approval email
      if (user.email) {
        await sendApprovalEmail(user.email, user.username, userId);
      }

      return NextResponse.json({
        message: 'User approved successfully',
        User: {
          id: userId,
          username: user.username,
          approved: true,
        },
      });
    } else {
      // Send rejection email before deleting
      if (user.email) {
        await sendRejectionEmail(user.email, user.username);
      }

      // Reject user - delete account
      await prisma.user.delete({
        where: { id: userId },
      });

      // Log the rejection
      await logActivity({
        userId: session.user.id,
        action: 'user_rejected',
        resource: 'user',
        resourceId: userId,
        details: {
          rejectedUser: user.username,
        },
        request,
      });

      return NextResponse.json({
        message: 'User rejected and removed',
      });
    }
  } catch (error) {
    console.error('Error approving/rejecting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
