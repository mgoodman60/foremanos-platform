'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
type DocumentCategory = string;
import { getAllCategories, getCategoryLabel, getCategoryDescription } from '@/lib/document-categorizer';

interface DocumentCategoryModalProps {
  isOpen: boolean;
  fileName: string;
  fileType: string;
  onConfirm: (category: DocumentCategory) => void;
  onCancel: () => void;
}

export function DocumentCategoryModal({
  isOpen,
  fileName,
  fileType,
  onConfirm,
  onCancel,
}: DocumentCategoryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('other');
  const [loading, setLoading] = useState(true);
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: DocumentCategory;
    confidence: number;
    reasoning: string;
  } | null>(null);

  const categories = getAllCategories();

  useEffect(() => {
    if (isOpen) {
      getSuggestion();
    }
  }, [isOpen, fileName]);

  const getSuggestion = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileType }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiSuggestion({
          category: data.suggestedCategory,
          confidence: data.confidence,
          reasoning: data.reasoning,
        });
        setSelectedCategory(data.suggestedCategory);
      } else {
        // Fallback to 'other' if suggestion fails
        setSelectedCategory('other');
      }
    } catch (error) {
      console.error('Error getting category suggestion:', error);
      setSelectedCategory('other');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#2d333b] border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#2d333b] border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#F8FAFC]">Select Document Category</h2>
            <p className="text-sm text-gray-400 mt-1">File: {fileName}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-[#F8FAFC] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Suggestion Banner */}
        {loading ? (
          <div className="px-6 py-4 bg-[#1F2328] border-b border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing document...</span>
            </div>
          </div>
        ) : aiSuggestion && aiSuggestion.confidence >= 0.7 ? (
          <div className="px-6 py-4 bg-[#1F2328] border-b border-gray-700">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[#F8FAFC]">
                  AI Suggestion: {getCategoryLabel(aiSuggestion.category)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {aiSuggestion.reasoning}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Confidence: {(aiSuggestion.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Category Options */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-400 mb-3">
            Select the category that best describes this document. This helps the AI assistant find relevant information faster.
          </p>

          <div className="space-y-2">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                  selectedCategory === category.value
                    ? 'border-[#F97316] bg-[#F97316]/10 text-[#F8FAFC]'
                    : 'border-gray-700 bg-[#1F2328] text-gray-300 hover:border-gray-600 hover:bg-[#1F2328]/80'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{category.label}</p>
                    <p className="text-sm text-gray-400 mt-0.5">{category.description}</p>
                  </div>
                  {selectedCategory === category.value && (
                    <CheckCircle2 className="w-5 h-5 text-[#F97316] flex-shrink-0 ml-2" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#2d333b] border-t border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-[#F8FAFC] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedCategory)}
            className="px-4 py-2 bg-[#F97316] text-white text-sm font-medium rounded-lg hover:bg-[#ea580c] transition-colors"
          >
            Confirm & Upload
          </button>
        </div>
      </div>
    </div>
  );
}
