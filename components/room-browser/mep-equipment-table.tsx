'use client';

import { Zap, Thermometer, Droplets, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MEPEquipmentItem } from './types';

interface MEPEquipmentTableProps {
  items: MEPEquipmentItem[];
}

const TRADE_CONFIG = {
  electrical: {
    Icon: Zap,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10 border-yellow-700',
    label: 'Electrical',
  },
  hvac: {
    Icon: Thermometer,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10 border-cyan-700',
    label: 'HVAC',
  },
  plumbing: {
    Icon: Droplets,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-700',
    label: 'Plumbing',
  },
  fire_alarm: {
    Icon: Flame,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-700',
    label: 'Fire Protection',
  },
} as const;

export function MEPEquipmentTable({ items }: MEPEquipmentTableProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-blue-400 mb-2">
        MEP Equipment ({items.length} items)
      </h4>
      <div className="space-y-2">
        {(['electrical', 'hvac', 'plumbing', 'fire_alarm'] as const).map((trade) => {
          const tradeItems = items.filter((e) => e.trade === trade);
          if (tradeItems.length === 0) return null;

          const { Icon, color, bgColor, label } = TRADE_CONFIG[trade];

          return (
            <div key={trade} className={`rounded-lg border p-3 ${bgColor}`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className={`text-xs font-semibold ${color}`}>
                  {label} ({tradeItems.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {tradeItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs bg-dark-surface rounded px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-mono text-gray-400 flex-shrink-0">{item.tag}</span>
                      <span className="text-slate-50 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {item.quantity && (
                        <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-700">
                          {item.quantity} {item.unit || 'EA'}
                        </Badge>
                      )}
                      {item.totalCost && (
                        <Badge variant="outline" className="text-[10px] text-green-400 border-green-700">
                          ${item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
