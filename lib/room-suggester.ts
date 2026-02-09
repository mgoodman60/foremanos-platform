/**
 * Room Suggestion Service
 * 
 * Provides AI-powered suggestions for which room a photo belongs to,
 * used in the daily report workflow and photo library.
 */

import { prisma } from './db';
import { suggestRoomsForPhoto } from './photo-analyzer';
import { callLLM } from '@/lib/llm-providers';
import { SIMPLE_MODEL } from '@/lib/model-config';
import { logger } from '@/lib/logger';

export interface RoomSuggestion {
  roomId: string;
  roomNumber: string | null;
  roomName: string;
  confidence: number;
  reason: string;
}

/**
 * Get room suggestions for a photo based on its analysis
 */
export async function getRoomSuggestionsForPhoto(
  imageUrl: string,
  projectSlug: string,
  photoContext?: {
    caption?: string;
    aiDescription?: string;
    aiTags?: string;
  }
): Promise<RoomSuggestion[]> {
  return await suggestRoomsForPhoto(imageUrl, projectSlug, photoContext);
}

/**
 * Get room suggestions based on text context (without image analysis)
 * Useful for bulk assignment or when image analysis is unavailable
 */
export async function getRoomSuggestionsFromText(
  projectSlug: string,
  context: {
    description?: string;
    tags?: string;
    location?: string;
    tradeType?: string;
  }
): Promise<RoomSuggestion[]> {
  // Get all rooms for the project
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    include: {
      Room: {
        select: {
          id: true,
          name: true,
          roomNumber: true,
          type: true,
          floorNumber: true,
          tradeType: true,
          notes: true,
        },
      },
    },
  });

  if (!project || project.Room.length === 0) {
    return [];
  }

  // Build room context for AI
  const roomsList = project.Room.map((room: any) => 
    `- ID: ${room.id}, Number: ${room.roomNumber || 'N/A'}, Name: ${room.name}, Type: ${room.type}, Floor: ${room.floorNumber || 'N/A'}, Trade: ${room.tradeType || 'N/A'}`
  ).join('\n');

  let contextInfo = '';
  if (context.description) contextInfo += `\nDescription: ${context.description}`;
  if (context.tags) contextInfo += `\nTags: ${context.tags}`;
  if (context.location) contextInfo += `\nLocation: ${context.location}`;
  if (context.tradeType) contextInfo += `\nTrade Type: ${context.tradeType}`;

  const prompt = `You are determining which room(s) a construction photo belongs to based on the following information:${contextInfo}

Available rooms:
${roomsList}

Analyze the context and determine which room(s) the photo most likely belongs to.

Return your answer as JSON:
{
  "suggestions": [
    {
      "roomId": "room_id_here",
      "confidence": 0.95,
      "reason": "Brief explanation why this room matches"
    }
  ]
}

Guidelines:
- Only suggest rooms with confidence > 0.5
- Provide top 3 most likely rooms maximum
- Match by room type, trade type, location, description keywords
- Be specific in your reasoning
- Return ONLY valid JSON`;

  try {
    const llmResult = await callLLM(
      [{ role: 'user', content: prompt }],
      { model: SIMPLE_MODEL, temperature: 0.1, max_tokens: 500 }
    );

    const content = llmResult.content;

    if (!content) {
      throw new Error('No content in LLM response');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('ROOM_SUGGESTER', 'Could not extract JSON from response', undefined, { content });
      return [];
    }

    const result = JSON.parse(jsonMatch[0]);
    const suggestions: RoomSuggestion[] = [];

    for (const sug of result.suggestions || []) {
      const room = project.Room.find((r: any) => r.id === sug.roomId);
      if (room && sug.confidence > 0.5) {
        suggestions.push({
          roomId: room.id,
          roomNumber: room.roomNumber,
          roomName: room.name,
          confidence: sug.confidence,
          reason: sug.reason,
        });
      }
    }

    return suggestions.slice(0, 3); // Return top 3
  } catch (error) {
    logger.error('ROOM_SUGGESTER', 'Error suggesting rooms from text', error as Error);
    return [];
  }
}
