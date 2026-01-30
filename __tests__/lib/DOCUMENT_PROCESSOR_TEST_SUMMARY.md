# Document Processor Integration Tests

## Overview
Comprehensive integration tests for `lib/document-processor.ts` covering document processing, text extraction, classification, and error handling.

## Test File Location
`c:\Users\msgoo\foremanos\__tests__\lib\document-processor.test.ts`

## Test Coverage (17 tests total)

### 1. PDF Processing (5 tests)
- ✅ **Successfully process small PDFs (≤10 pages)**
  - Verifies immediate processing for documents with 10 or fewer pages
  - Checks that `processDocumentBatch` is called with correct parameters
  - Validates document status is updated to `processed: true`

- ✅ **Queue large PDFs (>10 pages) for batch processing**
  - Tests queuing mechanism for large documents
  - Verifies `queueDocumentForProcessing` is called
  - Confirms document status is set to `queued` with `pagesProcessed: 0`

- ✅ **Handle PDF download errors gracefully**
  - Tests S3 download failures
  - Verifies error is logged to `lastProcessingError`
  - Confirms document status is set to `failed`

- ✅ **Handle corrupt PDF files**
  - Tests invalid PDF structure errors
  - Verifies graceful error handling
  - Confirms document is marked as failed

- ✅ **Skip already processed documents**
  - Tests idempotency - prevents reprocessing
  - Verifies no S3 downloads or processing calls are made

### 2. Text Extraction (3 tests)
- ✅ **Extract text from DOCX files**
  - Tests mammoth library integration
  - Verifies text chunking for RAG system
  - Validates metadata includes `source: 'docx_extraction'`

- ✅ **Handle DOCX files with no text content**
  - Tests empty document handling
  - Verifies document still marked as processed with 1 page

- ✅ **Chunk DOCX text at paragraph boundaries**
  - Tests intelligent chunking algorithm
  - Verifies multiple chunks created for long documents
  - Validates chunk metadata includes `totalChunks` and `chunkIndex`

### 3. Classification Pipeline (4 tests)
- ✅ **Classify architectural plans correctly**
  - Tests classification parameter passing
  - Verifies `gpt-4o-vision` processor assignment

- ✅ **Classify specifications as text-heavy documents**
  - Tests CSI specification detection
  - Verifies `claude-haiku-ocr` processor assignment

- ✅ **Assign appropriate processor types based on classification**
  - Batch tests for multiple file types:
    - Door Schedule → `claude-haiku-ocr`
    - Site Plan → `gpt-4o-vision`
    - Equipment Schedule → `claude-haiku-ocr`

- ✅ **Handle unsupported file formats gracefully**
  - Tests XLSX and other unsupported formats
  - Verifies marking as processed with 1 page and 0 cost

### 4. Error Handling (3 tests)
- ✅ **Handle document not found errors**
  - Tests missing document ID
  - Verifies appropriate error is thrown

- ✅ **Handle missing cloud storage path**
  - Tests documents without S3 path
  - Verifies validation error

- ✅ **Update document with error status on processing failure**
  - Tests network timeout scenario
  - Verifies error message is stored in `lastProcessingError`
  - Confirms `queueStatus: 'failed'` is set

### 5. Batch Processing (2 tests)
- ✅ **Process unprocessed documents in a project**
  - Tests `processUnprocessedDocuments` function
  - Verifies only unprocessed documents are processed
  - Validates return statistics

- ✅ **Handle mixed success/failure in batch processing**
  - Tests partial failure scenarios
  - Verifies error tracking and statistics
  - Confirms processing continues despite individual failures

### 6. Title Block Extraction (2 tests)
- ✅ **Extract title blocks from first page**
  - Tests integration with `title-block-extractor`
  - Verifies PDF to image conversion
  - Validates extraction of sheet metadata

- ✅ **Handle documents without title blocks gracefully**
  - Tests empty chunk scenarios
  - Verifies no errors thrown

### 7. Drawing Classification (1 test)
- ✅ **Classify drawings by sheet number and title**
  - Tests `classifyDrawingsFromDocument` function
  - Verifies pattern-based classification
  - Validates storage of classification results

## Mocked Dependencies

### Core Services
- **Prisma** (`@/lib/db`) - Database operations
- **S3** (`@/lib/s3`) - File storage and retrieval
- **Document Classifier** (`@/lib/document-classifier`) - AI classification
- **Mammoth** (`mammoth`) - DOCX text extraction
- **PDF to Image** (`@/lib/pdf-to-image`) - PDF page extraction

### Processing Modules
- **Document Processor Batch** (`@/lib/document-processor-batch`) - Batch processing
- **Processing Limits** (`@/lib/processing-limits`) - Quota management
- **Title Block Extractor** (`@/lib/title-block-extractor`) - Sheet metadata
- **Drawing Classifier** (`@/lib/drawing-classifier`) - Drawing type detection

### Background Services (Mocked to prevent side effects)
- **Intelligence Orchestrator** (`@/lib/intelligence-orchestrator`)
- **Room Extractor** (`@/lib/room-extractor`)
- **Document Auto-sync** (`@/lib/document-auto-sync`)
- **Schedule Extractor AI** (`@/lib/schedule-extractor-ai`)
- **Document Processing Queue** (`@/lib/document-processing-queue`)
- **Onboarding Tracker** (`@/lib/onboarding-tracker`)

## Test Helpers

### Mock Data Generators
```typescript
createMockDocument(overrides) // Generate test document objects
createMockUser(overrides)     // Generate test user objects
createSimplePDF(pageCount)    // Generate valid PDF buffers using pdf-lib
```

### Assertions
- Document status updates (processed, failed, queued)
- Processor type assignment
- Cost calculation
- Error logging
- Chunk creation and metadata

## Running the Tests

```bash
# Run all document processor tests
npm test -- __tests__/lib/document-processor.test.ts --run

# Run with coverage
npm test -- __tests__/lib/document-processor.test.ts --coverage --run

# Run specific test suite
npm test -- __tests__/lib/document-processor.test.ts -t "PDF Processing" --run

# Run in watch mode (for development)
npm test -- __tests__/lib/document-processor.test.ts
```

## Key Patterns Used

### 1. Comprehensive Mocking
All external dependencies are mocked to ensure isolated testing:
- Database operations (Prisma)
- File storage (S3)
- External APIs (vision, OCR)
- Background jobs (intelligence extraction, etc.)

### 2. Real PDF Generation
Uses `pdf-lib` to generate actual valid PDF buffers for realistic testing.

### 3. Error Scenario Coverage
Tests both happy path and error cases:
- Network failures
- Corrupt files
- Missing data
- Processing failures

### 4. State Verification
Tests verify:
- Database updates with correct data
- Proper error logging
- Correct processor assignment
- Accurate cost tracking

### 5. Type Safety
Uses TypeScript and `vi.mocked()` for type-safe mock access.

## Integration Points Tested

1. **Document Classification Flow**
   - File name analysis
   - Processor type selection
   - Confidence scoring

2. **Processing Pipeline**
   - Small doc immediate processing
   - Large doc queuing
   - Batch processing coordination

3. **Text Extraction**
   - PDF page extraction
   - DOCX text extraction
   - Chunk creation for RAG

4. **Metadata Extraction**
   - Title block detection
   - Sheet number parsing
   - Drawing classification

5. **Error Recovery**
   - Download failures
   - Processing failures
   - Status tracking

## Future Test Additions

Consider adding tests for:
1. **Scale Detection** - When `extractScalesFromDocument` is re-enabled
2. **Legend Extraction** - Full integration test with vision API
3. **Concurrent Processing** - Multiple documents simultaneously
4. **Retry Logic** - Network failure retry scenarios
5. **Cost Calculation** - Different processor types and page counts
6. **Quota Management** - Monthly limit enforcement

## Notes

- Tests use `vi.clearAllMocks()` in `beforeEach` to ensure clean state
- Global `fetch` is mocked for S3 download simulation
- Tests avoid calling real external services (S3, OpenAI, Anthropic)
- Background job mocks prevent unintended side effects during testing
- Tests are compatible with Vitest 2.1.9 and Node.js v25 (pool: 'forks')

## Related Files

- Source: `c:\Users\msgoo\foremanos\lib\document-processor.ts`
- Mocks: `c:\Users\msgoo\foremanos\__tests__\mocks\shared-mocks.ts`
- Helpers: `c:\Users\msgoo\foremanos\__tests__\helpers\test-utils.ts`
- Config: `c:\Users\msgoo\foremanos\vitest.config.ts`
