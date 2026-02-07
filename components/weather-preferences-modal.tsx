'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, CloudRain, Wind, Thermometer, Eye, Bell, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { weatherPreferencesSchema, type WeatherPreferencesFormData } from '@/lib/schemas';

interface WeatherPreferencesModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function WeatherPreferencesModal({
  projectId,
  isOpen,
  onClose,
}: WeatherPreferencesModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
  } = useForm<WeatherPreferencesFormData>({
    resolver: zodResolver(weatherPreferencesSchema),
    defaultValues: {
      enableTemperatureAlerts: true,
      enablePrecipitationAlerts: true,
      enableWindAlerts: true,
      enableVisibilityAlerts: false,
      enableMorningBriefing: true,
      morningBriefingTime: '07:00',
      notificationMethod: 'in_app',
    },
  });

  const enableMorningBriefing = watch('enableMorningBriefing');

  useEffect(() => {
    if (isOpen) {
      loadPreferences();
    }
  }, [isOpen]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/weather/preferences?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        reset(data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('Failed to load weather preferences');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: WeatherPreferencesFormData) => {
    try {
      setSaving(true);
      const response = await fetch('/api/weather/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, ...data }),
      });

      if (response.ok) {
        toast.success('Weather preferences saved successfully');
        onClose();
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save weather preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="weather-preferences-modal-title"
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-dark-surface border border-gray-700 rounded-xl shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-dark-surface border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="weather-preferences-modal-title" className="text-xl font-bold text-slate-50">
                Weather Alert Preferences
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Customize weather alerts and notifications for this project
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-card rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6" noValidate>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              {/* Alert Types */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-500" />
                  Alert Types
                </h3>
                <p className="text-sm text-gray-400">
                  Choose which weather conditions trigger alerts
                </p>

                {/* Temperature Alerts */}
                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Thermometer className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="font-medium text-slate-50">Temperature Alerts</p>
                      <p className="text-sm text-gray-400">High (&gt;95F) or low (&lt;32F) temperatures</p>
                    </div>
                  </div>
                  <Controller
                    name="enableTemperatureAlerts"
                    control={control}
                    render={({ field }) => (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    )}
                  />
                </div>

                {/* Precipitation Alerts */}
                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CloudRain className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-medium text-slate-50">Precipitation Alerts</p>
                      <p className="text-sm text-gray-400">Rain, snow, or sleet (&gt;0.5 inches)</p>
                    </div>
                  </div>
                  <Controller
                    name="enablePrecipitationAlerts"
                    control={control}
                    render={({ field }) => (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    )}
                  />
                </div>

                {/* Wind Alerts */}
                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wind className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="font-medium text-slate-50">Wind Alerts</p>
                      <p className="text-sm text-gray-400">High winds (&gt;25 mph)</p>
                    </div>
                  </div>
                  <Controller
                    name="enableWindAlerts"
                    control={control}
                    render={({ field }) => (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    )}
                  />
                </div>

                {/* Visibility Alerts */}
                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-slate-50">Visibility Alerts</p>
                      <p className="text-sm text-gray-400">Low visibility (&lt;1000 meters)</p>
                    </div>
                  </div>
                  <Controller
                    name="enableVisibilityAlerts"
                    control={control}
                    render={({ field }) => (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    )}
                  />
                </div>
              </div>

              {/* Morning Briefing */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-50 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Morning Briefing
                </h3>
                <p className="text-sm text-gray-400">
                  Receive a weather summary when your daily report chat starts
                </p>

                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-50">Enable Morning Briefing</p>
                    <p className="text-sm text-gray-400">Auto-start daily report with weather summary</p>
                  </div>
                  <Controller
                    name="enableMorningBriefing"
                    control={control}
                    render={({ field }) => (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                      </label>
                    )}
                  />
                </div>

                {enableMorningBriefing && (
                  <div className="p-4 bg-dark-card border border-gray-700 rounded-lg">
                    <label htmlFor="morningBriefingTime" className="block text-sm font-medium text-slate-50 mb-2">
                      Briefing Time
                    </label>
                    <Controller
                      name="morningBriefingTime"
                      control={control}
                      render={({ field }) => (
                        <input
                          id="morningBriefingTime"
                          type="time"
                          value={field.value}
                          onChange={field.onChange}
                          className="w-full px-4 py-2 bg-dark-surface border border-gray-600 text-slate-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Notification Method */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-50">Notification Method</h3>
                <p className="text-sm text-gray-400">
                  Choose how you want to receive weather alerts
                </p>

                <Controller
                  name="notificationMethod"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-4 bg-dark-card border border-gray-700 rounded-lg cursor-pointer hover:bg-dark-hover transition-colors">
                        <input
                          type="radio"
                          name="notificationMethod"
                          value="in_app"
                          checked={field.value === 'in_app'}
                          onChange={() => field.onChange('in_app')}
                          className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                        />
                        <div>
                          <p className="font-medium text-slate-50">In-App Only</p>
                          <p className="text-sm text-gray-400">View alerts in the application</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-4 bg-dark-card border border-gray-700 rounded-lg cursor-pointer hover:bg-dark-hover transition-colors opacity-50">
                        <input
                          type="radio"
                          name="notificationMethod"
                          value="email"
                          disabled
                          className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                        />
                        <div>
                          <p className="font-medium text-slate-50">Email (Coming Soon)</p>
                          <p className="text-sm text-gray-400">Receive alerts via email</p>
                        </div>
                      </label>
                    </div>
                  )}
                />
              </div>
            </>
          )}

          {/* Footer */}
          <div className="sticky bottom-0 bg-dark-surface border-t border-gray-700 px-6 py-4 -mx-6 -mb-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-dark-card hover:bg-dark-hover text-slate-50 rounded-lg transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
