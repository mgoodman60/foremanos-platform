'use client';

import React from 'react';

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

  if (allDims.length === 0) {
    return <p className="text-sm text-gray-500 italic">No dimensions extracted</p>;
  }

  return (
    <div className="overflow-x-auto pt-2">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="text-xs text-gray-500 border-b">
            <th className="text-left pb-2 pr-4">Value</th>
            <th className="text-left pb-2 pr-4">Type</th>
            <th className="text-left pb-2 pr-4">Context</th>
            <th className="text-left pb-2">Location</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {allDims.map((dim: any, i: number) => (
            <tr key={i}>
              <td className="py-2 pr-4 font-mono text-gray-900">{dim.value || dim.dimension}</td>
              <td className="py-2 pr-4 text-gray-600">{dim.type || dim.dimensionType || '--'}</td>
              <td className="py-2 pr-4 text-gray-600">{dim.context || '--'}</td>
              <td className="py-2 text-gray-500">{dim.location || '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
