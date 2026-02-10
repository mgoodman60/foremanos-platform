'use client';

import React from 'react';

interface Props {
  data: any;
}

function formatItem(item: any): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const parts: string[] = [];
    if (item.type) parts.push(item.type);
    if (item.location) parts.push(`at ${item.location}`);
    if (item.description) parts.push(item.description);
    return parts.join(' ') || JSON.stringify(item);
  }
  return String(item);
}

interface SectionConfig {
  key: string;
  title: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
}

const SECTIONS: SectionConfig[] = [
  { key: 'demolitionElements', title: 'Demolition', bgClass: 'bg-red-50', textClass: 'text-red-700', dotClass: 'bg-red-400' },
  { key: 'newConstruction', title: 'New Construction', bgClass: 'bg-green-50', textClass: 'text-green-700', dotClass: 'bg-green-400' },
  { key: 'hiddenElements', title: 'Hidden / Above', bgClass: 'bg-blue-50', textClass: 'text-blue-700', dotClass: 'bg-blue-400' },
  { key: 'belowGrade', title: 'Below Grade', bgClass: 'bg-amber-50', textClass: 'text-amber-700', dotClass: 'bg-amber-400' },
];

export default function LineTypePanel({ data }: Props) {
  if (!data) return null;

  const hasAny = SECTIONS.some(
    (s) => Array.isArray(data[s.key]) && data[s.key].length > 0
  );

  if (!hasAny) return null;

  return (
    <div className="space-y-3 mt-3">
      {SECTIONS.map((section) => {
        const items = data[section.key];
        if (!Array.isArray(items) || items.length === 0) return null;

        return (
          <div key={section.key} className={`rounded-lg p-3 ${section.bgClass}`}>
            <h5 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${section.textClass}`}>
              {section.title} ({items.length})
            </h5>
            <ul className="space-y-1">
              {items.map((item: any, idx: number) => (
                <li key={idx} className={`text-sm flex items-start gap-2 ${section.textClass}`}>
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${section.dotClass}`} />
                  {formatItem(item)}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
