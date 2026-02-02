/**
 * Photo Analysis Service
 * 
 * Analyzes construction progress photos using AI to:
 * - Generate descriptive captions
 * - Auto-tag content (flooring, walls, fixtures, etc.)
 * - Extract text via OCR
 */

import { prisma } from './db';

interface PhotoAnalysisResult {
  description: string;
  tags: string[];
  ocrText?: string;
  confidence: number;
}

interface RoomSuggestion {
  roomId: string;
  roomNumber: string | null;
  roomName: string;
  confidence: number;
  reason: string;
}

/**
 * Analyze a photo using GPT-4o Vision
 */
export async function analyzePhoto(
  imageUrl: string,
  projectSlug: string,
  context?: {
    roomNumber?: string;
    tradeType?: string;
    finishType?: string;
  }
): Promise<PhotoAnalysisResult> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Build context prompt
  let contextPrompt = '';
  if (context) {
    if (context.roomNumber) contextPrompt += `\nRoom: ${context.roomNumber}`;
    if (context.tradeType) contextPrompt += `\nTrade: ${context.tradeType}`;
    if (context.finishType) contextPrompt += `\nFinish Type: ${context.finishType}`;
  }

  const prompt = `You are analyzing a construction progress photo.${contextPrompt}

Provide analysis in the following JSON format:
{
  "description": "Clear, professional 1-2 sentence description of what's shown",
  "tags": ["tag1", "tag2", "tag3"],
  "ocrText": "Any visible text extracted from the image",
  "confidence": 0.95
}

Guidelines:
- Description should be concise and professional
- Tags should identify construction elements: flooring, walls, ceiling, fixtures, electrical, plumbing, framing, drywall, paint, trim, doors, windows, cabinets, countertops, tile, carpet, hardwood, concrete, masonry, roofing, hvac, etc.
- Include any visible brand names, materials, or finishes in tags
- Extract any visible text (measurements, labels, model numbers, signs)
- Confidence should reflect how clear and identifiable the image content is (0.0-1.0)
- Return ONLY valid JSON`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Vision API response');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not extract JSON from response:', content);
      return {
        description: 'Construction progress photo',
        tags: ['construction'],
        confidence: 0.5,
      };
    }

    const analysis = JSON.parse(jsonMatch[0]) as PhotoAnalysisResult;
    return analysis;
  } catch (error) {
    console.error('Error analyzing photo:', error);
    // Return fallback analysis
    return {
      description: 'Construction progress photo',
      tags: ['construction'],
      confidence: 0.3,
    };
  }
}

/**
 * Suggest which room(s) a photo belongs to based on AI analysis
 */
export async function suggestRoomsForPhoto(
  imageUrl: string,
  projectSlug: string,
  photoContext?: {
    caption?: string;
    aiDescription?: string;
    aiTags?: string;
  }
): Promise<RoomSuggestion[]> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

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
    `- ID: ${room.id}, Number: ${room.roomNumber || 'N/A'}, Name: ${room.name}, Type: ${room.type}, Floor: ${room.floorNumber || 'N/A'}`
  ).join('\n');

  let photoInfo = '';
  if (photoContext) {
    if (photoContext.caption) photoInfo += `\nCaption: ${photoContext.caption}`;
    if (photoContext.aiDescription) photoInfo += `\nDescription: ${photoContext.aiDescription}`;
    if (photoContext.aiTags) photoInfo += `\nTags: ${photoContext.aiTags}`;
  }

  const prompt = `You are analyzing a construction photo to determine which room(s) it belongs to.${photoInfo}

Available rooms:
${roomsList}

Analyze the photo and determine which room(s) it most likely belongs to.

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
- Only suggest rooms with confidence > 0.6
- Provide top 3 most likely rooms maximum
- Base suggestions on visible elements, room type indicators, finishes, etc.
- Be specific in your reasoning
- Return ONLY valid JSON`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Vision API response');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not extract JSON from response:', content);
      return [];
    }

    const result = JSON.parse(jsonMatch[0]);
    const suggestions: RoomSuggestion[] = [];

    for (const sug of result.suggestions || []) {
      const room = project.Room.find((r: any) => r.id === sug.roomId);
      if (room && sug.confidence > 0.6) {
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
    console.error('Error suggesting rooms:', error);
    return [];
  }
}

/**
 * Process and analyze an uploaded photo
 */
export async function processUploadedPhoto(
  photoId: string,
  projectSlug: string
): Promise<void> {
  // Get photo from database
  const photo = await prisma.roomPhoto.findUnique({
    where: { id: photoId },
    include: {
      Room: true,
    },
  });

  if (!photo) {
    throw new Error('Photo not found');
  }

  // Generate public URL for the photo
  const imageUrl = `/api/files/view?path=${photo.cloud_storage_path}`;
  const fullImageUrl = `${process.env.NEXTAUTH_URL}${imageUrl}`;

  // Analyze the photo
  const analysis = await analyzePhoto(
    fullImageUrl,
    projectSlug,
    {
      roomNumber: photo.Room.roomNumber || undefined,
      tradeType: photo.tradeType || undefined,
    }
  );

  // Update photo with analysis results
  await prisma.roomPhoto.update({
    where: { id: photoId },
    data: {
      aiDescription: analysis.description,
      aiTags: analysis.tags.join(', '),
      ocrText: analysis.ocrText,
      caption: photo.caption || analysis.description,
      aiGenerated: !photo.caption, // Mark as AI-generated if no user caption
    },
  });
}

/**
 * Batch process multiple photos
 */
export async function batchProcessPhotos(
  photoIds: string[],
  projectSlug: string
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  for (const photoId of photoIds) {
    try {
      await processUploadedPhoto(photoId, projectSlug);
      processed++;
    } catch (error) {
      console.error(`Failed to process photo ${photoId}:`, error);
      failed++;
    }
  }

  return { processed, failed };
}

// ============================================
// Legacy Utility Functions for Daily Reports
// (Kept for backward compatibility)
// ============================================

export interface PhotoMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  capturedAt?: string | Date;
  uploadedAt?: string | Date;
  caption?: string;
  captionSource?: 'auto' | 'user' | 'none';
  location?: string;
  trade?: string;
  aiDescription?: string;
  cloud_storage_path?: string;
  confidence?: number;
  workType?: string;
  materials?: string[];
  safety?: string[];
  dimensions?: { width: number; height: number; fileSize?: number };
}

/**
 * Generate a unique photo file name
 */
export function generatePhotoFileName(originalNameOrDate: string, sequence?: number, extension?: string): string {
  if (sequence !== undefined && extension !== undefined) {
    // Legacy format: generatePhotoFileName(date, sequence, extension)
    const date = originalNameOrDate;
    return `photo-${date}-${sequence}${extension}`;
  } else {
    // New format: generatePhotoFileName(originalName)
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = getFileExtension(originalNameOrDate);
    return `photo-${timestamp}-${random}${ext}`;
  }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  const match = fileName.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

/**
 * Check if file type is a valid image
 */
export function isValidImageType(mimeType: string): boolean {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif',
  ];
  return validTypes.includes(mimeType.toLowerCase());
}

/**
 * Get image dimensions (placeholder - actual implementation would need image processing library)
 */
export async function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number } | null> {
  try {
    // This is a placeholder. In production, you'd use sharp or another image library
    return null;
  } catch (error) {
    console.error('Error getting image dimensions:', error);
    return null;
  }
}

/**
 * Extract basic EXIF data from image (placeholder)
 */
export async function extractBasicExif(buffer: Buffer): Promise<{ capturedAt?: Date; location?: string } | null> {
  try {
    // This is a placeholder. In production, you'd use exif-parser or similar
    return null;
  } catch (error) {
    console.error('Error extracting EXIF:', error);
    return null;
  }
}

/**
 * Create photo metadata object
 */
export function createPhotoMetadata(
  id: string,
  originalFileName: string,
  generatedFileNameOrSize: string | number,
  cloudPathOrMimeType?: string,
  analysisOrAdditionalData?: any,
  userId?: string,
  dimensions?: any,
  exif?: any
): PhotoMetadata {
  // Check if this is the new signature (id, fileName, fileSize, mimeType, additionalData)
  if (typeof generatedFileNameOrSize === 'number') {
    const fileSize = generatedFileNameOrSize;
    const mimeType = cloudPathOrMimeType || 'image/jpeg';
    const additionalData = analysisOrAdditionalData;
    return {
      id,
      fileName: originalFileName,
      fileSize,
      mimeType,
      ...additionalData,
    };
  }
  
  // Legacy signature (id, originalName, generatedName, cloudPath, analysis, userId, dimensions, exif)
  const generatedFileName = generatedFileNameOrSize;
  const cloudPath = cloudPathOrMimeType;
  const analysis = analysisOrAdditionalData;
  
  return {
    id,
    fileName: originalFileName,
    fileSize: dimensions?.fileSize || 0,
    mimeType: 'image/jpeg',
    width: dimensions?.width,
    height: dimensions?.height,
    capturedAt: exif?.capturedAt,
    location: exif?.location,
    aiDescription: analysis?.description,
    cloud_storage_path: cloudPath,
  };
}

/**
 * Validate photo count doesn't exceed limits
 */
export function validatePhotoCount(
  currentCount: number,
  newCount: number,
  maxCount: number = 100
): { valid: boolean; error?: string } {
  const totalCount = currentCount + newCount;
  if (totalCount > maxCount) {
    return {
      valid: false,
      error: `Photo limit exceeded. Maximum ${maxCount} photos allowed.`,
    };
  }
  return { valid: true };
}

/**
 * Generate AI photo description (legacy wrapper)
 */
export async function generateAIPhotoDescription(
  imageUrl: string
): Promise<string> {
  try {
    const analysis = await analyzePhoto(imageUrl, '', {});
    return analysis.description;
  } catch (error) {
    console.error('Error generating AI description:', error);
    return 'Construction progress photo';
  }
}

/**
 * Format auto-generated caption
 */
export function formatAutoCaption(description: string): string {
  return `📸 ${description}`;
}

/**
 * Format clarification questions for photos
 */
export function formatClarificationQuestions(photoCount: number): string[] {
  if (photoCount === 0) {
    return [];
  }
  
  const questions = [
    'Would you like to add captions to any of these photos?',
    'Are these photos related to any specific room or area?',
  ];
  
  if (photoCount > 3) {
    questions.push('Would you like to organize these photos by category?');
  }
  
  return questions;
}

/**
 * Format neutral caption (legacy)
 */
export function formatNeutralCaption(description: string): string {
  return description;
}