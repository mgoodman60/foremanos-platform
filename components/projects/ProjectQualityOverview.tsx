'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface DocQuality {
  id: string;
  name: string;
  category: string;
  avgQualityScore: number | null;
  totalPages: number;
  lowQualityCount: number;
  deadLetterCount: number;
  correctionPassesRun: number;
  processedAt: string | null;
  pendingQuestionCount: number;
}

interface Props {
  projectSlug: string;
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 60) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

export default function ProjectQualityOverview({ projectSlug }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [improving, setImproving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectSlug}/quality-overview`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleImproveAll = async () => {
    setImproving(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/rescan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'improve' }),
      });
      if (res.ok) { fetchData(); }
    } catch { /* ignore */ }
    finally { setImproving(false); }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-gray-700 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-48 mb-4" />
        <div className="h-40 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const { intelligenceScore, documents, totals } = data;
  const dimensions = intelligenceScore?.dimensions || [];

  return (
    <div className="bg-slate-900 border border-gray-700 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" aria-hidden="true" />
          Document Intelligence Quality
        </h3>
        <span className={`text-2xl font-bold ${getScoreColor(intelligenceScore?.overallScore)}`}>
          {intelligenceScore?.overallScore ?? 'N/A'}
          <span className="text-sm text-gray-500">/100</span>
        </span>
      </div>

      {/* Overall progress bar */}
      <div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              (intelligenceScore?.overallScore || 0) >= 60 ? 'bg-green-500' :
              (intelligenceScore?.overallScore || 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, intelligenceScore?.overallScore || 0)}%` }}
          />
        </div>
      </div>

      {/* 5 Dimensions */}
      {dimensions.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">5 Dimensions</div>
          <div className="space-y-2">
            {dimensions.map((dim: any) => (
              <div key={dim.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 w-40 truncate">{dim.name}</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${dim.score >= 60 ? 'bg-green-500' : dim.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, dim.score)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{Math.round(dim.score)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document list */}
      <div>
        <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Documents</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="py-2 pr-2 font-medium">Name</th>
                <th className="py-2 pr-2 font-medium text-right">Score</th>
                <th className="py-2 pr-2 font-medium text-right">Dead</th>
                <th className="py-2 pr-2 font-medium text-right">Questions</th>
                <th className="py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(documents as DocQuality[]).map(doc => (
                <tr key={doc.id} className="border-b border-gray-800 last:border-0">
                  <td className="py-2 pr-2 text-white truncate max-w-[200px]">{doc.name}</td>
                  <td className={`py-2 pr-2 text-right font-medium ${getScoreColor(doc.avgQualityScore)}`}>
                    {doc.avgQualityScore != null ? Math.round(doc.avgQualityScore) : '—'}
                  </td>
                  <td className={`py-2 pr-2 text-right ${(doc.deadLetterCount || 0) > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                    {doc.deadLetterCount || 0}
                  </td>
                  <td className={`py-2 pr-2 text-right ${(doc.pendingQuestionCount || 0) > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                    {doc.pendingQuestionCount || 0}
                  </td>
                  <td className="py-2 text-right">
                    {(doc.deadLetterCount || 0) > 0 && (
                      <Link
                        href={`/project/${projectSlug}/documents/${doc.id}`}
                        className="text-cyan-400 hover:text-cyan-300"
                        aria-label={`Fix dead letter pages in ${doc.name}`}
                      >
                        Fix
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-700">
        <span>
          {totals.totalDocuments} docs | {totals.totalPages} pages | {totals.totalLowQuality} low quality | {totals.totalDeadLetter} dead letters
        </span>
        {totals.totalLowQuality > 0 && (
          <button
            onClick={handleImproveAll}
            disabled={improving}
            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white text-xs rounded-lg transition-colors min-h-[44px]"
            aria-label="Improve all low quality documents"
          >
            <RefreshCw className={`h-3 w-3 ${improving ? 'animate-spin' : ''}`} aria-hidden="true" />
            Improve All
          </button>
        )}
      </div>
    </div>
  );
}
