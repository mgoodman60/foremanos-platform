'use client';

import { useState } from 'react';
import {
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface ExtractionResult {
  success: boolean;
  scheduleType: string;
  itemsExtracted: number;
  errors: string[];
}

interface ScheduleExtractionButtonProps {
  projectSlug: string;
  onComplete?: () => void;
}

export default function ScheduleExtractionButton({
  projectSlug,
  onComplete,
}: ScheduleExtractionButtonProps) {
  const [extracting, setExtracting] = useState(false);
  const [results, setResults] = useState<ExtractionResult[] | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleExtract = async () => {
    setExtracting(true);
    setResults(null);

    try {
      const res = await fetch(`/api/projects/${projectSlug}/schedules/extract`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);

        const totalItems = data.totalExtracted || 0;
        if (totalItems > 0) {
          toast.success(`Extracted ${totalItems} items from schedules`);
        } else {
          toast.info('No new schedule items found to extract');
        }

        onComplete?.();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Extraction failed');
      }
    } catch (error) {
      toast.error('Failed to extract schedules');
    } finally {
      setExtracting(false);
    }
  };

  const totalExtracted = results?.reduce((sum, r) => sum + r.itemsExtracted, 0) || 0;
  const hasErrors = results?.some(r => r.errors.length > 0);

  return (
    <div className="space-y-2">
      <button
        onClick={handleExtract}
        disabled={extracting}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-400
          text-white rounded-lg flex items-center gap-2 transition-colors font-medium border-2 border-indigo-400"
      >
        {extracting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Extracting Schedules...
          </>
        ) : (
          <>
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            Extract Schedules
          </>
        )}
      </button>

      {/* Results Summary */}
      {results && results.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              {hasErrors ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              )}
              <span className="text-white font-medium">
                {totalExtracted} items extracted
              </span>
            </div>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-slate-400" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
            )}
          </button>

          {showDetails && (
            <div className="mt-3 space-y-2">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded border ${
                    result.success && result.errors.length === 0
                      ? 'bg-emerald-950 border-emerald-700'
                      : 'bg-amber-950 border-amber-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize text-white">
                      {result.scheduleType}
                    </span>
                    <span className="text-sm text-slate-300">
                      {result.itemsExtracted} items
                    </span>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-1 text-xs text-amber-300">
                      {result.errors.slice(0, 3).map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                      {result.errors.length > 3 && (
                        <div>...and {result.errors.length - 3} more errors</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
