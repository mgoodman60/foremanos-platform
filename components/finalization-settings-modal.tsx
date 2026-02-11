'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Clock, Globe, Folder, Save, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { finalizationSettingsSchema, type FinalizationSettingsFormData, COMMON_TIMEZONES } from '@/lib/schemas';
import { FormError } from '@/components/ui/form-error';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface FinalizationSettingsModalProps {
  projectSlug: string;
  isOpen: boolean;
  onClose: () => void;
}

// Common US timezones display labels
const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern Time (ET)',
  'America/Chicago': 'Central Time (CT)',
  'America/Denver': 'Mountain Time (MT)',
  'America/Phoenix': 'Arizona Time (MST)',
  'America/Los_Angeles': 'Pacific Time (PT)',
  'America/Anchorage': 'Alaska Time (AKT)',
  'Pacific/Honolulu': 'Hawaii Time (HST)',
};

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
  const [hasChanges, setHasChanges] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FinalizationSettingsFormData>({
    resolver: zodResolver(finalizationSettingsSchema),
    mode: 'onBlur',
    defaultValues: {
      timezone: 'America/New_York',
      finalizationTime: '18:00',
      dailyReportsFolderId: '',
    },
  });

  const timezone = watch('timezone');
  const finalizationTime = watch('finalizationTime');
  const dailyReportsFolderId = watch('dailyReportsFolderId');

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, projectSlug]);

  useEffect(() => {
    setHasChanges(isDirty);
  }, [isDirty]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/finalization-settings`);
      if (response.ok) {
        const data = await response.json();
        reset({
          timezone: data.timezone || 'America/New_York',
          finalizationTime: data.finalizationTime || '18:00',
          dailyReportsFolderId: data.dailyReportsFolderId || '',
        });
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

  const onSubmit = async (data: FinalizationSettingsFormData) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/projects/${projectSlug}/finalization-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone: data.timezone,
          finalizationTime: data.finalizationTime,
          dailyReportsFolderId: data.dailyReportsFolderId || null,
        }),
      });

      if (response.ok) {
        toast.success('Finalization settings updated successfully');
        setHasChanges(false);
        onClose();
      } else {
        const responseData = await response.json();
        toast.error(responseData.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating finalization settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const containerRef = useFocusTrap({ isActive: isOpen, onEscape: onClose });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finalization-settings-modal-title"
        className="bg-dark-surface border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 id="finalization-settings-modal-title" className="text-xl font-bold text-slate-50">Daily Report Finalization Settings</h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure when and how daily reports are automatically finalized
            </p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-slate-50 hover:bg-dark-card"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-6" noValidate>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              {/* Info Banner */}
              <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle aria-hidden="true" className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-200 leading-relaxed">
                      Daily reports are automatically finalized based on the time you set below.
                      Finalization only occurs if theres no user activity for 5 minutes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Timezone Setting */}
              <div className="space-y-2">
                <label htmlFor="timezone" className="flex items-center gap-2 text-sm font-medium text-slate-50">
                  <Globe aria-hidden="true" className="h-4 w-4 text-orange-500" />
                  Project Timezone
                </label>
                <Controller
                  name="timezone"
                  control={control}
                  render={({ field }) => (
                    <select
                      id="timezone"
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e);
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-3 bg-dark-card border border-gray-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      aria-invalid={!!errors.timezone}
                      aria-describedby={errors.timezone ? 'timezone-error' : 'timezone-help'}
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {TIMEZONE_LABELS[tz] || tz}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <FormError error={errors.timezone} fieldName="timezone" />
                {!errors.timezone && (
                  <p id="timezone-help" className="text-xs text-gray-400">
                    All daily reports for this project will use this timezone for finalization
                  </p>
                )}
              </div>

              {/* Finalization Time Setting */}
              <div className="space-y-2">
                <label htmlFor="finalizationTime" className="flex items-center gap-2 text-sm font-medium text-slate-50">
                  <Clock aria-hidden="true" className="h-4 w-4 text-orange-500" />
                  Auto-Finalize Time
                </label>
                <Controller
                  name="finalizationTime"
                  control={control}
                  render={({ field }) => (
                    <select
                      id="finalizationTime"
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e);
                        setHasChanges(true);
                      }}
                      className="w-full px-4 py-3 bg-dark-card border border-gray-600 rounded-lg text-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      aria-invalid={!!errors.finalizationTime}
                      aria-describedby={errors.finalizationTime ? 'finalizationTime-error' : 'finalizationTime-help'}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time.value} value={time.value}>
                          {time.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
                <FormError error={errors.finalizationTime} fieldName="finalizationTime" />
                {!errors.finalizationTime && (
                  <p id="finalizationTime-help" className="text-xs text-gray-400">
                    Daily reports will be finalized at this time if no user activity for 5 minutes
                  </p>
                )}
              </div>

              {/* Daily Reports Folder ID Setting */}
              <div className="space-y-2">
                <label htmlFor="dailyReportsFolderId" className="flex items-center gap-2 text-sm font-medium text-slate-50">
                  <Folder aria-hidden="true" className="h-4 w-4 text-orange-500" />
                  Document Library Folder (Optional)
                </label>
                <input
                  id="dailyReportsFolderId"
                  type="text"
                  {...register('dailyReportsFolderId', {
                    onChange: () => setHasChanges(true),
                  })}
                  placeholder="Leave blank to auto-create 'Daily Reports' folder"
                  className="w-full px-4 py-3 bg-dark-card border border-gray-600 rounded-lg text-slate-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  aria-invalid={!!errors.dailyReportsFolderId}
                  aria-describedby={errors.dailyReportsFolderId ? 'dailyReportsFolderId-error' : 'dailyReportsFolderId-help'}
                />
                <FormError error={errors.dailyReportsFolderId} fieldName="dailyReportsFolderId" />
                {!errors.dailyReportsFolderId && (
                  <p id="dailyReportsFolderId-help" className="text-xs text-gray-400">
                    Folder ID where finalized PDFs will be saved. Leave blank to auto-create.
                  </p>
                )}
              </div>

              {/* Preview */}
              <div className="bg-dark-card border border-gray-600 rounded-lg p-4">
                <h3 className="text-sm font-medium text-slate-50 mb-3">Preview</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    <span className="text-gray-400">Timezone:</span>{' '}
                    <span className="font-medium">
                      {TIMEZONE_LABELS[timezone] || timezone}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">Auto-finalize at:</span>{' '}
                    <span className="font-medium">
                      {TIME_OPTIONS.find((t) => t.value === finalizationTime)?.label || finalizationTime}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">Save to folder:</span>{' '}
                    <span className="font-medium">
                      {dailyReportsFolderId || 'Daily Reports (auto-created)'}
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-700">
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              className="text-gray-400 hover:text-slate-50 hover:bg-dark-card"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!hasChanges || saving}
              className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save aria-hidden="true" className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
