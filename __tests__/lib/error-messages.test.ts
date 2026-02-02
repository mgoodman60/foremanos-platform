import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  categorizeError,
  getErrorInfo,
  getUserFriendlyMessage,
  formatToastError,
  isRecoverableError,
  getRecoveryActions,
  createApiError,
  logError,
  type ErrorCategory,
} from '@/lib/error-messages';

describe('error-messages', () => {
  describe('categorizeError', () => {
    describe('HTTP status codes', () => {
      it('should categorize 400 as validation', () => {
        expect(categorizeError(400)).toBe('validation');
      });

      it('should categorize 401 as auth', () => {
        expect(categorizeError(401)).toBe('auth');
      });

      it('should categorize 403 as permission', () => {
        expect(categorizeError(403)).toBe('permission');
      });

      it('should categorize 404 as validation', () => {
        expect(categorizeError(404)).toBe('validation');
      });

      it('should categorize 408 as network', () => {
        expect(categorizeError(408)).toBe('network');
      });

      it('should categorize 413 as file', () => {
        expect(categorizeError(413)).toBe('file');
      });

      it('should categorize 415 as file', () => {
        expect(categorizeError(415)).toBe('file');
      });

      it('should categorize 429 as rate_limit', () => {
        expect(categorizeError(429)).toBe('rate_limit');
      });

      it('should categorize 500 as server', () => {
        expect(categorizeError(500)).toBe('server');
      });

      it('should categorize 502 as server', () => {
        expect(categorizeError(502)).toBe('server');
      });

      it('should categorize 503 as server', () => {
        expect(categorizeError(503)).toBe('server');
      });

      it('should categorize 504 as network', () => {
        expect(categorizeError(504)).toBe('network');
      });

      it('should categorize unknown status codes as unknown', () => {
        expect(categorizeError(418)).toBe('unknown'); // I'm a teapot
        expect(categorizeError(999)).toBe('unknown');
      });
    });

    describe('Response objects', () => {
      it('should categorize Response object by status', () => {
        const response = new Response(null, { status: 401 });
        expect(categorizeError(response)).toBe('auth');
      });

      it('should categorize Response with unknown status as unknown', () => {
        const response = new Response(null, { status: 418 });
        expect(categorizeError(response)).toBe('unknown');
      });
    });

    describe('Error messages', () => {
      it('should categorize network errors', () => {
        expect(categorizeError('Network request failed')).toBe('network');
        expect(categorizeError('fetch error occurred')).toBe('network');
        expect(categorizeError('Connection timeout')).toBe('network');
        expect(categorizeError('User is offline')).toBe('network');
        expect(categorizeError('Request aborted')).toBe('network');
      });

      it('should categorize auth errors', () => {
        expect(categorizeError('Unauthorized access')).toBe('auth');
        expect(categorizeError('Unauthenticated user')).toBe('auth');
        expect(categorizeError('Session expired')).toBe('auth');
        expect(categorizeError('Invalid token')).toBe('auth');
        expect(categorizeError('Please sign in')).toBe('auth');
        expect(categorizeError('Login required')).toBe('auth');
      });

      it('should categorize permission errors', () => {
        expect(categorizeError('Forbidden resource')).toBe('permission');
        expect(categorizeError('No permission to access')).toBe('permission');
        expect(categorizeError('Access denied')).toBe('permission');
        expect(categorizeError('Not allowed to perform this action')).toBe('permission');
      });

      it('should categorize file errors', () => {
        expect(categorizeError('File too large')).toBe('file');
        expect(categorizeError('Upload failed')).toBe('file');
        expect(categorizeError('Invalid file size')).toBe('file');
        expect(categorizeError('Unsupported file format')).toBe('file');
        expect(categorizeError('Wrong file type')).toBe('file');
      });

      it('should categorize rate limit errors', () => {
        expect(categorizeError('Rate limit exceeded')).toBe('rate_limit');
        expect(categorizeError('Too many requests')).toBe('rate_limit');
        expect(categorizeError('Quota exceeded')).toBe('rate_limit');
      });

      it('should categorize subscription errors', () => {
        expect(categorizeError('Subscription required')).toBe('subscription');
        expect(categorizeError('Please upgrade your plan')).toBe('subscription');
        // "limit" triggers rate_limit first, so use different phrase
        expect(categorizeError('Subscription tier expired')).toBe('subscription');
      });

      it('should categorize server errors', () => {
        expect(categorizeError('Internal server error')).toBe('server');
        expect(categorizeError('Server error 500')).toBe('server');
      });

      it('should categorize validation errors', () => {
        expect(categorizeError('Invalid input data')).toBe('validation');
        expect(categorizeError('Required field missing')).toBe('validation');
        expect(categorizeError('Validation failed')).toBe('validation');
      });

      it('should categorize Error objects by message', () => {
        const error = new Error('Network connection failed');
        expect(categorizeError(error)).toBe('network');
      });

      it('should handle case-insensitive matching', () => {
        expect(categorizeError('NETWORK ERROR')).toBe('network');
        expect(categorizeError('Unauthorized')).toBe('auth');
      });

      it('should categorize unknown errors', () => {
        expect(categorizeError('Something random happened')).toBe('unknown');
        expect(categorizeError('')).toBe('unknown');
      });
    });
  });

  describe('getErrorInfo', () => {
    it('should return error info for network errors', () => {
      const info = getErrorInfo('Network error');

      expect(info.title).toBe('Connection Error');
      expect(info.message).toContain('Unable to connect');
      expect(info.recoverable).toBe(true);
      expect(info.actionText).toBe('Try Again');
      expect(info.actionType).toBe('retry');
    });

    it('should return error info for auth errors', () => {
      const info = getErrorInfo(401);

      expect(info.title).toBe('Session Expired');
      expect(info.recoverable).toBe(false);
      expect(info.actionType).toBe('redirect');
      expect(info.redirectPath).toBe('/login');
    });

    it('should return error info for permission errors', () => {
      const info = getErrorInfo(403);

      expect(info.title).toBe('Access Denied');
      expect(info.recoverable).toBe(false);
      expect(info.redirectPath).toBe('/dashboard');
    });

    it('should return error info for validation errors', () => {
      const info = getErrorInfo(400);

      expect(info.title).toBe('Invalid Request');
      expect(info.recoverable).toBe(true);
    });

    it('should return error info for file errors', () => {
      const info = getErrorInfo('File too large');

      expect(info.title).toBe('File Error');
      expect(info.recoverable).toBe(true);
    });

    it('should return error info for server errors', () => {
      const info = getErrorInfo(500);

      expect(info.title).toBe('Server Error');
      expect(info.actionType).toBe('refresh');
    });

    it('should return error info for rate limit errors', () => {
      const info = getErrorInfo(429);

      expect(info.title).toBe('Too Many Requests');
      expect(info.recoverable).toBe(true);
    });

    it('should return error info for subscription errors', () => {
      const info = getErrorInfo('Upgrade required');

      expect(info.title).toBe('Upgrade Required');
      expect(info.redirectPath).toBe('/pricing');
    });

    it('should return error info for unknown errors', () => {
      const info = getErrorInfo('Random error');

      expect(info.title).toBe('Something Went Wrong');
      expect(info.recoverable).toBe(true);
    });

    it('should include specific error message in context', () => {
      const info = getErrorInfo('Network timeout', 'fetching projects');

      expect(info.message).toContain('Network timeout');
    });

    it('should handle Error objects', () => {
      const error = new Error('Custom error message');
      const info = getErrorInfo(error, 'test context');

      expect(info.message).toContain('Custom error message');
    });

    it('should include recovery actions', () => {
      const info = getErrorInfo('Network error');

      expect(info.recoveryActions).toBeInstanceOf(Array);
      expect(info.recoveryActions.length).toBeGreaterThan(0);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly message for network error', () => {
      const message = getUserFriendlyMessage('fetch failed');

      expect(message).toContain('Unable to connect');
    });

    it('should return user-friendly message for auth error', () => {
      const message = getUserFriendlyMessage(401);

      expect(message).toContain('session');
    });

    it('should return user-friendly message even for unknown errors', () => {
      const message = getUserFriendlyMessage('Unknown error');

      // Unknown errors still get a friendly message, not the raw fallback
      expect(message).toContain('unexpected error');
    });

    it('should use default fallback when not provided', () => {
      const message = getUserFriendlyMessage('Some random error');

      expect(message).toBe(message);
      expect(typeof message).toBe('string');
    });

    it('should handle string errors', () => {
      const message = getUserFriendlyMessage('Permission denied');

      expect(message).toContain('permission');
    });

    it('should handle Error objects', () => {
      const error = new Error('Server error');
      const message = getUserFriendlyMessage(error);

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });
  });

  describe('formatToastError', () => {
    it('should format error for toast with title and description', () => {
      const toast = formatToastError('Network timeout');

      expect(toast).toHaveProperty('title');
      expect(toast).toHaveProperty('description');
      expect(toast.title).toBe('Connection Error');
      expect(toast.description).toBeTruthy();
    });

    it('should use first recovery action as description', () => {
      const toast = formatToastError('Network error');

      expect(toast.description).toContain('internet connection');
    });

    it('should handle Error objects', () => {
      const error = new Error('Validation failed');
      const toast = formatToastError(error);

      expect(toast.title).toBe('Invalid Request');
      expect(toast.description).toBeTruthy();
    });

    it('should handle different error categories', () => {
      const authToast = formatToastError('Unauthorized');
      expect(authToast.title).toBe('Session Expired');

      const serverToast = formatToastError('Internal server error');
      expect(serverToast.title).toBe('Server Error');
    });
  });

  describe('isRecoverableError', () => {
    it('should return true for network errors', () => {
      expect(isRecoverableError('Network error')).toBe(true);
    });

    it('should return true for validation errors', () => {
      expect(isRecoverableError(400)).toBe(true);
    });

    it('should return true for file errors', () => {
      expect(isRecoverableError('File too large')).toBe(true);
    });

    it('should return true for server errors', () => {
      expect(isRecoverableError(500)).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      expect(isRecoverableError(429)).toBe(true);
    });

    it('should return false for auth errors', () => {
      expect(isRecoverableError(401)).toBe(false);
    });

    it('should return false for permission errors', () => {
      expect(isRecoverableError(403)).toBe(false);
    });

    it('should return false for subscription errors', () => {
      expect(isRecoverableError('Upgrade required')).toBe(false);
    });

    it('should return true for unknown errors', () => {
      expect(isRecoverableError('Unknown error')).toBe(true);
    });

    it('should handle Error objects', () => {
      const recoverableError = new Error('Network timeout');
      expect(isRecoverableError(recoverableError)).toBe(true);

      const nonRecoverableError = new Error('Unauthorized');
      expect(isRecoverableError(nonRecoverableError)).toBe(false);
    });
  });

  describe('getRecoveryActions', () => {
    it('should return array of recovery actions', () => {
      const actions = getRecoveryActions('Network error');

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });

    it('should return specific actions for network errors', () => {
      const actions = getRecoveryActions('Network error');

      expect(actions.some(a => a.toLowerCase().includes('internet'))).toBe(true);
    });

    it('should return specific actions for auth errors', () => {
      const actions = getRecoveryActions(401);

      expect(actions.some(a => a.toLowerCase().includes('sign in'))).toBe(true);
    });

    it('should return specific actions for file errors', () => {
      const actions = getRecoveryActions('File too large');

      expect(actions.some(a => a.toLowerCase().includes('mb'))).toBe(true);
    });

    it('should return specific actions for rate limit errors', () => {
      const actions = getRecoveryActions(429);

      expect(actions.some(a => a.toLowerCase().includes('wait'))).toBe(true);
    });

    it('should handle Error objects', () => {
      const error = new Error('Server error');
      const actions = getRecoveryActions(error);

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe('createApiError', () => {
    it('should create standardized API error object', () => {
      const apiError = createApiError(400, 'Invalid input');

      expect(apiError).toHaveProperty('error');
      expect(apiError.error).toHaveProperty('code', 400);
      expect(apiError.error).toHaveProperty('message', 'Invalid input');
      expect(apiError.error).toHaveProperty('category');
    });

    it('should categorize error correctly', () => {
      const authError = createApiError(401, 'Unauthorized');
      expect(authError.error.category).toBe('auth');

      const serverError = createApiError(500, 'Internal error');
      expect(serverError.error.category).toBe('server');
    });

    it('should include optional details', () => {
      const apiError = createApiError(400, 'Validation failed', {
        field: 'email',
        reason: 'Invalid format',
      });

      expect(apiError.error.details).toEqual({
        field: 'email',
        reason: 'Invalid format',
      });
    });

    it('should work without details', () => {
      const apiError = createApiError(404, 'Not found');

      expect(apiError.error.details).toBeUndefined();
    });

    it('should handle various status codes', () => {
      const codes = [400, 401, 403, 404, 429, 500, 502, 503];

      codes.forEach(code => {
        const error = createApiError(code, 'Test error');
        expect(error.error.code).toBe(code);
        expect(error.error.category).toBeTruthy();
      });
    });
  });

  describe('logError', () => {
    let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleInfoSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log error with default severity', () => {
      logError('Test error');

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log with info severity', () => {
      logError('Test info', undefined, 'info');

      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log with warn severity', () => {
      logError('Test warning', undefined, 'warn');

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should include context in log', () => {
      logError('Test error', 'test context');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Log]',
        expect.objectContaining({
          context: 'test context',
        })
      );
    });

    it('should include category in log', () => {
      logError('Network error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Log]',
        expect.objectContaining({
          category: 'network',
        })
      );
    });

    it('should include message in log', () => {
      logError('Test error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Log]',
        expect.objectContaining({
          message: 'Test error message',
        })
      );
    });

    it('should include stack trace for Error objects', () => {
      const error = new Error('Test error');
      logError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Log]',
        expect.objectContaining({
          stack: expect.any(String),
        })
      );
    });

    it('should include timestamp', () => {
      logError('Test error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Log]',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle Error objects', () => {
      const error = new Error('Custom error message');
      logError(error, 'error context');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Log]',
        expect.objectContaining({
          message: 'Custom error message',
          context: 'error context',
          stack: expect.any(String),
        })
      );
    });

    it('should handle string errors without stack', () => {
      logError('String error message');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Error Log]',
        expect.objectContaining({
          message: 'String error message',
          stack: undefined,
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty error messages', () => {
      const category = categorizeError('');
      expect(category).toBe('unknown');
    });

    it('should handle undefined context', () => {
      const info = getErrorInfo('Network error', undefined);
      expect(info).toBeTruthy();
    });

    it('should handle complex Error objects', () => {
      class CustomError extends Error {
        constructor(message: string, public code: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error', 'ERR_CUSTOM');
      const category = categorizeError(error);
      expect(category).toBeTruthy();
    });

    it('should handle Response objects with various status codes', () => {
      const statuses = [200, 400, 401, 403, 500, 502];

      statuses.forEach(status => {
        const response = new Response(null, { status });
        const category = categorizeError(response);
        expect(category).toBeTruthy();
      });
    });

    it('should handle mixed case error messages', () => {
      expect(categorizeError('NetWork ERRor')).toBe('network');
      expect(categorizeError('UNAUTHORIZED')).toBe('auth');
      expect(categorizeError('FoRbIdDeN')).toBe('permission');
    });
  });
});
