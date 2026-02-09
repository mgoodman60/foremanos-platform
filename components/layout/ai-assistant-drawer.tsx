'use client';

import { useEffect, useCallback } from 'react';
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

  if (!project) return null;

  const slug = project.slug;
  const userRole = session?.user?.role || 'guest';

  return (
    <>
      {/* Drawer panel */}
      <aside
        id="ai-drawer"
        role="complementary"
        aria-label="AI Assistant"
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
                <h2 className="text-base font-semibold text-slate-50">AI Assistant</h2>
              </div>
              <button
                onClick={() => setAiDrawerOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-orange-500"
                aria-label="Close AI Assistant"
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
              />
            </div>
          </>
        )}
      </aside>

      {/* FAB when drawer is closed (desktop only) */}
      {!aiDrawerOpen && (
        <button
          onClick={() => setAiDrawerOpen(true)}
          className="
            hidden md:flex fixed bottom-6 right-6 z-30
            w-14 h-14 items-center justify-center
            bg-orange-500 hover:bg-orange-600 text-white
            rounded-full shadow-lg hover:shadow-xl
            transition-all duration-200
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
          "
          aria-label="Open AI Assistant (Ctrl+\\)"
          title="Open AI Assistant (Ctrl+\\)"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
    </>
  );
}
