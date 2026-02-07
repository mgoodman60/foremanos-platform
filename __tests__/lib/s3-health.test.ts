import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  HeadBucketCommand: vi.fn().mockImplementation((params) => params),
}));

vi.mock('@/lib/aws-config', () => ({
  createS3Client: vi.fn(() => ({ send: mockSend })),
  getBucketConfig: vi.fn(() => ({
    bucketName: 'test-bucket',
    folderPrefix: 'test/',
  })),
}));

import { checkS3Health } from '@/lib/s3-health';
import { getBucketConfig } from '@/lib/aws-config';

describe('checkS3Health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not_configured when AWS_BUCKET_NAME is empty', async () => {
    vi.mocked(getBucketConfig).mockReturnValueOnce({
      bucketName: '',
      folderPrefix: '',
    });

    const result = await checkS3Health();
    expect(result).toBe('not_configured');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns ok when HeadBucketCommand succeeds', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await checkS3Health();
    expect(result).toBe('ok');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns error when HeadBucketCommand throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('Access Denied'));

    const result = await checkS3Health();
    expect(result).toBe('error');
  });

  it('returns error when bucket does not exist', async () => {
    const notFoundError = new Error('Not Found');
    (notFoundError as Error & { name: string }).name = 'NotFound';
    mockSend.mockRejectedValueOnce(notFoundError);

    const result = await checkS3Health();
    expect(result).toBe('error');
  });

  it('returns error when credentials are invalid', async () => {
    const credError = new Error('Invalid credentials');
    (credError as Error & { name: string }).name = 'InvalidAccessKeyId';
    mockSend.mockRejectedValueOnce(credError);

    const result = await checkS3Health();
    expect(result).toBe('error');
  });

  it('never throws, always returns a status', async () => {
    mockSend.mockRejectedValueOnce(new TypeError('Network failure'));

    const result = await checkS3Health();
    expect(['ok', 'not_configured', 'error']).toContain(result);
  });
});
