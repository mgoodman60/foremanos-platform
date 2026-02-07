"use client";

import React, { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, 
  RefreshCw, DollarSign, Target, ChevronDown, ChevronUp,
  FileSearch, Lightbulb, ArrowRight, Gauge
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ScopeGap {
  id: string;
  category: 'missing_scope' | 'partial_coverage' | 'ambiguous' | 'exclusion_risk';
  severity: 'high' | 'medium' | 'low';
  description: string;
  projectRequirement: string;
  quoteReference?: string;
  estimatedCostImpact?: number;
  recommendation: string;
  tradeType?: string;
}

interface ScopeGapAnalysisResult {
  projectId: string;
  tradeType?: string;
  analysisDate: string;
  overallCoverageScore: number;
  gaps: ScopeGap[];
  coveredItems: string[];
  recommendations: string[];
  totalEstimatedGapCost: number;
  confidence: number;
}

const TRADE_LABELS: Record<string, string> = {
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  hvac_mechanical: 'HVAC/Mechanical',
  concrete_masonry: 'Concrete/Masonry',
  carpentry_framing: 'Carpentry/Framing',
  drywall_finishes: 'Drywall/Finishes',
  painting_coating: 'Painting',
  roofing: 'Roofing',
  structural_steel: 'Structural Steel',
  glazing_windows: 'Glazing/Windows',
  flooring: 'Flooring',
  site_utilities: 'Site/Utilities',
  general_contractor: 'General',
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  missing_scope: { 
    label: 'Missing Scope', 
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Required work not included in any quote'
  },
  partial_coverage: { 
    label: 'Partial Coverage', 
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: <AlertCircle className="h-4 w-4" />,
    description: 'Work mentioned but not fully covered'
  },
  ambiguous: { 
    label: 'Ambiguous', 
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Info className="h-4 w-4" />,
    description: 'Unclear whether scope is included'
  },
  exclusion_risk: { 
    label: 'Exclusion Risk', 
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Explicitly excluded - may cause change orders'
  },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'High', color: 'bg-red-600 text-white' },
  medium: { label: 'Medium', color: 'bg-yellow-600 text-white' },
  low: { label: 'Low', color: 'bg-blue-600 text-white' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCoverageScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getCoverageScoreBackground(score: number): string {
  if (score >= 80) return 'from-green-600 to-green-800';
  if (score >= 60) return 'from-yellow-600 to-yellow-800';
  if (score >= 40) return 'from-orange-600 to-orange-800';
  return 'from-red-600 to-red-800';
}

interface Props {
  selectedTrade?: string;
  selectedQuoteIds?: string[];
}

export default function ScopeGapAnalysis({ selectedTrade, selectedQuoteIds }: Props) {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [analysis, setAnalysis] = useState<ScopeGapAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const [showCovered, setShowCovered] = useState(false);
  const [tradeFilter, setTradeFilter] = useState<string>(selectedTrade || 'all');

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${slug}/quotes/scope-gaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeType: tradeFilter !== 'all' ? tradeFilter : undefined,
          quoteIds: selectedQuoteIds,
        }),
      });

      if (!res.ok) throw new Error('Analysis failed');
      
      const result = await res.json();
      setAnalysis(result);
      
      if (result.gaps.length > 0) {
        toast.warning(`Found ${result.gaps.length} scope gap(s)`);
      } else {
        toast.success('No significant gaps found');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('Failed to run scope gap analysis');
    } finally {
      setLoading(false);
    }
  }, [slug, tradeFilter, selectedQuoteIds]);

  const toggleGap = (gapId: string) => {
    setExpandedGaps(prev => {
      const next = new Set(prev);
      if (next.has(gapId)) {
        next.delete(gapId);
      } else {
        next.add(gapId);
      }
      return next;
    });
  };

  const gapsByCategory = analysis?.gaps.reduce((acc, gap) => {
    acc[gap.category] = (acc[gap.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const gapsBySeverity = analysis?.gaps.reduce((acc, gap) => {
    acc[gap.severity] = (acc[gap.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-dark-card to-dark-surface rounded-lg p-6 border border-gray-700">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <FileSearch className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Scope Gap Analysis</h2>
                <p className="text-gray-400 text-sm mt-1">
                  AI-powered comparison of quotes vs. project requirements
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="bg-dark-surface border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="all">All Trades</option>
              {Object.entries(TRADE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            
            <Button
              onClick={runAnalysis}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Target className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </div>
        </div>
      </div>

      {/* No Analysis Yet */}
      {!analysis && !loading && (
        <div className="bg-dark-card rounded-lg p-8 text-center border border-gray-700">
          <FileSearch className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No analysis run yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Click "Run Analysis" to compare quotes against project requirements
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-dark-card rounded-lg p-8 text-center border border-gray-700">
          <RefreshCw className="h-12 w-12 text-amber-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Analyzing scope coverage...</p>
          <p className="text-sm text-gray-500 mt-1">
            Comparing quotes against schedule, budget, and specifications
          </p>
        </div>
      )}

      {/* Analysis Results */}
      {analysis && !loading && (
        <>
          {/* Coverage Score Card */}
          <div className="bg-dark-card rounded-lg border border-gray-700 overflow-hidden">
            <div className={`bg-gradient-to-r ${getCoverageScoreBackground(analysis.overallCoverageScore)} p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Gauge className="h-16 w-16 text-white/80" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-white">
                        {analysis.overallCoverageScore}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Scope Coverage Score</h3>
                    <p className="text-white/70 text-sm">
                      {analysis.overallCoverageScore >= 80 ? 'Good coverage - minor gaps to address' :
                       analysis.overallCoverageScore >= 60 ? 'Moderate coverage - review recommended' :
                       analysis.overallCoverageScore >= 40 ? 'Significant gaps detected' :
                       'Poor coverage - major gaps require attention'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white/60 text-sm">Confidence</div>
                  <div className="text-white font-semibold">{analysis.confidence}%</div>
                </div>
              </div>
            </div>
            
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-dark-surface">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{analysis.gaps.length}</div>
                <div className="text-xs text-gray-400">Total Gaps</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{gapsBySeverity.high || 0}</div>
                <div className="text-xs text-gray-400">High Priority</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{analysis.coveredItems.length}</div>
                <div className="text-xs text-gray-400">Items Covered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-400">
                  {analysis.totalEstimatedGapCost > 0 ? formatCurrency(analysis.totalEstimatedGapCost) : '--'}
                </div>
                <div className="text-xs text-gray-400">Est. Gap Cost</div>
              </div>
            </div>
          </div>

          {/* Gap Categories Summary */}
          {Object.keys(gapsByCategory).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const count = gapsByCategory[key] || 0;
                if (count === 0) return null;
                return (
                  <div key={key} className={`rounded-lg p-3 border ${config.color}`}>
                    <div className="flex items-center gap-2">
                      {config.icon}
                      <span className="font-medium">{config.label}</span>
                    </div>
                    <div className="text-2xl font-bold mt-1">{count}</div>
                    <div className="text-xs opacity-70">{config.description}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Gaps List */}
          {analysis.gaps.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Identified Gaps ({analysis.gaps.length})
              </h3>
              
              {analysis.gaps.map((gap) => {
                const categoryConfig = CATEGORY_CONFIG[gap.category];
                const severityConfig = SEVERITY_CONFIG[gap.severity];
                const isExpanded = expandedGaps.has(gap.id);
                
                return (
                  <div
                    key={gap.id}
                    className={`bg-dark-card rounded-lg border ${categoryConfig.color} overflow-hidden`}
                  >
                    {/* Gap Header */}
                    <button
                      onClick={() => toggleGap(gap.id)}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleGap(gap.id);
                        }
                      }}
                      className="w-full p-4 flex items-start justify-between text-left hover:bg-dark-surface transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{categoryConfig.icon}</div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityConfig.color}`}>
                              {severityConfig.label}
                            </span>
                            <span className="text-white font-medium">{gap.description}</span>
                          </div>
                          {gap.projectRequirement && (
                            <p className="text-sm text-gray-400 mt-1">
                              Requirement: {gap.projectRequirement}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {gap.estimatedCostImpact && gap.estimatedCostImpact > 0 && (
                          <span className="text-amber-400 text-sm font-medium flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(gap.estimatedCostImpact)}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </button>
                    
                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-700/50">
                        {gap.quoteReference && (
                          <div className="mt-3">
                            <div className="text-xs text-gray-500 uppercase tracking-wide">Quote Reference</div>
                            <div className="text-gray-300 text-sm mt-1">{gap.quoteReference}</div>
                          </div>
                        )}
                        
                        <div className="bg-dark-surface rounded-lg p-3">
                          <div className="flex items-center gap-2 text-green-400 mb-2">
                            <Lightbulb className="h-4 w-4" />
                            <span className="text-sm font-medium">Recommendation</span>
                          </div>
                          <p className="text-gray-300 text-sm">{gap.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Covered Items (Collapsible) */}
          {analysis.coveredItems.length > 0 && (
            <div className="bg-dark-card rounded-lg border border-gray-700">
              <button
                onClick={() => setShowCovered(!showCovered)}
                aria-expanded={showCovered}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowCovered(!showCovered);
                  }
                }}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-dark-surface transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <span className="text-white font-medium">
                    Covered Items ({analysis.coveredItems.length})
                  </span>
                </div>
                {showCovered ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </button>
              
              {showCovered && (
                <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {analysis.coveredItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Overall Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="bg-dark-card rounded-lg p-4 border border-blue-500/30">
              <h3 className="text-blue-400 font-medium flex items-center gap-2 mb-3">
                <Lightbulb className="h-5 w-5" />
                Overall Recommendations
              </h3>
              <ul className="space-y-2">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                    <ArrowRight className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Analysis Meta */}
          <div className="text-center text-xs text-gray-500">
            Analysis performed on {new Date(analysis.analysisDate).toLocaleString()}
            {analysis.tradeType && ` • Trade: ${TRADE_LABELS[analysis.tradeType] || analysis.tradeType}`}
          </div>
        </>
      )}
    </div>
  );
}
