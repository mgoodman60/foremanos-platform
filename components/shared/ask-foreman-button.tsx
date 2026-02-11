'use client';

import { MessageSquare } from 'lucide-react';
import { useProject } from '@/components/layout/project-context';

interface AskForemanButtonProps {
  label?: string;
}

export function AskForemanButton({ label = 'Ask the Foreman' }: AskForemanButtonProps) {
  const { setAiDrawerOpen } = useProject();

  return (
    <button
      onClick={() => setAiDrawerOpen(true)}
      className="fixed bottom-24 right-6 flex items-center gap-2 px-4 py-2 bg-orange-500/90 hover:bg-orange-500 text-white text-sm rounded-full shadow-lg z-30 transition-all focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none md:bottom-8"
      aria-label={label}
    >
      <MessageSquare className="w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  );
}
