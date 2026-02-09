import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// No external dependencies to mock for this module
// The websocket-server module is self-contained with in-memory state

// Import after mocks (even though no mocks needed)
import {
  RealtimeEvent,
  Subscriber,
  realtimeEvents,
  emitDocumentProcessed,
  emitChatResponse,
  emitSystemNotification,
  emitCacheInvalidated,
  emitDataUpdated,
  SSEStream,
} from '@/lib/websocket-server';

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

describe('WebSocket Server', () => {
  let testCounter = 0;

  // Helper to get unique project slug for test isolation
  const getTestProject = () => `test-project-${++testCounter}`;

  // Helper to clear event history via reflection (private property access)
  const clearEventHistory = () => {
    // Access private eventHistory property to clear it
    (realtimeEvents as any).eventHistory = [];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Clear all subscribers before each test
    realtimeEvents.clearSubscribers();
    // Clear event history to prevent test contamination
    clearEventHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('RealtimeEventBus', () => {
    describe('subscribe', () => {
      it('should create a subscription and return subscription ID', () => {
        const callback = vi.fn();
        const subId = realtimeEvents.subscribe('project-1', callback);

        expect(subId).toMatch(/^sub-\d+-[a-z0-9]+$/);
        expect(realtimeEvents.getSubscriberCount()).toBe(1);
      });

      it('should create unique subscription IDs', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const subId1 = realtimeEvents.subscribe('project-1', callback1);
        const subId2 = realtimeEvents.subscribe('project-1', callback2);

        expect(subId1).not.toBe(subId2);
        expect(realtimeEvents.getSubscriberCount()).toBe(2);
      });

      it('should allow wildcard subscriptions', () => {
        const callback = vi.fn();
        const subId = realtimeEvents.subscribe('*', callback);

        expect(subId).toBeDefined();
        expect(realtimeEvents.getSubscriberCount()).toBe(1);
      });
    });

    describe('unsubscribe', () => {
      it('should remove subscriber and return true', () => {
        const callback = vi.fn();
        const subId = realtimeEvents.subscribe('project-1', callback);

        expect(realtimeEvents.getSubscriberCount()).toBe(1);

        const result = realtimeEvents.unsubscribe(subId);

        expect(result).toBe(true);
        expect(realtimeEvents.getSubscriberCount()).toBe(0);
      });

      it('should return false for non-existent subscription', () => {
        const result = realtimeEvents.unsubscribe('non-existent-id');

        expect(result).toBe(false);
      });

      it('should not affect other subscriptions', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        const subId1 = realtimeEvents.subscribe('project-1', callback1);
        const subId2 = realtimeEvents.subscribe('project-2', callback2);

        expect(realtimeEvents.getSubscriberCount()).toBe(2);

        realtimeEvents.unsubscribe(subId1);

        expect(realtimeEvents.getSubscriberCount()).toBe(1);
      });
    });

    describe('publish', () => {
      it('should notify subscribers for matching project', () => {
        const callback = vi.fn();
        realtimeEvents.subscribe('project-1', callback);

        const event: RealtimeEvent = {
          type: 'document.processed',
          projectSlug: 'project-1',
          data: { test: 'data' },
          timestamp: 1234567890,
        };

        realtimeEvents.publish(event);

        expect(callback).toHaveBeenCalledWith(event);
        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('should not notify subscribers for different project', () => {
        const callback = vi.fn();
        realtimeEvents.subscribe('project-1', callback);

        const event: RealtimeEvent = {
          type: 'document.processed',
          projectSlug: 'project-2',
          data: { test: 'data' },
          timestamp: 1234567890,
        };

        realtimeEvents.publish(event);

        expect(callback).not.toHaveBeenCalled();
      });

      it('should notify wildcard subscribers for any project', () => {
        const callback = vi.fn();
        realtimeEvents.subscribe('*', callback);

        const event1: RealtimeEvent = {
          type: 'document.processed',
          projectSlug: 'project-1',
          data: { test: 'data' },
          timestamp: 1234567890,
        };

        const event2: RealtimeEvent = {
          type: 'chat.response',
          projectSlug: 'project-2',
          data: { test: 'data' },
          timestamp: 1234567890,
        };

        realtimeEvents.publish(event1);
        realtimeEvents.publish(event2);

        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenCalledWith(event1);
        expect(callback).toHaveBeenCalledWith(event2);
      });

      it('should notify multiple subscribers for same project', () => {
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        realtimeEvents.subscribe('project-1', callback1);
        realtimeEvents.subscribe('project-1', callback2);

        const event: RealtimeEvent = {
          type: 'document.processed',
          projectSlug: 'project-1',
          data: { test: 'data' },
          timestamp: 1234567890,
        };

        realtimeEvents.publish(event);

        expect(callback1).toHaveBeenCalledWith(event);
        expect(callback2).toHaveBeenCalledWith(event);
      });

      it('should add event to history', () => {
        const event: RealtimeEvent = {
          type: 'document.processed',
          projectSlug: 'project-1',
          data: { test: 'data' },
          timestamp: 1234567890,
        };

        realtimeEvents.publish(event);

        const history = realtimeEvents.getRecentEvents('project-1', 10);
        expect(history).toHaveLength(1);
        expect(history[0]).toEqual(event);
      });

      it('should maintain event history up to maxHistory limit', () => {
        // The default maxHistory is 100
        for (let i = 0; i < 110; i++) {
          realtimeEvents.publish({
            type: 'system.notification',
            projectSlug: 'project-1',
            data: { count: i },
            timestamp: Date.now() + i,
          });
        }

        const history = realtimeEvents.getRecentEvents('*', 200);
        expect(history.length).toBeLessThanOrEqual(100);
      });

      it('should handle callback errors gracefully', () => {
        const errorCallback = vi.fn(() => {
          throw new Error('Callback error');
        });
        const normalCallback = vi.fn();

        realtimeEvents.subscribe('project-1', errorCallback);
        realtimeEvents.subscribe('project-1', normalCallback);

        const event: RealtimeEvent = {
          type: 'document.processed',
          projectSlug: 'project-1',
          data: { test: 'data' },
          timestamp: 1234567890,
        };

        realtimeEvents.publish(event);

        expect(mockLogger.error).toHaveBeenCalled();
        expect(normalCallback).toHaveBeenCalledWith(event);
      });

      it('should handle all event types', () => {
        const callback = vi.fn();
        realtimeEvents.subscribe('project-1', callback);

        const eventTypes: RealtimeEvent['type'][] = [
          'document.processed',
          'chat.response',
          'system.notification',
          'cache.invalidated',
          'data.updated',
        ];

        eventTypes.forEach((type) => {
          realtimeEvents.publish({
            type,
            projectSlug: 'project-1',
            data: {},
            timestamp: Date.now(),
          });
        });

        expect(callback).toHaveBeenCalledTimes(5);
      });
    });

    describe('getRecentEvents', () => {
      it('should return recent events for project', () => {
        const events: RealtimeEvent[] = [
          {
            type: 'document.processed',
            projectSlug: 'project-1',
            data: { id: 1 },
            timestamp: 1000,
          },
          {
            type: 'chat.response',
            projectSlug: 'project-1',
            data: { id: 2 },
            timestamp: 2000,
          },
          {
            type: 'system.notification',
            projectSlug: 'project-2',
            data: { id: 3 },
            timestamp: 3000,
          },
        ];

        events.forEach((event) => realtimeEvents.publish(event));

        const recent = realtimeEvents.getRecentEvents('project-1', 10);

        expect(recent).toHaveLength(2);
        expect(recent[0].data.id).toBe(1);
        expect(recent[1].data.id).toBe(2);
      });

      it('should return all events for wildcard', () => {
        const events: RealtimeEvent[] = [
          {
            type: 'document.processed',
            projectSlug: 'project-1',
            data: { id: 1 },
            timestamp: 1000,
          },
          {
            type: 'chat.response',
            projectSlug: 'project-2',
            data: { id: 2 },
            timestamp: 2000,
          },
        ];

        events.forEach((event) => realtimeEvents.publish(event));

        const recent = realtimeEvents.getRecentEvents('*', 10);

        expect(recent).toHaveLength(2);
      });

      it('should limit results to specified limit', () => {
        for (let i = 0; i < 30; i++) {
          realtimeEvents.publish({
            type: 'system.notification',
            projectSlug: 'project-1',
            data: { count: i },
            timestamp: Date.now() + i,
          });
        }

        const recent = realtimeEvents.getRecentEvents('project-1', 10);

        expect(recent).toHaveLength(10);
      });

      it('should return most recent events (slice from end)', () => {
        for (let i = 0; i < 5; i++) {
          realtimeEvents.publish({
            type: 'system.notification',
            projectSlug: 'project-1',
            data: { count: i },
            timestamp: 1000 + i,
          });
        }

        const recent = realtimeEvents.getRecentEvents('project-1', 2);

        expect(recent).toHaveLength(2);
        expect(recent[0].data.count).toBe(3);
        expect(recent[1].data.count).toBe(4);
      });

      it('should return empty array for non-existent project', () => {
        realtimeEvents.publish({
          type: 'document.processed',
          projectSlug: 'project-1',
          data: {},
          timestamp: Date.now(),
        });

        const recent = realtimeEvents.getRecentEvents('project-2', 10);

        expect(recent).toHaveLength(0);
      });
    });

    describe('getSubscriberCount', () => {
      it('should return total count without projectSlug', () => {
        realtimeEvents.subscribe('project-1', vi.fn());
        realtimeEvents.subscribe('project-2', vi.fn());
        realtimeEvents.subscribe('project-3', vi.fn());

        const count = realtimeEvents.getSubscriberCount();

        expect(count).toBe(3);
      });

      it('should return count for specific project', () => {
        realtimeEvents.subscribe('project-1', vi.fn());
        realtimeEvents.subscribe('project-1', vi.fn());
        realtimeEvents.subscribe('project-2', vi.fn());

        const count = realtimeEvents.getSubscriberCount('project-1');

        expect(count).toBe(2);
      });

      it('should return 0 for project with no subscribers', () => {
        realtimeEvents.subscribe('project-1', vi.fn());

        const count = realtimeEvents.getSubscriberCount('project-2');

        expect(count).toBe(0);
      });

      it('should count wildcard subscribers separately', () => {
        realtimeEvents.subscribe('project-1', vi.fn());
        realtimeEvents.subscribe('*', vi.fn());

        const project1Count = realtimeEvents.getSubscriberCount('project-1');
        const wildcardCount = realtimeEvents.getSubscriberCount('*');

        expect(project1Count).toBe(1);
        expect(wildcardCount).toBe(1);
      });
    });

    describe('clearSubscribers', () => {
      it('should remove all subscribers', () => {
        realtimeEvents.subscribe('project-1', vi.fn());
        realtimeEvents.subscribe('project-2', vi.fn());
        realtimeEvents.subscribe('*', vi.fn());

        expect(realtimeEvents.getSubscriberCount()).toBe(3);

        realtimeEvents.clearSubscribers();

        expect(realtimeEvents.getSubscriberCount()).toBe(0);
      });

      it('should not affect event history', () => {
        realtimeEvents.publish({
          type: 'document.processed',
          projectSlug: 'project-1',
          data: {},
          timestamp: Date.now(),
        });

        realtimeEvents.clearSubscribers();

        const history = realtimeEvents.getRecentEvents('project-1', 10);
        expect(history).toHaveLength(1);
      });
    });
  });

  describe('emitDocumentProcessed', () => {
    it('should publish document.processed event with correct data', () => {
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      const callback = vi.fn();
      realtimeEvents.subscribe('project-1', callback);

      emitDocumentProcessed('project-1', 'doc-123', 'blueprint.pdf', 42);

      expect(callback).toHaveBeenCalledWith({
        type: 'document.processed',
        projectSlug: 'project-1',
        data: {
          documentId: 'doc-123',
          documentName: 'blueprint.pdf',
          chunks: 42,
          processed: true,
        },
        timestamp: Date.now(),
      });
    });

    it('should handle zero chunks', () => {
      const callback = vi.fn();
      realtimeEvents.subscribe('test-project', callback);

      emitDocumentProcessed('test-project', 'doc-456', 'empty.pdf', 0);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ chunks: 0 }),
        })
      );
    });
  });

  describe('emitChatResponse', () => {
    it('should publish chat.response event with correct data', () => {
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      const callback = vi.fn();
      realtimeEvents.subscribe('project-2', callback);

      emitChatResponse('project-2', 'conv-789', 'msg-456');

      expect(callback).toHaveBeenCalledWith({
        type: 'chat.response',
        projectSlug: 'project-2',
        data: {
          conversationId: 'conv-789',
          messageId: 'msg-456',
        },
        timestamp: Date.now(),
      });
    });
  });

  describe('emitSystemNotification', () => {
    it('should publish system.notification event with default level', () => {
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      const callback = vi.fn();
      realtimeEvents.subscribe('project-3', callback);

      emitSystemNotification('project-3', 'Test Title', 'Test message');

      expect(callback).toHaveBeenCalledWith({
        type: 'system.notification',
        projectSlug: 'project-3',
        data: {
          title: 'Test Title',
          message: 'Test message',
          level: 'info',
        },
        timestamp: Date.now(),
      });
    });

    it('should publish system.notification with warning level', () => {
      const callback = vi.fn();
      realtimeEvents.subscribe('project-3', callback);

      emitSystemNotification('project-3', 'Warning', 'Something might be wrong', 'warning');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: 'warning' }),
        })
      );
    });

    it('should publish system.notification with error level', () => {
      const callback = vi.fn();
      realtimeEvents.subscribe('project-3', callback);

      emitSystemNotification('project-3', 'Error', 'Something went wrong', 'error');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: 'error' }),
        })
      );
    });
  });

  describe('emitCacheInvalidated', () => {
    it('should publish cache.invalidated event with correct data', () => {
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      const callback = vi.fn();
      realtimeEvents.subscribe('project-4', callback);

      emitCacheInvalidated('project-4', 'query', 'documents:*');

      expect(callback).toHaveBeenCalledWith({
        type: 'cache.invalidated',
        projectSlug: 'project-4',
        data: {
          cacheType: 'query',
          pattern: 'documents:*',
        },
        timestamp: Date.now(),
      });
    });
  });

  describe('emitDataUpdated', () => {
    it('should publish data.updated event for created action', () => {
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
      const callback = vi.fn();
      realtimeEvents.subscribe('project-5', callback);

      emitDataUpdated('project-5', 'rooms', 'created', 'room-123');

      expect(callback).toHaveBeenCalledWith({
        type: 'data.updated',
        projectSlug: 'project-5',
        data: {
          dataType: 'rooms',
          action: 'created',
          itemId: 'room-123',
        },
        timestamp: Date.now(),
      });
    });

    it('should publish data.updated event for updated action', () => {
      const callback = vi.fn();
      realtimeEvents.subscribe('project-5', callback);

      emitDataUpdated('project-5', 'materials', 'updated', 'mat-456');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'updated' }),
        })
      );
    });

    it('should publish data.updated event for deleted action', () => {
      const callback = vi.fn();
      realtimeEvents.subscribe('project-5', callback);

      emitDataUpdated('project-5', 'documents', 'deleted', 'doc-789');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'deleted' }),
        })
      );
    });

    it('should handle all dataType values', () => {
      const callback = vi.fn();
      realtimeEvents.subscribe('project-5', callback);

      const dataTypes: Array<'rooms' | 'materials' | 'mep' | 'documents' | 'schedule' | 'budget'> = [
        'rooms',
        'materials',
        'mep',
        'documents',
        'schedule',
        'budget',
      ];

      dataTypes.forEach((dataType, index) => {
        emitDataUpdated('project-5', dataType, 'created', `item-${index}`);
      });

      expect(callback).toHaveBeenCalledTimes(6);
    });
  });

  describe('SSEStream', () => {
    describe('createStream', () => {
      it('should create a ReadableStream', () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        expect(stream).toBeInstanceOf(ReadableStream);
      });

      it('should subscribe to events on stream start', () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        // Get the reader to trigger the start callback
        const reader = stream.getReader();

        expect(realtimeEvents.getSubscriberCount('project-1')).toBe(1);

        reader.cancel();
      });

      it('should send initial connection event', async () => {
        vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        const reader = stream.getReader();
        const { value } = await reader.read();

        const text = new TextDecoder().decode(value);
        expect(text).toContain('event: system.notification');
        expect(text).toContain('Connected to realtime updates');

        await reader.cancel();
      });

      it('should send events as SSE format', async () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        const reader = stream.getReader();

        // Read initial connection event
        await reader.read();

        // Emit a new event
        emitDocumentProcessed('project-1', 'doc-123', 'test.pdf', 10);

        // Give time for the event to be processed
        await vi.waitFor(async () => {
          const { value } = await reader.read();
          const text = new TextDecoder().decode(value);
          return text.includes('document.processed');
        }, { timeout: 1000 });

        await reader.cancel();
      });

      it('should unsubscribe on stream cancellation', async () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        const reader = stream.getReader();

        expect(realtimeEvents.getSubscriberCount('project-1')).toBe(1);

        await reader.cancel();

        expect(realtimeEvents.getSubscriberCount('project-1')).toBe(0);
      });

      it('should clear keep-alive interval on cancellation', async () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        const reader = stream.getReader();

        // Spy on clearInterval
        const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

        await reader.cancel();

        expect(clearIntervalSpy).toHaveBeenCalled();

        clearIntervalSpy.mockRestore();
      });

      it('should send keep-alive comments every 30 seconds', async () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        const reader = stream.getReader();

        // Read initial event
        await reader.read();

        // Advance time by 30 seconds
        await vi.advanceTimersByTimeAsync(30000);

        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);

        expect(text).toContain(': keep-alive');

        await reader.cancel();
      });

      it('should handle sendEvent errors gracefully', async () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        const reader = stream.getReader();

        // Read initial event
        await reader.read();

        // Mock JSON.stringify to throw error
        const originalStringify = JSON.stringify;
        global.JSON.stringify = vi.fn(() => {
          throw new Error('Stringify error');
        });

        emitDocumentProcessed('project-1', 'doc-123', 'test.pdf', 10);

        expect(mockLogger.error).toHaveBeenCalled();

        global.JSON.stringify = originalStringify;

        await reader.cancel();
      });

      it('should handle sendComment errors gracefully', async () => {
        const sseStream = new SSEStream();

        // Create stream but immediately cause an encoding error
        const stream = sseStream.createStream('project-1');
        const reader = stream.getReader();

        // Read initial event
        await reader.read();

        // Mock TextEncoder to throw error
        const originalEncode = TextEncoder.prototype.encode;
        TextEncoder.prototype.encode = vi.fn(() => {
          throw new Error('Encode error');
        });

        // Advance time to trigger keep-alive
        await vi.advanceTimersByTimeAsync(30000);

        expect(mockLogger.error).toHaveBeenCalled();

        TextEncoder.prototype.encode = originalEncode;

        await reader.cancel();
      });

      it('should handle events with complex data structures', async () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        const reader = stream.getReader();

        // Read initial event
        await reader.read();

        // Emit event with nested data
        realtimeEvents.publish({
          type: 'data.updated',
          projectSlug: 'project-1',
          data: {
            nested: {
              deep: {
                value: 'test',
              },
            },
            array: [1, 2, 3],
          },
          timestamp: Date.now(),
        });

        const { value } = await reader.read();
        const text = new TextDecoder().decode(value);

        expect(text).toContain('event: data.updated');
        expect(text).toContain('nested');
        expect(text).toContain('array');

        await reader.cancel();
      });

      it('should not send events after controller is null', async () => {
        const sseStream = new SSEStream();
        const stream = sseStream.createStream('project-1');

        const reader = stream.getReader();

        // Cancel the stream
        await reader.cancel();

        // Try to emit event after cancellation
        emitDocumentProcessed('project-1', 'doc-123', 'test.pdf', 10);

        // Should not throw error
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle multiple projects with separate subscriptions', () => {
      const project1Callback = vi.fn();
      const project2Callback = vi.fn();

      realtimeEvents.subscribe('project-1', project1Callback);
      realtimeEvents.subscribe('project-2', project2Callback);

      emitDocumentProcessed('project-1', 'doc-1', 'file1.pdf', 10);
      emitChatResponse('project-2', 'conv-1', 'msg-1');

      expect(project1Callback).toHaveBeenCalledTimes(1);
      expect(project2Callback).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed wildcard and specific subscriptions', () => {
      const wildcardCallback = vi.fn();
      const specificCallback = vi.fn();

      realtimeEvents.subscribe('*', wildcardCallback);
      realtimeEvents.subscribe('project-1', specificCallback);

      emitDocumentProcessed('project-1', 'doc-1', 'file1.pdf', 10);

      expect(wildcardCallback).toHaveBeenCalledTimes(1);
      expect(specificCallback).toHaveBeenCalledTimes(1);
    });

    it('should maintain event history across multiple emits', () => {
      emitDocumentProcessed('project-1', 'doc-1', 'file1.pdf', 10);
      emitChatResponse('project-1', 'conv-1', 'msg-1');
      emitSystemNotification('project-1', 'Title', 'Message');

      const history = realtimeEvents.getRecentEvents('project-1', 10);

      expect(history).toHaveLength(3);
      expect(history[0].type).toBe('document.processed');
      expect(history[1].type).toBe('chat.response');
      expect(history[2].type).toBe('system.notification');
    });

    it('should handle rapid event publishing', () => {
      const callback = vi.fn();
      realtimeEvents.subscribe('project-1', callback);

      for (let i = 0; i < 100; i++) {
        emitSystemNotification('project-1', `Title ${i}`, `Message ${i}`);
      }

      expect(callback).toHaveBeenCalledTimes(100);
    });

    it('should clean up properly after multiple subscribe/unsubscribe cycles', () => {
      const callbacks = Array.from({ length: 10 }, () => vi.fn());
      const subIds = callbacks.map(cb => realtimeEvents.subscribe('project-1', cb));

      expect(realtimeEvents.getSubscriberCount('project-1')).toBe(10);

      subIds.forEach(id => realtimeEvents.unsubscribe(id));

      expect(realtimeEvents.getSubscriberCount('project-1')).toBe(0);
    });
  });
});
