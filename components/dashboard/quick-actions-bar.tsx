'use client';

import { Upload, ClipboardPlus, Calendar, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/components/layout/project-context';

interface QuickActionsBarProps {
  projectSlug: string;
  onUpload: () => void;
}

export function QuickActionsBar({ projectSlug, onUpload }: QuickActionsBarProps) {
  const router = useRouter();
  const { setAiDrawerOpen } = useProject();

  const handleAskForeman = () => {
    window.dispatchEvent(
      new CustomEvent('aiDrawerPrefill', { detail: { message: '' } })
    );
    setAiDrawerOpen(true);
  };

  const pillBase =
    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ' +
    'border min-h-[40px]';

  const defaultPill =
    'bg-slate-800 hover:bg-slate-700 border-gray-600 hover:border-orange-500 text-gray-300 hover:text-white';

  const foremanPill =
    'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/50';

  return (
    <div className="flex flex-wrap gap-3">
      <button className={`${pillBase} ${defaultPill}`} onClick={onUpload}>
        <Upload className="w-4 h-4" aria-hidden="true" />
        Upload Doc
      </button>
      <button
        className={`${pillBase} ${defaultPill}`}
        onClick={() => router.push(`/project/${projectSlug}/field-ops/daily-reports?new=true`)}
      >
        <ClipboardPlus className="w-4 h-4" aria-hidden="true" />
        New Daily Report
      </button>
      <button
        className={`${pillBase} ${defaultPill}`}
        onClick={() => router.push(`/project/${projectSlug}/schedule-budget`)}
      >
        <Calendar className="w-4 h-4" aria-hidden="true" />
        Open Schedule
      </button>
      <button className={`${pillBase} ${foremanPill}`} onClick={handleAskForeman}>
        <MessageSquare className="w-4 h-4" aria-hidden="true" />
        Ask the Foreman
      </button>
    </div>
  );
}
