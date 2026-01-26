import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { analyzeQuotePDF, linkOrCreateSubcontractor, convertQuoteToBudgetItems } from '@/lib/quote-analysis-service';
import { getFileUrl, deleteFile } from '@/lib/s3';

export const dynamic = 'force-dynamic';

// GET - Get a single quote with full details
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const quote = await prisma.subcontractorQuote.findUnique({
      where: { id: params.id },
      include: {
        Subcontractor: true,
        Uploader: {
          select: { id: true, username: true },
        },
      },
    });

    if (!quote || quote.projectId !== project.id) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Generate download URL
    const downloadUrl = await getFileUrl(quote.cloudStoragePath, false);

    return NextResponse.json({
      quote,
      downloadUrl,
    });
  } catch (error) {
    console.error('[QUOTE API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 });
  }
}

// PATCH - Update quote (manual edits, status changes, approval)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const quote = await prisma.subcontractorQuote.findUnique({
      where: { id: params.id },
    });

    if (!quote || quote.projectId !== project.id) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, ...updates } = body;

    let updatedQuote;

    switch (action) {
      case 'approve':
        updatedQuote = await prisma.subcontractorQuote.update({
          where: { id: params.id },
          data: {
            status: 'APPROVED',
            approvedBy: session.user.id,
            approvedAt: new Date(),
          },
        });
        break;

      case 'reject':
        updatedQuote = await prisma.subcontractorQuote.update({
          where: { id: params.id },
          data: {
            status: 'REJECTED',
            rejectionReason: updates.reason || 'No reason provided',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
          },
        });
        break;

      case 'reanalyze':
        // Re-run AI analysis
        const analysisResult = await analyzeQuotePDF(
          quote.cloudStoragePath,
          quote.originalFileName
        );

        if (analysisResult) {
          const subcontractorId = await linkOrCreateSubcontractor(project.id, analysisResult);

          updatedQuote = await prisma.subcontractorQuote.update({
            where: { id: params.id },
            data: {
              subcontractorId,
              companyName: analysisResult.companyName || quote.companyName,
              contactName: analysisResult.contactName,
              contactEmail: analysisResult.contactEmail,
              contactPhone: analysisResult.contactPhone,
              quoteNumber: analysisResult.quoteNumber,
              quoteDate: analysisResult.quoteDate ? new Date(analysisResult.quoteDate) : null,
              expirationDate: analysisResult.expirationDate ? new Date(analysisResult.expirationDate) : null,
              tradeType: analysisResult.tradeType as any,
              totalAmount: analysisResult.totalAmount || 0,
              laborCost: analysisResult.laborCost,
              materialCost: analysisResult.materialCost,
              equipmentCost: analysisResult.equipmentCost,
              overheadMarkup: analysisResult.overheadMarkup,
              contingency: analysisResult.contingency,
              scopeDescription: analysisResult.scopeDescription,
              inclusions: analysisResult.inclusions || [],
              exclusions: analysisResult.exclusions || [],
              assumptions: analysisResult.assumptions || [],
              aiExtracted: true,
              aiConfidence: analysisResult.confidence,
              extractedData: analysisResult as any,
              analysisNotes: analysisResult.analysisNotes,
            },
          });
        } else {
          return NextResponse.json(
            { error: 'Analysis failed' },
            { status: 500 }
          );
        }
        break;

      case 'import_to_budget':
        const itemsCreated = await convertQuoteToBudgetItems(params.id, project.id);
        updatedQuote = await prisma.subcontractorQuote.findUnique({
          where: { id: params.id },
        });
        return NextResponse.json({
          quote: updatedQuote,
          budgetItemsCreated: itemsCreated,
        });

      default:
        // General update
        updatedQuote = await prisma.subcontractorQuote.update({
          where: { id: params.id },
          data: {
            companyName: updates.companyName,
            contactName: updates.contactName,
            contactEmail: updates.contactEmail,
            contactPhone: updates.contactPhone,
            quoteNumber: updates.quoteNumber,
            quoteDate: updates.quoteDate ? new Date(updates.quoteDate) : undefined,
            expirationDate: updates.expirationDate ? new Date(updates.expirationDate) : undefined,
            tradeType: updates.tradeType,
            totalAmount: updates.totalAmount,
            laborCost: updates.laborCost,
            materialCost: updates.materialCost,
            equipmentCost: updates.equipmentCost,
            scopeDescription: updates.scopeDescription,
            inclusions: updates.inclusions,
            exclusions: updates.exclusions,
            assumptions: updates.assumptions,
            status: updates.status,
          },
        });
    }

    return NextResponse.json({ quote: updatedQuote });
  } catch (error) {
    console.error('[QUOTE API] PATCH Error:', error);
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
  }
}

// DELETE - Remove a quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { slug: params.slug },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const quote = await prisma.subcontractorQuote.findUnique({
      where: { id: params.id },
    });

    if (!quote || quote.projectId !== project.id) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Delete file from S3
    try {
      await deleteFile(quote.cloudStoragePath);
    } catch (e) {
      console.error('[QUOTE API] Error deleting file:', e);
    }

    // Delete quote record
    await prisma.subcontractorQuote.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[QUOTE API] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 });
  }
}
