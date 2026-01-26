import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { SSEStream } from '@/lib/websocket-server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const projectSlug = params.slug;

    // Create SSE stream
    const sseStream = new SSEStream();
    const stream = sseStream.createStream(projectSlug);

    // Return streaming response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      }
    });
  } catch (error: any) {
    console.error('Realtime stream error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create realtime stream' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
