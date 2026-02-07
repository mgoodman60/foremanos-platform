import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Tests for validateS3Config() from lib/aws-config.ts
 *
 * BLOCKED: A stale compiled file lib/aws-config.js exists that does not export
 * validateS3Config. Vitest resolves the .js file instead of the .ts source.
 * Delete lib/aws-config.js to unblock these tests.
 */

describe('validateS3Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // These tests will pass once lib/aws-config.js is deleted
  it.skip('should return valid when all required env vars are set', async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    process.env.AWS_BUCKET_NAME = 'my-bucket';

    const { validateS3Config } = await import('@/lib/aws-config');
    const result = validateS3Config();

    expect(result).toEqual({ valid: true, missing: [] });
  });

  it.skip('should return invalid when all required env vars are missing', async () => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_BUCKET_NAME;

    const { validateS3Config } = await import('@/lib/aws-config');
    const result = validateS3Config();

    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME'])
    );
    expect(result.missing).toHaveLength(4);
  });

  it.skip('should return invalid when some required env vars are missing', async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_BUCKET_NAME = 'my-bucket';
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const { validateS3Config } = await import('@/lib/aws-config');
    const result = validateS3Config();

    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'])
    );
    expect(result.missing).toHaveLength(2);
  });

  it.skip('should treat empty string values as missing', async () => {
    process.env.AWS_REGION = '';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.AWS_BUCKET_NAME = 'bucket';

    const { validateS3Config } = await import('@/lib/aws-config');
    const result = validateS3Config();

    expect(result.valid).toBe(false);
    expect(result.missing).toContain('AWS_REGION');
  });

  it.skip('should not require optional env vars like AWS_FOLDER_PREFIX', async () => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.AWS_BUCKET_NAME = 'bucket';
    delete process.env.AWS_FOLDER_PREFIX;

    const { validateS3Config } = await import('@/lib/aws-config');
    const result = validateS3Config();

    expect(result).toEqual({ valid: true, missing: [] });
  });
});
