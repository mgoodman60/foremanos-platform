import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Base document type required by the hook
 */
interface BaseDocument {
  id: string;
  accessLevel?: string;
}

interface UseOptimisticDocumentsOptions<T extends BaseDocument> {
  /** Current documents array */
  documents: T[];
  /** Setter function for documents */
  setDocuments: (docs: T[]) => void;
  /** Function to refresh documents from server */
  fetchDocuments: () => Promise<void>;
  /** Optional callback when documents change */
  onDocumentsChange?: () => void;
}

interface UseOptimisticDocumentsReturn {
  /** Optimistically delete documents with rollback on failure */
  optimisticDelete: (docIds: string[]) => Promise<boolean>;
  /** Optimistically change access level with rollback on failure */
  optimisticChangeAccess: (
    docIds: string[],
    newAccessLevel: 'admin' | 'client' | 'guest'
  ) => Promise<boolean>;
}

/**
 * useOptimisticDocuments - Hook for optimistic document operations
 *
 * Provides optimistic updates for bulk document operations with automatic
 * rollback on failure. Updates the UI immediately, then syncs with the server.
 *
 * @example
 * const { optimisticDelete, optimisticChangeAccess } = useOptimisticDocuments({
 *   documents,
 *   setDocuments,
 *   fetchDocuments,
 *   onDocumentsChange,
 * });
 *
 * // Delete with optimistic update
 * const success = await optimisticDelete(['doc-1', 'doc-2']);
 *
 * // Change access level with optimistic update
 * const success = await optimisticChangeAccess(['doc-1'], 'guest');
 */
export function useOptimisticDocuments<T extends BaseDocument>({
  documents,
  setDocuments,
  fetchDocuments,
  onDocumentsChange,
}: UseOptimisticDocumentsOptions<T>): UseOptimisticDocumentsReturn {
  const optimisticDelete = useCallback(
    async (docIds: string[]): Promise<boolean> => {
      if (docIds.length === 0) return true;

      // 1. Store previous state for rollback
      const previousDocs = [...documents];

      // 2. Optimistically remove from UI
      setDocuments(documents.filter((doc) => !docIds.includes(doc.id)));

      // 3. Execute API calls in parallel
      const results = await Promise.allSettled(
        docIds.map((id) =>
          fetch(`/api/documents/${id}`, { method: 'DELETE' }).then((res) => {
            if (!res.ok) throw new Error('Delete failed');
            return res;
          })
        )
      );

      // 4. Check for failures
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        // Rollback on failure
        setDocuments(previousDocs);
        toast.error(
          `Failed to delete ${failures.length} document(s). Changes reverted.`
        );
        // Sync with server to ensure consistency
        await fetchDocuments();
        return false;
      }

      // 5. Notify parent of successful changes
      onDocumentsChange?.();
      return true;
    },
    [documents, setDocuments, fetchDocuments, onDocumentsChange]
  );

  const optimisticChangeAccess = useCallback(
    async (
      docIds: string[],
      newAccessLevel: 'admin' | 'client' | 'guest'
    ): Promise<boolean> => {
      if (docIds.length === 0) return true;

      // 1. Store previous state
      const previousDocs = [...documents];

      // 2. Optimistically update UI
      setDocuments(
        documents.map((doc) =>
          docIds.includes(doc.id) ? { ...doc, accessLevel: newAccessLevel } : doc
        )
      );

      // 3. Execute API calls in parallel
      const results = await Promise.allSettled(
        docIds.map((id) =>
          fetch(`/api/documents/${id}/access`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessLevel: newAccessLevel }),
          }).then((res) => {
            if (!res.ok) throw new Error('Update failed');
            return res;
          })
        )
      );

      // 4. Handle failures with rollback
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        setDocuments(previousDocs);
        toast.error(
          `Failed to update ${failures.length} document(s). Changes reverted.`
        );
        return false;
      }

      // 5. Notify parent of successful changes
      onDocumentsChange?.();
      return true;
    },
    [documents, setDocuments, onDocumentsChange]
  );

  return { optimisticDelete, optimisticChangeAccess };
}
