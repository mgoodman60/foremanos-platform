import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createLogger } from '@/lib/logger';
const logger = createLogger('PROJECTS_PLANS_METADATA');

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

// GET /api/projects/[slug]/plans/[documentId]/metadata
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string; documentId: string }> }
) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, documentId } = params;

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

    if (!isOwner && !isMember && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        DocumentChunk: {
          select: {
            pageNumber: true
          },
          orderBy: {
            pageNumber: 'desc'
          },
          take: 1
        }
      }
    });

    if (!document || document.projectId !== project.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Get page count from chunks if available
    let totalPages = 1;
    if (document.DocumentChunk && document.DocumentChunk.length > 0 && document.DocumentChunk[0].pageNumber) {
      totalPages = document.DocumentChunk[0].pageNumber;
    } else if (document.fileType === 'pdf') {
      // Try to get page count from local file
      const localPath = path.join(process.cwd(), 'public', 'documents', document.fileName);
      
      if (fs.existsSync(localPath)) {
        try {
          const { stdout } = await execAsync(`pdfinfo "${localPath}" | grep Pages | awk '{print $2}'`);
          const pages = parseInt(stdout.trim(), 10);
          if (!isNaN(pages)) {
            totalPages = pages;
          }
        } catch (error) {
          logger.error('Error getting PDF page count', error);
        }
      }
    }

    return NextResponse.json({
      id: document.id,
      name: document.name,
      fileName: document.fileName,
      fileType: document.fileType,
      totalPages,
      uploadedAt: document.createdAt,
      processed: document.processed
    });
  } catch (error: unknown) {
    logger.error('Error fetching plan metadata', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to fetch plan metadata', details: errMsg },
      { status: 500 }
    );
  }
}
