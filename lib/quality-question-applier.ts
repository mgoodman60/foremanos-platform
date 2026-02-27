/**
 * Quality Question Applier
 * Applies user answers to chunk data and re-scores quality.
 */
import { prisma } from './db';
import { performQualityCheck, type ExtractedData } from './vision-api-quality';
import { logger } from '@/lib/logger';

export async function applyQuestionAnswer(
  questionId: string,
  answer: string,
  userId: string,
): Promise<{ qualityBefore: number; qualityAfter: number; fieldUpdated: string }> {
  // Get question with chunk
  const question = await prisma.qualityQuestion.findUnique({
    where: { id: questionId },
    include: { chunk: true },
  });

  if (!question) throw new Error('Question not found');
  if (!question.chunk) throw new Error('Chunk not found for question');
  if (question.applied) throw new Error('Answer already applied');

  // Parse existing chunk data from metadata or content
  let chunkData: ExtractedData;
  try {
    const _meta = question.chunk.metadata as Record<string, unknown> | null;
    // Try to parse content as JSON (formatVisionData output), or use metadata
    try {
      chunkData = JSON.parse(question.chunk.content);
    } catch {
      chunkData = (_meta || {}) as ExtractedData;
    }
  } catch {
    chunkData = {} as ExtractedData;
  }

  // Score before
  const qualityBefore = performQualityCheck(chunkData, question.pageNumber).score;

  // Apply answer to the target field
  setNestedField(chunkData, question.field, answer);

  // Re-score
  const qualityAfter = performQualityCheck(chunkData, question.pageNumber).score;

  // Update chunk content and quality score
  await prisma.$transaction([
    prisma.documentChunk.update({
      where: { id: question.chunk.id },
      data: {
        content: JSON.stringify(chunkData),
        qualityScore: qualityAfter,
        qualityPassed: qualityAfter >= 40,
      },
    }),
    prisma.qualityQuestion.update({
      where: { id: questionId },
      data: {
        answer,
        answeredBy: userId,
        answeredAt: new Date(),
        applied: true,
        confidenceBefore: qualityBefore,
        confidenceAfter: qualityAfter,
      },
    }),
  ]);

  logger.info('QUALITY_APPLIER', `Applied answer to ${question.field}`, {
    questionId,
    pageNumber: question.pageNumber,
    qualityBefore,
    qualityAfter,
  });

  return { qualityBefore, qualityAfter, fieldUpdated: question.field };
}

function setNestedField(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    // Handle array notation like "rooms[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const arr = current[arrayMatch[1]] as unknown[];
      if (!Array.isArray(arr)) return;
      current = arr[parseInt(arrayMatch[2])] as Record<string, unknown>;
    } else {
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
  }
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}
