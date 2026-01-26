/**
 * Pay Application Upload API
 * Handles document uploads, AI parsing, and creates payment application records
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { parsePayAppDocument, matchItemsToBudget } from '@/lib/pay-app-parser';
import { uploadFile } from '@/lib/s3';

export const maxDuration = 60; // Allow up to 60 seconds for processing

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Parse form data
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
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[PayAppUpload] Processing file: ${file.name}, type: ${file.type}, size: ${buffer.length}`);

    // Parse with AI
    const parsed = await parsePayAppDocument(buffer, file.name, file.type);
    
    console.log(`[PayAppUpload] Parsed: App #${parsed.applicationNumber}, ` +
                `${parsed.items.length} items, confidence: ${parsed.confidence}`);

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

    // Upload supporting document to S3
    let supportingDocUrl: string | undefined;
    try {
      const s3Key = `projects/${project.id}/pay-apps/${Date.now()}-${file.name}`;
      await uploadFile(buffer, s3Key, false); // private file
      supportingDocUrl = s3Key;
    } catch (uploadError) {
      console.error('[PayAppUpload] S3 upload failed:', uploadError);
      // Continue without supporting doc
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
    console.error('[PayAppUpload] Error:', error);
    return NextResponse.json({
      error: 'Failed to process payment application',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
