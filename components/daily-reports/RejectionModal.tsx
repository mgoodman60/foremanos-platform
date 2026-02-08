'use client';

import { useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/use-focus-trap';

const REJECTION_REASONS = [
  'Quality issues',
  'Incomplete data',
  'Missing photos',
  'Incorrect entries',
  'Other',
] as const;

interface RejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportIds: string[];
  projectSlug: string;
  onRejected: () => void;
}

export default function RejectionModal({
  isOpen,
  onClose,
  reportIds,
  projectSlug,
  onRejected,
}: RejectionModalProps) {
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_REASONS[0]);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trapRef = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
  });

  const handleSubmit = async () => {
    if (!rejectionReason) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/daily-reports/approve-bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportIds,
            action: 'REJECTED',
            rejectionReason,
            rejectionNotes: rejectionNotes.trim() || undefined,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reject reports');
      }

      toast.success(`${reportIds.length} report${reportIds.length > 1 ? 's' : ''} rejected`);
      setRejectionReason(REJECTION_REASONS[0]);
      setRejectionNotes('');
      onRejected();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject reports');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rejection-modal-title"
        className="bg-gray-900 border-2 border-gray-600 rounded-xl p-6 w-full max-w-md mx-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <XCircle className="w-5 h-5 text-red-400" />
          <h3 id="rejection-modal-title" className="text-lg font-semibold text-white">
            Reject {reportIds.length} Report{reportIds.length > 1 ? 's' : ''}
          </h3>
        </div>

        <div className="space-y-4">
          {/* Rejection Reason */}
          <div>
            <label
              htmlFor="rejection-reason"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Reason <span className="text-red-400">*</span>
            </label>
            <select
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border-2 border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            >
              {REJECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {/* Rejection Notes */}
          <div>
            <label
              htmlFor="rejection-notes"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Notes (optional)
            </label>
            <textarea
              id="rejection-notes"
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              rows={4}
              placeholder="Add details about what needs to be corrected..."
              className="w-full px-3 py-2 bg-gray-800 border-2 border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !rejectionReason}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              'Reject'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
