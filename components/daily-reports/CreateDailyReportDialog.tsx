'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';

interface CreateDailyReportDialogProps {
  open: boolean;
  onClose: () => void;
  projectSlug: string;
}

export default function CreateDailyReportDialog({
  open,
  onClose,
  projectSlug,
}: CreateDailyReportDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [weatherCondition, setWeatherCondition] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDate) {
      toast.error('Report date is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectSlug}/daily-reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportDate,
            weatherCondition: weatherCondition || undefined,
            workPerformed: workPerformed || undefined,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create report');
      }

      const data = await res.json();
      toast.success('Daily report created');
      onClose();
      router.push(
        `/project/${projectSlug}/field-ops/daily-reports/${data.report?.id || data.id}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create report'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md mx-4 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Create daily report"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">
              New Daily Report
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Report Date */}
          <div>
            <label
              htmlFor="report-date"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Report Date
            </label>
            <input
              id="report-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Weather */}
          <div>
            <label
              htmlFor="weather-condition"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Weather Conditions
            </label>
            <input
              id="weather-condition"
              type="text"
              value={weatherCondition}
              onChange={(e) => setWeatherCondition(e.target.value)}
              placeholder="e.g., Clear, 72°F"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="work-performed"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Notes / Summary
              <span className="text-gray-500 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              id="work-performed"
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
              placeholder="Brief summary of planned or completed work..."
              rows={3}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium text-gray-300 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Creating...' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
