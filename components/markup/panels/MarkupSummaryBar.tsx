'use client';

import { useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

interface MarkupSummaryBarProps {
  slug: string;
  documentId: string;
  onExportClick: () => void;
}

interface MarkupSummary {
  total: number;
  byType: Record<string, number>;
  byPage: Record<string, number>;
  byStatus: Record<string, number>;
}

export function MarkupSummaryBar({ slug, documentId, onExportClick }: MarkupSummaryBarProps) {
  const [summary, setSummary] = useState<MarkupSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, [slug, documentId]);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/documents/${documentId}/markups/summary`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      logger.error('MARKUP_SUMMARY_BAR', 'Failed to fetch summary', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !summary) {
    return (
      <div className="h-[32px] border-t bg-white px-4 flex items-center justify-between">
        <div className="text-xs text-gray-500">Loading summary...</div>
      </div>
    );
  }

  const topTypes = Object.entries(summary.byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="h-[32px] border-t bg-white px-4 flex items-center justify-between">
      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <FileText className="h-3 w-3 text-gray-500" />
          <span className="font-medium">{summary.total}</span>
          <span className="text-gray-500">markups</span>
        </div>

        {topTypes.length > 0 && (
          <>
            <div className="h-3 w-px bg-gray-300" />
            {topTypes.map(([type, count]) => (
              <div key={type} className="flex items-center gap-1">
                <span className="text-gray-600">{type.replace(/_/g, ' ')}:</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </>
        )}

        {summary.byStatus.open > 0 && (
          <>
            <div className="h-3 w-px bg-gray-300" />
            <div className="flex items-center gap-1">
              <span className="text-orange-600">Open:</span>
              <span className="font-medium">{summary.byStatus.open}</span>
            </div>
          </>
        )}
      </div>

      <Button size="sm" variant="outline" onClick={onExportClick} className="h-6 text-xs">
        <Download className="h-3 w-3 mr-1" />
        Export
      </Button>
    </div>
  );
}
