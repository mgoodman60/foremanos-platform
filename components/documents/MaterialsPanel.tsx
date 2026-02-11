'use client';

import React from 'react';
import ConfidenceIndicator from './ConfidenceIndicator';

interface Material {
  material: string;
  hatchingType: string;
  locations: string[];
  confidence: number;
}

interface Props {
  materials: Material[];
}

export default function MaterialsPanel({ materials }: Props) {
  if (!materials || materials.length === 0) {
    return <div className="text-sm text-gray-400 py-2">No materials detected</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {materials.map((mat, idx) => (
        <div
          key={idx}
          className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold text-sm text-gray-900">{mat.material}</h4>
            <ConfidenceIndicator confidence={mat.confidence} />
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <div>
              <span className="font-medium">Hatching:</span> {mat.hatchingType}
            </div>
            {mat.locations && mat.locations.length > 0 && (
              <div>
                <span className="font-medium">Locations:</span>{' '}
                {mat.locations.join(', ')}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
