'use client';

import React from 'react';
import TitleBlockCard from './TitleBlockCard';
import CrossReferenceMap from './CrossReferenceMap';
import DimensionTable from './DimensionTable';
import FixtureTable from './FixtureTable';
import MaterialsPanel from './MaterialsPanel';
import ScheduleTableView from './ScheduleTableView';
import SpatialDataPanel from './SpatialDataPanel';
import ConfidenceIndicator from './ConfidenceIndicator';
import { getDrawingTypeLabel, getDisciplineColor } from '@/lib/discipline-colors';

interface Props {
  sheet: any;
  drawingType: any;
  dimensions: any[];
  callouts: any[];
  legends: any[];
  annotations: any[];
  rooms: any[];
  doors: any[];
  windows: any[];
  onNavigateSheet: (sheet: string) => void;
}

function Section({ title, count, children, defaultOpen = false }: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const sectionId = `section-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="border rounded-lg bg-white">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={sectionId}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 min-h-[44px]"
      >
        <span className="font-medium text-sm text-gray-900">
          {title}{count !== undefined ? ` (${count})` : ''}
        </span>
        <span className="text-gray-400 text-xs" aria-hidden="true">{open ? '\u25BC' : '\u25B6'}</span>
      </button>
      {open && <div id={sectionId} className="px-4 pb-4 border-t">{children}</div>}
    </div>
  );
}

export default function SheetDetailPanel({ sheet, drawingType, dimensions, callouts, legends, annotations, rooms, doors, windows, onNavigateSheet }: Props) {
  const disciplineColor = getDisciplineColor(sheet.discipline || 'General');

  return (
    <div className="space-y-4">
      {/* Sheet header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">{sheet.sheetNumber}</h2>
        {sheet.discipline && (
          <span className={`px-2 py-0.5 rounded-full text-xs ${disciplineColor.bg} ${disciplineColor.text}`}>
            {sheet.discipline}
          </span>
        )}
        {drawingType && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
            {getDrawingTypeLabel(drawingType.type)}
          </span>
        )}
        {drawingType && <ConfidenceIndicator confidence={drawingType.confidence} />}
        {sheet.scale && <span className="text-xs text-gray-500">Scale: {sheet.scale}</span>}
      </div>

      {/* Title Block */}
      {sheet.titleBlockData && (
        <Section title="Title Block" defaultOpen={true}>
          <TitleBlockCard data={sheet.titleBlockData} />
        </Section>
      )}

      {/* Spatial Data */}
      {sheet.spatialData && (
        <Section title="Spatial Data" count={
          (sheet.spatialData.contextualDimensions?.length || 0) +
          (sheet.spatialData.heights?.length || 0) +
          (sheet.spatialData.spotElevations?.length || 0)
        }>
          <SpatialDataPanel data={sheet.spatialData} />
        </Section>
      )}

      {/* Dimensions */}
      {dimensions?.length > 0 && (
        <Section title="Dimensions" count={dimensions.reduce((s: number, d: any) => s + ((d.dimensions as any[])?.length || 0), 0)}>
          <DimensionTable dimensions={dimensions} />
        </Section>
      )}

      {/* Cross References */}
      {callouts?.length > 0 && (
        <Section title="Cross References" count={callouts.length}>
          <CrossReferenceMap callouts={callouts} onNavigateSheet={onNavigateSheet} />
        </Section>
      )}

      {/* Visual Materials */}
      {sheet.visualMaterials?.length > 0 && (
        <Section title="Visual Materials" count={sheet.visualMaterials.length}>
          <MaterialsPanel materials={sheet.visualMaterials} />
        </Section>
      )}

      {/* Plumbing & Electrical Fixtures */}
      {(sheet.plumbingFixtures?.length > 0 || sheet.electricalDevices?.length > 0) && (
        <Section title="Fixtures" count={(sheet.plumbingFixtures?.length || 0) + (sheet.electricalDevices?.length || 0)}>
          <FixtureTable plumbing={sheet.plumbingFixtures} electrical={sheet.electricalDevices} />
        </Section>
      )}

      {/* Schedule Tables */}
      {sheet.drawingScheduleTables?.length > 0 && (
        <Section title="Schedule Tables" count={sheet.drawingScheduleTables.length}>
          {sheet.drawingScheduleTables.map((table: any, i: number) => (
            <ScheduleTableView key={i} table={table} />
          ))}
        </Section>
      )}

      {/* Construction Intelligence */}
      {sheet.constructionIntel && (
        <Section title="Construction Intelligence">
          <div className="space-y-2 text-sm">
            {sheet.constructionIntel.tradesRequired?.length > 0 && (
              <div><span className="font-medium">Trades:</span> {sheet.constructionIntel.tradesRequired.join(', ')}</div>
            )}
            {sheet.constructionIntel.fireRatedAssemblies?.length > 0 && (
              <div>
                <span className="font-medium">Fire-Rated Assemblies:</span>
                <ul className="ml-4 mt-1 space-y-1">
                  {sheet.constructionIntel.fireRatedAssemblies.map((a: any, i: number) => (
                    <li key={i}>{a.rating} {a.type} at {a.location}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Legend */}
      {legends?.length > 0 && (
        <Section title="Legend Entries" count={legends.reduce((s: number, l: any) => s + ((l.legendEntries as any[] || []).length), 0)}>
          <div className="space-y-1 text-sm">
            {legends.flatMap((l: any) => (l.legendEntries as any[] || []).map((entry: any, i: number) => (
              <div key={`${l.sheetNumber}-${i}`} className="flex gap-2">
                <span className="font-mono text-gray-500">{typeof entry === 'string' ? entry : entry.symbol}</span>
                <span>{typeof entry === 'string' ? '' : entry.meaning}</span>
              </div>
            )))}
          </div>
        </Section>
      )}

      {/* Rooms */}
      {rooms?.length > 0 && (
        <Section title="Rooms" count={rooms.length}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {rooms.map((r: any, i: number) => (
              <div key={i} className="p-2 bg-gray-50 rounded">
                <div className="font-medium">{r.roomNumber || r.name}</div>
                <div className="text-xs text-gray-500">{r.type}{r.area ? ` \u2022 ${r.area} SF` : ''}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Doors & Windows */}
      {(doors?.length > 0 || windows?.length > 0) && (
        <Section title="Doors & Windows" count={(doors?.length || 0) + (windows?.length || 0)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {doors?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">DOORS ({doors.length})</h4>
                <div className="space-y-1 text-sm">
                  {doors.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="font-mono">{d.doorNumber}</span>
                      <span className="text-gray-500">{d.doorType}{d.width && d.height ? ` ${d.width}x${d.height}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {windows?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">WINDOWS ({windows.length})</h4>
                <div className="space-y-1 text-sm">
                  {windows.map((w: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="font-mono">{w.windowNumber}</span>
                      <span className="text-gray-500">{w.windowType}{w.width && w.height ? ` ${w.width}x${w.height}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
