'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnnounceOptional } from '@/components/ui/announcer';
import { useEffect } from 'react';

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  fullScreen?: boolean;
  className?: string;
  /** Use dark variant for better contrast on light backgrounds */
  variant?: 'light' | 'dark';
}

export function LoadingOverlay({
  isLoading,
  text,
  fullScreen,
  className,
  variant = 'dark',
}: LoadingOverlayProps) {
  const announcer = useAnnounceOptional();

  // Announce loading state to screen readers
  useEffect(() => {
    if (isLoading && text && announcer) {
      announcer.announce(text);
    }
  }, [isLoading, text, announcer]);

  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'absolute inset-0 backdrop-blur-sm flex items-center justify-center z-50',
        variant === 'dark'
          ? 'bg-gray-900/80 text-white'
          : 'bg-white/80 text-gray-900',
        fullScreen && 'fixed',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2
          className={cn(
            'w-10 h-10 animate-spin',
            variant === 'dark' ? 'text-orange-500' : 'text-[#003B71]'
          )}
          aria-hidden="true"
        />
        {text && (
          <p
            className={cn(
              'text-sm font-medium',
              variant === 'dark' ? 'text-gray-100' : 'text-gray-700'
            )}
          >
            {text}
          </p>
        )}
        <span className="sr-only">{text || 'Loading...'}</span>
      </div>
    </div>
  );
}
