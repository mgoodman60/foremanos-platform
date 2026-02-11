'use client';

import React from 'react';

interface Props {
  data: any;
}

export default function EnhancedScalePanel({ data }: Props) {
  if (!data) return null;

  const scales = Array.isArray(data.scales) ? data.scales : [];
  const primaryScale = data.primaryScale;
  const isMetric = data.isMetric;
  const graphicalScaleBars = Array.isArray(data.graphicalScaleBars) ? data.graphicalScaleBars : [];

  if (!primaryScale && scales.length === 0) return null;

  return (
    <div className="space-y-3 mt-3">
      {/* Primary scale and indicators */}
      <div className="flex items-center gap-2 flex-wrap">
        {primaryScale && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-sm font-mono font-semibold text-gray-900">
            {primaryScale}
          </span>
        )}
        {isMetric !== undefined && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
            {isMetric ? 'Metric' : 'Imperial'}
          </span>
        )}
        {graphicalScaleBars.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {graphicalScaleBars.length} graphical scale bar{graphicalScaleBars.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* All scales table */}
      {scales.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Scale</th>
                <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Applicable Area</th>
                <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {scales.map((s: any, i: number) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 px-2 text-xs font-mono text-gray-900">{s.value}</td>
                  <td className="py-1.5 px-2 text-xs text-gray-600">{s.applicableArea || '—'}</td>
                  <td className="py-1.5 px-2">
                    {s.isNTS ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                        NTS
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">To Scale</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
