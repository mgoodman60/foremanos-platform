'use client';

import React from 'react';

interface Props {
  data: any;
}

export default function SpecialDrawingPanel({ data }: Props) {
  if (!data) return null;

  const { isGeneralNotes, ceilingPlan, lifeSafety, roofData, exteriorElevation, landscapeSitePlan } = data;

  const hasCeiling = ceilingPlan && Object.keys(ceilingPlan).length > 0;
  const hasLifeSafety = lifeSafety && Object.keys(lifeSafety).length > 0;
  const hasRoof = roofData && Object.keys(roofData).length > 0;
  const hasExterior = exteriorElevation && Object.keys(exteriorElevation).length > 0;
  const hasLandscape = landscapeSitePlan && Object.keys(landscapeSitePlan).length > 0;

  if (!isGeneralNotes && !hasCeiling && !hasLifeSafety && !hasRoof && !hasExterior && !hasLandscape) {
    return null;
  }

  return (
    <div className="space-y-3 mt-3">
      {isGeneralNotes && (
        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          General Notes Sheet
        </div>
      )}

      {hasCeiling && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <h4 className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Ceiling Plan</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {ceilingPlan.gridType && (
              <>
                <span className="text-gray-500">Grid Type</span>
                <span className="text-gray-900">{ceilingPlan.gridType}</span>
              </>
            )}
            {ceilingPlan.heights && (
              <>
                <span className="text-gray-500">Heights</span>
                <span className="text-gray-900">
                  {Array.isArray(ceilingPlan.heights) ? ceilingPlan.heights.join(', ') : ceilingPlan.heights}
                </span>
              </>
            )}
            {ceilingPlan.materials && (
              <>
                <span className="text-gray-500">Materials</span>
                <span className="text-gray-900">
                  {Array.isArray(ceilingPlan.materials) ? ceilingPlan.materials.join(', ') : ceilingPlan.materials}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {hasLifeSafety && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Life Safety</h4>
          <div className="space-y-1 text-xs">
            {Array.isArray(lifeSafety.exitPaths) && lifeSafety.exitPaths.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Exit Paths:</span>{' '}
                <span className="text-gray-600">{lifeSafety.exitPaths.join(', ')}</span>
              </div>
            )}
            {Array.isArray(lifeSafety.fireExtinguishers) && lifeSafety.fireExtinguishers.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Fire Extinguishers:</span>{' '}
                <span className="text-gray-600">{lifeSafety.fireExtinguishers.length} location(s)</span>
              </div>
            )}
            {Array.isArray(lifeSafety.aedLocations) && lifeSafety.aedLocations.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">AED Locations:</span>{' '}
                <span className="text-gray-600">{lifeSafety.aedLocations.length} location(s)</span>
              </div>
            )}
            {Array.isArray(lifeSafety.assemblyPoints) && lifeSafety.assemblyPoints.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Assembly Points:</span>{' '}
                <span className="text-gray-600">{lifeSafety.assemblyPoints.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {hasRoof && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Roof Data</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {roofData.roofType && (
              <>
                <span className="text-gray-500">Type</span>
                <span className="text-gray-900">{roofData.roofType}</span>
              </>
            )}
            {roofData.slope && (
              <>
                <span className="text-gray-500">Slope</span>
                <span className="text-gray-900">{roofData.slope}</span>
              </>
            )}
            {roofData.material && (
              <>
                <span className="text-gray-500">Material</span>
                <span className="text-gray-900">{roofData.material}</span>
              </>
            )}
            {roofData.drainage && (
              <>
                <span className="text-gray-500">Drainage</span>
                <span className="text-gray-900">{roofData.drainage}</span>
              </>
            )}
          </div>
        </div>
      )}

      {hasExterior && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Exterior Elevation</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {exteriorElevation.orientation && (
              <>
                <span className="text-gray-500">Orientation</span>
                <span className="text-gray-900">{exteriorElevation.orientation}</span>
              </>
            )}
            {exteriorElevation.materials && (
              <>
                <span className="text-gray-500">Materials</span>
                <span className="text-gray-900">
                  {Array.isArray(exteriorElevation.materials) ? exteriorElevation.materials.join(', ') : exteriorElevation.materials}
                </span>
              </>
            )}
            {exteriorElevation.heights && (
              <>
                <span className="text-gray-500">Heights</span>
                <span className="text-gray-900">
                  {Array.isArray(exteriorElevation.heights) ? exteriorElevation.heights.join(', ') : exteriorElevation.heights}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {hasLandscape && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Landscape / Site Plan</h4>
          <div className="space-y-1 text-xs">
            {Array.isArray(landscapeSitePlan.zones) && landscapeSitePlan.zones.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Zones:</span>{' '}
                <span className="text-gray-600">{landscapeSitePlan.zones.join(', ')}</span>
              </div>
            )}
            {Array.isArray(landscapeSitePlan.plantingAreas) && landscapeSitePlan.plantingAreas.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Planting Areas:</span>{' '}
                <span className="text-gray-600">{landscapeSitePlan.plantingAreas.length} area(s)</span>
              </div>
            )}
            {Array.isArray(landscapeSitePlan.hardscapeAreas) && landscapeSitePlan.hardscapeAreas.length > 0 && (
              <div>
                <span className="font-medium text-gray-700">Hardscape Areas:</span>{' '}
                <span className="text-gray-600">{landscapeSitePlan.hardscapeAreas.length} area(s)</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
