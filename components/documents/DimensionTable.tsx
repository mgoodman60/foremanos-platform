'use client';

import React, { useCallback } from 'react';

interface Props {
  dimensions: any[];
}

export default function DimensionTable({ dimensions }: Props) {
  const allDims = dimensions.flatMap((d: any) =>
    ((d.dimensions as any[]) || []).map((dim: any) => ({
      ...dim,
      sheetNumber: d.sheetNumber,
    }))
  );

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

  if (allDims.length === 0) {
    return <p className="text-sm text-gray-400 italic">No dimensions extracted</p>;
  }

  return (
    <div className="overflow-x-auto pt-2">
      <table className="w-full text-sm" role="grid" tabIndex={0} onKeyDown={handleKeyDown}>
        <thead>
          <tr role="row" className="text-xs text-gray-400 border-b">
            <th className="text-left pb-2 pr-4" role="columnheader">Value</th>
            <th className="text-left pb-2 pr-4" role="columnheader">Type</th>
            <th className="text-left pb-2 pr-4" role="columnheader">Context</th>
            <th className="text-left pb-2" role="columnheader">Location</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {allDims.map((dim: any, i: number) => (
            <tr key={i} role="row" tabIndex={-1} className="focus:outline-none focus:ring-1 focus:ring-blue-500">
              <td role="gridcell" className="py-2 pr-4 font-mono text-gray-900">{dim.value || dim.dimension}</td>
              <td role="gridcell" className="py-2 pr-4 text-gray-600">{dim.type || dim.dimensionType || '--'}</td>
              <td role="gridcell" className="py-2 pr-4 text-gray-600">{dim.context || '--'}</td>
              <td role="gridcell" className="py-2 text-gray-400">{dim.location || '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
