import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

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
    // Log but don't throw - audit logging should never break the app
    logger.error('AUDIT_LOG', 'Failed to log activity', error instanceof Error ? error : undefined);
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

    logger.info('AUDIT_LOG', 'Email notification created', { userId, type, subject });
  } catch (error) {
    logger.error('AUDIT_LOG', 'Failed to create notification', error instanceof Error ? error : undefined);
  }
}
