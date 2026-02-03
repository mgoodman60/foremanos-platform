import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { initializeRegulatoryDocumentsForProject } from '@/lib/regulatory-documents';

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

    // Check if guest username already exists
    const existingGuestUsername = await prisma.project.findUnique({
      where: { guestUsername },
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
        guestUsername,
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
      where: { username: guestUsername },
    });

    if (!existingGuestUser) {
      const guestUser = await prisma.user.create({
        data: {
          username: guestUsername,
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
        console.log(
          `[ProjectCreation] Linked ${result.documentsLinked} regulatory documents to project ${project.id}`
        );
        if (result.documentsNeedingProcessing > 0) {
          console.log(
            `[ProjectCreation] ${result.documentsNeedingProcessing} regulatory documents need processing`
          );
        }
      })
      .catch((error) => {
        console.error('[ProjectCreation] Failed to initialize regulatory documents:', error);
      });

    return NextResponse.json(
      {
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          guestUsername: project.guestUsername,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
