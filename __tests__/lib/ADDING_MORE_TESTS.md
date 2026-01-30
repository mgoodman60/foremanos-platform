# Guide: Adding More Tests to Document Processor

## Quick Start Template

```typescript
describe('New Test Category', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle specific scenario', async () => {
    // 1. Setup test data
    const mockDoc = createMockDocument({ fileName: 'test.pdf' });
    const pdfBuffer = await createSimplePDF(3);

    // 2. Configure mocks
    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    // 3. Execute function
    await processDocument('doc-1');

    // 4. Verify expectations
    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          processed: true,
        }),
      })
    );
  });
});
```

## Common Test Patterns

### 1. Testing Document Classification

```typescript
it('should classify regulatory documents correctly', async () => {
  const mockDoc = createMockDocument({ fileName: 'IBC-2021-Code.pdf' });

  mockClassifyDocument.mockResolvedValue({
    processorType: 'claude-haiku-ocr',
    confidence: 0.98,
    reason: 'Regulatory document',
  });

  mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
  // ... rest of setup

  await processDocument('doc-1');

  expect(mockPrisma.document.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        processorType: 'claude-haiku-ocr',
      }),
    })
  );
});
```

### 2. Testing Error Scenarios

```typescript
it('should handle timeout errors', async () => {
  const mockDoc = createMockDocument();

  mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
  mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');

  // Simulate timeout
  global.fetch = vi.fn().mockImplementation(() =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 100)
    )
  );

  mockPrisma.document.update.mockResolvedValue(mockDoc);

  await expect(processDocument('doc-1')).rejects.toThrow('Request timeout');

  // Verify error was logged
  expect(mockPrisma.document.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        queueStatus: 'failed',
        lastProcessingError: 'Request timeout',
      }),
    })
  );
});
```

### 3. Testing Cost Calculation

```typescript
it('should calculate cost correctly for different processor types', async () => {
  const testCases = [
    { processor: 'gpt-4o-vision', pages: 10, expectedCost: 0.10 }, // $0.01/page
    { processor: 'claude-haiku-ocr', pages: 10, expectedCost: 0.01 }, // $0.001/page
    { processor: 'basic-ocr', pages: 10, expectedCost: 0.03 }, // $0.003/page
  ];

  for (const testCase of testCases) {
    vi.clearAllMocks();

    const pdfBuffer = await createSimplePDF(testCase.pages);
    const mockDoc = createMockDocument();

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockGetFileUrl.mockResolvedValue('https://s3.example.com/test.pdf');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => pdfBuffer,
    });

    mockGetPdfPageCount.mockResolvedValue(testCase.pages);
    mockProcessDocumentBatch.mockResolvedValue({
      success: true,
      pagesProcessed: testCase.pages,
    });

    mockClassifyDocument.mockResolvedValue({
      processorType: testCase.processor,
      confidence: 0.95,
    });

    mockPrisma.document.update.mockResolvedValue(mockDoc);
    mockPrisma.user.findUnique.mockResolvedValue(createMockUser());
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.processingCost.create.mockResolvedValue({ id: 'cost-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ ownerId: 'user-1' });

    await processDocument('doc-1');

    expect(mockPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processingCost: testCase.expectedCost,
        }),
      })
    );
  }
});
```

### 4. Testing Batch Operations

```typescript
it('should queue documents when quota is exceeded', async () => {
  const mockDocs = [
    createMockDocument({ id: 'doc-1', processed: false }),
    createMockDocument({ id: 'doc-2', processed: false }),
  ];

  mockPrisma.document.findMany.mockResolvedValue(mockDocs);

  // Mock quota exceeded
  const { canProcessPages } = await import('@/lib/processing-limits');
  vi.mocked(canProcessPages).mockResolvedValue({
    allowed: false,
    reason: 'daily_limit_exceeded',
  });

  const result = await processUnprocessedDocuments('project-1');

  expect(result.queued).toBeGreaterThan(0);
  expect(result.processed).toBe(0);
});
```

### 5. Testing PDF Generation for Complex Scenarios

```typescript
// Create a PDF with specific content
it('should handle PDFs with embedded images', async () => {
  // Create a more complex PDF using pdf-lib
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);

  // You can add more complex content here
  // For now, we keep it simple but realistic

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);

  // ... rest of test
});
```

## Mock Configuration Patterns

### 1. Sequential Mock Responses

```typescript
it('should retry on transient failures', async () => {
  let attemptCount = 0;

  global.fetch = vi.fn().mockImplementation(() => {
    attemptCount++;
    if (attemptCount === 1) {
      return Promise.reject(new Error('Network error'));
    }
    return Promise.resolve({
      ok: true,
      arrayBuffer: async () => await createSimplePDF(1),
    });
  });

  // ... test retry logic
});
```

### 2. Conditional Mock Behavior

```typescript
mockPrisma.document.findUnique.mockImplementation((args) => {
  if (args.where.id === 'doc-1') {
    return Promise.resolve(createMockDocument({ id: 'doc-1' }));
  }
  return Promise.resolve(null);
});
```

### 3. Spy on Mock Calls

```typescript
it('should track processing metrics', async () => {
  // ... setup and execute

  // Get all calls to verify batching logic
  const updateCalls = mockPrisma.document.update.mock.calls;

  expect(updateCalls.length).toBe(2); // Initial queue, then completion
  expect(updateCalls[0][0].data.queueStatus).toBe('queued');
  expect(updateCalls[1][0].data.queueStatus).toBe('completed');
});
```

## Testing Async Background Jobs

```typescript
it('should trigger intelligence extraction after processing', async () => {
  // Setup successful processing
  const mockDoc = createMockDocument();
  // ... standard setup

  await processDocument('doc-1');

  // Wait for async operations
  await new Promise(resolve => setTimeout(resolve, 100));

  const { runIntelligenceExtraction } = await import('@/lib/intelligence-orchestrator');

  // Verify background job was triggered (if not mocked to return immediately)
  // In our current setup, it's mocked, so we verify the mock was called
  expect(runIntelligenceExtraction).toHaveBeenCalled();
});
```

## Advanced Scenarios

### 1. Testing Quota Management

```typescript
it('should reset monthly quota at month boundary', async () => {
  const pastResetDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago

  const mockUser = createMockUser({
    pagesProcessedThisMonth: 1000,
    processingResetAt: pastResetDate,
  });

  mockPrisma.user.findUnique.mockResolvedValue(mockUser);
  mockPrisma.user.update.mockResolvedValue({ ...mockUser, pagesProcessedThisMonth: 5 });

  // ... process document

  expect(mockPrisma.user.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        pagesProcessedThisMonth: 5, // Reset to current document pages
      }),
    })
  );
});
```

### 2. Testing Drawing Type Detection

```typescript
it('should detect floor plan from sheet number', async () => {
  const mockDoc = createMockDocument({
    DocumentChunk: [
      {
        id: 'chunk-1',
        sheetNumber: 'A-101',
        titleBlockData: { sheetTitle: 'GROUND FLOOR PLAN' },
      },
    ],
  });

  mockPrisma.document.findUnique.mockResolvedValue(mockDoc);

  const { classifyDrawingWithPatterns } = await import('@/lib/drawing-classifier');
  vi.mocked(classifyDrawingWithPatterns).mockReturnValue({
    type: 'floor_plan',
    confidence: 0.95,
    discipline: 'architectural',
  });

  await classifyDrawingsFromDocument('doc-1');

  expect(classifyDrawingWithPatterns).toHaveBeenCalledWith('A-101', 'GROUND FLOOR PLAN');
});
```

### 3. Testing Legend Extraction

```typescript
it('should extract legends from mechanical drawings', async () => {
  const mockDoc = createMockDocument({
    cloud_storage_path: 'uploads/mechanical.pdf',
    DocumentChunk: [
      { pageNumber: 1, sheetNumber: 'M-201', discipline: 'mechanical' },
    ],
  });

  const pdfBuffer = await createSimplePDF(1);

  mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
  mockGetFileUrl.mockResolvedValue('https://s3.example.com/mechanical.pdf');
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => pdfBuffer,
  });

  mockConvertPdfToImages.mockResolvedValue([
    { pageNumber: 1, base64: 'base64-data', buffer: Buffer.from('img') },
  ]);

  const { detectLegendRegion } = await import('@/lib/legend-extractor');
  vi.mocked(detectLegendRegion).mockResolvedValue({
    found: true,
    confidence: 0.88,
    boundingBox: { x: 100, y: 100, width: 200, height: 300 },
  });

  await extractLegendsFromDocument('doc-1');

  expect(detectLegendRegion).toHaveBeenCalled();
});
```

## Debugging Test Failures

### 1. Inspect Mock Calls

```typescript
// After test execution
console.log('Update calls:', mockPrisma.document.update.mock.calls);
console.log('First call data:', mockPrisma.document.update.mock.calls[0][0].data);
```

### 2. Verify Mock Setup

```typescript
it('should debug mock behavior', async () => {
  // Add this to see what mocks are being called
  mockPrisma.document.findUnique.mockImplementation((args) => {
    console.log('findUnique called with:', args);
    return Promise.resolve(createMockDocument());
  });

  await processDocument('doc-1');
});
```

### 3. Test Isolation

```typescript
// If tests interfere with each other, use afterEach
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
```

## Running Specific Tests

```bash
# Run single test by name
npm test -- __tests__/lib/document-processor.test.ts -t "should extract text from DOCX" --run

# Run test suite by describe block
npm test -- __tests__/lib/document-processor.test.ts -t "Text Extraction" --run

# Run with verbose output
npm test -- __tests__/lib/document-processor.test.ts --reporter=verbose --run

# Run with coverage for specific file
npm test -- __tests__/lib/document-processor.test.ts --coverage --run
```

## Best Practices

1. **Clear Mock State**: Always use `vi.clearAllMocks()` in `beforeEach`
2. **Realistic Data**: Use `createSimplePDF()` for actual PDF buffers
3. **Complete Setup**: Mock all dependencies the function needs
4. **Verify Side Effects**: Check database updates, not just return values
5. **Test Edge Cases**: Empty files, huge files, corrupt files, missing data
6. **Type Safety**: Use TypeScript types and `vi.mocked()` for type checking
7. **Descriptive Names**: Test names should clearly describe the scenario
8. **Single Responsibility**: Each test should verify one specific behavior

## Common Pitfalls

1. **Forgetting to mock global.fetch** - Always mock for S3 operations
2. **Not awaiting async operations** - Use `await` for all Promise-based calls
3. **Shared state between tests** - Use `beforeEach` to reset mocks
4. **Incomplete mock chains** - Mock all methods called in the execution path
5. **Not verifying the right calls** - Use `expect.objectContaining()` for partial matching
