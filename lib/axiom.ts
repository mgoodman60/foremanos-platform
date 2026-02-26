/**
 * Axiom log aggregation wrapper for ForemanOS
 *
 * Buffers log events and flushes them to Axiom in batches.
 * Fully optional — when AXIOM_TOKEN is not set, all calls are no-ops.
 *
 * Required env vars:
 *   AXIOM_TOKEN   — Axiom API token
 *   AXIOM_DATASET — Axiom dataset name
 * Optional:
 *   AXIOM_ORG_ID  — Axiom organization ID
 */

import { Axiom } from '@axiomhq/js';

let axiomClient: Axiom | null = null;

function getAxiomClient(): Axiom | null {
  if (!process.env.AXIOM_TOKEN || !process.env.AXIOM_DATASET) {
    return null;
  }
  if (!axiomClient) {
    axiomClient = new Axiom({
      token: process.env.AXIOM_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
    });
  }
  return axiomClient;
}

export function isAxiomAvailable(): boolean {
  return !!process.env.AXIOM_TOKEN && !!process.env.AXIOM_DATASET;
}

interface LogEvent {
  level: 'debug' | 'info' | 'warn' | 'error';
  context: string;
  message: string;
  error?: string;
  stack?: string;
  meta?: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
}

const buffer: LogEvent[] = [];
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BUFFER_SIZE = 100;

let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushLogs();
  }, FLUSH_INTERVAL);
  // Don't prevent process exit
  if (flushTimer && typeof flushTimer === 'object' && 'unref' in flushTimer) {
    (flushTimer as NodeJS.Timeout).unref();
  }
}

export async function flushLogs(): Promise<void> {
  if (buffer.length === 0) return;
  const client = getAxiomClient();
  if (!client) return;

  const events = buffer.splice(0, buffer.length);
  const dataset = process.env.AXIOM_DATASET!;

  try {
    client.ingest(dataset, events);
    await client.flush();
  } catch (err) {
    // Don't use logger here to avoid infinite loop
    console.error('[AXIOM] Failed to flush logs:', err);
    // Re-add events to buffer for retry (up to max)
    if (buffer.length + events.length <= MAX_BUFFER_SIZE * 2) {
      buffer.push(...events);
    }
  }
}

export function ingestLog(event: LogEvent): void {
  if (!isAxiomAvailable()) return;
  buffer.push(event);
  startFlushTimer();
  if (buffer.length >= MAX_BUFFER_SIZE) {
    void flushLogs();
  }
}
