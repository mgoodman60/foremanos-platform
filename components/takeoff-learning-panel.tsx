'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Brain,
  MessageSquare,
  Edit3,
  Lightbulb,
  TrendingUp,
  CheckCircle,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Star,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  Check,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface LearningStats {
  totalFeedback: number;
  totalCorrections: number;
  approvedCorrections: number;
  pendingCorrections: number;
  averageRating: number;
  feedbackByType: Record<string, number>;
  correctionsByField: Record<string, number>;
  accuracyTrend: { date: string; accuracy: number }[];
  learnedPatterns: number;
  patternsByCategory: Record<string, number>;
}

interface CorrectionSuggestion {
  lineItemId: string;
  itemName: string;
  fieldName: string;
  currentValue: string;
  suggestedValue: string;
  confidence: number;
  reason: string;
  patternId?: string;
}

interface PendingCorrection {
  id: string;
  lineItemId: string;
  itemName: string;
  category: string;
  fieldName: string;
  originalValue: string;
  correctedValue: string;
  reason: string | null;
  submittedAt: string;
  submittedBy: string;
}

interface LearnedPattern {
  id: string;
  category: string;
  patternType: string;
  patternKey: string;
  patternValue: Record<string, unknown>;
  confidence: number;
  usageCount: number;
  source: string;
}

interface RecentFeedback {
  id: string;
  feedbackType: string;
  rating: number | null;
  comment: string | null;
  resolved: boolean;
  createdAt: string;
  submittedBy: string;
}

interface TakeoffLearningPanelProps {
  takeoffId: string;
  takeoffName: string;
  onClose: () => void;
  onRefresh?: () => void;
}

type TabType = 'overview' | 'corrections' | 'suggestions' | 'patterns' | 'feedback';

export default function TakeoffLearningPanel({
  takeoffId,
  takeoffName,
  onClose,
  onRefresh,
}: TakeoffLearningPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const trapRef = useFocusTrap({ isActive: true, onEscape: onClose });
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [corrections, setCorrections] = useState<PendingCorrection[]>([]);
  const [suggestions, setSuggestions] = useState<CorrectionSuggestion[]>([]);
  const [patterns, setPatterns] = useState<LearnedPattern[]>([]);
  const [feedback, setFeedback] = useState<RecentFeedback[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Feedback form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>('helpful');
  const [feedbackRating, setFeedbackRating] = useState<number>(4);
  const [feedbackComment, setFeedbackComment] = useState('');

  // Fetch data based on active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'overview': {
          const res = await fetch(`/api/takeoff/${takeoffId}/learning?action=summary`);
          const data = await res.json();
          setStats(data.stats);
          setSuggestions(data.suggestions?.slice(0, 5) || []);
          break;
        }
        case 'corrections': {
          const res = await fetch(`/api/takeoff/${takeoffId}/learning?action=corrections`);
          const data = await res.json();
          setCorrections(data.corrections || []);
          break;
        }
        case 'suggestions': {
          const res = await fetch(`/api/takeoff/${takeoffId}/learning?action=suggestions`);
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          break;
        }
        case 'patterns': {
          const res = await fetch(`/api/takeoff/${takeoffId}/learning?action=patterns`);
          const data = await res.json();
          setPatterns(data.patterns || []);
          break;
        }
        case 'feedback': {
          const res = await fetch(`/api/takeoff/${takeoffId}/learning?action=feedback&limit=50`);
          const data = await res.json();
          setFeedback(data.feedback || []);
          break;
        }
      }
    } catch (error) {
      console.error('Error fetching learning data:', error);
      toast.error('Failed to load learning data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, takeoffId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply a single correction
  const handleApplyCorrection = async (correctionId: string, createPattern: boolean = false) => {
    setProcessingId(correctionId);
    try {
      const res = await fetch(`/api/takeoff/${takeoffId}/learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply-correction', correctionId, createPattern }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Correction applied successfully');
        setCorrections(prev => prev.filter(c => c.id !== correctionId));
        onRefresh?.();
      } else {
        toast.error(data.error || 'Failed to apply correction');
      }
    } catch (error) {
      toast.error('Error applying correction');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject a correction
  const handleRejectCorrection = async (correctionId: string) => {
    setProcessingId(correctionId);
    try {
      const res = await fetch(`/api/takeoff/${takeoffId}/learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject-correction', correctionId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Correction rejected');
        setCorrections(prev => prev.filter(c => c.id !== correctionId));
      } else {
        toast.error(data.error || 'Failed to reject correction');
      }
    } catch (error) {
      toast.error('Error rejecting correction');
    } finally {
      setProcessingId(null);
    }
  };

  // Apply selected suggestions
  const handleApplySuggestions = async () => {
    if (selectedSuggestions.size === 0) {
      toast.error('No suggestions selected');
      return;
    }

    const toApply = suggestions
      .filter(s => selectedSuggestions.has(s.lineItemId))
      .map(s => ({ lineItemId: s.lineItemId, fieldName: s.fieldName, value: s.suggestedValue }));

    setProcessingId('bulk');
    try {
      const res = await fetch(`/api/takeoff/${takeoffId}/learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-apply-suggestions', suggestions: toApply }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Applied ${data.appliedCount} suggestions`);
        setSelectedSuggestions(new Set());
        onRefresh?.();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to apply suggestions');
      }
    } catch (error) {
      toast.error('Error applying suggestions');
    } finally {
      setProcessingId(null);
    }
  };

  // Delete a pattern
  const handleDeletePattern = async (patternId: string) => {
    setProcessingId(patternId);
    try {
      const res = await fetch(`/api/takeoff/${takeoffId}/learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-pattern', patternId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Pattern deleted');
        setPatterns(prev => prev.filter(p => p.id !== patternId));
      } else {
        toast.error(data.error || 'Failed to delete pattern');
      }
    } catch (error) {
      toast.error('Error deleting pattern');
    } finally {
      setProcessingId(null);
    }
  };

  // Submit feedback
  const handleSubmitFeedback = async () => {
    try {
      const res = await fetch(`/api/takeoff/${takeoffId}/learning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-feedback',
          feedbackType,
          rating: feedbackRating,
          comment: feedbackComment || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Feedback submitted');
        setShowFeedbackForm(false);
        setFeedbackComment('');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to submit feedback');
      }
    } catch (error) {
      toast.error('Error submitting feedback');
    }
  };

  // Toggle suggestion selection
  const toggleSuggestion = (lineItemId: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lineItemId)) {
        newSet.delete(lineItemId);
      } else {
        newSet.add(lineItemId);
      }
      return newSet;
    });
  };

  // Select all suggestions
  const selectAllSuggestions = () => {
    setSelectedSuggestions(new Set(suggestions.map(s => s.lineItemId)));
  };

  // Feedback type display
  const getFeedbackTypeDisplay = (type: string) => {
    const typeMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      accuracy: { label: 'Accuracy Issue', color: 'text-yellow-400', icon: <AlertTriangle className="w-4 h-4" /> },
      missing_item: { label: 'Missing Item', color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
      wrong_quantity: { label: 'Wrong Quantity', color: 'text-orange-400', icon: <Edit3 className="w-4 h-4" /> },
      wrong_unit: { label: 'Wrong Unit', color: 'text-orange-400', icon: <Edit3 className="w-4 h-4" /> },
      wrong_category: { label: 'Wrong Category', color: 'text-orange-400', icon: <Edit3 className="w-4 h-4" /> },
      helpful: { label: 'Helpful', color: 'text-green-400', icon: <ThumbsUp className="w-4 h-4" /> },
      unhelpful: { label: 'Unhelpful', color: 'text-red-400', icon: <ThumbsDown className="w-4 h-4" /> },
    };
    return typeMap[type] || { label: type, color: 'text-gray-400', icon: <MessageSquare className="w-4 h-4" /> };
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'corrections', label: 'Corrections', icon: <Edit3 className="w-4 h-4" /> },
    { id: 'suggestions', label: 'Suggestions', icon: <Lightbulb className="w-4 h-4" /> },
    { id: 'patterns', label: 'Patterns', icon: <Brain className="w-4 h-4" /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div ref={trapRef} role="dialog" aria-modal="true" aria-labelledby="learning-panel-title" className="bg-dark-active rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-dark-hover">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-hover">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 id="learning-panel-title" className="text-xl font-semibold text-white">Learning System</h2>
              <p className="text-sm text-gray-400">{takeoffName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFeedbackForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              <ThumbsUp className="w-4 h-4" />
              Give Feedback
            </button>
            <button
              onClick={fetchData}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-hover">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-dark-subtle rounded-lg p-4">
                      <div className="text-2xl font-bold text-white">{stats.totalFeedback}</div>
                      <div className="text-sm text-gray-400">Total Feedback</div>
                    </div>
                    <div className="bg-dark-subtle rounded-lg p-4">
                      <div className="text-2xl font-bold text-white">{stats.totalCorrections}</div>
                      <div className="text-sm text-gray-400">Corrections Made</div>
                    </div>
                    <div className="bg-dark-subtle rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-400">{stats.approvedCorrections}</div>
                      <div className="text-sm text-gray-400">Approved</div>
                    </div>
                    <div className="bg-dark-subtle rounded-lg p-4">
                      <div className="text-2xl font-bold text-yellow-400">{stats.pendingCorrections}</div>
                      <div className="text-sm text-gray-400">Pending Review</div>
                    </div>
                  </div>

                  {/* Rating & Patterns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-dark-subtle rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-3">Average Rating</h3>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-6 h-6 ${
                              star <= Math.round(stats.averageRating)
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-600'
                            }`}
                          />
                        ))}
                        <span className="text-white ml-2">{stats.averageRating.toFixed(1)}/5</span>
                      </div>
                    </div>
                    <div className="bg-dark-subtle rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-3">Learned Patterns</h3>
                      <div className="text-3xl font-bold text-purple-400">{stats.learnedPatterns}</div>
                      <p className="text-sm text-gray-400 mt-1">Patterns learned from corrections</p>
                    </div>
                  </div>

                  {/* Feedback Breakdown */}
                  {Object.keys(stats.feedbackByType).length > 0 && (
                    <div className="bg-dark-subtle rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-white mb-3">Feedback Breakdown</h3>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(stats.feedbackByType).map(([type, count]) => {
                          const display = getFeedbackTypeDisplay(type);
                          return (
                            <div key={type} className="flex items-center gap-2 bg-dark-active px-3 py-2 rounded-lg">
                              <span className={display.color}>{display.icon}</span>
                              <span className="text-white">{display.label}</span>
                              <span className="text-gray-400">({count})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top Suggestions Preview */}
                  {suggestions.length > 0 && (
                    <div className="bg-dark-subtle rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-white">AI Suggestions</h3>
                        <button
                          onClick={() => setActiveTab('suggestions')}
                          className="text-sm text-purple-400 hover:text-purple-300"
                        >
                          View all →
                        </button>
                      </div>
                      <div className="space-y-2">
                        {suggestions.slice(0, 3).map(s => (
                          <div key={s.lineItemId} className="flex items-center justify-between bg-dark-active p-3 rounded-lg">
                            <div>
                              <span className="text-white">{s.itemName}</span>
                              <span className="text-gray-400 text-sm ml-2">
                                {s.fieldName}: {s.currentValue} → {s.suggestedValue}
                              </span>
                            </div>
                            <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                              {(s.confidence * 100).toFixed(0)}% confident
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Corrections Tab */}
              {activeTab === 'corrections' && (
                <div className="space-y-4">
                  {corrections.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-gray-400">No pending corrections</p>
                    </div>
                  ) : (
                    corrections.map(correction => (
                      <div key={correction.id} className="bg-dark-subtle rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-medium">{correction.itemName}</span>
                              <span className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">
                                {correction.category}
                              </span>
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">Field:</span>
                                <span className="text-white">{correction.fieldName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">Change:</span>
                                <span className="text-red-400 line-through">{correction.originalValue}</span>
                                <span className="text-gray-500">→</span>
                                <span className="text-green-400">{correction.correctedValue}</span>
                              </div>
                              {correction.reason && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400">Reason:</span>
                                  <span className="text-gray-300">{correction.reason}</span>
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                Submitted by {correction.submittedBy} on{' '}
                                {new Date(correction.submittedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApplyCorrection(correction.id, true)}
                              disabled={processingId === correction.id}
                              className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                              Apply & Learn
                            </button>
                            <button
                              onClick={() => handleApplyCorrection(correction.id, false)}
                              disabled={processingId === correction.id}
                              className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                              Apply Only
                            </button>
                            <button
                              onClick={() => handleRejectCorrection(correction.id)}
                              disabled={processingId === correction.id}
                              className="flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Suggestions Tab */}
              {activeTab === 'suggestions' && (
                <div className="space-y-4">
                  {suggestions.length === 0 ? (
                    <div className="text-center py-12">
                      <Lightbulb className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
                      <p className="text-gray-400">No suggestions available</p>
                      <p className="text-sm text-gray-500 mt-1">Submit more corrections to train the learning system</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={selectAllSuggestions}
                            className="text-sm text-purple-400 hover:text-purple-300"
                          >
                            Select All
                          </button>
                          <span className="text-gray-500">|</span>
                          <span className="text-sm text-gray-400">
                            {selectedSuggestions.size} of {suggestions.length} selected
                          </span>
                        </div>
                        <button
                          onClick={handleApplySuggestions}
                          disabled={selectedSuggestions.size === 0 || processingId === 'bulk'}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm disabled:opacity-50"
                        >
                          <Zap className="w-4 h-4" />
                          Apply Selected ({selectedSuggestions.size})
                        </button>
                      </div>

                      {suggestions.map(suggestion => (
                        <div
                          key={suggestion.lineItemId}
                          className={`bg-dark-subtle rounded-lg p-4 border-2 transition-colors cursor-pointer ${
                            selectedSuggestions.has(suggestion.lineItemId)
                              ? 'border-purple-500'
                              : 'border-transparent hover:border-gray-600'
                          }`}
                          onClick={() => toggleSuggestion(suggestion.lineItemId)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                selectedSuggestions.has(suggestion.lineItemId)
                                  ? 'bg-purple-500'
                                  : 'bg-gray-700'
                              }`}>
                                {selectedSuggestions.has(suggestion.lineItemId) ? (
                                  <Check className="w-5 h-5 text-white" />
                                ) : (
                                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                                )}
                              </div>
                              <div>
                                <div className="text-white font-medium">{suggestion.itemName}</div>
                                <div className="text-sm mt-1">
                                  <span className="text-gray-400">{suggestion.fieldName}:</span>{' '}
                                  <span className="text-red-400">{suggestion.currentValue}</span>{' '}
                                  <span className="text-gray-500">→</span>{' '}
                                  <span className="text-green-400">{suggestion.suggestedValue}</span>
                                </div>
                                <p className="text-sm text-gray-400 mt-1">{suggestion.reason}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-medium ${
                                suggestion.confidence >= 0.8 ? 'text-green-400' :
                                suggestion.confidence >= 0.6 ? 'text-yellow-400' : 'text-orange-400'
                              }`}>
                                {(suggestion.confidence * 100).toFixed(0)}%
                              </span>
                              <div className="text-xs text-gray-500">confidence</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Patterns Tab */}
              {activeTab === 'patterns' && (
                <div className="space-y-4">
                  {patterns.length === 0 ? (
                    <div className="text-center py-12">
                      <Brain className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                      <p className="text-gray-400">No learned patterns yet</p>
                      <p className="text-sm text-gray-500 mt-1">Patterns are created when corrections are applied</p>
                    </div>
                  ) : (
                    patterns.map(pattern => (
                      <div key={pattern.id} className="bg-dark-subtle rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-medium capitalize">
                                {pattern.patternType.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                                {pattern.category}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setExpandedPatterns(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(pattern.id)) {
                                    newSet.delete(pattern.id);
                                  } else {
                                    newSet.add(pattern.id);
                                  }
                                  return newSet;
                                });
                              }}
                              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300"
                            >
                              {expandedPatterns.has(pattern.id) ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                              <span>Key: {pattern.patternKey}</span>
                            </button>
                            {expandedPatterns.has(pattern.id) && (
                              <div className="mt-2 text-sm bg-dark-active p-3 rounded">
                                <pre className="text-gray-300 overflow-x-auto">
                                  {JSON.stringify(pattern.patternValue, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm text-white">{(pattern.confidence * 100).toFixed(0)}%</div>
                              <div className="text-xs text-gray-500">confidence</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-white">{pattern.usageCount}</div>
                              <div className="text-xs text-gray-500">uses</div>
                            </div>
                            <button
                              onClick={() => handleDeletePattern(pattern.id)}
                              disabled={processingId === pattern.id}
                              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Feedback Tab */}
              {activeTab === 'feedback' && (
                <div className="space-y-4">
                  {feedback.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                      <p className="text-gray-400">No feedback yet</p>
                      <button
                        onClick={() => setShowFeedbackForm(true)}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                      >
                        Submit First Feedback
                      </button>
                    </div>
                  ) : (
                    feedback.map(fb => {
                      const display = getFeedbackTypeDisplay(fb.feedbackType);
                      return (
                        <div key={fb.id} className="bg-dark-subtle rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${display.color} bg-opacity-20`}>
                                {display.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${display.color}`}>{display.label}</span>
                                  {fb.rating && (
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map(star => (
                                        <Star
                                          key={star}
                                          className={`w-3 h-3 ${
                                            star <= fb.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                                {fb.comment && (
                                  <p className="text-gray-300 mt-1">{fb.comment}</p>
                                )}
                                <div className="text-xs text-gray-500 mt-2">
                                  By {fb.submittedBy} • {new Date(fb.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div>
                              {fb.resolved ? (
                                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                                  Resolved
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                                  Open
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Feedback Form Modal */}
        {showFeedbackForm && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
            <div className="bg-dark-subtle rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-white mb-4">Submit Feedback</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Feedback Type</label>
                  <select
                    value={feedbackType}
                    onChange={e => setFeedbackType(e.target.value)}
                    className="w-full bg-dark-active border border-dark-hover rounded-lg px-3 py-2 text-white"
                  >
                    <option value="helpful">Helpful - Takeoff was accurate</option>
                    <option value="unhelpful">Unhelpful - Takeoff was not useful</option>
                    <option value="accuracy">Accuracy Issue - General accuracy problem</option>
                    <option value="missing_item">Missing Item - Expected item not included</option>
                    <option value="wrong_quantity">Wrong Quantity - Quantity is incorrect</option>
                    <option value="wrong_unit">Wrong Unit - Unit of measure is wrong</option>
                    <option value="wrong_category">Wrong Category - Item miscategorized</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Rating</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`w-8 h-8 ${
                            star <= feedbackRating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Comment (optional)</label>
                  <textarea
                    value={feedbackComment}
                    onChange={e => setFeedbackComment(e.target.value)}
                    placeholder="Share specific details about your experience..."
                    className="w-full bg-dark-active border border-dark-hover rounded-lg px-3 py-2 text-white h-24 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowFeedbackForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitFeedback}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Submit Feedback
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
