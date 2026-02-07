/**
 * Symbol Library Browser Component
 * 
 * Interactive UI for browsing and searching standard symbols
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
  Zap,
  Search,
  Filter,
  Loader2,
  BookOpen,
  Tag,
  Layers
} from 'lucide-react';

interface SymbolEntry {
  code: string;
  name: string;
  category: string;
  trade: string;
  standard?: string;
  alternativeCodes?: string[];
  description?: string;
  specReference?: string;
}

interface SymbolLibraryBrowserProps {
  projectSlug?: string;
}

export default function SymbolLibraryBrowser({ projectSlug }: SymbolLibraryBrowserProps) {
  const [symbols, setSymbols] = useState<SymbolEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [view, setView] = useState<'symbols' | 'trades' | 'standards'>('symbols');

  useEffect(() => {
    loadSymbols();
  }, []);

  const loadSymbols = async () => {
    try {
      setLoading(true);

      // Load symbols
      const response = await fetch(`/api/symbol-library?action=list`);
      const data = await response.json();
      if (data.success) {
        setSymbols(data.symbols);
      }

      // Load stats
      const statsResponse = await fetch(`/api/symbol-library?action=stats`);
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }
    } catch (error) {
      console.error('Failed to load symbols:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      loadSymbols();
      return;
    }

    try {
      const response = await fetch(`/api/symbol-library?action=search&query=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.success) {
        setSymbols(data.symbols);
      }
    } catch (error) {
      console.error('Failed to search symbols:', error);
    }
  };

  const getTradeColor = (trade: string) => {
    const colors: Record<string, string> = {
      'Electrical': 'bg-yellow-500',
      'Mechanical': 'bg-blue-500',
      'Plumbing': 'bg-cyan-500',
      'Fire Protection': 'bg-red-500',
      'Architectural': 'bg-purple-500',
      'Structural': 'bg-gray-500',
      'Civil': 'bg-green-500'
    };
    return colors[trade] || 'bg-gray-500';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'lighting': 'bg-yellow-500',
      'power': 'bg-orange-500',
      'hvac': 'bg-blue-500',
      'plumbing': 'bg-cyan-500',
      'fire': 'bg-red-500',
      'wall': 'bg-purple-500',
      'door': 'bg-green-500',
      'window': 'bg-teal-500',
      'structural': 'bg-gray-500'
    };
    return colors[category] || 'bg-gray-500';
  };

  // Filter symbols
  const filteredSymbols = symbols.filter(symbol => {
    // Trade filter
    if (selectedTrade !== 'all' && symbol.trade !== selectedTrade) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && symbol.category !== selectedCategory) {
      return false;
    }

    // Search is handled by API
    return true;
  });

  // Group by trade
  const symbolsByTrade = filteredSymbols.reduce((acc, symbol) => {
    if (!acc[symbol.trade]) {
      acc[symbol.trade] = [];
    }
    acc[symbol.trade].push(symbol);
    return acc;
  }, {} as Record<string, SymbolEntry[]>);

  // Group by standard
  const symbolsByStandard = filteredSymbols.reduce((acc, symbol) => {
    const standard = symbol.standard || 'Unspecified';
    if (!acc[standard]) {
      acc[standard] = [];
    }
    acc[standard].push(symbol);
    return acc;
  }, {} as Record<string, SymbolEntry[]>);

  if (loading) {
    return (
      <Card className="bg-dark-card border-gray-700">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <span className="ml-2 text-gray-300">Loading symbol library...</span>
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
                <p className="text-sm text-gray-400">Total Symbols</p>
                <p className="text-2xl font-bold text-gray-100">{stats?.totalSymbols || 0}</p>
              </div>
              <Zap className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Trades</p>
                <p className="text-2xl font-bold text-gray-100">{stats?.tradeCount || 0}</p>
              </div>
              <Layers className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Categories</p>
                <p className="text-2xl font-bold text-gray-100">{stats?.categoryCount || 0}</p>
              </div>
              <Tag className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-dark-card border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Standards</p>
                <p className="text-2xl font-bold text-gray-100">{stats?.standardCount || 0}</p>
              </div>
              <BookOpen className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="bg-dark-card border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Symbol Library Browser
          </CardTitle>

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search symbols by code or name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                className="pl-10 bg-dark-surface border-gray-600 text-gray-100 placeholder-gray-500"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="bg-dark-surface border border-gray-700">
              <TabsTrigger value="symbols" className="data-[state=active]:bg-orange-500">
                Symbols ({filteredSymbols.length})
              </TabsTrigger>
              <TabsTrigger value="trades" className="data-[state=active]:bg-orange-500">
                By Trade ({Object.keys(symbolsByTrade).length})
              </TabsTrigger>
              <TabsTrigger value="standards" className="data-[state=active]:bg-orange-500">
                By Standard ({Object.keys(symbolsByStandard).length})
              </TabsTrigger>
            </TabsList>

            {/* Symbols Tab */}
            <TabsContent value="symbols">
              <div className="mb-4 space-y-2">
                {/* Trade filters */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">Filter by Trade:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => setSelectedTrade('all')}
                      variant={selectedTrade === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={selectedTrade === 'all' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-dark-surface'}
                    >
                      All Trades
                    </Button>
                    {Object.keys(stats?.byTrade || {}).map(trade => (
                      <Button
                        key={trade}
                        onClick={() => setSelectedTrade(trade)}
                        variant={selectedTrade === trade ? 'default' : 'outline'}
                        size="sm"
                        className={selectedTrade === trade ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-dark-surface'}
                      >
                        {trade} ({stats.byTrade[trade]})
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Category filters */}
                <div>
                  <p className="text-sm text-gray-400 mb-2">Filter by Category:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => setSelectedCategory('all')}
                      variant={selectedCategory === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={selectedCategory === 'all' ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-dark-surface'}
                    >
                      All Categories
                    </Button>
                    {Object.keys(stats?.byCategory || {}).map(category => (
                      <Button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        variant={selectedCategory === category ? 'default' : 'outline'}
                        size="sm"
                        className={selectedCategory === category ? 'bg-orange-500 hover:bg-orange-600' : 'border-gray-600 text-gray-300 hover:bg-dark-surface'}
                      >
                        {category} ({stats.byCategory[category]})
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {filteredSymbols.map((symbol, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-dark-surface border border-gray-700 rounded-lg hover:bg-dark-surface transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={`${getTradeColor(symbol.trade)} text-white`}>
                              {symbol.trade}
                            </Badge>
                            <Badge className={`${getCategoryColor(symbol.category)} text-white`}>
                              {symbol.category}
                            </Badge>
                            <span className="font-mono font-bold text-gray-100">
                              {symbol.code}
                            </span>
                            {symbol.standard && (
                              <Badge variant="outline" className="border-gray-600 text-gray-300">
                                {symbol.standard}
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-gray-100 font-medium mb-1">{symbol.name}</p>
                          
                          {symbol.description && (
                            <p className="text-sm text-gray-400 mb-2">{symbol.description}</p>
                          )}

                          {symbol.alternativeCodes && symbol.alternativeCodes.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-2">
                              <span className="text-xs text-gray-500">Also:</span>
                              {symbol.alternativeCodes.map((code, cIdx) => (
                                <Badge key={cIdx} variant="outline" className="border-gray-600 text-gray-400 text-xs">
                                  {code}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {symbol.specReference && (
                            <div className="mt-2 text-xs text-blue-400">
                              Spec: {symbol.specReference}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Trades Tab */}
            <TabsContent value="trades">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {Object.entries(symbolsByTrade).map(([trade, tradeSymbols]) => (
                    <Card key={trade} className="bg-dark-surface border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-gray-100 flex items-center gap-2">
                          <Badge className={`${getTradeColor(trade)} text-white`}>
                            {trade}
                          </Badge>
                          <span className="text-sm text-gray-400">({tradeSymbols.length} symbols)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {tradeSymbols.map((symbol, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-dark-card border border-gray-600 rounded"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm font-bold text-gray-100">
                                  {symbol.code}
                                </span>
                                <Badge className={`${getCategoryColor(symbol.category)} text-white text-xs`}>
                                  {symbol.category}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-300">{symbol.name}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Standards Tab */}
            <TabsContent value="standards">
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {Object.entries(symbolsByStandard).map(([standard, standardSymbols]) => (
                    <Card key={standard} className="bg-dark-surface border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-gray-100 flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-green-500" />
                          {standard}
                          <span className="text-sm text-gray-400">({standardSymbols.length} symbols)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {standardSymbols.map((symbol, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-dark-card border border-gray-600 rounded"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={`${getTradeColor(symbol.trade)} text-white text-xs`}>
                                  {symbol.trade}
                                </Badge>
                                <span className="font-mono text-sm font-bold text-gray-100">
                                  {symbol.code}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300">{symbol.name}</p>
                            </div>
                          ))}
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
