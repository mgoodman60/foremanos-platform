'use client';

import React from 'react';

interface Props {
  hvacData: any;
  fireProtection: any;
  ductSizing: any;
  pipeSizing: any;
}

function ArrayTable({ title, items, columns }: {
  title: string;
  items: any[];
  columns: { key: string; label: string; mono?: boolean; align?: string }[];
}) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {title} ({items.length})
      </h5>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs" role="table">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-semibold text-gray-700 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 border-t text-gray-900 ${col.mono ? 'font-mono' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {item[col.key] || '--'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function MEPDetailPanel({ hvacData, fireProtection, ductSizing, pipeSizing }: Props) {
  const hasHvac = hvacData && (
    (hvacData.ductwork?.length > 0) ||
    (hvacData.diffusers?.length > 0) ||
    (hvacData.equipment?.length > 0) ||
    (hvacData.piping?.length > 0) ||
    (hvacData.controls?.length > 0)
  );
  const hasFire = fireProtection && (
    (fireProtection.sprinklerHeads?.length > 0) ||
    (fireProtection.alarmDevices?.length > 0) ||
    (fireProtection.dampers?.length > 0) ||
    (fireProtection.standpipes?.length > 0)
  );
  const hasDuct = Array.isArray(ductSizing) && ductSizing.length > 0;
  const hasPipe = Array.isArray(pipeSizing) && pipeSizing.length > 0;

  if (!hasHvac && !hasFire && !hasDuct && !hasPipe) {
    return null;
  }

  return (
    <div className="space-y-5 mt-3">
      {/* HVAC / Mechanical */}
      {hasHvac && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b pb-1">
            HVAC / Mechanical
          </h4>
          <ArrayTable
            title="Ductwork"
            items={hvacData.ductwork}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'size', label: 'Size', mono: true },
              { key: 'material', label: 'Material' },
              { key: 'location', label: 'Location' },
            ]}
          />
          <ArrayTable
            title="Diffusers"
            items={hvacData.diffusers}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'size', label: 'Size', mono: true },
              { key: 'cfm', label: 'CFM', mono: true, align: 'right' },
              { key: 'location', label: 'Location' },
            ]}
          />
          <ArrayTable
            title="Equipment"
            items={hvacData.equipment}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'model', label: 'Model' },
              { key: 'capacity', label: 'Capacity', mono: true },
              { key: 'location', label: 'Location' },
            ]}
          />
          <ArrayTable
            title="Piping"
            items={hvacData.piping}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'size', label: 'Size', mono: true },
              { key: 'material', label: 'Material' },
              { key: 'system', label: 'System' },
            ]}
          />
          <ArrayTable
            title="Controls"
            items={hvacData.controls}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'controlType', label: 'Control Type' },
              { key: 'location', label: 'Location' },
            ]}
          />
        </div>
      )}

      {/* Fire Protection */}
      {hasFire && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b pb-1">
            Fire Protection
          </h4>
          <ArrayTable
            title="Sprinkler Heads"
            items={fireProtection.sprinklerHeads}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'coverage', label: 'Coverage', mono: true },
              { key: 'temperature', label: 'Temp Rating' },
              { key: 'location', label: 'Location' },
            ]}
          />
          <ArrayTable
            title="Alarm Devices"
            items={fireProtection.alarmDevices}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'location', label: 'Location' },
              { key: 'circuit', label: 'Circuit' },
            ]}
          />
          <ArrayTable
            title="Dampers"
            items={fireProtection.dampers}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'rating', label: 'Rating' },
              { key: 'size', label: 'Size', mono: true },
              { key: 'location', label: 'Location' },
            ]}
          />
          <ArrayTable
            title="Standpipes"
            items={fireProtection.standpipes}
            columns={[
              { key: 'type', label: 'Type' },
              { key: 'size', label: 'Size', mono: true },
              { key: 'location', label: 'Location' },
            ]}
          />
        </div>
      )}

      {/* Duct Sizing */}
      {hasDuct && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b pb-1 mb-3">
            Duct Sizing
          </h4>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs" role="table">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Duct Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">W x H</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Diameter</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700">CFM</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Location</th>
                </tr>
              </thead>
              <tbody>
                {ductSizing.map((d: any, idx: number) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border-t text-gray-900">{d.ductType || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono">
                      {d.width && d.height ? `${d.width} x ${d.height}` : '--'}
                    </td>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono">{d.diameter || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono text-right">{d.cfm || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{d.location || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pipe Sizing */}
      {hasPipe && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b pb-1 mb-3">
            Pipe Sizing
          </h4>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs" role="table">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Pipe Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Diameter</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Material</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">System</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Location</th>
                </tr>
              </thead>
              <tbody>
                {pipeSizing.map((p: any, idx: number) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 border-t text-gray-900">{p.pipeType || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900 font-mono">{p.diameter || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{p.material || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{p.system || '--'}</td>
                    <td className="px-3 py-2 border-t text-gray-900">{p.location || '--'}</td>
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
