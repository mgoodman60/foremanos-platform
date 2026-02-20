'use client';

import { useState, useEffect } from 'react';
import { 
  Camera, TrendingUp, Check, RefreshCw,
  ChevronDown, ChevronUp, Sparkles, Eye, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

interface ProgressDetection {
  taskId?: string;
  taskName: string;
  currentProgress: number;
  suggestedProgress: number;
  confidence: 'high' | 'medium' | 'low';
  source: 'photo' | 'report' | 'combined';
  evidence: string[];
  detectedPhase: string;
  location?: string;
}

interface ProgressDetectionPanelProps {
  projectSlug: string;
  reportId?: string;
  onProgressApplied?: () => void;
}

export default function ProgressDetectionPanel({
  projectSlug,
  reportId,
  onProgressApplied,
}: ProgressDetectionPanelProps) {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [detections, setDetections] = useState<ProgressDetection[]>([]);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const [siteSummary, setSiteSummary] = useState<{
    overallProgress: number;
    byPhase: Record<string, { progress: number; taskCount: number }>;
  } | null>(null);

  useEffect(() => {
    fetchSiteSummary();
  }, [projectSlug]);

  const fetchSiteSummary = async () => {
    try {
      const response = await fetch(`/api/projects/${projectSlug}/daily-reports/progress-detection`);
      if (response.ok) {
        const data = await response.json();
        setSiteSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch site summary:', error);
    }
  };

  const analyzeReport = async () => {
    if (!reportId) {
      toast.error('No report selected for analysis');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/daily-reports/progress-detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze-report',
          reportId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setDetections(data.detections);
        // Auto-select high confidence detections
        const highConfidence = new Set<string>(
          data.detections
            .filter((d: ProgressDetection) => d.confidence === 'high' && d.taskId)
            .map((d: ProgressDetection) => d.taskId as string)
        );
        setSelectedUpdates(highConfidence);
        
        if (data.detections.length > 0) {
          toast.success(`Found ${data.detections.length} potential progress updates`);
        } else {
          toast.info('No progress updates detected');
        }
      } else {
        toast.error(data.error || 'Analysis failed');
      }
    } catch (error) {
      toast.error('Failed to analyze report');
    } finally {
      setAnalyzing(false);
    }
  };

  const applyUpdates = async () => {
    const updates = detections
      .filter(d => d.taskId && selectedUpdates.has(d.taskId))
      .map(d => ({ taskId: d.taskId!, newProgress: d.suggestedProgress }));

    if (updates.length === 0) {
      toast.error('No updates selected');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectSlug}/daily-reports/progress-detection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply-updates',
          updates,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Updated ${data.updated} task(s)`);
        setDetections([]);
        setSelectedUpdates(new Set());
        fetchSiteSummary();
        onProgressApplied?.();
      } else {
        toast.error('Failed to apply updates');
      }
    } catch (error) {
      toast.error('Failed to apply updates');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (taskId: string) => {
    const newSelected = new Set(selectedUpdates);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedUpdates(newSelected);
  };

  const confidenceColors = {
    high: 'text-green-400 bg-green-500/20',
    medium: 'text-yellow-400 bg-yellow-500/20',
    low: 'text-gray-400 bg-gray-500/20',
  };

  const sourceIcons = {
    photo: <Camera className="w-3 h-3" />,
    report: <Eye className="w-3 h-3" />,
    combined: <Sparkles className="w-3 h-3" />,
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <div className="text-left">
            <h3 className="text-white font-medium">AI Progress Detection</h3>
            <p className="text-gray-400 text-sm">
              {siteSummary ? `Site: ${siteSummary.overallProgress}% complete` : 'Analyze photos & reports'}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Phase Progress */}
          {siteSummary && Object.keys(siteSummary.byPhase).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(siteSummary.byPhase).map(([phase, data]) => (
                <div key={phase} className="bg-gray-700/30 rounded p-2">
                  <div className="text-xs text-gray-400 capitalize">
                    {phase.replace('_', ' ')}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${data.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-white font-medium">{data.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Analyze Button */}
          <button
            onClick={analyzeReport}
            disabled={analyzing || !reportId}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium transition-colors"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing Photos & Content...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Detect Progress from Report
              </>
            )}
          </button>

          {/* Detections List */}
          {detections.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Detected Updates</span>
                <span className="text-gray-400">{selectedUpdates.size} selected</span>
              </div>

              {detections.map((detection, idx) => (
                <div
                  key={detection.taskId || idx}
                  className={`p-3 rounded-lg border transition-colors ${
                    detection.taskId && selectedUpdates.has(detection.taskId)
                      ? 'bg-purple-500/10 border-purple-500/50'
                      : 'bg-gray-700/30 border-gray-600/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {detection.taskId && (
                      <button
                        onClick={() => toggleSelection(detection.taskId!)}
                        className="mt-0.5"
                      >
                        {selectedUpdates.has(detection.taskId) ? (
                          <CheckCircle2 className="w-5 h-5 text-purple-400" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-500" />
                        )}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium truncate">
                          {detection.taskName}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 ${confidenceColors[detection.confidence]}`}>
                          {sourceIcons[detection.source]}
                          {detection.confidence}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-gray-400 text-sm">
                          {detection.currentProgress}%
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-400 font-medium">
                          {detection.suggestedProgress}%
                        </span>
                        <span className="text-green-400/60 text-sm">
                          (+{detection.suggestedProgress - detection.currentProgress}%)
                        </span>
                      </div>

                      {detection.evidence.length > 0 && (
                        <div className="mt-1 text-xs text-gray-400">
                          Evidence: {detection.evidence.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Apply Button */}
              <button
                onClick={applyUpdates}
                disabled={loading || selectedUpdates.size === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Apply {selectedUpdates.size} Update{selectedUpdates.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
