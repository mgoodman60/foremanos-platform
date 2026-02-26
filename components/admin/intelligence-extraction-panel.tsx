'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectSlug: string;
  projectName: string;
}

interface ExtractionStats {
  totalChunks: number;
  phaseA: {
    titleBlocks: number;
    scales: number;
    sheets: number;
  };
  phaseB: {
    dimensions: number;
    annotations: number;
    crossReferences: number;
  };
  phaseC: {
    spatialReferences: number;
    mepElements: number;
  };
}

export function IntelligenceExtractionPanel({ projectSlug, projectName }: Props) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ExtractionStats | null>(null);
  const [extracting, setExtracting] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectSlug}/extract-intelligence`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.extractionStats);
      } else {
        throw new Error('Failed to fetch stats');
      }
    } catch (error: unknown) {
      console.error('Error fetching extraction stats:', error);
      toast.error('Failed to load extraction statistics');
    } finally {
      setLoading(false);
    }
  };

  const triggerExtraction = async (phases: string[]) => {
    try {
      setExtracting(true);
      toast.info(`Starting ${phases.join(', ')} extraction...`);

      const response = await fetch(`/api/projects/${projectSlug}/extract-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phases, skipExisting: true }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(
          `Extraction complete! ${result.summary.successful}/${result.summary.totalDocuments} documents processed`
        );
        await fetchStats(); // Refresh stats
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Extraction failed');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      console.error('Extraction error:', error);
      toast.error(`Extraction failed: ${message}`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card className="border-blue-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain aria-hidden="true" className="h-5 w-5 text-blue-500" />
            <div>
              <CardTitle>Intelligence Extraction</CardTitle>
              <CardDescription className="mt-1">
                Extract Phase A, B, and C intelligence from {projectName}
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Extraction Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Phase A */}
            <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  Phase A
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Title Blocks:</span>
                  <span className="font-medium text-white">{stats.phaseA.titleBlocks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Scales:</span>
                  <span className="font-medium text-white">{stats.phaseA.scales}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Sheets:</span>
                  <span className="font-medium text-white">{stats.phaseA.sheets}</span>
                </div>
              </div>
            </div>

            {/* Phase B */}
            <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                  Phase B
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Dimensions:</span>
                  <span className="font-medium text-white">{stats.phaseB.dimensions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Annotations:</span>
                  <span className="font-medium text-white">{stats.phaseB.annotations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cross-Refs:</span>
                  <span className="font-medium text-white">{stats.phaseB.crossReferences}</span>
                </div>
              </div>
            </div>

            {/* Phase C */}
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/30">
                  Phase C
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Spatial Refs:</span>
                  <span className="font-medium text-white">{stats.phaseC.spatialReferences}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">MEP Elements:</span>
                  <span className="font-medium text-white">{stats.phaseC.mepElements}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Chunks:</span>
                  <span className="font-medium text-white">{stats.totalChunks}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            onClick={() => triggerExtraction(['A', 'B', 'C'])}
            disabled={extracting}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {extracting ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Brain aria-hidden="true" className="mr-2 h-4 w-4" />
                Extract All Phases
              </>
            )}
          </Button>

          <Button
            onClick={() => triggerExtraction(['C'])}
            disabled={extracting}
            variant="outline"
            className="border-green-500/30 hover:bg-green-500/10"
          >
            {extracting ? (
              <>
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <CheckCircle2 aria-hidden="true" className="mr-2 h-4 w-4" />
                Phase C Only
              </>
            )}
          </Button>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="text-amber-200 font-medium">Intelligence Extraction Info</p>
              <ul className="text-gray-400 space-y-1 list-disc list-inside">
                <li>Extraction runs automatically after document processing</li>
                <li>Use &quot;Extract All Phases&quot; for documents added before auto-extraction</li>
                <li>&quot;Phase C Only&quot; re-runs advanced intelligence without re-extracting basics</li>
                <li>Extraction skips pages that already have data (non-destructive)</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
