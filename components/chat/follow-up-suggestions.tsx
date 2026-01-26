'use client';

import { Sparkles, ArrowRight, HelpCircle } from 'lucide-react';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  disabled?: boolean;
}

export function FollowUpSuggestions({ 
  suggestions, 
  onSuggestionClick,
  disabled = false 
}: FollowUpSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-700 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          Follow-up Questions
        </span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => !disabled && onSuggestionClick(suggestion)}
            disabled={disabled}
            className="group flex items-center gap-2 px-3 py-2 text-sm text-gray-300 bg-gray-800/60 
                       hover:bg-blue-900/40 hover:text-blue-300 border border-gray-700 hover:border-blue-600 
                       rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <HelpCircle className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 transition-colors" />
            <span className="truncate max-w-[250px]">{suggestion}</span>
            <ArrowRight className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}
