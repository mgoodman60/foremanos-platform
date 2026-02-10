'use client';

import React from 'react';

interface Props {
  data: any;
}

export default function SiteWorkPanel({ data }: Props) {
  if (!data) return null;

  const footings = data.footings as any[] | undefined;
  const slabDetails = Array.isArray(data.slabDetails)
    ? data.slabDetails
    : data.slabDetails
      ? [data.slabDetails]
      : [];
  const rebarSchedule = data.rebarSchedule as any[] | undefined;
  const gradingData = data.gradingData;
  const landscape = data.landscapeData;

  const hasFootings = footings && footings.length > 0;
  const hasSlabs = slabDetails.length > 0;
  const hasRebar = rebarSchedule && rebarSchedule.length > 0;
  const hasGrading = gradingData && Object.keys(gradingData).length > 0;
  const hasLandscape = landscape && (
    (landscape.plantSchedule?.length > 0) ||
    (landscape.existingTrees?.length > 0) ||
    (landscape.hardscape?.length > 0) ||
    (landscape.irrigation?.length > 0) ||
    (landscape.siteFurniture?.length > 0) ||
    (landscape.retainingWalls?.length > 0)
  );

  if (!hasFootings && !hasSlabs && !hasRebar && !hasGrading && !hasLandscape) {
    return null;
  }

  return (
    <div className="space-y-5 mt-3">
      {/* Footings */}
      {hasFootings && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Footings ({footings!.length})
          </h5>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs" role="table">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Width</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Depth</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Reinforcement</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Location</th>
                </tr>
              </thead>
              <tbody>
                {footings!.map((f: any, idx: number) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border-t text-gray-900">{f.type || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono">{f.width || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono">{f.depth || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{f.reinforcement || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{f.location || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slab Details */}
      {hasSlabs && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Slab Details ({slabDetails.length})
          </h5>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs" role="table">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Thickness</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Reinforcement</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Finish</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Location</th>
                </tr>
              </thead>
              <tbody>
                {slabDetails.map((s: any, idx: number) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono">{s.thickness || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{s.reinforcement || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{s.finish || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{s.location || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rebar Schedule */}
      {hasRebar && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Rebar Schedule ({rebarSchedule!.length})
          </h5>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs" role="table">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Size</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Spacing</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Location</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {rebarSchedule!.map((r: any, idx: number) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono">{r.size || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono">{r.spacing || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{r.location || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900 text-right">{r.quantity || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grading Data */}
      {hasGrading && (
        <div>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Grading
          </h5>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {gradingData.existingGrade && (
              <div className="border rounded-lg p-2 bg-white">
                <div className="text-xs text-gray-500">Existing Grade</div>
                <div className="text-sm font-mono text-gray-900">{gradingData.existingGrade}</div>
              </div>
            )}
            {gradingData.proposedGrade && (
              <div className="border rounded-lg p-2 bg-white">
                <div className="text-xs text-gray-500">Proposed Grade</div>
                <div className="text-sm font-mono text-gray-900">{gradingData.proposedGrade}</div>
              </div>
            )}
            {gradingData.cutFill && (
              <div className="border rounded-lg p-2 bg-white">
                <div className="text-xs text-gray-500">Cut/Fill</div>
                <div className="text-sm font-mono text-gray-900">{gradingData.cutFill}</div>
              </div>
            )}
            {gradingData.slopes && (
              <div className="border rounded-lg p-2 bg-white">
                <div className="text-xs text-gray-500">Slopes</div>
                <div className="text-sm font-mono text-gray-900">
                  {Array.isArray(gradingData.slopes) ? gradingData.slopes.join(', ') : gradingData.slopes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Landscape Data */}
      {hasLandscape && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b pb-1">
            Landscape & Site Features
          </h4>

          {/* Plant Schedule */}
          {landscape.plantSchedule?.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Plant Schedule ({landscape.plantSchedule.length})
              </h5>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs" role="table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Species</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Size</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landscape.plantSchedule.map((p: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border-t text-gray-900">{p.species || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900 font-mono">{p.size || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900 text-right">{p.quantity || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900">{p.location || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Existing Trees */}
          {landscape.existingTrees?.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Existing Trees ({landscape.existingTrees.length})
              </h5>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs" role="table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Species</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Size</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landscape.existingTrees.map((t: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border-t text-gray-900">{t.species || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900 font-mono">{t.size || '--'}</td>
                        <td className="px-3 py-2 border-t">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            t.status === 'keep'
                              ? 'bg-green-100 text-green-700'
                              : t.status === 'remove'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}>
                            {t.status || '--'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Hardscape */}
          {landscape.hardscape?.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Hardscape ({landscape.hardscape.length})
              </h5>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs" role="table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Area</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landscape.hardscape.map((h: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border-t text-gray-900">{h.type || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900 font-mono">{h.area || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900">{h.material || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Irrigation */}
          {landscape.irrigation?.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Irrigation ({landscape.irrigation.length})
              </h5>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs" role="table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Zone</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landscape.irrigation.map((i: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border-t text-gray-900">{i.type || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900">{i.zone || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900">{i.coverage || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Site Furniture */}
          {landscape.siteFurniture?.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Site Furniture ({landscape.siteFurniture.length})
              </h5>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs" role="table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-700">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landscape.siteFurniture.map((sf: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border-t text-gray-900">{sf.type || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900 text-right">{sf.quantity || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900">{sf.location || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Retaining Walls */}
          {landscape.retainingWalls?.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Retaining Walls ({landscape.retainingWalls.length})
              </h5>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs" role="table">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Height</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Length</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700">Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {landscape.retainingWalls.map((w: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 border-t text-gray-900">{w.type || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900 font-mono">{w.height || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900 font-mono">{w.length || '--'}</td>
                        <td className="px-3 py-2 border-t text-gray-900">{w.material || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
