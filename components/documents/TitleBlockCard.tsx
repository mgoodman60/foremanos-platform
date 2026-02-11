'use client';

import React from 'react';

interface Props {
  data: Record<string, any>;
}

const FIELD_LABELS: Record<string, string> = {
  projectName: 'Project Name',
  sheetTitle: 'Sheet Title',
  sheetNumber: 'Sheet Number',
  drawnBy: 'Drawn By',
  checkedBy: 'Checked By',
  approvedBy: 'Approved By',
  date: 'Date',
  revision: 'Revision',
  scale: 'Scale',
  architect: 'Architect',
  engineer: 'Engineer',
  client: 'Client',
  address: 'Address',
  phase: 'Phase',
  projectNumber: 'Project Number',
  drawingNumber: 'Drawing Number',
};

export default function TitleBlockCard({ data }: Props) {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 italic">No title block data extracted</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col py-1">
          <span className="text-xs text-gray-400">{FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').trim()}</span>
          <span className="text-sm text-gray-900 break-words">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}
