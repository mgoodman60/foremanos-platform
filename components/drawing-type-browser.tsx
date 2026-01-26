/**
 * Drawing Type Browser Component
 * Phase A.4 - Browse and filter documents by drawing type
 */

'use client';

import { useState, useEffect } from 'react';
import { FileText, Filter, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface DrawingTypeStats {
  totalDocuments: number;
  classified: number;
  unclassified: number;
  types: Array<{ type: string; count: number }>;
  categories: Array<{ category: string; count: number }>;
}

interface DrawingTypeBrowserProps {
  projectSlug: string;
  onDocumentSelect?: (documentId: string, type: string) => void;
}

export default function DrawingTypeBrowser({
  projectSlug,
  onDocumentSelect
}: DrawingTypeBrowserProps) {
  const [statistics, setStatistics] = useState<DrawingTypeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/classify-drawings`
      );

      if (!response.ok) throw new Error('Failed to load statistics');

      const data = await response.json();
      setStatistics(data.statistics);
    } catch (error) {
      console.error('Statistics error:', error);
      toast.error('Failed to load drawing statistics');
    } finally {
      setLoading(false);
    }
  };

  const runClassification = async (forceReclassify = false) => {
    setClassifying(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/classify-drawings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forceReclassify })
        }
      );

      if (!response.ok) throw new Error('Classification failed');

      const data = await response.json();
      toast.success(`Classified ${data.classifiedDocuments} documents`);
      loadStatistics();
    } catch (error) {
      console.error('Classification error:', error);
      toast.error('Failed to classify drawings');
    } finally {
      setClassifying(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, [projectSlug]);

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      floor_plan: '🏢',
      site_plan: '🗺️',
      elevation: '📐',
      section: '✂️',
      detail: '🔍',
      schedule: '📋',
      reflected_ceiling_plan: '💡',
      mep_plan: '⚡',
      structural_plan: '🏗️',
      roof_plan: '🏠',
      foundation_plan: '🧱',
      framing_plan: '🪵',
      landscape_plan: '🌳',
      isometric: '📦',
      diagram: '📊',
      unknown: '❓'
    };
    return icons[type] || '📄';
  };

  const getTypeName = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      architectural: 'bg-blue-100 text-blue-800 border-blue-200',
      structural: 'bg-orange-100 text-orange-800 border-orange-200',
      mep: 'bg-purple-100 text-purple-800 border-purple-200',
      civil: 'bg-green-100 text-green-800 border-green-200',
      landscape: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      other: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[category] || colors.other;
  };

  const filteredTypes = statistics?.types.filter(type => {
    if (searchQuery) {
      return getTypeName(type.type)
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    }
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileText className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Drawing Classification
            </h3>
            <p className="text-sm text-gray-600">
              Automatic drawing type detection
            </p>
          </div>
        </div>
        <button
          onClick={() => runClassification(true)}
          disabled={classifying}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${classifying ? 'animate-spin' : ''}`} />
          {classifying ? 'Classifying...' : 'Classify Drawings'}
        </button>
      </div>

      {/* Statistics Overview */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">
              {statistics.totalDocuments}
            </div>
            <div className="text-sm text-gray-600">Total Documents</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {statistics.classified}
            </div>
            <div className="text-sm text-gray-600">Classified</div>
            <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-green-600 h-1.5 rounded-full"
                style={{
                  width: `${(statistics.classified / statistics.totalDocuments) * 100}%`
                }}
              />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-600">
              {statistics.types.length}
            </div>
            <div className="text-sm text-gray-600">Drawing Types</div>
          </div>
        </div>
      )}

      {/* Category Filters */}
      {statistics && statistics.categories.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900">Filter by Category</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({statistics.totalDocuments})
            </button>
            {statistics.categories.map(cat => (
              <button
                key={cat.category}
                onClick={() => setSelectedCategory(cat.category)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  selectedCategory === cat.category
                    ? getCategoryColor(cat.category)
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)} ({cat.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search drawing types..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>

      {/* Drawing Types Grid */}
      {statistics && filteredTypes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTypes.map(type => (
            <div
              key={type.type}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onDocumentSelect?.(type.type, type.type)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTypeIcon(type.type)}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {getTypeName(type.type)}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {type.count} {type.count === 1 ? 'document' : 'documents'}
                    </p>
                  </div>
                </div>
                <TrendingUp className="h-4 w-4 text-gray-400" />
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${(type.count / statistics.totalDocuments) * 100}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && (!statistics || statistics.types.length === 0) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">No classification data available</p>
          <button
            onClick={() => runClassification()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Start Classification
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
