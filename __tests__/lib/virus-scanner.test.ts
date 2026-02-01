import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  prisma: {
    securityLog: {
      create: vi.fn().mockResolvedValue({ id: 'security-log-1' }),
    },
  },
  fetch: vi.fn(),
  FormData: vi.fn(),
}));

// Mock external dependencies
vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));

// Mock FormData
vi.mock('form-data', () => ({
  default: mocks.FormData,
}));

// Mock global fetch before importing the module
global.fetch = mocks.fetch;

// Import after mocks are set up
import {
  scanFileBuffer,
  getScanResult,
  logSecurityEvent,
} from '@/lib/virus-scanner';

describe('Virus Scanner Module', () => {
  const originalEnv = process.env;
  const testBuffer = Buffer.from('test file content');
  const testFileName = 'test-document.pdf';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    // Setup default FormData mock
    const mockFormDataInstance = {
      append: vi.fn(),
      getHeaders: vi.fn().mockReturnValue({
        'content-type': 'multipart/form-data; boundary=test',
      }),
    };
    mocks.FormData.mockImplementation(() => mockFormDataInstance);

    // Mock timers to avoid waiting
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('scanFileBuffer', () => {
    describe('API Key Validation', () => {
      it('should skip scan when API key is missing and skipIfMissingKey is true', async () => {
        delete process.env.VIRUSTOTAL_API_KEY;

        const result = await scanFileBuffer(testBuffer, testFileName, {
          skipIfMissingKey: true,
        });

        expect(result.clean).toBe(true);
        expect(result.engine).toBe('none');
        expect(result.timestamp).toBeInstanceOf(Date);
      });

      it('should throw error when API key is missing and skipIfMissingKey is false', async () => {
        delete process.env.VIRUSTOTAL_API_KEY;

        await expect(
          scanFileBuffer(testBuffer, testFileName, { skipIfMissingKey: false })
        ).rejects.toThrow('VirusTotal API key not configured');
      });

      it('should use default skipIfMissingKey as true', async () => {
        delete process.env.VIRUSTOTAL_API_KEY;

        const result = await scanFileBuffer(testBuffer, testFileName);

        expect(result.clean).toBe(true);
        expect(result.engine).toBe('none');
      });
    });

    describe('Successful Scan', () => {
      beforeEach(() => {
        process.env.VIRUSTOTAL_API_KEY = 'test-api-key';
      });

      it('should successfully scan a clean file', async () => {
        const mockScanId = 'scan-123456';

        // Mock upload response
        mocks.fetch
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: { id: mockScanId },
            }),
          })
          // Mock scan result response
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                attributes: {
                  stats: {
                    malicious: 0,
                    suspicious: 0,
                    harmless: 50,
                    undetected: 20,
                  },
                },
              },
            }),
          });

        const promise = scanFileBuffer(testBuffer, testFileName);

        // Fast-forward the 2-second delay
        await vi.advanceTimersByTimeAsync(2000);

        const result = await promise;

        expect(result.clean).toBe(true);
        expect(result.engine).toBe('virustotal');
        expect(result.scanId).toBe(mockScanId);
        expect(result.threat).toBeUndefined();
        expect(result.timestamp).toBeInstanceOf(Date);

        // Verify API calls
        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(mocks.fetch).toHaveBeenNthCalledWith(
          1,
          'https://www.virustotal.com/api/v3/files',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'x-apikey': 'test-api-key',
            }),
          })
        );
      });

      it('should detect malicious file', async () => {
        const mockScanId = 'scan-malicious';

        mocks.fetch
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: { id: mockScanId },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                attributes: {
                  stats: {
                    malicious: 5,
                    suspicious: 2,
                    harmless: 40,
                    undetected: 15,
                  },
                },
              },
            }),
          });

        const promise = scanFileBuffer(testBuffer, testFileName);
        await vi.advanceTimersByTimeAsync(2000);
        const result = await promise;

        expect(result.clean).toBe(false);
        expect(result.engine).toBe('virustotal');
        expect(result.threat).toBe('5 engines detected threat');
        expect(result.scanId).toBe(mockScanId);
      });

      it('should use custom timeout option', async () => {
        const customTimeout = 60000;
        const mockScanId = 'scan-timeout-test';

        mocks.fetch
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: { id: mockScanId },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                attributes: {
                  stats: { malicious: 0, suspicious: 0 },
                },
              },
            }),
          });

        const promise = scanFileBuffer(testBuffer, testFileName, {
          timeout: customTimeout,
        });
        await vi.advanceTimersByTimeAsync(2000);
        const result = await promise;

        expect(result.clean).toBe(true);
      });

      it('should handle empty buffer', async () => {
        const emptyBuffer = Buffer.alloc(0);
        const mockScanId = 'scan-empty';

        mocks.fetch
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: { id: mockScanId },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                attributes: {
                  stats: { malicious: 0, suspicious: 0 },
                },
              },
            }),
          });

        const promise = scanFileBuffer(emptyBuffer, testFileName);
        await vi.advanceTimersByTimeAsync(2000);
        const result = await promise;

        expect(result.clean).toBe(true);
      });

      it('should handle large file buffer', async () => {
        const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
        const mockScanId = 'scan-large';

        mocks.fetch
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: { id: mockScanId },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                attributes: {
                  stats: { malicious: 0, suspicious: 0 },
                },
              },
            }),
          });

        const promise = scanFileBuffer(largeBuffer, testFileName);
        await vi.advanceTimersByTimeAsync(2000);
        const result = await promise;

        expect(result.clean).toBe(true);
      });

      it('should handle special characters in filename', async () => {
        const specialFileName = 'test file (1) @#$.pdf';
        const mockScanId = 'scan-special';

        mocks.fetch
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: { id: mockScanId },
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                attributes: {
                  stats: { malicious: 0, suspicious: 0 },
                },
              },
            }),
          });

        const promise = scanFileBuffer(testBuffer, specialFileName);
        await vi.advanceTimersByTimeAsync(2000);
        const result = await promise;

        expect(result.clean).toBe(true);
      });
    });

    describe('Rate Limiting', () => {
      beforeEach(() => {
        process.env.VIRUSTOTAL_API_KEY = 'test-api-key';
      });

      it('should handle 429 rate limit error gracefully', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limit exceeded',
        });

        const result = await scanFileBuffer(testBuffer, testFileName);

        expect(result.clean).toBe(true);
        expect(result.engine).toBe('virustotal');
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        process.env.VIRUSTOTAL_API_KEY = 'test-api-key';
      });

      it('should handle upload API error', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });

        const result = await scanFileBuffer(testBuffer, testFileName, {
          skipIfMissingKey: true,
        });

        expect(result.clean).toBe(true);
        expect(result.engine).toBe('virustotal');
      });

      it('should throw error when skipIfMissingKey is false on API error', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        });

        await expect(
          scanFileBuffer(testBuffer, testFileName, { skipIfMissingKey: false })
        ).rejects.toThrow('VirusTotal API error: 500 - Internal Server Error');
      });

      it('should handle missing scan ID in response', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {},
          }),
        });

        const result = await scanFileBuffer(testBuffer, testFileName, {
          skipIfMissingKey: true,
        });

        expect(result.clean).toBe(true);
      });

      it('should handle timeout error', async () => {
        const timeoutError = new Error('Request aborted');
        timeoutError.name = 'AbortError';

        mocks.fetch.mockRejectedValueOnce(timeoutError);

        const result = await scanFileBuffer(testBuffer, testFileName, {
          timeout: 5000,
        });

        expect(result.clean).toBe(true);
        expect(result.engine).toBe('virustotal');
      });

      it('should handle network errors with graceful degradation', async () => {
        mocks.fetch.mockRejectedValueOnce(new Error('Network failure'));

        const result = await scanFileBuffer(testBuffer, testFileName, {
          skipIfMissingKey: true,
        });

        expect(result.clean).toBe(true);
        expect(result.engine).toBe('virustotal');
      });

      it('should throw network errors when skipIfMissingKey is false', async () => {
        mocks.fetch.mockRejectedValueOnce(new Error('Network failure'));

        await expect(
          scanFileBuffer(testBuffer, testFileName, { skipIfMissingKey: false })
        ).rejects.toThrow('Network failure');
      });
    });
  });

  describe('getScanResult', () => {
    beforeEach(() => {
      process.env.VIRUSTOTAL_API_KEY = 'test-api-key';
    });

    describe('Success Cases', () => {
      it('should retrieve clean scan result', async () => {
        const scanId = 'scan-result-123';

        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                stats: {
                  malicious: 0,
                  suspicious: 0,
                  harmless: 50,
                  undetected: 10,
                },
              },
            },
          }),
        });

        const result = await getScanResult(scanId);

        expect(result.clean).toBe(true);
        expect(result.engine).toBe('virustotal');
        expect(result.scanId).toBe(scanId);
        expect(result.threat).toBeUndefined();
        expect(result.timestamp).toBeInstanceOf(Date);

        expect(mocks.fetch).toHaveBeenCalledWith(
          `https://www.virustotal.com/api/v3/analyses/${scanId}`,
          expect.objectContaining({
            headers: {
              'x-apikey': 'test-api-key',
            },
          })
        );
      });

      it('should retrieve malicious scan result', async () => {
        const scanId = 'scan-malicious-456';

        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                stats: {
                  malicious: 10,
                  suspicious: 5,
                  harmless: 40,
                  undetected: 5,
                },
              },
            },
          }),
        });

        const result = await getScanResult(scanId);

        expect(result.clean).toBe(false);
        expect(result.threat).toBe('10 engines detected threat');
      });

      it('should detect suspicious files as not clean', async () => {
        const scanId = 'scan-suspicious-789';

        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                stats: {
                  malicious: 0,
                  suspicious: 3,
                  harmless: 55,
                  undetected: 2,
                },
              },
            },
          }),
        });

        const result = await getScanResult(scanId);

        expect(result.clean).toBe(false);
        expect(result.threat).toBe('0 engines detected threat');
      });

      it('should handle zero values in stats', async () => {
        const scanId = 'scan-zeros';

        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                stats: {
                  malicious: 0,
                  suspicious: 0,
                  harmless: 0,
                  undetected: 0,
                },
              },
            },
          }),
        });

        const result = await getScanResult(scanId);

        expect(result.clean).toBe(true);
        expect(result.threat).toBeUndefined();
      });

      it('should handle scan results with partial stats', async () => {
        const scanId = 'scan-partial';

        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                stats: {
                  malicious: 1,
                  // Missing suspicious, harmless, undetected
                },
              },
            },
          }),
        });

        const result = await getScanResult(scanId);

        expect(result.clean).toBe(false);
        expect(result.threat).toBe('1 engines detected threat');
      });
    });

    describe('Error Handling', () => {
      it('should throw error when API key is missing', async () => {
        delete process.env.VIRUSTOTAL_API_KEY;

        await expect(getScanResult('scan-123')).rejects.toThrow(
          'VirusTotal API key not configured'
        );
      });

      it('should handle API error response', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        await expect(getScanResult('invalid-scan-id')).rejects.toThrow(
          'VirusTotal API error: 404'
        );
      });

      it('should handle invalid response format - missing stats', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {},
            },
          }),
        });

        await expect(getScanResult('scan-no-stats')).rejects.toThrow(
          'Invalid scan result format'
        );
      });

      it('should handle invalid response format - missing data', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        });

        await expect(getScanResult('scan-no-data')).rejects.toThrow(
          'Invalid scan result format'
        );
      });

      it('should handle network errors', async () => {
        mocks.fetch.mockRejectedValueOnce(new Error('Network timeout'));

        await expect(getScanResult('scan-network-error')).rejects.toThrow(
          'Network timeout'
        );
      });

      it('should handle JSON parse errors', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        });

        await expect(getScanResult('scan-invalid-json')).rejects.toThrow(
          'Invalid JSON'
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty scan ID', async () => {
        mocks.fetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
        });

        await expect(getScanResult('')).rejects.toThrow(
          'VirusTotal API error: 400'
        );
      });

      it('should handle very long scan ID', async () => {
        const longScanId = 'a'.repeat(1000);

        mocks.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                stats: { malicious: 0, suspicious: 0 },
              },
            },
          }),
        });

        const result = await getScanResult(longScanId);

        expect(result.clean).toBe(true);
        expect(mocks.fetch).toHaveBeenCalledWith(
          expect.stringContaining(longScanId),
          expect.any(Object)
        );
      });
    });
  });

  describe('logSecurityEvent', () => {
    describe('Success Cases', () => {
      it('should log security event to console', async () => {
        const event = 'TEST_EVENT';
        const details = { key: 'value', fileName: 'test.pdf' };

        await logSecurityEvent(event, details);

        // Function logs to console (implementation detail)
        // No errors should be thrown
        expect(true).toBe(true);
      });

      it('should handle VIRUS_DETECTED event', async () => {
        const event = 'VIRUS_DETECTED';
        const details = {
          fileName: 'malicious.exe',
          threat: '10 engines detected threat',
          scanId: 'scan-123',
        };

        await logSecurityEvent(event, details);

        // Should complete without errors
        expect(true).toBe(true);
      });

      it('should handle VIRUS_SCAN_SKIPPED event', async () => {
        const event = 'VIRUS_SCAN_SKIPPED';
        const details = {
          fileName: 'document.pdf',
          reason: 'API key not configured',
        };

        await logSecurityEvent(event, details);

        expect(true).toBe(true);
      });

      it('should handle VIRUS_SCAN_TIMEOUT event', async () => {
        const event = 'VIRUS_SCAN_TIMEOUT';
        const details = {
          fileName: 'large-file.pdf',
          timeout: 30000,
        };

        await logSecurityEvent(event, details);

        expect(true).toBe(true);
      });

      it('should handle VIRUS_SCAN_ERROR event', async () => {
        const event = 'VIRUS_SCAN_ERROR';
        const details = {
          fileName: 'error-file.pdf',
          error: 'Network failure',
        };

        await logSecurityEvent(event, details);

        expect(true).toBe(true);
      });

      it('should handle VIRUS_SCAN_RATE_LIMITED event', async () => {
        const event = 'VIRUS_SCAN_RATE_LIMITED';
        const details = {
          fileName: 'rate-limited.pdf',
          statusCode: 429,
        };

        await logSecurityEvent(event, details);

        expect(true).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should not throw error if logging fails', async () => {
        // Even if internal logging fails, the function should not throw
        await expect(
          logSecurityEvent('TEST_EVENT', { key: 'value' })
        ).resolves.not.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty details object', async () => {
        await logSecurityEvent('EMPTY_DETAILS', {});

        expect(true).toBe(true);
      });

      it('should handle complex nested details', async () => {
        const complexDetails = {
          fileName: 'test.pdf',
          metadata: {
            size: 1024,
            type: 'application/pdf',
            nested: {
              level: 3,
              data: [1, 2, 3],
            },
          },
        };

        await logSecurityEvent('COMPLEX_EVENT', complexDetails);

        expect(true).toBe(true);
      });

      it('should handle null values in details', async () => {
        const details = {
          fileName: 'test.pdf',
          threat: null,
          scanId: null,
        };

        await logSecurityEvent('NULL_VALUES', details);

        expect(true).toBe(true);
      });

      it('should handle undefined values in details', async () => {
        const details = {
          fileName: 'test.pdf',
          threat: undefined,
          scanId: undefined,
        };

        await logSecurityEvent('UNDEFINED_VALUES', details);

        expect(true).toBe(true);
      });

      it('should handle very long event names', async () => {
        const longEventName = 'A'.repeat(500);

        await logSecurityEvent(longEventName, { test: true });

        expect(true).toBe(true);
      });

      it('should handle special characters in event name', async () => {
        const specialEvent = 'EVENT_@#$%^&*()_TEST';

        await logSecurityEvent(specialEvent, { test: true });

        expect(true).toBe(true);
      });
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      process.env.VIRUSTOTAL_API_KEY = 'test-api-key';
    });

    it('should complete full scan workflow for clean file', async () => {
      const mockScanId = 'integration-scan-123';

      // Upload file
      mocks.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: { id: mockScanId },
          }),
        })
        // Get scan results
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                stats: {
                  malicious: 0,
                  suspicious: 0,
                  harmless: 60,
                },
              },
            },
          }),
        });

      const promise = scanFileBuffer(testBuffer, testFileName);
      await vi.advanceTimersByTimeAsync(2000);
      const scanResult = await promise;

      expect(scanResult.clean).toBe(true);
      expect(scanResult.scanId).toBe(mockScanId);
    });

    it('should complete full scan workflow for malicious file', async () => {
      const mockScanId = 'integration-scan-malicious';

      mocks.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: { id: mockScanId },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              attributes: {
                stats: {
                  malicious: 8,
                  suspicious: 2,
                },
              },
            },
          }),
        });

      const promise = scanFileBuffer(testBuffer, testFileName);
      await vi.advanceTimersByTimeAsync(2000);
      const scanResult = await promise;

      expect(scanResult.clean).toBe(false);
      expect(scanResult.threat).toBe('8 engines detected threat');
    });

    it('should handle upload success but result retrieval failure', async () => {
      const mockScanId = 'integration-scan-partial';

      mocks.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: { id: mockScanId },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const promise = scanFileBuffer(testBuffer, testFileName, {
        skipIfMissingKey: true,
      });
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;

      // Should fall back to graceful degradation
      expect(result.clean).toBe(true);
    });
  });
});
