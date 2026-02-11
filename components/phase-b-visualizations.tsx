/**
 * Phase B Intelligence Visualizations for Chat Interface
 * 
 * Compact visualization components for displaying dimensions, annotations,
 * detail callouts, and symbols within chat responses.
 */

'use client';

import React from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import {
  Ruler,
  AlertTriangle,
  Info,
  Navigation,
  Zap,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  Star
} from 'lucide-react';

// ============================================================================
// DIMENSION CARD
// ============================================================================

interface DimensionData {
  dimensions: Array<{
    originalText: string;
    value: number;
    unit: string;
    type: string;
    context?: string;
    critical?: boolean;
    confidence: number;
    sheetNumber?: string;
  }>;
}

export function DimensionCard({ data }: { data: DimensionData }) {
  if (!data.dimensions || data.dimensions.length === 0) return null;

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

  return (
    <Card className="bg-dark-card border-gray-700 my-2">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Ruler className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-gray-100 text-sm">Extracted Dimensions</span>
        </div>
        <div className="space-y-2">
          {data.dimensions.slice(0, 5).map((dim, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm bg-dark-surface p-2 rounded">
              <div className="flex items-center gap-2 flex-1">
                <Badge className={`${getTypeColor(dim.type)} text-white text-xs`}>
                  {dim.type}
                </Badge>
                <span className="font-mono font-bold text-gray-100">
                  {dim.originalText}
                </span>
                {dim.critical && (
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {dim.sheetNumber && <span>Sheet {dim.sheetNumber}</span>}
                <span>{Math.round(dim.confidence * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
        {data.dimensions.length > 5 && (
          <div className="text-xs text-gray-400 mt-2 text-center">
            +{data.dimensions.length - 5} more dimensions
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ANNOTATION CARD
// ============================================================================

interface AnnotationData {
  annotations: Array<{
    type: string;
    text: string;
    priority: 'critical' | 'important' | 'informational';
    keywords?: string[];
    requirements?: string[];
    sheetNumber?: string;
    confidence: number;
  }>;
}

export function AnnotationCard({ data }: { data: AnnotationData }) {
  if (!data.annotations || data.annotations.length === 0) return null;

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

  // Group by priority
  const critical = data.annotations.filter(a => a.priority === 'critical');
  const important = data.annotations.filter(a => a.priority === 'important');
  const informational = data.annotations.filter(a => a.priority === 'informational');

  return (
    <Card className="bg-dark-card border-gray-700 my-2">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-gray-100 text-sm">Extracted Annotations</span>
        </div>
        <div className="space-y-2">
          {/* Critical annotations first */}
          {critical.slice(0, 2).map((ann, idx) => (
            <div key={`critical-${idx}`} className="bg-red-950/30 border border-red-900 p-2 rounded">
              <div className="flex items-start gap-2">
                <div className={`${getPriorityColor(ann.priority)} p-1 rounded`}>
                  {getPriorityIcon(ann.priority)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-red-600 text-white text-xs">
                      {ann.type.toUpperCase()}
                    </Badge>
                    {ann.sheetNumber && (
                      <span className="text-xs text-gray-400">Sheet {ann.sheetNumber}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-100">{ann.text}</p>
                  {ann.requirements && ann.requirements.length > 0 && (
                    <div className="mt-1 text-xs text-red-200">
                      {ann.requirements.slice(0, 2).map((req, rIdx) => (
                        <div key={rIdx} className="flex items-start gap-1">
                          <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{req}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Important annotations */}
          {important.slice(0, 2).map((ann, idx) => (
            <div key={`important-${idx}`} className="bg-dark-surface border border-gray-700 p-2 rounded">
              <div className="flex items-start gap-2">
                <div className={`${getPriorityColor(ann.priority)} p-1 rounded`}>
                  {getPriorityIcon(ann.priority)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-orange-600 text-white text-xs">
                      {ann.type.toUpperCase()}
                    </Badge>
                    {ann.sheetNumber && (
                      <span className="text-xs text-gray-400">Sheet {ann.sheetNumber}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200">{ann.text}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Informational (only if no critical/important) */}
          {critical.length === 0 && important.length === 0 && informational.slice(0, 3).map((ann, idx) => (
            <div key={`info-${idx}`} className="bg-dark-surface border border-gray-700 p-2 rounded">
              <div className="flex items-start gap-2">
                <div className={`${getPriorityColor(ann.priority)} p-1 rounded`}>
                  {getPriorityIcon(ann.priority)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-blue-600 text-white text-xs">
                      {ann.type.toUpperCase()}
                    </Badge>
                    {ann.sheetNumber && (
                      <span className="text-xs text-gray-400">Sheet {ann.sheetNumber}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200">{ann.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {data.annotations.length > 4 && (
          <div className="text-xs text-gray-400 mt-2 text-center">
            +{data.annotations.length - 4} more annotations
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// DETAIL CALLOUT CARD
// ============================================================================

interface CalloutData {
  callouts: Array<{
    type: string;
    detailNumber: string;
    sheetReference?: string;
    description?: string;
    sheetNumber?: string;
    confidence: number;
  }>;
}

export function DetailCalloutCard({ data }: { data: CalloutData }) {
  if (!data.callouts || data.callouts.length === 0) return null;

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'detail': 'bg-blue-500',
      'section': 'bg-purple-500',
      'elevation': 'bg-green-500',
      'reference': 'bg-orange-500',
      'enlarged_plan': 'bg-cyan-500',
      'isometric': 'bg-pink-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getTypeName = (type: string) => {
    const names: Record<string, string> = {
      'detail': 'Detail',
      'section': 'Section',
      'elevation': 'Elevation',
      'reference': 'Reference',
      'enlarged_plan': 'Enlarged Plan',
      'isometric': 'Isometric'
    };
    return names[type] || type;
  };

  return (
    <Card className="bg-dark-card border-gray-700 my-2">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Navigation className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-gray-100 text-sm">Detail References</span>
        </div>
        <div className="space-y-2">
          {data.callouts.slice(0, 5).map((callout, idx) => (
            <div key={idx} className="bg-dark-surface border border-gray-700 p-2 rounded">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <Badge className={`${getTypeColor(callout.type)} text-white text-xs`}>
                    {getTypeName(callout.type)}
                  </Badge>
                  <span className="font-mono font-bold text-gray-100 text-sm">
                    {callout.detailNumber}
                  </span>
                  {callout.sheetReference && (
                    <>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs">
                        Sheet {callout.sheetReference}
                      </Badge>
                    </>
                  )}
                </div>
                <ExternalLink className="h-3 w-3 text-gray-400" />
              </div>
              {callout.description && (
                <p className="text-xs text-gray-400 mt-1">{callout.description}</p>
              )}
              {callout.sheetNumber && (
                <p className="text-xs text-gray-400 mt-1">From: Sheet {callout.sheetNumber}</p>
              )}
            </div>
          ))}
        </div>
        {data.callouts.length > 5 && (
          <div className="text-xs text-gray-400 mt-2 text-center">
            +{data.callouts.length - 5} more references
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// SYMBOL CARD
// ============================================================================

interface SymbolData {
  code: string;
  name: string;
  category: string;
  trade: string;
  standard?: string;
  alternativeCodes?: string[];
  description?: string;
  specReference?: string;
}

export function SymbolCard({ data }: { data: SymbolData }) {
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

  return (
    <Card className="bg-dark-card border-gray-700 my-2">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-gray-100 text-sm">Symbol Definition</span>
        </div>
        <div className="bg-dark-surface border border-gray-700 p-3 rounded">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={`${getTradeColor(data.trade)} text-white`}>
              {data.trade}
            </Badge>
            <span className="font-mono font-bold text-lg text-gray-100">
              {data.code}
            </span>
            {data.standard && (
              <Badge variant="outline" className="border-gray-600 text-gray-300 text-xs">
                {data.standard}
              </Badge>
            )}
          </div>
          <p className="text-gray-100 font-medium mb-2">{data.name}</p>
          {data.description && (
            <p className="text-sm text-gray-400 mb-2">{data.description}</p>
          )}
          {data.alternativeCodes && data.alternativeCodes.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              <span className="text-xs text-gray-400">Also:</span>
              {data.alternativeCodes.map((code, idx) => (
                <Badge key={idx} variant="outline" className="border-gray-600 text-gray-400 text-xs">
                  {code}
                </Badge>
              ))}
            </div>
          )}
          {data.specReference && (
            <div className="mt-2 text-xs text-blue-400">
              Spec: {data.specReference}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
