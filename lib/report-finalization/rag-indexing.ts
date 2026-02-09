/**
 * RAG indexing for finalized reports
 */

import { prisma } from '../db';
import { format } from 'date-fns';
import { createScopedLogger } from '../logger';
import type {
  ReportData,
  WeatherSnapshot,
  PhotoEntry,
  ScheduleUpdateEntry,
  QuantityCalculation,
} from '../types/report-data';

const log = createScopedLogger('RAG_INDEXING');

/**
 * Index report data for RAG queries
 */
export async function indexForRAG(conversationId: string): Promise<boolean> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        Project: true,
        ChatMessage: true,
      },
    });

    if (!conversation) {
      return false;
    }

    // Extract all report data into searchable text chunks
    const chunks: string[] = [];

    // 1. Report metadata
    const reportDate = conversation.dailyReportDate
      ? format(new Date(conversation.dailyReportDate), 'MMMM dd, yyyy')
      : format(new Date(), 'MMMM dd, yyyy');

    chunks.push(`Daily Report for ${reportDate}`);

    // 2. Weather data
    if (conversation.weatherSnapshots) {
      const snapshots = conversation.weatherSnapshots as unknown as WeatherSnapshot[];
      snapshots.forEach((w) => {
        chunks.push(
          `Weather at ${w.time}: ${w.temperature}°F, ${w.conditions}, Humidity: ${w.humidity}%, Wind: ${w.windSpeed} mph`
        );
      });
    }

    // 3. Work performed
    if (conversation.reportData) {
      const data = conversation.reportData as ReportData;

      if (data.workByTrade) {
        data.workByTrade.forEach((w) => {
          chunks.push(
            `Work performed by ${w.trade} (${w.company}): ${w.description} at ${w.location || 'site'}`
          );
        });
      }

      if (data.crew) {
        data.crew.forEach((c) => {
          chunks.push(`Crew: ${c.company} with ${c.count} workers`);
        });
      }
    }

    // 4. Photo captions
    if (conversation.photos) {
      const photos = conversation.photos as unknown as PhotoEntry[];
      photos.forEach((p) => {
        if (p.caption) {
          chunks.push(`Photo: ${p.caption} (Location: ${p.location || 'unknown'})`);
        }
      });
    }

    // 5. Schedule updates
    if (conversation.scheduleUpdates) {
      const updates = conversation.scheduleUpdates as unknown as ScheduleUpdateEntry[];
      updates.forEach((u) => {
        chunks.push(
          `Schedule update: ${u.activity} - Planned: ${u.plannedStatus}, Actual: ${u.actualStatus}`
        );
      });
    }

    // 6. Quantity calculations
    if (conversation.quantityCalculations) {
      const calcs = conversation.quantityCalculations as unknown as QuantityCalculation[];
      calcs.forEach((c) => {
        chunks.push(
          `Quantity: ${c.description} at ${c.location} - ${c.actualQuantity} ${c.unit}`
        );
      });
    }

    // Store chunks in database
    // In actual implementation, you would:
    // - Generate embeddings for each chunk
    // - Store in vector database or DocumentChunk table
    // - Link to conversation for retrieval

    // For now, we'll create a single document chunk with all data
    // Link to project's first document as a placeholder
    const firstDoc = await prisma.document.findFirst({
      where: { projectId: conversation.projectId || undefined },
      select: { id: true },
    });

    if (firstDoc) {
      await prisma.documentChunk.create({
        data: {
          documentId: firstDoc.id,
          content: chunks.join('\n\n'),
          chunkIndex: 0,
          metadata: {
            conversationId,
            reportDate: conversation.dailyReportDate,
            type: 'daily_report',
            projectId: conversation.projectId,
          },
        },
      });
    }

    return true;
  } catch (error) {
    log.error('RAG indexing error', error);
    return false;
  }
}
