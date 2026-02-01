import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock console methods
const mocks = vi.hoisted(() => ({
  console: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock console before importing logger
vi.stubGlobal('console', {
  ...console,
  ...mocks.console,
});

import { logger, createScopedLogger } from '@/lib/logger';

describe('logger', () => {
  let originalEnv: string | undefined;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    vi.clearAllMocks();
    // Store original environment
    originalEnv = process.env.NODE_ENV;
    // Mock Date for consistent timestamps
    originalDateNow = Date.now;
    const mockDate = new Date('2026-01-31T12:00:00.000Z');
    vi.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);
    (global.Date as typeof Date).now = vi.fn(() => mockDate.getTime());
  });

  afterEach(() => {
    // Restore original environment
    vi.unstubAllEnvs();
    // Restore Date
    (global.Date as typeof Date).now = originalDateNow;
    vi.restoreAllMocks();
  });

  // ============================================
  // logger.debug() Tests
  // ============================================
  describe('logger.debug', () => {
    it('should log debug messages in development mode', () => {
      vi.stubEnv('NODE_ENV', 'development');

      logger.debug('TEST_CONTEXT', 'Debug message');

      expect(mocks.console.debug).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.debug.mock.calls[0][0];
      expect(logMessage).toContain('[2026-01-31T12:00:00.000Z]');
      expect(logMessage).toContain('[DEBUG]');
      expect(logMessage).toContain('[TEST_CONTEXT]');
      expect(logMessage).toContain('Debug message');
    });

    it('should log debug messages with metadata in development mode', () => {
      vi.stubEnv('NODE_ENV', 'development');

      logger.debug('TEST_CONTEXT', 'Debug with meta', { userId: '123', action: 'test' });

      expect(mocks.console.debug).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.debug.mock.calls[0][0];
      expect(logMessage).toContain('[DEBUG]');
      expect(logMessage).toContain('Debug with meta');
      expect(logMessage).toContain('"userId":"123"');
      expect(logMessage).toContain('"action":"test"');
    });

    it('should NOT log debug messages in production mode', () => {
      vi.stubEnv('NODE_ENV', 'production');

      logger.debug('TEST_CONTEXT', 'Should not appear');

      expect(mocks.console.debug).not.toHaveBeenCalled();
    });

    it('should NOT log debug messages when NODE_ENV is undefined', () => {
      vi.stubEnv('NODE_ENV', '');

      logger.debug('TEST_CONTEXT', 'Should not appear');

      expect(mocks.console.debug).not.toHaveBeenCalled();
    });

    it('should NOT log debug messages in test mode', () => {
      vi.stubEnv('NODE_ENV', 'test');

      logger.debug('TEST_CONTEXT', 'Should not appear');

      expect(mocks.console.debug).not.toHaveBeenCalled();
    });

    it('should handle empty metadata object', () => {
      vi.stubEnv('NODE_ENV', 'development');

      logger.debug('TEST_CONTEXT', 'Message', {});

      expect(mocks.console.debug).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.debug.mock.calls[0][0];
      expect(logMessage).toContain('Message');
      expect(logMessage).toContain('{}');
    });
  });

  // ============================================
  // logger.info() Tests
  // ============================================
  describe('logger.info', () => {
    it('should log info messages', () => {
      logger.info('FINALIZATION', 'Starting report finalization');

      expect(mocks.console.info).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('[2026-01-31T12:00:00.000Z]');
      expect(logMessage).toContain('[INFO]');
      expect(logMessage).toContain('[FINALIZATION]');
      expect(logMessage).toContain('Starting report finalization');
    });

    it('should log info messages with metadata', () => {
      logger.info('FINALIZATION', 'Report started', { conversationId: 'conv-123' });

      expect(mocks.console.info).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('[INFO]');
      expect(logMessage).toContain('Report started');
      expect(logMessage).toContain('"conversationId":"conv-123"');
    });

    it('should log info messages in all environments', () => {
      const environments = ['development', 'production', 'test', undefined];

      environments.forEach((env) => {
        vi.stubEnv('NODE_ENV', env ?? '');

        mocks.console.info.mockClear();
        logger.info('TEST', 'Message');
        expect(mocks.console.info).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle complex metadata objects', () => {
      const metadata = {
        projectId: 'proj-123',
        documentId: 'doc-456',
        nested: {
          field1: 'value1',
          field2: 42,
        },
        array: [1, 2, 3],
      };

      logger.info('CONTEXT', 'Complex meta', metadata);

      expect(mocks.console.info).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('"projectId":"proj-123"');
      expect(logMessage).toContain('"documentId":"doc-456"');
      expect(logMessage).toContain('"nested"');
      expect(logMessage).toContain('"array"');
    });

    it('should handle null and undefined in metadata', () => {
      logger.info('CONTEXT', 'Meta with nulls', { nullField: null, undefinedField: undefined });

      expect(mocks.console.info).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('"nullField":null');
    });
  });

  // ============================================
  // logger.warn() Tests
  // ============================================
  describe('logger.warn', () => {
    it('should log warning messages', () => {
      logger.warn('S3', 'Approaching timeout threshold');

      expect(mocks.console.warn).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.warn.mock.calls[0][0];
      expect(logMessage).toContain('[2026-01-31T12:00:00.000Z]');
      expect(logMessage).toContain('[WARN]');
      expect(logMessage).toContain('[S3]');
      expect(logMessage).toContain('Approaching timeout threshold');
    });

    it('should log warning messages with metadata', () => {
      logger.warn('RATE_LIMIT', 'User approaching limit', { userId: 'user-123', current: 18, limit: 20 });

      expect(mocks.console.warn).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.warn.mock.calls[0][0];
      expect(logMessage).toContain('[WARN]');
      expect(logMessage).toContain('User approaching limit');
      expect(logMessage).toContain('"userId":"user-123"');
      expect(logMessage).toContain('"current":18');
      expect(logMessage).toContain('"limit":20');
    });

    it('should log warnings in all environments', () => {
      vi.stubEnv('NODE_ENV', 'production');
      logger.warn('TEST', 'Warning message');
      expect(mocks.console.warn).toHaveBeenCalledTimes(1);

      mocks.console.warn.mockClear();
      vi.stubEnv('NODE_ENV', 'development');
      logger.warn('TEST', 'Warning message');
      expect(mocks.console.warn).toHaveBeenCalledTimes(1);
    });

    it('should handle special characters in warning messages', () => {
      logger.warn('CONTEXT', 'Warning: "special" <chars> & symbols');

      expect(mocks.console.warn).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.warn.mock.calls[0][0];
      expect(logMessage).toContain('Warning: "special" <chars> & symbols');
    });
  });

  // ============================================
  // logger.error() Tests
  // ============================================
  describe('logger.error', () => {
    it('should log error messages without error object', () => {
      logger.error('ONEDRIVE', 'Upload failed');

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('[2026-01-31T12:00:00.000Z]');
      expect(logMessage).toContain('[ERROR]');
      expect(logMessage).toContain('[ONEDRIVE]');
      expect(logMessage).toContain('Upload failed');
    });

    it('should log error messages with Error instance', () => {
      const error = new Error('Network timeout');
      error.stack = 'Error: Network timeout\n    at Object.<anonymous> (/app/lib/test.ts:10:15)\n    at Module._compile (node:internal/modules/cjs/loader:1105:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1159:10)';

      logger.error('S3', 'Upload failed', error);

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('[ERROR]');
      expect(logMessage).toContain('Upload failed');
      expect(logMessage).toContain('"errorMessage":"Network timeout"');
      expect(logMessage).toContain('"stack"');
    });

    it('should truncate error stack to first 3 lines', () => {
      const error = new Error('Test error');
      error.stack = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';

      logger.error('CONTEXT', 'Error occurred', error);

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('Line 1 | Line 2 | Line 3');
      expect(logMessage).not.toContain('Line 4');
    });

    it('should handle Error instance without stack trace', () => {
      const error = new Error('Error without stack');
      delete error.stack;

      logger.error('CONTEXT', 'Error occurred', error);

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"errorMessage":"Error without stack"');
    });

    it('should log error with non-Error object', () => {
      const errorObj = { code: 'ERR_TIMEOUT', message: 'Request timeout' };

      logger.error('API', 'Request failed', errorObj);

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('[ERROR]');
      expect(logMessage).toContain('Request failed');
      expect(logMessage).toContain('"error"');
    });

    it('should log error with string error', () => {
      logger.error('CONTEXT', 'Failed operation', 'String error message');

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"error":"String error message"');
    });

    it('should log error with number error', () => {
      logger.error('CONTEXT', 'Failed operation', 404);

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"error":"404"');
    });

    it('should log error with additional metadata', () => {
      const error = new Error('Database connection failed');
      const metadata = { dbHost: 'localhost', retries: 3 };

      logger.error('DATABASE', 'Connection error', error, metadata);

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"errorMessage":"Database connection failed"');
      expect(logMessage).toContain('"dbHost":"localhost"');
      expect(logMessage).toContain('"retries":3');
    });

    it('should merge error metadata with additional metadata', () => {
      const error = new Error('Test error');
      error.stack = 'Stack trace here\nLine 2\nLine 3';
      const metadata = { fileName: 'test.pdf', fileSize: 1024 };

      logger.error('UPLOAD', 'Upload failed', error, metadata);

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"errorMessage":"Test error"');
      expect(logMessage).toContain('"stack"');
      expect(logMessage).toContain('"fileName":"test.pdf"');
      expect(logMessage).toContain('"fileSize":1024');
    });

    it('should handle error parameter as undefined', () => {
      logger.error('CONTEXT', 'Error without details', undefined, { extra: 'info' });

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('Error without details');
      expect(logMessage).toContain('"extra":"info"');
      expect(logMessage).not.toContain('"errorMessage"');
      expect(logMessage).not.toContain('"error"');
    });

    it('should handle error with circular reference in metadata', () => {
      const error = new Error('Test error');
      const circularMeta: Record<string, unknown> = { id: '123' };
      circularMeta.self = circularMeta; // Create circular reference

      // This should not throw
      expect(() => {
        logger.error('CONTEXT', 'Circular ref test', error, circularMeta);
      }).not.toThrow();

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // createScopedLogger() Tests
  // ============================================
  describe('createScopedLogger', () => {
    it('should create scoped logger with fixed context', () => {
      const scopedLog = createScopedLogger('FINALIZATION');

      scopedLog.info('Process started');

      expect(mocks.console.info).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('[INFO]');
      expect(logMessage).toContain('[FINALIZATION]');
      expect(logMessage).toContain('Process started');
    });

    it('should handle scoped debug in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const scopedLog = createScopedLogger('DEBUG_CONTEXT');

      scopedLog.debug('Debug info', { detail: 'value' });

      expect(mocks.console.debug).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.debug.mock.calls[0][0];
      expect(logMessage).toContain('[DEBUG]');
      expect(logMessage).toContain('[DEBUG_CONTEXT]');
      expect(logMessage).toContain('Debug info');
      expect(logMessage).toContain('"detail":"value"');
    });

    it('should handle scoped warnings', () => {
      const scopedLog = createScopedLogger('WARNING_CONTEXT');

      scopedLog.warn('Potential issue', { code: 'WARN_01' });

      expect(mocks.console.warn).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.warn.mock.calls[0][0];
      expect(logMessage).toContain('[WARN]');
      expect(logMessage).toContain('[WARNING_CONTEXT]');
      expect(logMessage).toContain('Potential issue');
    });

    it('should handle scoped errors with Error instance', () => {
      const scopedLog = createScopedLogger('ERROR_CONTEXT');
      const error = new Error('Scoped error');

      scopedLog.error('Operation failed', error);

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('[ERROR]');
      expect(logMessage).toContain('[ERROR_CONTEXT]');
      expect(logMessage).toContain('Operation failed');
      expect(logMessage).toContain('"errorMessage":"Scoped error"');
    });

    it('should handle scoped errors with metadata', () => {
      const scopedLog = createScopedLogger('UPLOAD');
      const error = new Error('Upload timeout');

      scopedLog.error('Failed to upload', error, { fileName: 'document.pdf' });

      expect(mocks.console.error).toHaveBeenCalledTimes(1);
      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('[UPLOAD]');
      expect(logMessage).toContain('"errorMessage":"Upload timeout"');
      expect(logMessage).toContain('"fileName":"document.pdf"');
    });

    it('should create multiple independent scoped loggers', () => {
      const log1 = createScopedLogger('SERVICE_A');
      const log2 = createScopedLogger('SERVICE_B');

      log1.info('Service A message');
      log2.info('Service B message');

      expect(mocks.console.info).toHaveBeenCalledTimes(2);
      expect(mocks.console.info.mock.calls[0][0]).toContain('[SERVICE_A]');
      expect(mocks.console.info.mock.calls[1][0]).toContain('[SERVICE_B]');
    });

    it('should preserve context across multiple log calls', () => {
      const scopedLog = createScopedLogger('PERSISTENT_CONTEXT');

      scopedLog.info('First call');
      scopedLog.warn('Second call');
      scopedLog.error('Third call');

      expect(mocks.console.info.mock.calls[0][0]).toContain('[PERSISTENT_CONTEXT]');
      expect(mocks.console.warn.mock.calls[0][0]).toContain('[PERSISTENT_CONTEXT]');
      expect(mocks.console.error.mock.calls[0][0]).toContain('[PERSISTENT_CONTEXT]');
    });
  });

  // ============================================
  // Format Message Tests
  // ============================================
  describe('message formatting', () => {
    it('should include timestamp in ISO format', () => {
      logger.info('CONTEXT', 'Message');

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toMatch(/^\[2026-01-31T12:00:00\.000Z\]/);
    });

    it('should uppercase log level in message', () => {
      logger.debug('CTX', 'Debug');
      logger.info('CTX', 'Info');
      logger.warn('CTX', 'Warn');
      logger.error('CTX', 'Error');

      // Only info, warn, error should be called (debug requires development mode)
      expect(mocks.console.info.mock.calls[0][0]).toContain('[INFO]');
      expect(mocks.console.warn.mock.calls[0][0]).toContain('[WARN]');
      expect(mocks.console.error.mock.calls[0][0]).toContain('[ERROR]');
    });

    it('should format message without metadata', () => {
      logger.info('CONTEXT', 'Simple message');

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toMatch(/\[.*\] \[INFO\] \[CONTEXT\] Simple message$/);
      expect(logMessage).not.toContain('{');
    });

    it('should format message with metadata as JSON string', () => {
      logger.info('CONTEXT', 'Message', { key: 'value' });

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('{"key":"value"}');
    });

    it('should handle empty context string', () => {
      logger.info('', 'Message');

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('[]');
      expect(logMessage).toContain('Message');
    });

    it('should handle empty message string', () => {
      logger.info('CONTEXT', '');

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('[CONTEXT]');
      expect(mocks.console.info).toHaveBeenCalledTimes(1);
    });

    it('should handle long context names', () => {
      const longContext = 'VERY_LONG_CONTEXT_NAME_THAT_EXCEEDS_NORMAL_LENGTH';
      logger.info(longContext, 'Message');

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain(`[${longContext}]`);
    });

    it('should handle special characters in context', () => {
      logger.info('CONTEXT-WITH_SPECIAL.CHARS', 'Message');

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('[CONTEXT-WITH_SPECIAL.CHARS]');
    });

    it('should handle multiline messages', () => {
      logger.info('CONTEXT', 'Line 1\nLine 2\nLine 3');

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('Line 1\nLine 2\nLine 3');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('edge cases', () => {
    it('should handle very large metadata objects', () => {
      const largeMeta = {
        data: Array.from({ length: 100 }, (_, i) => ({ index: i, value: `item-${i}` })),
      };

      expect(() => {
        logger.info('CONTEXT', 'Large metadata', largeMeta);
      }).not.toThrow();

      expect(mocks.console.info).toHaveBeenCalledTimes(1);
    });

    it('should handle metadata with boolean values', () => {
      logger.info('CONTEXT', 'Boolean test', { success: true, failed: false });

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('"success":true');
      expect(logMessage).toContain('"failed":false');
    });

    it('should handle metadata with Date objects', () => {
      const testDate = new Date('2026-01-31T12:00:00.000Z');
      logger.info('CONTEXT', 'Date test', { timestamp: testDate });

      const logMessage = mocks.console.info.mock.calls[0][0];
      expect(logMessage).toContain('"timestamp"');
      expect(mocks.console.info).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid consecutive log calls', () => {
      for (let i = 0; i < 10; i++) {
        logger.info('RAPID', `Message ${i}`);
      }

      expect(mocks.console.info).toHaveBeenCalledTimes(10);
    });

    it('should handle error with empty message', () => {
      const error = new Error('');
      logger.error('CONTEXT', 'Error occurred', error);

      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"errorMessage":""');
    });

    it('should handle zero as error parameter', () => {
      logger.error('CONTEXT', 'Zero error', 0);

      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"error":"0"');
    });

    it('should handle false as error parameter', () => {
      logger.error('CONTEXT', 'False error', false);

      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"error":"false"');
    });

    it('should handle empty string as error parameter', () => {
      logger.error('CONTEXT', 'Empty string error', '');

      const logMessage = mocks.console.error.mock.calls[0][0];
      expect(logMessage).toContain('"error":""');
    });
  });
});
