"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MapPin,
  Grid3x3,
  Search,
  ArrowLeft,
  Layers,
  RefreshCw,
  AlertCircle,
  Target,
  Map
} from 'lucide-react';
import { toast } from 'sonner';

interface SpatialMatch {
  sourceSheet: string;
  targetSheet: string;
  matchType: 'grid' | 'room' | 'element' | 'coordinate';
  confidence: number;
  location: {
    description: string;
    grid?: { x: string; y: string };
  };
  context?: string;
}

interface GridSystem {
  sheetNumber: string;
  discipline: string;
  gridCount: number;
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  scale?: string;
}

export default function SpatialCorrelationPage() {
  const params = useParams();
  const router = useRouter();
  const { data: _session, status } = useSession() || {};
  
  const [loading, setLoading] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [matches, setMatches] = useState<SpatialMatch[]>([]);
  const [_gridSystems, _setGridSystems] = useState<GridSystem[]>([]);
  const [includeRelated, setIncludeRelated] = useState(true);
  
  const slug = params?.slug as string;

  const disciplines = [
    { id: 'architectural', label: 'Architectural', icon: '🏛️' },
    { id: 'structural', label: 'Structural', icon: '🏗️' },
    { id: 'mechanical', label: 'Mechanical', icon: '🔧' },
    { id: 'electrical', label: 'Electrical', icon: '⚡' },
    { id: 'plumbing', label: 'Plumbing', icon: '💧' },
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const performSpatialQuery = async () => {
    if (!searchLocation.trim()) {
      toast.error('Please enter a location to search');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${slug}/spatial/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: searchLocation,
          disciplines: selectedDisciplines.length > 0 ? selectedDisciplines : undefined,
          includeRelated
        })
      });

      const data = await response.json();

      if (data.success) {
        setMatches(data.matches || []);
        toast.success(`Found ${data.count} matching sheet${data.count !== 1 ? 's' : ''}`);
      } else {
        toast.error(data.error || 'Failed to perform spatial query');
      }
    } catch (error) {
      console.error('Spatial query error:', error);
      toast.error('Network error performing spatial query');
    } finally {
      setLoading(false);
    }
  };

  const toggleDiscipline = (disciplineId: string) => {
    setSelectedDisciplines(prev => 
      prev.includes(disciplineId)
        ? prev.filter(d => d !== disciplineId)
        : [...prev, disciplineId]
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.5) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getMatchTypeIcon = (type: string) => {
    switch (type) {
      case 'grid': return <Grid3x3 className="h-4 w-4" />;
      case 'room': return <MapPin className="h-4 w-4" />;
      case 'element': return <Target className="h-4 w-4" />;
      default: return <Map className="h-4 w-4" />;
    }
  };

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
                  <Layers className="h-6 w-6 mr-2 text-cyan-400" />
                  Multi-Sheet Spatial Correlation
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  Phase C.1: Cross-sheet location queries and coordinate mapping
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search Panel */}
          <div className="lg:col-span-1">
            <Card className="p-6 bg-dark-card border-gray-700">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Search className="h-5 w-5 mr-2 text-cyan-400" />
                Search Location
              </h2>
              
              <div className="space-y-4">
                {/* Location Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Location Query
                  </label>
                  <Input
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && performSpatialQuery()}
                    placeholder="e.g., Grid A-3, Room 101"
                    className="bg-dark-surface border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Examples: &quot;Grid A-3&quot;, &quot;Room 101&quot;, &quot;Northeast corner&quot;
                  </p>
                </div>

                {/* Discipline Filters */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Filter by Discipline
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {disciplines.map(d => (
                      <button
                        key={d.id}
                        onClick={() => toggleDiscipline(d.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          selectedDisciplines.includes(d.id)
                            ? 'bg-cyan-600 text-white'
                            : 'bg-dark-surface text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {d.icon} {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Options */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeRelated"
                    checked={includeRelated}
                    onChange={(e) => setIncludeRelated(e.target.checked)}
                    className="rounded border-gray-600 bg-dark-surface text-cyan-600"
                  />
                  <label htmlFor="includeRelated" className="text-sm text-gray-300">
                    Include adjacent locations
                  </label>
                </div>

                {/* Search Button */}
                <Button
                  onClick={performSpatialQuery}
                  disabled={loading || !searchLocation.trim()}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search Across Sheets
                    </>
                  )}
                </Button>
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-cyan-900/20 border border-cyan-800 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-300">
                    <p className="font-semibold mb-1">About Spatial Correlation</p>
                    <p>
                      This feature analyzes grid systems, room numbers, and spatial relationships
                      across multiple drawing sheets to help you locate elements across different
                      disciplines.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-dark-card border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-cyan-400" />
                  Search Results
                  {matches.length > 0 && (
                    <Badge className="ml-3 bg-cyan-600">
                      {matches.length} match{matches.length !== 1 ? 'es' : ''}
                    </Badge>
                  )}
                </h2>
              </div>

              {matches.length === 0 ? (
                <div className="text-center py-12">
                  <Map className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">
                    Enter a location and click &quot;Search Across Sheets&quot; to find matching sheets
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-3">
                    {matches
                      .sort((a, b) => b.confidence - a.confidence)
                      .map((match, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-dark-surface border border-gray-700 rounded-lg hover:border-cyan-600 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {getMatchTypeIcon(match.matchType)}
                              <span className="font-medium text-white">
                                Sheet {match.sourceSheet}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-xs capitalize border-gray-600"
                              >
                                {match.matchType}
                              </Badge>
                            </div>
                            <span className={`text-sm font-medium ${getConfidenceColor(match.confidence)}`}>
                              {Math.round(match.confidence * 100)}% match
                            </span>
                          </div>

                          <div className="mb-2">
                            <span className="text-sm text-gray-300">
                              {match.location.description}
                            </span>
                            {match.location.grid && (
                              <span className="text-xs text-cyan-400 ml-2">
                                (Grid {match.location.grid.x}-{match.location.grid.y})
                              </span>
                            )}
                          </div>

                          {match.context && (
                            <p className="text-xs text-gray-400 line-clamp-2">
                              {match.context}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </Card>
          </div>
        </div>

        {/* Summary Statistics */}
        {matches.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-dark-card border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Total Matches</div>
              <div className="text-2xl font-bold text-white">{matches.length}</div>
            </Card>
            <Card className="p-4 bg-dark-card border-gray-700">
              <div className="text-sm text-gray-400 mb-1">High Confidence</div>
              <div className="text-2xl font-bold text-green-400">
                {matches.filter(m => m.confidence >= 0.8).length}
              </div>
            </Card>
            <Card className="p-4 bg-dark-card border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Grid Matches</div>
              <div className="text-2xl font-bold text-cyan-400">
                {matches.filter(m => m.matchType === 'grid').length}
              </div>
            </Card>
            <Card className="p-4 bg-dark-card border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Room Matches</div>
              <div className="text-2xl font-bold text-purple-400">
                {matches.filter(m => m.matchType === 'room').length}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
