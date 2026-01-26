/**
 * Template Processor
 * Fills document templates with project data
 */

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { getFileUrl } from './s3';
import { prisma } from './db';

interface TemplateVariable {
  key: string;
  value: string | number | boolean | null;
  type?: 'text' | 'number' | 'date' | 'boolean';
}

interface TemplateData {
  // Project Info
  project_name?: string;
  project_slug?: string;
  project_owner?: string;
  project_address?: string;
  project_start_date?: string;
  project_end_date?: string;

  // Report Info
  report_date?: string;
  report_title?: string;
  report_created_by?: string;
  report_finalized_at?: string;

  // Weather Data
  weather_condition?: string;
  weather_temperature?: string;
  weather_precipitation?: string;
  weather_wind_speed?: string;
  weather_impact?: string;

  // Work Data
  crew_size?: number;
  crew_foreman?: string;
  hours_worked?: number;
  tasks_completed?: string;
  work_description?: string;
  work_locations?: string;

  // Progress Data
  percent_complete?: number;
  days_ahead_behind?: number;
  schedule_status?: string;

  // Materials & Equipment
  materials_delivered?: string;
  equipment_used?: string;
  equipment_issues?: string;

  // Safety & Quality
  safety_incidents?: number;
  quality_issues?: number;
  inspections?: string;

  // Photos
  photo_count?: number;
  photo_descriptions?: string;

  // Notes
  additional_notes?: string;
  next_day_plan?: string;

  // Custom fields (for extensibility)
  [key: string]: any;
}

/**
 * Extract template data from a daily report conversation
 */
export async function extractDailyReportData(
  conversationId: string
): Promise<TemplateData> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  }) as any;

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Get project separately
  const project: any = conversation.projectId
    ? await prisma.project.findUnique({
        where: { id: conversation.projectId },
        include: {
          User_Project_ownerIdToUser: {
            select: {
              username: true,
              email: true,
            },
          },
        },
      })
    : null;

  // Get user separately
  const user = conversation.userId
    ? await prisma.user.findUnique({
        where: { id: conversation.userId },
        select: {
          username: true,
          email: true,
        },
      })
    : null;

  // Get messages separately
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      userRole: true,
      message: true,
      createdAt: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Extract data from JSON fields
  const reportData = (conversation.reportData as any) || {};
  const weatherSnapshots = (conversation.weatherSnapshots as any) || [];
  const scheduledActivities = (conversation.scheduledActivities as any) || [];
  const workLocations = (conversation.workLocations as any) || [];
  const photos = (conversation.photos as any) || [];
  const equipmentData = (conversation.equipmentData as any) || {};
  const materialDeliveries = (conversation.materialDeliveries as any) || [];

  // Get latest weather snapshot
  const latestWeather = weatherSnapshots.length > 0 
    ? weatherSnapshots[weatherSnapshots.length - 1] 
    : null;

  // Extract work description from messages
  const workMessages = messages
    .filter((m: any) => m.userRole === 'user')
    .map((m: any) => m.message)
    .join('\n\n');

  // Extract tasks completed
  const tasksCompleted = scheduledActivities
    .filter((a: any) => a.status === 'completed')
    .map((a: any) => a.description || a.name)
    .join(', ');

  // Extract work locations
  const locationsList = workLocations
    .map((l: any) => l.name || l.location)
    .filter(Boolean)
    .join(', ');

  // Extract materials delivered
  const materialsDelivered = materialDeliveries
    .map((m: any) => `${m.quantity || ''} ${m.unit || ''} ${m.material || m.description || ''}`)
    .join(', ');

  // Extract equipment used
  const equipmentUsed = Object.keys(equipmentData)
    .map(key => {
      const equip = equipmentData[key];
      return equip.name || equip.type || key;
    })
    .join(', ');

  // Photo descriptions
  const photoDescriptions = photos
    .map((p: any, i: number) => `Photo ${i + 1}: ${p.description || p.caption || 'No description'}`)
    .join('\n');

  // Build address from location fields
  const projectAddress = project
    ? [
        project.locationCity,
        project.locationState,
        project.locationZip,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const templateData: TemplateData = {
    // Project Info
    project_name: project?.name || 'Unknown Project',
    project_slug: project?.slug || '',
    project_owner: project?.User_Project_ownerIdToUser?.username || 'Unknown',
    project_address: projectAddress,
    project_start_date: project?.startDate 
      ? new Date(project.startDate).toLocaleDateString()
      : '',
    project_end_date: project?.endDate
      ? new Date(project.endDate).toLocaleDateString()
      : '',

    // Report Info
    report_date: conversation.dailyReportDate
      ? new Date(conversation.dailyReportDate).toLocaleDateString()
      : new Date().toLocaleDateString(),
    report_title: conversation.title || 'Daily Report',
    report_created_by: user?.username || 'Unknown',
    report_finalized_at: conversation.finalizedAt
      ? new Date(conversation.finalizedAt).toLocaleString()
      : '',

    // Weather Data
    weather_condition: latestWeather?.condition || '',
    weather_temperature: latestWeather?.temperature 
      ? `${latestWeather.temperature}°F` 
      : '',
    weather_precipitation: latestWeather?.precipitation || '',
    weather_wind_speed: latestWeather?.windSpeed 
      ? `${latestWeather.windSpeed} mph` 
      : '',
    weather_impact: conversation.weatherImpactWarning || 'None',

    // Work Data
    crew_size: reportData.crewSize || 0,
    crew_foreman: reportData.foreman || reportData.crewForeman || '',
    hours_worked: reportData.hoursWorked || 0,
    tasks_completed: tasksCompleted || '',
    work_description: workMessages || '',
    work_locations: locationsList || '',

    // Progress Data
    percent_complete: reportData.percentComplete || 0,
    days_ahead_behind: reportData.daysAheadBehind || 0,
    schedule_status: reportData.scheduleStatus || 'On Track',

    // Materials & Equipment
    materials_delivered: materialsDelivered || '',
    equipment_used: equipmentUsed || '',
    equipment_issues: reportData.equipmentIssues || '',

    // Safety & Quality
    safety_incidents: reportData.safetyIncidents || 0,
    quality_issues: reportData.qualityIssues || 0,
    inspections: reportData.inspections || '',

    // Photos
    photo_count: photos.length || 0,
    photo_descriptions: photoDescriptions || '',

    // Notes
    additional_notes: reportData.notes || reportData.additionalNotes || '',
    next_day_plan: reportData.nextDayPlan || reportData.tomorrowsPlan || '',
  };

  return templateData;
}

/**
 * Process a DOCX template with data
 */
export async function processDocxTemplate(
  templateBuffer: Buffer,
  data: TemplateData
): Promise<Buffer> {
  try {
    // Load the template
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '', // Return empty string for null/undefined values
    });

    // Set the template data
    doc.setData(data);

    // Render the document
    doc.render();

    // Generate the output
    const output = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    return output;
  } catch (error) {
    console.error('[TEMPLATE_PROCESSOR] Error processing DOCX template:', error);
    throw new Error(
      `Failed to process DOCX template: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Process an XLSX template with data
 */
export async function processXlsxTemplate(
  templateBuffer: Buffer,
  data: TemplateData
): Promise<Buffer> {
  try {
    const XlsxPopulate = require('xlsx-populate');
    
    // Load the workbook
    const workbook = await XlsxPopulate.fromDataAsync(templateBuffer);

    // Replace variables in all sheets
    workbook.sheets().forEach((sheet: any) => {
      // Get all cells with formulas or values
      sheet.usedRange().forEach((cell: any) => {
        const value = cell.value();
        
        if (typeof value === 'string') {
          // Replace template variables like {{variable_name}}
          let newValue = value;
          Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            newValue = newValue.replace(regex, String(data[key] || ''));
          });
          
          if (newValue !== value) {
            cell.value(newValue);
          }
        }
      });
    });

    // Generate the output
    const output = await workbook.outputAsync();
    return output;
  } catch (error) {
    console.error('[TEMPLATE_PROCESSOR] Error processing XLSX template:', error);
    throw new Error(
      `Failed to process XLSX template: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get template file and process it with data
 */
export async function processTemplateById(
  templateId: string,
  data: TemplateData
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  // Get template from database
  const template = await prisma.documentTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  // Download template from S3
  const templateUrl = await getFileUrl(template.cloud_storage_path, template.isPublic);
  const response = await fetch(templateUrl);
  
  if (!response.ok) {
    throw new Error('Failed to download template from S3');
  }

  const templateBuffer = Buffer.from(await response.arrayBuffer());

  // Process based on file format
  let processedBuffer: Buffer;
  let contentType: string;

  switch (template.fileFormat.toLowerCase()) {
    case 'docx':
      processedBuffer = await processDocxTemplate(templateBuffer, data);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      break;

    case 'xlsx':
      processedBuffer = await processXlsxTemplate(templateBuffer, data);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;

    case 'pdf':
      // PDF templates are typically pre-filled forms
      // For now, we'll just return the original template
      // TODO: Implement PDF form filling with pdf-lib
      processedBuffer = templateBuffer;
      contentType = 'application/pdf';
      console.warn('[TEMPLATE_PROCESSOR] PDF template processing not yet implemented, returning original template');
      break;

    default:
      throw new Error(`Unsupported template format: ${template.fileFormat}`);
  }

  // Generate filename
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${template.name.replace(/\s+/g, '_')}_${timestamp}.${template.fileFormat}`;

  return {
    buffer: processedBuffer,
    filename,
    contentType,
  };
}

/**
 * Get available templates for a project and template type
 */
export async function getTemplatesForType(
  projectId: string | null,
  templateType: string
): Promise<Array<{ id: string; name: string; description: string | null; fileFormat: string }>> {
  const where: any = {
    templateType,
  };

  if (projectId) {
    where.OR = [
      { projectId },
      { projectId: null }, // Include global templates
    ];
  } else {
    where.projectId = null;
  }

  const templates = await prisma.documentTemplate.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      fileFormat: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return templates;
}
