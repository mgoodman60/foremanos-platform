'use client';

import { FinishItem } from './types';

interface FinishScheduleTableProps {
  items: FinishItem[];
}

export function FinishScheduleTable({ items }: FinishScheduleTableProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-orange-400 mb-2">
        Finish Schedule ({items.length} items)
      </h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-dark-surface rounded p-3 text-xs overflow-hidden">
            <div className="flex items-start gap-2 mb-2">
              <span className="capitalize text-orange-400 font-medium min-w-[60px] shrink-0">
                {item.category}:
              </span>
              <span className="text-slate-50 break-words whitespace-normal overflow-hidden">
                {item.finishType || 'Not specified'}
              </span>
            </div>
            {item.material && (
              <div className="pl-[68px] text-gray-400 mb-1 break-words whitespace-normal">
                <span className="text-gray-400">Material:</span> {item.material}
              </div>
            )}
            {item.manufacturer && (
              <div className="pl-[68px] text-gray-400 mb-1 break-words whitespace-normal">
                <span className="text-gray-400">Mfr:</span> {item.manufacturer}
                {item.modelNumber && (
                  <span className="block pl-0 text-gray-400 break-words">
                    <span className="text-gray-400">Model:</span> {item.modelNumber}
                  </span>
                )}
              </div>
            )}
            {item.color && (
              <div className="pl-[68px] text-gray-400 mb-1 break-words whitespace-normal">
                <span className="text-gray-400">Color:</span> {item.color}
              </div>
            )}
            {item.dimensions && (
              <div className="pl-[68px] text-gray-400 mb-1 break-words whitespace-normal">
                <span className="text-gray-400">Dim:</span> {item.dimensions}
              </div>
            )}
            {item.csiCode && (
              <div className="pl-[68px] text-gray-400 break-words whitespace-normal">
                <span className="text-gray-400">CSI:</span> {item.csiCode}
              </div>
            )}
            {item.notes && (
              <div className="pl-[68px] text-gray-400 mt-1 italic break-words whitespace-normal">
                {item.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
