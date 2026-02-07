import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock S3Client constructor - capture constructor args for credential verification
const mockS3ClientArgs = vi.hoisted(() => [] as any[]);
const mockSend = vi.hoisted(() => vi.fn());
const MockS3Client = vi.hoisted(() => {
  return class S3Client {
    config: Record<string, unknown>;
    send = mockSend;
    middlewareStack: Record<string, unknown>;
    constructor(config: any) {
      mockS3ClientArgs.push(config);
      this.config = { ...config, serviceId: 'S3' };
      this.middlewareStack = {};
    }
  };
});

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  HeadBucketCommand: vi.fn().mockImplementation((input: any) => ({ input })),
}));

import { getBucketConfig, createS3Client, validateS3Config, testS3Connectivity } from '@/lib/aws-config';

describe('AWS Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3ClientArgs.length = 0;
    // Create a fresh copy of environment variables for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('getBucketConfig', () => {
    it('should return bucket name from environment variable', () => {
      process.env.AWS_BUCKET_NAME = 'my-test-bucket';
      process.env.AWS_FOLDER_PREFIX = 'uploads/';

      const config = getBucketConfig();

      expect(config.bucketName).toBe('my-test-bucket');
      expect(config.folderPrefix).toBe('uploads/');
    });

    it('should return empty string when AWS_BUCKET_NAME is not set', () => {
      delete process.env.AWS_BUCKET_NAME;
      delete process.env.AWS_FOLDER_PREFIX;

      const config = getBucketConfig();

      expect(config.bucketName).toBe('');
      expect(config.folderPrefix).toBe('');
    });

    it('should return empty string when AWS_BUCKET_NAME is undefined', () => {
      process.env.AWS_BUCKET_NAME = undefined;
      process.env.AWS_FOLDER_PREFIX = undefined;

      const config = getBucketConfig();

      expect(config.bucketName).toBe('');
      expect(config.folderPrefix).toBe('');
    });

    it('should handle folder prefix with trailing slash', () => {
      process.env.AWS_BUCKET_NAME = 'bucket';
      process.env.AWS_FOLDER_PREFIX = 'documents/';

      const config = getBucketConfig();

      expect(config.folderPrefix).toBe('documents/');
    });

    it('should handle folder prefix without trailing slash', () => {
      process.env.AWS_BUCKET_NAME = 'bucket';
      process.env.AWS_FOLDER_PREFIX = 'documents';

      const config = getBucketConfig();

      expect(config.folderPrefix).toBe('documents');
    });

    it('should handle nested folder prefixes', () => {
      process.env.AWS_BUCKET_NAME = 'bucket';
      process.env.AWS_FOLDER_PREFIX = 'project-1/uploads/documents/';

      const config = getBucketConfig();

      expect(config.folderPrefix).toBe('project-1/uploads/documents/');
    });

    it('should return empty folder prefix when not set', () => {
      process.env.AWS_BUCKET_NAME = 'bucket';
      delete process.env.AWS_FOLDER_PREFIX;

      const config = getBucketConfig();

      expect(config.bucketName).toBe('bucket');
      expect(config.folderPrefix).toBe('');
    });

    it('should handle bucket name with special characters', () => {
      process.env.AWS_BUCKET_NAME = 'my-bucket-123';
      process.env.AWS_FOLDER_PREFIX = 'test-prefix/';

      const config = getBucketConfig();

      expect(config.bucketName).toBe('my-bucket-123');
    });

    it('should return config object with correct structure', () => {
      process.env.AWS_BUCKET_NAME = 'bucket';
      process.env.AWS_FOLDER_PREFIX = 'prefix/';

      const config = getBucketConfig();

      expect(config).toHaveProperty('bucketName');
      expect(config).toHaveProperty('folderPrefix');
      expect(Object.keys(config)).toHaveLength(2);
    });

    it('should handle empty string values', () => {
      process.env.AWS_BUCKET_NAME = '';
      process.env.AWS_FOLDER_PREFIX = '';

      const config = getBucketConfig();

      expect(config.bucketName).toBe('');
      expect(config.folderPrefix).toBe('');
    });

    it('should handle whitespace in environment variables', () => {
      process.env.AWS_BUCKET_NAME = '  my-bucket  ';
      process.env.AWS_FOLDER_PREFIX = '  prefix/  ';

      const config = getBucketConfig();

      // Function returns values as-is, no trimming
      expect(config.bucketName).toBe('  my-bucket  ');
      expect(config.folderPrefix).toBe('  prefix/  ');
    });

    it('should be callable multiple times without side effects', () => {
      process.env.AWS_BUCKET_NAME = 'bucket';
      process.env.AWS_FOLDER_PREFIX = 'prefix/';

      const config1 = getBucketConfig();
      const config2 = getBucketConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object instances
    });
  });

  describe('createS3Client', () => {
    it('should create S3Client instance', () => {
      const client = createS3Client();

      expect(client).toBeDefined();
      expect(client.constructor.name).toBe('S3Client');
    });

    it('should not throw error when AWS credentials are not configured', () => {
      // The client creation doesn't validate credentials until actual use
      expect(() => createS3Client()).not.toThrow();
    });

    it('should return object with S3Client interface', () => {
      const client = createS3Client();

      expect(client).toHaveProperty('config');
      expect(client).toHaveProperty('send');
      expect(typeof client.send).toBe('function');
    });

    it('should return new client instance on each call', () => {
      const client1 = createS3Client();
      const client2 = createS3Client();

      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
      // Each call creates a new instance
      expect(client1).not.toBe(client2);
      expect(client1.constructor.name).toBe('S3Client');
      expect(client2.constructor.name).toBe('S3Client');
    });

    it('should create client that can be used for S3 operations', () => {
      const client = createS3Client();

      // Verify the client has the expected send method for operations
      expect(typeof client.send).toBe('function');
      expect(client.config).toBeDefined();
    });

    it('should create client with default configuration', () => {
      const client = createS3Client();

      // Verify S3Client is initialized with proper defaults
      expect(client.config).toBeDefined();
      expect(client.config.serviceId).toBe('S3');
      expect(client.middlewareStack).toBeDefined();
    });

    it('should create client with AWS SDK v3 structure', () => {
      const client = createS3Client();

      // AWS SDK v3 clients have these core properties
      expect(client).toHaveProperty('send');
      expect(client).toHaveProperty('config');
      expect(client).toHaveProperty('middlewareStack');
    });

    it('passes explicit credentials when both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      expect(mockS3ClientArgs[0]).toHaveProperty('credentials');
      expect(mockS3ClientArgs[0].credentials).toEqual({
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      });
    });

    it('does not pass credentials when neither env var is set', () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      expect(mockS3ClientArgs[0]).not.toHaveProperty('credentials');
    });

    it('does not pass credentials when only AWS_ACCESS_KEY_ID is set', () => {
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
      delete process.env.AWS_SECRET_ACCESS_KEY;

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      expect(mockS3ClientArgs[0]).not.toHaveProperty('credentials');
    });

    it('does not pass credentials when only AWS_SECRET_ACCESS_KEY is set', () => {
      delete process.env.AWS_ACCESS_KEY_ID;
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      expect(mockS3ClientArgs[0]).not.toHaveProperty('credentials');
    });

    it('sets endpoint and forcePathStyle when S3_ENDPOINT is set', () => {
      process.env.S3_ENDPOINT = 'https://account-id.r2.cloudflarestorage.com';

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      expect(mockS3ClientArgs[0].endpoint).toBe('https://account-id.r2.cloudflarestorage.com');
      expect(mockS3ClientArgs[0].forcePathStyle).toBe(true);
    });

    it('does not set endpoint or forcePathStyle when S3_ENDPOINT is not set', () => {
      delete process.env.S3_ENDPOINT;

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      expect(mockS3ClientArgs[0]).not.toHaveProperty('endpoint');
      expect(mockS3ClientArgs[0]).not.toHaveProperty('forcePathStyle');
    });

    it('uses region from AWS_REGION env var', () => {
      process.env.AWS_REGION = 'us-west-2';

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      expect(mockS3ClientArgs[0].region).toBe('us-west-2');
    });

    it("defaults region to 'auto' when AWS_REGION is not set", () => {
      delete process.env.AWS_REGION;

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      expect(mockS3ClientArgs[0].region).toBe('auto');
    });

    it('passes full R2 configuration with endpoint, credentials, and region', () => {
      process.env.S3_ENDPOINT = 'https://account-id.r2.cloudflarestorage.com';
      process.env.AWS_ACCESS_KEY_ID = 'r2-access-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'r2-secret-key';
      process.env.AWS_REGION = 'auto';

      createS3Client();

      expect(mockS3ClientArgs).toHaveLength(1);
      const config = mockS3ClientArgs[0];
      expect(config.region).toBe('auto');
      expect(config.endpoint).toBe('https://account-id.r2.cloudflarestorage.com');
      expect(config.forcePathStyle).toBe(true);
      expect(config.credentials).toEqual({
        accessKeyId: 'r2-access-key',
        secretAccessKey: 'r2-secret-key',
      });
    });
  });

  describe('validateS3Config', () => {
    it('returns valid when all required vars are set', () => {
      process.env.S3_ENDPOINT = 'https://account-id.r2.cloudflarestorage.com';
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.AWS_BUCKET_NAME = 'test-bucket';

      const result = validateS3Config();

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('returns invalid with missing vars listed when S3_ENDPOINT is not set', () => {
      delete process.env.S3_ENDPOINT;
      process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.AWS_BUCKET_NAME = 'test-bucket';

      const result = validateS3Config();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('S3_ENDPOINT');
    });

    it('returns invalid with all missing vars when none are set', () => {
      delete process.env.S3_ENDPOINT;
      delete process.env.AWS_ACCESS_KEY_ID;
      delete process.env.AWS_SECRET_ACCESS_KEY;
      delete process.env.AWS_BUCKET_NAME;

      const result = validateS3Config();

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual([
        'S3_ENDPOINT',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_BUCKET_NAME',
      ]);
    });

    it('returns invalid when only some vars are missing', () => {
      process.env.S3_ENDPOINT = 'https://account-id.r2.cloudflarestorage.com';
      delete process.env.AWS_ACCESS_KEY_ID;
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
      delete process.env.AWS_BUCKET_NAME;

      const result = validateS3Config();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('AWS_ACCESS_KEY_ID');
      expect(result.missing).toContain('AWS_BUCKET_NAME');
      expect(result.missing).not.toContain('S3_ENDPOINT');
      expect(result.missing).not.toContain('AWS_SECRET_ACCESS_KEY');
    });
  });

  describe('testS3Connectivity', () => {
    it('returns ok when HeadBucket succeeds', async () => {
      process.env.AWS_BUCKET_NAME = 'test-bucket';
      mockSend.mockResolvedValueOnce({});

      const result = await testS3Connectivity();

      expect(result).toEqual({ ok: true });
    });

    it('returns error details when HeadBucket fails', async () => {
      process.env.AWS_BUCKET_NAME = 'test-bucket';
      const s3Error = Object.assign(new Error('Access Denied'), {
        name: 'AccessDenied',
        Code: 'AccessDenied',
        $metadata: { httpStatusCode: 403 },
      });
      mockSend.mockRejectedValueOnce(s3Error);

      const result = await testS3Connectivity();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Access Denied');
      expect(result.errorCode).toBe('AccessDenied');
      expect(result.httpStatus).toBe(403);
    });

    it('returns not configured when bucket name is empty', async () => {
      delete process.env.AWS_BUCKET_NAME;

      const result = await testS3Connectivity();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('AWS_BUCKET_NAME not configured');
    });

    it('returns error when HeadBucket throws a network error', async () => {
      process.env.AWS_BUCKET_NAME = 'test-bucket';
      const networkError = Object.assign(new Error('getaddrinfo ENOTFOUND'), {
        name: 'NetworkingError',
      });
      mockSend.mockRejectedValueOnce(networkError);

      const result = await testS3Connectivity();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('getaddrinfo ENOTFOUND');
      expect(result.errorCode).toBe('NetworkingError');
    });
  });

  describe('Integration', () => {
    it('should work together - create client and get config', () => {
      process.env.AWS_BUCKET_NAME = 'integration-bucket';
      process.env.AWS_FOLDER_PREFIX = 'integration/';

      const config = getBucketConfig();
      const client = createS3Client();

      expect(config.bucketName).toBe('integration-bucket');
      expect(config.folderPrefix).toBe('integration/');
      expect(client).toBeDefined();
      expect(client.constructor.name).toBe('S3Client');
    });

    it('should handle production-like environment', () => {
      process.env.AWS_BUCKET_NAME = 'foremanos-production-documents';
      process.env.AWS_FOLDER_PREFIX = 'prod/uploads/';
      process.env.AWS_REGION = 'us-east-1';

      const config = getBucketConfig();
      const client = createS3Client();

      expect(config.bucketName).toBe('foremanos-production-documents');
      expect(config.folderPrefix).toBe('prod/uploads/');
      expect(client).toBeDefined();
    });

    it('should handle development environment with minimal config', () => {
      process.env.AWS_BUCKET_NAME = 'dev-bucket';
      delete process.env.AWS_FOLDER_PREFIX;

      const config = getBucketConfig();
      const client = createS3Client();

      expect(config.bucketName).toBe('dev-bucket');
      expect(config.folderPrefix).toBe('');
      expect(client).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should return valid config for typical bucket names', () => {
      const validBucketNames = [
        'my-bucket',
        'my.bucket',
        'my-bucket-123',
        'mybucket',
        'my-bucket.with.dots',
      ];

      validBucketNames.forEach((bucketName) => {
        process.env.AWS_BUCKET_NAME = bucketName;
        process.env.AWS_FOLDER_PREFIX = 'test/';

        const config = getBucketConfig();
        expect(config.bucketName).toBe(bucketName);
      });
    });

    it('should return valid config for typical folder prefixes', () => {
      const validPrefixes = [
        'uploads/',
        'documents/pdfs/',
        'project-123/files/',
        'test',
        'a/b/c/d/',
      ];

      validPrefixes.forEach((prefix) => {
        process.env.AWS_BUCKET_NAME = 'bucket';
        process.env.AWS_FOLDER_PREFIX = prefix;

        const config = getBucketConfig();
        expect(config.folderPrefix).toBe(prefix);
      });
    });

    it('should handle config that would fail AWS validation', () => {
      // These would fail AWS validation, but getBucketConfig just returns the value
      process.env.AWS_BUCKET_NAME = 'INVALID_BUCKET_NAME';
      process.env.AWS_FOLDER_PREFIX = '//invalid//';

      const config = getBucketConfig();

      // Function doesn't validate, just returns values
      expect(config.bucketName).toBe('INVALID_BUCKET_NAME');
      expect(config.folderPrefix).toBe('//invalid//');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null coalescing for AWS_BUCKET_NAME', () => {
      process.env.AWS_BUCKET_NAME = null as any;
      process.env.AWS_FOLDER_PREFIX = null as any;

      const config = getBucketConfig();

      expect(config.bucketName).toBe('');
      expect(config.folderPrefix).toBe('');
    });

    it('should handle numeric values in environment variables', () => {
      process.env.AWS_BUCKET_NAME = '123456';
      process.env.AWS_FOLDER_PREFIX = '999/';

      const config = getBucketConfig();

      expect(config.bucketName).toBe('123456');
      expect(config.folderPrefix).toBe('999/');
    });

    it('should handle very long bucket names', () => {
      const longBucketName = 'a'.repeat(63); // AWS max is 63 chars
      process.env.AWS_BUCKET_NAME = longBucketName;
      process.env.AWS_FOLDER_PREFIX = 'test/';

      const config = getBucketConfig();

      expect(config.bucketName).toBe(longBucketName);
      expect(config.bucketName.length).toBe(63);
    });

    it('should handle very long folder prefixes', () => {
      const longPrefix = 'folder/'.repeat(50);
      process.env.AWS_BUCKET_NAME = 'bucket';
      process.env.AWS_FOLDER_PREFIX = longPrefix;

      const config = getBucketConfig();

      expect(config.folderPrefix).toBe(longPrefix);
    });

    it('should handle special characters in folder prefix', () => {
      process.env.AWS_BUCKET_NAME = 'bucket';
      process.env.AWS_FOLDER_PREFIX = 'test_folder-2024/files (v1)/';

      const config = getBucketConfig();

      expect(config.folderPrefix).toBe('test_folder-2024/files (v1)/');
    });
  });
});
