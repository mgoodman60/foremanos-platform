import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

interface LogActivityParams {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, any>;
  request?: NextRequest;
}

export async function logActivity(params: LogActivityParams) {
  try {
    const { userId, action, resource, resourceId, details, request } = params;

    // Extract IP and user agent from request if provided
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (request) {
      ipAddress = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  undefined;
      userAgent = request.headers.get('user-agent') || undefined;
    }

    await prisma.activityLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Log to console but don't throw - audit logging should never break the app
    console.error('Failed to log activity:', error);
  }
}

// Helper function to create notification
export async function createNotification({
  userId,
  type,
  subject,
  body,
}: {
  userId: string;
  type: string;
  subject: string;
  body: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        subject,
        body,
      },
    });

    // Also log to console (simulated email)
    console.log(`
========================================
EMAIL NOTIFICATION
========================================
To: User ${userId}
Type: ${type}
Subject: ${subject}
Body: ${body}
========================================
`);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
