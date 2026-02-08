'use client';

import { useState, useEffect, useCallback } from 'react';
import { CloudRain, AlertTriangle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { createScopedLogger } from '@/lib/logger';
import { semanticColors } from '@/lib/design-tokens';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const log = createScopedLogger('WEATHER_DAY_WIDGET');

interface MonthlyBreakdown {
  month: string;
  days: number;
  hoursLost: number;
}

interface WeatherDayData {
  totalDays: number;
  totalHoursLost: number;
  totalCostImpact: number;
  monthlyBreakdown: MonthlyBreakdown[];
  thresholdDays: number;
}

interface WeatherDayRecord {
  id: string;
  date: string;
  hoursLost: number;
  reason: string;
  weatherCondition?: string;
  costImpact?: number;
}

interface WeatherDayWidgetProps {
  projectSlug: string;
}

export default function WeatherDayWidget({ projectSlug }: WeatherDayWidgetProps) {
  const [data, setData] = useState<WeatherDayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [ledger, setLedger] = useState<WeatherDayRecord[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const fetchWeatherDays = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/weather-days?type=cumulative`
      );
      if (response.ok) {
        const result = await response.json();
        setData({
          totalDays: result.totalDays,
          totalHoursLost: result.totalHoursLost,
          totalCostImpact: result.totalCostImpact,
          monthlyBreakdown: (result.byMonth || []).map((m: { month: string; count: number; hoursLost: number }) => ({
            month: m.month,
            days: m.count,
            hoursLost: m.hoursLost,
          })),
          thresholdDays: result.thresholdDays || 0,
        });
      }
    } catch (error) {
      log.error('Failed to fetch weather days', error as Error);
    } finally {
      setLoading(false);
    }
  }, [projectSlug]);

  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/weather-days?type=ledger&limit=50`);
      if (response.ok) {
        const result = await response.json();
        setLedger(result.weatherDays || []);
      }
    } catch (error) {
      log.error('Failed to fetch weather day ledger', error as Error);
    } finally {
      setLoadingLedger(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    fetchWeatherDays();
  }, [fetchWeatherDays]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!data || data.totalDays === 0) {
    return (
      <div className="text-center py-6">
        <CloudRain className="w-8 h-8 text-gray-500 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">No weather days recorded</p>
      </div>
    );
  }

  const thresholdRatio = data.thresholdDays > 0 ? data.totalDays / data.thresholdDays : 0;
  const exceeded = thresholdRatio > 1;
  const nearThreshold = thresholdRatio >= 0.8;

  const statusColor = exceeded
    ? semanticColors.error[500]
    : nearThreshold
    ? semanticColors.warning[500]
    : semanticColors.success[500];

  const statusBgColor = exceeded
    ? semanticColors.error[500]
    : nearThreshold
    ? semanticColors.warning[500]
    : semanticColors.success[500];

  const maxMonthDays = Math.max(...data.monthlyBreakdown.map(m => m.days), 1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Main stat */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setShowDetail(true); fetchLedger(); }}
          className="w-full text-left hover:bg-gray-700/30 rounded-lg p-2 -m-2 transition-colors cursor-pointer flex items-center gap-3"
          aria-label="View weather day details"
        >
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${statusColor}20` }}
          >
            <CloudRain className="w-6 h-6" style={{ color: statusColor }} />
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{data.totalDays}</div>
            <div className="text-sm text-gray-400">Weather Days</div>
          </div>
        </button>

        {exceeded && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${semanticColors.error[500]}20`,
              color: semanticColors.error[400],
            }}
          >
            <AlertTriangle className="w-4 h-4" />
            Threshold Exceeded
          </div>
        )}

        {!exceeded && nearThreshold && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: `${semanticColors.warning[500]}20`,
              color: semanticColors.warning[400],
            }}
          >
            <AlertTriangle className="w-4 h-4" />
            Nearing Threshold
          </div>
        )}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-700/30 rounded-lg p-3">
          <div className="text-sm text-gray-400">Hours Lost</div>
          <div className="text-lg font-semibold text-white">{data.totalHoursLost}</div>
        </div>
        <div className="bg-gray-700/30 rounded-lg p-3">
          <div className="text-sm text-gray-400">Cost Impact</div>
          <div className="text-lg font-semibold text-white">
            {formatCurrency(data.totalCostImpact)}
          </div>
        </div>
      </div>

      {/* Threshold progress */}
      {data.thresholdDays > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>{data.totalDays} of {data.thresholdDays} threshold days</span>
            <span>{Math.round(thresholdRatio * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(thresholdRatio * 100, 100)}%`,
                backgroundColor: statusBgColor,
              }}
            />
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      {data.monthlyBreakdown.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">
            Monthly Breakdown
          </div>
          {data.monthlyBreakdown.map((month) => (
            <div key={month.month} className="flex items-center gap-3">
              <div className="w-12 text-xs text-gray-400 shrink-0">{month.month}</div>
              <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(month.days / maxMonthDays) * 100}%`,
                    backgroundColor: statusBgColor,
                  }}
                />
              </div>
              <div className="w-16 text-right text-xs text-gray-300">
                {month.days} day{month.days !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Weather Day Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Monthly Chart */}
            {data && data.monthlyBreakdown.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                  Monthly Distribution
                </h3>
                <div className="space-y-3">
                  {data.monthlyBreakdown.map((month) => (
                    <div key={month.month} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-300 font-medium">{month.month}</span>
                        <span className="text-gray-400">
                          {month.days} day{month.days !== 1 ? 's' : ''} • {month.hoursLost} hrs
                        </span>
                      </div>
                      <div className="h-6 bg-gray-800 rounded overflow-hidden">
                        <div
                          className="h-full flex items-center px-2 text-xs font-semibold"
                          style={{
                            width: `${(month.days / maxMonthDays) * 100}%`,
                            backgroundColor: statusBgColor,
                            minWidth: month.days > 0 ? '40px' : '0',
                          }}
                        >
                          {month.days > 0 && <span className="text-white">{month.days}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ledger Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Individual Records
              </h3>

              {loadingLedger ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : ledger.length === 0 ? (
                <div className="text-center py-8">
                  <CloudRain className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">No weather day records found</p>
                </div>
              ) : (
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Hours Lost
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Condition
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Cost Impact
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {ledger.map((record) => (
                        <tr key={record.id} className="hover:bg-gray-800/50">
                          <td className="px-3 py-2 text-gray-300">
                            {format(new Date(record.date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-3 py-2 text-gray-300">
                            {record.hoursLost}
                          </td>
                          <td className="px-3 py-2 text-gray-300">
                            {record.reason}
                          </td>
                          <td className="px-3 py-2 text-gray-400">
                            {record.weatherCondition || '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-300">
                            {record.costImpact ? formatCurrency(record.costImpact) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
