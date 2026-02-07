import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database health check
vi.mock('@/lib/db-helpers', () => ({
  checkDatabaseHealth: vi.fn().mockResolvedValue(true),
}));

// Mock the S3 health check
vi.mock('@/lib/s3-health', () => ({
  checkS3Health: vi.fn().mockResolvedValue('ok'),
}));

import { GET } from '@/app/api/health/route';

describe('Health Check Smoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 when database is healthy', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
  });

  it('returns valid JSON structure with required fields', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('checks');
    expect(data.checks).toHaveProperty('database');
    expect(data.checks).toHaveProperty('s3');
    expect(data.checks).toHaveProperty('api');
  });

  it('returns healthy status when all checks pass', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.status).toBe('healthy');
    expect(data.checks.database).toBe('ok');
    expect(data.checks.s3).toBe('ok');
    expect(data.checks.api).toBe('ok');
  });

  it('returns ISO timestamp format', async () => {
    const response = await GET();
    const data = await response.json();

    // Check ISO 8601 format
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });

  it('returns degraded status when database is unhealthy', async () => {
    const { checkDatabaseHealth } = await import('@/lib/db-helpers');
    vi.mocked(checkDatabaseHealth).mockResolvedValueOnce(false);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.database).toBe('error');
  });

  it('returns healthy when S3 is not configured', async () => {
    const { checkS3Health } = await import('@/lib/s3-health');
    vi.mocked(checkS3Health).mockResolvedValueOnce('not_configured');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.checks.s3).toBe('not_configured');
  });

  it('returns degraded when S3 is configured but inaccessible', async () => {
    const { checkS3Health } = await import('@/lib/s3-health');
    vi.mocked(checkS3Health).mockResolvedValueOnce('error');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.s3).toBe('error');
  });

  it('returns degraded when both database and S3 are down', async () => {
    const { checkDatabaseHealth } = await import('@/lib/db-helpers');
    const { checkS3Health } = await import('@/lib/s3-health');
    vi.mocked(checkDatabaseHealth).mockResolvedValueOnce(false);
    vi.mocked(checkS3Health).mockResolvedValueOnce('error');

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.database).toBe('error');
    expect(data.checks.s3).toBe('error');
  });
});
