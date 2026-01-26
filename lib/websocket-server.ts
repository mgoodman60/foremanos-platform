/**
 * WebSocket Server for Real-Time Updates
 * Provides real-time notifications for document processing, chat updates, and system events
 * 
 * Note: This is a lightweight implementation using SSE (Server-Sent Events) pattern
 * as Next.js API routes don't support persistent WebSocket connections natively
 */

export interface RealtimeEvent {
  type: 'document.processed' | 'chat.response' | 'system.notification' | 'cache.invalidated' | 'data.updated';
  projectSlug: string;
  data: any;
  timestamp: number;
}

export interface Subscriber {
  id: string;
  projectSlug: string;
  callback: (event: RealtimeEvent) => void;
}

/**
 * Realtime Event Bus (In-Memory)
 * For production, use Redis Pub/Sub or similar
 */
class RealtimeEventBus {
  private subscribers: Map<string, Subscriber>;
  private eventHistory: RealtimeEvent[];
  private maxHistory: number;

  constructor(maxHistory: number = 100) {
    this.subscribers = new Map();
    this.eventHistory = [];
    this.maxHistory = maxHistory;
  }

  /**
   * Subscribe to realtime events
   */
  subscribe(projectSlug: string, callback: (event: RealtimeEvent) => void): string {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.subscribers.set(id, { id, projectSlug, callback });
    return id;
  }

  /**
   * Unsubscribe from realtime events
   */
  unsubscribe(id: string): boolean {
    return this.subscribers.delete(id);
  }

  /**
   * Publish an event to all subscribers
   */
  publish(event: RealtimeEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Notify subscribers
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.projectSlug === event.projectSlug || subscriber.projectSlug === '*') {
        try {
          subscriber.callback(event);
        } catch (error) {
          console.error(`Error notifying subscriber ${subscriber.id}:`, error);
        }
      }
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(projectSlug: string, limit: number = 20): RealtimeEvent[] {
    return this.eventHistory
      .filter(event => event.projectSlug === projectSlug || projectSlug === '*')
      .slice(-limit);
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(projectSlug?: string): number {
    if (!projectSlug) {
      return this.subscribers.size;
    }
    return Array.from(this.subscribers.values())
      .filter(sub => sub.projectSlug === projectSlug)
      .length;
  }

  /**
   * Clear all subscribers
   */
  clearSubscribers(): void {
    this.subscribers.clear();
  }
}

// Global event bus instance
export const realtimeEvents = new RealtimeEventBus();

/**
 * Emit a document processed event
 */
export function emitDocumentProcessed(
  projectSlug: string,
  documentId: string,
  documentName: string,
  chunks: number
): void {
  realtimeEvents.publish({
    type: 'document.processed',
    projectSlug,
    data: {
      documentId,
      documentName,
      chunks,
      processed: true
    },
    timestamp: Date.now()
  });
}

/**
 * Emit a chat response event
 */
export function emitChatResponse(
  projectSlug: string,
  conversationId: string,
  messageId: string
): void {
  realtimeEvents.publish({
    type: 'chat.response',
    projectSlug,
    data: {
      conversationId,
      messageId
    },
    timestamp: Date.now()
  });
}

/**
 * Emit a system notification
 */
export function emitSystemNotification(
  projectSlug: string,
  title: string,
  message: string,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  realtimeEvents.publish({
    type: 'system.notification',
    projectSlug,
    data: {
      title,
      message,
      level
    },
    timestamp: Date.now()
  });
}

/**
 * Emit a cache invalidation event
 */
export function emitCacheInvalidated(
  projectSlug: string,
  cacheType: string,
  pattern: string
): void {
  realtimeEvents.publish({
    type: 'cache.invalidated',
    projectSlug,
    data: {
      cacheType,
      pattern
    },
    timestamp: Date.now()
  });
}

/**
 * Emit a data updated event
 */
export function emitDataUpdated(
  projectSlug: string,
  dataType: 'rooms' | 'materials' | 'mep' | 'documents' | 'schedule' | 'budget',
  action: 'created' | 'updated' | 'deleted',
  itemId: string
): void {
  realtimeEvents.publish({
    type: 'data.updated',
    projectSlug,
    data: {
      dataType,
      action,
      itemId
    },
    timestamp: Date.now()
  });
}

/**
 * Server-Sent Events (SSE) stream handler
 * This can be used in API routes for real-time streaming
 */
export class SSEStream {
  private controller: ReadableStreamDefaultController | null = null;
  private subscriptionId: string | null = null;
  private encoder: TextEncoder;

  constructor() {
    this.encoder = new TextEncoder();
  }

  /**
   * Create a ReadableStream for SSE
   */
  createStream(projectSlug: string): ReadableStream {
    let keepAliveInterval: NodeJS.Timeout | null = null;

    return new ReadableStream({
      start: (controller) => {
        this.controller = controller;

        // Subscribe to events
        this.subscriptionId = realtimeEvents.subscribe(projectSlug, (event) => {
          this.sendEvent(event);
        });

        // Send initial connection event
        this.sendEvent({
          type: 'system.notification',
          projectSlug,
          data: { message: 'Connected to realtime updates' },
          timestamp: Date.now()
        });

        // Keep-alive ping every 30 seconds
        keepAliveInterval = setInterval(() => {
          this.sendComment('keep-alive');
        }, 30000);
      },

      cancel: () => {
        // Cleanup on stream cancellation
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
        }
        if (this.subscriptionId) {
          realtimeEvents.unsubscribe(this.subscriptionId);
        }
      }
    });
  }

  /**
   * Send an SSE event
   */
  private sendEvent(event: RealtimeEvent): void {
    if (!this.controller) return;

    try {
      const data = JSON.stringify(event);
      const message = `event: ${event.type}\ndata: ${data}\n\n`;
      this.controller.enqueue(this.encoder.encode(message));
    } catch (error) {
      console.error('Error sending SSE event:', error);
    }
  }

  /**
   * Send an SSE comment (for keep-alive)
   */
  private sendComment(comment: string): void {
    if (!this.controller) return;

    try {
      const message = `: ${comment}\n\n`;
      this.controller.enqueue(this.encoder.encode(message));
    } catch (error) {
      console.error('Error sending SSE comment:', error);
    }
  }
}
