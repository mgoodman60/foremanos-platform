"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Box,
  Layers,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Maximize2,
  TrendingUp,
  Zap,
  Droplets,
  Flame,
  Thermometer,
  FileText,
  Eye,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface IsometricAnalysis {
  viewType: 'isometric' | 'oblique' | 'axonometric';
  confidence: number;
  elements: number;
  verticality: 'high' | 'medium' | 'low';
  complexity: 'simple' | 'moderate' | 'complex';
  recommendations: string[];
}

interface Spatial3DModel {
  elements: any[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  paths: Array<{
    id: string;
    elements: string[];
    totalLength: number;
    elevationChange: number;
  }>;
}

interface IsometricVisualization {
  svgData: string;
  dimensions: { width: number; height: number };
  viewAngle: string;
  elements: Array<{
    id: string;
    type: string;
    path: string;
    color: string;
    label?: string;
  }>;
}

interface SheetOption {
  id: string;
  documentId: string;
  documentName: string;
  sheetNumber: string | null;
  sheetName: string | null;
  discipline: string;
  isIsometric: boolean;
  pageNumber?: number;
}

export default function IsometricViewPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  
  const [loading, setLoading] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [analysis, setAnalysis] = useState<IsometricAnalysis | null>(null);
  const [model3D, setModel3D] = useState<Spatial3DModel | null>(null);
  const [visualization, setVisualization] = useState<IsometricVisualization | null>(null);
  
  const slug = params?.slug as string;

  // Fetch available sheets on mount
  useEffect(() => {
    if (slug && status === 'authenticated') {
      fetchSheets();
    }
  }, [slug, status]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const fetchSheets = async () => {
    try {
      setLoadingSheets(true);
      const response = await fetch(`/api/projects/${slug}/isometric?action=list-sheets`);
      const data = await response.json();
      
      if (data.success && data.sheets) {
        setSheets(data.sheets);
        // Auto-select first sheet if available
        if (data.sheets.length > 0 && !selectedSheet) {
          setSelectedSheet(data.sheets[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching sheets:', error);
      toast.error('Failed to load available sheets');
    } finally {
      setLoadingSheets(false);
    }
  };

  const generateIsometricView = async () => {
    if (!selectedSheet) {
      toast.error('Please select a sheet');
      return;
    }

    const sheet = sheets.find(s => s.id === selectedSheet);
    if (!sheet) {
      toast.error('Invalid sheet selection');
      return;
    }

    try {
      setGenerating(true);
      setAnalysis(null);
      setModel3D(null);
      setVisualization(null);

      toast.loading('Generating isometric view...', { id: 'generate-iso' });

      const params = new URLSearchParams({
        action: 'generate',
        documentId: sheet.documentId
      });
      if (sheet.sheetNumber) {
        params.append('sheet', sheet.sheetNumber);
      }

      const response = await fetch(`/api/projects/${slug}/isometric?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setAnalysis(data.analysis);
        setModel3D(data.model);
        setVisualization(data.visualization);
        toast.success('Isometric view generated!', { id: 'generate-iso' });
      } else {
        toast.error(data.message || 'Failed to generate isometric view', { id: 'generate-iso' });
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate isometric view', { id: 'generate-iso' });
    } finally {
      setGenerating(false);
    }
  };

  const downloadSVG = () => {
    if (!visualization?.svgData) return;
    
    const blob = new Blob([visualization.svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isometric-view-${selectedSheet || 'view'}.svg`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('SVG downloaded');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getComplexityBadge = (complexity: string) => {
    const colors = {
      simple: 'bg-green-900/30 text-green-400 border-green-700',
      moderate: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
      complex: 'bg-red-900/30 text-red-400 border-red-700'
    };
    return colors[complexity as keyof typeof colors] || colors.moderate;
  };

  const getDisciplineIcon = (discipline: string) => {
    switch (discipline) {
      case 'mechanical':
      case 'hvac':
        return <Thermometer className="h-4 w-4 text-emerald-400" />;
      case 'plumbing':
        return <Droplets className="h-4 w-4 text-blue-400" />;
      case 'electrical':
        return <Zap className="h-4 w-4 text-yellow-400" />;
      case 'fire_protection':
        return <Flame className="h-4 w-4 text-red-400" />;
      default:
        return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const getDisciplineLabel = (discipline: string) => {
    const labels: Record<string, string> = {
      mechanical: 'Mechanical',
      plumbing: 'Plumbing',
      electrical: 'Electrical',
      fire_protection: 'Fire Protection',
      hvac: 'HVAC',
      other: 'Other'
    };
    return labels[discipline] || discipline;
  };

  // Group sheets by discipline
  const sheetsByDiscipline = sheets.reduce((acc, sheet) => {
    if (!acc[sheet.discipline]) acc[sheet.discipline] = [];
    acc[sheet.discipline].push(sheet);
    return acc;
  }, {} as Record<string, SheetOption[]>);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-dark-surface flex items-center justify-center">
        <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-surface text-gray-100">
      {/* Header */}
      <div className="bg-dark-card border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/project/${slug}`)}
                className="text-gray-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center">
                  <Box className="h-6 w-6 mr-2 text-cyan-400" />
                  Isometric View Generator
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Generate 3D isometric visualizations from MEP plan sheets
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-1">
            <Card className="p-6 bg-dark-card border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Layers className="h-5 w-5 mr-2 text-cyan-400" />
                Select Sheet
              </h2>
              
              <div className="space-y-4">
                {/* Sheet Selector Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    MEP Sheet
                  </label>
                  {loadingSheets ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin mr-2" />
                      <span className="text-sm text-gray-400">Loading sheets...</span>
                    </div>
                  ) : sheets.length === 0 ? (
                    <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                      <p className="text-sm text-yellow-300">
                        No MEP sheets found in this project. Upload mechanical, plumbing, or electrical plans to generate isometric views.
                      </p>
                    </div>
                  ) : (
                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                      <SelectTrigger className="bg-dark-surface border-gray-600 text-white">
                        <SelectValue placeholder="Select a sheet..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        {Object.entries(sheetsByDiscipline).map(([discipline, disciplineSheets]) => (
                          <div key={discipline}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 flex items-center gap-2 bg-dark-surface sticky top-0">
                              {getDisciplineIcon(discipline)}
                              {getDisciplineLabel(discipline)} ({disciplineSheets.length})
                            </div>
                            {disciplineSheets.map((sheet) => (
                              <SelectItem key={sheet.id} value={sheet.id}>
                                <div className="flex items-center gap-2">
                                  {sheet.isIsometric && (
                                    <Badge variant="outline" className="text-[10px] text-cyan-400 border-cyan-700">
                                      ISO
                                    </Badge>
                                  )}
                                  <span className="font-mono text-sm">
                                    {sheet.sheetNumber || `Page ${sheet.pageNumber}`}
                                  </span>
                                  {sheet.sheetName && (
                                    <span className="text-gray-400 text-sm truncate max-w-[150px]">
                                      - {sheet.sheetName}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Only MEP-related sheets (Mechanical, Plumbing, Electrical, Fire Protection) are shown
                  </p>
                </div>

                {/* Selected Sheet Info */}
                {selectedSheet && (
                  <div className="p-3 bg-dark-surface rounded-lg border border-gray-700">
                    {(() => {
                      const sheet = sheets.find(s => s.id === selectedSheet);
                      if (!sheet) return null;
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {getDisciplineIcon(sheet.discipline)}
                            <span className="font-medium text-white">
                              {sheet.sheetNumber || `Page ${sheet.pageNumber}`}
                            </span>
                            {sheet.isIsometric && (
                              <Badge className="bg-cyan-900/30 text-cyan-400 border-cyan-700 text-xs">
                                Already Isometric
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">
                            {sheet.documentName}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Generate Button */}
                <Button
                  onClick={generateIsometricView}
                  disabled={generating || !selectedSheet || loadingSheets}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Generate Isometric View
                    </>
                  )}
                </Button>

                {/* Refresh Sheets Button */}
                <Button
                  onClick={fetchSheets}
                  disabled={loadingSheets}
                  variant="outline"
                  className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingSheets ? 'animate-spin' : ''}`} />
                  Refresh Sheet List
                </Button>
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-cyan-900/20 border border-cyan-800 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-300">
                    <p className="font-semibold mb-1">About Isometric Views</p>
                    <p>
                      This tool generates 3D isometric visualizations from your MEP plan sheets.
                      It extracts piping, ductwork, and equipment from the plans and creates
                      a spatial representation showing elevation and routing relationships.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Visualization */}
            {visualization && (
              <Card className="p-6 bg-dark-card border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center">
                    <Eye className="h-5 w-5 mr-2 text-cyan-400" />
                    Isometric Visualization
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadSVG}
                    className="border-cyan-600 text-cyan-400 hover:bg-cyan-900/20"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download SVG
                  </Button>
                </div>

                {/* SVG Viewer */}
                <div 
                  className="bg-dark-surface rounded-lg border border-gray-700 overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: visualization.svgData }}
                />

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-400">Plumbing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-gray-400">HVAC</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-gray-400">Electrical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-gray-400">Fire Protection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-gray-400">Mechanical</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Analysis Results */}
            {analysis && (
              <Card className="p-6 bg-dark-card border-gray-700">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-green-400" />
                  Analysis Results
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">View Type</div>
                    <div className="font-semibold text-white capitalize">
                      {analysis.viewType}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Confidence</div>
                    <div className={`font-semibold ${getConfidenceColor(analysis.confidence)}`}>
                      {Math.round(analysis.confidence * 100)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Elements</div>
                    <div className="font-semibold text-cyan-400">
                      {analysis.elements}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Verticality</div>
                    <Badge className="capitalize" variant="outline">
                      {analysis.verticality}
                    </Badge>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-xs text-gray-400 mb-2">Complexity</div>
                  <Badge className={getComplexityBadge(analysis.complexity)}>
                    {analysis.complexity}
                  </Badge>
                </div>

                {analysis.recommendations.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-300 mb-2">
                      Recommendations
                    </div>
                    <ul className="space-y-2">
                      {analysis.recommendations.map((rec, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-gray-400 flex items-start"
                        >
                          <TrendingUp className="h-4 w-4 text-cyan-400 mr-2 flex-shrink-0 mt-0.5" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            {/* 3D Model Results */}
            {model3D && (
              <Card className="p-6 bg-dark-card border-gray-700">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <Box className="h-5 w-5 mr-2 text-cyan-400" />
                  3D Model Data
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card className="p-3 bg-dark-surface border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Elements</div>
                    <div className="text-xl font-bold text-white">
                      {model3D.elements.length}
                    </div>
                  </Card>
                  <Card className="p-3 bg-dark-surface border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Paths</div>
                    <div className="text-xl font-bold text-cyan-400">
                      {model3D.paths.length}
                    </div>
                  </Card>
                  <Card className="p-3 bg-dark-surface border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">X Range</div>
                    <div className="text-sm font-medium text-white">
                      {model3D.bounds.minX.toFixed(1)} → {model3D.bounds.maxX.toFixed(1)}
                    </div>
                  </Card>
                  <Card className="p-3 bg-dark-surface border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Z Range (Elevation)</div>
                    <div className="text-sm font-medium text-white">
                      {model3D.bounds.minZ.toFixed(1)}' → {model3D.bounds.maxZ.toFixed(1)}'
                    </div>
                  </Card>
                </div>

                {model3D.paths.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-300 mb-3">
                      Identified Routing Paths
                    </div>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {model3D.paths.map((path, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-dark-surface border border-gray-700 rounded-lg"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-white">{path.id}</span>
                              <Badge variant="outline" className="text-xs">
                                {path.elements.length} elements
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-gray-400">Length: </span>
                                <span className="text-white font-medium">
                                  {path.totalLength}'
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Elevation Δ: </span>
                                <span className="text-cyan-400 font-medium">
                                  {path.elevationChange}'
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </Card>
            )}

            {/* Empty State */}
            {!analysis && !model3D && !visualization && (
              <Card className="p-12 bg-dark-card border-gray-700 text-center">
                <Box className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-2">
                  Select a sheet and click "Generate Isometric View" to create a 3D visualization
                </p>
                <p className="text-xs text-gray-500">
                  MEP plan sheets will be analyzed and converted into isometric representations
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
