'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Percent,
  Hash,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface ToleranceSettingsProps {
  projectSlug: string;
}

interface Settings {
  shortagePercent: number;
  shortageAbsolute: number;
  excessPercent: number;
  excessAbsolute: number;
  autoReverifyEnabled: boolean;
  reverifyOnRequirementChange: boolean;
  reverifyOnSubmittalChange: boolean;
  tradeTolerances: Record<string, any>;
}

const TRADE_CATEGORIES = [
  'ELECTRICAL',
  'PLUMBING',
  'MECHANICAL',
  'FIRE_PROTECTION',
  'HVAC',
  'STRUCTURAL',
  'ARCHITECTURAL',
  'SITEWORK',
  'CONCRETE',
  'GENERAL'
];

export default function ToleranceSettings({ projectSlug }: ToleranceSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    shortagePercent: 0,
    shortageAbsolute: 0,
    excessPercent: 100,
    excessAbsolute: 100,
    autoReverifyEnabled: true,
    reverifyOnRequirementChange: true,
    reverifyOnSubmittalChange: true,
    tradeTolerances: {}
  });
  const [showTradeSettings, setShowTradeSettings] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [projectSlug]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/tolerance`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch tolerance settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/mep/submittals/tolerance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        toast.success('Tolerance settings saved');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateTradeTolerance = (trade: string, field: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      tradeTolerances: {
        ...prev.tradeTolerances,
        [trade]: {
          ...(prev.tradeTolerances[trade] || {}),
          [field]: value
        }
      }
    }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg">
            <Settings className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Tolerance Settings</h3>
            <p className="text-sm text-slate-400">Configure verification thresholds</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700
            text-white rounded-lg flex items-center gap-2 transition-colors font-medium"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4" /> Save Settings</>
          )}
        </button>
      </div>

      {/* Shortage Tolerance */}
      <div className="bg-slate-900 border border-red-900 rounded-xl p-5">
        <h4 className="text-base font-semibold text-red-400 flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5" />
          Shortage Tolerance
        </h4>
        <p className="text-sm text-slate-400 mb-4">
          Allow items to be marked as "Sufficient" even when slightly under the requirement.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2 flex items-center gap-2">
              <Percent className="w-4 h-4" /> Allowed Shortage (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={settings.shortagePercent}
              onChange={(e) => updateSetting('shortagePercent', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">e.g., 5% means 95 of 100 is acceptable</p>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2 flex items-center gap-2">
              <Hash className="w-4 h-4" /> Allowed Shortage (Units)
            </label>
            <input
              type="number"
              min="0"
              value={settings.shortageAbsolute}
              onChange={(e) => updateSetting('shortageAbsolute', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">e.g., 2 means being short by 2 is OK</p>
          </div>
        </div>
      </div>

      {/* Excess Tolerance */}
      <div className="bg-slate-900 border border-amber-900 rounded-xl p-5">
        <h4 className="text-base font-semibold text-amber-400 flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5" />
          Excess Tolerance
        </h4>
        <p className="text-sm text-slate-400 mb-4">
          Define when excess quantities should be flagged (usually acceptable to have extra).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2 flex items-center gap-2">
              <Percent className="w-4 h-4" /> Flag Excess Above (%)
            </label>
            <input
              type="number"
              min="0"
              value={settings.excessPercent}
              onChange={(e) => updateSetting('excessPercent', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">e.g., 100% means 200 of 100 is flagged</p>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-2 flex items-center gap-2">
              <Hash className="w-4 h-4" /> Flag Excess Above (Units)
            </label>
            <input
              type="number"
              min="0"
              value={settings.excessAbsolute}
              onChange={(e) => updateSetting('excessAbsolute', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg
                text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">e.g., 100 means 101 extra is flagged</p>
          </div>
        </div>
      </div>

      {/* Auto-Reverification Settings */}
      <div className="bg-slate-900 border border-blue-900 rounded-xl p-5">
        <h4 className="text-base font-semibold text-blue-400 flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5" />
          Auto-Reverification
        </h4>
        <p className="text-sm text-slate-400 mb-4">
          Automatically re-verify submittals when data changes.
        </p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => updateSetting('autoReverifyEnabled', !settings.autoReverifyEnabled)}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.autoReverifyEnabled ? 'bg-blue-600' : 'bg-slate-600'
              } relative`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                settings.autoReverifyEnabled ? 'left-7' : 'left-1'
              }`} />
            </button>
            <span className="text-white">Enable auto-reverification</span>
          </label>

          {settings.autoReverifyEnabled && (
            <div className="ml-6 space-y-3 mt-2 border-l-2 border-slate-700 pl-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => updateSetting('reverifyOnRequirementChange', !settings.reverifyOnRequirementChange)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    settings.reverifyOnRequirementChange ? 'bg-blue-500' : 'bg-slate-600'
                  } relative`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    settings.reverifyOnRequirementChange ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
                <span className="text-slate-300 text-sm">When project requirements change</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => updateSetting('reverifyOnSubmittalChange', !settings.reverifyOnSubmittalChange)}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    settings.reverifyOnSubmittalChange ? 'bg-blue-500' : 'bg-slate-600'
                  } relative`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                    settings.reverifyOnSubmittalChange ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
                <span className="text-slate-300 text-sm">When submittal line items are modified</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Trade-Specific Tolerances */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
        <button
          onClick={() => setShowTradeSettings(!showTradeSettings)}
          className="w-full flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-slate-400" />
            <span className="font-semibold">Trade-Specific Overrides</span>
          </div>
          <span className="text-sm text-slate-400">
            {showTradeSettings ? 'Hide' : 'Show'} ({Object.keys(settings.tradeTolerances).filter(k => 
              settings.tradeTolerances[k]?.shortagePercent !== undefined
            ).length} configured)
          </span>
        </button>

        {showTradeSettings && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-400">
              Set different shortage tolerances for specific trades (overrides global settings).
            </p>
            <div className="grid gap-2">
              {TRADE_CATEGORIES.map(trade => (
                <div key={trade} className="flex items-center gap-3 bg-slate-800 rounded-lg p-3">
                  <span className="text-sm text-slate-300 w-32 flex-shrink-0">
                    {trade.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">%</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="-"
                      value={settings.tradeTolerances[trade]?.shortagePercent ?? ''}
                      onChange={(e) => updateTradeTolerance(
                        trade, 
                        'shortagePercent', 
                        e.target.value ? parseFloat(e.target.value) : undefined as any
                      )}
                      className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded
                        text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
