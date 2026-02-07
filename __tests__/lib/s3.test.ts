import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mocks (hoisted before module imports)
// ============================================
const mockSend = vi.hoisted(() => vi.fn());
const mockCreateS3Client = vi.hoisted(() => vi.fn());
const mockGetBucketConfig = vi.hoisted(() => vi.fn());

const MockS3Client = vi.hoisted(() => {
  return class S3Client {
    send = mockSend;
    config = { region: 'auto' };
    constructor() {}
  };
});

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  PutObjectCommand: vi.fn().mockImplementation((input: any) => ({ input, _type: 'PutObjectCommand' })),
  GetObjectCommand: vi.fn().mockImplementation((input: any) => ({ input, _type: 'GetObjectCommand' })),
  DeleteObjectCommand: vi.fn().mockImplementation((input: any) => ({ input, _type: 'DeleteObjectCommand' })),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed-url.example.com/file'),
}));

const mockClientInstance = vi.hoisted(() => ({
  send: mockSend,
  config: { region: 'auto' },
}));

vi.mock('@/lib/aws-config', () => ({
  createS3Client: mockCreateS3Client.mockReturnValue(mockClientInstance),
  getBucketConfig: mockGetBucketConfig.mockReturnValue({
    bucketName: 'test-bucket',
    folderPrefix: 'foremanos/',
  }),
}));

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { uploadFile, resetS3Client, getFileUrl, deleteFile } from '@/lib/s3';

// ============================================
// Existing Tests
// ============================================

describe('S3 Module - Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFileUrl', () => {
    it('should return public URL for public files', async () => {
      // Mock environment variable
      const originalRegion = process.env.AWS_REGION;
      process.env.AWS_REGION = 'us-west-2';

      // We need to test this differently since the module initializes on import
      // For now, test the URL format
      const publicUrl = 'https://bucket.s3.us-west-2.amazonaws.com/path/to/file.pdf';
      expect(publicUrl).toMatch(/^https:\/\/.*\.s3\..*\.amazonaws\.com\/.*/);

      process.env.AWS_REGION = originalRegion;
    });
  });

  describe('File path generation', () => {
    it('should sanitize special characters in filename', () => {
      const sanitize = (fileName: string) => fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

      expect(sanitize('test file.pdf')).toBe('test_file.pdf');
      expect(sanitize('test (1).pdf')).toBe('test__1_.pdf');
      expect(sanitize('test@file#name.pdf')).toBe('test_file_name.pdf');
      expect(sanitize('simple.pdf')).toBe('simple.pdf');
    });

    it('should preserve valid characters in filename', () => {
      const sanitize = (fileName: string) => fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

      expect(sanitize('document.pdf')).toBe('document.pdf');
      expect(sanitize('file-name.pdf')).toBe('file-name.pdf');
      expect(sanitize('FILE.PDF')).toBe('FILE.PDF');
      expect(sanitize('file123.pdf')).toBe('file123.pdf');
    });
  });

  describe('Content type detection', () => {
    // Test the content type logic directly
    const getContentType = (fileName: string): string => {
      const ext = fileName.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        txt: 'text/plain',
        csv: 'text/csv',
      };
      return contentTypes[ext || ''] || 'application/octet-stream';
    };

    it('should return correct content type for PDF', () => {
      expect(getContentType('document.pdf')).toBe('application/pdf');
      expect(getContentType('DOCUMENT.PDF')).toBe('application/pdf');
    });

    it('should return correct content type for Word documents', () => {
      expect(getContentType('document.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(getContentType('document.doc')).toBe('application/msword');
    });

    it('should return correct content type for Excel files', () => {
      expect(getContentType('spreadsheet.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(getContentType('spreadsheet.xls')).toBe('application/vnd.ms-excel');
    });

    it('should return correct content type for images', () => {
      expect(getContentType('image.png')).toBe('image/png');
      expect(getContentType('photo.jpg')).toBe('image/jpeg');
      expect(getContentType('photo.jpeg')).toBe('image/jpeg');
      expect(getContentType('animation.gif')).toBe('image/gif');
    });

    it('should return correct content type for text files', () => {
      expect(getContentType('readme.txt')).toBe('text/plain');
      expect(getContentType('data.csv')).toBe('text/csv');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getContentType('file.unknown')).toBe('application/octet-stream');
      expect(getContentType('file.xyz')).toBe('application/octet-stream');
      expect(getContentType('noextension')).toBe('application/octet-stream');
    });
  });

  describe('Public vs Private path generation', () => {
    it('should generate public path for public files', () => {
      const folderPrefix = 'test-prefix/';
      const timestamp = 1705320000000;
      const sanitizedFileName = 'test.pdf';
      const isPublic = true;

      const path = isPublic
        ? `${folderPrefix}public/uploads/${timestamp}-${sanitizedFileName}`
        : `${folderPrefix}uploads/${timestamp}-${sanitizedFileName}`;

      expect(path).toContain('public/uploads/');
    });

    it('should generate private path for private files', () => {
      const folderPrefix = 'test-prefix/';
      const timestamp = 1705320000000;
      const sanitizedFileName = 'test.pdf';
      const isPublic = false;

      const path = isPublic
        ? `${folderPrefix}public/uploads/${timestamp}-${sanitizedFileName}`
        : `${folderPrefix}uploads/${timestamp}-${sanitizedFileName}`;

      expect(path).not.toContain('public/');
      expect(path).toContain('uploads/');
    });

    it('should include timestamp in path', () => {
      const folderPrefix = '';
      const timestamp = 1705320000000;
      const sanitizedFileName = 'test.pdf';

      const path = `${folderPrefix}uploads/${timestamp}-${sanitizedFileName}`;

      expect(path).toContain('1705320000000');
    });
  });

  describe('URL format validation', () => {
    it('should create valid public S3 URL format', () => {
      const bucketName = 'my-bucket';
      const region = 'us-east-1';
      const path = 'public/uploads/test.pdf';

      const url = `https://${bucketName}.s3.${region}.amazonaws.com/${path}`;

      expect(url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/public/uploads/test.pdf');
    });

    it('should handle different AWS regions', () => {
      const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

      regions.forEach((region) => {
        const url = `https://bucket.s3.${region}.amazonaws.com/file.pdf`;
        expect(url).toContain(region);
        expect(url).toMatch(/^https:\/\/bucket\.s3\.[\w-]+\.amazonaws\.com\/file\.pdf$/);
      });
    });
  });
});

describe('S3 Module - Retry Logic', () => {
  describe('Exponential backoff', () => {
    it('should calculate correct wait times', () => {
      // Backoff pattern: (attempt + 1) * 1000ms
      const waitTimes = [0, 1, 2].map((attempt) => (attempt + 1) * 1000);

      expect(waitTimes).toEqual([1000, 2000, 3000]);
    });
  });

  describe('Timeout behavior', () => {
    it('should have reasonable default timeout', () => {
      const defaultTimeout = 120000; // 2 minutes
      expect(defaultTimeout).toBe(120000);
    });

    it('should have reasonable default retry count', () => {
      const defaultRetries = 2;
      expect(defaultRetries).toBe(2);
      // Total attempts = retries + 1 = 3
    });
  });
});

describe('S3 Module - Error handling patterns', () => {
  describe('Error message formatting', () => {
    it('should format upload failure message correctly', () => {
      const retries = 2;
      const lastErrorMessage = 'Network timeout';
      const errorMessage = `S3 upload failed after ${retries + 1} attempts: ${lastErrorMessage}`;

      expect(errorMessage).toBe('S3 upload failed after 3 attempts: Network timeout');
    });

    it('should format timeout message correctly', () => {
      const timeoutMs = 60000;
      const errorMessage = `S3 upload timeout after ${timeoutMs}ms`;

      expect(errorMessage).toBe('S3 upload timeout after 60000ms');
    });
  });

  describe('Empty response handling', () => {
    it('should detect empty response body', () => {
      const responses = [
        { Body: null },
        { Body: undefined },
        {},
      ];

      responses.forEach((response) => {
        const hasBody = !!response.Body;
        expect(hasBody).toBe(false);
      });
    });

    it('should detect valid response body', () => {
      const response = { Body: 'some content' };
      expect(!!response.Body).toBe(true);
    });
  });
});

// ============================================
// New Tests: resetS3Client
// ============================================

describe('S3 Module - resetS3Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure we start with a clean singleton state
    resetS3Client();
    mockCreateS3Client.mockReturnValue(mockClientInstance);
    mockGetBucketConfig.mockReturnValue({
      bucketName: 'test-bucket',
      folderPrefix: 'foremanos/',
    });
    mockSend.mockResolvedValue({});
  });

  it('should allow creating a fresh S3 client after reset', async () => {
    // First upload creates a singleton client
    await uploadFile(Buffer.from('test'), 'file1.pdf', false, 120000, 0);
    const callsAfterFirst = mockCreateS3Client.mock.calls.length;

    // Second upload reuses the cached singleton — no new createS3Client call
    await uploadFile(Buffer.from('test'), 'file2.pdf', false, 120000, 0);
    expect(mockCreateS3Client.mock.calls.length).toBe(callsAfterFirst);

    // Reset the singleton
    resetS3Client();

    // Third upload must create a new client
    await uploadFile(Buffer.from('test'), 'file3.pdf', false, 120000, 0);
    expect(mockCreateS3Client.mock.calls.length).toBe(callsAfterFirst + 1);
  });

  it('should be safe to call resetS3Client multiple times', () => {
    expect(() => {
      resetS3Client();
      resetS3Client();
      resetS3Client();
    }).not.toThrow();
  });
});

// ============================================
// New Tests: uploadFile auth error handling
// ============================================

describe('S3 Module - uploadFile auth error handling', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    resetS3Client();
    mockCreateS3Client.mockReturnValue(mockClientInstance);
    mockGetBucketConfig.mockReturnValue({
      bucketName: 'test-bucket',
      folderPrefix: 'foremanos/',
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should reset S3 client on InvalidAccessKeyId error', async () => {
    const authError = Object.assign(new Error('Invalid access key'), {
      name: 'InvalidAccessKeyId',
      $metadata: { httpStatusCode: 403 },
    });
    mockSend.mockRejectedValue(authError);

    await expect(
      uploadFile(Buffer.from('test'), 'file.pdf', false, 1000, 0)
    ).rejects.toThrow('S3 upload failed');

    // After auth error, resetS3Client is called, so next upload creates a new client
    // The singleton was reset, meaning createS3Client will be called again on next use
    mockSend.mockResolvedValueOnce({});
    await uploadFile(Buffer.from('test'), 'file2.pdf', false, 1000, 0);

    // createS3Client should have been called at least twice:
    // once for the first upload (singleton creation) and once after the reset
    expect(mockCreateS3Client.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should reset S3 client on AccessDenied error', async () => {
    const authError = Object.assign(new Error('Access denied'), {
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403 },
    });
    mockSend.mockRejectedValue(authError);

    await expect(
      uploadFile(Buffer.from('test'), 'file.pdf', false, 1000, 0)
    ).rejects.toThrow('S3 upload failed');

    // Verify the warn log about auth error was called
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'S3_UPLOAD',
      'Auth error detected, resetting S3 client'
    );
  });

  it('should reset S3 client on SignatureDoesNotMatch error', async () => {
    const authError = Object.assign(new Error('Signature mismatch'), {
      name: 'SignatureDoesNotMatch',
      $metadata: { httpStatusCode: 403 },
    });
    mockSend.mockRejectedValue(authError);

    await expect(
      uploadFile(Buffer.from('test'), 'file.pdf', false, 1000, 0)
    ).rejects.toThrow('S3 upload failed');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'S3_UPLOAD',
      'Auth error detected, resetting S3 client'
    );
  });

  it('should reset S3 client on HTTP 403 even without named auth error', async () => {
    const forbiddenError = Object.assign(new Error('Forbidden'), {
      name: 'S3ServiceException',
      $metadata: { httpStatusCode: 403 },
    });
    mockSend.mockRejectedValue(forbiddenError);

    await expect(
      uploadFile(Buffer.from('test'), 'file.pdf', false, 1000, 0)
    ).rejects.toThrow('S3 upload failed');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'S3_UPLOAD',
      'Auth error detected, resetting S3 client'
    );
  });

  it('should NOT reset S3 client on network errors', async () => {
    const networkError = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
      name: 'NetworkingError',
    });
    mockSend.mockRejectedValue(networkError);

    const callsBefore = mockCreateS3Client.mock.calls.length;

    await expect(
      uploadFile(Buffer.from('test'), 'file.pdf', false, 1000, 0)
    ).rejects.toThrow('S3 upload failed');

    // warn about auth error should NOT have been called
    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      'S3_UPLOAD',
      'Auth error detected, resetting S3 client'
    );
  });

  it('should NOT reset S3 client on generic errors', async () => {
    const genericError = new Error('Something went wrong');
    mockSend.mockRejectedValue(genericError);

    await expect(
      uploadFile(Buffer.from('test'), 'file.pdf', false, 1000, 0)
    ).rejects.toThrow('S3 upload failed');

    expect(mockLogger.warn).not.toHaveBeenCalledWith(
      'S3_UPLOAD',
      'Auth error detected, resetting S3 client'
    );
  });
});

// ============================================
// New Tests: uploadFile logger integration
// ============================================

describe('S3 Module - uploadFile logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetS3Client();
    mockCreateS3Client.mockReturnValue(mockClientInstance);
    mockGetBucketConfig.mockReturnValue({
      bucketName: 'test-bucket',
      folderPrefix: 'foremanos/',
    });
  });

  it('should call logger.info on upload start', async () => {
    mockSend.mockResolvedValueOnce({});

    await uploadFile(Buffer.from('test-data'), 'document.pdf', false, 120000, 0);

    // Should log attempt info
    expect(mockLogger.info).toHaveBeenCalledWith(
      'S3_UPLOAD',
      expect.stringContaining('Attempt 1/1 for document.pdf')
    );
  });

  it('should call logger.info on successful upload', async () => {
    mockSend.mockResolvedValueOnce({});

    await uploadFile(Buffer.from('test-data'), 'document.pdf', false, 120000, 0);

    // Should log success
    expect(mockLogger.info).toHaveBeenCalledWith(
      'S3_UPLOAD',
      expect.stringContaining('Successfully uploaded document.pdf')
    );
  });

  it('should call logger.error on failed upload with structured metadata', async () => {
    const s3Error = Object.assign(new Error('NoSuchBucket'), {
      name: 'NoSuchBucket',
      Code: 'NoSuchBucket',
      $metadata: { httpStatusCode: 404, requestId: 'req-123' },
    });
    mockSend.mockRejectedValue(s3Error);

    await expect(
      uploadFile(Buffer.from('test'), 'file.pdf', false, 1000, 0)
    ).rejects.toThrow('S3 upload failed');

    // Should log error with structured metadata
    expect(mockLogger.error).toHaveBeenCalledWith(
      'S3_UPLOAD',
      expect.stringContaining('Attempt 1/1 failed for file.pdf'),
      expect.any(Error),
      expect.objectContaining({
        bucket: 'test-bucket',
        errorCode: 'NoSuchBucket',
        httpStatus: 404,
        requestId: 'req-123',
      })
    );
  });

  it('should log file size in MB in the upload attempt message', async () => {
    // Create a buffer of known size (1MB = 1048576 bytes)
    const buffer = Buffer.alloc(1048576);
    mockSend.mockResolvedValueOnce({});

    await uploadFile(buffer, 'large-file.pdf', false, 120000, 0);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'S3_UPLOAD',
      expect.stringContaining('1.00MB')
    );
  });

  it('should log retry wait time between attempts', async () => {
    const error = new Error('Temporary failure');
    mockSend.mockRejectedValueOnce(error).mockResolvedValueOnce({});

    await uploadFile(Buffer.from('test'), 'file.pdf', false, 120000, 1);

    // Should log retry info
    expect(mockLogger.info).toHaveBeenCalledWith(
      'S3_UPLOAD',
      expect.stringContaining('Retrying in 1000ms')
    );
  });
});

// ============================================
// New Tests: uploadFile with actual S3 operations
// ============================================

describe('S3 Module - uploadFile operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetS3Client();
    mockCreateS3Client.mockReturnValue(mockClientInstance);
    mockGetBucketConfig.mockReturnValue({
      bucketName: 'test-bucket',
      folderPrefix: 'foremanos/',
    });
  });

  it('should return the cloud_storage_path on success', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await uploadFile(Buffer.from('test'), 'document.pdf', false, 120000, 0);

    expect(result).toMatch(/^foremanos\/uploads\/\d+-document\.pdf$/);
  });

  it('should include public/ in path for public uploads', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await uploadFile(Buffer.from('test'), 'image.png', true, 120000, 0);

    expect(result).toMatch(/^foremanos\/public\/uploads\/\d+-image\.png$/);
  });

  it('should throw after exhausting all retries', async () => {
    const error = new Error('Persistent failure');
    mockSend.mockRejectedValue(error);

    await expect(
      uploadFile(Buffer.from('test'), 'file.pdf', false, 1000, 2)
    ).rejects.toThrow('S3 upload failed after 3 attempts: Persistent failure');
  });

  it('should succeed on retry after initial failure', async () => {
    const error = new Error('Temporary failure');
    mockSend.mockRejectedValueOnce(error).mockResolvedValueOnce({});

    const result = await uploadFile(Buffer.from('test'), 'file.pdf', false, 120000, 1);

    expect(result).toMatch(/file\.pdf$/);
    // Should have logged the first failure and retry
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'S3_UPLOAD',
      expect.stringContaining('Retrying')
    );
  });
});
