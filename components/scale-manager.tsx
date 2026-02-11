/**
 * Scale Manager Component
 * 
 * Displays and manages scale information for construction drawings.
 * Enables scale extraction, validation, and quantity calculations.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  Ruler, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Calculator,
  Layers,
  TrendingUp,
  Download,
  RefreshCw,
} from 'lucide-react';

interface ScaleInfo {
  sheetNumber: string;
  documentId: string;
  documentName: string;
  primaryScale: string;
  scaleRatio: number;
  scaleType: string;
  hasMultipleScales: boolean;
  scaleData: any;
}

interface ScaleStats {
  totalSheets: number;
  sheetsWithScales: number;
  sheetsWithMultipleScales: number;
  byType: Record<string, number>;
  byRatio: Record<string, number>;
  mostCommonScale: { ratio: number; count: number } | null;
}

interface ScaleManagerProps {
  projectSlug: string;
}

export default function ScaleManager({ projectSlug }: ScaleManagerProps) {
  const [scales, setScales] = useState<ScaleInfo[]>([]);
  const [stats, setStats] = useState<ScaleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadScales();
    loadStats();
  }, [projectSlug]);

  const loadScales = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/scales?action=list`
      );
      const data = await response.json();
      if (data.success) {
        setScales(data.scales || []);
      }
    } catch (error) {
      console.error('Error loading scales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/scales?action=stats`
      );
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleExtractScales = async () => {
    setIsExtracting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/extract-scales`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceReprocess: false }),
        }
      );
      const data = await response.json();
      
      if (data.success) {
        await loadScales();
        await loadStats();
      }
    } catch (error) {
      console.error('Error extracting scales:', error);
    } finally {
      setIsExtracting(false);
    }
  };

  // Filter scales
  const filteredScales = scales.filter(scale => {
    if (selectedType !== 'all' && scale.scaleType !== selectedType) {
      return false;
    }
    if (searchQuery && !scale.sheetNumber.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Get unique scale types
  const scaleTypes = ['all', ...new Set(scales.map(s => s.scaleType))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
          <p className="text-gray-400">Loading scales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ruler className="h-6 w-6 text-blue-500" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-gray-100">Scale Manager</h2>
        </div>
        <button
          onClick={handleExtractScales}
          disabled={isExtracting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {isExtracting ? 'Extracting...' : 'Extract Scales'}
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Sheets */}
          <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText className="h-5 w-5 text-blue-500" aria-hidden="true" />
              <span className="text-2xl font-bold text-gray-100">
                {stats.totalSheets}
              </span>
            </div>
            <p className="text-sm text-gray-400">Total Sheets</p>
          </div>

          {/* Sheets with Scales */}
          <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />
              <span className="text-2xl font-bold text-gray-100">
                {stats.sheetsWithScales}
              </span>
            </div>
            <p className="text-sm text-gray-400">With Scales</p>
            {stats.totalSheets > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {Math.round((stats.sheetsWithScales / stats.totalSheets) * 100)}% coverage
              </p>
            )}
          </div>

          {/* Multiple Scales */}
          <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Layers className="h-5 w-5 text-amber-500" aria-hidden="true" />
              <span className="text-2xl font-bold text-gray-100">
                {stats.sheetsWithMultipleScales}
              </span>
            </div>
            <p className="text-sm text-gray-400">Multiple Scales</p>
          </div>

          {/* Most Common Scale */}
          <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-purple-500" aria-hidden="true" />
              <span className="text-2xl font-bold text-gray-100">
                {stats.mostCommonScale ? `1:${stats.mostCommonScale.ratio}` : 'N/A'}
              </span>
            </div>
            <p className="text-sm text-gray-400">Most Common</p>
            {stats.mostCommonScale && (
              <p className="text-xs text-gray-400 mt-1">
                Used in {stats.mostCommonScale.count} sheets
              </p>
            )}
          </div>
        </div>
      )}

      {/* Scale Type Breakdown */}
      {stats && Object.keys(stats.byType).length > 0 && (
        <div className="bg-dark-card border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-500" aria-hidden="true" />
            Scale Types Distribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="text-center">
                <div className="text-2xl font-bold text-blue-400">{count}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatScaleType(type)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search sheets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-dark-card border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2 bg-dark-card border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {scaleTypes.map(type => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Types' : formatScaleType(type)}
            </option>
          ))}
        </select>
      </div>

      {/* Scales List */}
      {filteredScales.length === 0 ? (
        <div className="text-center py-12 bg-dark-card border border-gray-700 rounded-lg">
          <Ruler className="h-12 w-12 text-gray-600 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-400 mb-2">No scales found</p>
          <p className="text-sm text-gray-400 mb-4">
            Click "Extract Scales" to analyze your drawings
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScales.map((scale, index) => (
            <ScaleCard key={index} scale={scale} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Scale Card Component
 */
function ScaleCard({ scale }: { scale: ScaleInfo }) {
  const scaleTypeBadgeColor = getScaleTypeColor(scale.scaleType);

  return (
    <div className="bg-dark-card border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
      {/* Sheet Number */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">
            {scale.sheetNumber}
          </h3>
          <p className="text-xs text-gray-400 truncate">
            {scale.documentName}
          </p>
        </div>
        {scale.hasMultipleScales && (
          <span className="px-2 py-1 bg-amber-900/30 text-amber-400 text-xs rounded border border-amber-700">
            Multi
          </span>
        )}
      </div>

      {/* Primary Scale */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Scale:</span>
          <span className="text-sm font-mono text-blue-400">
            {scale.primaryScale}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Ratio:</span>
          <span className="text-sm font-mono text-gray-300">
            1:{scale.scaleRatio}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Type:</span>
          <span className={`px-2 py-0.5 text-xs rounded ${scaleTypeBadgeColor}`}>
            {formatScaleType(scale.scaleType)}
          </span>
        </div>
      </div>

      {/* Quick Info */}
      <div className="mt-3 pt-3 border-t border-gray-700">
        <p className="text-xs text-gray-400">
          {getScaleDescription(scale)}
        </p>
      </div>
    </div>
  );
}

/**
 * Get scale type color
 */
function getScaleTypeColor(type: string): string {
  const colors: Record<string, string> = {
    architectural_imperial: 'bg-blue-900/30 text-blue-400 border border-blue-700',
    architectural_metric: 'bg-green-900/30 text-green-400 border border-green-700',
    engineering: 'bg-purple-900/30 text-purple-400 border border-purple-700',
    metric_standard: 'bg-cyan-900/30 text-cyan-400 border border-cyan-700',
    full_size: 'bg-emerald-900/30 text-emerald-400 border border-emerald-700',
    not_to_scale: 'bg-gray-700/30 text-gray-400 border border-gray-600',
  };
  return colors[type] || 'bg-gray-700/30 text-gray-400 border border-gray-600';
}

/**
 * Format scale type for display
 */
function formatScaleType(type: string): string {
  const labels: Record<string, string> = {
    architectural_imperial: 'Arch Imperial',
    architectural_metric: 'Arch Metric',
    engineering: 'Engineering',
    metric_standard: 'Metric',
    full_size: 'Full Size',
    not_to_scale: 'NTS',
  };
  return labels[type] || type;
}

/**
 * Get scale description
 */
function getScaleDescription(scale: ScaleInfo): string {
  if (scale.scaleType === 'not_to_scale') {
    return 'Not to scale - measurements unavailable';
  }
  if (scale.scaleType === 'full_size') {
    return 'Full size - 1:1 representation';
  }
  return `Enables accurate quantity takeoffs`;
}
