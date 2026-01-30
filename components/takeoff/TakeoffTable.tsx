'use client';

import {
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Package,
  Ruler,
  DollarSign,
  Layers,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TakeoffLineItem, CategorySummary, CSIDivisionSummary } from '@/types/takeoff';
import { getConfidenceColor } from '@/lib/takeoff-formatters';

interface TakeoffTableProps {
  items: TakeoffLineItem[];
  selectedItems: Set<string>;
  onSelectItem: (id: string, selected: boolean) => void;
  onEditItem: (item: TakeoffLineItem) => void;
  viewMode: 'csi' | 'category';
  expandedCategories: Set<string>;
  onToggleCategory: (category: string) => void;
  categories?: CategorySummary[];
  csiGroups?: CSIDivisionSummary[];
  hasBudgetDoc?: boolean;
}

/**
 * Main table component for displaying takeoff items
 * Supports both category and CSI division views
 */
export function TakeoffTable({
  items,
  selectedItems,
  onSelectItem,
  onEditItem,
  viewMode,
  expandedCategories,
  onToggleCategory,
  categories = [],
  csiGroups = [],
  hasBudgetDoc = false,
}: TakeoffTableProps) {
  const renderItem = (item: TakeoffLineItem) => (
    <div
      key={item.id}
      className={`flex items-start gap-3 rounded-lg border bg-dark-surface p-3 text-sm transition-all cursor-pointer group ${
        selectedItems.has(item.id)
          ? 'border-orange-500 bg-orange-500/10'
          : 'border-gray-700 hover:border-orange-500'
      }`}
      onClick={() => onEditItem(item)}
    >
      {/* Checkbox for bulk selection */}
      {!item.verified && (
        <div
          className="mt-1"
          onClick={(e) => {
            e.stopPropagation();
            onSelectItem(item.id, !selectedItems.has(item.id));
          }}
        >
          <input
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={() => {}}
            className="h-4 w-4 rounded border-gray-600 bg-[#2D333B] text-orange-500 focus:ring-orange-500 cursor-pointer"
          />
        </div>
      )}

      {/* Status Icon */}
      <div className="mt-1">
        {item.verified ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-orange-400" />
        )}
      </div>

      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-[#F8FAFC] truncate">{item.itemName}</h4>
          {item.verified && (
            <Badge variant="outline" className="text-xs text-green-400 border-green-700">
              Verified
            </Badge>
          )}
          {item.confidence !== undefined && (
            <div className={`flex items-center gap-1 text-xs ${getConfidenceColor(item.confidence)}`}>
              <Sparkles className="h-3 w-3" />
              <span>
                {item.confidence > 1 ? item.confidence.toFixed(0) : (item.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        {item.description && <p className="text-xs text-gray-400 mb-2">{item.description}</p>}

        {/* Quantity Row */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Ruler className="h-3 w-3" />
            <span className="font-medium text-orange-400">
              {item.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {item.unit}
            </span>
          </div>

          {item.unitCost ? (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span>${item.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}/{item.unit}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-500">
              <DollarSign className="h-3 w-3" />
              <span>No price - click to add</span>
            </div>
          )}

          {item.location && (
            <div className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              <span>{item.location}</span>
            </div>
          )}

          {item.sheetNumber && (
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span>Sheet {item.sheetNumber}</span>
            </div>
          )}
        </div>

        {item.notes && <p className="mt-2 text-xs text-gray-500 italic">{item.notes}</p>}
      </div>

      {/* Total Cost */}
      {item.totalCost && (
        <div className="flex-shrink-0 text-right">
          <div className="text-sm font-medium text-green-400">
            ${item.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
      )}
    </div>
  );

  if (viewMode === 'csi') {
    return (
      <div className="p-4 space-y-2">
        {csiGroups.map(({ division, categories: divCategories }) => (
          <div key={division.number} className="space-y-1">
            {/* Division Header */}
            <div className="rounded-lg px-3 py-2 bg-dark-card">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-[#F8FAFC]">
                  Division {String(division.number).padStart(2, '0')} - {division.name}
                </span>
                <Badge variant="secondary" className="ml-auto">
                  {divCategories.reduce((sum, cat) => sum + cat.itemCount, 0)} items
                </Badge>
                <span className="text-sm text-green-400 font-medium">
                  ${divCategories.reduce((sum, cat) => sum + cat.totalCost, 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Categories in Division */}
            <div className="ml-6 space-y-1">
              {divCategories.map((catSummary) => (
                <div key={catSummary.category}>
                  <button
                    onClick={() => onToggleCategory(catSummary.category)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-dark-card transition-colors border bg-dark-surface border-gray-700"
                  >
                    {expandedCategories.has(catSummary.category) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <Package className="h-4 w-4 text-blue-400" />
                    <span className="font-medium text-[#F8FAFC] capitalize">{catSummary.category}</span>
                    <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
                      <span>{catSummary.itemCount} items</span>
                      {catSummary.totalCost > 0 && (
                        <span className="text-green-400">
                          ${catSummary.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Category Items */}
                  {expandedCategories.has(catSummary.category) && (
                    <div className="ml-6 mt-1 space-y-1">{catSummary.items.map(renderItem)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Category View (default)
  return (
    <div className="p-4 space-y-2">
      {categories.map((catSummary) => (
        <div key={catSummary.category}>
          {/* Category Header */}
          <button
            onClick={() => onToggleCategory(catSummary.category)}
            className="flex w-full items-center gap-2 rounded-lg bg-dark-card px-3 py-2 text-left hover:bg-[#383e47] transition-colors"
          >
            {expandedCategories.has(catSummary.category) ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
            <Package className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-[#F8FAFC] capitalize">{catSummary.category}</span>
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
              <span>{catSummary.itemCount} items</span>
              {catSummary.totalCost > 0 && (
                <span className="text-green-400 font-medium">
                  ${catSummary.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </button>

          {/* Category Items */}
          {expandedCategories.has(catSummary.category) && (
            <div className="ml-6 mt-1 space-y-1">{catSummary.items.map(renderItem)}</div>
          )}
        </div>
      ))}
    </div>
  );
}
