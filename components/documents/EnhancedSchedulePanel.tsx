'use client';

import React from 'react';

interface Props {
  data: any;
}

const SCHEDULE_LABELS: Record<string, string> = {
  fixtureSchedule: 'Fixture Schedule',
  hardwareSchedule: 'Hardware Schedule',
  structuralSchedule: 'Structural Schedule',
  lightingSchedule: 'Lighting Schedule',
  panelSchedule: 'Panel Schedule',
  stairSchedule: 'Stair Schedule',
  elevatorSchedule: 'Elevator Schedule',
};

export default function EnhancedSchedulePanel({ data }: Props) {
  if (!data) return null;

  const scheduleKeys = Object.keys(SCHEDULE_LABELS).filter(
    (key) => Array.isArray(data[key]) && data[key].length > 0
  );

  if (scheduleKeys.length === 0) return null;

  return (
    <div className="space-y-4 mt-3">
      {scheduleKeys.map((key) => {
        const rows: any[] = data[key];
        const headers = Object.keys(rows[0]);

        return (
          <div key={key}>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {SCHEDULE_LABELS[key]}
              <span className="ml-1.5 text-gray-400 font-normal">({rows.length})</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="text-left py-1.5 px-2 text-xs font-medium text-gray-400 whitespace-nowrap"
                      >
                        {formatHeader(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, ri: number) => (
                    <tr key={ri} className="border-b border-gray-100">
                      {headers.map((h) => (
                        <td key={h} className="py-1.5 px-2 text-xs text-gray-700 whitespace-nowrap">
                          {formatCell(row[h])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Convert camelCase keys to readable headers */
function formatHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/** Render cell values, handling arrays and objects */
function formatCell(value: any): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
