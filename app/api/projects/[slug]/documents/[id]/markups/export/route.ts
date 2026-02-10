import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { downloadFile } from '@/lib/s3';
import { PDFDocument } from 'pdf-lib';

interface RouteContext {
  params: Promise<{ slug: string; id: string }>;
}

async function resolveContext(slug: string, documentId: string, userEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true } });
  if (!user) return null;
  const document = await prisma.document.findFirst({
    where: { id: documentId, Project: { slug, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] } },
    select: { id: true, projectId: true, name: true, cloud_storage_path: true },
  });
  if (!document) return null;
  return { userId: user.id, documentId: document.id, projectId: document.projectId, documentName: document.name, storagePath: document.cloud_storage_path };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitCheck = await checkRateLimit(session.user.email, RATE_LIMITS.API);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const params = await context.params;
    const ctx = await resolveContext(params.slug, params.id, session.user.email);
    if (!ctx) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const body = await request.json();
    const { format, includeComments, includeMeasurements, includeMetadata } = body;

    const markups = await prisma.markup.findMany({
      where: {
        documentId: ctx.documentId,
        deletedAt: null,
      },
      include: {
        Creator: { select: { name: true } },
        Layer: { select: { name: true, color: true } },
        Replies: {
          where: { deletedAt: null },
          include: {
            Creator: { select: { name: true } },
          },
        },
      },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
    });

    if (format === 'csv') {
      const headers = ['Page', 'Type', 'Label', 'Status', 'Priority', 'Tags', 'Layer', 'Created By', 'Created At'];
      if (includeMeasurements) {
        headers.push('Measurement Value', 'Measurement Unit');
      }
      if (includeComments) {
        headers.push('Comments Count');
      }

      const rows = [headers.join(',')];

      for (const markup of markups) {
        const row = [
          markup.pageNumber.toString(),
          markup.shapeType.replace(/_/g, ' '),
          `"${markup.label || ''}"`,
          markup.status,
          markup.priority,
          `"${markup.tags.join(', ')}"`,
          `"${markup.Layer?.name || 'Default'}"`,
          `"${markup.Creator.name}"`,
          new Date(markup.createdAt).toISOString(),
        ];

        if (includeMeasurements) {
          row.push(markup.measurementValue?.toString() || '', markup.measurementUnit || '');
        }

        if (includeComments) {
          row.push(markup.Replies.length.toString());
        }

        rows.push(row.join(','));
      }

      const csv = rows.join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="markups-export.csv"`,
        },
      });
    }

    if (format === 'pdf') {
      if (!ctx.storagePath) {
        return NextResponse.json({ error: 'Document file not found' }, { status: 404 });
      }

      const pdfBuffer = await downloadFile(ctx.storagePath);
      const pdfDoc = await PDFDocument.load(pdfBuffer);

      for (const markup of markups) {
        const page = pdfDoc.getPages()[markup.pageNumber - 1];
        if (!page) continue;

        const { height } = page.getSize();
        const geometry = markup.geometry as { x?: number; y?: number; width?: number; height?: number };

        if (markup.shapeType === 'text_box' && markup.content) {
          const x = geometry.x || 50;
          const y = height - (geometry.y || 50);
          page.drawText(markup.content, { x, y, size: 12 });
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();

      return new NextResponse(modifiedPdfBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="markups-export.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    logger.error('MARKUPS_EXPORT', 'Failed to export markups', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
