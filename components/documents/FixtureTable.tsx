'use client';

import React, { useCallback } from 'react';

interface Props {
  plumbing?: any[];
  electrical?: any[];
}

export default function FixtureTable({ plumbing, electrical }: Props) {
  const hasPlumbing = plumbing && plumbing.length > 0;
  const hasElectrical = electrical && electrical.length > 0;

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

  if (!hasPlumbing && !hasElectrical) {
    return <p className="text-sm text-gray-400 italic">No fixtures extracted</p>;
  }

  return (
    <div className="space-y-4 pt-2">
      {hasPlumbing && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Plumbing Fixtures ({plumbing!.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="grid" tabIndex={0} onKeyDown={handleKeyDown}>
              <thead>
                <tr role="row" className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-2 pr-4" role="columnheader">Type</th>
                  <th className="text-left pb-2 pr-4" role="columnheader">Symbol</th>
                  <th className="text-left pb-2 pr-4" role="columnheader">Location</th>
                  <th className="text-right pb-2" role="columnheader">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plumbing!.map((f: any, i: number) => (
                  <tr key={i} role="row" tabIndex={-1} className="focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <td role="gridcell" className="py-2 pr-4 text-gray-900">{f.fixtureType || f.type || '--'}</td>
                    <td role="gridcell" className="py-2 pr-4 font-mono text-gray-600">{f.symbol || '--'}</td>
                    <td role="gridcell" className="py-2 pr-4 text-gray-600">{f.location || '--'}</td>
                    <td role="gridcell" className="py-2 text-right text-gray-600">{f.count || 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasElectrical && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Electrical Devices ({electrical!.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="grid" tabIndex={0} onKeyDown={handleKeyDown}>
              <thead>
                <tr role="row" className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-2 pr-4" role="columnheader">Type</th>
                  <th className="text-left pb-2 pr-4" role="columnheader">Symbol</th>
                  <th className="text-left pb-2 pr-4" role="columnheader">Location</th>
                  <th className="text-left pb-2" role="columnheader">Circuit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {electrical!.map((d: any, i: number) => (
                  <tr key={i} role="row" tabIndex={-1} className="focus:outline-none focus:ring-1 focus:ring-blue-500">
                    <td role="gridcell" className="py-2 pr-4 text-gray-900">{d.deviceType || d.type || '--'}</td>
                    <td role="gridcell" className="py-2 pr-4 font-mono text-gray-600">{d.symbol || '--'}</td>
                    <td role="gridcell" className="py-2 pr-4 text-gray-600">{d.location || '--'}</td>
                    <td role="gridcell" className="py-2 text-gray-600">{d.circuit || d.circuitNumber || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
