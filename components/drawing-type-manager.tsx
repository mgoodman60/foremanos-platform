/**
 * Drawing Type Manager Component
 * 
 * Displays and manages drawing type classifications for construction drawings.
 * Enables automatic classification and provides type-based filtering.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Grid3x3, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  TrendingUp,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface DrawingInfo {
  sheetNumber: string;
  documentId: string;
  documentName: string;
  drawingType: string;
  drawingTypeName: string;
  confidence: number;
  isComposite: boolean;
  discipline: string;
}

interface DrawingTypeStats {
  totalSheets: number;
  byType: Record<string, number>;
  byTypeFormatted: Record<string, { count: number; displayName: string }>;
  avgConfidence: number;
  compositeSheets: number;
}

interface DrawingTypeManagerProps {
  projectSlug: string;
}

export default function DrawingTypeManager({ projectSlug }: DrawingTypeManagerProps) {
  const [drawings, setDrawings] = useState<DrawingInfo[]>([]);
  const [stats, setStats] = useState<DrawingTypeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClassifying, setIsClassifying] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDrawings();
    loadStats();
  }, [projectSlug]);

  const loadDrawings = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/drawing-types?action=list`
      );
      const data = await response.json();
      if (data.success) {
        setDrawings(data.drawings || []);
      }
    } catch (error) {
      console.error('Error loading drawings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/drawing-types?action=stats`
      );
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleClassify = async () => {
    setIsClassifying(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/classify-drawings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceReprocess: false }),
        }
      );
      const data = await response.json();
      
      if (data.success) {
        await loadDrawings();
        await loadStats();
      }
    } catch (error) {
      console.error('Error classifying drawings:', error);
    } finally {
      setIsClassifying(false);
    }
  };

  // Filter drawings
  const filteredDrawings = drawings.filter(drawing => {
    if (selectedType !== 'all' && drawing.drawingType !== selectedType) {
      return false;
    }
    if (searchQuery && !drawing.sheetNumber.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Get unique drawing types
  const drawingTypes = ['all', ...new Set(drawings.map(d => d.drawingType))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
          <p className="text-gray-400">Loading drawings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid3x3 className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-100">Drawing Type Manager</h2>
        </div>
        <button
          onClick={handleClassify}
          disabled={isClassifying}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {isClassifying ? 'Classifying...' : 'Classify Drawings'}
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Sheets */}
          <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FileText aria-hidden="true" className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-gray-100">
                {stats.totalSheets}
              </span>
            </div>
            <p className="text-sm text-gray-400">Total Sheets</p>
          </div>

          {/* Drawing Types */}
          <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Layers aria-hidden="true" className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-gray-100">
                {Object.keys(stats.byType).length}
              </span>
            </div>
            <p className="text-sm text-gray-400">Drawing Types</p>
          </div>

          {/* Average Confidence */}
          <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="text-2xl font-bold text-gray-100">
                {Math.round(stats.avgConfidence * 100)}%
              </span>
            </div>
            <p className="text-sm text-gray-400">Avg Confidence</p>
          </div>

          {/* Composite Sheets */}
          <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold text-gray-100">
                {stats.compositeSheets}
              </span>
            </div>
            <p className="text-sm text-gray-400">Composite Sheets</p>
          </div>
        </div>
      )}

      {/* Type Distribution */}
      {stats && Object.keys(stats.byTypeFormatted).length > 0 && (
        <div className="bg-dark-card border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp aria-hidden="true" className="h-5 w-5 text-blue-500" />
            Drawing Type Distribution
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(stats.byTypeFormatted)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 10)
              .map(([type, info]) => (
                <div key={type} className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{info.count}</div>
                  <div className="text-xs text-gray-400 mt-1">{info.displayName}</div>
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
          className="px-4 py-2 bg-dark-card border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
        >
          <option value="all">All Types</option>
          {drawingTypes
            .filter(t => t !== 'all')
            .map(type => {
              const info = drawings.find(d => d.drawingType === type);
              return (
                <option key={type} value={type}>
                  {info?.drawingTypeName || type}
                </option>
              );
            })}
        </select>
      </div>

      {/* Drawings List */}
      {filteredDrawings.length === 0 ? (
        <div className="text-center py-12 bg-dark-card border border-gray-700 rounded-lg">
          <Grid3x3 className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No classified drawings found</p>
          <p className="text-sm text-gray-400 mb-4">
            Click "Classify Drawings" to analyze your sheets
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrawings.map((drawing, index) => (
            <DrawingCard key={index} drawing={drawing} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Drawing Card Component
 */
function DrawingCard({ drawing }: { drawing: DrawingInfo }) {
  const typeColor = getDrawingTypeColor(drawing.drawingType);
  const confidenceColor = getConfidenceColor(drawing.confidence);

  return (
    <div className="bg-dark-card border border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors">
      {/* Sheet Number */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">
            {drawing.sheetNumber}
          </h3>
          <p className="text-xs text-gray-400 truncate">
            {drawing.documentName}
          </p>
        </div>
        {drawing.isComposite && (
          <span className="px-2 py-1 bg-amber-900/30 text-amber-400 text-xs rounded border border-amber-700">
            Mixed
          </span>
        )}
      </div>

      {/* Drawing Type */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Type:</span>
          <span className={`px-2 py-0.5 text-xs rounded ${typeColor}`}>
            {drawing.drawingTypeName}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Confidence:</span>
          <span className={`px-2 py-0.5 text-xs rounded ${confidenceColor}`}>
            {Math.round(drawing.confidence * 100)}%
          </span>
        </div>

        {drawing.discipline && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Discipline:</span>
            <span className="px-2 py-0.5 text-xs rounded bg-gray-700/50 text-gray-300 border border-gray-600">
              {drawing.discipline}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get drawing type color
 */
function getDrawingTypeColor(type: string): string {
  const colors: Record<string, string> = {
    floor_plan: 'bg-blue-900/30 text-blue-400 border border-blue-700',
    site_plan: 'bg-green-900/30 text-green-400 border border-green-700',
    elevation: 'bg-purple-900/30 text-purple-400 border border-purple-700',
    section: 'bg-orange-900/30 text-orange-400 border border-orange-700',
    detail: 'bg-cyan-900/30 text-cyan-400 border border-cyan-700',
    schedule: 'bg-pink-900/30 text-pink-400 border border-pink-700',
    mep_plan: 'bg-yellow-900/30 text-yellow-400 border border-yellow-700',
    structural: 'bg-red-900/30 text-red-400 border border-red-700',
    reflected_ceiling: 'bg-indigo-900/30 text-indigo-400 border border-indigo-700',
    roof_plan: 'bg-teal-900/30 text-teal-400 border border-teal-700',
    foundation: 'bg-stone-900/30 text-stone-400 border border-stone-700',
    landscape: 'bg-lime-900/30 text-lime-400 border border-lime-700',
    fire_protection: 'bg-rose-900/30 text-rose-400 border border-rose-700',
    electrical: 'bg-amber-900/30 text-amber-400 border border-amber-700',
    plumbing: 'bg-sky-900/30 text-sky-400 border border-sky-700',
    hvac: 'bg-emerald-900/30 text-emerald-400 border border-emerald-700',
    isometric: 'bg-violet-900/30 text-violet-400 border border-violet-700',
    rendering: 'bg-fuchsia-900/30 text-fuchsia-400 border border-fuchsia-700',
    diagram: 'bg-slate-900/30 text-slate-400 border border-slate-700',
    unknown: 'bg-gray-700/30 text-gray-400 border border-gray-600',
  };
  return colors[type] || colors.unknown;
}

/**
 * Get confidence color
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) {
    return 'bg-green-900/30 text-green-400 border border-green-700';
  } else if (confidence >= 0.6) {
    return 'bg-amber-900/30 text-amber-400 border border-amber-700';
  } else {
    return 'bg-red-900/30 text-red-400 border border-red-700';
  }
}
