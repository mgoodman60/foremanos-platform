'use client';

import { useState, useEffect } from 'react';
import { X, CloudRain, Wind, Thermometer, Eye, Bell, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface WeatherPreferencesModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface WeatherPreferences {
  enableTemperatureAlerts: boolean;
  enablePrecipitationAlerts: boolean;
  enableWindAlerts: boolean;
  enableVisibilityAlerts: boolean;
  enableMorningBriefing: boolean;
  morningBriefingTime: string;
  notificationMethod: string;
}

export default function WeatherPreferencesModal({
  projectId,
  isOpen,
  onClose,
}: WeatherPreferencesModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<WeatherPreferences>({
    enableTemperatureAlerts: true,
    enablePrecipitationAlerts: true,
    enableWindAlerts: true,
    enableVisibilityAlerts: false,
    enableMorningBriefing: true,
    morningBriefingTime: '07:00',
    notificationMethod: 'in_app',
  });

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
        setPreferences(data);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('Failed to load weather preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/weather/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, ...preferences }),
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
              <h2 id="weather-preferences-modal-title" className="text-xl font-bold text-[#F8FAFC]">
                🌤️ Weather Alert Preferences
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
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316]"></div>
            </div>
          ) : (
            <>
              {/* Alert Types */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#F8FAFC] flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#F97316]" />
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
                      <p className="font-medium text-[#F8FAFC]">Temperature Alerts</p>
                      <p className="text-sm text-gray-400">High (&gt;95°F) or low (&lt;32°F) temperatures</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.enableTemperatureAlerts}
                      onChange={(e) =>
                        setPreferences({ ...preferences, enableTemperatureAlerts: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#F97316] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                  </label>
                </div>

                {/* Precipitation Alerts */}
                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CloudRain className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-medium text-[#F8FAFC]">Precipitation Alerts</p>
                      <p className="text-sm text-gray-400">Rain, snow, or sleet (&gt;0.5 inches)</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.enablePrecipitationAlerts}
                      onChange={(e) =>
                        setPreferences({ ...preferences, enablePrecipitationAlerts: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#F97316] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                  </label>
                </div>

                {/* Wind Alerts */}
                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wind className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="font-medium text-[#F8FAFC]">Wind Alerts</p>
                      <p className="text-sm text-gray-400">High winds (&gt;25 mph)</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.enableWindAlerts}
                      onChange={(e) =>
                        setPreferences({ ...preferences, enableWindAlerts: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#F97316] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                  </label>
                </div>

                {/* Visibility Alerts */}
                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-[#F8FAFC]">Visibility Alerts</p>
                      <p className="text-sm text-gray-400">Low visibility (&lt;1000 meters)</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.enableVisibilityAlerts}
                      onChange={(e) =>
                        setPreferences({ ...preferences, enableVisibilityAlerts: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#F97316] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                  </label>
                </div>
              </div>

              {/* Morning Briefing */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#F8FAFC] flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#F97316]" />
                  Morning Briefing
                </h3>
                <p className="text-sm text-gray-400">
                  Receive a weather summary when your daily report chat starts
                </p>

                <div className="flex items-center justify-between p-4 bg-dark-card border border-gray-700 rounded-lg">
                  <div>
                    <p className="font-medium text-[#F8FAFC]">Enable Morning Briefing</p>
                    <p className="text-sm text-gray-400">Auto-start daily report with weather summary</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.enableMorningBriefing}
                      onChange={(e) =>
                        setPreferences({ ...preferences, enableMorningBriefing: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#F97316] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
                  </label>
                </div>

                {preferences.enableMorningBriefing && (
                  <div className="p-4 bg-dark-card border border-gray-700 rounded-lg">
                    <label className="block text-sm font-medium text-[#F8FAFC] mb-2">
                      Briefing Time
                    </label>
                    <input
                      type="time"
                      value={preferences.morningBriefingTime}
                      onChange={(e) =>
                        setPreferences({ ...preferences, morningBriefingTime: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-dark-surface border border-gray-600 text-[#F8FAFC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                    />
                  </div>
                )}
              </div>

              {/* Notification Method */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[#F8FAFC]">Notification Method</h3>
                <p className="text-sm text-gray-400">
                  Choose how you want to receive weather alerts
                </p>

                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-4 bg-dark-card border border-gray-700 rounded-lg cursor-pointer hover:bg-[#353b43] transition-colors">
                    <input
                      type="radio"
                      name="notificationMethod"
                      value="in_app"
                      checked={preferences.notificationMethod === 'in_app'}
                      onChange={(e) =>
                        setPreferences({ ...preferences, notificationMethod: e.target.value })
                      }
                      className="w-4 h-4 text-[#F97316] focus:ring-[#F97316]"
                    />
                    <div>
                      <p className="font-medium text-[#F8FAFC]">In-App Only</p>
                      <p className="text-sm text-gray-400">View alerts in the application</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-dark-card border border-gray-700 rounded-lg cursor-pointer hover:bg-[#353b43] transition-colors opacity-50">
                    <input
                      type="radio"
                      name="notificationMethod"
                      value="email"
                      disabled
                      className="w-4 h-4 text-[#F97316] focus:ring-[#F97316]"
                    />
                    <div>
                      <p className="font-medium text-[#F8FAFC]">Email (Coming Soon)</p>
                      <p className="text-sm text-gray-400">Receive alerts via email</p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-dark-surface border-t border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-card hover:bg-[#353b43] text-[#F8FAFC] rounded-lg transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
      </div>
    </div>
  );
}
