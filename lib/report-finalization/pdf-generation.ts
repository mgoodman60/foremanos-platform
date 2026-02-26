/**
 * PDF generation for finalized reports
 */

import { prisma } from '../db';
import { getFileUrl } from '../s3';
import { format } from 'date-fns';
import { createScopedLogger } from '../logger';
import type {
  ReportData,
  PhotoEntry,
  WeatherSnapshot,
  MaterialDelivery,
  EquipmentEntry,
  ScheduleUpdateEntry,
  QuantityCalculation,
} from '../types/report-data';

const _log = createScopedLogger('PDF_GENERATION');

/**
 * Generate PDF for finalized report
 */
export async function generateReportPDF(conversationId: string): Promise<string> {
  const ReactPDF = await import('@react-pdf/renderer');
  const React = await import('react');
  const { DailyReportPDF } = await import('../pdf-template');
  const { uploadFile } = await import('../s3');

  // Get conversation data
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      Project: true,
      User: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const reportDate = conversation.dailyReportDate
    ? format(new Date(conversation.dailyReportDate), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');

  // Prepare photo URLs (convert S3 paths to signed URLs)
  const photos = (conversation.photos as unknown as PhotoEntry[] | null) || [];
  const photoData = await Promise.all(
    photos.map(async (photo) => {
      const url = await getFileUrl(photo.cloud_storage_path, photo.isPublic || false);
      return {
        id: photo.id,
        url,
        caption: photo.caption,
        location: photo.location,
        aiDescription: photo.aiDescription,
        aiConfidence: photo.aiConfidence,
      };
    })
  );

  // Get company logo URL
  let companyLogoUrl: string | undefined;
  if (conversation.User?.companyLogo) {
    companyLogoUrl = await getFileUrl(conversation.User.companyLogo, false);
  }

  // Prepare work entries
  const reportData = (conversation.reportData as ReportData | null) || {};
  const workPerformed = (reportData.workByTrade || []).map((w) => ({
    trade: w.trade,
    company: w.company,
    description: w.description,
    location: w.location,
    crewSize: w.crewSize,
  }));

  // Calculate total crew size
  const totalCrewSize = (reportData.crew || []).reduce((sum, c) => sum + (c.count || 0), 0);

  // Prepare weather snapshots
  const weatherSnapshots = ((conversation.weatherSnapshots as unknown as WeatherSnapshot[] | null) || []).map((w) => ({
    time: w.time,
    temperature: w.temperature,
    conditions: w.conditions,
    humidity: w.humidity,
    windSpeed: w.windSpeed,
  }));

  // Prepare material deliveries
  const materialDeliveries = ((conversation.materialDeliveries as unknown as MaterialDelivery[] | null) || []).map((m) => ({
    sub: m.sub,
    material: m.material,
    quantity: m.quantity !== undefined ? String(m.quantity) : undefined,
  }));

  // Prepare equipment
  const equipment = ((conversation.equipmentData as unknown as EquipmentEntry[] | null) || []).map((e) => ({
    name: e.name,
    type: e.type,
  }));

  // Prepare schedule updates
  const scheduleUpdates = ((conversation.scheduleUpdates as unknown as ScheduleUpdateEntry[] | null) || []).map((s) => ({
    activity: s.activity,
    plannedStatus: s.plannedStatus,
    actualStatus: s.actualStatus,
  }));

  // Prepare quantity calculations
  const quantityCalculations = ((conversation.quantityCalculations as unknown as QuantityCalculation[] | null) || []).map((q) => ({
    type: q.type,
    description: q.description,
    location: q.location,
    actualQuantity: q.actualQuantity,
    unit: q.unit,
  }));

  // Build PDF data
  const pdfData = {
    projectName: conversation.Project?.name || 'Project',
    projectAddress: conversation.Project?.projectAddress || undefined,
    reportDate: format(new Date(conversation.dailyReportDate || new Date()), 'MMMM dd, yyyy'),
    projectManager: conversation.Project?.projectManager || undefined,
    superintendent: conversation.Project?.superintendent || undefined,
    client: conversation.Project?.clientName || undefined,
    architectEngineer: conversation.Project?.architectEngineer || undefined,
    companyName: conversation.User?.username || undefined, // Use username as company name for now
    companyLogo: companyLogoUrl,
    weatherSnapshots: weatherSnapshots.length > 0 ? weatherSnapshots : undefined,
    workPerformed: workPerformed.length > 0 ? workPerformed : undefined,
    totalCrewSize: totalCrewSize > 0 ? totalCrewSize : undefined,
    photos: photoData.length > 0 ? photoData : undefined,
    materialDeliveries: materialDeliveries.length > 0 ? materialDeliveries : undefined,
    equipment: equipment.length > 0 ? equipment : undefined,
    scheduleUpdates: scheduleUpdates.length > 0 ? scheduleUpdates : undefined,
    quantityCalculations: quantityCalculations.length > 0 ? quantityCalculations : undefined,
    notes: reportData.notes,
    preparedBy: conversation.User?.username || conversation.User?.email || 'System',
    finalizationDate: format(new Date(), 'MMMM dd, yyyy h:mm a'),
  };

  // Generate PDF
  const pdfBuffer = await ReactPDF.renderToBuffer(
    // @ts-expect-error strictNullChecks migration
    React.createElement(DailyReportPDF, { data: pdfData }) as React.ReactElement<any>
  );

  // Upload to S3
  const fileName = `daily-report-${conversation.Project?.slug || 'project'}-${reportDate}.pdf`;

  // Upload using S3 (isPublic = false for private reports)
  const cloud_storage_path = await uploadFile(pdfBuffer, fileName, false);

  return cloud_storage_path;
}
