'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Settings as SettingsIcon, Save, RefreshCw, ChevronLeft, MessageSquare, AlertCircle } from 'lucide-react';
import SMSConfigPanel from '@/components/daily-reports/SMSConfigPanel';

interface ProjectSettings {
  projectId: string;
  projectName: string;
  scheduleAutoUpdateEnabled: boolean;
  scheduleAutoApplyThreshold: number;
  scheduleRequireManualReview: boolean;
  scheduleNotifyOnAutoUpdate: boolean;
  canEdit: boolean;
}

interface SettingsPageContentProps {
  projectSlug: string;
}

export default function SettingsPageContent({ projectSlug }: SettingsPageContentProps) {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Local state for form
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [autoApplyThreshold, setAutoApplyThreshold] = useState(85);
  const [requireManualReview, setRequireManualReview] = useState(true);
  const [notifyOnAutoUpdate, setNotifyOnAutoUpdate] = useState(true);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSlug]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/settings`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data);

      // Initialize form state
      setAutoUpdateEnabled(data.scheduleAutoUpdateEnabled);
      setAutoApplyThreshold(data.scheduleAutoApplyThreshold);
      setRequireManualReview(data.scheduleRequireManualReview);
      setNotifyOnAutoUpdate(data.scheduleNotifyOnAutoUpdate);

      setHasChanges(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load settings';
      console.error('Error fetching settings:', error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings?.canEdit) {
      toast.error('You do not have permission to edit settings');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/projects/${projectSlug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleAutoUpdateEnabled: autoUpdateEnabled,
          scheduleAutoApplyThreshold: autoApplyThreshold,
          scheduleRequireManualReview: requireManualReview,
          scheduleNotifyOnAutoUpdate: notifyOnAutoUpdate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const data = await response.json();
      toast.success('Settings saved successfully');

      // Update settings state with new values
      if (settings) {
        setSettings({
          ...settings,
          scheduleAutoUpdateEnabled: data.settings.scheduleAutoUpdateEnabled,
          scheduleAutoApplyThreshold: data.settings.scheduleAutoApplyThreshold,
          scheduleRequireManualReview: data.settings.scheduleRequireManualReview,
          scheduleNotifyOnAutoUpdate: data.settings.scheduleNotifyOnAutoUpdate,
        });
      }

      setHasChanges(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      console.error('Error saving settings:', error);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setAutoUpdateEnabled(settings.scheduleAutoUpdateEnabled);
      setAutoApplyThreshold(settings.scheduleAutoApplyThreshold);
      setRequireManualReview(settings.scheduleRequireManualReview);
      setNotifyOnAutoUpdate(settings.scheduleNotifyOnAutoUpdate);
      setHasChanges(false);
      toast.info('Changes discarded');
    }
  };

  // Track changes
  useEffect(() => {
    if (settings) {
      const changed =
        autoUpdateEnabled !== settings.scheduleAutoUpdateEnabled ||
        autoApplyThreshold !== settings.scheduleAutoApplyThreshold ||
        requireManualReview !== settings.scheduleRequireManualReview ||
        notifyOnAutoUpdate !== settings.scheduleNotifyOnAutoUpdate;
      setHasChanges(changed);
    }
  }, [autoUpdateEnabled, autoApplyThreshold, requireManualReview, notifyOnAutoUpdate, settings]);

  // Warn user before leaving with unsaved changes
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (hasChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges, handleBeforeUnload]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading settings...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Failed to load settings</div>
      </div>
    );
  }

  const canEdit = settings.canEdit;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/project/${projectSlug}`}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Back to project"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center space-x-3">
                  <SettingsIcon className="h-8 w-8 text-orange-500" />
                  <span>Project Settings</span>
                  {hasChanges && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-orange-300 bg-orange-500/15 border border-orange-500/30 rounded-full">
                      <AlertCircle className="h-3 w-3" />
                      Unsaved changes
                    </span>
                  )}
                </h1>
                <p className="text-gray-400 mt-1">{settings.projectName}</p>
              </div>
            </div>
            {canEdit && hasChanges && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleReset}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Schedule Auto-Update Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Schedule Auto-Updates</h2>
              <p className="text-sm text-gray-400 mt-1">
                Automatically update the project schedule based on daily report data
              </p>
            </div>
            {!canEdit && (
              <span className="px-3 py-1 text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full">
                View Only
              </span>
            )}
          </div>

          <div className="space-y-6">
            {/* Enable Auto-Updates */}
            <div className="flex items-start justify-between py-4 border-b border-gray-700">
              <div className="flex-1">
                <label htmlFor="autoUpdateEnabled" className="text-sm font-medium text-gray-200 block">
                  Enable Automatic Updates
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  When enabled, the system will automatically analyze daily reports and suggest schedule updates
                </p>
              </div>
              <div className="ml-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="autoUpdateEnabled"
                    checked={autoUpdateEnabled}
                    onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
                    disabled={!canEdit}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>

            {/* Confidence Threshold */}
            <div className="py-4 border-b border-gray-700">
              <label htmlFor="autoApplyThreshold" className="text-sm font-medium text-gray-200 block mb-2">
                Auto-Apply Confidence Threshold: <span className="text-orange-500">{autoApplyThreshold}%</span>
              </label>
              <p className="text-xs text-gray-400 mb-4">
                Updates with confidence above this threshold will be applied automatically (if manual review is disabled)
              </p>
              <input
                type="range"
                id="autoApplyThreshold"
                min="0"
                max="100"
                step="5"
                value={autoApplyThreshold}
                onChange={(e) => setAutoApplyThreshold(Number(e.target.value))}
                disabled={!canEdit || !autoUpdateEnabled}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Require Manual Review */}
            <div className="flex items-start justify-between py-4 border-b border-gray-700">
              <div className="flex-1">
                <label htmlFor="requireManualReview" className="text-sm font-medium text-gray-200 block">
                  Require Manual Review
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  All schedule updates must be manually reviewed and approved before being applied
                </p>
              </div>
              <div className="ml-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="requireManualReview"
                    checked={requireManualReview}
                    onChange={(e) => setRequireManualReview(e.target.checked)}
                    disabled={!canEdit || !autoUpdateEnabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>

            {/* Notify on Auto-Update */}
            <div className="flex items-start justify-between py-4">
              <div className="flex-1">
                <label htmlFor="notifyOnAutoUpdate" className="text-sm font-medium text-gray-200 block">
                  Send Notifications
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  Notify project managers when schedule updates are suggested or applied
                </p>
              </div>
              <div className="ml-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="notifyOnAutoUpdate"
                    checked={notifyOnAutoUpdate}
                    onChange={(e) => setNotifyOnAutoUpdate(e.target.checked)}
                    disabled={!canEdit || !autoUpdateEnabled}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>How it works:</strong> When daily reports are finalized, the system analyzes work progress,
              delays, and impacts. It then suggests schedule updates with confidence scores. Based on your settings,
              these updates can be automatically applied or held for manual review.
            </p>
          </div>
        </div>

        {/* SMS Reporting Section */}
        <div className="mt-6 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-400" />
                SMS Reporting
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Configure SMS-based daily report submission for field workers
              </p>
            </div>
          </div>
          <SMSConfigPanel projectSlug={projectSlug} />
        </div>

        {/* Info about pending updates */}
        {autoUpdateEnabled && (
          <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <p className="text-sm text-orange-300">
              <strong>Tip:</strong> Visit the{' '}
              <Link
                href={`/project/${projectSlug}/schedules`}
                className="underline hover:text-orange-200 transition-colors"
              >
                Schedules page
              </Link>
              {' '}to review pending schedule updates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
