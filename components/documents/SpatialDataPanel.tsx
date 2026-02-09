'use client';

import React from 'react';

interface ContextualDimension {
  value: string;
  context: string;
  type: string;
}

interface SpotElevation {
  location: string;
  elevation: string;
}

interface Level {
  name: string;
  elevation: string;
}

interface GridSpacing {
  gridLine: string;
  spacing: string;
}

interface SpatialData {
  contextualDimensions?: ContextualDimension[];
  heights?: string[];
  thicknesses?: string[];
  spotElevations?: SpotElevation[];
  levels?: Level[];
  gridSpacing?: GridSpacing[];
  slopes?: string[];
  spacing?: string[];
  radii?: string[];
}

interface Props {
  data: SpatialData;
}

export default function SpatialDataPanel({ data }: Props) {
  if (!data) {
    return <div className="text-sm text-gray-500 py-2">No spatial data available</div>;
  }

  const hasData = Object.values(data).some(
    (arr) => Array.isArray(arr) && arr.length > 0
  );

  if (!hasData) {
    return <div className="text-sm text-gray-500 py-2">No spatial data available</div>;
  }

  return (
    <div className="space-y-4 mt-3">
      {/* Contextual Dimensions */}
      {data.contextualDimensions && data.contextualDimensions.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Contextual Dimensions
          </h5>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Value</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Context</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                </tr>
              </thead>
              <tbody>
                {data.contextualDimensions.map((dim, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900 border-t font-mono">{dim.value}</td>
                    <td className="px-3 py-2 text-gray-900 border-t">{dim.context}</td>
                    <td className="px-3 py-2 text-gray-900 border-t">{dim.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Heights */}
      {data.heights && data.heights.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Heights
          </h5>
          <div className="flex flex-wrap gap-2">
            {data.heights.map((height, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-50 rounded text-xs text-gray-900 font-mono border"
              >
                {height}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Thicknesses */}
      {data.thicknesses && data.thicknesses.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Thicknesses
          </h5>
          <div className="flex flex-wrap gap-2">
            {data.thicknesses.map((thickness, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-50 rounded text-xs text-gray-900 font-mono border"
              >
                {thickness}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Spot Elevations */}
      {data.spotElevations && data.spotElevations.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Spot Elevations
          </h5>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Location</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Elevation</th>
                </tr>
              </thead>
              <tbody>
                {data.spotElevations.map((spot, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900 border-t">{spot.location}</td>
                    <td className="px-3 py-2 text-gray-900 border-t font-mono">{spot.elevation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Levels */}
      {data.levels && data.levels.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Levels
          </h5>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Level</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Elevation</th>
                </tr>
              </thead>
              <tbody>
                {data.levels.map((level, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900 border-t">{level.name}</td>
                    <td className="px-3 py-2 text-gray-900 border-t font-mono">{level.elevation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid Spacing */}
      {data.gridSpacing && data.gridSpacing.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Grid Spacing
          </h5>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Grid Line</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Spacing</th>
                </tr>
              </thead>
              <tbody>
                {data.gridSpacing.map((grid, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900 border-t font-mono">{grid.gridLine}</td>
                    <td className="px-3 py-2 text-gray-900 border-t font-mono">{grid.spacing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slopes */}
      {data.slopes && data.slopes.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Slopes
          </h5>
          <div className="flex flex-wrap gap-2">
            {data.slopes.map((slope, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-50 rounded text-xs text-gray-900 font-mono border"
              >
                {slope}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Spacing */}
      {data.spacing && data.spacing.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Spacing
          </h5>
          <div className="flex flex-wrap gap-2">
            {data.spacing.map((space, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-50 rounded text-xs text-gray-900 font-mono border"
              >
                {space}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Radii */}
      {data.radii && data.radii.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Radii
          </h5>
          <div className="flex flex-wrap gap-2">
            {data.radii.map((radius, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-50 rounded text-xs text-gray-900 font-mono border"
              >
                {radius}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
