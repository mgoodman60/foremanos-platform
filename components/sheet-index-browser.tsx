/**
 * Sheet Index Browser Component
 * 
 * Displays a complete sheet index for the project with title block metadata
 * Organized by discipline with filtering and search capabilities
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import {
  FileText,
  Search,
  Calendar,
  Hash,
  Building2,
  Layers,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface SheetIndexEntry {
  sheetNumber: string;
  sheetTitle: string;
  discipline: string;
  revision: string;
  dateIssued: string | null;
  documentId: string;
  documentName: string;
  pageNumber?: number;
}

interface SheetIndexBrowserProps {
  projectSlug: string;
  onSheetSelect?: (sheet: SheetIndexEntry) => void;
}

interface DisciplineStats {
  discipline: string;
  count: number;
}

interface SheetIndexStats {
  totalSheets: number;
  byDiscipline: DisciplineStats[];
  latestRevision?: string;
  dateRange: {
    earliest?: string;
    latest?: string;
  };
}

export default function SheetIndexBrowser({ projectSlug, onSheetSelect }: SheetIndexBrowserProps) {
  const [sheets, setSheets] = useState<SheetIndexEntry[]>([]);
  const [_byDiscipline, setByDiscipline] = useState<Record<string, SheetIndexEntry[]>>({});
  const [stats, setStats] = useState<SheetIndexStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    loadSheetIndex();
  }, [projectSlug]);

  const loadSheetIndex = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/sheet-index`);
      const data = await response.json();

      if (data.success) {
        setSheets(data.sheets);
        setByDiscipline(data.byDiscipline);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load sheet index:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractTitleBlocks = async () => {
    try {
      setExtracting(true);
      const response = await fetch(`/api/projects/${projectSlug}/extract-title-blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess: false })
      });

      const result = await response.json();
      if (result.success) {
        // Reload sheet index
        await loadSheetIndex();
      }
    } catch (error) {
      console.error('Failed to extract title blocks:', error);
    } finally {
      setExtracting(false);
    }
  };

  const filteredSheets = sheets.filter(sheet => {
    // Filter by discipline
    if (selectedDiscipline !== 'all' && sheet.discipline !== selectedDiscipline) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        sheet.sheetNumber.toLowerCase().includes(query) ||
        sheet.sheetTitle.toLowerCase().includes(query) ||
        sheet.documentName.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getDisciplineColor = (discipline: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-blue-500',
      'S': 'bg-orange-500',
      'M': 'bg-green-500',
      'E': 'bg-yellow-500',
      'P': 'bg-cyan-500',
      'FP': 'bg-red-500',
      'C': 'bg-purple-500',
      'L': 'bg-emerald-500',
      'G': 'bg-gray-500',
      'UNKNOWN': 'bg-gray-400'
    };
    return colors[discipline] || 'bg-gray-400';
  };

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-300">Loading sheet index...</span>
        </CardContent>
      </Card>
    );
  }

  if (!sheets.length) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Sheet Index
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No sheets indexed yet</p>
            <Button
              onClick={handleExtractTitleBlocks}
              disabled={extracting}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Extract Title Blocks
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-dark-card border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Sheets</p>
                <p className="text-2xl font-bold text-gray-100">{stats.totalSheets}</p>
              </div>
              <Layers className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Disciplines</p>
                <p className="text-2xl font-bold text-gray-100">{stats.byDiscipline.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Latest Revision</p>
                <p className="text-2xl font-bold text-gray-100">{stats.latestRevision}</p>
              </div>
              <Hash className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Latest Issue</p>
                <p className="text-sm font-bold text-gray-100">
                  {stats.dateRange.latest ? new Date(stats.dateRange.latest).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Sheet Index */}
      <Card className="bg-dark-card border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-100 flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Sheet Index
            </CardTitle>
            <Button
              onClick={handleExtractTitleBlocks}
              disabled={extracting}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-dark-surface"
            >
              {extracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search sheets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-dark-surface border-gray-600 text-gray-100 placeholder-gray-500"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
            <TabsList className="bg-dark-surface border border-gray-700">
              <TabsTrigger value="all" className="data-[state=active]:bg-orange-500">
                All ({sheets.length})
              </TabsTrigger>
              {stats.byDiscipline.map((disc: DisciplineStats) => (
                <TabsTrigger
                  key={disc.discipline}
                  value={disc.discipline}
                  className="data-[state=active]:bg-orange-500"
                >
                  {disc.discipline} ({disc.count})
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="h-[500px] mt-4">
              <div className="space-y-2">
                {filteredSheets.map((sheet) => (
                  <div
                    key={`${sheet.documentId}-${sheet.sheetNumber}`}
                    className="p-4 bg-dark-surface border border-gray-700 rounded-lg hover:bg-dark-surface transition-colors cursor-pointer"
                    onClick={() => onSheetSelect?.(sheet)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${getDisciplineColor(sheet.discipline)} text-white`}>
                            {sheet.discipline}
                          </Badge>
                          <span className="font-mono font-bold text-gray-100">
                            {sheet.sheetNumber}
                          </span>
                          <Badge variant="outline" className="border-gray-600 text-gray-300">
                            Rev {sheet.revision}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-300 mb-1">{sheet.sheetTitle}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {sheet.documentName}
                          </span>
                          {sheet.dateIssued && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(sheet.dateIssued).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
