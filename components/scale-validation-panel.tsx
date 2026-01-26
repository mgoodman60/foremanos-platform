/**
 * Scale Validation Panel Component
 * Phase A.3 - Displays scale validation results with conflict indicators
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, RefreshCw, Scale } from 'lucide-react';
import { toast } from 'sonner';

interface ScaleInfo {
  raw: string;
  normalized: string;
  ratio: number;
  imperial: boolean;
  metric: boolean;
  confidence: number;
  source: string;
}

interface ScaleConflict {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
}

interface ScaleValidation {
  isValid: boolean;
  consistency: 'consistent' | 'inconsistent' | 'multiple_scales' | 'no_scale';
  titleBlockScale?: ScaleInfo;
  drawingScales: ScaleInfo[];
  conflicts: ScaleConflict[];
  recommendation?: string;
  measurementAccuracy: 'high' | 'medium' | 'low' | 'unknown';
}

interface ScaleValidationPanelProps {
  projectSlug: string;
  documentId?: string;
  onValidationComplete?: (validation: ScaleValidation) => void;
}

export default function ScaleValidationPanel({
  projectSlug,
  documentId,
  onValidationComplete
}: ScaleValidationPanelProps) {
  const [validation, setValidation] = useState<ScaleValidation | null>(null);
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);

  const runValidation = async (forceRevalidate = false) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/validate-scales`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId, forceRevalidate })
        }
      );

      if (!response.ok) throw new Error('Validation failed');

      const data = await response.json();
      
      if (documentId) {
        setValidation(data.validation);
        onValidationComplete?.(data.validation);
      } else {
        toast.success(`Validated ${data.validatedDocuments} documents`);
        loadStatistics();
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate scales');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch(
        `/api/projects/${projectSlug}/validate-scales`
      );

      if (!response.ok) throw new Error('Failed to load statistics');

      const data = await response.json();
      setStatistics(data.statistics);
    } catch (error) {
      console.error('Statistics error:', error);
    }
  };

  useEffect(() => {
    if (!documentId) {
      loadStatistics();
    }
  }, [projectSlug, documentId]);

  const getConsistencyBadge = (consistency: ScaleValidation['consistency']) => {
    const badges = {
      consistent: { color: 'bg-green-500', text: 'Consistent', icon: CheckCircle },
      inconsistent: { color: 'bg-red-500', text: 'Inconsistent', icon: AlertTriangle },
      multiple_scales: { color: 'bg-yellow-500', text: 'Multiple Scales', icon: Info },
      no_scale: { color: 'bg-gray-500', text: 'No Scale Found', icon: AlertTriangle }
    };
    return badges[consistency];
  };

  const getAccuracyBadge = (accuracy: ScaleValidation['measurementAccuracy']) => {
    const badges = {
      high: { color: 'bg-green-500', text: 'High Accuracy' },
      medium: { color: 'bg-yellow-500', text: 'Medium Accuracy' },
      low: { color: 'bg-red-500', text: 'Low Accuracy' },
      unknown: { color: 'bg-gray-500', text: 'Unknown' }
    };
    return badges[accuracy];
  };

  const getSeverityColor = (severity: ScaleConflict['severity']) => {
    return {
      high: 'border-red-500 bg-red-50',
      medium: 'border-yellow-500 bg-yellow-50',
      low: 'border-blue-500 bg-blue-50'
    }[severity];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Scale className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Scale Validation
            </h3>
            <p className="text-sm text-gray-600">
              {documentId ? 'Document scale analysis' : 'Project-wide scale analysis'}
            </p>
          </div>
        </div>
        <button
          onClick={() => runValidation(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Validating...' : 'Validate Scales'}
        </button>
      </div>

      {/* Statistics Overview (Project Level) */}
      {!documentId && statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">
              {statistics.totalDocuments}
            </div>
            <div className="text-sm text-gray-600">Total Documents</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {statistics.consistent}
            </div>
            <div className="text-sm text-gray-600">Consistent</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600">
              {statistics.highSeverityConflicts}
            </div>
            <div className="text-sm text-gray-600">High Severity Issues</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">
              {statistics.highAccuracy}
            </div>
            <div className="text-sm text-gray-600">High Accuracy Docs</div>
          </div>
        </div>
      )}

      {/* Common Scales (Project Level) */}
      {!documentId && statistics?.commonScales && statistics.commonScales.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">Most Common Scales</h4>
          <div className="space-y-2">
            {statistics.commonScales.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm font-mono text-gray-700">{item.scale}</span>
                <span className="text-sm text-gray-600">{item.count} documents</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document-Level Validation Results */}
      {documentId && validation && (
        <div className="space-y-4">
          {/* Status Badges */}
          <div className="flex gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 ${getConsistencyBadge(validation.consistency).color} text-white rounded-lg text-sm font-medium`}>
              {(() => {
                const Icon = getConsistencyBadge(validation.consistency).icon;
                return <Icon className="h-4 w-4" />;
              })()}
              {getConsistencyBadge(validation.consistency).text}
            </div>
            <div className={`px-3 py-1.5 ${getAccuracyBadge(validation.measurementAccuracy).color} text-white rounded-lg text-sm font-medium`}>
              {getAccuracyBadge(validation.measurementAccuracy).text}
            </div>
          </div>

          {/* Title Block Scale */}
          {validation.titleBlockScale && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Title Block Scale</h4>
              <div className="flex items-center justify-between">
                <span className="text-lg font-mono text-blue-600">
                  {validation.titleBlockScale.normalized}
                </span>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Ratio: {validation.titleBlockScale.ratio}</div>
                  <div className="text-xs text-gray-500">
                    {validation.titleBlockScale.imperial ? 'Imperial' : 'Metric'} • 
                    {Math.round(validation.titleBlockScale.confidence * 100)}% confidence
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Drawing Scales */}
          {validation.drawingScales.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Drawing Scales ({validation.drawingScales.length})
              </h4>
              <div className="space-y-2">
                {validation.drawingScales.map((scale, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="font-mono text-sm text-gray-700">
                      {scale.normalized}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Ratio: {scale.ratio}</span>
                      <span>•</span>
                      <span>{Math.round(scale.confidence * 100)}%</span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded">{scale.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflicts */}
          {validation.conflicts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Issues Detected</h4>
              {validation.conflicts.map((conflict, idx) => (
                <div
                  key={idx}
                  className={`border-l-4 rounded-lg p-4 ${getSeverityColor(conflict.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-gray-700 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium uppercase text-gray-700">
                          {conflict.severity} Severity
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mb-2">{conflict.description}</p>
                      <p className="text-xs text-gray-600 italic">💡 {conflict.suggestion}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          {validation.recommendation && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Recommendation</h4>
                  <p className="text-sm text-blue-800">{validation.recommendation}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && !validation && documentId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Scale className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-4">No validation results yet</p>
          <button
            onClick={() => runValidation()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Run Scale Validation
          </button>
        </div>
      )}
    </div>
  );
}
