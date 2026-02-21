import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ai-render');

// Load API secrets
function getOpenAIKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

// Extract color and finish information from project documents
async function extractColorFinishInfo(projectSlug: string, roomName?: string): Promise<string> {
  try {
    // Get project
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true }
    });
    
    if (!project) return '';
    
    // Query document chunks for color/finish mentions
    const colorKeywords = [
      'color', 'finish', 'paint', 'stain', 'sherwin', 'benjamin moore',
      'wall finish', 'floor finish', 'ceiling finish', 'trim color',
      'accent color', 'base color', 'tile color', 'carpet color',
      'lvt', 'vinyl', 'laminate', 'wood tone', 'grey', 'gray', 'beige',
      'white', 'cream', 'tan', 'blue', 'green', 'neutral', 'warm', 'cool'
    ];
    
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          projectId: project.id,
          fileType: 'pdf'
        },
        OR: colorKeywords.map(keyword => ({
          content: { contains: keyword, mode: 'insensitive' as const }
        }))
      },
      select: {
        content: true,
        Document: {
          select: { name: true, category: true }
        }
      },
      take: 10
    });
    
    if (chunks.length === 0) return '';
    
    // Extract relevant sentences containing color/finish info
    const colorInfo: string[] = [];
    const colorPatterns = [
      /(?:wall|ceiling|floor|trim|accent|base)\s*(?:color|finish|paint)[\s:]+([A-Za-z0-9\s\-#]+)/gi,
      /(?:sherwin[\s-]?williams|benjamin[\s-]?moore|ppg|behr)[\s:]+([A-Za-z0-9\s\-#]+)/gi,
      /(?:paint|finish)[\s:]+(?:color\s*)?([A-Za-z0-9\s\-#]+)/gi,
      /(?:lvt|vct|carpet|tile|flooring)[\s:]+([A-Za-z0-9\s\-]+)/gi
    ];
    
    for (const chunk of chunks) {
      for (const pattern of colorPatterns) {
        const matches = chunk.content.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length < 50) {
            colorInfo.push(match[0].trim());
          }
        }
      }
    }
    
    // Also check for room-specific finishes
    if (roomName) {
      const rooms = await prisma.room.findMany({
        where: {
          projectId: project.id,
          OR: [
            { name: { contains: roomName, mode: 'insensitive' } },
            { type: { contains: roomName, mode: 'insensitive' } }
          ]
        },
        include: {
          FinishScheduleItem: true
        },
        take: 5
      });
      
      for (const room of rooms) {
        // Get finish items from relation
        if (room.FinishScheduleItem && room.FinishScheduleItem.length > 0) {
          for (const finish of room.FinishScheduleItem) {
            if (finish.category && finish.material) {
              colorInfo.push(`${finish.category}: ${finish.material}${finish.color ? ` (${finish.color})` : ''}`);
            } else if (finish.color) {
              colorInfo.push(`${finish.category || 'Finish'}: ${finish.color}`);
            }
          }
        }
      }
    }
    
    // Deduplicate and format
    const uniqueInfo = [...new Set(colorInfo)].slice(0, 8);
    
    if (uniqueInfo.length > 0) {
      return `Color and finish specifications from plans: ${uniqueInfo.join(', ')}. `;
    }
    
    return '';
  } catch (error) {
    logger.error('Error extracting color/finish info', error as Error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { modelId, projectSlug, prompt, settings } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Get OpenAI API key
    const openaiKey = getOpenAIKey();
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please configure it in settings.' },
        { status: 500 }
      );
    }

    // Extract color and finish information from project documents
    let colorFinishInfo = '';
    if (projectSlug) {
      // Try to extract room name from the prompt
      const roomMatch = prompt.match(/(?:room|bedroom|bathroom|kitchen|living|dining|office|lobby|hallway|corridor)\s*(?:\d+)?/i);
      const roomName = roomMatch ? roomMatch[0] : undefined;
      colorFinishInfo = await extractColorFinishInfo(projectSlug, roomName);
      logger.debug('Extracted color/finish info', { colorFinishInfo: colorFinishInfo || '(none found)' });
    }

    // Enhance the prompt for better construction visualization
    const enhancedPrompt = `Construction site visualization: ${prompt}. 
${colorFinishInfo}
Architectural rendering style, professional quality, realistic materials and textures, 
clear details of earthwork contours, drainage systems, and site infrastructure. 
Use accurate colors and finishes as specified in the project documents where available.
No text or labels in the image.`;

    logger.info('Generating image', { promptPreview: enhancedPrompt.substring(0, 300) });

    // Call OpenAI DALL-E API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1792x1024', // Landscape format for site plans
        quality: 'hd',
        style: settings?.style === 'sketch' ? 'natural' : 'vivid',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('OpenAI API error', undefined, { status: response.status, errorData });
      
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        );
      }
      
      if (response.status === 400 && errorData.error?.code === 'content_policy_violation') {
        return NextResponse.json(
          { error: 'The prompt was rejected. Please try different settings.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to generate image' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    const revisedPrompt = data.data?.[0]?.revised_prompt;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image was generated' },
        { status: 500 }
      );
    }

    // Log the generation
    try {
      await prisma.activityLog.create({
        data: {
          userId: (session.user as any).id,
          action: 'GENERATE_RENDER',
          details: JSON.stringify({
            modelId,
            projectSlug,
            promptPreview: prompt.substring(0, 100),
            settings,
          }),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    } catch (logError) {
      logger.error('Failed to log activity', logError as Error);
    }

    return NextResponse.json({
      id: Date.now().toString(),
      imageUrl,
      revisedPrompt,
      prompt: enhancedPrompt,
    });
  } catch (error) {
    logger.error('Generate render error', error as Error);
    return NextResponse.json(
      { error: 'Failed to generate render' },
      { status: 500 }
    );
  }
}
