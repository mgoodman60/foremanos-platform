/**
 * Detail Navigator Component (Phase B.1 UI)
 * 
 * Interactive UI for navigating detail callouts and cross-references across sheets
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import {
  FileText,
  Search,
  Navigation,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  ExternalLink,
  MapPin,
  Layers
} from 'lucide-react';

interface DetailCallout {
  id: string;
  type: 'detail' | 'section' | 'elevation' | 'reference' | 'enlarged_plan' | 'isometric';
  detailNumber: string;
  sheetReference?: string;
  description?: string;
  position: {
    x: number;
    y: number;
  };
  targetDocumentId?: string;
  targetChunkId?: string;
  confidence: number;
  scale?: string;
  notes?: string[];
}

interface SheetCallouts {
  id: string;
  sheetNumber: string;
  callouts: DetailCallout[];
  confidence: number;
  document: {
    id: string;
    name: string;
  };
}

interface CrossReference {
  sourceSheetNumber: string;
  targetSheetNumber: string;
  references: DetailCallout[];
  bidirectional: boolean;
}

interface DetailNavigatorProps {
  projectSlug: string;
}

export default function DetailNavigator({ projectSlug }: DetailNavigatorProps) {
  const [callouts, setCallouts] = useState<SheetCallouts[]>([]);
  const [crossRefs, setCrossRefs] = useState<CrossReference[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [view, setView] = useState<'callouts' | 'cross-refs' | 'stats'>('callouts');

  useEffect(() => {
    loadCallouts();
  }, [projectSlug]);

  const loadCallouts = async () => {
    try {
      setLoading(true);

      // Load callouts
      const calloutsResponse = await fetch(`/api/projects/${projectSlug}/callouts?action=list`);
      const calloutsData = await calloutsResponse.json();
      if (calloutsData.success) {
        setCallouts(calloutsData.callouts);
      }

      // Load cross-references
      const crossRefsResponse = await fetch(`/api/projects/${projectSlug}/callouts?action=cross-reference`);
      const crossRefsData = await crossRefsResponse.json();
      if (crossRefsData.success) {
        setCrossRefs(crossRefsData.crossReferences);
      }

      // Load stats
      const statsResponse = await fetch(`/api/projects/${projectSlug}/callouts?action=stats`);
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Failed to load callouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractCallouts = async () => {
    try {
      setExtracting(true);
      const response = await fetch(`/api/projects/${projectSlug}/extract-callouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess: false })
      });

      const result = await response.json();
      if (result.success) {
        await loadCallouts();
      }
    } catch (error) {
      console.error('Failed to extract callouts:', error);
    } finally {
      setExtracting(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'detail': 'bg-blue-500',
      'section': 'bg-purple-500',
      'elevation': 'bg-green-500',
      'reference': 'bg-orange-500',
      'enlarged_plan': 'bg-cyan-500',
      'isometric': 'bg-pink-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      'detail': 'Detail',
      'section': 'Section Cut',
      'elevation': 'Elevation',
      'reference': 'Reference',
      'enlarged_plan': 'Enlarged Plan',
      'isometric': 'Isometric'
    };
    return names[type] || type;
  };

  // Filter callouts
  const filteredCallouts = callouts.flatMap(sheet => {
    const sheetCallouts = sheet.callouts as DetailCallout[];
    return sheetCallouts
      .filter(callout => {
        // Type filter
        if (selectedType !== 'all' && callout.type !== selectedType) {
          return false;
        }

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            callout.detailNumber.toLowerCase().includes(query) ||
            callout.description?.toLowerCase().includes(query) ||
            callout.sheetReference?.toLowerCase().includes(query) ||
            sheet.sheetNumber.toLowerCase().includes(query)
          );
        }

        return true;
      })
      .map(callout => ({ ...callout, sheetNumber: sheet.sheetNumber, documentName: sheet.document.name }));
  });

  if (loading) {
    return (
      <Card className="bg-[#2d333b] border-gray-700">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-300">Loading callouts...</span>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalCallouts === 0) {
    return (
      <Card className="bg-[#2d333b] border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Detail Callout Navigator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Navigation className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No callouts extracted yet</p>
            <Button
              onClick={handleExtractCallouts}
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
                  Extract Callouts
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
        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Callouts</p>
                <p className="text-2xl font-bold text-gray-100">{stats.totalCallouts}</p>
              </div>
              <Navigation className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Sheets w/ Callouts</p>
                <p className="text-2xl font-bold text-gray-100">{stats.sheetsWithCallouts}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Linked</p>
                <p className="text-2xl font-bold text-gray-100">{stats.linkedCount}</p>
              </div>
              <ExternalLink className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Linkage Rate</p>
                <p className="text-2xl font-bold text-gray-100">
                  {Math.round(stats.linkageRate)}%
                </p>
              </div>
              <Layers className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="bg-[#2d333b] border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-100 flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              Detail Callout Navigator
            </CardTitle>
            <Button
              onClick={handleExtractCallouts}
              disabled={extracting}
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 hover:bg-[#1F2328]"
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search callouts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#1F2328] border-gray-600 text-gray-100 placeholder-gray-500"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="bg-[#1F2328] border border-gray-700">
              <TabsTrigger value="callouts" className="data-[state=active]:bg-orange-500">
                Callouts ({filteredCallouts.length})
              </TabsTrigger>
              <TabsTrigger value="cross-refs" className="data-[state=active]:bg-orange-500">
                Cross-References ({crossRefs.length})
              </TabsTrigger>
              <TabsTrigger value="stats" className="data-[state=active]:bg-orange-500">
                By Type
              </TabsTrigger>
            </TabsList>

            {/* Callouts Tab */}
            <TabsContent value="callouts">
              <div className="mb-4">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => setSelectedType('all')}
                    variant={selectedType === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className={selectedType === 'all' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-[#1F2328]'}
                  >
                    All Types
                  </Button>
                  {Object.keys(stats.byType || {}).map(type => (
                    <Button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      variant={selectedType === type ? 'default' : 'outline'}
                      size="sm"
                      className={selectedType === type ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-[#1F2328]'}
                    >
                      {getTypeName(type)} ({stats.byType[type]})
                    </Button>
                  ))}
                </div>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredCallouts.map((callout: any, idx) => (
                    <div
                      key={`${callout.id}-${idx}`}
                      className="p-4 bg-[#1F2328] border border-gray-700 rounded-lg hover:bg-[#252a31] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${getTypeColor(callout.type)} text-white`}>
                              {getTypeName(callout.type)}
                            </Badge>
                            <span className="font-mono font-bold text-gray-100">
                              {callout.detailNumber}
                            </span>
                            {callout.sheetReference && (
                              <Badge variant="outline" className="border-gray-600 text-gray-300">
                                → {callout.sheetReference}
                              </Badge>
                            )}
                            <Badge variant="outline" className="border-gray-600 text-gray-300">
                              {Math.round(callout.confidence * 100)}%
                            </Badge>
                          </div>
                          
                          {callout.description && (
                            <p className="text-sm text-gray-300 mb-2">{callout.description}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Sheet {callout.sheetNumber}
                            </span>
                            {callout.scale && (
                              <span>Scale: {callout.scale}</span>
                            )}
                            {callout.notes && callout.notes.length > 0 && (
                              <span>{callout.notes.join(', ')}</span>
                            )}
                          </div>
                        </div>

                        {callout.targetDocumentId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-600 text-gray-300 hover:bg-[#1F2328]"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Cross-References Tab */}
            <TabsContent value="cross-refs">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {crossRefs.map((crossRef, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-[#1F2328] border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Badge className="bg-blue-500 text-white">
                          {crossRef.sourceSheetNumber}
                        </Badge>
                        {crossRef.bidirectional ? (
                          <ArrowRight className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-gray-500" />
                        )}
                        <Badge className="bg-purple-500 text-white">
                          {crossRef.targetSheetNumber}
                        </Badge>
                        {crossRef.bidirectional && (
                          <Badge className="bg-green-500 text-white text-xs">
                            Bidirectional
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-gray-300">
                        {crossRef.references.length} reference{crossRef.references.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Stats Tab */}
            <TabsContent value="stats">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(stats.byType || {}).map(([type, count]) => (
                  <Card key={type} className="bg-[#1F2328] border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge className={`${getTypeColor(type)} text-white mb-2`}>
                            {getTypeName(type)}
                          </Badge>
                          <p className="text-2xl font-bold text-gray-100">{count as number}</p>
                        </div>
                        <Navigation className="h-8 w-8 text-gray-500" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
