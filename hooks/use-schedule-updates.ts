'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function useScheduleUpdates(slug: string, authenticated: boolean) {
  const router = useRouter();
  const [pendingUpdatesCount, setPendingUpdatesCount] = useState(0);
  const prevCountRef = useRef(0);

  const fetchPendingCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/schedule-updates/pending-count`);
      if (res.ok) {
        const data = await res.json();
        return data.count || 0;
      }
    } catch {
      // Silently fail - polling will retry
    }
    return null;
  }, [slug]);

  // Initial fetch
  useEffect(() => {
    if (!authenticated || !slug) return;
    fetchPendingCount().then((count) => {
      if (count !== null) {
        setPendingUpdatesCount(count);
        prevCountRef.current = count;
      }
    });
  }, [authenticated, slug, fetchPendingCount]);

  // Polling every 30 seconds
  useEffect(() => {
    if (!authenticated || !slug) return;

    const pollInterval = setInterval(async () => {
      const newCount = await fetchPendingCount();
      if (newCount === null) return;

      if (newCount > prevCountRef.current && prevCountRef.current > 0) {
        const diff = newCount - prevCountRef.current;
        toast.info(
          `${diff} new schedule update${diff !== 1 ? 's' : ''} available`,
          {
            duration: 5000,
            action: {
              label: 'Review',
              onClick: () => router.push(`/project/${slug}/schedule-updates`),
            },
          }
        );
      }

      prevCountRef.current = newCount;
      setPendingUpdatesCount(newCount);
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [authenticated, slug, router, fetchPendingCount]);

  const refreshUpdates = useCallback(async () => {
    const count = await fetchPendingCount();
    if (count !== null) {
      setPendingUpdatesCount(count);
      prevCountRef.current = count;
    }
  }, [fetchPendingCount]);

  return { pendingUpdatesCount, refreshUpdates };
}
