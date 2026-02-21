/**
 * POST /api/conversations/[id]/generate-daily-report-pdf
 * 
 * Automatically generates and saves a daily report PDF after workflow completion.
 * This endpoint:
 * 1. Fetches workflow responses from conversation.reportData
 * 2. Fetches project info including company logo
 * 3. Fetches photos from the conversation
 * 4. Generates PDF using @react-pdf/renderer
 * 5. Saves PDF to S3
 * 6. Stores reference in Document table with category "Daily Report"
 * 7. Returns download URL
 */

import React from 'react';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { generatePresignedUploadUrl, getFileUrl } from '@/lib/s3';
import { format } from 'date-fns';
import ReactPDF from '@react-pdf/renderer';
import { DailyReportPDF, DailyReportData } from '@/lib/pdf-template';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch conversation with project and reportData
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        Project: {
          select: {
            id: true,
            name: true,
            slug: true,
            projectAddress: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    if (!conversation.Project) {
      return NextResponse.json(
        { error: 'Conversation is not associated with a project' },
        { status: 400 }
      );
    }

    if (!conversation.reportData) {
      return NextResponse.json(
        { error: 'No report data found for this conversation' },
        { status: 400 }
      );
    }

    // Parse reportData (from workflow responses)
    const reportData = conversation.reportData as Record<string, any>;

    // Get subcontractors data
    const subcontractorIds = reportData.Subcontractor || [];
    const subcontractors = await prisma.subcontractor.findMany({
      where: {
        id: { in: subcontractorIds },
        projectId: conversation.Project.id,
      },
    });

    // Get photos from the conversation (stored as JSON)
    const photosData = conversation.photos as any[] || [];
    
    // Generate photo URLs (limit to 20 photos = 5 pages of 4 photos each)
    const photoUrls = await Promise.all(
      photosData.slice(0, 20).map(async (photo: any, index: number) => ({
        id: photo.id || `photo-${index}`,
        url: photo.cloud_storage_path ? await getFileUrl(photo.cloud_storage_path, false) : '',
        caption: photo.caption || undefined,
        location: photo.location || undefined,
        aiDescription: photo.aiDescription || undefined,
        aiConfidence: photo.aiConfidence || undefined,
      }))
    );

    // Generate company logo URL if exists
    let companyLogoUrl: string | undefined;
    if (conversation.Project.logoUrl) {
      companyLogoUrl = await getFileUrl(conversation.Project.logoUrl, true);
    }

    // Build work performed entries from workflow data
    const workPerformed: Array<{ trade: string; company: string; description: string; location: string; }> = [];
    if (reportData.workCompleted) {
      // Parse work completed by subcontractors
      for (const sub of subcontractors) {
        workPerformed.push({
          trade: sub.tradeType,
          company: sub.companyName,
          description: reportData.workCompleted || '',
          location: reportData.workLocation || undefined,
        });
      }
    }

    // Build material deliveries from workflow data
    const materialDeliveries: Array<{ sub: string; material: string; quantity: string; }> = [];
    if (reportData.materialsDelivered) {
      materialDeliveries.push({
        sub: 'Various',
        material: reportData.materialsDelivered,
        quantity: reportData.materialsUsed || '',
      });
    }

    // Build equipment list from workflow data
    const equipment = [];
    if (reportData.equipmentOnSite) {
      const equipmentItems = reportData.equipmentOnSite.split(',');
      for (const item of equipmentItems) {
        equipment.push({
          name: item.trim(),
          status: 'Operational',
        });
      }
    }

    // Build schedule updates from workflow data
    const scheduleUpdates = [];
    if (reportData.delays === 'yes' && reportData.delayReason) {
      scheduleUpdates.push({
        activity: 'Daily Work',
        plannedStatus: 'On Schedule',
        actualStatus: `Delayed: ${reportData.delayReason}`,
      });
    }

    // Build weather snapshots
    const weatherSnapshots = [];
    if (conversation.weatherSnapshots) {
      const weather = conversation.weatherSnapshots as any;
      if (Array.isArray(weather)) {
        for (const snapshot of weather) {
          weatherSnapshots.push({
            time: snapshot.time || '',
            temperature: snapshot.temperature || 0,
            conditions: snapshot.conditions || '',
            humidity: snapshot.humidity,
            windSpeed: snapshot.windSpeed,
          });
        }
      }
    }

    // Build PDF data
    const pdfData: DailyReportData = {
      projectName: conversation.Project.name,
      projectAddress: conversation.Project.projectAddress || undefined,
      reportDate: format(conversation.dailyReportDate || new Date(), 'MMMM dd, yyyy'),
      companyLogo: companyLogoUrl,
      weatherSnapshots: weatherSnapshots.length > 0 ? weatherSnapshots : undefined,
      workPerformed: workPerformed.length > 0 ? workPerformed : undefined,
      totalCrewSize: reportData.crewCount ? parseInt(reportData.crewCount) : undefined,
      photos: photoUrls.length > 0 ? photoUrls : undefined,
      materialDeliveries: materialDeliveries.length > 0 ? materialDeliveries : undefined,
      equipment: equipment.length > 0 ? equipment : undefined,
      scheduleUpdates: scheduleUpdates.length > 0 ? scheduleUpdates : undefined,
      notes: reportData.notes || reportData.summary || undefined,
      preparedBy: session.user.email || 'System',
      finalizationDate: format(new Date(), 'MMMM dd, yyyy'),
    };

    // Generate PDF buffer
    const pdfBuffer = await ReactPDF.renderToBuffer(
      React.createElement(DailyReportPDF, { data: pdfData }) as any
    );

    // Generate filename: ProjectName_Daily_Report_MM-DD-YYYY.pdf
    const dateStr = format(conversation.dailyReportDate || new Date(), 'MM-dd-yyyy');
    const projectNameSlug = conversation.Project.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${projectNameSlug}_Daily_Report_${dateStr}.pdf`;

    // Upload PDF to S3
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      `daily-reports/${conversation.Project.id}/${fileName}`,
      'application/pdf',
      false // Private
    );

    // Upload the PDF buffer to S3
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/pdf',
      },
      body: pdfBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload PDF to S3');
    }

    // Save document reference in database
    const document = await prisma.document.create({
      data: {
        projectId: conversation.Project.id,
        name: fileName,
        fileName: fileName,
        fileType: 'pdf',
        cloud_storage_path,
        category: 'daily_reports',
        accessLevel: 'client', // Client access by default
        processed: true,
        syncSource: 'workflow_generated',
        isPublic: false,
      },
    });

    // Update conversation workflowState to 'finalized'
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        workflowState: 'finalized',
      },
    });

    // Generate download URL
    const downloadUrl = await getFileUrl(cloud_storage_path, false);

    return NextResponse.json({
      success: true,
      documentId: document.id,
      fileName,
      downloadUrl,
      message: 'Daily report PDF generated and saved successfully',
    });
  } catch (error) {
    console.error('[GENERATE_DAILY_REPORT_PDF_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to generate daily report PDF' },
      { status: 500 }
    );
  }
}
