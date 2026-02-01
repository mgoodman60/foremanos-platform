import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Mock modules before imports
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn()
  }
}));

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma
}));

global.fetch = mockFetch as any;

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof fs>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn()
  };
});

// Import after mocks
import {
  getProjectWebhooks,
  saveWebhook,
  deleteWebhook,
  updateWebhook,
  sendWebhook,
  testWebhook,
  getWebhookLogs,
  notifyDailyReportCreated,
  notifyChangeOrderCreated,
  notifyMilestoneCompleted,
  notifyBudgetThresholdExceeded,
  notifyScheduleDelayDetected,
  notifySafetyIncidentReported,
  type WebhookConfig,
  type WebhookEvent
} from '@/lib/webhook-service';

describe('Webhook Service', () => {
  const mockProject = {
    id: 'project-1',
    name: 'Test Project'
  };

  const mockWebhook: WebhookConfig = {
    id: 'wh_123',
    url: 'https://example.com/webhook',
    events: ['daily_report.created', 'change_order.created'],
    secret: 'test-secret',
    isActive: true
  };

  const mockStorage = {
    'project-1': {
      webhooks: [mockWebhook],
      logs: []
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.project.findUnique.mockResolvedValue(mockProject);

    // Setup default fs mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStorage));
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProjectWebhooks', () => {
    it('should return webhooks for existing project', async () => {
      const webhooks = await getProjectWebhooks('project-1');

      expect(webhooks).toHaveLength(1);
      expect(webhooks[0]).toEqual(mockWebhook);
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should return empty array for project with no webhooks', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'project-2': { webhooks: [], logs: [] }
      }));

      const webhooks = await getProjectWebhooks('project-1');

      expect(webhooks).toEqual([]);
    });

    it('should handle missing storage file gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const webhooks = await getProjectWebhooks('project-1');

      expect(webhooks).toEqual([]);
    });

    it('should handle corrupted storage file', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      const webhooks = await getProjectWebhooks('project-1');

      expect(webhooks).toEqual([]);
    });
  });

  describe('saveWebhook', () => {
    it('should create new webhook with generated ID', async () => {
      const newWebhook = {
        url: 'https://new.example.com/webhook',
        events: ['milestone.completed'] as WebhookEvent[],
        isActive: true
      };

      const result = await saveWebhook('project-1', newWebhook);

      expect(result).toMatchObject(newWebhook);
      expect(result.id).toMatch(/^wh_\d+_[a-z0-9]+$/);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should create project entry if it does not exist', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const newWebhook = {
        url: 'https://new.example.com/webhook',
        events: ['rfi.created'] as WebhookEvent[],
        isActive: true
      };

      const result = await saveWebhook('new-project', newWebhook);

      expect(result).toMatchObject(newWebhook);
      expect(result.id).toBeDefined();

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData['new-project']).toBeDefined();
      expect(savedData['new-project'].webhooks).toHaveLength(1);
    });

    it('should include optional secret in webhook', async () => {
      const newWebhook = {
        url: 'https://secure.example.com/webhook',
        events: ['safety.incident_reported'] as WebhookEvent[],
        secret: 'my-secret-key',
        isActive: true
      };

      const result = await saveWebhook('project-1', newWebhook);

      expect(result.secret).toBe('my-secret-key');
    });
  });

  describe('deleteWebhook', () => {
    it('should remove webhook from project', async () => {
      await deleteWebhook('project-1', 'wh_123');

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);
      expect(savedData['project-1'].webhooks).toHaveLength(0);
    });

    it('should handle deleting non-existent webhook', async () => {
      await deleteWebhook('project-1', 'non-existent');

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle deleting from non-existent project', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      await deleteWebhook('non-existent-project', 'wh_123');

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook configuration', async () => {
      const updates = {
        url: 'https://updated.example.com/webhook',
        isActive: false
      };

      const result = await updateWebhook('project-1', 'wh_123', updates);

      expect(result).toBeDefined();
      expect(result?.url).toBe('https://updated.example.com/webhook');
      expect(result?.isActive).toBe(false);
      expect(result?.id).toBe('wh_123'); // ID should remain unchanged
    });

    it('should return null for non-existent webhook', async () => {
      const result = await updateWebhook('project-1', 'non-existent', { isActive: false });

      expect(result).toBeNull();
    });

    it('should return null for non-existent project', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

      const result = await updateWebhook('non-existent-project', 'wh_123', { isActive: false });

      expect(result).toBeNull();
    });

    it('should partially update webhook properties', async () => {
      const updates = { isActive: false };

      const result = await updateWebhook('project-1', 'wh_123', updates);

      expect(result?.isActive).toBe(false);
      expect(result?.url).toBe(mockWebhook.url); // Other properties unchanged
      expect(result?.events).toEqual(mockWebhook.events);
    });
  });

  describe('sendWebhook', () => {
    it('should send webhook successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK'
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendWebhook('project-1', 'daily_report.created', {
        reportId: 'report-1',
        date: '2024-01-15'
      });

      expect(result).toEqual({ sent: 1, failed: 0 });
      expect(mockFetch).toHaveBeenCalledWith(
        mockWebhook.url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Event': 'daily_report.created',
            'X-Webhook-Signature': expect.any(String)
          }),
          body: expect.any(String)
        })
      );
    });

    it('should include HMAC signature when secret is provided', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['X-Webhook-Signature']).toBeDefined();
      expect(typeof headers['X-Webhook-Signature']).toBe('string');
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      expect(result).toEqual({ sent: 0, failed: 1 });
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      expect(result).toEqual({ sent: 0, failed: 1 });
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValue(new Error('The operation was aborted'));

      const result = await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      expect(result).toEqual({ sent: 0, failed: 1 });
    });

    it('should only send to webhooks subscribed to the event', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      // This event is not in mockWebhook.events
      const result = await sendWebhook('project-1', 'milestone.completed', { test: 'data' });

      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should skip inactive webhooks', async () => {
      const inactiveStorage = {
        'project-1': {
          webhooks: [{ ...mockWebhook, isActive: false }],
          logs: []
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(inactiveStorage));

      const result = await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should log webhook delivery attempts', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);

      expect(savedData['project-1'].logs).toHaveLength(1);
      expect(savedData['project-1'].logs[0]).toMatchObject({
        event: 'daily_report.created',
        status: 'success',
        statusCode: 200
      });
    });

    it('should limit logs to last 100 entries', async () => {
      const logsArray = Array.from({ length: 105 }, (_, i) => ({
        id: `log-${i}`,
        webhookId: 'wh_123',
        event: 'daily_report.created' as WebhookEvent,
        status: 'success' as const,
        statusCode: 200,
        responseTime: 100,
        timestamp: new Date().toISOString()
      }));

      const storageWithManyLogs = {
        'project-1': {
          webhooks: [mockWebhook],
          logs: logsArray
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storageWithManyLogs));

      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);

      expect(savedData['project-1'].logs.length).toBeLessThanOrEqual(100);
    });

    it('should include project name in payload', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.projectName).toBe('Test Project');
      expect(body.projectId).toBe('project-1');
    });

    it('should handle missing project name gracefully', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.projectName).toBe('Unknown Project');
    });
  });

  describe('testWebhook', () => {
    it('should send test webhook successfully', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await testWebhook(mockWebhook);

      expect(result).toEqual({ success: true, statusCode: 200 });
      expect(mockFetch).toHaveBeenCalledWith(
        mockWebhook.url,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Webhook-Event': 'test',
            'X-Webhook-Signature': expect.any(String)
          })
        })
      );
    });

    it('should handle test webhook failure', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await testWebhook(mockWebhook);

      expect(result).toEqual({
        success: false,
        error: 'HTTP 404: Not Found',
        statusCode: 404
      });
    });

    it('should handle network errors in test webhook', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await testWebhook(mockWebhook);

      expect(result).toEqual({
        success: false,
        error: 'Connection refused'
      });
    });

    it('should send test payload without signature if no secret', async () => {
      const webhookNoSecret = { ...mockWebhook, secret: undefined };
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await testWebhook(webhookNoSecret);

      const fetchCall = mockFetch.mock.calls[0];
      const headers = fetchCall[1].headers;

      expect(headers['X-Webhook-Signature']).toBeUndefined();
    });
  });

  describe('getWebhookLogs', () => {
    it('should return all logs for a project', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          webhookId: 'wh_123',
          event: 'daily_report.created' as WebhookEvent,
          status: 'success' as const,
          statusCode: 200,
          responseTime: 150,
          timestamp: '2024-01-15T10:00:00Z'
        },
        {
          id: 'log-2',
          webhookId: 'wh_123',
          event: 'change_order.created' as WebhookEvent,
          status: 'failed' as const,
          responseTime: 5000,
          timestamp: '2024-01-15T11:00:00Z',
          error: 'Timeout'
        }
      ];

      const storageWithLogs = {
        'project-1': {
          webhooks: [mockWebhook],
          logs: mockLogs
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storageWithLogs));

      const logs = await getWebhookLogs('project-1');

      expect(logs).toHaveLength(2);
      expect(logs[0].timestamp).toBe('2024-01-15T11:00:00Z'); // Most recent first
      expect(logs[1].timestamp).toBe('2024-01-15T10:00:00Z');
    });

    it('should filter logs by webhook ID', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          webhookId: 'wh_123',
          event: 'daily_report.created' as WebhookEvent,
          status: 'success' as const,
          statusCode: 200,
          responseTime: 150,
          timestamp: '2024-01-15T10:00:00Z'
        },
        {
          id: 'log-2',
          webhookId: 'wh_456',
          event: 'change_order.created' as WebhookEvent,
          status: 'success' as const,
          statusCode: 200,
          responseTime: 200,
          timestamp: '2024-01-15T11:00:00Z'
        }
      ];

      const storageWithLogs = {
        'project-1': {
          webhooks: [mockWebhook],
          logs: mockLogs
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storageWithLogs));

      const logs = await getWebhookLogs('project-1', 'wh_123');

      expect(logs).toHaveLength(1);
      expect(logs[0].webhookId).toBe('wh_123');
    });

    it('should return empty array for project with no logs', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        'project-1': { webhooks: [], logs: [] }
      }));

      const logs = await getWebhookLogs('project-1');

      expect(logs).toEqual([]);
    });
  });

  describe('Convenience notification functions', () => {
    beforeEach(() => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);
    });

    it('should send daily report created notification', async () => {
      const storageWithWebhook = {
        'project-1': {
          webhooks: [{
            ...mockWebhook,
            events: ['daily_report.created'] as WebhookEvent[]
          }],
          logs: []
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storageWithWebhook));

      const result = await notifyDailyReportCreated('project-1', { reportId: 'report-1' });

      expect(result.sent).toBe(1);
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.event).toBe('daily_report.created');
    });

    it('should send change order created notification', async () => {
      const result = await notifyChangeOrderCreated('project-1', { changeOrderId: 'co-1' });

      expect(result.sent).toBe(1);
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.event).toBe('change_order.created');
    });

    it('should send milestone completed notification', async () => {
      const storageWithWebhook = {
        'project-1': {
          webhooks: [{
            ...mockWebhook,
            events: ['milestone.completed'] as WebhookEvent[]
          }],
          logs: []
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storageWithWebhook));

      const result = await notifyMilestoneCompleted('project-1', { milestoneId: 'm-1' });

      expect(result.sent).toBe(1);
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.event).toBe('milestone.completed');
    });

    it('should send budget threshold exceeded notification', async () => {
      const storageWithWebhook = {
        'project-1': {
          webhooks: [{
            ...mockWebhook,
            events: ['budget.threshold_exceeded'] as WebhookEvent[]
          }],
          logs: []
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storageWithWebhook));

      const result = await notifyBudgetThresholdExceeded('project-1', { budgetId: 'b-1' });

      expect(result.sent).toBe(1);
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.event).toBe('budget.threshold_exceeded');
    });

    it('should send schedule delay detected notification', async () => {
      const storageWithWebhook = {
        'project-1': {
          webhooks: [{
            ...mockWebhook,
            events: ['schedule.delay_detected'] as WebhookEvent[]
          }],
          logs: []
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storageWithWebhook));

      const result = await notifyScheduleDelayDetected('project-1', { taskId: 't-1' });

      expect(result.sent).toBe(1);
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.event).toBe('schedule.delay_detected');
    });

    it('should send safety incident reported notification', async () => {
      const storageWithWebhook = {
        'project-1': {
          webhooks: [{
            ...mockWebhook,
            events: ['safety.incident_reported'] as WebhookEvent[]
          }],
          logs: []
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storageWithWebhook));

      const result = await notifySafetyIncidentReported('project-1', { incidentId: 'i-1' });

      expect(result.sent).toBe(1);
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.event).toBe('safety.incident_reported');
    });
  });

  describe('HMAC signature generation', () => {
    it('should generate consistent signatures for same payload and secret', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });
      const firstCall = mockFetch.mock.calls[0];
      const firstSignature = firstCall[1].headers['X-Webhook-Signature'];

      mockFetch.mockClear();
      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });
      const secondCall = mockFetch.mock.calls[0];
      const secondSignature = secondCall[1].headers['X-Webhook-Signature'];

      // Signatures should be different due to different timestamps
      expect(firstSignature).toBeDefined();
      expect(secondSignature).toBeDefined();
    });

    it('should verify HMAC signature matches expected format', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      const fetchCall = mockFetch.mock.calls[0];
      const signature = fetchCall[1].headers['X-Webhook-Signature'];

      // HMAC-SHA256 produces 64 character hex string
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle multiple webhooks for same event', async () => {
      const multiWebhookStorage = {
        'project-1': {
          webhooks: [
            mockWebhook,
            {
              id: 'wh_456',
              url: 'https://second.example.com/webhook',
              events: ['daily_report.created'] as WebhookEvent[],
              isActive: true
            }
          ],
          logs: []
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiWebhookStorage));

      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      expect(result.sent).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should track response time for webhook calls', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);

      expect(savedData['project-1'].logs[0].responseTime).toBeGreaterThanOrEqual(0);
      expect(typeof savedData['project-1'].logs[0].responseTime).toBe('number');
    });

    it('should include timestamp in webhook payload', async () => {
      const mockResponse = { ok: true, status: 200, statusText: 'OK' };
      mockFetch.mockResolvedValue(mockResponse);

      const beforeTime = new Date().toISOString();
      await sendWebhook('project-1', 'daily_report.created', { test: 'data' });
      const afterTime = new Date().toISOString();

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.timestamp).toBeDefined();
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(body.timestamp >= beforeTime).toBe(true);
      expect(body.timestamp <= afterTime).toBe(true);
    });

    it('should handle partial success with multiple webhooks', async () => {
      const multiWebhookStorage = {
        'project-1': {
          webhooks: [
            mockWebhook,
            {
              id: 'wh_456',
              url: 'https://failing.example.com/webhook',
              events: ['daily_report.created'] as WebhookEvent[],
              isActive: true
            }
          ],
          logs: []
        }
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(multiWebhookStorage));

      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const result = await sendWebhook('project-1', 'daily_report.created', { test: 'data' });

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });
  });
});
