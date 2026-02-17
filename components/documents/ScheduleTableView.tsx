'use client';

import React, { useCallback } from 'react';

interface ScheduleTable {
  scheduleType: string;
  headers: string[];
  rows: (string | number)[][];
}

interface Props {
  table: ScheduleTable;
}

export default function ScheduleTableView({ table }: Props) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTableElement>) => {
    const target = e.target as HTMLElement;
    const row = target.closest('tr');
    if (!row) return;

    let nextRow: Element | null = null;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextRow = row.nextElementSibling;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      nextRow = row.previousElementSibling;
    }
    if (nextRow instanceof HTMLElement) {
      nextRow.focus();
    }
  }, []);

  if (!table || !table.headers || table.headers.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 last:mb-0">
      <h4 className="font-semibold text-sm text-gray-900 mb-2">{table.scheduleType}</h4>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" role="grid" tabIndex={0} onKeyDown={handleKeyDown}>
          <thead className="bg-gray-50 border-b">
            <tr role="row">
              {table.headers.map((header, idx) => (
                <th
                  key={idx}
                  className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap"
                  role="columnheader"
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
                  role="row"
                  tabIndex={-1}
                  className={rowIdx % 2 === 0 ? 'bg-white focus:outline-none focus:ring-1 focus:ring-blue-500' : 'bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500'}
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      role="gridcell"
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
                  className="px-3 py-4 text-center text-gray-400"
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
