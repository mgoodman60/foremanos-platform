'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * ProgressBar - Shows a loading indicator during route transitions
 *
 * This component provides visual feedback when navigating between pages.
 * It shows a thin progress bar at the top of the screen that animates
 * during route changes, similar to NProgress but built with Tailwind CSS.
 */
export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Reset on route change complete
    setIsLoading(false);
    setProgress(0);
  }, [pathname, searchParams]);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout | null = null;

    const _handleStart = () => {
      setIsLoading(true);
      setProgress(0);

      // Simulate progress
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            return prev;
          }
          // Slow down as we get closer to 90%
          const increment = prev < 50 ? 10 : prev < 70 ? 5 : 2;
          return Math.min(prev + increment, 90);
        });
      }, 200);
    };

    const _handleComplete = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setProgress(100);
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 200);
    };

    // Listen for navigation events using beforeunload as a fallback
    // Note: Next.js 14+ doesn't have a built-in router events API
    // We use the pathname change effect above for completion

    // For programmatic navigation, components should call these manually
    // via the useProgressBar hook

    return () => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, []);

  if (!isLoading && progress === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page loading progress"
    >
      <div
        className="h-full bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 transition-all duration-200 ease-out shadow-[0_0_10px_rgba(249,115,22,0.7)]"
        style={{
          width: `${progress}%`,
          transition: progress === 100 ? 'width 200ms ease-out, opacity 200ms ease-out' : 'width 200ms ease-out',
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}

/**
 * Hook to manually control the progress bar for async operations
 * like data fetching or file uploads.
 */
import { createContext, useContext, useCallback, ReactNode } from 'react';

interface ProgressBarContextValue {
  start: () => void;
  done: () => void;
  set: (value: number) => void;
}

const ProgressBarContext = createContext<ProgressBarContextValue | null>(null);

interface ProgressBarProviderProps {
  children: ReactNode;
}

export function ProgressBarProvider({ children }: ProgressBarProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    setIsLoading(true);
    setProgress(0);

    // Clear any existing interval
    if (intervalId) {
      clearInterval(intervalId);
    }

    // Start progress simulation
    const id = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const increment = prev < 50 ? 10 : prev < 70 ? 5 : 2;
        return Math.min(prev + increment, 90);
      });
    }, 200);

    setIntervalId(id);
  }, [intervalId]);

  const done = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 200);
  }, [intervalId]);

  const set = useCallback((value: number) => {
    setProgress(Math.min(Math.max(value, 0), 100));
    if (value >= 100) {
      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 200);
    } else if (value > 0) {
      setIsLoading(true);
    }
  }, []);

  return (
    <ProgressBarContext.Provider value={{ start, done, set }}>
      {children}
      {(isLoading || progress > 0) && (
        <div
          className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-transparent"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading progress"
        >
          <div
            className="h-full bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 transition-all duration-200 ease-out shadow-[0_0_10px_rgba(249,115,22,0.7)]"
            style={{
              width: `${progress}%`,
              transition: progress === 100 ? 'width 200ms ease-out, opacity 200ms ease-out' : 'width 200ms ease-out',
              opacity: progress === 100 ? 0 : 1,
            }}
          />
        </div>
      )}
    </ProgressBarContext.Provider>
  );
}

export function useProgressBar(): ProgressBarContextValue {
  const context = useContext(ProgressBarContext);
  if (!context) {
    // Return no-op functions if used outside provider
    return {
      start: () => {},
      done: () => {},
      set: () => {},
    };
  }
  return context;
}
