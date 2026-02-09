'use client';

import React from 'react';

interface ScheduleTable {
  scheduleType: string;
  headers: string[];
  rows: (string | number)[][];
}

interface Props {
  table: ScheduleTable;
}

export default function ScheduleTableView({ table }: Props) {
  if (!table || !table.headers || table.headers.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 last:mb-0">
      <h4 className="font-semibold text-sm text-gray-900 mb-2">{table.scheduleType}</h4>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b">
            <tr>
              {table.headers.map((header, idx) => (
                <th
                  key={idx}
                  className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows && table.rows.length > 0 ? (
              table.rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="px-3 py-2 text-gray-900 border-t whitespace-nowrap"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={table.headers.length}
                  className="px-3 py-4 text-center text-gray-500"
                >
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
