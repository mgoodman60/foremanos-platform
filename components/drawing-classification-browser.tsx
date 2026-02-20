'use client';

import { useState, useEffect } from 'react';
import { Search, FileText, Loader2, RefreshCw, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface DrawingClassification {
  type: string;
  subtype: string;
  confidence: number;
  features: string[];
  reasoning: string;
  patterns: string[];
}

interface DrawingTypeResult {
  sheetNumber: string;
  sheetTitle: string;
  classification: DrawingClassification;
  extractedAt: string;
}

interface Stats {
  total: number;
  byType: Record<string, number>;
  bySubtype: Record<string, number>;
  averageConfidence: number;
  lastUpdated?: string;
}

interface DrawingClassificationBrowserProps {
  projectSlug: string;
}

const DRAWING_TYPE_LABELS: Record<string, string> = {
  FLOOR_PLAN: 'Floor Plan',
  ELEVATION: 'Elevation',
  SECTION: 'Section',
  DETAIL: 'Detail',
  SCHEDULE: 'Schedule',
  SITE_PLAN: 'Site Plan',
  ROOF_PLAN: 'Roof Plan',
  REFLECTED_CEILING: 'Reflected Ceiling',
  FRAMING_PLAN: 'Framing Plan',
  FOUNDATION_PLAN: 'Foundation Plan',
  MECHANICAL: 'Mechanical',
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  FIRE_PROTECTION: 'Fire Protection',
  STRUCTURAL: 'Structural',
  CIVIL: 'Civil',
  LANDSCAPE: 'Landscape',
  DIAGRAM: 'Diagram',
  ISOMETRIC: 'Isometric',
  AXONOMETRIC: 'Axonometric',
  PERSPECTIVE: 'Perspective',
  RENDERED_VIEW: 'Rendered View',
  COVER_SHEET: 'Cover Sheet',
  SPEC_SHEET: 'Spec Sheet',
  EQUIPMENT_LAYOUT: 'Equipment Layout',
  LIGHTING_PLAN: 'Lighting Plan',
  POWER_PLAN: 'Power Plan',
  CONTROL_DIAGRAM: 'Control Diagram',
  RISER_DIAGRAM: 'Riser Diagram',
  SINGLE_LINE_DIAGRAM: 'Single Line Diagram',
  UNKNOWN: 'Unknown'
};

const DRAWING_TYPE_COLORS: Record<string, string> = {
  FLOOR_PLAN: 'bg-blue-500',
  ELEVATION: 'bg-purple-500',
  SECTION: 'bg-green-500',
  DETAIL: 'bg-yellow-500',
  SCHEDULE: 'bg-gray-500',
  SITE_PLAN: 'bg-emerald-500',
  ROOF_PLAN: 'bg-orange-500',
  REFLECTED_CEILING: 'bg-cyan-500',
  FRAMING_PLAN: 'bg-indigo-500',
  FOUNDATION_PLAN: 'bg-pink-500',
  MECHANICAL: 'bg-red-500',
  ELECTRICAL: 'bg-amber-500',
  PLUMBING: 'bg-teal-500',
  FIRE_PROTECTION: 'bg-rose-500',
  STRUCTURAL: 'bg-violet-500',
  CIVIL: 'bg-lime-500',
  LANDSCAPE: 'bg-green-600',
  DIAGRAM: 'bg-slate-500',
  ISOMETRIC: 'bg-fuchsia-500',
  COVER_SHEET: 'bg-gray-600',
  SPEC_SHEET: 'bg-neutral-500',
  UNKNOWN: 'bg-gray-400'
};

const SUBTYPE_LABELS: Record<string, string> = {
  ARCHITECTURAL: 'Architectural',
  STRUCTURAL: 'Structural',
  MECHANICAL: 'Mechanical',
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  FIRE_PROTECTION: 'Fire Protection',
  CIVIL: 'Civil',
  LANDSCAPE: 'Landscape',
  GENERAL: 'General'
};

export function DrawingClassificationBrowser({ projectSlug }: DrawingClassificationBrowserProps) {
  const [results, setResults] = useState<DrawingTypeResult[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [minConfidence, _setMinConfidence] = useState(0);
  const [_viewMode, _setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchDrawingTypes();
  }, [projectSlug, selectedType, selectedSubtype, minConfidence]);

  const fetchDrawingTypes = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ action: 'summary' });
      if (selectedType) params.append('type', selectedType);
      if (selectedSubtype) params.append('subtype', selectedSubtype);
      if (minConfidence > 0) params.append('minConfidence', minConfidence.toString());

      const response = await fetch(`/api/projects/${projectSlug}/drawing-types?${params}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.results || []);
        setStats(data.stats || null);
      } else {
        toast.error('Failed to load drawing classifications');
      }
    } catch (error) {
      console.error('Error fetching drawing types:', error);
      toast.error('Failed to load drawing classifications');
    } finally {
      setLoading(false);
    }
  };

  const handleClassify = async (useVision = false) => {
    try {
      setClassifying(true);
      toast.loading('Classifying drawings...');

      const response = await fetch(`/api/projects/${projectSlug}/classify-drawings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess: true, useVision })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Classified ${data.stats.total} drawings`);
        await fetchDrawingTypes();
      } else {
        toast.error('Failed to classify drawings');
      }
    } catch (error) {
      console.error('Error classifying drawings:', error);
      toast.error('Failed to classify drawings');
    } finally {
      setClassifying(false);
    }
  };

  const filteredResults = results.filter(result => {
    const matchesSearch = 
      result.sheetNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.sheetTitle.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500/10 border-green-500/30';
    if (confidence >= 0.5) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  return (
    <div className="min-h-screen bg-dark-surface text-gray-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-2">
              <Layers aria-hidden="true" className="h-8 w-8 text-blue-400" />
              Drawing Classification
            </h1>
            <p className="text-gray-400 mt-1">
              Automatically categorized construction drawings
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleClassify(false)}
              disabled={classifying}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {classifying ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
              )}
              Classify Drawings
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Total Drawings</div>
              <div className="text-3xl font-bold text-slate-50">{stats.total}</div>
            </div>
            <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Avg Confidence</div>
              <div className={`text-3xl font-bold ${getConfidenceColor(stats.averageConfidence)}`}>
                {(stats.averageConfidence * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Drawing Types</div>
              <div className="text-3xl font-bold text-blue-400">
                {Object.keys(stats.byType).length}
              </div>
            </div>
            <div className="bg-dark-card border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Disciplines</div>
              <div className="text-3xl font-bold text-purple-400">
                {Object.keys(stats.bySubtype).length}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-dark-card border border-gray-700 rounded-lg p-4 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by sheet number or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedType(null)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                selectedType === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-dark-surface text-gray-400 hover:text-gray-200'
              }`}
            >
              All Types
            </button>
            {stats && Object.keys(stats.byType).map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  selectedType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-dark-surface text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${DRAWING_TYPE_COLORS[type] || 'bg-gray-400'}`} />
                {DRAWING_TYPE_LABELS[type] || type}
                <span className="text-xs opacity-70">({stats.byType[type]})</span>
              </button>
            ))}
          </div>

          {/* Discipline Filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSubtype(null)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                selectedSubtype === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-dark-surface text-gray-400 hover:text-gray-200'
              }`}
            >
              All Disciplines
            </button>
            {stats && Object.keys(stats.bySubtype).map(subtype => (
              <button
                key={subtype}
                onClick={() => setSelectedSubtype(subtype)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  selectedSubtype === subtype
                    ? 'bg-purple-600 text-white'
                    : 'bg-dark-surface text-gray-400 hover:text-gray-200'
                }`}
              >
                {SUBTYPE_LABELS[subtype] || subtype}
                <span className="text-xs opacity-70 ml-2">({stats.bySubtype[subtype]})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center py-12">
          <FileText aria-hidden="true" className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No Drawings Found</h3>
          <p className="text-gray-400">
            {results.length === 0
              ? 'Click "Classify Drawings" to analyze your project drawings'
              : 'Try adjusting your filters or search term'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map((result, index) => {
            const { classification } = result;
            const typeColor = DRAWING_TYPE_COLORS[classification.type] || 'bg-gray-400';

            return (
              <div
                key={index}
                className={`bg-dark-card border rounded-lg p-4 hover:border-blue-500 transition-all ${
                  getConfidenceBg(classification.confidence)
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full ${typeColor}`} />
                      <h3 className="font-semibold text-slate-50">
                        {result.sheetNumber}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-1">
                      {result.sheetTitle || 'Untitled'}
                    </p>
                  </div>
                  <div className={`text-2xl font-bold ${getConfidenceColor(classification.confidence)}`}>
                    {(classification.confidence * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Classification */}
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Type</div>
                    <div className="text-sm font-medium text-slate-50">
                      {DRAWING_TYPE_LABELS[classification.type] || classification.type}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-400 mb-1">Discipline</div>
                    <div className="text-sm font-medium text-purple-400">
                      {SUBTYPE_LABELS[classification.subtype] || classification.subtype}
                    </div>
                  </div>

                  {classification.features.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Key Features</div>
                      <div className="flex flex-wrap gap-1">
                        {classification.features.slice(0, 3).map((feature, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-dark-surface text-gray-400 rounded"
                          >
                            {feature.length > 20 ? feature.substring(0, 20) + '...' : feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {classification.reasoning && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Reasoning</div>
                      <div className="text-xs text-gray-400 line-clamp-2">
                        {classification.reasoning}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
