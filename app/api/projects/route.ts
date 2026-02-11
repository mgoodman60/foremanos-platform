import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { initializeRegulatoryDocumentsForProject } from '@/lib/regulatory-documents';
import { namespacePIN } from '@/lib/guest-pin-utils';
import { checkRateLimit, RATE_LIMITS, getClientIp, getRateLimitIdentifier } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

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

    const { name, guestUsername, guestPassword } = await request.json();

    if (!name || !guestUsername) {
      return NextResponse.json(
        { error: 'Project name and guest username are required' },
        { status: 400 }
      );
    }

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
          email: null,
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
}
