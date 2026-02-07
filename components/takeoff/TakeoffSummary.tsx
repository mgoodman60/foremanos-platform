'use client';

import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MaterialTakeoff, CostSummary, MEPData } from '@/types/takeoff';

interface TakeoffSummaryProps {
  takeoff: MaterialTakeoff | null;
  totalCost: number;
  categoryCount: number;
  quantityTotals: Record<string, number>;
  mepData?: MEPData | null;
  costSummary?: CostSummary | null;
}

/**
 * Component for displaying takeoff summary statistics
 */
export function TakeoffSummary({
  takeoff,
  totalCost,
  categoryCount,
  quantityTotals,
  mepData,
  costSummary,
}: TakeoffSummaryProps) {
  if (!takeoff) return null;

  const verifiedCount = takeoff.lineItems?.filter((i) => i.verified).length || 0;

  return (
    <div className="border-b border-gray-700 p-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-500">
            {takeoff.lineItems?.length || 0}
          </div>
          <div className="text-xs text-gray-400">Total Items</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">{categoryCount}</div>
          <div className="text-xs text-gray-400">Categories</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-500">
            ${totalCost > 0 ? totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}
          </div>
          <div className="text-xs text-gray-400">Total Cost</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-500">{verifiedCount}</div>
          <div className="text-xs text-gray-400">Verified</div>
        </div>
      </div>

      {/* Quantity Summaries */}
      {Object.keys(quantityTotals).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(quantityTotals).map(([unit, total]) => (
            <Badge key={unit} variant="outline" className="text-xs">
              {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
            </Badge>
          ))}
        </div>
      )}

      {/* MEP Summary - if available */}
      {mepData && mepData.exists && (
        <div className="mt-4 p-3 bg-dark-surface rounded-lg border border-gray-700">
          <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            MEP Systems Summary
          </h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {mepData.electrical && mepData.electrical.itemCount > 0 && (
              <div className="p-2 bg-dark-card rounded">
                <span className="text-yellow-400">⚡ Electrical</span>
                <div className="text-slate-50">{mepData.electrical.itemCount} items</div>
                <div className="text-green-400">
                  ${(mepData.electrical.total || 0).toLocaleString()}
                </div>
              </div>
            )}
            {mepData.plumbing && mepData.plumbing.itemCount > 0 && (
              <div className="p-2 bg-dark-card rounded">
                <span className="text-blue-400">💧 Plumbing</span>
                <div className="text-slate-50">{mepData.plumbing.itemCount} items</div>
                <div className="text-green-400">
                  ${(mepData.plumbing.total || 0).toLocaleString()}
                </div>
              </div>
            )}
            {mepData.hvac && mepData.hvac.itemCount > 0 && (
              <div className="p-2 bg-dark-card rounded">
                <span className="text-cyan-400">🌬️ HVAC</span>
                <div className="text-slate-50">{mepData.hvac.itemCount} items</div>
                <div className="text-green-400">
                  ${(mepData.hvac.total || 0).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          {mepData.totalCost > 0 && (
            <div className="mt-2 text-right text-sm text-gray-400">
              MEP Total:{' '}
              <span className="text-green-400 font-medium">
                ${(mepData.totalCost || 0).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
