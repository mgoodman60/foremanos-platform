"use client";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Calculator,
  Scale,
  Layers,
  Lightbulb,
} from 'lucide-react';

interface ConfidenceFactor {
  name: string;
  score: number;
  reason: string;
}

interface ConfidenceBreakdown {
  factors: ConfidenceFactor[];
  totalScore: number;
  warnings: string[];
  suggestions: string[];
}

interface TakeoffSource {
  type: 'plan' | 'schedule' | 'specification' | 'detail';
  documentId: string;
  documentName: string;
  pageNumber?: number;
  sheetNumber?: string;
  extractedValue: string;
}

interface TakeoffItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  confidence: number;
  verificationStatus: 'auto_approved' | 'needs_review' | 'low_confidence' | 'rejected';
  confidenceBreakdown?: ConfidenceBreakdown;
  sources?: TakeoffSource[];
  calculationMethod?: string;
  scaleUsed?: string;
}

interface TakeoffConfidencePanelProps {
  item: TakeoffItem;
  onVerify?: (itemId: string, verified: boolean, adjustedQuantity?: number) => void;
}

export function TakeoffConfidencePanel({ item, onVerify }: TakeoffConfidencePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'auto_approved':
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Auto-Approved
          </Badge>
        );
      case 'needs_review':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Needs Review
          </Badge>
        );
      case 'low_confidence':
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Low Confidence
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getFactorIcon = (factorName: string) => {
    if (factorName.includes('Dimension')) return <Scale className="w-4 h-4" />;
    if (factorName.includes('Schedule')) return <FileText className="w-4 h-4" />;
    if (factorName.includes('Calculation')) return <Calculator className="w-4 h-4" />;
    if (factorName.includes('Cross-Sheet')) return <Layers className="w-4 h-4" />;
    return <CheckCircle2 className="w-4 h-4" />;
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* Compact Confidence Indicator */}
        <div className="flex items-center gap-3">
          {getStatusBadge(item.verificationStatus)}
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowDetailModal(true)}>
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getConfidenceColor(item.confidence)} transition-all`}
                    style={{ width: `${item.confidence}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-300">
                  {item.confidence}%
                </span>
                <Info className="w-4 h-4 text-gray-500 hover:text-gray-300" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to see confidence breakdown</p>
            </TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-white"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Expanded View */}
        {expanded && item.confidenceBreakdown && (
          <Card className="bg-gray-800/50 border-gray-700 p-4 space-y-4">
            {/* Factors */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Confidence Factors</h4>
              <div className="space-y-2">
                {item.confidenceBreakdown.factors.map((factor, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {getFactorIcon(factor.name)}
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-300">{factor.name}</span>
                        <span className="text-sm text-green-400">+{factor.score}</span>
                      </div>
                      <span className="text-xs text-gray-500">{factor.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {item.confidenceBreakdown.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings
                </h4>
                <ul className="space-y-1">
                  {item.confidenceBreakdown.warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-yellow-400/80">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {item.confidenceBreakdown.suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Suggestions
                </h4>
                <ul className="space-y-1">
                  {item.confidenceBreakdown.suggestions.map((suggestion, idx) => (
                    <li key={idx} className="text-sm text-blue-400/80">
                      • {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sources */}
            {item.sources && item.sources.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Sources</h4>
                <div className="flex flex-wrap gap-2">
                  {item.sources.map((source, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {source.sheetNumber || source.documentName} - {source.type}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Calculation Method */}
            {item.calculationMethod && (
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-1">Calculation</h4>
                <code className="text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded">
                  {item.calculationMethod}
                </code>
              </div>
            )}

            {/* Actions */}
            {onVerify && item.verificationStatus !== 'auto_approved' && (
              <div className="flex gap-2 pt-2 border-t border-gray-700">
                <Button
                  size="sm"
                  onClick={() => onVerify(item.id, true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onVerify(item.id, false)}
                  className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Detail Modal */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">
                Confidence Analysis: {item.itemName}
              </DialogTitle>
              <DialogDescription>
                Detailed breakdown of how the confidence score was calculated
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Overall Score */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gray-800 mb-2">
                  <span className={`text-3xl font-bold ${
                    item.confidence >= 90 ? 'text-green-400' :
                    item.confidence >= 70 ? 'text-yellow-400' :
                    item.confidence >= 50 ? 'text-orange-400' : 'text-red-400'
                  }`}>
                    {item.confidence}%
                  </span>
                </div>
                <p className="text-gray-400">Overall Confidence Score</p>
                {getStatusBadge(item.verificationStatus)}
              </div>

              {/* Quantity Info */}
              <Card className="bg-gray-800/50 border-gray-700 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Extracted Quantity</p>
                    <p className="text-xl font-semibold text-white">
                      {item.quantity.toLocaleString()} {item.unit}
                    </p>
                  </div>
                  {item.scaleUsed && (
                    <div>
                      <p className="text-sm text-gray-500">Scale Used</p>
                      <p className="text-lg text-gray-300">{item.scaleUsed}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Factor Breakdown */}
              {item.confidenceBreakdown && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Score Breakdown</h3>
                  <div className="space-y-3">
                    {item.confidenceBreakdown.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          {getFactorIcon(factor.name)}
                          <div>
                            <p className="text-sm font-medium text-white">{factor.name}</p>
                            <p className="text-xs text-gray-400">{factor.reason}</p>
                          </div>
                        </div>
                        <Badge className="bg-green-500/20 text-green-400">
                          +{factor.score}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings & Suggestions */}
              {item.confidenceBreakdown && (
                <div className="grid grid-cols-2 gap-4">
                  {item.confidenceBreakdown.warnings.length > 0 && (
                    <Card className="bg-yellow-500/10 border-yellow-500/30 p-4">
                      <h4 className="text-sm font-semibold text-yellow-400 mb-2">
                        ⚠️ Warnings
                      </h4>
                      <ul className="space-y-1">
                        {item.confidenceBreakdown.warnings.map((w, idx) => (
                          <li key={idx} className="text-sm text-yellow-400/80">• {w}</li>
                        ))}
                      </ul>
                    </Card>
                  )}
                  {item.confidenceBreakdown.suggestions.length > 0 && (
                    <Card className="bg-blue-500/10 border-blue-500/30 p-4">
                      <h4 className="text-sm font-semibold text-blue-400 mb-2">
                        💡 Suggestions
                      </h4>
                      <ul className="space-y-1">
                        {item.confidenceBreakdown.suggestions.map((s, idx) => (
                          <li key={idx} className="text-sm text-blue-400/80">• {s}</li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              )}

              {/* Actions */}
              {onVerify && item.verificationStatus !== 'auto_approved' && (
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
                  <Button
                    variant="outline"
                    onClick={() => setShowDetailModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      onVerify(item.id, true);
                      setShowDetailModal(false);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Verify & Approve
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

/**
 * Summary card showing overall confidence statistics
 */
interface ConfidenceSummaryProps {
  stats: {
    total: number;
    byStatus: {
      auto_approved: number;
      needs_review: number;
      low_confidence: number;
      rejected: number;
    };
    averageConfidence: number;
    confidenceDistribution: {
      high: number;
      medium: number;
      low: number;
      veryLow: number;
    };
  };
}

export function TakeoffConfidenceSummary({ stats }: ConfidenceSummaryProps) {
  return (
    <Card className="bg-gray-800/50 border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Confidence Overview</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{stats.byStatus.auto_approved}</div>
          <div className="text-xs text-gray-400">Auto-Approved</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{stats.byStatus.needs_review}</div>
          <div className="text-xs text-gray-400">Needs Review</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-400">{stats.byStatus.low_confidence}</div>
          <div className="text-xs text-gray-400">Low Confidence</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">{stats.byStatus.rejected}</div>
          <div className="text-xs text-gray-400">Rejected</div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Average Confidence</span>
            <span className="text-white font-medium">{stats.averageConfidence}%</span>
          </div>
          <Progress value={stats.averageConfidence} className="h-2" />
        </div>

        <div className="flex gap-1 h-8">
          <div
            className="bg-green-500 rounded-l"
            style={{ width: `${(stats.confidenceDistribution.high / stats.total) * 100}%` }}
            title={`High (90%+): ${stats.confidenceDistribution.high}`}
          />
          <div
            className="bg-yellow-500"
            style={{ width: `${(stats.confidenceDistribution.medium / stats.total) * 100}%` }}
            title={`Medium (70-89%): ${stats.confidenceDistribution.medium}`}
          />
          <div
            className="bg-orange-500"
            style={{ width: `${(stats.confidenceDistribution.low / stats.total) * 100}%` }}
            title={`Low (50-69%): ${stats.confidenceDistribution.low}`}
          />
          <div
            className="bg-red-500 rounded-r"
            style={{ width: `${(stats.confidenceDistribution.veryLow / stats.total) * 100}%` }}
            title={`Very Low (<50%): ${stats.confidenceDistribution.veryLow}`}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>High ({stats.confidenceDistribution.high})</span>
          <span>Medium ({stats.confidenceDistribution.medium})</span>
          <span>Low ({stats.confidenceDistribution.low})</span>
          <span>Very Low ({stats.confidenceDistribution.veryLow})</span>
        </div>
      </div>
    </Card>
  );
}
