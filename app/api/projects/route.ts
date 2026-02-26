import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { initializeRegulatoryDocumentsForProject } from '@/lib/regulatory-documents';
import { namespacePIN } from '@/lib/guest-pin-utils';
import { checkRateLimit, RATE_LIMITS, getClientIp, getRateLimitIdentifier } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { withCsrf } from '@/lib/csrf';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  guestUsername: z.string().min(1, 'Guest username is required').max(50, 'Guest username too long'),
  guestPassword: z.string().max(100, 'Guest password too long').optional().nullable(),
});

export const dynamic = 'force-dynamic';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export const POST = withCsrf(async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin and client can create projects
    if (session.user.role !== 'admin' && session.user.role !== 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limit
    const rateLimitId = getRateLimitIdentifier(session.user.id, getClientIp(request));
    const rateLimitResult = await checkRateLimit(rateLimitId, RATE_LIMITS.API);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body. Expected JSON.' },
        { status: 400 }
      );
    }

    const parsed = createProjectSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { name, guestUsername, guestPassword } = parsed.data;

    // Generate unique slug
    let slug = generateSlug(name);
    let counter = 1;

    // Check if slug already exists and append number if it does
    let existingSlug = await prisma.project.findUnique({
      where: { slug },
    });

    while (existingSlug) {
      slug = `${generateSlug(name)}-${counter}`;
      existingSlug = await prisma.project.findUnique({
        where: { slug },
      });
      counter++;
    }

    // Namespace the guest PIN with the owner's ID to prevent cross-user collisions
    const namespacedPin = namespacePIN(session.user.id, guestUsername);

    // Check if namespaced guest username already exists
    const existingGuestUsername = await prisma.project.findUnique({
      where: { guestUsername: namespacedPin },
    });

    if (existingGuestUsername) {
      return NextResponse.json(
        { error: 'This guest username is already taken' },
        { status: 400 }
      );
    }

    // Hash guest password if provided
    const hashedGuestPassword = guestPassword
      ? await bcrypt.hash(guestPassword, 10)
      : null;

    // Create project
    const project = await prisma.project.create({
      data: {
        name,
        slug,
        ownerId: session.user.id,
        guestUsername: namespacedPin,
        guestPassword: hashedGuestPassword,
      },
    });

    // Create owner membership
    await prisma.projectMember.create({
      data: {
        userId: session.user.id,
        projectId: project.id,
        role: 'owner',
      },
    });

    // Create guest user account
    const existingGuestUser = await prisma.user.findUnique({
      where: { username: namespacedPin },
    });

    if (!existingGuestUser) {
      const guestUser = await prisma.user.create({
        data: {
          username: namespacedPin,
          password: hashedGuestPassword,
          // @ts-expect-error strictNullChecks migration
          email: null as string | null,
          role: 'guest',
          approved: true,
          assignedProjectId: project.id,
        },
      });

      // Create guest membership
      await prisma.projectMember.create({
        data: {
          userId: guestUser.id,
          projectId: project.id,
          role: 'guest',
        },
      });
    }

    // Initialize regulatory documents for the project (link cached docs)
    // This runs in background - don't wait for it
    initializeRegulatoryDocumentsForProject(project.id)
      .then((result) => {
        logger.info('PROJECT_CREATION', `Linked ${result.documentsLinked} regulatory documents`, { projectId: project.id });
        if (result.documentsNeedingProcessing > 0) {
          logger.info('PROJECT_CREATION', `${result.documentsNeedingProcessing} regulatory documents need processing`, { projectId: project.id });
        }
      })
      .catch((error) => {
        logger.error('PROJECT_CREATION', 'Failed to initialize regulatory documents', error instanceof Error ? error : undefined, { projectId: project.id });
      });

    return NextResponse.json(
      {
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          guestUsername,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('PROJECT_CREATION', 'Error creating project', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
