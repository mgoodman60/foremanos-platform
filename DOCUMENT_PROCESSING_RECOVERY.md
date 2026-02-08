# Document Processing Recovery System

This system provides multiple layers of protection against documents getting stuck during processing.

## Features

### 1. Manual Reprocess Button (UI)

**Location**: Schedule Documents page (`/project/[slug]/schedules`)

**When it appears**: 
- Document is not processed
- No processing progress is being tracked
- Document appears stuck

**What it does**:
- Triggers a full reprocessing of the document
- Clears any failed queue entries
- Restarts processing from scratch

**How to use**:
1. Navigate to the Schedule Documents section
2. Look for documents with the "Reprocess" button (blue, with warning icon)
3. Click the button to restart processing
4. Progress bar will appear showing processing status

### 2. Automatic Processing on Upload

**Prevention**: Documents are now automatically queued for processing immediately after upload.

**What changed**:
- The upload-complete endpoint now triggers `processDocument()` automatically
- If processing fails to start, the document is marked as failed with error details
- Quota checks happen before processing starts

**Error handling**:
- Processing failures are logged to the database
- Documents are marked with `queueStatus: 'failed'`
- Error messages are stored in `lastProcessingError` field

### 3. Orphaned Document Detection

**What it detects**:
- Documents uploaded but never queued for processing
- Documents older than 5 minutes with:
  - `processed: false`
  - 0 chunks in the database
  - No active processing queue entry
  - Valid cloud storage path

**Automatic Recovery**:
```typescript
import { recoverAllOrphanedDocuments } from '@/lib/orphaned-document-recovery';

// Recover all orphaned documents
const recoveredCount = await recoverAllOrphanedDocuments();
```

### 4. Admin Recovery API

**Endpoints**:

#### GET /api/admin/recover-orphaned-documents
Get statistics about orphaned documents

**Response**:
```json
{
  "success": true,
  "count": 2,
  "oldestOrphan": "2026-01-11T04:15:03.000Z",
  "totalOrphanedDocs": [
    {
      "id": "cmk980b410001ng08agojvsj6",
      "name": "Schedule",
      "fileName": "Schedule.pdf",
      "projectId": "...",
      "createdAt": "2026-01-11T04:15:03.000Z",
      "cloud_storage_path": "uploads/1736567703000-Schedule.pdf"
    }
  ]
}
```

#### POST /api/admin/recover-orphaned-documents
Manually trigger recovery for all orphaned documents

**Response**:
```json
{
  "success": true,
  "recoveredCount": 2,
  "message": "Recovery complete: 2 document(s) recovered"
}
```

**Access**: Admin only

### 5. Automated Recovery Script

**Script**: `scripts/recover-orphaned-documents.ts`

**Manual execution**:
```bash
cd /home/ubuntu/construction_project_assistant/nextjs_space
npx tsx scripts/recover-orphaned-documents.ts
```

**Scheduled execution (cron)**:
```bash
# Edit crontab
crontab -e

# Add this line to run every hour
0 * * * * cd /home/ubuntu/construction_project_assistant/nextjs_space && npx tsx scripts/recover-orphaned-documents.ts >> /var/log/orphan-recovery.log 2>&1
```

**Output**:
```
=== Orphaned Document Recovery ===
Started at: 2026-01-11T16:30:00.000Z

[ORPHAN RECOVERY] Starting scan for orphaned documents...
[ORPHAN RECOVERY] Found 2 orphaned documents:
  - Schedule (cmk980b410001ng08agojvsj6) - Created: Sun Jan 11 2026 04:15:03 GMT+0000
  - Plans (cmk8stjp30001rw08ex2s71jd) - Created: Sat Jan 10 2026 21:09:54 GMT+0000
[ORPHAN RECOVERY] Starting recovery for document cmk980b410001ng08agojvsj6
[ORPHAN RECOVERY] Successfully initiated recovery for Schedule
[ORPHAN RECOVERY] Recovery complete: 2/2 documents recovered

=== Recovery Summary ===
Total documents recovered: 2
Completed at: 2026-01-11T16:30:15.000Z

✅ Recovery successful!
```

## Architecture

### Files Changed/Added

**New Files**:
- `lib/orphaned-document-recovery.ts` - Core recovery logic
- `app/api/admin/recover-orphaned-documents/route.ts` - Admin API
- `scripts/recover-orphaned-documents.ts` - Standalone recovery script
- `DOCUMENT_PROCESSING_RECOVERY.md` - This documentation

**Modified Files**:
- `app/project/[slug]/schedules/page.tsx` - Added reprocess button UI
- `app/api/documents/upload-complete/route.ts` - Added automatic processing trigger

### Recovery Flow

1. **Detection Phase**
   - Query database for unprocessed documents
   - Filter by creation time (>5 minutes old)
   - Check for 0 chunks
   - Verify no active queue entries

2. **Recovery Phase**
   - Delete any orphaned chunks
   - Delete failed queue entries
   - Call `processDocument()` to restart processing

3. **Monitoring Phase**
   - Processing status updates via existing queue system
   - Progress tracked in UI
   - Logs written to console

## Troubleshooting

### Document still stuck after reprocess?

1. Check the server logs for errors
2. Verify the document file exists in S3
3. Check user's processing quota
4. Verify document processor type is correct

### How to check processing queue manually?

```typescript
import { prisma } from '@/lib/db';

const queue = await prisma.processingQueue.findMany({
  where: {
    documentId: 'your-document-id'
  },
  orderBy: { createdAt: 'desc' }
});

console.log(queue);
```

### How to manually trigger processing?

```bash
# Via API (requires admin auth)
curl -X POST https://foremanos.site/api/admin/recover-orphaned-documents \
  -H "Cookie: your-session-cookie"

# Via script
cd /home/ubuntu/construction_project_assistant/nextjs_space
npx tsx scripts/recover-orphaned-documents.ts
```

## Best Practices

1. **Monitor orphaned documents**: Set up the cron job to run hourly
2. **Check logs regularly**: Look for processing errors in server logs
3. **User notifications**: Inform users when their documents fail to process
4. **Quota management**: Ensure users have sufficient processing quota
5. **S3 health**: Monitor S3 connectivity and bucket access

## Phase 2: Reliability Fixes (February 2026)

Phase 2 addressed six reliability issues (C1-C6) that caused duplicate processing, stuck documents, and redundant work.

### C1: Batch Sequencing

**Problem**: Documents uploaded between batch cycles could be picked up by multiple workers, causing duplicate processing.

**Fix**: Documents queued between batches are now sequenced with batch-aware ordering. The batch processor checks for in-flight documents before starting a new batch, preventing overlapping processing windows.

### C2: Reprocess Cooldown

**Problem**: Users or automated systems could trigger reprocessing on documents that were recently processed, wasting resources.

**Fix**: A 60-minute cooldown prevents re-processing of recently processed documents. Reprocess requests within the cooldown window return HTTP 429 (Too Many Requests) with a message indicating when the document can be reprocessed.

### C3: Atomic Dedup

**Problem**: Race conditions allowed multiple workers to extract the same chunk simultaneously, creating duplicate entries.

**Fix**: Uses `updateMany` with a `count === 0` check as an atomic guard. If another worker has already claimed the chunk (count > 0), the current worker skips extraction for that chunk. This eliminates duplicate chunk creation without requiring distributed locks.

### C4: Takeoff Dedup

**Problem**: `triggerAutoTakeoff` was called redundantly during reprocessing, creating duplicate takeoff entries.

**Fix**: `triggerAutoTakeoff` is no longer invoked during document reprocessing. Takeoffs are only triggered on initial processing, preventing duplicate material quantity records.

### C5: Retry-Failed Cleanup

**Problem**: When re-queuing failed documents, stale chunks from the previous failed attempt remained in the database, causing data inconsistency.

**Fix**: `deleteMany` clears all existing chunks for the document before re-queuing failed documents. This ensures a clean slate for the retry attempt.

### C6: Fire-and-Forget Error Handling

**Problem**: Unhandled errors in background processing (fire-and-forget `processDocument()` calls) left documents stuck in "processing" status indefinitely.

**Fix**: All fire-and-forget processing calls now wrap execution in try/catch blocks that set `document.queueStatus = 'failed'` and record the error in `lastProcessingError` on any unhandled exception. Documents no longer get permanently stuck.

### Summary of Changes

| Fix | File(s) Modified | Impact |
|-----|------------------|--------|
| C1 | `lib/document-processor-batch.ts` | Eliminates duplicate batch processing |
| C2 | `app/api/documents/[id]/reprocess/route.ts` | 60-min cooldown on reprocessing |
| C3 | `lib/document-processor-batch.ts` | Atomic chunk deduplication |
| C4 | `lib/document-processor.ts` | No redundant takeoff triggers |
| C5 | `lib/document-processor.ts` | Clean retry for failed documents |
| C6 | `app/api/documents/upload-complete/route.ts` | Failed status on background errors |

## Future Improvements

- [ ] Add email notifications for failed processing
- [ ] Create admin dashboard widget for orphaned documents
- [x] ~~Add retry limits to prevent infinite recovery loops~~ (addressed by C2 cooldown)
- [ ] Implement exponential backoff for recovery attempts
- [ ] Add Slack/webhook notifications for critical failures
- [x] ~~Handle fire-and-forget error scenarios~~ (addressed by C6)
