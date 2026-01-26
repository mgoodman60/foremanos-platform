import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl } from '@/lib/s3';
import { analyzeQuotePDF, linkOrCreateSubcontractor } from '@/lib/quote-analysis-service';

export const dynamic = 'force-dynamic';

// GET - List all quotes for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tradeType = searchParams.get('tradeType');

    const quotes = await prisma.subcontractorQuote.findMany({
      where: {
        projectId: project.id,
        ...(status && { status: status as any }),
        ...(tradeType && { tradeType: tradeType as any }),
      },
      include: {
        Subcontractor: {
          select: { id: true, companyName: true, tradeType: true },
        },
        Uploader: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by trade for comparison view
    const byTrade: Record<string, typeof quotes> = {};
    for (const quote of quotes) {
      const trade = quote.tradeType || 'unspecified';
      if (!byTrade[trade]) byTrade[trade] = [];
      byTrade[trade].push(quote);
    }

    return NextResponse.json({
      quotes,
      byTrade,
      summary: {
        total: quotes.length,
        pending: quotes.filter((q: { status: string }) => q.status === 'PENDING').length,
        approved: quotes.filter((q: { status: string }) => q.status === 'APPROVED').length,
        totalValue: quotes.reduce((sum: number, q: { totalAmount: unknown }) => sum + Number(q.totalAmount), 0),
      },
    });
  } catch (error) {
    console.error('[QUOTES API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}

// POST - Upload and analyze a new quote
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
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

    const body = await request.json();
    const { fileName, contentType, fileSize, cloudStoragePath, analyzeNow = true } = body;

    if (!fileName || !cloudStoragePath) {
      return NextResponse.json(
        { error: 'fileName and cloudStoragePath are required' },
        { status: 400 }
      );
    }

    // Create initial quote record
    let quote = await prisma.subcontractorQuote.create({
      data: {
        projectId: project.id,
        companyName: 'Pending Analysis',
        totalAmount: 0,
        originalFileName: fileName,
        cloudStoragePath,
        fileSize,
        mimeType: contentType,
        uploadedBy: session.user.id,
        status: 'PENDING',
        inclusions: [],
        exclusions: [],
        assumptions: [],
        linkedBudgetItems: [],
      },
    });

    // Analyze the quote if requested
    if (analyzeNow) {
      const analysisResult = await analyzeQuotePDF(cloudStoragePath, fileName);

      if (analysisResult) {
        // Link or create subcontractor
        const subcontractorId = await linkOrCreateSubcontractor(project.id, analysisResult);

        // Update quote with extracted data
        quote = await prisma.subcontractorQuote.update({
          where: { id: quote.id },
          data: {
            subcontractorId,
            companyName: analysisResult.companyName || 'Unknown Company',
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
            status: analysisResult.confidence >= 0.7 ? 'UNDER_REVIEW' : 'PENDING',
          },
        });
      }
    }

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    console.error('[QUOTES API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 });
  }
}
