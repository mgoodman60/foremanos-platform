'use client';

import { useState, useEffect, useCallback } from 'react';
import { HardHat, Send, MessageSquare } from 'lucide-react';
import { useProject } from '@/components/layout/project-context';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

interface ConversationPreview {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

interface AskForemanWidgetProps {
  projectSlug: string;
  projectId: string;
}

const QUICK_PROMPTS = [
  'Schedule status?',
  'Budget summary',
  'Safety checklist',
  'What needs attention?',
];

export function AskForemanWidget({ projectSlug, projectId }: AskForemanWidgetProps) {
  const { setAiDrawerOpen } = useProject();
  const [input, setInput] = useState('');
  const [recentConversations, setRecentConversations] = useState<ConversationPreview[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const response = await fetchWithRetry(`/api/conversations/list?limit=3&projectId=${projectId}`, {
          retryOptions: { maxRetries: 1, onRetry: () => {} },
        });
        if (!response.ok) return;
        const data = await response.json();
        const conversations = (data.conversations || []).slice(0, 3).map((c: { id: string; title: string; lastMessage?: string; updatedAt: string }) => ({
          id: c.id,
          title: c.title || 'Untitled',
          lastMessage: c.lastMessage || '',
          updatedAt: c.updatedAt,
        }));
        setRecentConversations(conversations);
      } catch {
        // Silently fail — widget is non-critical
      }
    };
    fetchRecent();
  }, [projectId]);

  const dispatchPrefill = useCallback((message: string) => {
    window.dispatchEvent(new CustomEvent('aiDrawerPrefill', { detail: { message } }));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    dispatchPrefill(input.trim());
    setInput('');
  };

  const handleQuickPrompt = (prompt: string) => {
    dispatchPrefill(prompt);
  };

  return (
    <div className="relative bg-slate-900 border-2 border-gray-700 rounded-xl overflow-hidden">
      {/* Animated gradient border accent */}
      <div className="absolute inset-0 rounded-xl pointer-events-none" style={{
        background: 'linear-gradient(135deg, rgba(251,146,60,0.15) 0%, transparent 40%, transparent 60%, rgba(251,146,60,0.1) 100%)',
      }} />

      <div className="relative p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <HardHat className="w-5 h-5 text-orange-400" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-50">Ask the Foreman</h3>
            <p className="text-xs text-gray-400">AI-powered project assistant</p>
          </div>
        </div>

        {/* Recent conversations */}
        {recentConversations.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent</span>
            {recentConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setAiDrawerOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors truncate"
              >
                <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{conv.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick-start prompt pills */}
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleQuickPrompt(prompt)}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-800 text-gray-300 border border-gray-700 hover:border-orange-500/50 hover:text-orange-300 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Text input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your project..."
            className="flex-1 bg-slate-800 border border-gray-600 rounded-lg px-4 py-3 text-sm text-slate-50 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-3 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
