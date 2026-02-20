'use client';

import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Check, X, Play, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
}

interface WebhookLog {
  webhookId: string;
  event: string;
  success: boolean;
  statusCode: number;
  errorMessage?: string;
  timestamp: string;
}

interface WebhookManagerProps {
  projectSlug: string;
}

const availableEvents = [
  { id: 'daily_report.created', label: 'Daily Report Created' },
  { id: 'daily_report.updated', label: 'Daily Report Updated' },
  { id: 'change_order.created', label: 'Change Order Created' },
  { id: 'change_order.approved', label: 'Change Order Approved' },
  { id: 'change_order.rejected', label: 'Change Order Rejected' },
  { id: 'milestone.completed', label: 'Milestone Completed' },
  { id: 'budget.threshold_exceeded', label: 'Budget Threshold Exceeded' },
  { id: 'schedule.delay_detected', label: 'Schedule Delay Detected' },
  { id: 'safety.incident_reported', label: 'Safety Incident Reported' },
  { id: 'document.uploaded', label: 'Document Uploaded' },
];

export default function WebhookManager({ projectSlug }: WebhookManagerProps) {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    url: '',
    events: [] as string[],
    secret: ''
  });

  const fetchWebhooks = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/webhooks?includeLogs=true`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setWebhooks(data.webhooks || []);
      setLogs(data.logs || []);
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebhooks();
  }, [projectSlug]);

  const handleCreate = async () => {
    if (!newWebhook.url || newWebhook.events.length === 0) {
      toast.error('URL and at least one event required');
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectSlug}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWebhook)
      });

      if (!res.ok) throw new Error('Failed to create');
      
      toast.success('Webhook created');
      setShowCreate(false);
      setNewWebhook({ url: '', events: [], secret: '' });
      fetchWebhooks();
    } catch {
      toast.error('Failed to create webhook');
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Delete this webhook?')) return;

    try {
      const res = await fetch(`/api/projects/${projectSlug}/webhooks?webhookId=${webhookId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete');
      
      toast.success('Webhook deleted');
      fetchWebhooks();
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  const handleToggle = async (webhookId: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/webhooks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId, isActive: !isActive })
      });

      if (!res.ok) throw new Error('Failed to update');
      fetchWebhooks();
    } catch {
      toast.error('Failed to update webhook');
    }
  };

  const handleTest = async (url: string, secret?: string) => {
    setTesting(url);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', url, secret })
      });

      const result = await res.json();
      if (result.success) {
        toast.success('Webhook test successful!');
      } else {
        toast.error(result.message || 'Test failed');
      }
    } catch {
      toast.error('Test failed');
    } finally {
      setTesting(null);
    }
  };

  const toggleEvent = (eventId: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId]
    }));
  };

  if (loading) {
    return <div className="bg-dark-surface rounded-lg p-6 animate-pulse"><div className="h-40 bg-gray-700 rounded" /></div>;
  }

  return (
    <div className="bg-dark-surface rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-green-400" />
          <h3 className="text-lg font-semibold text-white">Webhooks</h3>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm text-white"
        >
          <Plus className="h-4 w-4" /> Add Webhook
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h4 className="text-white font-medium mb-4">New Webhook</h4>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400">Endpoint URL</label>
              <input
                type="url"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://your-server.com/webhook"
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400">Secret (optional)</label>
              <input
                type="text"
                value={newWebhook.secret}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, secret: e.target.value }))}
                placeholder="Used to sign webhook payloads"
                className="w-full mt-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Events</label>
              <div className="grid grid-cols-2 gap-2">
                {availableEvents.map(event => (
                  <label key={event.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWebhook.events.includes(event.id)}
                      onChange={() => toggleEvent(event.id)}
                      className="rounded bg-gray-700 border-gray-600 text-green-500"
                    />
                    <span className="text-sm text-gray-300">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleTest(newWebhook.url, newWebhook.secret)}
                disabled={!newWebhook.url || testing !== null}
                className="flex items-center gap-1 px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded text-sm text-white disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> Test
              </button>
              <button
                onClick={handleCreate}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm text-white"
              >
                <Check className="h-4 w-4" /> Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 text-gray-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Webhooks */}
      {webhooks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Webhook className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No webhooks configured</p>
          <p className="text-sm">Add a webhook to receive real-time notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${webhook.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-white font-medium truncate">{webhook.url}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {webhook.events.map(event => (
                      <span key={event} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => handleTest(webhook.url, webhook.secret)}
                    disabled={testing === webhook.url}
                    className="p-2 hover:bg-gray-700 rounded"
                    title="Test webhook"
                  >
                    <Play className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleToggle(webhook.id, webhook.isActive)}
                    className="p-2 hover:bg-gray-700 rounded"
                    title={webhook.isActive ? 'Disable' : 'Enable'}
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="p-2 hover:bg-gray-700 rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Logs */}
      {logs.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Deliveries</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {logs.slice(0, 10).map((log, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                {log.success ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <X className="h-4 w-4 text-red-400" />
                )}
                <span className="text-gray-300">{log.event}</span>
                <span className="text-gray-500">{log.statusCode || 'Error'}</span>
                <span className="text-gray-500 text-xs">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
