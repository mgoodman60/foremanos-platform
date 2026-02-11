'use client';

import React from 'react';

interface Props {
  plumbing?: any[];
  electrical?: any[];
}

export default function FixtureTable({ plumbing, electrical }: Props) {
  const hasPlumbing = plumbing && plumbing.length > 0;
  const hasElectrical = electrical && electrical.length > 0;

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
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-2 pr-4">Type</th>
                  <th className="text-left pb-2 pr-4">Symbol</th>
                  <th className="text-left pb-2 pr-4">Location</th>
                  <th className="text-right pb-2">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plumbing!.map((f: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 text-gray-900">{f.fixtureType || f.type || '--'}</td>
                    <td className="py-2 pr-4 font-mono text-gray-600">{f.symbol || '--'}</td>
                    <td className="py-2 pr-4 text-gray-600">{f.location || '--'}</td>
                    <td className="py-2 text-right text-gray-600">{f.count || 1}</td>
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
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-2 pr-4">Type</th>
                  <th className="text-left pb-2 pr-4">Symbol</th>
                  <th className="text-left pb-2 pr-4">Location</th>
                  <th className="text-left pb-2">Circuit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {electrical!.map((d: any, i: number) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 text-gray-900">{d.deviceType || d.type || '--'}</td>
                    <td className="py-2 pr-4 font-mono text-gray-600">{d.symbol || '--'}</td>
                    <td className="py-2 pr-4 text-gray-600">{d.location || '--'}</td>
                    <td className="py-2 text-gray-600">{d.circuit || d.circuitNumber || '--'}</td>
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
