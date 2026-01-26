'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Target,
  Zap,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface QAMetrics {
  totalItems: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  lowConfidenceCount: number;
  averageConfidence: number;
  accuracyRate: number;
  verificationRate: number;
}

interface QAIssue {
  itemId: string;
  itemName: string;
  category: string;
  issueType: 'low_confidence' | 'outlier' | 'missing_unit' | 'duplicate_suspect' | 'calculation_error';
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestedAction: string;
  confidence: number;
}

interface TakeoffQADashboardProps {
  isOpen: boolean;
  onClose: () => void;
  takeoffId: string;
  takeoffName: string;
  onRefresh?: () => void;
}

export function TakeoffQADashboard({
  isOpen,
  onClose,
  takeoffId,
  takeoffName,
  onRefresh
}: TakeoffQADashboardProps) {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<QAMetrics | null>(null);
  const [issues, setIssues] = useState<QAIssue[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'verification'>('overview');
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [bulkThreshold, setBulkThreshold] = useState<string>('85');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && takeoffId) {
      fetchQAData();
    }
  }, [isOpen, takeoffId]);

  const fetchQAData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/takeoff/${takeoffId}/qa?action=full`);
      if (!response.ok) throw new Error('Failed to fetch QA data');
      
      const data = await response.json();
      setMetrics(data.metrics);
      setIssues(data.issues || []);
    } catch (error) {
      console.error('Error fetching QA data:', error);
      toast.error('Failed to load QA data');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    try {
      setProcessing(true);
      const response = await fetch(`/api/takeoff/${takeoffId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          confidenceThreshold: parseInt(bulkThreshold)
        })
      });

      if (!response.ok) throw new Error('Failed to bulk approve');
      
      const data = await response.json();
      toast.success(`Auto-approved ${data.result.approvedCount} items`);
      fetchQAData();
      onRefresh?.();
    } catch (error) {
      console.error('Error in bulk approve:', error);
      toast.error('Failed to bulk approve items');
    } finally {
      setProcessing(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setProcessing(true);
      const response = await fetch(`/api/takeoff/${takeoffId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate' })
      });

      if (!response.ok) throw new Error('Failed to recalculate');
      
      const data = await response.json();
      toast.success(
        `Recalculated ${data.result.updated} items. ` +
        `Average: ${data.result.averageBefore}% → ${data.result.averageAfter}%`
      );
      fetchQAData();
    } catch (error) {
      console.error('Error recalculating:', error);
      toast.error('Failed to recalculate confidence scores');
    } finally {
      setProcessing(false);
    }
  };

  const handleVerifyItem = async (itemId: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/takeoff/${takeoffId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          itemId,
          approved
        })
      });

      if (!response.ok) throw new Error('Failed to verify');
      
      toast.success(approved ? 'Item approved' : 'Item rejected');
      fetchQAData();
      onRefresh?.();
    } catch (error) {
      console.error('Error verifying:', error);
      toast.error('Failed to verify item');
    }
  };

  const toggleIssue = (itemId: string) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedIssues(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getIssueTypeIcon = (type: string) => {
    switch (type) {
      case 'low_confidence': return <Target className="h-4 w-4" />;
      case 'outlier': return <TrendingUp className="h-4 w-4" />;
      case 'missing_unit': return <AlertTriangle className="h-4 w-4" />;
      case 'duplicate_suspect': return <BarChart3 className="h-4 w-4" />;
      case 'calculation_error': return <XCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-green-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-4xl bg-[#1F2328] rounded-lg shadow-xl border border-gray-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Quality Assurance</h2>
              <p className="text-sm text-gray-400">{takeoffName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {(['overview', 'issues', 'verification'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'issues' && `Issues (${issues.length})`}
              {tab === 'verification' && 'Verification'}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && metrics && (
                <div className="space-y-6">
                  {/* Main Metrics */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[#2d333b] rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-white">{metrics.totalItems}</div>
                      <div className="text-sm text-gray-400">Total Items</div>
                    </div>
                    <div className="bg-[#2d333b] rounded-lg p-4 text-center">
                      <div className={`text-3xl font-bold ${getConfidenceColor(metrics.averageConfidence)}`}>
                        {metrics.averageConfidence}%
                      </div>
                      <div className="text-sm text-gray-400">Avg Confidence</div>
                    </div>
                    <div className="bg-[#2d333b] rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-green-400">{metrics.verifiedCount}</div>
                      <div className="text-sm text-gray-400">Verified</div>
                    </div>
                    <div className="bg-[#2d333b] rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-yellow-400">{metrics.pendingCount}</div>
                      <div className="text-sm text-gray-400">Pending Review</div>
                    </div>
                  </div>

                  {/* Status Breakdown */}
                  <div className="bg-[#2d333b] rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-300 mb-4">Verification Status</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          <span className="text-gray-300">Verified / Auto-approved</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{metrics.verifiedCount}</span>
                          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 rounded-full" 
                              style={{ width: `${(metrics.verifiedCount / metrics.totalItems) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-400" />
                          <span className="text-gray-300">Needs Review</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{metrics.pendingCount}</span>
                          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-yellow-500 rounded-full" 
                              style={{ width: `${(metrics.pendingCount / metrics.totalItems) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-400" />
                          <span className="text-gray-300">Rejected</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{metrics.rejectedCount}</span>
                          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-red-500 rounded-full" 
                              style={{ width: `${(metrics.rejectedCount / metrics.totalItems) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-400" />
                          <span className="text-gray-300">Low Confidence</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{metrics.lowConfidenceCount}</span>
                          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-orange-500 rounded-full" 
                              style={{ width: `${(metrics.lowConfidenceCount / metrics.totalItems) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#2d333b] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-medium text-gray-300">Accuracy Rate</span>
                      </div>
                      <div className="text-2xl font-bold text-emerald-400">{metrics.accuracyRate}%</div>
                      <p className="text-xs text-gray-500 mt-1">Items verified as correct</p>
                    </div>
                    <div className="bg-[#2d333b] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-gray-300">Verification Rate</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-400">{metrics.verificationRate}%</div>
                      <p className="text-xs text-gray-500 mt-1">Items reviewed (approved + rejected)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Issues Tab */}
              {activeTab === 'issues' && (
                <div className="space-y-4">
                  {issues.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-white">No Issues Found</h3>
                      <p className="text-gray-400">All items pass quality checks</p>
                    </div>
                  ) : (
                    <>
                      {/* Issue Summary */}
                      <div className="flex gap-2 mb-4">
                        <Badge variant="outline" className={getSeverityColor('high')}>
                          {issues.filter(i => i.severity === 'high').length} High
                        </Badge>
                        <Badge variant="outline" className={getSeverityColor('medium')}>
                          {issues.filter(i => i.severity === 'medium').length} Medium
                        </Badge>
                        <Badge variant="outline" className={getSeverityColor('low')}>
                          {issues.filter(i => i.severity === 'low').length} Low
                        </Badge>
                      </div>

                      {/* Issue List */}
                      <div className="space-y-2">
                        {issues.map((issue) => (
                          <div 
                            key={`${issue.itemId}-${issue.issueType}`}
                            className="bg-[#2d333b] rounded-lg overflow-hidden"
                          >
                            <button
                              onClick={() => toggleIssue(issue.itemId)}
                              className="w-full flex items-center justify-between p-3 hover:bg-[#373e47] transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {expandedIssues.has(issue.itemId) ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                                <div className={`p-1.5 rounded ${getSeverityColor(issue.severity)}`}>
                                  {getIssueTypeIcon(issue.issueType)}
                                </div>
                                <div className="text-left">
                                  <div className="text-white font-medium">{issue.itemName}</div>
                                  <div className="text-xs text-gray-400">{issue.category}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={getSeverityColor(issue.severity)}>
                                  {issue.severity}
                                </Badge>
                                <span className={`text-sm font-medium ${getConfidenceColor(issue.confidence)}`}>
                                  {Math.round(issue.confidence)}%
                                </span>
                              </div>
                            </button>

                            {expandedIssues.has(issue.itemId) && (
                              <div className="px-4 pb-4 pt-2 border-t border-gray-700">
                                <div className="space-y-3">
                                  <div>
                                    <div className="text-xs text-gray-500 uppercase">Issue</div>
                                    <div className="text-gray-300">{issue.description}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 uppercase">Suggested Action</div>
                                    <div className="text-gray-300">{issue.suggestedAction}</div>
                                  </div>
                                  <div className="flex gap-2 pt-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleVerifyItem(issue.itemId, true)}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleVerifyItem(issue.itemId, false)}
                                      className="border-red-600 text-red-400 hover:bg-red-600/20"
                                    >
                                      <XCircle className="mr-1 h-3 w-3" />
                                      Reject
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Verification Tab */}
              {activeTab === 'verification' && (
                <div className="space-y-6">
                  {/* Bulk Auto-Approve */}
                  <div className="bg-[#2d333b] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-5 w-5 text-purple-400" />
                      <h3 className="font-medium text-white">Bulk Auto-Approve</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      Automatically approve all items with confidence above the threshold.
                    </p>
                    <div className="flex items-center gap-3">
                      <Select value={bulkThreshold} onValueChange={setBulkThreshold}>
                        <SelectTrigger className="w-40 bg-[#1F2328] border-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="95">95% confidence</SelectItem>
                          <SelectItem value="90">90% confidence</SelectItem>
                          <SelectItem value="85">85% confidence</SelectItem>
                          <SelectItem value="80">80% confidence</SelectItem>
                          <SelectItem value="75">75% confidence</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleBulkApprove}
                        disabled={processing}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        {processing ? (
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Zap className="mr-2 h-4 w-4" />
                        )}
                        Auto-Approve
                      </Button>
                    </div>
                  </div>

                  {/* Recalculate Confidence */}
                  <div className="bg-[#2d333b] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <RefreshCw className="h-5 w-5 text-blue-400" />
                      <h3 className="font-medium text-white">Recalculate Confidence</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      Re-analyze all items and update confidence scores based on latest algorithms.
                    </p>
                    <Button
                      onClick={handleRecalculate}
                      disabled={processing}
                      variant="outline"
                      className="border-blue-600 text-blue-400 hover:bg-blue-600/20"
                    >
                      {processing ? (
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Recalculate Scores
                    </Button>
                  </div>

                  {/* Verification Tips */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="font-medium text-blue-400 mb-2">Verification Tips</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Items with 85%+ confidence are typically safe to auto-approve</li>
                      <li>• Review outliers (unusual quantities) manually for data entry errors</li>
                      <li>• Low confidence items often need source document verification</li>
                      <li>• Rejected items are excluded from budget calculations</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchQAData}
            disabled={loading}
            className="text-gray-400"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={onClose} className="border-gray-600">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
