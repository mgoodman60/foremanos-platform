'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { createScopedLogger } from '@/lib/logger';
import { semanticColors, neutralColors } from '@/lib/design-tokens';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';

const log = createScopedLogger('SMS_CONFIG_PANEL');

interface SMSMapping {
  id: string;
  userId: string;
  userName?: string;
  phoneNumber: string;
  createdAt: string;
}

interface SMSConfigPanelProps {
  projectSlug: string;
}

export default function SMSConfigPanel({ projectSlug }: SMSConfigPanelProps) {
  const [mappings, setMappings] = useState<SMSMapping[]>([]);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New mapping form
  const [newUserId, setNewUserId] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteMapId, setDeleteMapId] = useState<string | null>(null);

  const baseUrl = `/api/projects/${projectSlug}/daily-reports/sms-config`;

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(baseUrl);
      if (!response.ok) throw new Error('Failed to fetch SMS config');
      const data = await response.json();
      setMappings(data.mappings || []);
      setSmsEnabled(data.smsEnabled ?? false);
    } catch (error) {
      log.error('Failed to fetch SMS config', error as Error);
      toast.error('Failed to load SMS configuration');
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      const response = await fetch(baseUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsEnabled: enabled }),
      });
      if (!response.ok) throw new Error('Failed to update SMS setting');
      setSmsEnabled(enabled);
      toast.success(enabled ? 'SMS reporting enabled' : 'SMS reporting disabled');
    } catch (error) {
      log.error('Failed to toggle SMS setting', error as Error);
      toast.error('Failed to update SMS setting');
    } finally {
      setToggling(false);
    }
  };

  const handleAdd = async () => {
    setFormError('');

    if (!newUserId.trim()) {
      setFormError('User ID is required');
      return;
    }

    const phonePattern = /^\+[1-9]\d{1,14}$/;
    if (!phonePattern.test(newPhone.trim())) {
      setFormError('Phone must be in E.164 format (e.g. +15551234567)');
      return;
    }

    setAdding(true);
    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newUserId.trim(),
          phoneNumber: newPhone.trim(),
        }),
      });

      if (response.status === 409) {
        setFormError('This phone number is already mapped');
        return;
      }

      if (!response.ok) throw new Error('Failed to add mapping');

      const data = await response.json();
      setMappings((prev) => [...prev, data.mapping || data]);
      setNewUserId('');
      setNewPhone('');
      toast.success('Phone mapping added');
    } catch (error) {
      log.error('Failed to add SMS mapping', error as Error);
      toast.error('Failed to add phone mapping');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteMapId(id);
  };

  const doDelete = async () => {
    const id = deleteMapId;
    setDeleteMapId(null);
    if (!id) return;

    setDeletingId(id);
    try {
      const response = await fetch(`${baseUrl}?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete mapping');
      setMappings((prev) => prev.filter((m) => m.id !== id));
      toast.success('Phone mapping removed');
    } catch (error) {
      log.error('Failed to delete SMS mapping', error as Error);
      toast.error('Failed to remove phone mapping');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SMS Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-gray-700 p-4 bg-gray-800/50">
        <div>
          <h4 className="text-sm font-semibold text-gray-100">
            Enable SMS Reporting
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">
            Allow field workers to submit daily reports via text message
          </p>
        </div>
        <Switch
          checked={smsEnabled}
          onCheckedChange={handleToggle}
          disabled={toggling}
          aria-label="Toggle SMS reporting"
        />
      </div>

      {/* Mappings Table */}
      <div>
        <h4 className="text-sm font-semibold text-gray-100 mb-3">
          Phone Number Mappings
        </h4>

        {mappings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-600 p-6 text-center">
            <Phone
              className="h-8 w-8 mx-auto mb-2"
              style={{ color: neutralColors.slate[300] }}
            />
            <p className="text-sm text-gray-400">
              No phone numbers configured. Add a mapping to enable SMS
              reporting.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/50 border-b border-gray-700">
                  <th className="text-left px-4 py-2 font-medium text-gray-400">
                    User
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-400">
                    Phone Number
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-400">
                    Added
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => (
                  <tr key={mapping.id} className="border-b border-gray-700 last:border-b-0">
                    <td className="px-4 py-2.5 text-gray-100">
                      {mapping.userName || mapping.userId}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {mapping.phoneNumber}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {new Date(mapping.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleDelete(mapping.id)}
                        disabled={deletingId === mapping.id}
                        aria-label={`Remove mapping for ${mapping.userName || mapping.userId}`}
                      >
                        {deletingId === mapping.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2
                            className="h-3.5 w-3.5"
                            style={{ color: semanticColors.error[500] }}
                          />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Mapping Form */}
      <div className="rounded-lg border border-gray-700 p-4 bg-gray-800/50 space-y-3">
        <h4 className="text-sm font-semibold text-gray-100">
          Add Phone Mapping
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sms-user-id" className="text-xs text-gray-400">
              User ID
            </Label>
            <Input
              id="sms-user-id"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="Enter user ID"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="sms-phone" className="text-xs text-gray-400">
              Phone Number
            </Label>
            <Input
              id="sms-phone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+15551234567"
              className="mt-1 font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">E.164 format required</p>
          </div>
        </div>

        {formError && (
          <p
            className="text-xs"
            style={{ color: semanticColors.error[500] }}
            role="alert"
          >
            {formError}
          </p>
        )}

        <Button
          size="sm"
          onClick={handleAdd}
          disabled={adding}
          className="gap-1.5"
        >
          {adding ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          )}
          Add Mapping
        </Button>
      </div>

      <ConfirmDialog
        open={deleteMapId !== null}
        onConfirm={doDelete}
        onCancel={() => setDeleteMapId(null)}
        title="Remove Phone Mapping"
        description="Remove this phone mapping?"
        variant="destructive"
      />
    </div>
  );
}
