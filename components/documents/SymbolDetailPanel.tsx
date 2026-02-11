'use client';

import React from 'react';

interface Props {
  data: any;
}

export default function SymbolDetailPanel({ data }: Props) {
  if (!data) return null;

  const sectionCuts = Array.isArray(data.sectionCuts) ? data.sectionCuts : [];
  const elevationMarkers = Array.isArray(data.elevationMarkers) ? data.elevationMarkers : [];
  const revisionClouds = Array.isArray(data.revisionClouds) ? data.revisionClouds : [];
  const matchLines = Array.isArray(data.matchLines) ? data.matchLines : [];
  const northArrow = data.northArrow;
  const scaleBars = Array.isArray(data.scaleBars) ? data.scaleBars : [];

  const hasNorthArrow = northArrow === true || (northArrow && typeof northArrow === 'object');
  const hasScaleBars = scaleBars.length > 0;

  if (
    sectionCuts.length === 0 &&
    elevationMarkers.length === 0 &&
    revisionClouds.length === 0 &&
    matchLines.length === 0 &&
    !hasNorthArrow &&
    !hasScaleBars
  ) {
    return null;
  }

  return (
    <div className="space-y-4 mt-3">
      {/* Indicator badges */}
      {(hasNorthArrow || hasScaleBars) && (
        <div className="flex items-center gap-2 flex-wrap">
          {hasNorthArrow && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              North Arrow
            </span>
          )}
          {hasScaleBars && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {scaleBars.length} Scale Bar{scaleBars.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Section Cuts */}
      {sectionCuts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Section Cuts</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Number</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Ref Sheet</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Direction</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Location</th>
                </tr>
              </thead>
              <tbody>
                {sectionCuts.map((sc: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-xs font-mono text-gray-900">{sc.number}</td>
                    <td className="py-1.5 px-2 text-xs text-blue-600">{sc.referenceSheet || '—'}</td>
                    <td className="py-1.5 px-2 text-xs text-gray-600">{sc.direction || '—'}</td>
                    <td className="py-1.5 px-2 text-xs text-gray-600">{sc.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Elevation Markers */}
      {elevationMarkers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Elevation Markers</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Number</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Ref Sheet</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Direction</th>
                </tr>
              </thead>
              <tbody>
                {elevationMarkers.map((em: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1.5 px-2 text-xs font-mono text-gray-900">{em.number}</td>
                    <td className="py-1.5 px-2 text-xs text-blue-600">{em.referenceSheet || '—'}</td>
                    <td className="py-1.5 px-2 text-xs text-gray-600">{em.direction || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revision Clouds */}
      {revisionClouds.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Revision Clouds</h4>
          <div className="space-y-1.5">
            {revisionClouds.map((rc: any, i: number) => (
              <div key={i} className="rounded border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-yellow-800">Rev {rc.revisionNumber}</span>
                  {rc.date && <span className="text-yellow-600">{rc.date}</span>}
                </div>
                {rc.description && <div className="text-gray-600 mt-0.5">{rc.description}</div>}
                {rc.location && <div className="text-gray-400 mt-0.5">{rc.location}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Match Lines */}
      {matchLines.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Match Lines</h4>
          <ul className="space-y-1">
            {matchLines.map((ml: any, i: number) => (
              <li key={i} className="text-xs text-gray-700">
                <span className="text-blue-600">{ml.referenceSheet}</span>
                {ml.direction && <span className="text-gray-400"> — {ml.direction}</span>}
                {ml.location && <span className="text-gray-400"> ({ml.location})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
