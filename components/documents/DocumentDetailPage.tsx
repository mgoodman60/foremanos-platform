'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import SheetNavigator from './SheetNavigator';
import SheetDetailPanel from './SheetDetailPanel';
import IntelligenceSummary from './IntelligenceSummary';
import ProcessingLogPanel from './ProcessingLogPanel';
import ConfidenceIndicator from './ConfidenceIndicator';

interface Props {
  projectSlug: string;
  documentId: string;
}

export default function DocumentDetailPage({ projectSlug, documentId }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

  const fetchIntelligence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/intelligence`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      const json = await res.json();
      setData(json);
      if (json.sheets?.length > 0 && !selectedSheet) {
        setSelectedSheet(json.sheets[0].sheetNumber);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [documentId, selectedSheet]);

  useEffect(() => { fetchIntelligence(); }, [fetchIntelligence]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
        <div className="flex gap-4">
          <div className="w-60 h-96 bg-gray-200 rounded animate-pulse" />
          <div className="flex-1 h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" aria-hidden="true" />
          <span className="text-red-700">{error}</span>
          <button
            onClick={fetchIntelligence}
            className="ml-auto flex items-center gap-1 text-red-600 hover:text-red-800 min-h-[44px] min-w-[44px] justify-center"
            aria-label="Retry loading document intelligence"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const selectedSheetData = data.sheets?.find((s: any) => s.sheetNumber === selectedSheet);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/project/${projectSlug}/documents`}
            className="text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Back to documents"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">{data.document?.name}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
              <FileText className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{data.document?.fileName}</span>
              {data.document?.category && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs whitespace-nowrap">
                  {data.document.category.replace(/_/g, ' ')}
                </span>
              )}
              {data.summary && (
                <ConfidenceIndicator confidence={data.summary.averageConfidence} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sheet selector */}
      <div className="lg:hidden px-4 py-2 bg-white border-b">
        <label htmlFor="sheet-select" className="sr-only">Select sheet</label>
        <select
          id="sheet-select"
          value={selectedSheet || ''}
          onChange={(e) => setSelectedSheet(e.target.value)}
          className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
        >
          {data.sheets?.map((sheet: any) => (
            <option key={sheet.sheetNumber} value={sheet.sheetNumber}>
              {sheet.sheetNumber} - {sheet.discipline || 'General'}
            </option>
          ))}
        </select>
      </div>

      {/* Main content */}
      <div className="flex">
        {/* Desktop sidebar */}
        <nav
          className="hidden lg:block w-60 flex-shrink-0 bg-white border-r h-[calc(100vh-64px)] overflow-y-auto sticky top-0"
          aria-label="Sheet navigation"
        >
          <SheetNavigator
            sheets={data.sheets || []}
            drawingTypes={data.drawingTypes || []}
            selectedSheet={selectedSheet}
            onSelectSheet={setSelectedSheet}
          />
        </nav>

        {/* Detail panel */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {selectedSheetData ? (
            <SheetDetailPanel
              sheet={selectedSheetData}
              drawingType={data.drawingTypes?.find((d: any) => d.sheetNumber === selectedSheet)}
              dimensions={data.dimensions?.filter((d: any) => d.sheetNumber === selectedSheet)}
              callouts={data.detailCallouts?.filter((d: any) => d.sourceSheet === selectedSheet)}
              legends={data.legends?.filter((l: any) => l.sheetNumber === selectedSheet)}
              annotations={data.enhancedAnnotations?.filter((a: any) => a.sheetNumber === selectedSheet)}
              rooms={data.rooms || []}
              doors={data.doors || []}
              windows={data.windows || []}
              onNavigateSheet={(sheet: string) => setSelectedSheet(sheet)}
            />
          ) : (
            <div className="text-center py-12 text-gray-500">
              {data.sheets?.length > 0 ? 'Select a sheet to view details' : 'No sheets extracted'}
            </div>
          )}

          {data.summary && <IntelligenceSummary summary={data.summary} />}
          {data.processingLog && <ProcessingLogPanel log={data.processingLog} />}
        </main>
      </div>
    </div>
  );
}
