/**
 * Door & Window Schedule Browser Component
 * Displays extracted door and window schedules with filtering and details view
 */

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  DoorOpen,
  Square,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  Flame,
  Wind,
  Ruler,
  Package,
} from 'lucide-react';

interface DoorItem {
  id: string;
  doorNumber: string;
  doorType: string;
  width: number | null;
  height: number | null;
  material: string | null;
  finish: string | null;
  hardwareSet: string | null;
  fireRating: string | null;
  fromRoom: string | null;
  toRoom: string | null;
  notes: string | null;
  Room?: { name: string; roomNumber: string } | null;
}

interface WindowItem {
  id: string;
  windowNumber: string;
  windowType: string;
  width: number | null;
  height: number | null;
  material: string | null;
  glazingType: string | null;
  operationType: string | null;
  uValue: number | null;
  shgc: number | null;
  fireRating: string | null;
  isEgress: boolean;
  notes: string | null;
  Room?: { name: string; roomNumber: string } | null;
}

interface ScheduleBrowserProps {
  projectSlug: string;
  type: 'doors' | 'windows';
}

export default function ScheduleBrowser({ projectSlug, type }: ScheduleBrowserProps) {
  const [items, setItems] = useState<(DoorItem | WindowItem)[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [groupedItems, setGroupedItems] = useState<Record<string, any[]>>({});

  const endpoint = type === 'doors' ? 'door-schedule' : 'window-schedule';
  const Icon = type === 'doors' ? DoorOpen : Square;
  const title = type === 'doors' ? 'Door Schedule' : 'Window Schedule';

  useEffect(() => {
    fetchSchedule();
  }, [projectSlug, type]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectSlug}/${endpoint}`);
      const data = await res.json();
      
      if (data.success) {
        const itemKey = type === 'doors' ? 'doors' : 'windows';
        setItems(data[itemKey] || []);
        setGroupedItems(data.byType || {});
        
        // Expand first type by default
        const types = Object.keys(data.byType || {});
        if (types.length > 0) {
          setExpandedTypes(new Set([types[0]]));
        }
      }
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
      toast.error(`Failed to load ${title.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    try {
      setExtracting(true);
      toast.loading(`Extracting ${title.toLowerCase()} from documents...`);
      
      const res = await fetch(`/api/projects/${projectSlug}/${endpoint}`, {
        method: 'POST',
      });
      const data = await res.json();
      
      toast.dismiss();
      if (data.success) {
        toast.success(`Extracted ${data[type === 'doors' ? 'doorsExtracted' : 'windowsExtracted']} items`);
        fetchSchedule();
      } else {
        toast.error(data.error || 'Extraction failed');
      }
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to extract schedule');
    } finally {
      setExtracting(false);
    }
  };

  const toggleType = (typeName: string) => {
    const next = new Set(expandedTypes);
    if (next.has(typeName)) {
      next.delete(typeName);
    } else {
      next.add(typeName);
    }
    setExpandedTypes(next);
  };

  const filteredGroups = filterType === 'all' 
    ? groupedItems 
    : { [filterType]: groupedItems[filterType] || [] };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <span className="text-sm text-gray-500">({items.length} items)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">All Types</option>
            {Object.keys(groupedItems).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          
          {/* Extract Button */}
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Extract from Plans
          </button>
        </div>
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            No {type} found. Extract from your architectural drawings.
          </p>
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Extract {title}
          </button>
        </div>
      ) : (
        <div className="divide-y">
          {Object.entries(filteredGroups).map(([typeName, typeItems]) => (
            <div key={typeName}>
              {/* Type Header */}
              <button
                onClick={() => toggleType(typeName)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  {expandedTypes.has(typeName) ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                  <span className="font-medium">{typeName}</span>
                  <span className="text-sm text-gray-500">({typeItems.length})</span>
                </div>
              </button>

              {/* Items List */}
              {expandedTypes.has(typeName) && (
                <div className="px-4 pb-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 font-medium">#</th>
                          <th className="pb-2 font-medium">Size</th>
                          <th className="pb-2 font-medium">Material</th>
                          {type === 'doors' && <th className="pb-2 font-medium">Hardware</th>}
                          {type === 'windows' && <th className="pb-2 font-medium">Glazing</th>}
                          <th className="pb-2 font-medium">Rating</th>
                          <th className="pb-2 font-medium">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {typeItems.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-2 font-medium text-blue-600">
                              {type === 'doors' ? item.doorNumber : item.windowNumber}
                            </td>
                            <td className="py-2">
                              {item.width && item.height ? (
                                <span className="flex items-center gap-1">
                                  <Ruler className="h-3 w-3 text-gray-400" />
                                  {item.width}" × {item.height}"
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2">
                              {item.material || '-'}
                            </td>
                            {type === 'doors' && (
                              <td className="py-2">
                                {(item as DoorItem).hardwareSet || '-'}
                              </td>
                            )}
                            {type === 'windows' && (
                              <td className="py-2">
                                {(item as WindowItem).glazingType || '-'}
                              </td>
                            )}
                            <td className="py-2">
                              {item.fireRating ? (
                                <span className="flex items-center gap-1 text-orange-600">
                                  <Flame className="h-3 w-3" />
                                  {item.fireRating}
                                </span>
                              ) : (
                                type === 'windows' && (item as WindowItem).isEgress ? (
                                  <span className="text-green-600 text-xs">Egress</span>
                                ) : '-'
                              )}
                            </td>
                            <td className="py-2 text-gray-500">
                              {item.Room?.roomNumber || 
                               (type === 'doors' && (item as DoorItem).fromRoom) || 
                               '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
