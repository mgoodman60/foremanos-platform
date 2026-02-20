/**
 * Scale Validator Component
 * Phase A.3: Displays and validates drawing scales across a project
 */

'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Ruler,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Download,
  RefreshCw,
  Calculator,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ScaleValidatorProps {
  projectSlug: string;
}

interface ScaleData {
  sheetNumber: string;
  primaryScale: {
    scaleString: string;
    scaleRatio: number;
    format: string;
    confidence: number;
  };
  secondaryScales?: any[];
  hasMultipleScales: boolean;
  scaleCount: number;
  extractedFrom: string;
  confidence: number;
}

interface ValidationIssue {
  sheetNumber: string;
  issueType: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}

interface Statistics {
  totalSheets: number;
  coverage: number;
  avgConfidence: number;
  scaleDistribution: Record<string, number>;
  formatDistribution: Record<string, number>;
}

export default function ScaleValidator({ projectSlug }: ScaleValidatorProps) {
  const [scales, setScales] = useState<Array<{ sheetNumber: string; documentName: string; scaleData: ScaleData }>>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [_selectedSheet, setSelectedSheet] = useState<string | null>(null);
  
  // Converter state
  const [measurement, setMeasurement] = useState('1');
  const [scaleRatio, setScaleRatio] = useState('48');
  const [convertedValue, setConvertedValue] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [projectSlug]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load scales, validation, and stats in parallel
      const [scalesRes, validationRes, statsRes] = await Promise.all([
        fetch(`/api/projects/${projectSlug}/scales?action=list`),
        fetch(`/api/projects/${projectSlug}/scales?action=validate`),
        fetch(`/api/projects/${projectSlug}/scales?action=stats`),
      ]);

      if (scalesRes.ok) {
        const data = await scalesRes.json();
        setScales(data.scales || []);
      }

      if (validationRes.ok) {
        const data = await validationRes.json();
        setValidation(data);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Failed to load scale data:', error);
      toast.error('Failed to load scale data');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractScales = async () => {
    try {
      setExtracting(true);
      toast.info('Extracting scales from documents...');

      const response = await fetch(`/api/projects/${projectSlug}/extract-scales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess: false }),
      });

      if (!response.ok) throw new Error('Extraction failed');

      const result = await response.json();
      toast.success(`Extracted scales from ${result.extracted} sheets (${result.totalScales} scales)`);
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Scale extraction error:', error);
      toast.error('Failed to extract scales');
    } finally {
      setExtracting(false);
    }
  };

  const handleConvert = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/scales?action=convert&measurement=${measurement}&scaleRatio=${scaleRatio}`
      );
      
      if (!response.ok) throw new Error('Conversion failed');
      
      const result = await response.json();
      setConvertedValue(result.output.value);
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert measurement');
    }
  };

  const exportScales = () => {
    const data = scales.map(s => ({
      sheet: s.sheetNumber,
      document: s.documentName,
      scale: s.scaleData.primaryScale.scaleString,
      ratio: s.scaleData.primaryScale.scaleRatio,
      format: s.scaleData.primaryScale.format,
      confidence: Math.round(s.scaleData.confidence * 100) + '%',
      multipleScales: s.scaleData.hasMultipleScales ? 'Yes' : 'No',
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectSlug}-scales.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredScales = scales.filter(s => 
    s.sheetNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.scaleData.primaryScale.scaleString.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getFormatColor = (format: string) => {
    switch (format) {
      case 'architectural': return 'bg-blue-100 text-blue-800';
      case 'engineering': return 'bg-green-100 text-green-800';
      case 'metric': return 'bg-purple-100 text-purple-800';
      case 'custom': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-orange-500 h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sheets</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statistics?.totalSheets || 0}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scale Coverage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statistics ? Math.round(statistics.coverage) : 0}%
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold text-gray-900">
                  {statistics ? Math.round(statistics.avgConfidence) : 0}%
                </p>
              </div>
              <Ruler className="h-8 w-8 text-purple-600" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Issues Found</p>
                <p className="text-2xl font-bold text-gray-900">
                  {validation?.issues?.length || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Issues */}
      {validation?.issues && validation.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" aria-hidden="true" />
              <span>Scale Validation Issues</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {validation.issues.slice(0, 5).map((issue: ValidationIssue, index: number) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">Sheet {issue.sheetNumber}</p>
                      <p className="text-sm mt-1">{issue.description}</p>
                      {issue.suggestion && (
                        <p className="text-sm mt-2 italic">
                          💡 {issue.suggestion}
                        </p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-white">
                      {issue.issueType}
                    </span>
                  </div>
                </div>
              ))}
              {validation.issues.length > 5 && (
                <p className="text-sm text-gray-400 text-center">
                  ...and {validation.issues.length - 5} more issues
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Measurement Converter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" aria-hidden="true" />
            <span>Measurement Converter</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Drawing Measurement (inches)</Label>
              <Input
                type="number"
                value={measurement}
                onChange={(e) => setMeasurement(e.target.value)}
                placeholder="1.0"
              />
            </div>
            <div>
              <Label>Scale Ratio</Label>
              <Input
                type="number"
                value={scaleRatio}
                onChange={(e) => setScaleRatio(e.target.value)}
                placeholder="48"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleConvert} className="w-full">
                Convert to Feet
              </Button>
            </div>
            <div>
              <Label>Real-World Measurement</Label>
              <div className="h-10 px-3 py-2 bg-gray-50 border rounded-md flex items-center">
                <span className="font-mono text-lg">
                  {convertedValue !== null
                    ? `${convertedValue.toFixed(2)} ft`
                    : '--'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Search sheets or scales..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={exportScales}
            disabled={scales.length === 0}
          >
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Export Scales
          </Button>
          <Button
            onClick={handleExtractScales}
            disabled={extracting}
          >
            <Ruler className={`h-4 w-4 mr-2 ${extracting ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {extracting ? 'Extracting...' : 'Extract Scales'}
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {scales.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Ruler className="h-12 w-12 mx-auto text-gray-400 mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Scale Data Available
            </h3>
            <p className="text-gray-600 mb-6">
              Extract scales from your documents to see validation and statistics.
            </p>
            <Button onClick={handleExtractScales} disabled={extracting}>
              <Ruler className="h-4 w-4 mr-2" aria-hidden="true" />
              Extract Scales Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scale Cards */}
      {filteredScales.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScales.map((scale, index) => (
            <Card
              key={index}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedSheet(scale.sheetNumber)}
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {/* Sheet Number */}
                  <div>
                    <p className="text-sm text-gray-600">Sheet</p>
                    <p className="text-lg font-bold text-gray-900">{scale.sheetNumber}</p>
                  </div>

                  {/* Primary Scale */}
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">Primary Scale</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getFormatColor(scale.scaleData.primaryScale.format)}`}>
                        {scale.scaleData.primaryScale.format}
                      </span>
                    </div>
                    <p className="text-2xl font-mono font-bold text-center text-gray-900">
                      {scale.scaleData.primaryScale.scaleString}
                    </p>
                    <p className="text-sm text-gray-600 text-center mt-2">
                      Ratio: {scale.scaleData.primaryScale.scaleRatio}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {scale.scaleData.hasMultipleScales ? `${scale.scaleData.scaleCount} scales` : 'Single scale'}
                    </span>
                    <span className="text-gray-600">
                      {Math.round(scale.scaleData.confidence * 100)}% confidence
                    </span>
                  </div>

                  {/* Document Name */}
                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-400 truncate">
                      {scale.documentName}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
