'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Globe, Folder, Save, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'react-hot-toast';

interface FinalizationSettingsModalProps {
  projectSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

// Common US timezones
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
];

// Generate time options (00:00 to 23:00 in 30-minute intervals)
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour < 12 ? 'AM' : 'PM';
  const display = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  return { value: time, label: display };
});

export function FinalizationSettingsModal({
  projectSlug,
  isOpen,
  onClose,
}: FinalizationSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timezone, setTimezone] = useState('America/New_York');
  const [finalizationTime, setFinalizationTime] = useState('18:00');
  const [dailyReportsFolderId, setDailyReportsFolderId] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, projectSlug]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/finalization-settings`);
      if (response.ok) {
        const data = await response.json();
        setTimezone(data.timezone || 'America/New_York');
        setFinalizationTime(data.finalizationTime || '18:00');
        setDailyReportsFolderId(data.dailyReportsFolderId || '');
        setHasChanges(false);
      } else {
        toast.error('Failed to load finalization settings');
      }
    } catch (error) {
      console.error('Error fetching finalization settings:', error);
      toast.error('Failed to load finalization settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(`/api/projects/${projectSlug}/finalization-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          finalizationTime,
          dailyReportsFolderId: dailyReportsFolderId || null,
        }),
      });

      if (response.ok) {
        toast.success('Finalization settings updated successfully');
        setHasChanges(false);
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating finalization settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finalization-settings-modal-title"
        className="bg-[#1F2328] border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 id="finalization-settings-modal-title" className="text-xl font-bold text-[#F8FAFC]">Daily Report Finalization Settings</h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure when and how daily reports are automatically finalized
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-[#F8FAFC] hover:bg-[#2d333b]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316]"></div>
            </div>
          ) : (
            <>
              {/* Info Banner */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-200 leading-relaxed">
                      Daily reports are automatically finalized based on the time you set below. 
                      Finalization only occurs if there's no user activity for 5 minutes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Timezone Setting */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[#F8FAFC]">
                  <Globe className="h-4 w-4 text-[#F97316]" />
                  Project Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => {
                    setTimezone(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full px-4 py-3 bg-[#2d333b] border border-gray-600 rounded-lg text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  All daily reports for this project will use this timezone for finalization
                </p>
              </div>

              {/* Finalization Time Setting */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[#F8FAFC]">
                  <Clock className="h-4 w-4 text-[#F97316]" />
                  Auto-Finalize Time
                </label>
                <select
                  value={finalizationTime}
                  onChange={(e) => {
                    setFinalizationTime(e.target.value);
                    setHasChanges(true);
                  }}
                  className="w-full px-4 py-3 bg-[#2d333b] border border-gray-600 rounded-lg text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Daily reports will be finalized at this time if no user activity for 5 minutes
                </p>
              </div>

              {/* Daily Reports Folder ID Setting */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-[#F8FAFC]">
                  <Folder className="h-4 w-4 text-[#F97316]" />
                  Document Library Folder (Optional)
                </label>
                <input
                  type="text"
                  value={dailyReportsFolderId}
                  onChange={(e) => {
                    setDailyReportsFolderId(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Leave blank to auto-create 'Daily Reports' folder"
                  className="w-full px-4 py-3 bg-[#2d333b] border border-gray-600 rounded-lg text-[#F8FAFC] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                />
                <p className="text-xs text-gray-500">
                  Folder ID where finalized PDFs will be saved. Leave blank to auto-create.
                </p>
              </div>

              {/* Preview */}
              <div className="bg-[#2d333b] border border-gray-600 rounded-lg p-4">
                <h3 className="text-sm font-medium text-[#F8FAFC] mb-3">Preview</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    <span className="text-gray-500">Timezone:</span>{' '}
                    <span className="font-medium">
                      {COMMON_TIMEZONES.find((tz) => tz.value === timezone)?.label || timezone}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">Auto-finalize at:</span>{' '}
                    <span className="font-medium">
                      {TIME_OPTIONS.find((t) => t.value === finalizationTime)?.label || finalizationTime}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-500">Save to folder:</span>{' '}
                    <span className="font-medium">
                      {dailyReportsFolderId || 'Daily Reports (auto-created)'}
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-700 bg-[#1F2328]">
          <Button
            onClick={onClose}
            variant="ghost"
            className="text-gray-400 hover:text-[#F8FAFC] hover:bg-[#2d333b]"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-[#F97316] hover:bg-[#ea580c] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
