// Webhook Service - Outbound notifications to external systems
import { prisma } from './db';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '@/lib/logger';

export type WebhookEvent = 
  | 'daily_report.created'
  | 'daily_report.updated'
  | 'change_order.created'
  | 'change_order.approved'
  | 'change_order.rejected'
  | 'milestone.completed'
  | 'budget.threshold_exceeded'
  | 'schedule.delay_detected'
  | 'safety.incident_reported'
  | 'document.uploaded'
  | 'rfi.created'
  | 'rfi.responded';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  projectId: string;
  projectName: string;
  data: Record<string, unknown>;
}

export interface WebhookConfig {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  isActive: boolean;
}

interface WebhookLog {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  status: 'success' | 'failed';
  statusCode?: number;
  responseTime: number;
  timestamp: string;
  error?: string;
}

interface WebhookStorage {
  [projectId: string]: {
    webhooks: WebhookConfig[];
    logs: WebhookLog[];
  };
}

// Storage file path (in project data folder)
const getStoragePath = () => {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'webhooks.json');
};

// Read storage
function readStorage(): WebhookStorage {
  try {
    const storagePath = getStoragePath();
    if (fs.existsSync(storagePath)) {
      const data = fs.readFileSync(storagePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    logger.error('WEBHOOK', 'Storage read error', e as Error);
  }
  return {};
}

// Write storage
function writeStorage(data: WebhookStorage): void {
  try {
    const storagePath = getStoragePath();
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2));
  } catch (e) {
    logger.error('WEBHOOK', 'Storage write error', e as Error);
  }
}

// Get webhooks for a project
export async function getProjectWebhooks(projectId: string): Promise<WebhookConfig[]> {
  const storage = readStorage();
  return storage[projectId]?.webhooks || [];
}

// Save webhook configuration
export async function saveWebhook(
  projectId: string,
  webhook: Omit<WebhookConfig, 'id'>
): Promise<WebhookConfig> {
  const storage = readStorage();
  
  if (!storage[projectId]) {
    storage[projectId] = { webhooks: [], logs: [] };
  }

  const newWebhook: WebhookConfig = {
    ...webhook,
    id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  storage[projectId].webhooks.push(newWebhook);
  writeStorage(storage);

  return newWebhook;
}

// Delete webhook
export async function deleteWebhook(projectId: string, webhookId: string): Promise<void> {
  const storage = readStorage();
  
  if (storage[projectId]) {
    storage[projectId].webhooks = storage[projectId].webhooks.filter(w => w.id !== webhookId);
    writeStorage(storage);
  }
}

// Update webhook
export async function updateWebhook(
  projectId: string,
  webhookId: string,
  updates: Partial<Omit<WebhookConfig, 'id'>>
): Promise<WebhookConfig | null> {
  const storage = readStorage();
  
  if (!storage[projectId]) return null;

  const webhookIndex = storage[projectId].webhooks.findIndex(w => w.id === webhookId);
  if (webhookIndex === -1) return null;

  storage[projectId].webhooks[webhookIndex] = {
    ...storage[projectId].webhooks[webhookIndex],
    ...updates
  };

  writeStorage(storage);
  return storage[projectId].webhooks[webhookIndex];
}

// Generate HMAC signature for webhook payload
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Send webhook
export async function sendWebhook(
  projectId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  const webhooks = await getProjectWebhooks(projectId);
  const activeWebhooks = webhooks.filter(w => w.isActive && w.events.includes(event));

  if (activeWebhooks.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Get project name
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    projectId,
    projectName: project?.name || 'Unknown Project',
    data
  };

  const payloadString = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  for (const webhook of activeWebhooks) {
    const startTime = Date.now();
    const log: WebhookLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      webhookId: webhook.id,
      event,
      status: 'failed',
      responseTime: 0,
      timestamp: new Date().toISOString()
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Timestamp': payload.timestamp
      };

      if (webhook.secret) {
        headers['X-Webhook-Signature'] = generateSignature(payloadString, webhook.secret);
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      log.statusCode = response.status;
      log.responseTime = Date.now() - startTime;

      if (response.ok) {
        log.status = 'success';
        sent++;
      } else {
        log.error = `HTTP ${response.status}: ${response.statusText}`;
        failed++;
      }
    } catch (error) {
      log.responseTime = Date.now() - startTime;
      log.error = error instanceof Error ? error.message : 'Unknown error';
      failed++;
    }

    // Save log
    const storage = readStorage();
    if (storage[projectId]) {
      storage[projectId].logs.push(log);
      // Keep only last 100 logs per project
      if (storage[projectId].logs.length > 100) {
        storage[projectId].logs = storage[projectId].logs.slice(-100);
      }
      writeStorage(storage);
    }
  }

  return { sent, failed };
}

// Test webhook
export async function testWebhook(webhook: WebhookConfig): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  const testPayload: WebhookPayload = {
    event: 'daily_report.created',
    timestamp: new Date().toISOString(),
    projectId: 'test',
    projectName: 'Test Project',
    data: {
      test: true,
      message: 'This is a test webhook from ForemanOS'
    }
  };

  const payloadString = JSON.stringify(testPayload);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': 'test',
      'X-Webhook-Timestamp': testPayload.timestamp
    };

    if (webhook.secret) {
      headers['X-Webhook-Signature'] = generateSignature(payloadString, webhook.secret);
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(10000)
    });

    if (response.ok) {
      return { success: true, statusCode: response.status };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Get webhook logs
export async function getWebhookLogs(projectId: string, webhookId?: string): Promise<WebhookLog[]> {
  const storage = readStorage();
  let logs = storage[projectId]?.logs || [];
  
  if (webhookId) {
    logs = logs.filter(l => l.webhookId === webhookId);
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// Convenience functions for common events
export async function notifyDailyReportCreated(projectId: string, report: Record<string, unknown>) {
  return sendWebhook(projectId, 'daily_report.created', report);
}

export async function notifyChangeOrderCreated(projectId: string, changeOrder: Record<string, unknown>) {
  return sendWebhook(projectId, 'change_order.created', changeOrder);
}

export async function notifyMilestoneCompleted(projectId: string, milestone: Record<string, unknown>) {
  return sendWebhook(projectId, 'milestone.completed', milestone);
}

export async function notifyBudgetThresholdExceeded(projectId: string, budget: Record<string, unknown>) {
  return sendWebhook(projectId, 'budget.threshold_exceeded', budget);
}

export async function notifyScheduleDelayDetected(projectId: string, schedule: Record<string, unknown>) {
  return sendWebhook(projectId, 'schedule.delay_detected', schedule);
}

export async function notifySafetyIncidentReported(projectId: string, incident: Record<string, unknown>) {
  return sendWebhook(projectId, 'safety.incident_reported', incident);
}
