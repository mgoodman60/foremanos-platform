/**
 * Daily Report Indexer
 * Chunks daily report content into DailyReportChunk records for RAG retrieval.
 * Each section (summary, weather, labor, etc.) is split into ~1000-char chunks
 * and stored with metadata for efficient search and filtering.
 */

import { prisma } from '@/lib/db';
import { createScopedLogger } from '@/lib/logger';

const log = createScopedLogger('DAILY_REPORT_INDEXER');

// Types
export interface IndexResult {
  chunksCreated: number;
  errors: string[];
}

export interface SearchOptions {
  dateFrom?: Date;
  dateTo?: Date;
  sections?: string[];
  limit?: number;
}

export interface DailyReportChunkResult {
  id: string;
  content: string;
  section: string;
  reportDate: Date;
  dailyReportId: string;
  metadata: Record<string, unknown> | null;
  chunkIndex: number;
}

interface ChunkData {
  dailyReportId: string;
  projectId: string;
  content: string;
  chunkIndex: number;
  section: string;
  reportDate: Date;
  metadata: Record<string, string | number | boolean | string[] | null>;
}

/**
 * Index a daily report by splitting its content into searchable chunks.
 * Deletes any existing chunks for the report before re-indexing.
 */
export async function indexDailyReport(reportId: string): Promise<IndexResult> {
  log.info('Indexing daily report', { reportId });

  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: {
      laborEntries: true,
      equipmentEntries: true,
      progressEntries: true,
      project: { select: { id: true } },
    },
  });

  if (!report) {
    log.warn('Report not found', { reportId });
    return { chunksCreated: 0, errors: ['Report not found'] };
  }

  // Delete existing chunks for re-index
  await prisma.dailyReportChunk.deleteMany({
    where: { dailyReportId: reportId },
  });

  const metadata = buildMetadata(report);
  const chunks: ChunkData[] = [];
  let chunkIndex = 0;

  // Summary section
  const summaryText = [report.workPerformed, report.workPlanned]
    .filter(Boolean)
    .join('\n');
  if (summaryText.trim()) {
    for (const part of splitIntoChunks(summaryText)) {
      chunks.push(makeChunk(report, 'summary', part, chunkIndex++, metadata));
    }
  }

  // Weather section
  const weatherText = buildWeatherText(report);
  if (weatherText.trim()) {
    chunks.push(makeChunk(report, 'weather', weatherText, chunkIndex++, metadata));
  }

  // Labor section
  const laborLines = report.laborEntries.map(
    (e) =>
      `${e.tradeName}: ${e.workerCount} workers, ${e.regularHours}h regular + ${e.overtimeHours || 0}h OT @ $${e.hourlyRate}/hr = $${e.totalCost}`
  );
  const laborText = laborLines.join('\n');
  if (laborText.trim()) {
    for (const part of splitIntoChunks(laborText)) {
      chunks.push(makeChunk(report, 'labor', part, chunkIndex++, metadata));
    }
  }

  // Equipment section
  const equipmentLines = report.equipmentEntries.map((e) => {
    const rate = e.hourlyRate || e.dailyRate;
    return `${e.equipmentName}: ${e.hours}h @ $${rate}/hr, fuel: $${e.fuelCost || 0}, total: $${e.totalCost}`;
  });
  const equipmentText = equipmentLines.join('\n');
  if (equipmentText.trim()) {
    for (const part of splitIntoChunks(equipmentText)) {
      chunks.push(makeChunk(report, 'equipment', part, chunkIndex++, metadata));
    }
  }

  // Progress section
  const progressLines = report.progressEntries.map(
    (e) =>
      `${e.activityName}: ${e.unitsCompleted} units completed (${e.percentComplete}% complete), earned: $${e.valueEarned || 0}`
  );
  const progressText = progressLines.join('\n');
  if (progressText.trim()) {
    for (const part of splitIntoChunks(progressText)) {
      chunks.push(makeChunk(report, 'progress', part, chunkIndex++, metadata));
    }
  }

  // Delays section
  if (report.delaysEncountered) {
    const delayText = `Delays: ${report.delaysEncountered}. Hours lost: ${report.delayHours || 0}. Reason: ${report.delayReason || 'N/A'}`;
    chunks.push(makeChunk(report, 'delays', delayText, chunkIndex++, metadata));
  }

  // Safety section
  const safetyText = `Safety incidents: ${report.safetyIncidents}. ${report.safetyNotes || 'No safety notes.'}`;
  if (report.safetyIncidents > 0 || report.safetyNotes) {
    chunks.push(makeChunk(report, 'safety', safetyText, chunkIndex++, metadata));
  }

  // Notes section (materialsReceived + visitors)
  const notesText = buildNotesText(report);
  if (notesText.trim()) {
    for (const part of splitIntoChunks(notesText)) {
      chunks.push(makeChunk(report, 'notes', part, chunkIndex++, metadata));
    }
  }

  if (chunks.length === 0) {
    log.info('No content to index', { reportId });
    return { chunksCreated: 0, errors: [] };
  }

  await prisma.dailyReportChunk.createMany({ data: chunks });

  log.info('Indexed daily report', { reportId, chunksCreated: chunks.length });
  return { chunksCreated: chunks.length, errors: [] };
}

/**
 * Delete all chunks for a daily report.
 */
export async function deleteDailyReportChunks(reportId: string): Promise<number> {
  const result = await prisma.dailyReportChunk.deleteMany({
    where: { dailyReportId: reportId },
  });
  log.info('Deleted daily report chunks', { reportId, count: result.count });
  return result.count;
}

/**
 * Search daily report chunks by text content with optional filters.
 */
export async function searchDailyReportChunks(
  projectId: string,
  query: string,
  options?: SearchOptions
): Promise<DailyReportChunkResult[]> {
  const where: Record<string, unknown> = {
    projectId,
    content: { contains: query, mode: 'insensitive' },
  };

  if (options?.dateFrom || options?.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (options.dateFrom) dateFilter.gte = options.dateFrom;
    if (options.dateTo) dateFilter.lte = options.dateTo;
    where.reportDate = dateFilter;
  }

  if (options?.sections && options.sections.length > 0) {
    where.section = { in: options.sections };
  }

  const results = await prisma.dailyReportChunk.findMany({
    where,
    orderBy: { reportDate: 'desc' },
    take: options?.limit || 10,
  });

  return results.map((r) => ({
    id: r.id,
    content: r.content,
    section: r.section,
    reportDate: r.reportDate,
    dailyReportId: r.dailyReportId,
    metadata: r.metadata as Record<string, unknown> | null,
    chunkIndex: r.chunkIndex,
  }));
}

/**
 * Split text into chunks of ~maxLength characters, breaking at sentence
 * boundaries or newlines when possible.
 */
export function splitIntoChunks(text: string, maxLength: number = 1000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let breakPoint = -1;

    // Try newline break
    const lastNewline = remaining.lastIndexOf('\n', maxLength);
    if (lastNewline > maxLength * 0.3) {
      breakPoint = lastNewline + 1;
    }

    // Try sentence break if no good newline
    if (breakPoint === -1) {
      const lastPeriod = remaining.lastIndexOf('. ', maxLength);
      if (lastPeriod > maxLength * 0.3) {
        breakPoint = lastPeriod + 2;
      }
    }

    // Hard break at maxLength if no good boundary found
    if (breakPoint === -1) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.slice(0, breakPoint).trimEnd());
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks.filter((c) => c.length > 0);
}

// Internal helpers

function makeChunk(
  report: { id: string; projectId: string; reportDate: Date },
  section: string,
  content: string,
  chunkIndex: number,
  metadata: Record<string, string | number | boolean | string[] | null>
): ChunkData {
  return {
    dailyReportId: report.id,
    projectId: report.projectId,
    content,
    chunkIndex,
    section,
    reportDate: report.reportDate,
    metadata,
  };
}

function buildMetadata(report: {
  reportNumber: number;
  reportDate: Date;
  weatherCondition: string | null;
  safetyIncidents: number;
  status: string;
  laborEntries: Array<{ tradeName: string; workerCount: number }>;
}): Record<string, string | number | boolean | string[] | null> {
  const trades = Array.from(new Set(report.laborEntries.map((e) => e.tradeName)));
  const crewCount = report.laborEntries.reduce((sum, e) => sum + e.workerCount, 0);

  return {
    reportNumber: report.reportNumber,
    reportDate: report.reportDate.toISOString(),
    trades,
    crewCount,
    weatherCondition: report.weatherCondition,
    safetyIncidents: report.safetyIncidents,
    status: report.status,
  };
}

function buildWeatherText(report: {
  weatherCondition: string | null;
  temperatureHigh: number | null;
  temperatureLow: number | null;
  humidity: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  weatherNotes: string | null;
}): string {
  if (!report.weatherCondition) return '';

  const parts = [`Weather: ${report.weatherCondition}`];
  if (report.temperatureHigh != null) parts.push(`High: ${report.temperatureHigh}°F`);
  if (report.temperatureLow != null) parts.push(`Low: ${report.temperatureLow}°F`);
  if (report.humidity != null) parts.push(`Humidity: ${report.humidity}%`);
  if (report.precipitation != null) parts.push(`Precipitation: ${report.precipitation}mm`);
  if (report.windSpeed != null) parts.push(`Wind: ${report.windSpeed}mph`);

  let text = parts.join(', ');
  if (report.weatherNotes) {
    text += `. ${report.weatherNotes}`;
  }

  return text;
}

function buildNotesText(report: {
  materialsReceived: unknown;
  visitors: unknown;
}): string {
  const parts: string[] = [];

  if (report.materialsReceived) {
    const materials = Array.isArray(report.materialsReceived)
      ? report.materialsReceived
      : [];
    if (materials.length > 0) {
      parts.push('Materials received: ' + materials.map(String).join(', '));
    }
  }

  if (report.visitors) {
    const visitors = Array.isArray(report.visitors) ? report.visitors : [];
    if (visitors.length > 0) {
      parts.push('Visitors: ' + visitors.map(String).join(', '));
    }
  }

  return parts.join('\n');
}
