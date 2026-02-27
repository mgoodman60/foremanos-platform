'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Activity, RefreshCw, TrendingUp } from 'lucide-react';

interface QualityPage {
  pageNumber: number;
  qualityScore: number | null;
  qualityPassed: boolean | null;
  correctionAttempts: number;
  isDeadLetter: boolean;
  deadLetterReason: string | null;
  discipline: string | null;
  sheetNumber: string | null;
  provider: string | null;
  qualityHistory: any[];
}

interface QualityReportData {
  documentId: string;
  documentName: string;
  avgQualityScore: number | null;
  totalPages: number;
  pagesProcessed: number;
  lowQualityCount: number;
  deadLetterCount: number;
  correctionPassesRun: number;
  totalCorrectionCost: number;
  pages: QualityPage[];
}

interface Props {
  documentId: string;
  projectSlug: string;
}

function getQualityColor(score: number | null, isDeadLetter: boolean): string {
  if (isDeadLetter) return 'bg-gray-400';
  if (score === null) return 'bg-gray-300';
  if (score >= 60) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getQualityTextColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 60) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

export default function QualityDashboard({ documentId, projectSlug }: Props) {
  const [data, setData] = useState<QualityReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<QualityPage | null>(null);
  const [improving, setImproving] = useState(false);
  const [improveResult, setImproveResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/quality-report`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [documentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleImproveAll = async () => {
    setImproving(true);
    setImproveResult(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/rescan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'improve', documentIds: [documentId] }),
      });
      const result = await res.json();
      if (res.ok) {
        setImproveResult(`${result.pagesImproved} of ${result.pagesRetried} pages improved`);
        fetchData();
      } else {
        setImproveResult(result.error || 'Failed');
      }
    } catch { setImproveResult('Failed to improve'); }
    finally { setImproving(false); }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-gray-700 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-48 mb-4" />
        <div className="h-4 bg-gray-700 rounded w-full mb-2" />
        <div className="grid grid-cols-10 gap-1">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const correctedPages = data.pages.filter(p => p.correctionAttempts > 0);
  const improvedPages = correctedPages.filter(p => (p.qualityScore || 0) >= 40);
  const avgImprovement = correctedPages.length > 0
    ? correctedPages.reduce((sum, p) => {
        const history = p.qualityHistory;
        if (history.length >= 2) {
          return sum + ((history[history.length - 1]?.score || 0) - (history[0]?.score || 0));
        }
        return sum;
      }, 0) / correctedPages.length
    : 0;

  return (
    <div className="bg-slate-900 border border-gray-700 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-cyan-400" aria-hidden="true" />
          Quality Overview
        </h3>
        <button
          onClick={handleImproveAll}
          disabled={improving || data.lowQualityCount === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors min-h-[44px]"
          aria-label="Improve low quality pages"
        >
          <RefreshCw className={`h-4 w-4 ${improving ? 'animate-spin' : ''}`} aria-hidden="true" />
          {improving ? 'Improving...' : 'Improve Low Quality'}
        </button>
      </div>

      {improveResult && (
        <div className="text-sm text-cyan-400 bg-cyan-900/30 rounded-lg px-3 py-2">{improveResult}</div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Score</div>
          <div className={`text-2xl font-bold ${getQualityTextColor(data.avgQualityScore)}`}>
            {data.avgQualityScore != null ? Math.round(data.avgQualityScore) : 'N/A'}
            <span className="text-sm text-gray-500">/100</span>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Pages</div>
          <div className="text-2xl font-bold text-white">{data.totalPages}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Low Quality</div>
          <div className={`text-2xl font-bold ${data.lowQualityCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {data.lowQualityCount}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Dead Letter</div>
          <div className={`text-2xl font-bold ${data.deadLetterCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {data.deadLetterCount}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Quality Distribution</span>
          <span>{data.avgQualityScore != null ? `${Math.round(data.avgQualityScore)}%` : 'N/A'}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              (data.avgQualityScore || 0) >= 60 ? 'bg-green-500' :
              (data.avgQualityScore || 0) >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, data.avgQualityScore || 0)}%` }}
          />
        </div>
      </div>

      {/* Page Quality Heatmap */}
      <div>
        <h4 className="text-sm font-medium text-gray-300 mb-2">Page Quality Heatmap</h4>
        <div className="grid grid-cols-10 gap-1">
          {data.pages.map(page => (
            <button
              key={page.pageNumber}
              onClick={() => setSelectedPage(page)}
              className={`h-8 rounded text-xs font-medium flex items-center justify-center transition-all
                ${getQualityColor(page.qualityScore, page.isDeadLetter)}
                ${selectedPage?.pageNumber === page.pageNumber ? 'ring-2 ring-white' : ''}
                hover:opacity-80`}
              title={`Page ${page.pageNumber}: ${page.qualityScore ?? 'N/A'}/100${page.isDeadLetter ? ' (Dead Letter)' : ''}`}
              aria-label={`Page ${page.pageNumber}, quality score ${page.qualityScore ?? 'N/A'}`}
            >
              {page.pageNumber}
            </button>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" aria-hidden="true" /> &gt;=60</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded" aria-hidden="true" /> 40-59</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded" aria-hidden="true" /> &lt;40</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-400 rounded" aria-hidden="true" /> Dead Letter</span>
        </div>
      </div>

      {/* Selected Page Detail */}
      {selectedPage && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h4 className="text-sm font-medium text-white mb-2">
            Page {selectedPage.pageNumber}
            {selectedPage.sheetNumber && ` — ${selectedPage.sheetNumber}`}
            {selectedPage.discipline && ` — ${selectedPage.discipline}`}
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
            <div>Score: <span className={getQualityTextColor(selectedPage.qualityScore)}>{selectedPage.qualityScore ?? 'N/A'}/100</span></div>
            <div>Corrections: {selectedPage.correctionAttempts}</div>
            <div>Provider: {selectedPage.provider || 'Unknown'}</div>
            <div>Status: {selectedPage.isDeadLetter ? 'Dead Letter' : selectedPage.qualityPassed ? 'Passed' : 'Low'}</div>
          </div>
          {selectedPage.deadLetterReason && (
            <div className="mt-2 text-xs text-red-400">Reason: {selectedPage.deadLetterReason}</div>
          )}
          {selectedPage.qualityHistory.length > 1 && (
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-1">Quality Timeline</div>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedPage.qualityHistory.map((h: any, i: number) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-gray-600">-&gt;</span>}
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      (h.score || 0) >= 60 ? 'bg-green-900 text-green-300' :
                      (h.score || 0) >= 40 ? 'bg-yellow-900 text-yellow-300' :
                      'bg-red-900 text-red-300'
                    }`}>
                      {h.score || 0}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Correction Summary */}
      {correctedPages.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Correction Summary
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-300">
            <div>{correctedPages.length} pages corrected</div>
            <div>{improvedPages.length} improved</div>
            <div>{data.deadLetterCount} dead-lettered</div>
            <div>Avg improvement: +{Math.round(avgImprovement)} pts</div>
          </div>
          {data.totalCorrectionCost > 0 && (
            <div className="text-xs text-gray-500 mt-2">Cost: ${data.totalCorrectionCost.toFixed(2)}</div>
          )}
        </div>
      )}
    </div>
  );
}
