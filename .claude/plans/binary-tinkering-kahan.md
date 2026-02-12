# Fix: Document Processing Progress UX

## Context

After the OOM/fire-and-forget fix landed, large document processing now works. However, the UX gives users no confidence it's working:

- **Dead zone during first batch**: When processing starts, `pagesProcessed` stays 0 until batch 1 completes (~2-5 minutes for 5 pages). During this time, the UI shows "Extracting content..." with a 0% progress bar and no activity indicator. Users think it's stuck.
- **No heartbeat**: No "last activity" or elapsed time shown, so users can't distinguish "actively working" from "silently crashed."
- **Batch number bug in document library**: `currentBatch` is 0-indexed from the API but displayed raw (shows "batch 0 of 10" instead of "batch 1 of 10"). The monitor component correctly adds +1, but document-library.tsx does not.
- **Misleading phase label**: "Extracting content..." implies a quick local operation, not a multi-minute AI vision call.
- **5s polling during active processing**: Could be 3s for more responsive feedback.

## Changes

### 1. API: Add `updatedAt` and `startedAt` to progress endpoint

**File**: `app/api/documents/[id]/progress/route.ts`

Add `updatedAt` and `createdAt` from the ProcessingQueue to the response so the UI can show elapsed time and last activity:

```typescript
// Add to queueEntry select (line 50-58):
updatedAt: true,

// Add to response (line 100-111):
startedAt: queueEntry?.createdAt?.toISOString() || null,
lastActivity: queueEntry?.updatedAt?.toISOString() || null,
```

Also fix the phase logic (lines 72-79): when `status === 'processing'` and `pagesProcessed === 0`, use `'analyzing'` instead of `'extracting'` — because we ARE analyzing (calling vision API), not doing local extraction. The "extracting" label is misleading.

```typescript
// Replace lines 72-79:
} else if (queueEntry?.status === 'processing') {
  currentPhase = 'analyzing'; // Always 'analyzing' when actively processing
  if (percentComplete >= 80) {
    currentPhase = 'indexing';
  }
}
```

### 2. Document Library: Fix batch display, add activity indicators, faster polling

**File**: `components/document-library.tsx`

#### 2a. Fix 0-indexed batch number (lines 1297, 1425)

Change `progress.currentBatch` to `(progress.currentBatch ?? 0) + 1` in both mobile and desktop views.

#### 2b. Improve phase messaging (mobile lines 1289-1298, desktop lines 1417-1426)

Replace the phase text blocks with better messaging that always shows batch context:

- **queued**: "Waiting in queue (position X) -- Y pages to process" (unchanged)
- **analyzing (0 pages)**: "AI analyzing pages 1-5... (batch 1 of 10)" with a pulsing indicator
- **analyzing (>0 pages)**: "AI analyzing page X of Y (batch B of T)..."
- **indexing**: "Indexing content for search..."
- **processing** (fallback): "Processing batch B of T (page X of Y)..."

#### 2c. Add elapsed time and last activity indicator

Below the progress bar, show:
- Left: "Started X ago" (from `startedAt`)
- Right: "Last activity Xs ago" (from `lastActivity`) -- turns yellow if >30s, red if >60s

#### 2d. Faster polling during active processing (line 165)

Change `setInterval(fetchProgress, 5000)` to `setInterval(fetchProgress, 3000)` for more responsive updates during active processing.

### 3. Processing Monitor: Same improvements

**File**: `components/document-processing-monitor.tsx`

#### 3a. Fix phase label for "extracting" (lines 130-148)

Update `getPhaseLabel` to show batch info when available:

```typescript
case 'extracting':
  return `AI analyzing pages...${hasBatch ? ` (batch ${batch + 1} of ${total})` : ''}`;
case 'analyzing':
  return `AI analyzing page ${progress.pagesProcessed} of ${progress.totalPages}${hasBatch ? ` (batch ${batch + 1} of ${total})` : ''}...`;
```

#### 3b. Add elapsed/activity timestamps (line 337-349)

Add "Started X ago" and "Last activity Xs ago" alongside the existing batch and ETA info.

#### 3c. Faster polling for active docs (line 119)

Change `setInterval(fetchProgress, 5000)` to `setInterval(fetchProgress, 3000)`.

### 4. Update DocumentProgress interface

**Files**: `components/document-library.tsx` (line 31), `components/document-processing-monitor.tsx` (line 32)

Add the new fields to the `DocumentProgress` interface:

```typescript
interface DocumentProgress {
  // ... existing fields ...
  startedAt: string | null;
  lastActivity: string | null;
}
```

## Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `app/api/documents/[id]/progress/route.ts` | Add timestamps, fix phase logic | API returns more data |
| `components/document-library.tsx` | Fix batch +1, better messages, elapsed time, 3s polling | Main document list UX |
| `components/document-processing-monitor.tsx` | Same UX improvements | Processing monitor page |

## What's NOT Changing

- Upload flow (presign -> R2 -> confirm) -- unrelated
- Batch processing logic -- already fixed
- ProcessingQueue schema -- no migrations needed
- Other components (ProcessingProgressCard, DocumentProcessingStatus) -- lower priority

## Verification

1. `npm run build` -- type check
2. Upload a >10 page PDF on production
3. Confirm: during first batch (0 pages done), UI shows "AI analyzing pages 1-5... (batch 1 of 10)" with elapsed time
4. Confirm: batch number shows correctly (1-indexed, not 0-indexed)
5. Confirm: "Last activity Xs ago" updates every 3s and stays green
6. Confirm: after batch 1 completes, progress bar jumps to ~10% with "5 of 50 pages"
