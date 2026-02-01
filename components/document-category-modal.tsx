'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { documentCategorySchema, type DocumentCategoryFormData } from '@/lib/schemas';
import { getAllCategories, getCategoryLabel } from '@/lib/document-categorizer';
import { useFocusTrap } from '@/hooks/use-focus-trap';

interface DocumentCategoryModalProps {
  isOpen: boolean;
  fileName: string;
  fileType: string;
  onConfirm: (category: string) => void;
  onCancel: () => void;
}

export function DocumentCategoryModal({
  isOpen,
  fileName,
  fileType,
  onConfirm,
  onCancel,
}: DocumentCategoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: string;
    confidence: number;
    reasoning: string;
  } | null>(null);
  const [autoAccepted, setAutoAccepted] = useState(false);
  const [showChangeCategory, setShowChangeCategory] = useState(false);

  // Threshold for auto-acceptance (90%+)
  const AUTO_ACCEPT_THRESHOLD = 0.9;

  const categories = getAllCategories();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<DocumentCategoryFormData>({
    resolver: zodResolver(documentCategorySchema),
    defaultValues: {
      category: 'other',
    },
  });

  const selectedCategory = watch('category');

  // Focus trap for accessibility
  const containerRef = useFocusTrap({
    isActive: isOpen,
    onEscape: onCancel,
  });

  useEffect(() => {
    if (isOpen && fileName) {
      getSuggestion();
    } else if (isOpen && !fileName) {
      // No file selected yet (category-first flow)
      setLoading(false);
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
        const suggestion = {
          category: data.suggestedCategory,
          confidence: data.confidence,
          reasoning: data.reasoning,
        };
        setAiSuggestion(suggestion);
        setValue('category', data.suggestedCategory);

        // Auto-accept high confidence suggestions (90%+)
        if (data.confidence >= AUTO_ACCEPT_THRESHOLD) {
          setAutoAccepted(true);
        }
      } else {
        // Fallback to 'other' if suggestion fails
        setValue('category', 'other');
      }
    } catch (error) {
      console.error('Error getting category suggestion:', error);
      setValue('category', 'other');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (data: DocumentCategoryFormData) => {
    onConfirm(data.category);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-category-modal-title"
        className="bg-dark-card border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-dark-card border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            {!fileName ? (
              /* Category-First Mode - Prominent Step Indicator */
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-[#F97316]/20 border border-[#F97316] rounded-full">
                    <div className="w-6 h-6 rounded-full bg-[#F97316] flex items-center justify-center text-white text-sm font-bold">
                      1
                    </div>
                    <span className="text-sm font-semibold text-[#F97316]">Step 1 of 2</span>
                  </div>
                </div>
                <h2 id="document-category-modal-title" className="text-xl font-bold text-[#F8FAFC]">
                  Choose Document Category
                </h2>
                <p className="text-sm text-gray-400 mt-1">Select the category first, then youll choose your file</p>
              </div>
            ) : (
              /* File-First Mode - Standard Header */
              <div>
                <h2 id="document-category-modal-title" className="text-lg font-semibold text-[#F8FAFC]">
                  Select Document Category
                </h2>
                <p className="text-sm text-gray-400 mt-1">File: {fileName}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-[#F8FAFC] transition-colors ml-4"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Suggestion Banner - Only show if file is present */}
        {fileName && (
          <>
            {loading ? (
              <div className="px-6 py-4 bg-dark-surface border-b border-gray-700">
                <div className="flex items-center gap-3 text-sm">
                  <div className="relative">
                    <Loader2 className="w-5 h-5 animate-spin text-[#F97316]" />
                  </div>
                  <div>
                    <p className="text-gray-300 font-medium">Analyzing document...</p>
                    <p className="text-xs text-gray-500">AI is categorizing your document</p>
                  </div>
                </div>
              </div>
            ) : aiSuggestion && aiSuggestion.confidence >= 0.7 ? (
              <div className={`px-6 py-4 border-b ${
                autoAccepted
                  ? 'bg-green-900/20 border-green-700/50'
                  : 'bg-dark-surface border-gray-700'
              }`}>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    autoAccepted ? 'text-green-400' : 'text-green-500'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#F8FAFC]">
                        {autoAccepted ? 'Auto-selected: ' : 'AI Suggestion: '}
                        {getCategoryLabel(aiSuggestion.category)}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        aiSuggestion.confidence >= AUTO_ACCEPT_THRESHOLD
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {(aiSuggestion.confidence * 100).toFixed(0)}% confident
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {aiSuggestion.reasoning}
                    </p>
                    {autoAccepted && !showChangeCategory && (
                      <button
                        type="button"
                        onClick={() => {
                          setAutoAccepted(false);
                          setShowChangeCategory(true);
                        }}
                        className="mt-2 text-xs text-[#F97316] hover:text-[#EA580C] font-medium transition-colors"
                      >
                        Change category
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Category Options */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-3" noValidate>
          {!fileName && (
            <div className="mb-4 p-4 bg-dark-surface border border-[#F97316]/30 rounded-lg">
              <p className="text-sm text-[#F8FAFC] font-medium mb-1">
                Why categorize first?
              </p>
              <p className="text-xs text-gray-400">
                Choosing a category helps organize your files and improves AI search accuracy. After selecting a category, youll be prompted to choose your file.
              </p>
            </div>
          )}
          <p className="text-sm text-gray-400 mb-3">
            {fileName
              ? 'Select the category that best describes this document. This helps the AI assistant find relevant information faster.'
              : 'Choose the type of document you want to upload:'
            }
          </p>

          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <div className={`space-y-2 ${autoAccepted && !showChangeCategory ? 'hidden' : ''}`}>
                {categories.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => field.onChange(category.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      field.value === category.value
                        ? fileName
                          ? 'border-[#F97316] bg-[#F97316]/10 text-[#F8FAFC]'
                          : 'border-[#F97316] bg-[#F97316]/20 text-[#F8FAFC] shadow-lg ring-2 ring-[#F97316]/30'
                        : 'border-gray-700 bg-dark-surface text-gray-300 hover:border-gray-600 hover:bg-dark-surface/80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`font-medium ${field.value === category.value && !fileName ? 'font-bold' : ''}`}>
                          {category.label}
                        </p>
                        <p className="text-sm text-gray-400 mt-0.5">{category.description}</p>
                      </div>
                      {field.value === category.value && (
                        <CheckCircle2 className={`w-5 h-5 text-[#F97316] flex-shrink-0 ml-2 ${!fileName ? 'w-6 h-6' : ''}`} />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          />

          {/* Footer */}
          <div className="sticky bottom-0 bg-dark-card border-t border-gray-700 px-6 py-4 -mx-6 -mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-400 hover:text-[#F8FAFC] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                fileName
                  ? 'bg-[#F97316] text-white hover:bg-[#ea580c]'
                  : 'bg-[#F97316] text-white hover:bg-[#ea580c] shadow-lg ring-2 ring-[#F97316]/50'
              }`}
            >
              {fileName ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm & Upload</span>
                </>
              ) : (
                <>
                  <span>Next: Choose File</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
