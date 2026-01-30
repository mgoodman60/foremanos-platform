'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SearchResult {
  id: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  hasImage: boolean;
}

interface MessageSearchProps {
  conversationId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onResultSelect: (messageId: string, highlightText: string) => void;
}

export function MessageSearch({
  conversationId,
  isOpen,
  onClose,
  onResultSelect,
}: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // Close on Escape
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Navigate with arrow keys
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault();
        setCurrentIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp' && results.length > 0) {
        e.preventDefault();
        setCurrentIndex((prev) => (prev - 1 + results.length) % results.length);
      }

      // Enter to navigate to selected result
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        const current = results[currentIndex];
        if (current) {
          onResultSelect(current.messageId, query);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, currentIndex, query, onClose, onResultSelect]);

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!conversationId || searchQuery.trim().length === 0) {
      setResults([]);
      setTotalMatches(0);
      setCurrentIndex(0);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/search?q=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Too many search requests. Please wait a moment.');
        } else {
          toast.error('Failed to search messages');
        }
        return;
      }

      const data = await response.json();
      setResults(data.results || []);
      setTotalMatches(data.totalMatches || 0);
      setCurrentIndex(0);

      // If we have results, automatically navigate to first one
      if (data.results && data.results.length > 0) {
        onResultSelect(data.results[0].messageId, searchQuery);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search messages');
    } finally {
      setIsSearching(false);
    }
  }, [conversationId, onResultSelect]);

  // Debounce search queries (300ms)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length === 0) {
      setResults([]);
      setTotalMatches(0);
      setCurrentIndex(0);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Navigate to previous match
  const navigatePrevious = () => {
    if (results.length === 0) return;
    const newIndex = (currentIndex - 1 + results.length) % results.length;
    setCurrentIndex(newIndex);
    onResultSelect(results[newIndex].messageId, query);
  };

  // Navigate to next match
  const navigateNext = () => {
    if (results.length === 0) return;
    const newIndex = (currentIndex + 1) % results.length;
    setCurrentIndex(newIndex);
    onResultSelect(results[newIndex].messageId, query);
  };

  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#2d333b] border-b border-gray-700 shadow-lg animate-in slide-in-from-top">
      <div className="flex items-center flex-1 gap-2 bg-[#1F2328] border border-gray-600 rounded-lg px-3 py-2">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages... (Esc to close)"
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-400 focus:outline-none"
          aria-label="Search messages"
        />
        {isSearching && <Loader2 className="w-4 h-4 text-[#F97316] animate-spin flex-shrink-0" />}
      </div>

      {/* Results counter and navigation */}
      <div className="flex items-center gap-2">
        {totalMatches > 0 && (
          <>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {currentIndex + 1} of {totalMatches}
            </span>
            <div className="flex gap-1">
              <button
                onClick={navigatePrevious}
                disabled={results.length === 0}
                className="p-1.5 hover:bg-[#1F2328] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#F97316] focus:outline-none"
                aria-label="Previous match"
                title="Previous match (↑)"
              >
                <ChevronUp className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={navigateNext}
                disabled={results.length === 0}
                className="p-1.5 hover:bg-[#1F2328] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-[#F97316] focus:outline-none"
                aria-label="Next match"
                title="Next match (↓)"
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </>
        )}

        {query.trim().length > 0 && totalMatches === 0 && !isSearching && (
          <span className="text-xs text-gray-500 whitespace-nowrap">No matches</span>
        )}

        <button
          onClick={onClose}
          className="p-1.5 hover:bg-[#1F2328] rounded transition-colors focus:ring-2 focus:ring-[#F97316] focus:outline-none"
          aria-label="Close search"
          title="Close search (Esc)"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
