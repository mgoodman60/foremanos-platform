'use client';

import React from 'react';

interface Props {
  data: any;
}

function isHexColor(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(value);
}

export default function FinishColorsPanel({ data }: Props) {
  if (!Array.isArray(data) || data.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" role="table">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Room</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Surface</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Color</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Code</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Manufacturer</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item: any, idx: number) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 border-t text-gray-900">{item.room || '--'}</td>
                <td className="px-3 py-2 border-t text-gray-900">{item.surface || '--'}</td>
                <td className="px-3 py-2 border-t text-gray-900">
                  <span className="flex items-center gap-2">
                    {item.colorCode && isHexColor(item.colorCode) && (
                      <span
                        className="inline-block w-3 h-3 rounded border border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: item.colorCode }}
                      />
                    )}
                    {item.colorName || '--'}
                  </span>
                </td>
                <td className="px-3 py-2 border-t text-gray-600 font-mono">{item.colorCode || '--'}</td>
                <td className="px-3 py-2 border-t text-gray-900">{item.manufacturer || '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
