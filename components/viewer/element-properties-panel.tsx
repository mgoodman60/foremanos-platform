'use client';

import { useState, useEffect } from 'react';
import { Info, Copy, ChevronRight, ChevronDown, Tag, Ruler, Hash, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ViewerHandle } from './forge-viewer-enhanced';

interface PropertyGroup {
  displayName: string;
  displayCategory: string;
  displayValue: string | number;
  type: number;
  hidden: boolean;
  attributeName: string;
  units?: string;
}

interface ElementProperties {
  dbId: number;
  name: string;
  externalId?: string;
  properties: PropertyGroup[];
}

interface ElementPropertiesPanelProps {
  viewerRef: React.RefObject<ViewerHandle>;
  selectedIds: number[];
  className?: string;
}

export default function ElementPropertiesPanel({
  viewerRef,
  selectedIds,
  className = '',
}: ElementPropertiesPanelProps) {
  const [properties, setProperties] = useState<ElementProperties | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Constraints', 'Dimensions', 'Identity Data']));

  // Fetch properties when selection changes
  useEffect(() => {
    if (selectedIds.length === 0) {
      setProperties(null);
      return;
    }

    const fetchProperties = async () => {
      setLoading(true);
      try {
        const props = await viewerRef.current?.getProperties(selectedIds[0]);
        if (props) {
          setProperties(props);
        }
      } catch (e) {
        console.error('[Properties] Fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [selectedIds, viewerRef]);

  // Group properties by category
  const groupedProperties = properties?.properties.reduce((acc, prop) => {
    if (prop.hidden) return acc;
    const category = prop.displayCategory || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(prop);
    return acc;
  }, {} as Record<string, PropertyGroup[]>);

  // Toggle group expansion
  const toggleGroup = (category: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedGroups(newExpanded);
  };

  // Copy value to clipboard
  const copyValue = (value: string | number) => {
    navigator.clipboard.writeText(String(value));
    toast.success('Copied to clipboard');
  };

  // Get icon for property type
  const PropertyIcon = ({ type }: { type: number }) => {
    switch (type) {
      case 1: return <Hash className="w-3 h-3 text-blue-400" />;
      case 2: return <Ruler className="w-3 h-3 text-green-400" />;
      case 3: return <FileText className="w-3 h-3 text-purple-400" />;
      default: return <Tag className="w-3 h-3 text-gray-400" />;
    }
  };

  // Format value with units
  const formatValue = (prop: PropertyGroup) => {
    const value = prop.displayValue;
    if (prop.units && typeof value === 'number') {
      return `${value.toFixed(2)} ${prop.units}`;
    }
    return String(value);
  };

  if (selectedIds.length === 0) {
    return (
      <div className={`bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Element Properties</span>
        </div>
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          Select an element to view properties
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden ${className}`}>
        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Element Properties</span>
        </div>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-dark-subtle border border-gray-700 rounded-xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Element Properties</span>
        </div>
        {properties && (
          <p className="text-xs text-gray-400 mt-1 truncate" title={properties.name}>
            {properties.name}
          </p>
        )}
      </div>

      {/* Properties List */}
      <div className="flex-1 overflow-y-auto">
        {properties && groupedProperties && (
          <div className="divide-y divide-gray-700/50">
            {/* Basic Info */}
            <div className="p-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-gray-400">DB ID</div>
                <div className="text-white flex items-center gap-1">
                  {properties.dbId}
                  <button
                    onClick={() => copyValue(properties.dbId)}
                    className="p-0.5 hover:bg-gray-700 rounded"
                  >
                    <Copy className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
                <div className="text-gray-400">External ID</div>
                <div className="text-white truncate flex items-center gap-1" title={properties.externalId || ''}>
                  <span className="truncate">{properties.externalId || 'N/A'}</span>
                  {properties.externalId && (
                    <button
                      onClick={() => copyValue(properties.externalId!)}
                      className="p-0.5 hover:bg-gray-700 rounded flex-shrink-0"
                    >
                      <Copy className="w-3 h-3 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Property Groups */}
            {Object.entries(groupedProperties)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, props]) => (
                <div key={category}>
                  <button
                    onClick={() => toggleGroup(category)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-700/30 transition-colors"
                  >
                    {expandedGroups.has(category) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-300 font-medium">{category}</span>
                    <span className="text-xs text-gray-500 ml-auto">{props.length}</span>
                  </button>

                  {expandedGroups.has(category) && (
                    <div className="px-3 pb-2">
                      {props.map((prop, idx) => (
                        <div
                          key={`${prop.attributeName}-${idx}`}
                          className="grid grid-cols-2 gap-2 py-1.5 text-xs hover:bg-gray-700/20 rounded px-2 -mx-2 group"
                        >
                          <div className="text-gray-400 flex items-center gap-1.5">
                            <PropertyIcon type={prop.type} />
                            <span className="truncate" title={prop.displayName}>
                              {prop.displayName}
                            </span>
                          </div>
                          <div className="text-white flex items-center gap-1">
                            <span className="truncate" title={formatValue(prop)}>
                              {formatValue(prop)}
                            </span>
                            <button
                              onClick={() => copyValue(prop.displayValue)}
                              className="p-0.5 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity"
                            >
                              <Copy className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Selection count */}
      {selectedIds.length > 1 && (
        <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
          {selectedIds.length} elements selected (showing first)
        </div>
      )}
    </div>
  );
}
