/**
 * Annotation Browser Component
 * 
 * Interactive UI for browsing and filtering classified annotations
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
  AlertTriangle,
  Info,
  Star,
  Loader2,
  RefreshCw,
  Tag,
  List
} from 'lucide-react';

interface Annotation {
  id: string;
  type: string;
  text: string;
  priority: 'critical' | 'important' | 'informational';
  keywords: string[];
  requirements: string[];
  position: {
    x: number;
    y: number;
  };
  confidence: number;
  context?: string;
  leaderLines?: boolean;
}

interface SheetAnnotations {
  id: string;
  sheetNumber: string;
  annotations: Annotation[];
  confidence: number;
  document: {
    id: string;
    name: string;
  };
}

interface AnnotationBrowserProps {
  projectSlug: string;
}

export default function AnnotationBrowser({ projectSlug }: AnnotationBrowserProps) {
  const [sheetData, setSheetData] = useState<SheetAnnotations[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [view, setView] = useState<'annotations' | 'requirements' | 'keywords'>('annotations');

  useEffect(() => {
    loadAnnotations();
  }, [projectSlug]);

  const loadAnnotations = async () => {
    try {
      setLoading(true);

      // Load annotations from enhanced-annotations endpoint
      const response = await fetch(`/api/projects/${projectSlug}/enhanced-annotations?action=list`);
      const data = await response.json();
      if (data.success) {
        setSheetData(data.sheets);
      }

      // Load stats
      const statsResponse = await fetch(`/api/projects/${projectSlug}/enhanced-annotations?action=stats`);
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Failed to load annotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractAnnotations = async () => {
    try {
      setExtracting(true);
      const response = await fetch(`/api/projects/${projectSlug}/extract-annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess: false })
      });

      const result = await response.json();
      if (result.success) {
        await loadAnnotations();
      }
    } catch (error) {
      console.error('Failed to extract annotations:', error);
    } finally {
      setExtracting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'critical': 'bg-red-500',
      'important': 'bg-orange-500',
      'informational': 'bg-blue-500'
    };
    return colors[priority] || 'bg-gray-500';
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'important':
        return <Star className="h-4 w-4" />;
      case 'informational':
        return <Info className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'specification': 'bg-purple-500',
      'warning': 'bg-red-500',
      'material': 'bg-green-500',
      'instruction': 'bg-blue-500',
      'note': 'bg-gray-500',
      'label': 'bg-cyan-500',
      'leader': 'bg-pink-500',
      'dimension_note': 'bg-indigo-500',
      'code_reference': 'bg-yellow-500',
      'revision': 'bg-orange-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      'specification': 'Specification',
      'warning': 'Warning',
      'material': 'Material',
      'instruction': 'Instruction',
      'note': 'Note',
      'label': 'Label',
      'leader': 'Leader Line',
      'dimension_note': 'Dimension Note',
      'code_reference': 'Code Reference',
      'revision': 'Revision'
    };
    return names[type] || type;
  };

  // Filter annotations
  const allAnnotations = sheetData.flatMap(sheet => 
    sheet.annotations.map(ann => ({ ...ann, sheetNumber: sheet.sheetNumber, documentName: sheet.document.name }))
  );

  const filteredAnnotations = allAnnotations.filter(ann => {
    // Type filter
    if (selectedType !== 'all' && ann.type !== selectedType) {
      return false;
    }

    // Priority filter
    if (selectedPriority !== 'all' && ann.priority !== selectedPriority) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        ann.text.toLowerCase().includes(query) ||
        ann.keywords.some(k => k.toLowerCase().includes(query)) ||
        ann.context?.toLowerCase().includes(query) ||
        ann.sheetNumber.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Get all requirements
  const allRequirements = allAnnotations
    .flatMap(ann => ann.requirements.map(req => ({ 
      requirement: req, 
      sheetNumber: ann.sheetNumber, 
      type: ann.type,
      priority: ann.priority 
    })))
    .filter(item => item.requirement);

  // Get all unique keywords
  const keywordCounts = allAnnotations
    .flatMap(ann => ann.keywords)
    .reduce((acc, keyword) => {
      acc[keyword] = (acc[keyword] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const sortedKeywords = Object.entries(keywordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 50);

  if (loading) {
    return (
      <Card className="bg-[#2d333b] border-gray-700">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-300">Loading annotations...</span>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalAnnotations === 0) {
    return (
      <Card className="bg-[#2d333b] border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Annotation Browser
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No annotations extracted yet</p>
            <Button
              onClick={handleExtractAnnotations}
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
                  Extract Annotations
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
                <p className="text-sm text-gray-400">Total Annotations</p>
                <p className="text-2xl font-bold text-gray-100">{stats.totalAnnotations}</p>
              </div>
              <FileText className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Critical</p>
                <p className="text-2xl font-bold text-gray-100">{stats.byPriority?.critical || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Requirements</p>
                <p className="text-2xl font-bold text-gray-100">{allRequirements.length}</p>
              </div>
              <List className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Keywords</p>
                <p className="text-2xl font-bold text-gray-100">{Object.keys(keywordCounts).length}</p>
              </div>
              <Tag className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="bg-[#2d333b] border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-100 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Annotation Browser
            </CardTitle>
            <Button
              onClick={handleExtractAnnotations}
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

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search annotations..."
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
              <TabsTrigger value="annotations" className="data-[state=active]:bg-orange-500">
                Annotations ({filteredAnnotations.length})
              </TabsTrigger>
              <TabsTrigger value="requirements" className="data-[state=active]:bg-orange-500">
                Requirements ({allRequirements.length})
              </TabsTrigger>
              <TabsTrigger value="keywords" className="data-[state=active]:bg-orange-500">
                Keywords ({sortedKeywords.length})
              </TabsTrigger>
            </TabsList>

            {/* Annotations Tab */}
            <TabsContent value="annotations">
              <div className="mb-4 space-y-2">
                {/* Type filters */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">Filter by Type:</p>
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

                {/* Priority filters */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">Filter by Priority:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => setSelectedPriority('all')}
                      variant={selectedPriority === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={selectedPriority === 'all' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-[#1F2328]'}
                    >
                      All Priorities
                    </Button>
                    {Object.keys(stats.byPriority || {}).map(priority => (
                      <Button
                        key={priority}
                        onClick={() => setSelectedPriority(priority)}
                        variant={selectedPriority === priority ? 'default' : 'outline'}
                        size="sm"
                        className={selectedPriority === priority ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-[#1F2328]'}
                      >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)} ({stats.byPriority[priority]})
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredAnnotations.map((ann: Annotation, idx) => (
                    <div
                      key={`${ann.id}-${idx}`}
                      className="p-4 bg-[#1F2328] border border-gray-700 rounded-lg hover:bg-[#252a31] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`${getPriorityColor(ann.priority)} p-2 rounded`}>
                          {getPriorityIcon(ann.priority)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={`${getTypeColor(ann.type)} text-white`}>
                              {getTypeName(ann.type)}
                            </Badge>
                            <Badge className={`${getPriorityColor(ann.priority)} text-white`}>
                              {ann.priority}
                            </Badge>
                            <Badge variant="outline" className="border-gray-600 text-gray-300">
                              Sheet {ann.sheetNumber}
                            </Badge>
                            <Badge variant="outline" className="border-gray-600 text-gray-300">
                              {Math.round(ann.confidence * 100)}%
                            </Badge>
                            {ann.leaderLines && (
                              <Badge variant="outline" className="border-gray-600 text-gray-300">
                                Leader
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-gray-100 mb-2">{ann.text}</p>

                          {ann.keywords.length > 0 && (
                            <div className="flex gap-1 flex-wrap mb-2">
                              {ann.keywords.map((keyword: string, kIdx: number) => (
                                <Badge key={kIdx} variant="outline" className="border-gray-600 text-gray-400 text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {ann.requirements.length > 0 && (
                            <div className="mt-2 p-2 bg-blue-950/30 border border-blue-900 rounded">
                              <p className="text-xs text-blue-300 mb-1 font-semibold">Requirements:</p>
                              <ul className="text-xs text-blue-200 space-y-1">
                                {ann.requirements.map((req: string, rIdx: number) => (
                                  <li key={rIdx}>• {req}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Requirements Tab */}
            <TabsContent value="requirements">
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {allRequirements.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-[#1F2328] border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${getPriorityColor(item.priority)} text-white`}>
                          {item.priority}
                        </Badge>
                        <Badge className={`${getTypeColor(item.type)} text-white`}>
                          {getTypeName(item.type)}
                        </Badge>
                        <Badge variant="outline" className="border-gray-600 text-gray-300">
                          Sheet {item.sheetNumber}
                        </Badge>
                      </div>
                      <p className="text-gray-100">{item.requirement}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Keywords Tab */}
            <TabsContent value="keywords">
              <ScrollArea className="h-[500px]">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sortedKeywords.map(([keyword, count], idx) => (
                    <Card key={idx} className="bg-[#1F2328] border-gray-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-100 font-medium truncate">{keyword}</span>
                          <Badge className="bg-orange-500 text-white ml-2">
                            {count}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
