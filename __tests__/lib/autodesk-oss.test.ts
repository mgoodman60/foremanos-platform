import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock autodesk-auth module with vi.hoisted
const { mockGetAccessToken } = vi.hoisted(() => ({
  mockGetAccessToken: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/autodesk-auth', () => ({
  getAccessToken: mockGetAccessToken,
}));

// Set environment variable for bucket naming
const originalEnv = process.env.NODE_ENV;

// Import functions after mocks
import {
  ensureBucket,
  uploadFile,
  getObjectUrn,
  deleteObject,
  BUCKET_KEY,
} from '@/lib/autodesk-oss';

// ============================================
// Test Helpers
// ============================================

function createMockBucketDetails(overrides = {}) {
  return {
    bucketKey: BUCKET_KEY,
    bucketOwner: 'autodesk-id-123',
    createdDate: 1704067200000,
    permissions: [{ authId: 'client-id', access: 'full' }],
    policyKey: 'transient',
    ...overrides,
  };
}

function createMockUploadedObject(objectKey: string, overrides = {}) {
  return {
    bucketKey: BUCKET_KEY,
    objectId: `urn:adsk.objects:os.object:${BUCKET_KEY}/${objectKey}`,
    objectKey,
    sha1: 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3',
    size: 1024,
    location: `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${objectKey}`,
    ...overrides,
  };
}

function createMockFetchResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

// ============================================
// Bucket Management Tests
// ============================================

describe('Autodesk OSS - Bucket Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('test-access-token');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('ensureBucket', () => {
    it('should return existing bucket if it exists', async () => {
      const mockBucket = createMockBucketDetails();

      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse(mockBucket) as any
      );

      const result = await ensureBucket();

      expect(result).toEqual(mockBucket);
      expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/buckets/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
          }),
        })
      );
    });

    it('should create new bucket if it does not exist', async () => {
      const mockBucket = createMockBucketDetails();

      // First call (get bucket) returns 404
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(null, false, 404) as any)
        // Second call (create bucket) succeeds
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any);

      const result = await ensureBucket();

      expect(result).toEqual(mockBucket);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify create bucket request
      const createCall = vi.mocked(global.fetch).mock.calls[1];
      expect(createCall[0]).toContain('/buckets');
      expect(createCall[1]).toMatchObject({
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-access-token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should use transient policy for created buckets', async () => {
      const mockBucket = createMockBucketDetails({ policyKey: 'transient' });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(null, false, 404) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any);

      await ensureBucket();

      const createCall = vi.mocked(global.fetch).mock.calls[1];
      const requestBody = JSON.parse(createCall[1]!.body as string);

      expect(requestBody).toMatchObject({
        bucketKey: BUCKET_KEY,
        access: 'full',
        policyKey: 'transient',
      });
    });

    it('should handle 409 conflict by fetching existing bucket', async () => {
      const mockBucket = createMockBucketDetails();

      // First call (get) fails
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(null, false, 404) as any)
        // Second call (create) returns 409 conflict
        .mockResolvedValueOnce(createMockFetchResponse({ reason: 'Bucket already exists' }, false, 409) as any)
        // Third call (get again) succeeds
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any);

      const result = await ensureBucket();

      expect(result).toEqual(mockBucket);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error if bucket creation fails with non-409 error', async () => {
      const errorMessage = 'Invalid credentials';

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(null, false, 404) as any)
        .mockResolvedValueOnce(createMockFetchResponse({ error: errorMessage }, false, 401) as any);

      await expect(ensureBucket()).rejects.toThrow('Failed to create bucket');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error if bucket not found after 409 conflict', async () => {
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(null, false, 404) as any)
        .mockResolvedValueOnce(createMockFetchResponse({ reason: 'Conflict' }, false, 409) as any)
        .mockResolvedValueOnce(createMockFetchResponse(null, false, 404) as any);

      await expect(ensureBucket()).rejects.toThrow('Failed to create bucket');
    });

    it('should handle fetch errors during bucket retrieval', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      // On error, it should try to create the bucket
      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse(createMockBucketDetails()) as any
      );

      const result = await ensureBucket();

      expect(result).toHaveProperty('bucketKey');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should use correct bucket key format based on NODE_ENV', () => {
      // Bucket key should be lowercase and sanitized
      expect(BUCKET_KEY).toMatch(/^foremanos_[a-z0-9_-]+$/);
      expect(BUCKET_KEY).not.toContain(' ');
      expect(BUCKET_KEY).not.toContain('.');
    });
  });
});

// ============================================
// File Upload Tests
// ============================================

describe('Autodesk OSS - File Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('test-access-token');
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('should successfully upload a file using 3-step S3 process', async () => {
      const fileName = 'test-plan.pdf';
      const fileBuffer = Buffer.from('mock-pdf-content');
      const contentType = 'application/pdf';
      const objectKey = expect.stringMatching(/^\d+_test-plan\.pdf$/);

      const mockBucket = createMockBucketDetails();
      const mockSignedData = {
        uploadKey: 'upload-key-123',
        urls: ['https://s3.amazonaws.com/presigned-url'],
      };
      const mockUploadedObject = createMockUploadedObject(fileName);

      vi.mocked(global.fetch)
        // ensureBucket call
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
        // Step 1: Get signed URL
        .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
        // Step 2: Upload to S3
        .mockResolvedValueOnce(createMockFetchResponse({}, true, 200) as any)
        // Step 3: Complete upload
        .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

      const result = await uploadFile(fileName, fileBuffer, contentType);

      expect(result).toEqual(mockUploadedObject);
      expect(global.fetch).toHaveBeenCalledTimes(4);

      // Verify Step 1: Get signed URL
      const signedUrlCall = vi.mocked(global.fetch).mock.calls[1];
      expect(signedUrlCall[0]).toContain('/signeds3upload');
      expect(signedUrlCall[1]).toMatchObject({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-access-token',
        }),
      });

      // Verify Step 2: Upload to S3
      const s3UploadCall = vi.mocked(global.fetch).mock.calls[2];
      expect(s3UploadCall[0]).toBe(mockSignedData.urls[0]);
      expect(s3UploadCall[1]).toMatchObject({
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: fileBuffer,
      });

      // Verify Step 3: Complete upload
      const completeCall = vi.mocked(global.fetch).mock.calls[3];
      expect(completeCall[0]).toContain('/signeds3upload');
      expect(completeCall[1]).toMatchObject({
        method: 'POST',
      });
    });

    it('should sanitize file names with special characters', async () => {
      const fileName = 'test file (1) @#$.pdf';
      const fileBuffer = Buffer.from('content');
      const contentType = 'application/pdf';

      const mockBucket = createMockBucketDetails();
      const mockSignedData = {
        uploadKey: 'upload-key',
        urls: ['https://s3.amazonaws.com/url'],
      };
      const mockUploadedObject = createMockUploadedObject('test_file__1______.pdf');

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
        .mockResolvedValueOnce(createMockFetchResponse({}) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

      await uploadFile(fileName, fileBuffer, contentType);

      // Check that the object key in the signed URL request is sanitized
      const signedUrlCall = vi.mocked(global.fetch).mock.calls[1];
      const urlPath = signedUrlCall[0] as string;

      // Should not contain special characters
      expect(urlPath).not.toContain(' ');
      expect(urlPath).not.toContain('(');
      expect(urlPath).not.toContain(')');
      expect(urlPath).not.toContain('@');
      expect(urlPath).not.toContain('#');
      expect(urlPath).not.toContain('$');
    });

    it('should include timestamp in object key for uniqueness', async () => {
      const fileName = 'plan.pdf';
      const fileBuffer = Buffer.from('content');
      const contentType = 'application/pdf';

      const mockBucket = createMockBucketDetails();
      const mockSignedData = {
        uploadKey: 'upload-key',
        urls: ['https://s3.amazonaws.com/url'],
      };
      const mockUploadedObject = createMockUploadedObject('1234567890_plan.pdf');

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
        .mockResolvedValueOnce(createMockFetchResponse({}) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

      await uploadFile(fileName, fileBuffer, contentType);

      const signedUrlCall = vi.mocked(global.fetch).mock.calls[1];
      const urlPath = signedUrlCall[0] as string;

      // Should contain timestamp prefix
      expect(urlPath).toMatch(/\/objects\/\d+_plan\.pdf\//);
    });

    it('should throw error if signed URL request fails', async () => {
      const mockBucket = createMockBucketDetails();
      const errorMessage = 'Invalid bucket access';

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
        .mockResolvedValueOnce(createMockFetchResponse({ error: errorMessage }, false, 403) as any);

      await expect(
        uploadFile('test.pdf', Buffer.from('content'), 'application/pdf')
      ).rejects.toThrow('Failed to get signed upload URL');
    });

    it('should throw error if S3 upload fails', async () => {
      const mockBucket = createMockBucketDetails();
      const mockSignedData = {
        uploadKey: 'upload-key',
        urls: ['https://s3.amazonaws.com/url'],
      };
      const s3Error = 'Access Denied';

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
        .mockResolvedValueOnce(createMockFetchResponse({ error: s3Error }, false, 403) as any);

      await expect(
        uploadFile('test.pdf', Buffer.from('content'), 'application/pdf')
      ).rejects.toThrow('Failed to upload to S3');
    });

    it('should throw error if upload completion fails', async () => {
      const mockBucket = createMockBucketDetails();
      const mockSignedData = {
        uploadKey: 'upload-key',
        urls: ['https://s3.amazonaws.com/url'],
      };
      const completionError = 'Upload key expired';

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
        .mockResolvedValueOnce(createMockFetchResponse({}) as any)
        .mockResolvedValueOnce(createMockFetchResponse({ error: completionError }, false, 400) as any);

      await expect(
        uploadFile('test.pdf', Buffer.from('content'), 'application/pdf')
      ).rejects.toThrow('Failed to complete upload');
    });

    it('should handle large file uploads', async () => {
      const fileName = 'large-model.rvt';
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      const contentType = 'application/octet-stream';

      const mockBucket = createMockBucketDetails();
      const mockSignedData = {
        uploadKey: 'upload-key',
        urls: ['https://s3.amazonaws.com/url'],
      };
      const mockUploadedObject = createMockUploadedObject('large-model.rvt', {
        size: largeBuffer.length,
      });

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
        .mockResolvedValueOnce(createMockFetchResponse({}) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

      const result = await uploadFile(fileName, largeBuffer, contentType);

      expect(result.size).toBe(largeBuffer.length);

      // Verify buffer was passed to S3 upload
      const s3UploadCall = vi.mocked(global.fetch).mock.calls[2];
      expect(s3UploadCall[1]!.body).toBe(largeBuffer);
    });

    it('should handle different content types correctly', async () => {
      const testCases = [
        { fileName: 'drawing.dwg', contentType: 'application/acad' },
        { fileName: 'model.rvt', contentType: 'application/octet-stream' },
        { fileName: 'spec.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { fileName: 'photo.jpg', contentType: 'image/jpeg' },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        const mockBucket = createMockBucketDetails();
        const mockSignedData = {
          uploadKey: 'upload-key',
          urls: ['https://s3.amazonaws.com/url'],
        };
        const mockUploadedObject = createMockUploadedObject(testCase.fileName);

        vi.mocked(global.fetch)
          .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
          .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
          .mockResolvedValueOnce(createMockFetchResponse({}) as any)
          .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

        await uploadFile(testCase.fileName, Buffer.from('content'), testCase.contentType);

        // Verify content type was passed to S3
        const s3UploadCall = vi.mocked(global.fetch).mock.calls[2];
        expect(s3UploadCall[1]).toMatchObject({
          headers: {
            'Content-Type': testCase.contentType,
          },
        });
      }
    });

    it('should log progress through the upload steps', async () => {
      const mockBucket = createMockBucketDetails();
      const mockSignedData = {
        uploadKey: 'upload-key',
        urls: ['https://s3.amazonaws.com/url'],
      };
      const mockUploadedObject = createMockUploadedObject('test.pdf');

      vi.mocked(global.fetch)
        .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
        .mockResolvedValueOnce(createMockFetchResponse({}) as any)
        .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

      await uploadFile('test.pdf', Buffer.from('content'), 'application/pdf');

      // The logger.info calls have multiple arguments, so we check each call individually
      const logCalls = mockLogger.info.mock.calls;

      expect(logCalls.some(call => call[1]?.includes('Getting signed upload URL'))).toBe(true);
      expect(logCalls.some(call => call[1]?.includes('Got signed URL, uploading to S3'))).toBe(true);
      expect(logCalls.some(call => call[1]?.includes('S3 upload complete, finalizing'))).toBe(true);
      expect(logCalls.some(call => call[1]?.includes('File uploaded successfully'))).toBe(true);
    });
  });
});

// ============================================
// URN Generation Tests
// ============================================

describe('Autodesk OSS - URN Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getObjectUrn', () => {
    it('should convert object ID to base64-encoded URN', () => {
      const objectId = 'urn:adsk.objects:os.object:mybucket/myfile.pdf';
      const urn = getObjectUrn(objectId);

      // Verify it's base64 encoded
      const decoded = Buffer.from(urn, 'base64').toString('utf-8');
      expect(decoded).toBe(objectId);
    });

    it('should remove padding from base64 encoding', () => {
      const objectId = 'urn:adsk.objects:os.object:bucket/file.dwg';
      const urn = getObjectUrn(objectId);

      // Base64 padding should be removed
      expect(urn).not.toContain('=');
    });

    it('should handle URNs with special characters', () => {
      const objectId = 'urn:adsk.objects:os.object:test-bucket/file_name-123.pdf';
      const urn = getObjectUrn(objectId);

      expect(urn).toBeTruthy();
      expect(typeof urn).toBe('string');

      // Verify round-trip
      const decoded = Buffer.from(urn, 'base64').toString('utf-8');
      expect(decoded).toBe(objectId);
    });

    it('should produce URL-safe base64 output', () => {
      const objectId = 'urn:adsk.objects:os.object:bucket/file.pdf';
      const urn = getObjectUrn(objectId);

      // Should not contain URL-unsafe characters
      expect(urn).not.toContain('=');
      expect(urn).not.toContain('+');
      expect(urn).not.toContain('/');
    });

    it('should handle empty object ID', () => {
      const objectId = '';
      const urn = getObjectUrn(objectId);

      expect(urn).toBe('');
    });

    it('should handle very long object IDs', () => {
      const longPath = 'very/long/nested/path/structure/'.repeat(10) + 'file.pdf';
      const objectId = `urn:adsk.objects:os.object:bucket/${longPath}`;
      const urn = getObjectUrn(objectId);

      expect(urn).toBeTruthy();

      // Verify it can be decoded back
      const decoded = Buffer.from(urn, 'base64').toString('utf-8');
      expect(decoded).toBe(objectId);
    });

    it('should produce consistent output for same input', () => {
      const objectId = 'urn:adsk.objects:os.object:bucket/file.pdf';
      const urn1 = getObjectUrn(objectId);
      const urn2 = getObjectUrn(objectId);

      expect(urn1).toBe(urn2);
    });
  });
});

// ============================================
// Object Deletion Tests
// ============================================

describe('Autodesk OSS - Object Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('test-access-token');
    global.fetch = vi.fn();
  });

  describe('deleteObject', () => {
    it('should successfully delete an object', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse({}, true, 200) as any
      );

      await deleteObject('test-file.pdf');

      expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/objects/${encodeURIComponent('test-file.pdf')}`),
        expect.objectContaining({
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer test-access-token',
          },
        })
      );
    });

    it('should handle object with special characters in key', async () => {
      const objectKey = '1234_test file (1).pdf';

      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse({}) as any
      );

      await deleteObject(objectKey);

      const deleteCall = vi.mocked(global.fetch).mock.calls[0];
      const url = deleteCall[0] as string;

      // Should be URL-encoded
      expect(url).toContain(encodeURIComponent(objectKey));
    });

    it('should not throw error if object not found (404)', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse({ error: 'Not found' }, false, 404) as any
      );

      // Should not throw - 404 is acceptable for delete
      await expect(deleteObject('nonexistent.pdf')).resolves.not.toThrow();
    });

    it('should throw error for non-404 failures', async () => {
      const errorMessage = 'Access denied';

      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse({ error: errorMessage }, false, 403) as any
      );

      await expect(deleteObject('test.pdf')).rejects.toThrow('Failed to delete object');
    });

    it('should handle network errors during deletion', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network timeout'));

      await expect(deleteObject('test.pdf')).rejects.toThrow('Network timeout');
    });

    it('should use correct bucket key in delete request', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse({}) as any
      );

      await deleteObject('file.pdf');

      const deleteCall = vi.mocked(global.fetch).mock.calls[0];
      const url = deleteCall[0] as string;

      expect(url).toContain(`/buckets/${BUCKET_KEY}/objects/`);
    });

    it('should handle server errors (500) with proper error message', async () => {
      const errorText = 'Internal server error';

      vi.mocked(global.fetch).mockResolvedValueOnce(
        createMockFetchResponse({ error: errorText }, false, 500) as any
      );

      await expect(deleteObject('test.pdf')).rejects.toThrow('Failed to delete object');
    });
  });
});

// ============================================
// Integration Tests
// ============================================

describe('Autodesk OSS - Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('test-access-token');
    global.fetch = vi.fn();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete full upload-to-URN workflow', async () => {
    const fileName = 'architectural-plan.rvt';
    const fileBuffer = Buffer.from('mock-revit-file');
    const contentType = 'application/octet-stream';

    const mockBucket = createMockBucketDetails();
    const mockSignedData = {
      uploadKey: 'upload-key',
      urls: ['https://s3.amazonaws.com/url'],
    };
    const objectKey = '1234567890_architectural-plan.rvt';
    const objectId = `urn:adsk.objects:os.object:${BUCKET_KEY}/${objectKey}`;
    const mockUploadedObject = createMockUploadedObject(objectKey, { objectId });

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
      .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
      .mockResolvedValueOnce(createMockFetchResponse({}) as any)
      .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

    // Upload file
    const uploadResult = await uploadFile(fileName, fileBuffer, contentType);

    // Generate URN for Model Derivative API
    const urn = getObjectUrn(uploadResult.objectId);

    expect(uploadResult.objectId).toBe(objectId);
    expect(urn).toBeTruthy();
    expect(typeof urn).toBe('string');

    // Verify URN can be decoded back to object ID
    const decodedObjectId = Buffer.from(urn, 'base64').toString('utf-8');
    expect(decodedObjectId).toBe(objectId);
  });

  it('should handle upload followed by deletion', async () => {
    const fileName = 'temp-file.pdf';
    const fileBuffer = Buffer.from('content');
    const contentType = 'application/pdf';

    const mockBucket = createMockBucketDetails();
    const mockSignedData = {
      uploadKey: 'upload-key',
      urls: ['https://s3.amazonaws.com/url'],
    };
    const objectKey = '1234_temp-file.pdf';
    const mockUploadedObject = createMockUploadedObject(objectKey);

    // Upload
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
      .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
      .mockResolvedValueOnce(createMockFetchResponse({}) as any)
      .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

    const uploadResult = await uploadFile(fileName, fileBuffer, contentType);

    // Delete
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockFetchResponse({}) as any
    );

    await deleteObject(uploadResult.objectKey);

    // Verify delete was called with correct object key
    const deleteCall = vi.mocked(global.fetch).mock.calls[4];
    expect(deleteCall[0]).toContain(uploadResult.objectKey);
  });

  it('should handle authentication token refresh during operations', async () => {
    let tokenCallCount = 0;
    mockGetAccessToken.mockImplementation(() => {
      tokenCallCount++;
      return Promise.resolve(`token-${tokenCallCount}`);
    });

    const mockBucket = createMockBucketDetails();

    // First operation - ensureBucket
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockFetchResponse(mockBucket) as any
    );

    await ensureBucket();
    expect(tokenCallCount).toBe(1);

    // Second operation - delete (should get new token)
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockFetchResponse({}) as any
    );

    await deleteObject('test.pdf');
    expect(tokenCallCount).toBe(2);

    // Verify different tokens were used
    const bucket1Call = vi.mocked(global.fetch).mock.calls[0];
    const delete1Call = vi.mocked(global.fetch).mock.calls[1];

    expect(bucket1Call[1]?.headers).toHaveProperty('Authorization', 'Bearer token-1');
    expect(delete1Call[1]?.headers).toHaveProperty('Authorization', 'Bearer token-2');
  });
});

// ============================================
// Edge Cases and Error Scenarios
// ============================================

describe('Autodesk OSS - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue('test-access-token');
    global.fetch = vi.fn();
  });

  it('should handle authentication failure', async () => {
    mockGetAccessToken.mockRejectedValueOnce(new Error('Autodesk credentials not configured'));

    await expect(ensureBucket()).rejects.toThrow('Autodesk credentials not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should handle empty file upload', async () => {
    const emptyBuffer = Buffer.alloc(0);
    const mockBucket = createMockBucketDetails();
    const mockSignedData = {
      uploadKey: 'upload-key',
      urls: ['https://s3.amazonaws.com/url'],
    };
    const mockUploadedObject = createMockUploadedObject('empty.pdf', { size: 0 });

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
      .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
      .mockResolvedValueOnce(createMockFetchResponse({}) as any)
      .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

    const result = await uploadFile('empty.pdf', emptyBuffer, 'application/pdf');

    expect(result.size).toBe(0);
  });

  it('should handle malformed response from Autodesk API during bucket creation', async () => {
    // First call (get bucket) returns 404
    vi.mocked(global.fetch).mockResolvedValueOnce(
      createMockFetchResponse(null, false, 404) as any
    );

    // Second call (create bucket) returns ok but invalid JSON
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      text: vi.fn().mockResolvedValue('Not JSON'),
    };

    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

    await expect(ensureBucket()).rejects.toThrow('Invalid JSON');
  });

  it('should handle Unicode characters in file names', async () => {
    const fileName = 'план-здания-建筑平面图.pdf';
    const fileBuffer = Buffer.from('content');
    const contentType = 'application/pdf';

    const mockBucket = createMockBucketDetails();
    const mockSignedData = {
      uploadKey: 'upload-key',
      urls: ['https://s3.amazonaws.com/url'],
    };

    // File name should be sanitized (non-ASCII replaced with _)
    const sanitizedKey = expect.stringMatching(/^\d+_.*\.pdf$/);
    const mockUploadedObject = createMockUploadedObject('test.pdf');

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(createMockFetchResponse(mockBucket) as any)
      .mockResolvedValueOnce(createMockFetchResponse(mockSignedData) as any)
      .mockResolvedValueOnce(createMockFetchResponse({}) as any)
      .mockResolvedValueOnce(createMockFetchResponse(mockUploadedObject) as any);

    await uploadFile(fileName, fileBuffer, contentType);

    // Verify that non-ASCII characters were sanitized
    const signedUrlCall = vi.mocked(global.fetch).mock.calls[1];
    const urlPath = signedUrlCall[0] as string;

    // Original Unicode should not appear in the URL
    expect(urlPath).not.toContain('план');
    expect(urlPath).not.toContain('建筑');
  });
});

// ============================================
// Constant Export Tests
// ============================================

describe('Autodesk OSS - Exported Constants', () => {
  it('should export BUCKET_KEY constant', () => {
    expect(BUCKET_KEY).toBeDefined();
    expect(typeof BUCKET_KEY).toBe('string');
  });

  it('should format BUCKET_KEY according to Autodesk requirements', () => {
    // Must be lowercase alphanumeric with underscore/hyphen only
    expect(BUCKET_KEY).toMatch(/^[a-z0-9_-]+$/);

    // Must start with foremanos_
    expect(BUCKET_KEY).toMatch(/^foremanos_/);
  });

  it('should include environment in BUCKET_KEY', () => {
    // Should contain environment indicator
    expect(BUCKET_KEY.length).toBeGreaterThan('foremanos_'.length);
  });
});
