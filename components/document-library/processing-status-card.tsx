'use client';

import { X, Loader2, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { primaryColors, semanticColors } from '@/lib/design-tokens';
import { Document, DocumentProgress, ProcessingStage, PROCESSING_STAGES } from './types';

// ─── Pure helper functions ────────────────────────────────────────────────────

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const remainMins = minutes % 60;
  return `${hours}h ${remainMins}m`;
}

export function formatETA(seconds: number): string {
  if (seconds <= 0) return 'finishing up...';
  if (seconds < 30) return 'almost done...';
  if (seconds < 60) return `~${seconds}s left`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes === 1) return '~1 minute left';
  return `~${minutes} minutes left`;
}

export function getPhaseExplanation(
  phase: string,
  category: string,
  progress?: DocumentProgress,
): string {
  if (phase === 'queued') {
    return progress?.queuePosition
      ? `Your document is #${progress.queuePosition} in the processing queue.`
      : 'Your document is in the processing queue and will begin shortly.';
  }
  if (phase === 'extracting') {
    const pages = progress?.totalPages;
    return pages
      ? `Converting ${pages} page${pages !== 1 ? 's' : ''} to images for AI analysis...`
      : 'Converting pages to images for AI analysis...';
  }
  if (phase === 'indexing')
    return 'Building search index -- your document will be available for chat queries soon.';
  if (phase === 'analyzing') {
    const cat = category?.toLowerCase() || '';
    const pageInfo =
      progress?.pagesProcessed != null && progress?.totalPages
        ? ` (page ${progress.pagesProcessed} of ${progress.totalPages})`
        : '';
    if (
      cat.includes('plan') ||
      cat.includes('drawing') ||
      cat.includes('architectural') ||
      cat.includes('structural') ||
      cat.includes('mechanical') ||
      cat.includes('electrical') ||
      cat.includes('plumbing') ||
      cat.includes('civil')
    )
      return `AI is analyzing drawings for dimensions, room labels, and symbols${pageInfo}.`;
    if (cat.includes('spec') || cat.includes('specification'))
      return `AI is extracting material specs, product data, and requirements${pageInfo}.`;
    if (
      cat.includes('budget') ||
      cat.includes('cost') ||
      cat.includes('estimate') ||
      cat.includes('pay')
    )
      return `AI is reading line items, costs, and budget breakdowns${pageInfo}.`;
    if (
      cat.includes('schedule') ||
      cat.includes('gantt') ||
      cat.includes('timeline')
    )
      return `AI is extracting tasks, milestones, and timeline data${pageInfo}.`;
    return `AI is analyzing each page for construction details${pageInfo}.`;
  }
  return '';
}

export function getActiveStageIndex(phase: string): number {
  switch (phase) {
    case 'queued':
      return 0;
    case 'pending':
      return 0;
    case 'extracting':
      return 1;
    case 'analyzing':
      return 2;
    case 'processing':
      return 3;
    case 'indexing':
      return 4;
    case 'completed':
      return 5;
    case 'failed':
      return -1;
    default:
      return 0;
  }
}

export function getStageIcon(
  stageIndex: number,
  activeIndex: number,
  failed: boolean,
): React.ReactNode {
  if (failed && stageIndex > activeIndex) {
    return <Circle className="w-4 h-4 text-gray-600" />;
  }
  if (failed && stageIndex === activeIndex) {
    return <X className="w-4 h-4 text-red-500" />;
  }
  if (stageIndex < activeIndex) {
    return (
      <CheckCircle2
        className="w-4 h-4"
        style={{ color: semanticColors.success[500] }}
      />
    );
  }
  if (stageIndex === activeIndex) {
    return (
      <Loader2
        className="w-4 h-4 animate-spin"
        style={{ color: primaryColors.orange[500] }}
      />
    );
  }
  return <Circle className="w-4 h-4 text-gray-600" />;
}

export function getStageDetail(
  stage: ProcessingStage,
  progress: DocumentProgress | undefined,
  _category: string,
): string | null {
  if (!progress) return null;
  switch (stage) {
    case 'scanning':
      if (progress.totalPages)
        return `${progress.pagesProcessed ?? 0} of ${progress.totalPages} pages`;
      return null;
    case 'analysis': {
      const parts: string[] = [];
      if (progress.concurrency && progress.concurrency > 1) {
        parts.push(`${progress.concurrency} parallel`);
      }
      if (progress.currentBatch != null && progress.totalBatches != null) {
        parts.push(
          `Batch ${(progress.currentBatch ?? 0) + 1} of ${progress.totalBatches}`,
        );
      }
      if (progress.pagesProcessed != null && progress.totalPages) {
        parts.push(`${progress.pagesProcessed}/${progress.totalPages} pages`);
      }
      return parts.length > 0 ? parts.join(' -- ') : null;
    }
    case 'indexing':
      return 'Preparing for chat queries';
    default:
      return null;
  }
}

export function isStalled(
  progress: DocumentProgress | undefined,
  _lastPollTime: number | undefined,
): boolean {
  if (!progress || !progress.lastActivityAt) return false;
  const lastActivity = new Date(progress.lastActivityAt).getTime();
  const now = Date.now();
  return now - lastActivity > 180000;
}

export function formatLastUpdate(lastActivityAt: string | undefined): string {
  if (!lastActivityAt) return '';
  const seconds = Math.round(
    (Date.now() - new Date(lastActivityAt).getTime()) / 1000,
  );
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProcessingStatusCardProps {
  doc: Document;
  progress: DocumentProgress | undefined;
  lastPollTime: number | undefined;
  onForceResume: (documentId: string, documentName: string) => void;
}

// ─── Mobile compact variant ───────────────────────────────────────────────────

export function ProcessingStatusMobile({
  doc,
  progress,
  lastPollTime,
  onForceResume,
}: ProcessingStatusCardProps): React.ReactNode {
  const percent = progress?.percentComplete ?? 0;
  const phase = progress?.currentPhase || doc.queueStatus || 'queued';
  const stalled = isStalled(progress, lastPollTime);
  const eta = progress?.estimatedTimeRemaining ?? 0;
  const isFailed = phase === 'failed';
  const activeIdx = getActiveStageIndex(phase);
  const activeStage =
    activeIdx >= 0 && activeIdx < PROCESSING_STAGES.length
      ? PROCESSING_STAGES[activeIdx]
      : null;
  const detail = activeStage
    ? getStageDetail(activeStage.key, progress, doc.category)
    : null;

  return (
    <div className="mt-2">
      {/* Active stage name + percentage */}
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
        <span className="flex items-center gap-1.5">
          {isFailed ? (
            <X className="w-3 h-3 text-red-500 flex-shrink-0" />
          ) : (
            <Loader2
              className="w-3 h-3 animate-spin flex-shrink-0"
              style={{
                color: stalled
                  ? semanticColors.warning[500]
                  : primaryColors.orange[500],
              }}
            />
          )}
          <span className="font-medium text-slate-200 truncate">
            {isFailed ? 'Failed' : activeStage?.label || 'Processing'}
          </span>
          {progress?.concurrency && progress.concurrency > 1 && (
            <span className="text-orange-400 font-semibold flex-shrink-0">
              ({progress.concurrency}x)
            </span>
          )}
          {detail && (
            <span className="text-gray-400 truncate">{detail}</span>
          )}
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          {percent > 0 && <span>{percent}%</span>}
          {eta > 0 && !isFailed && (
            <span className="text-gray-400">{formatETA(eta)}</span>
          )}
        </span>
      </div>

      {stalled && (
        <p className="text-xs text-yellow-500/80 mb-1">
          May be paused -- will resume automatically
        </p>
      )}

      {/* Stage dots */}
      <div className="flex items-center gap-0.5 mb-1">
        {PROCESSING_STAGES.map((stage, idx) => (
          <div
            key={stage.key}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              idx < activeIdx
                ? 'bg-green-600'
                : idx === activeIdx
                ? isFailed
                  ? 'bg-red-500'
                  : stalled
                  ? 'bg-yellow-500'
                  : 'bg-orange-500'
                : 'bg-gray-700'
            }`}
            title={stage.label}
          />
        ))}
      </div>

      {/* Elapsed time */}
      {progress?.elapsedSeconds != null &&
        progress.elapsedSeconds > 0 &&
        phase !== 'queued' &&
        !isFailed && (
          <div className="text-[10px] text-gray-400">
            {formatElapsed(progress.elapsedSeconds)} elapsed
            {progress?.secondsPerPage != null &&
              progress.secondsPerPage > 0 && (
                <span>
                  {' '}
                  · {(60 / progress.secondsPerPage).toFixed(1)} pages/min
                </span>
              )}
          </div>
        )}

      {/* Force Resume button */}
      {(stalled || isFailed) && (
        <button
          type="button"
          className="mt-2 flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg w-full justify-center min-h-[44px]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onForceResume(doc.id, doc.name);
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Force Resume
        </button>
      )}
    </div>
  );
}

// ─── Desktop full variant ─────────────────────────────────────────────────────

interface ProcessingStatusDesktopProps extends ProcessingStatusCardProps {
  categoryBadge: React.ReactNode;
}

export function ProcessingStatusDesktop({
  doc,
  progress,
  lastPollTime,
  onForceResume,
  categoryBadge,
}: ProcessingStatusDesktopProps): React.ReactNode {
  const percent = progress?.percentComplete ?? 0;
  const phase = progress?.currentPhase || doc.queueStatus || 'queued';
  const stalled = isStalled(progress, lastPollTime);
  const eta = progress?.estimatedTimeRemaining ?? 0;
  const isFailed = phase === 'failed';
  const activeIdx = getActiveStageIndex(phase);
  const explanation = getPhaseExplanation(phase, doc.category, progress);

  return (
    <div className="mt-3 p-4 bg-gray-800/50 border border-gray-700 rounded-lg space-y-3">
      {/* Header row: category + percent/ETA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {categoryBadge}
          {stalled && (
            <span className="text-xs text-yellow-500 font-medium">
              May be paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {percent > 0 && (
            <span className="font-medium text-gray-400">{percent}%</span>
          )}
          {eta > 0 && phase !== 'queued' && !isFailed && (
            <span>{formatETA(eta)}</span>
          )}
        </div>
      </div>

      {/* Stage stepper */}
      <div
        className="flex items-center gap-2"
        role="list"
        aria-label="Processing stages"
      >
        {PROCESSING_STAGES.map((stage, idx) => {
          const isActive = idx === activeIdx;
          const isDone = idx < activeIdx;
          const detail = isActive
            ? getStageDetail(stage.key, progress, doc.category)
            : null;
          return (
            <div
              key={stage.key}
              className="flex items-center flex-1 min-w-0"
              role="listitem"
            >
              <div
                className={`flex items-center gap-1.5 min-w-0 ${isActive ? 'flex-1' : ''}`}
              >
                <div className="flex-shrink-0">
                  {getStageIcon(idx, activeIdx, isFailed)}
                </div>
                {isActive ? (
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-slate-50 truncate block">
                      {stage.label}
                    </span>
                    {detail && (
                      <span className="text-[10px] text-gray-400 truncate block">
                        {detail}
                      </span>
                    )}
                  </div>
                ) : (
                  <span
                    className={`text-[10px] truncate ${isDone ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    {stage.label}
                  </span>
                )}
              </div>
              {idx < PROCESSING_STAGES.length - 1 && (
                <div
                  className={`h-px flex-1 mx-1 min-w-[8px] ${isDone ? 'bg-green-700' : 'bg-gray-700'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Explanation text */}
      {explanation && (
        <p className="text-xs text-gray-400">{explanation}</p>
      )}

      {/* Progress bar */}
      <div
        className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Document processing: ${percent}%`}
      >
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            stalled
              ? 'bg-yellow-500'
              : isFailed
              ? 'bg-red-500'
              : phase === 'indexing'
              ? 'bg-green-500'
              : 'bg-orange-500'
          }`}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>

      {/* Concurrent batch lanes */}
      {progress?.concurrency &&
        progress.concurrency > 1 &&
        progress.activeBatches &&
        progress.activeBatches.length > 0 &&
        progress.totalBatches && (
          <div
            className="space-y-1"
            aria-label={`${progress.concurrency} concurrent batch lanes`}
          >
            <div className="text-[10px] text-gray-400 font-medium">
              Batch lanes ({progress.concurrency}x parallel)
            </div>
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${Math.min(progress.concurrency, 4)}, 1fr)`,
              }}
            >
              {progress.activeBatches.map((batchIdx) => {
                const isFail = progress.failedBatchRanges?.some((r) =>
                  r.startsWith(`${batchIdx}:`),
                );
                const isComplete = batchIdx < (progress.currentBatch ?? 0);
                return (
                  <div key={batchIdx} className="flex items-center gap-1">
                    <div className="flex-1 bg-gray-700 rounded h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded transition-all duration-300 ${
                          isFail
                            ? 'bg-red-500'
                            : isComplete
                            ? 'bg-green-600'
                            : 'bg-orange-500 animate-pulse'
                        }`}
                        style={{
                          width: isComplete ? '100%' : isFail ? '100%' : '60%',
                        }}
                      />
                    </div>
                    <span
                      className={`text-[9px] flex-shrink-0 ${
                        isFail
                          ? 'text-red-400'
                          : isComplete
                          ? 'text-green-500'
                          : 'text-gray-400'
                      }`}
                    >
                      B{batchIdx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
            {progress.failedBatchRanges &&
              progress.failedBatchRanges.length > 0 && (
                <div className="text-[10px] text-red-400">
                  Failed: {progress.failedBatchRanges.join(', ')}
                </div>
              )}
          </div>
        )}

      {/* Timing row + Force Resume */}
      <div className="flex items-center justify-between">
        {phase !== 'queued' && !isFailed && (
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            {progress?.elapsedSeconds != null &&
              progress.elapsedSeconds > 0 && (
                <span>Elapsed: {formatElapsed(progress.elapsedSeconds)}</span>
              )}
            {progress?.secondsPerPage != null &&
              progress.secondsPerPage > 0 && (
                <>
                  <span className="text-gray-600">·</span>
                  <span>
                    {(60 / progress.secondsPerPage).toFixed(1)} pages/min
                  </span>
                </>
              )}
            {progress?.lastActivityAt && (
              <>
                <span className="text-gray-600">·</span>
                <span>
                  Updated {formatLastUpdate(progress.lastActivityAt)}
                </span>
              </>
            )}
          </div>
        )}
        {(stalled || isFailed) && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-all ml-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onForceResume(doc.id, doc.name);
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Force Resume
          </button>
        )}
      </div>

      {/* Failed state error message */}
      {isFailed && progress?.error && (
        <p className="text-xs text-red-400">{progress.error}</p>
      )}
    </div>
  );
}
