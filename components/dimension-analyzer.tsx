/**
 * Dimension Analyzer Component
 * Phase B.6 - Displays dimension intelligence and conflict detection
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Ruler, Search, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface Dimension {
  value: number;
  unit: string;
  displayValue: string;
  type: string;
  direction?: string;
  label?: string;
  confidence: number;
  sheetNumber?: string;
}

interface DimensionConflict {
  type: string;
  description: string;
  sheets: string[];
  dimensions: Dimension[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SheetDimensions {
  sheetNumber: string;
  data: {
    dimensions: Dimension[];
    conflicts: DimensionConflict[];
    statistics: {
      totalDimensions: number;
      linearDimensions: number;
      angularDimensions: number;
      averageConfidence: number;
    };
  };
}

interface Props {
  projectSlug: string;
}

export default function DimensionAnalyzer({ projectSlug }: Props) {
  const [sheets, setSheets] = useState<SheetDimensions[]>([]);
  const [conflicts, setConflicts] = useState<DimensionConflict[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDimensions();
    fetchConflicts();
  }, [projectSlug]);

  const fetchDimensions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/extract-dimensions`);

      if (!response.ok) {
        throw new Error('Failed to fetch dimensions');
      }

      const data = await response.json();
      setSheets(data.sheets || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchConflicts = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/extract-dimensions?action=conflicts`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch conflicts');
      }

      const data = await response.json();
      setConflicts(data.conflicts || []);
    } catch (err: unknown) {
      console.error('Error fetching conflicts:', err);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      case 'medium':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  // Calculate overall statistics
  const totalDimensions = sheets.reduce(
    (sum, s) => sum + (s.data?.statistics?.totalDimensions || 0),
    0
  );

  const avgConfidence =
    sheets.length > 0
      ? sheets.reduce((sum, s) => sum + (s.data?.statistics?.averageConfidence || 0), 0) /
        sheets.length
      : 0;

  const criticalConflicts = conflicts.filter(c => c.severity === 'critical').length;
  const highConflicts = conflicts.filter(c => c.severity === 'high').length;

  // Filter dimensions
  const filteredSheets = sheets.filter(sheet => {
    if (selectedSheet !== 'all' && sheet.sheetNumber !== selectedSheet) {
      return false;
    }
    return true;
  });

  const allDimensions = filteredSheets.flatMap(sheet =>
    (sheet.data?.dimensions || []).map(dim => ({
      ...dim,
      sheetNumber: sheet.sheetNumber,
    }))
  );

  const filteredDimensions = allDimensions.filter(dim => {
    const matchesType = filterType === 'all' || dim.type === filterType;
    const matchesSearch =
      !searchQuery ||
      dim.displayValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dim.label?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Dimensions</p>
                <p className="text-2xl font-bold">{totalDimensions}</p>
              </div>
              <Ruler className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Confidence</p>
                <p className="text-2xl font-bold">{(avgConfidence * 100).toFixed(0)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={criticalConflicts > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical Issues</p>
                <p className="text-2xl font-bold text-red-600">{criticalConflicts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={highConflicts > 0 ? 'border-orange-200 bg-orange-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-orange-600">{highConflicts}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Dimension Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search dimensions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedSheet} onValueChange={setSelectedSheet}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select sheet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sheets</SelectItem>
                {sheets.map(sheet => (
                  <SelectItem key={sheet.sheetNumber} value={sheet.sheetNumber}>
                    {sheet.sheetNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="angular">Angular</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
                <SelectItem value="diameter">Diameter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conflicts Section */}
      {conflicts.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Dimension Conflicts ({conflicts.length})
            </CardTitle>
            <CardDescription>
              Inconsistencies detected across sheets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {conflicts.map((conflict, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${getSeverityColor(conflict.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(conflict.severity)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{conflict.description}</h4>
                        <Badge variant="outline" className="capitalize">
                          {conflict.severity}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">
                        Affected sheets: {conflict.sheets.join(', ')}
                      </p>
                      <div className="text-sm space-y-1">
                        {conflict.dimensions.map((dim, dimIdx) => (
                          <div key={dimIdx} className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {dim.displayValue}
                            </Badge>
                            {dim.label && (
                              <span className="text-xs text-gray-600">{dim.label}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dimensions List */}
      <Card>
        <CardHeader>
          <CardTitle>Dimensions ({filteredDimensions.length})</CardTitle>
          <CardDescription>All extracted dimensions from selected sheets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredDimensions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No dimensions found</p>
            ) : (
              filteredDimensions.map((dim: Dimension, idx) => (
                <div
                  key={idx}
                  className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{dim.sheetNumber}</Badge>
                      <span className="font-mono font-medium">{dim.displayValue}</span>
                      {dim.label && <span className="text-sm text-gray-600">{dim.label}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {dim.type}
                      </Badge>
                      {dim.direction && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {dim.direction}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {(dim.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
