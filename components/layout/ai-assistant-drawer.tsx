'use client';

import { useEffect, useCallback, useState } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { useProject } from './project-context';
import { ChatInterface } from '@/components/chat-interface';

export function AIAssistantDrawer() {
  const {
    project,
    session,
    aiDrawerOpen,
    setAiDrawerOpen,
  } = useProject();

  const [prefillMessage, setPrefillMessage] = useState('');

  // Keyboard shortcut: Cmd+\ or Ctrl+\ to toggle
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
      e.preventDefault();
      setAiDrawerOpen(!aiDrawerOpen);
    }
    if (e.key === 'Escape' && aiDrawerOpen) {
      setAiDrawerOpen(false);
    }
  }, [aiDrawerOpen, setAiDrawerOpen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Listen for prefill events from AskForemanWidget / AskForemanButton
  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      if (detail?.message) {
        setPrefillMessage(detail.message);
        setAiDrawerOpen(true);
      }
    };
    window.addEventListener('aiDrawerPrefill', handlePrefill);
    return () => window.removeEventListener('aiDrawerPrefill', handlePrefill);
  }, [setAiDrawerOpen]);

  // Clear prefill once drawer closes
  useEffect(() => {
    if (!aiDrawerOpen) {
      setPrefillMessage('');
    }
  }, [aiDrawerOpen]);

  if (!project) return null;

  const slug = project.slug;
  const userRole = session?.user?.role || 'guest';

  return (
    <>
      {/* Glow keyframe */}
      <style>{`
        @keyframes foreman-glow {
          0%, 100% { box-shadow: 0 0 8px 0 rgba(251,146,60,0.3); }
          50% { box-shadow: 0 0 16px 4px rgba(251,146,60,0.45); }
        }
      `}</style>

      {/* Drawer panel */}
      <aside
        id="ai-drawer"
        role="complementary"
        aria-label="The Foreman"
        className={`
          hidden md:flex flex-col flex-shrink-0
          bg-slate-900 border-l border-gray-700 shadow-xl
          transition-[width,opacity] duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)]
          motion-reduce:transition-none
          overflow-hidden
          ${aiDrawerOpen ? 'w-[380px]' : 'w-0'}
        `}
      >
        {aiDrawerOpen && (
          <>
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange-400" />
                <h2 className="text-base font-semibold text-slate-50">The Foreman</h2>
              </div>
              <button
                onClick={() => setAiDrawerOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label="Close The Foreman"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat interface */}
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                compact
                userRole={userRole}
                projectSlug={slug}
                projectId={project.id}
                initialInput={prefillMessage}
              />
            </div>
          </>
        )}
      </aside>

      {/* FAB pill when drawer is closed (desktop only) */}
      {!aiDrawerOpen && (
        <button
          onClick={() => setAiDrawerOpen(true)}
          className="
            hidden md:flex fixed bottom-6 right-6 z-30
            px-5 h-12 items-center gap-2
            bg-orange-500 hover:bg-orange-600 text-white
            rounded-full shadow-lg hover:shadow-xl
            ring-2 ring-orange-400/30
            transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
          "
          style={{ animation: 'foreman-glow 3s ease-in-out infinite' }}
          aria-label="Open The Foreman (Ctrl+\\)"
          title="Open The Foreman (Ctrl+\\)"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-sm font-semibold">Ask the Foreman</span>
        </button>
      )}
    </>
  );
}
