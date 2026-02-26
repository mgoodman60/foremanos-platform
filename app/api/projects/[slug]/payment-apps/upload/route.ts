/**
 * Pay Application Upload API
 * Handles document uploads, AI parsing, and creates payment application records
 */

import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parsePayAppDocument, matchItemsToBudget } from '@/lib/pay-app-parser';
import { uploadFile, downloadFile } from '@/lib/s3';
import { validateS3Config } from '@/lib/aws-config';
import { logger } from '@/lib/logger';

export const maxDuration = 60; // Allow up to 60 seconds for processing

export async function POST(request: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const s3Check = validateS3Config();
    if (!s3Check.valid) {
      return NextResponse.json(
        { error: 'File storage is not configured. Please contact your administrator.' },
        { status: 503 }
      );
    }

    const { slug } = params;

    // Get project with budget
    const project = await prisma.project.findUnique({
      where: { slug }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get active budget separately
    const activeBudget = await prisma.projectBudget.findFirst({
      where: { projectId: project.id },
      include: {
        BudgetItem: true
      }
    });

    // Determine if this is a presigned URL confirmation (JSON) or legacy FormData upload
    const contentTypeHeader = request.headers.get('content-type') || '';
    const isPresignedConfirm = contentTypeHeader.includes('application/json');

    let buffer: Buffer;
    let fileName: string;
    let fileType: string;
    let cloudStoragePath: string | undefined;

    if (isPresignedConfirm) {
      // Presigned URL flow: file already in R2, download for parsing
      const body = await request.json();
      if (!body.cloudStoragePath || !body.fileName) {
        return NextResponse.json({ error: 'Missing cloudStoragePath or fileName' }, { status: 400 });
      }
      cloudStoragePath = body.cloudStoragePath;
      fileName = body.fileName;
      fileType = body.contentType || 'application/octet-stream';

      logger.info('PAY_APP_UPLOAD', `Downloading file from R2 for parsing: ${fileName}`, { cloudStoragePath });
      // @ts-expect-error strictNullChecks migration
      buffer = await downloadFile(cloudStoragePath);
    } else {
      // Legacy FormData flow
      const formData = await request.formData();
      const file = formData.get('file') as File;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
                            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'text/csv'];
      if (!allowedTypes.some(t => file.type.includes(t) || t.includes(file.type))) {
        return NextResponse.json({
          error: 'Invalid file type. Supported: PDF, Images, Excel, CSV'
        }, { status: 400 });
      }

      // Read file buffer
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileName = file.name;
      fileType = file.type;
    }

    logger.info('PAY_APP_UPLOAD', `Processing file: ${fileName}, type: ${fileType}, size: ${buffer.length}`);

    // Parse with AI
    const parsed = await parsePayAppDocument(buffer, fileName, fileType);

    logger.info('PAY_APP_UPLOAD', `Parsed: App #${parsed.applicationNumber}, ${parsed.items.length} items, confidence: ${parsed.confidence}`);

    // Check if application number already exists
    const existing = await prisma.paymentApplication.findUnique({
      where: {
        projectId_applicationNumber: {
          projectId: project.id,
          applicationNumber: parsed.applicationNumber
        }
      }
    });

    if (existing) {
      return NextResponse.json({
        error: `Pay Application #${parsed.applicationNumber} already exists`,
        existingId: existing.id,
        suggestion: 'Delete the existing pay app or upload with a different application number'
      }, { status: 409 });
    }

    // Upload supporting document to S3 (skip if already uploaded via presigned URL)
    let supportingDocUrl: string | undefined;
    if (cloudStoragePath) {
      // File already in R2 from presigned URL flow
      supportingDocUrl = cloudStoragePath;
    } else {
      try {
        const s3Key = `projects/${project.id}/pay-apps/${Date.now()}-${fileName}`;
        await uploadFile(buffer, s3Key, false); // private file
        supportingDocUrl = s3Key;
      } catch (uploadError) {
        logger.error('PAY_APP_UPLOAD', 'S3 upload failed', uploadError as Error);
        // Continue without supporting doc
      }
    }

    // Match items to budget if budget exists
    let budgetItemMatches: Map<any, string | null> | null = null;
    
    if (activeBudget && activeBudget.BudgetItem.length > 0) {
      budgetItemMatches = matchItemsToBudget(parsed.items, activeBudget.BudgetItem);
    }

    // Create payment application with items in transaction
    const paymentApp = await prisma.$transaction(async (tx) => {
      // Create payment application
      const payApp = await tx.paymentApplication.create({
        data: {
          projectId: project.id,
          budgetId: activeBudget?.id,
          applicationNumber: parsed.applicationNumber,
          periodStart: new Date(parsed.periodStart),
          periodEnd: new Date(parsed.periodEnd),
          scheduledValue: parsed.scheduledValue,
          previouslyApproved: parsed.previouslyApproved,
          currentPeriod: parsed.currentPeriod,
          totalCompleted: parsed.totalCompleted,
          retainage: parsed.retainage,
          retainagePercent: parsed.retainagePercent,
          netDue: parsed.netDue,
          status: 'SUBMITTED', // Auto-submit uploaded pay apps
          submittedAt: new Date(),
          supportingDocs: supportingDocUrl ? [supportingDocUrl] : [],
          createdBy: session.user.id
        }
      });

      // Create line items
      if (parsed.items.length > 0) {
        await tx.paymentApplicationItem.createMany({
          data: parsed.items.map(item => ({
            paymentAppId: payApp.id,
            budgetItemId: budgetItemMatches?.get(item) || null,
            costCode: item.costCode || null,
            description: item.description,
            scheduledValue: item.scheduledValue,
            fromPreviousApp: item.fromPreviousApp,
            thisApplication: item.thisApplication,
            materialsStored: item.materialsStored,
            totalCompleted: item.totalCompleted,
            percentComplete: item.percentComplete,
            balanceToFinish: item.balanceToFinish,
            retainage: item.retainage
          }))
        });
      }

      // Update budget item actuals if matches found
      if (budgetItemMatches && budgetItemMatches.size > 0) {
        for (const [item, budgetItemId] of budgetItemMatches) {
          if (budgetItemId) {
            await tx.budgetItem.update({
              where: { id: budgetItemId },
              data: {
                actualCost: item.totalCompleted,
                billedToDate: item.totalCompleted
              }
            });
          }
        }
      }

      // Create data source record
      // Using upsert since featureType is unique per project
      await tx.projectDataSource.upsert({
        where: {
          projectId_featureType: {
            projectId: project.id,
            featureType: 'budget'
          }
        },
        update: {
          sourceType: 'payment_application',
          confidence: parsed.confidence === 'high' ? 95 : parsed.confidence === 'medium' ? 75 : 55,
          extractedAt: new Date(),
          metadata: {
            paymentAppId: payApp.id,
            applicationNumber: parsed.applicationNumber,
            totalCompleted: parsed.totalCompleted,
            itemCount: parsed.items.length
          }
        },
        create: {
          projectId: project.id,
          featureType: 'budget',
          sourceType: 'payment_application',
          confidence: parsed.confidence === 'high' ? 95 : parsed.confidence === 'medium' ? 75 : 55,
          extractedAt: new Date(),
          metadata: {
            paymentAppId: payApp.id,
            applicationNumber: parsed.applicationNumber,
            totalCompleted: parsed.totalCompleted,
            itemCount: parsed.items.length
          }
        }
      });

      return payApp;
    });

    // Return success with details
    return NextResponse.json({
      success: true,
      paymentApplication: {
        id: paymentApp.id,
        applicationNumber: paymentApp.applicationNumber,
        periodStart: paymentApp.periodStart,
        periodEnd: paymentApp.periodEnd,
        currentPeriod: paymentApp.currentPeriod,
        totalCompleted: paymentApp.totalCompleted,
        netDue: paymentApp.netDue,
        status: paymentApp.status,
        itemCount: parsed.items.length
      },
      parsing: {
        confidence: parsed.confidence,
        warnings: parsed.warnings,
        matchedItems: budgetItemMatches ? 
          Array.from(budgetItemMatches.values()).filter(Boolean).length : 0,
        totalItems: parsed.items.length
      }
    });

  } catch (error) {
    logger.error('PAY_APP_UPLOAD', 'Error processing payment application', error as Error);
    return NextResponse.json({
      error: 'Failed to process payment application',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
