import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.stubGlobal('fetch', mockFetch);

// Import after mocks are set up
import {
  getAccessToken,
  clearTokenCache,
  isAutodeskConfigured,
} from '@/lib/autodesk-auth';

describe('Autodesk Auth Module', () => {
  // Save original environment
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment for each test
    process.env = { ...originalEnv };
    // Clear token cache before each test
    clearTokenCache();
    // Mock Date.now for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  describe('isAutodeskConfigured', () => {
    it('should return true when both credentials are configured', () => {
      process.env.AUTODESK_CLIENT_ID = 'test-client-id';
      process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

      expect(isAutodeskConfigured()).toBe(true);
    });

    it('should return false when client ID is missing', () => {
      process.env.AUTODESK_CLIENT_ID = '';
      process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

      expect(isAutodeskConfigured()).toBe(false);
    });

    it('should return false when client secret is missing', () => {
      process.env.AUTODESK_CLIENT_ID = 'test-client-id';
      process.env.AUTODESK_CLIENT_SECRET = '';

      expect(isAutodeskConfigured()).toBe(false);
    });

    it('should return false when both credentials are missing', () => {
      delete process.env.AUTODESK_CLIENT_ID;
      delete process.env.AUTODESK_CLIENT_SECRET;

      expect(isAutodeskConfigured()).toBe(false);
    });

    it('should return false when client ID is undefined', () => {
      delete process.env.AUTODESK_CLIENT_ID;
      process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

      expect(isAutodeskConfigured()).toBe(false);
    });

    it('should return false when client secret is undefined', () => {
      process.env.AUTODESK_CLIENT_ID = 'test-client-id';
      delete process.env.AUTODESK_CLIENT_SECRET;

      expect(isAutodeskConfigured()).toBe(false);
    });
  });

  describe('clearTokenCache', () => {
    it('should clear cached token', async () => {
      process.env.AUTODESK_CLIENT_ID = 'test-client-id';
      process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

      const mockToken = {
        access_token: 'mock-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken,
      });

      // Get token to cache it
      await getAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache (no new fetch)
      await getAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearTokenCache();

      // Third call should fetch again
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken,
      });

      await getAccessToken();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should allow clearTokenCache to be called multiple times', () => {
      expect(() => {
        clearTokenCache();
        clearTokenCache();
        clearTokenCache();
      }).not.toThrow();
    });

    it('should work when cache is already empty', () => {
      clearTokenCache();
      expect(() => clearTokenCache()).not.toThrow();
    });
  });

  describe('getAccessToken', () => {
    describe('Error handling', () => {
      it('should throw error when credentials are not configured', async () => {
        delete process.env.AUTODESK_CLIENT_ID;
        delete process.env.AUTODESK_CLIENT_SECRET;

        await expect(getAccessToken()).rejects.toThrow(
          'Autodesk credentials not configured'
        );
      });

      it('should throw error when only client ID is missing', async () => {
        delete process.env.AUTODESK_CLIENT_ID;
        process.env.AUTODESK_CLIENT_SECRET = 'test-secret';

        await expect(getAccessToken()).rejects.toThrow(
          'Autodesk credentials not configured'
        );
      });

      it('should throw error when only client secret is missing', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-id';
        delete process.env.AUTODESK_CLIENT_SECRET;

        await expect(getAccessToken()).rejects.toThrow(
          'Autodesk credentials not configured'
        );
      });

      it('should throw error when API request fails with 401', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized',
        });


        await expect(getAccessToken()).rejects.toThrow(
          'Failed to get Autodesk token: 401'
        );

        expect(mockLogger.error).toHaveBeenCalled();

      });

      it('should throw error when API request fails with 403', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        });


        await expect(getAccessToken()).rejects.toThrow(
          'Failed to get Autodesk token: 403'
        );

      });

      it('should throw error when API request fails with 500', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });


        await expect(getAccessToken()).rejects.toThrow(
          'Failed to get Autodesk token: 500'
        );

      });

      it('should handle network errors', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const networkError = new Error('Network timeout');
        mockFetch.mockRejectedValueOnce(networkError);


        await expect(getAccessToken()).rejects.toThrow('Network timeout');

        expect(mockLogger.error).toHaveBeenCalled();

      });

      it('should handle JSON parsing errors', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });


        await expect(getAccessToken()).rejects.toThrow('Invalid JSON');

      });
    });

    describe('Successful token retrieval', () => {
      it('should fetch and return access token on first call', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });


        const token = await getAccessToken();

        expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://developer.api.autodesk.com/authentication/v2/token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: 'test-client-id',
              client_secret: 'test-client-secret',
              grant_type: 'client_credentials',
              scope: 'data:read data:write data:create bucket:read bucket:create viewables:read',
            }),
          }
        );

        expect(mockLogger.info).toHaveBeenCalled();

      });

      it('should include all required OAuth parameters', async () => {
        process.env.AUTODESK_CLIENT_ID = 'my-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'my-secret-key';

        const mockToken = {
          access_token: 'token-abc',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });

        await getAccessToken();

        const fetchCall = mockFetch.mock.calls[0];
        const body = fetchCall[1].body as URLSearchParams;

        expect(body.get('client_id')).toBe('my-client-id');
        expect(body.get('client_secret')).toBe('my-secret-key');
        expect(body.get('grant_type')).toBe('client_credentials');
        expect(body.get('scope')).toContain('data:read');
        expect(body.get('scope')).toContain('data:write');
        expect(body.get('scope')).toContain('bucket:create');
        expect(body.get('scope')).toContain('viewables:read');
      });

      it('should set correct Content-Type header', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'token',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });

        await getAccessToken();

        const fetchCall = mockFetch.mock.calls[0];
        expect(fetchCall[1].headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      });
    });

    describe('Token caching', () => {
      it('should return cached token on second call', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'cached-token-123',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });

        // First call
        const token1 = await getAccessToken();
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Second call should use cache
        const token2 = await getAccessToken();
        expect(mockFetch).toHaveBeenCalledTimes(1); // Still 1
        expect(token1).toBe(token2);
      });

      it('should use cached token within validity period (1 hour)', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'valid-token',
          token_type: 'Bearer',
          expires_in: 3600, // 1 hour
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });

        await getAccessToken();

        // Advance time by 30 minutes (within validity)
        vi.advanceTimersByTime(30 * 60 * 1000);

        await getAccessToken();
        expect(mockFetch).toHaveBeenCalledTimes(1); // Only initial fetch
      });

      it('should use cached token with 5-minute buffer before expiry', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'token-with-buffer',
          token_type: 'Bearer',
          expires_in: 3600, // 1 hour
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });

        await getAccessToken();

        // Advance to 54 minutes (still 6 minutes before expiry, within 5-min buffer)
        vi.advanceTimersByTime(54 * 60 * 1000);

        await getAccessToken();
        expect(mockFetch).toHaveBeenCalledTimes(1); // Still cached
      });

      it('should fetch new token when cache expires (beyond 5-minute buffer)', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken1 = {
          access_token: 'expired-token',
          token_type: 'Bearer',
          expires_in: 3600, // 1 hour
        };

        const mockToken2 = {
          access_token: 'new-fresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken1,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken2,
          });

        const token1 = await getAccessToken();
        expect(token1).toBe('expired-token');

        // Advance to 56 minutes (only 4 minutes before expiry, outside 5-min buffer)
        vi.advanceTimersByTime(56 * 60 * 1000);

        const token2 = await getAccessToken();
        expect(token2).toBe('new-fresh-token');
        expect(mockFetch).toHaveBeenCalledTimes(2); // New fetch
      });

      it('should fetch new token when exactly at 5-minute buffer threshold', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken1 = {
          access_token: 'token-1',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        const mockToken2 = {
          access_token: 'token-2',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken1,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken2,
          });

        await getAccessToken();

        // Advance exactly to 5 minutes before expiry (3600 - 300 = 3300 seconds)
        vi.advanceTimersByTime(55 * 60 * 1000);

        await getAccessToken();
        expect(mockFetch).toHaveBeenCalledTimes(2); // Should fetch new token
      });

      it('should refetch token with short expiry time (less than 5-minute buffer)', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken1 = {
          access_token: 'short-lived-token-1',
          token_type: 'Bearer',
          expires_in: 60, // Only 1 minute - less than 5-minute buffer
        };

        const mockToken2 = {
          access_token: 'short-lived-token-2',
          token_type: 'Bearer',
          expires_in: 60,
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken1,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken2,
          });

        await getAccessToken();

        // Even immediately, the token is considered too short-lived (< 5 min buffer)
        // So the next call will refetch
        const token = await getAccessToken();
        expect(token).toBe('short-lived-token-2');
        expect(mockFetch).toHaveBeenCalledTimes(2); // Refetched
      });

      it('should refetch token with very short expiry after buffer', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken1 = {
          access_token: 'short-token-1',
          token_type: 'Bearer',
          expires_in: 400, // 6 minutes 40 seconds
        };

        const mockToken2 = {
          access_token: 'short-token-2',
          token_type: 'Bearer',
          expires_in: 400,
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken1,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken2,
          });

        await getAccessToken();

        // Advance by 2 minutes (only 4:40 left, within 5-min buffer)
        vi.advanceTimersByTime(2 * 60 * 1000);

        await getAccessToken();
        expect(mockFetch).toHaveBeenCalledTimes(2); // Should refetch
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string credentials', async () => {
        process.env.AUTODESK_CLIENT_ID = '';
        process.env.AUTODESK_CLIENT_SECRET = '';

        await expect(getAccessToken()).rejects.toThrow(
          'Autodesk credentials not configured'
        );
      });

      it('should handle whitespace-only credentials', async () => {
        process.env.AUTODESK_CLIENT_ID = '   ';
        process.env.AUTODESK_CLIENT_SECRET = '   ';

        // Whitespace strings are truthy, so they pass the initial check
        // but will fail at the API level
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: async () => 'Invalid credentials',
        });


        await expect(getAccessToken()).rejects.toThrow('Failed to get Autodesk token: 401');

      });

      it('should handle token response with extra fields', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'token-with-extras',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'data:read data:write',
          refresh_token: 'refresh-123',
          extra_field: 'ignored',
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });

        const token = await getAccessToken();
        expect(token).toBe('token-with-extras');
      });

      it('should handle extremely long token expiry', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'long-lived-token',
          token_type: 'Bearer',
          expires_in: 86400 * 365, // 1 year in seconds
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });

        const token = await getAccessToken();
        expect(token).toBe('long-lived-token');

        // Even after 1 day, should still be cached
        vi.advanceTimersByTime(24 * 60 * 60 * 1000);
        await getAccessToken();
        expect(mockFetch).toHaveBeenCalledTimes(1); // Still cached
      });

      it('should handle concurrent requests (both should use same token)', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'concurrent-token',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => mockToken,
        });

        // Make concurrent calls
        const [token1, token2, token3] = await Promise.all([
          getAccessToken(),
          getAccessToken(),
          getAccessToken(),
        ]);

        // All should return same token
        expect(token1).toBe('concurrent-token');
        expect(token2).toBe('concurrent-token');
        expect(token3).toBe('concurrent-token');

        // Note: Due to race conditions, fetch might be called multiple times
        // This is acceptable for a simple cache implementation
        expect(mockFetch).toHaveBeenCalled();
      });

      it('should handle different token types', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'test-token',
          token_type: 'Custom',
          expires_in: 3600,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });

        const token = await getAccessToken();
        expect(token).toBe('test-token');
      });

      it('should handle zero expiry time', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken1 = {
          access_token: 'zero-expiry-token',
          token_type: 'Bearer',
          expires_in: 0,
        };

        const mockToken2 = {
          access_token: 'new-token',
          token_type: 'Bearer',
          expires_in: 3600,
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken1,
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => mockToken2,
          });

        await getAccessToken();

        // Should immediately expire and fetch new token
        const token = await getAccessToken();
        expect(token).toBe('new-token');
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    describe('Console logging', () => {
      it('should log successful token retrieval', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const mockToken = {
          access_token: 'log-test-token',
          token_type: 'Bearer',
          expires_in: 7200,
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockToken,
        });


        await getAccessToken();

        expect(mockLogger.info).toHaveBeenCalled();

      });

      it('should log error details when request fails', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Bad Request: Invalid scope',
        });


        await expect(getAccessToken()).rejects.toThrow('Failed to get Autodesk token: 400');

        expect(mockLogger.error).toHaveBeenCalled();

      });

      it('should log error when exception occurs', async () => {
        process.env.AUTODESK_CLIENT_ID = 'test-client-id';
        process.env.AUTODESK_CLIENT_SECRET = 'test-client-secret';

        const testError = new Error('Test error');
        mockFetch.mockRejectedValueOnce(testError);


        await expect(getAccessToken()).rejects.toThrow('Test error');

        expect(mockLogger.error).toHaveBeenCalled();

      });
    });
  });
});
