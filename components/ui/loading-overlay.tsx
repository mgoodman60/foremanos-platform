'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export function LoadingOverlay({ isLoading, text, fullScreen, className }: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50',
        fullScreen && 'fixed',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-[#003B71]" />
        {text && <p className="text-sm font-medium text-gray-700">{text}</p>}
      </div>
    </div>
  );
}
