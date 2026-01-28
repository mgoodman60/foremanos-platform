import '../snapshots/mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContext } from '@/lib/chat/processors/context-builder';
import { manageConversation } from '@/lib/chat/processors/conversation-manager';
import { handleLLMRequest } from '@/lib/chat/processors/llm-handler';
import { streamResponse } from '@/lib/chat/processors/response-streamer';
import { prisma } from '@/lib/db';
import type { ContextBuilderOptions, LLMHandlerOptions, StreamResponseOptions } from '@/types/chat';

describe('Chat API Processors Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ABACUSAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('buildContext should build context for text queries', async () => {
    const options: ContextBuilderOptions = {
      message: 'What is the schedule?',
      image: null,
      projectSlug: 'test-project',
      userRole: 'admin',
    };

    const context = await buildContext(options);

    expect(Array.isArray(context.chunks)).toBe(true);
    expect(context.chunks.length).toBeGreaterThan(0);
    expect(typeof context.contextPrompt).toBe('string');
    expect(context.contextPrompt).toContain('Available Project Documents');
    expect(Array.isArray(context.retrievalLog)).toBe(true);
  });

  it('buildContext should handle image-only queries', async () => {
    const options: ContextBuilderOptions = {
      message: null,
      image: 'base64-encoded-image-data',
      projectSlug: 'test-project',
      userRole: 'admin',
    };

    const context = await buildContext(options);

    expect(Array.isArray(context.chunks)).toBe(true);
    expect(context.contextPrompt).toContain('IMAGE ANALYSIS REQUIRED');
  });

  it('manageConversation should create conversation when missing', async () => {
    const result = await manageConversation({
      userId: 'test-user',
      conversationId: null,
      projectSlug: 'test-project',
      message: 'Hello',
      userRole: 'client',
    });

    expect(result.id).toBeTruthy();
    expect(result.projectId).toBe('project-1');
    expect(result.created).toBe(true);

    const prismaMock = prisma as unknown as {
      conversation: { create: ReturnType<typeof vi.fn> };
    };
    expect(prismaMock.conversation.create).toHaveBeenCalled();
  });

  it('manageConversation should reuse existing conversation', async () => {
    const existingConversationId = 'existing-conv-id';

    const result = await manageConversation({
      userId: 'test-user',
      conversationId: existingConversationId,
      projectSlug: 'test-project',
      message: 'Follow up',
      userRole: 'client',
    });

    expect(result.id).toBe(existingConversationId);
    expect(result.created).toBe(false);
  });

  it('handleLLMRequest should return streaming response metadata', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const options: LLMHandlerOptions = {
      message: 'What is the schedule?',
      image: null,
      context: {
        chunks: [],
        documentNames: [],
        contextPrompt: 'Test context',
        retrievalLog: [],
      },
      conversationId: 'test-conv',
      projectSlug: 'test-project',
      userRole: 'admin',
    };

    const response = await handleLLMRequest(options);

    expect(response).toHaveProperty('stream');
    expect(response).toHaveProperty('model');
    expect(response.model).toBe('gpt-4');
  });

  it('streamResponse should format SSE responses and metadata', async () => {
    const encoder = new TextEncoder();
    const llmStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const options: StreamResponseOptions = {
      llmResponse: {
        stream: llmStream,
        model: 'gpt-4',
      },
      conversation: {
        id: 'test-conv',
        projectId: 'test-project',
        created: false,
      },
      context: {
        chunks: [
          {
            id: 'chunk-1',
            content: 'Chunk content',
            documentId: 'doc-1',
            regulatoryDocumentId: null,
            pageNumber: 1,
            metadata: { documentName: 'Plans.pdf' },
            isRegulatory: false,
            documentName: 'Plans.pdf',
            sheetNumber: 'A1',
          },
        ],
        documentNames: ['Plans.pdf'],
        contextPrompt: 'Test',
        retrievalLog: [],
      },
      message: 'Test message',
      userId: 'test-user',
      userRole: 'admin',
    };

    const response = streamResponse(options);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (reader) {
      // Drain the stream to allow async processing to complete
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  });
});
