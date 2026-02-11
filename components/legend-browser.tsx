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
import { logger } from '@/lib/logger';

interface LegendEntry {
  symbolCode: string;
  symbolDescription: string;
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
  symbolCode: string;
  sheets: string[];
  descriptions: string[];
}

interface LegendBrowserProps {
  projectSlug: string;
  onSymbolSelect?: (symbol: string, description: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Electrical: <Zap aria-hidden="true" className="h-4 w-4" />,
  Mechanical: <Package aria-hidden="true" className="h-4 w-4" />,
  Plumbing: <Droplets aria-hidden="true" className="h-4 w-4" />,
  'Fire Protection': <Flame aria-hidden="true" className="h-4 w-4" />,
  Architectural: <Building2 aria-hidden="true" className="h-4 w-4" />,
  Structural: <Grid3x3 aria-hidden="true" className="h-4 w-4" />,
  Civil: <Ruler aria-hidden="true" className="h-4 w-4" />,
  General: <Layers aria-hidden="true" className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  Electrical: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
  Mechanical: 'bg-blue-900/30 text-blue-400 border-blue-700',
  Plumbing: 'bg-cyan-900/30 text-cyan-400 border-cyan-700',
  'Fire Protection': 'bg-red-900/30 text-red-400 border-red-700',
  Architectural: 'bg-purple-900/30 text-purple-400 border-purple-700',
  Structural: 'bg-gray-700/50 text-gray-300 border-gray-600',
  Civil: 'bg-green-900/30 text-green-400 border-green-700',
  General: 'bg-slate-700/50 text-slate-300 border-slate-600',
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
    totalLegends: 0,
    avgConfidence: 0,
    avgSymbolsPerSheet: 0,
    coveragePercent: 0,
    byDiscipline: {} as Record<string, number>,
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
        setStats(statsData.stats || statsData);
      }

      // Load validation issues
      const validationRes = await fetch(`/api/projects/${projectSlug}/legends?action=validate`);
      if (validationRes.ok) {
        const validationData = await validationRes.json();
        const validation = validationData.validation || {};
        setValidationIssues(validation.inconsistencies || []);
      }
    } catch (error) {
      logger.error('LEGEND_BROWSER', 'Failed to load legends', error instanceof Error ? error : undefined);
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
      const total = data.successCount + data.errorCount + data.skippedCount;
      toast.success(
        `Extracted ${data.successCount} legends from ${total} sheets` +
        (data.errorCount > 0 ? ` (${data.errorCount} failed)` : '') +
        (data.skippedCount > 0 ? ` (${data.skippedCount} skipped)` : '')
      );
      loadLegends();
    } catch (error) {
      logger.error('LEGEND_BROWSER', 'Failed to extract legends', error instanceof Error ? error : undefined);
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
      logger.error('LEGEND_BROWSER', 'Failed to export library', error instanceof Error ? error : undefined);
      toast.error('Failed to export library');
    }
  };

  // Build unified legend library from all sheets
  const legendLibrary = useMemo(() => {
    const library = new Map<string, LegendEntry>();

    legends.forEach((sheet) => {
      sheet.legendEntries.forEach((entry) => {
        const key = `${entry.symbolCode}:${entry.category}`;
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
          entry.symbolCode.toLowerCase().includes(query) ||
          entry.symbolDescription.toLowerCase().includes(query)
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
        <RefreshCw aria-hidden="true" className="h-6 w-6 animate-spin text-orange-500" />
        <span className="ml-2 text-gray-400">Loading legends...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Legend & Symbol Library</h2>
          <p className="text-gray-400 mt-1">
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
            <Download aria-hidden="true" className="h-4 w-4 mr-2" />
            Export Library
          </Button>
          <Button
            size="sm"
            onClick={handleExtractLegends}
            disabled={extracting}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {extracting ? (
              <RefreshCw aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw aria-hidden="true" className="h-4 w-4 mr-2" />
            )}
            {extracting ? 'Extracting...' : 'Extract Legends'}
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-dark-card border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Symbols</p>
              <p className="text-2xl font-bold text-gray-100">{stats.totalSymbols}</p>
            </div>
            <Layers aria-hidden="true" className="h-8 w-8 text-orange-500" />
          </div>
        </Card>

        <Card className="p-4 bg-dark-card border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Avg Confidence</p>
              <p className="text-2xl font-bold text-gray-100">
                {Math.round(stats.avgConfidence > 1 ? stats.avgConfidence : stats.avgConfidence * 100)}%
              </p>
            </div>
            <CheckCircle aria-hidden="true" className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4 bg-dark-card border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Sheet Coverage</p>
              <p className="text-2xl font-bold text-gray-100">
                {Math.round(stats.coveragePercent)}%
              </p>
            </div>
            <FileText aria-hidden="true" className="h-8 w-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-4 bg-dark-card border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Validation Issues</p>
              <p className="text-2xl font-bold text-gray-100">{validationIssues.length}</p>
            </div>
            <AlertTriangle
              aria-hidden="true"
              className={`h-8 w-8 ${
                validationIssues.length > 0 ? 'text-orange-500' : 'text-gray-400'
              }`}
            />
          </div>
        </Card>
      </div>

      {/* Validation Issues */}
      {validationIssues.length > 0 && (
        <Card className="p-4 bg-orange-900/20 border-orange-700">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-300 mb-2">
                Symbol Validation Issues
              </h3>
              <div className="space-y-2">
                {validationIssues.slice(0, 3).map((issue, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="text-orange-400">
                      <span className="font-mono bg-dark-surface px-2 py-0.5 rounded">
                        {issue.symbolCode}
                      </span>{' '}
                      appears with different descriptions across {issue.sheets.length} sheets
                    </p>
                    <p className="text-orange-500 text-xs mt-1">
                      Sheets: {issue.sheets.join(', ')}
                    </p>
                  </div>
                ))}
                {validationIssues.length > 3 && (
                  <p className="text-xs text-orange-500">
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
        <Search aria-hidden="true" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search symbols or descriptions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-dark-surface border-gray-600 text-gray-100 placeholder-gray-500"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={activeTab === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('all')}
          className={activeTab === 'all' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-dark-surface'}
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
                activeTab === category ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-dark-surface'
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
        <Card className="p-8 text-center bg-dark-card border-gray-700">
          <Layers aria-hidden="true" className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-400">
            {searchQuery
              ? 'No symbols match your search'
              : legendLibrary.length === 0
              ? 'No legends extracted yet'
              : 'No symbols in this category'}
          </p>
          {legendLibrary.length === 0 && (
            <Button
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
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
                className="p-4 hover:shadow-md transition-shadow cursor-pointer bg-dark-card border-gray-700"
                onClick={() => onSymbolSelect?.(entry.symbolCode, entry.symbolDescription)}
              >
                {/* Category Badge */}
                <div className="flex items-center justify-between mb-3">
                  <Badge className={`${colorClass} border text-xs`}>
                    <span className="mr-1">{CATEGORY_ICONS[entry.category]}</span>
                    {entry.category}
                  </Badge>
                  {entry.confidence && (
                    <span className="text-xs text-gray-400">
                      {Math.round(entry.confidence)}% confidence
                    </span>
                  )}
                </div>

                {/* Symbol */}
                <div className="mb-3">
                  <div className="font-mono text-lg font-bold text-gray-100 bg-dark-surface p-3 rounded border border-gray-700 text-center">
                    {entry.symbolCode}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                  {entry.symbolDescription}
                </p>

                {/* Sheet References */}
                <div className="flex flex-wrap gap-1">
                  {entry.sheetNumbers.slice(0, 5).map((sheet) => (
                    <span
                      key={sheet}
                      className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded"
                    >
                      {sheet}
                    </span>
                  ))}
                  {entry.sheetNumbers.length > 5 && (
                    <span className="text-xs text-gray-400 px-2 py-0.5">
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
