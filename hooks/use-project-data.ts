/**
 * SWR hooks for project data fetching in client components.
 * Use these instead of manual useEffect + fetch patterns.
 */

import useSWR from 'swr';
import { fetcher } from '@/lib/swr-fetcher';

/**
 * Fetch project data by slug. Returns the full project object.
 */
export function useProject(slug: string | undefined) {
  return useSWR(
    slug ? `/api/projects/${slug}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
}

/**
 * Fetch document intelligence data.
 */
export function useDocumentIntelligence(documentId: string | undefined) {
  return useSWR(
    documentId ? `/api/documents/${documentId}/intelligence` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
}

/**
 * Fetch notifications for the current user.
 */
export function useNotifications() {
  return useSWR('/api/notifications', fetcher, {
    refreshInterval: 30000, // Poll every 30 seconds
  });
}

/**
 * Fetch admin processing stats.
 */
export function useProcessingStats() {
  return useSWR('/api/admin/processing-stats', fetcher, {
    refreshInterval: 10000,
  });
}

/**
 * Fetch active processing queue.
 */
export function useActiveProcessing() {
  return useSWR('/api/processing/active', fetcher, {
    refreshInterval: 5000,
  });
}

/**
 * Fetch feedback review data with pagination.
 */
export function useFeedbackReview(params: {
  page?: number;
  status?: string;
  type?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.status) searchParams.set('status', params.status);
  if (params.type) searchParams.set('type', params.type);
  const query = searchParams.toString();

  return useSWR(
    `/api/feedback/review${query ? `?${query}` : ''}`,
    fetcher
  );
}
