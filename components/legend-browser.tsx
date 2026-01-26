'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  Layers,
  Zap,
  Droplets,
  Flame,
  Building2,
  Grid3x3,
  Ruler,
  Package,
  Download,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface LegendEntry {
  symbol: string;
  description: string;
  category: string;
  sheetNumbers: string[];
  confidence?: number;
}

interface SheetLegend {
  id: string;
  sheetNumber: string;
  discipline: string;
  legendEntries: LegendEntry[];
  confidence: number;
  extractedAt: string;
}

interface ValidationIssue {
  symbol: string;
  sheets: string[];
  descriptions: string[];
  severity: 'high' | 'medium' | 'low';
}

interface LegendBrowserProps {
  projectSlug: string;
  onSymbolSelect?: (symbol: string, description: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Electrical: <Zap className="h-4 w-4" />,
  Mechanical: <Package className="h-4 w-4" />,
  Plumbing: <Droplets className="h-4 w-4" />,
  'Fire Protection': <Flame className="h-4 w-4" />,
  Architectural: <Building2 className="h-4 w-4" />,
  Structural: <Grid3x3 className="h-4 w-4" />,
  Civil: <Ruler className="h-4 w-4" />,
  General: <Layers className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  Electrical: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Mechanical: 'bg-blue-100 text-blue-800 border-blue-200',
  Plumbing: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Fire Protection': 'bg-red-100 text-red-800 border-red-200',
  Architectural: 'bg-purple-100 text-purple-800 border-purple-200',
  Structural: 'bg-green-100 text-green-800 border-green-200',
  Civil: 'bg-orange-100 text-orange-800 border-orange-200',
  General: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function LegendBrowser({ projectSlug, onSymbolSelect }: LegendBrowserProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [legends, setLegends] = useState<SheetLegend[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [stats, setStats] = useState({
    totalSymbols: 0,
    avgConfidence: 0,
    coveragePercent: 0,
  });

  // Load legends on mount
  React.useEffect(() => {
    loadLegends();
  }, [projectSlug]);

  const loadLegends = async () => {
    setLoading(true);
    try {
      // Load legends list
      const res = await fetch(`/api/projects/${projectSlug}/legends?action=list`);
      if (res.ok) {
        const data = await res.json();
        setLegends(data.legends || []);
      }

      // Load stats
      const statsRes = await fetch(`/api/projects/${projectSlug}/legends?action=stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Load validation issues
      const validationRes = await fetch(`/api/projects/${projectSlug}/legends?action=validate`);
      if (validationRes.ok) {
        const validationData = await validationRes.json();
        setValidationIssues(validationData.issues || []);
      }
    } catch (error) {
      console.error('Failed to load legends:', error);
      toast.error('Failed to load legend data');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractLegends = async () => {
    setExtracting(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/extract-legends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess: true }),
      });

      if (!res.ok) throw new Error('Extraction failed');

      const data = await res.json();
      toast.success(
        `Extracted ${data.extracted} legends from ${data.processed} sheets`
      );
      loadLegends();
    } catch (error) {
      console.error('Failed to extract legends:', error);
      toast.error('Failed to extract legends');
    } finally {
      setExtracting(false);
    }
  };

  const handleExportLibrary = async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/legends?action=library`);
      if (!res.ok) throw new Error('Export failed');

      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectSlug}-legend-library.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Legend library exported');
    } catch (error) {
      console.error('Failed to export library:', error);
      toast.error('Failed to export library');
    }
  };

  // Build unified legend library from all sheets
  const legendLibrary = useMemo(() => {
    const library = new Map<string, LegendEntry>();

    legends.forEach((sheet) => {
      sheet.legendEntries.forEach((entry) => {
        const key = `${entry.symbol}:${entry.category}`;
        const existing = library.get(key);

        if (existing) {
          // Merge sheet numbers
          const sheetSet = new Set([...existing.sheetNumbers, ...entry.sheetNumbers]);
          existing.sheetNumbers = Array.from(sheetSet).sort();
          // Keep highest confidence
          if ((entry.confidence || 0) > (existing.confidence || 0)) {
            existing.confidence = entry.confidence;
          }
        } else {
          library.set(key, { ...entry });
        }
      });
    });

    return Array.from(library.values());
  }, [legends]);

  // Filter by category and search
  const filteredLegends = useMemo(() => {
    let filtered = legendLibrary;

    // Filter by category
    if (activeTab !== 'all') {
      filtered = filtered.filter((entry) => entry.category === activeTab);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (entry) =>
          entry.symbol.toLowerCase().includes(query) ||
          entry.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [legendLibrary, activeTab, searchQuery]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(legendLibrary.map((e) => e.category));
    return Array.from(cats).sort();
  }, [legendLibrary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading legends...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Legend & Symbol Library</h2>
          <p className="text-gray-600 mt-1">
            Extracted symbols and legends from construction documents
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLibrary}
            disabled={legendLibrary.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Library
          </Button>
          <Button
            size="sm"
            onClick={handleExtractLegends}
            disabled={extracting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {extracting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {extracting ? 'Extracting...' : 'Extract Legends'}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Symbols</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalSymbols}</p>
            </div>
            <Layers className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Confidence</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(stats.avgConfidence)}%
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sheet Coverage</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(stats.coveragePercent)}%
              </p>
            </div>
            <FileText className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Validation Issues</p>
              <p className="text-2xl font-bold text-gray-900">{validationIssues.length}</p>
            </div>
            <AlertTriangle
              className={`h-8 w-8 ${
                validationIssues.length > 0 ? 'text-orange-600' : 'text-gray-400'
              }`}
            />
          </div>
        </Card>
      </div>

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-2">
                Symbol Validation Issues
              </h3>
              <div className="space-y-2">
                {validationIssues.slice(0, 3).map((issue, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="text-orange-800">
                      <span className="font-mono bg-white px-2 py-0.5 rounded">
                        {issue.symbol}
                      </span>{' '}
                      appears with different descriptions across {issue.sheets.length} sheets
                    </p>
                    <p className="text-orange-700 text-xs mt-1">
                      Sheets: {issue.sheets.join(', ')}
                    </p>
                  </div>
                ))}
                {validationIssues.length > 3 && (
                  <p className="text-xs text-orange-700">
                    ...and {validationIssues.length - 3} more issues
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search symbols or descriptions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={activeTab === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('all')}
          className={activeTab === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          All ({legendLibrary.length})
        </Button>
        {categories.map((category) => {
          const count = legendLibrary.filter((e) => e.category === category).length;
          return (
            <Button
              key={category}
              variant={activeTab === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(category)}
              className={`flex items-center gap-2 ${
                activeTab === category ? 'bg-blue-600 hover:bg-blue-700' : ''
              }`}
            >
              {CATEGORY_ICONS[category]}
              {category} ({count})
            </Button>
          );
        })}
      </div>

      {/* Legend Cards Grid */}
      {filteredLegends.length === 0 ? (
        <Card className="p-8 text-center">
          <Layers className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            {searchQuery
              ? 'No symbols match your search'
              : legendLibrary.length === 0
              ? 'No legends extracted yet'
              : 'No symbols in this category'}
          </p>
          {legendLibrary.length === 0 && (
            <Button
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleExtractLegends}
            >
              Extract Legends Now
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLegends.map((entry, idx) => {
            const colorClass = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.General;

            return (
              <Card
                key={idx}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onSymbolSelect?.(entry.symbol, entry.description)}
              >
                {/* Category Badge */}
                <div className="flex items-center justify-between mb-3">
                  <Badge className={`${colorClass} border text-xs`}>
                    <span className="mr-1">{CATEGORY_ICONS[entry.category]}</span>
                    {entry.category}
                  </Badge>
                  {entry.confidence && (
                    <span className="text-xs text-gray-500">
                      {Math.round(entry.confidence)}% confidence
                    </span>
                  )}
                </div>

                {/* Symbol */}
                <div className="mb-3">
                  <div className="font-mono text-lg font-bold text-gray-900 bg-gray-50 p-3 rounded border border-gray-200 text-center">
                    {entry.symbol}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                  {entry.description}
                </p>

                {/* Sheet References */}
                <div className="flex flex-wrap gap-1">
                  {entry.sheetNumbers.slice(0, 5).map((sheet) => (
                    <span
                      key={sheet}
                      className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded"
                    >
                      {sheet}
                    </span>
                  ))}
                  {entry.sheetNumbers.length > 5 && (
                    <span className="text-xs text-gray-500 px-2 py-0.5">
                      +{entry.sheetNumbers.length - 5} more
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
