/**
 * Dimension Browser Component
 * 
 * Interactive UI for browsing and validating extracted dimensions
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
  Ruler,
  Search,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  TrendingUp,
  Link
} from 'lucide-react';

interface Dimension {
  id: string;
  value: number;
  unit: string;
  originalText: string;
  type: string;
  context?: string;
  confidence: number;
  critical: boolean;
  position?: {
    x: number;
    y: number;
  };
  chainId?: string;
  validationErrors?: string[];
}

interface DimensionChain {
  chainId: string;
  dimensions: Dimension[];
  totalLength: number;
  expectedTotal?: number;
  valid: boolean;
  errorMessage?: string;
}

interface SheetDimensions {
  id: string;
  sheetNumber: string;
  dimensions: Dimension[];
  chains: DimensionChain[];
  confidence: number;
  document: {
    id: string;
    name: string;
  };
}

interface DimensionBrowserProps {
  projectSlug: string;
}

export default function DimensionBrowser({ projectSlug }: DimensionBrowserProps) {
  const [sheetData, setSheetData] = useState<SheetDimensions[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [view, setView] = useState<'dimensions' | 'chains' | 'errors'>('dimensions');

  useEffect(() => {
    loadDimensions();
  }, [projectSlug]);

  const loadDimensions = async () => {
    try {
      setLoading(true);

      // Load dimensions
      const response = await fetch(`/api/projects/${projectSlug}/dimensions?action=list`);
      const data = await response.json();
      if (data.success) {
        setSheetData(data.sheets);
      }

      // Load stats
      const statsResponse = await fetch(`/api/projects/${projectSlug}/dimensions?action=stats`);
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Failed to load dimensions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractDimensions = async () => {
    try {
      setExtracting(true);
      const response = await fetch(`/api/projects/${projectSlug}/extract-dimensions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess: false })
      });

      const result = await response.json();
      if (result.success) {
        await loadDimensions();
      }
    } catch (error) {
      console.error('Failed to extract dimensions:', error);
    } finally {
      setExtracting(false);
    }
  };

  const convertDimension = (value: number, fromUnit: string, toUnit: string) => {
    const conversions: Record<string, Record<string, number>> = {
      'ft': { 'in': 12, 'mm': 304.8, 'm': 0.3048, 'cm': 30.48 },
      'in': { 'ft': 1/12, 'mm': 25.4, 'm': 0.0254, 'cm': 2.54 },
      'mm': { 'ft': 1/304.8, 'in': 1/25.4, 'm': 0.001, 'cm': 0.1 },
      'm': { 'ft': 1/0.3048, 'in': 1/0.0254, 'mm': 1000, 'cm': 100 },
      'cm': { 'ft': 1/30.48, 'in': 1/2.54, 'mm': 10, 'm': 0.01 }
    };

    if (fromUnit === toUnit) return value;
    return value * (conversions[fromUnit]?.[toUnit] || 1);
  };

  const formatDimension = (dim: Dimension, targetUnit?: string) => {
    const unit = targetUnit || dim.unit;
    const value = targetUnit && targetUnit !== dim.unit 
      ? convertDimension(dim.value, dim.unit, targetUnit)
      : dim.value;
    
    return `${value.toFixed(2)} ${unit}`;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'linear': 'bg-blue-500',
      'angular': 'bg-purple-500',
      'radius': 'bg-green-500',
      'diameter': 'bg-cyan-500',
      'area': 'bg-orange-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  // Filter dimensions
  const allDimensions = sheetData.flatMap(sheet => 
    sheet.dimensions.map(dim => ({ ...dim, sheetNumber: sheet.sheetNumber, documentName: sheet.document.name }))
  );

  const filteredDimensions = allDimensions.filter(dim => {
    // Unit filter
    if (selectedUnit !== 'all' && dim.unit !== selectedUnit) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        dim.originalText.toLowerCase().includes(query) ||
        dim.context?.toLowerCase().includes(query) ||
        dim.sheetNumber.toLowerCase().includes(query) ||
        dim.type.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Get all chains
  const allChains = sheetData.flatMap(sheet => 
    sheet.chains.map(chain => ({ ...chain, sheetNumber: sheet.sheetNumber }))
  );

  const invalidChains = allChains.filter(chain => !chain.valid);

  if (loading) {
    return (
      <Card className="bg-[#2d333b] border-gray-700">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-300">Loading dimensions...</span>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalDimensions === 0) {
    return (
      <Card className="bg-[#2d333b] border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Dimension Browser
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Ruler className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No dimensions extracted yet</p>
            <Button
              onClick={handleExtractDimensions}
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
                  Extract Dimensions
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
                <p className="text-sm text-gray-400">Total Dimensions</p>
                <p className="text-2xl font-bold text-gray-100">{stats.totalDimensions}</p>
              </div>
              <Ruler className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Critical</p>
                <p className="text-2xl font-bold text-gray-100">{stats.criticalCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Chains</p>
                <p className="text-2xl font-bold text-gray-100">{stats.chainCount}</p>
              </div>
              <Link className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#2d333b] border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Validation</p>
                <p className="text-2xl font-bold text-gray-100">
                  {invalidChains.length === 0 ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-red-500">{invalidChains.length}</span>
                  )}
                </p>
              </div>
              {invalidChains.length === 0 ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="bg-[#2d333b] border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-gray-100 flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Dimension Browser
            </CardTitle>
            <Button
              onClick={handleExtractDimensions}
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
                placeholder="Search dimensions..."
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
              <TabsTrigger value="dimensions" className="data-[state=active]:bg-orange-500">
                Dimensions ({filteredDimensions.length})
              </TabsTrigger>
              <TabsTrigger value="chains" className="data-[state=active]:bg-orange-500">
                Chains ({allChains.length})
              </TabsTrigger>
              <TabsTrigger value="errors" className="data-[state=active]:bg-orange-500">
                Validation Errors ({invalidChains.length})
              </TabsTrigger>
            </TabsList>

            {/* Dimensions Tab */}
            <TabsContent value="dimensions">
              <div className="mb-4">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => setSelectedUnit('all')}
                    variant={selectedUnit === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className={selectedUnit === 'all' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-[#1F2328]'}
                  >
                    All Units
                  </Button>
                  {Object.keys(stats.byUnit || {}).map(unit => (
                    <Button
                      key={unit}
                      onClick={() => setSelectedUnit(unit)}
                      variant={selectedUnit === unit ? 'default' : 'outline'}
                      size="sm"
                      className={selectedUnit === unit ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-[#1F2328]'}
                    >
                      {unit} ({stats.byUnit[unit]})
                    </Button>
                  ))}
                </div>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredDimensions.map((dim: Dimension, idx) => (
                    <div
                      key={`${dim.id}-${idx}`}
                      className="p-4 bg-[#1F2328] border border-gray-700 rounded-lg hover:bg-[#252a31] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${getTypeColor(dim.type)} text-white`}>
                              {dim.type}
                            </Badge>
                            <span className="font-mono font-bold text-lg text-gray-100">
                              {dim.originalText}
                            </span>
                            {dim.critical && (
                              <Badge className="bg-red-500 text-white">
                                Critical
                              </Badge>
                            )}
                            <Badge variant="outline" className="border-gray-600 text-gray-300">
                              {Math.round(dim.confidence * 100)}%
                            </Badge>
                          </div>
                          
                          {dim.context && (
                            <p className="text-sm text-gray-300 mb-2">{dim.context}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Sheet {dim.sheetNumber}</span>
                            <span>Value: {formatDimension(dim)}</span>
                            {dim.chainId && (
                              <span className="flex items-center gap-1">
                                <Link className="h-3 w-3" />
                                Chain {dim.chainId}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Chains Tab */}
            <TabsContent value="chains">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {allChains.map((chain: DimensionChain, idx) => (
                    <div
                      key={idx}
                      className={`p-4 border rounded-lg ${
                        chain.valid 
                          ? 'bg-[#1F2328] border-gray-700' 
                          : 'bg-red-950/30 border-red-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-500 text-white">
                            Chain {chain.chainId}
                          </Badge>
                          <span className="text-sm text-gray-400">Sheet {chain.sheetNumber}</span>
                          {chain.valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <span className="font-mono text-gray-100">
                          Total: {chain.totalLength.toFixed(2)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {chain.dimensions.map((dim: Dimension, dimIdx: number) => (
                          <div key={dimIdx} className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400">#{dimIdx + 1}</span>
                            <ArrowRight className="h-3 w-3 text-gray-500" />
                            <span className="font-mono text-gray-200">{dim.originalText}</span>
                            <span className="text-gray-500">({formatDimension(dim)})</span>
                          </div>
                        ))}
                      </div>

                      {!chain.valid && chain.errorMessage && (
                        <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded text-sm text-red-300">
                          <AlertTriangle className="h-4 w-4 inline mr-2" />
                          {chain.errorMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Errors Tab */}
            <TabsContent value="errors">
              {invalidChains.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-gray-300 text-lg">All dimension chains are valid!</p>
                  <p className="text-gray-500 text-sm mt-2">No validation errors found.</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {invalidChains.map((chain: DimensionChain, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-red-950/30 border border-red-900 rounded-lg"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          <span className="font-bold text-gray-100">Chain {chain.chainId}</span>
                          <Badge variant="outline" className="border-gray-600 text-gray-300">
                            Sheet {chain.sheetNumber}
                          </Badge>
                        </div>

                        <div className="text-red-300 mb-3">
                          {chain.errorMessage}
                        </div>

                        <div className="space-y-1">
                          {chain.dimensions.map((dim: Dimension, dimIdx: number) => (
                            <div key={dimIdx} className="text-sm text-gray-300">
                              {dim.originalText} ({formatDimension(dim)})
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
