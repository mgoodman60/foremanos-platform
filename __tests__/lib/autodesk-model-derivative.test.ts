import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock autodesk-auth with vi.hoisted
const { mockGetAccessToken } = vi.hoisted(() => ({
  mockGetAccessToken: vi.fn(),
}));

vi.mock('@/lib/autodesk-auth', () => ({
  getAccessToken: mockGetAccessToken,
}));

// Mock autodesk-oss with vi.hoisted
const { mockGetObjectUrn } = vi.hoisted(() => ({
  mockGetObjectUrn: vi.fn(),
}));

vi.mock('@/lib/autodesk-oss', () => ({
  getObjectUrn: mockGetObjectUrn,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks are set up
import {
  isSupportedFormat,
  SUPPORTED_FORMATS,
  startTranslation,
  getTranslationStatus,
  getManifest,
  deleteManifest,
  getModelMetadata,
  getModelProperties,
  type TranslationStatus,
} from '@/lib/autodesk-model-derivative';

describe('Autodesk Model Derivative Service', () => {
  const mockToken = 'mock-access-token';
  const mockUrn = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YnVja2V0L29iamVjdA';
  const mockObjectId = 'urn:adsk.objects:os.object:bucket/object';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockResolvedValue(mockToken);
    mockGetObjectUrn.mockReturnValue(mockUrn);
  });

  describe('SUPPORTED_FORMATS', () => {
    it('should contain all expected CAD formats', () => {
      expect(SUPPORTED_FORMATS).toContain('.dwg');
      expect(SUPPORTED_FORMATS).toContain('.dxf');
      expect(SUPPORTED_FORMATS).toContain('.rvt');
      expect(SUPPORTED_FORMATS).toContain('.ifc');
    });

    it('should contain 3D model formats', () => {
      expect(SUPPORTED_FORMATS).toContain('.fbx');
      expect(SUPPORTED_FORMATS).toContain('.obj');
      expect(SUPPORTED_FORMATS).toContain('.stl');
    });

    it('should contain BIM and design formats', () => {
      expect(SUPPORTED_FORMATS).toContain('.nwd');
      expect(SUPPORTED_FORMATS).toContain('.nwc');
      expect(SUPPORTED_FORMATS).toContain('.f3d');
      expect(SUPPORTED_FORMATS).toContain('.skp');
    });

    it('should have 20 supported formats', () => {
      expect(SUPPORTED_FORMATS.length).toBe(20);
    });
  });

  describe('isSupportedFormat', () => {
    describe('Success cases', () => {
      it('should return true for supported CAD formats', () => {
        expect(isSupportedFormat('drawing.dwg')).toBe(true);
        expect(isSupportedFormat('plan.dxf')).toBe(true);
        expect(isSupportedFormat('model.rvt')).toBe(true);
      });

      it('should return true for supported 3D formats', () => {
        expect(isSupportedFormat('model.fbx')).toBe(true);
        expect(isSupportedFormat('mesh.obj')).toBe(true);
        expect(isSupportedFormat('part.stl')).toBe(true);
      });

      it('should return true for STEP formats', () => {
        expect(isSupportedFormat('assembly.stp')).toBe(true);
        expect(isSupportedFormat('part.step')).toBe(true);
      });

      it('should return true for IGES formats', () => {
        expect(isSupportedFormat('surface.iges')).toBe(true);
        expect(isSupportedFormat('model.igs')).toBe(true);
      });

      it('should return true for compressed archives', () => {
        expect(isSupportedFormat('project.zip')).toBe(true);
      });

      it('should handle uppercase extensions', () => {
        expect(isSupportedFormat('DRAWING.DWG')).toBe(true);
        expect(isSupportedFormat('Model.RVT')).toBe(true);
        expect(isSupportedFormat('FILE.FBX')).toBe(true);
      });

      it('should handle mixed case extensions', () => {
        expect(isSupportedFormat('file.DwG')).toBe(true);
        expect(isSupportedFormat('file.RvT')).toBe(true);
      });
    });

    describe('Failure cases', () => {
      it('should return false for unsupported formats', () => {
        expect(isSupportedFormat('document.pdf')).toBe(false);
        expect(isSupportedFormat('image.png')).toBe(false);
        expect(isSupportedFormat('video.mp4')).toBe(false);
      });

      it('should return false for files without extensions', () => {
        expect(isSupportedFormat('filename')).toBe(false);
      });

      it('should return false for empty strings', () => {
        expect(isSupportedFormat('')).toBe(false);
      });

      it('should return false for partial matches', () => {
        expect(isSupportedFormat('file.dwg.txt')).toBe(false);
        expect(isSupportedFormat('file.notdwg')).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('should handle filenames with multiple dots', () => {
        expect(isSupportedFormat('my.file.name.dwg')).toBe(true);
        expect(isSupportedFormat('project.v2.rvt')).toBe(true);
      });

      it('should handle filenames with paths', () => {
        expect(isSupportedFormat('folder/subfolder/file.dwg')).toBe(true);
        expect(isSupportedFormat('C:\\Users\\file.rvt')).toBe(true);
      });

      it('should handle filenames with special characters', () => {
        expect(isSupportedFormat('file (1).dwg')).toBe(true);
        expect(isSupportedFormat('file-name_v2.rvt')).toBe(true);
      });
    });
  });

  describe('startTranslation', () => {
    describe('Success cases', () => {
      it('should start translation for basic object', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: 'success', urn: mockUrn }),
        });

        const result = await startTranslation(mockObjectId);

        expect(mockGetAccessToken).toHaveBeenCalledTimes(1);
        expect(mockGetObjectUrn).toHaveBeenCalledWith(mockObjectId);
        expect(mockFetch).toHaveBeenCalledWith(
          'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Authorization': `Bearer ${mockToken}`,
              'Content-Type': 'application/json',
              'x-ads-force': 'true',
            }),
          })
        );

        expect(result).toEqual({
          urn: mockUrn,
          status: 'pending',
          progress: '0%',
        });
      });

      it('should include rootFilename when provided', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: 'success' }),
        });

        await startTranslation(mockObjectId, 'main.rvt');

        const fetchCall = mockFetch.mock.calls[0];
        const requestBody = JSON.parse(fetchCall[1].body);

        expect(requestBody.input.rootFilename).toBe('main.rvt');
      });

      it('should request SVF2 format with 2d and 3d views', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: 'success' }),
        });

        await startTranslation(mockObjectId);

        const fetchCall = mockFetch.mock.calls[0];
        const requestBody = JSON.parse(fetchCall[1].body);

        expect(requestBody.output.formats).toEqual([
          {
            type: 'svf2',
            views: ['2d', '3d'],
          },
        ]);
      });

      it('should set x-ads-force header to force re-translation', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: 'success' }),
        });

        await startTranslation(mockObjectId);

        const fetchCall = mockFetch.mock.calls[0];
        expect(fetchCall[1].headers['x-ads-force']).toBe('true');
      });
    });

    describe('Error cases', () => {
      it('should throw error when API request fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          text: async () => 'Invalid URN',
        });

        await expect(startTranslation(mockObjectId)).rejects.toThrow(
          'Failed to start translation: Invalid URN'
        );
      });

      it('should throw error when authentication fails', async () => {
        mockGetAccessToken.mockRejectedValueOnce(new Error('Auth failed'));

        await expect(startTranslation(mockObjectId)).rejects.toThrow('Auth failed');
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(startTranslation(mockObjectId)).rejects.toThrow('Network error');
      });
    });
  });

  describe('getTranslationStatus', () => {
    describe('Success cases', () => {
      it('should return success status for completed translation', async () => {
        const mockManifest = {
          status: 'success',
          progress: '100%',
          urn: mockUrn,
          derivatives: [
            {
              children: [
                { status: 'success', name: 'view1' },
                { status: 'success', name: 'view2' },
              ],
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest,
        });

        const result = await getTranslationStatus(mockUrn);

        expect(result).toEqual({
          urn: mockUrn,
          status: 'success',
          progress: '100%',
          messages: [
            { type: 'success', message: 'view1' },
            { type: 'success', message: 'view2' },
          ],
        });
      });

      it('should return inprogress status', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'inprogress',
            progress: '50%',
            urn: mockUrn,
            derivatives: [],
          }),
        });

        const result = await getTranslationStatus(mockUrn);

        expect(result.status).toBe('inprogress');
        expect(result.progress).toBe('50%');
      });

      it('should return failed status', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'failed',
            progress: '0%',
            urn: mockUrn,
            derivatives: [],
          }),
        });

        const result = await getTranslationStatus(mockUrn);

        expect(result.status).toBe('failed');
      });

      it('should return timeout status', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'timeout',
            progress: '75%',
            urn: mockUrn,
            derivatives: [],
          }),
        });

        const result = await getTranslationStatus(mockUrn);

        expect(result.status).toBe('timeout');
      });

      it('should return pending status when manifest not found (404)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        const result = await getTranslationStatus(mockUrn);

        expect(result).toEqual({
          urn: mockUrn,
          status: 'pending',
          progress: '0%',
        });
      });

      it('should default to 0% progress when not provided', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'pending',
            urn: mockUrn,
            derivatives: [],
          }),
        });

        const result = await getTranslationStatus(mockUrn);

        expect(result.progress).toBe('0%');
      });

      it('should handle manifest with no derivatives', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'success',
            progress: '100%',
            urn: mockUrn,
            derivatives: [],
          }),
        });

        const result = await getTranslationStatus(mockUrn);

        expect(result.messages).toBeUndefined();
      });

      it('should handle manifest with derivatives but no children', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'success',
            progress: '100%',
            urn: mockUrn,
            derivatives: [{}],
          }),
        });

        const result = await getTranslationStatus(mockUrn);

        expect(result.messages).toBeUndefined();
      });
    });

    describe('Error cases', () => {
      it('should throw error for non-404 failures', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal server error',
        });

        await expect(getTranslationStatus(mockUrn)).rejects.toThrow(
          'Failed to get translation status: Internal server error'
        );
      });

      it('should throw error when authentication fails', async () => {
        mockGetAccessToken.mockRejectedValueOnce(new Error('No credentials'));

        await expect(getTranslationStatus(mockUrn)).rejects.toThrow('No credentials');
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

        await expect(getTranslationStatus(mockUrn)).rejects.toThrow('Connection timeout');
      });
    });
  });

  describe('getManifest', () => {
    describe('Success cases', () => {
      it('should return full manifest for translated model', async () => {
        const mockManifest = {
          type: 'manifest',
          hasThumbnail: 'true',
          status: 'success',
          progress: 'complete',
          region: 'US',
          urn: mockUrn,
          version: '1.0',
          derivatives: [
            {
              name: 'main',
              hasThumbnail: 'true',
              status: 'success',
              progress: 'complete',
              outputType: 'svf2',
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockManifest,
        });

        const result = await getManifest(mockUrn);

        expect(result).toEqual(mockManifest);
        expect(mockFetch).toHaveBeenCalledWith(
          `https://developer.api.autodesk.com/modelderivative/v2/designdata/${mockUrn}/manifest`,
          expect.objectContaining({
            headers: {
              'Authorization': `Bearer ${mockToken}`,
            },
          })
        );
      });

      it('should return null when manifest not found (404)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        const result = await getManifest(mockUrn);

        expect(result).toBeNull();
      });
    });

    describe('Error cases', () => {
      it('should throw error for non-404 failures', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
        });

        await expect(getManifest(mockUrn)).rejects.toThrow('Failed to get manifest: 403');
      });

      it('should throw error when authentication fails', async () => {
        mockGetAccessToken.mockRejectedValueOnce(new Error('Token expired'));

        await expect(getManifest(mockUrn)).rejects.toThrow('Token expired');
      });
    });
  });

  describe('deleteManifest', () => {
    describe('Success cases', () => {
      it('should delete manifest successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
        });

        await expect(deleteManifest(mockUrn)).resolves.toBeUndefined();

        expect(mockFetch).toHaveBeenCalledWith(
          `https://developer.api.autodesk.com/modelderivative/v2/designdata/${mockUrn}/manifest`,
          expect.objectContaining({
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${mockToken}`,
            },
          })
        );
      });

      it('should succeed when manifest not found (404)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        await expect(deleteManifest(mockUrn)).resolves.toBeUndefined();
      });
    });

    describe('Error cases', () => {
      it('should throw error for non-404 failures', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
        });

        await expect(deleteManifest(mockUrn)).rejects.toThrow(
          'Failed to delete manifest: 403'
        );
      });

      it('should throw error for server errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

        await expect(deleteManifest(mockUrn)).rejects.toThrow(
          'Failed to delete manifest: 500'
        );
      });

      it('should throw error when authentication fails', async () => {
        mockGetAccessToken.mockRejectedValueOnce(new Error('Invalid credentials'));

        await expect(deleteManifest(mockUrn)).rejects.toThrow('Invalid credentials');
      });
    });
  });

  describe('getModelMetadata', () => {
    describe('Success cases', () => {
      it('should return model metadata', async () => {
        const mockMetadata = {
          data: {
            type: 'metadata',
            metadata: [
              { name: 'View1', guid: 'guid-1' },
              { name: 'View2', guid: 'guid-2' },
            ],
          },
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockMetadata,
        });

        const result = await getModelMetadata(mockUrn);

        expect(result).toEqual(mockMetadata);
        expect(mockFetch).toHaveBeenCalledWith(
          `https://developer.api.autodesk.com/modelderivative/v2/designdata/${mockUrn}/metadata`,
          expect.objectContaining({
            headers: {
              'Authorization': `Bearer ${mockToken}`,
            },
          })
        );
      });

      it('should handle empty metadata', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { metadata: [] } }),
        });

        const result = await getModelMetadata(mockUrn);

        expect(result).toEqual({ data: { metadata: [] } });
      });
    });

    describe('Error cases', () => {
      it('should throw error when API request fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        await expect(getModelMetadata(mockUrn)).rejects.toThrow(
          'Failed to get metadata: 404'
        );
      });

      it('should throw error when authentication fails', async () => {
        mockGetAccessToken.mockRejectedValueOnce(new Error('Auth error'));

        await expect(getModelMetadata(mockUrn)).rejects.toThrow('Auth error');
      });
    });
  });

  describe('getModelProperties', () => {
    const mockGuid = 'test-guid-123';

    describe('Success cases', () => {
      it('should return model properties for a view', async () => {
        const mockProperties = {
          data: {
            type: 'properties',
            collection: [
              {
                objectid: 1,
                name: 'Wall',
                properties: {
                  'Material': 'Concrete',
                  'Thickness': '200mm',
                },
              },
            ],
          },
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockProperties,
        });

        const result = await getModelProperties(mockUrn, mockGuid);

        expect(result).toEqual(mockProperties);
        expect(mockFetch).toHaveBeenCalledWith(
          `https://developer.api.autodesk.com/modelderivative/v2/designdata/${mockUrn}/metadata/${mockGuid}/properties`,
          expect.objectContaining({
            headers: {
              'Authorization': `Bearer ${mockToken}`,
            },
          })
        );
      });

      it('should handle empty properties', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { collection: [] } }),
        });

        const result = await getModelProperties(mockUrn, mockGuid);

        expect(result).toEqual({ data: { collection: [] } });
      });

      it('should handle different GUIDs', async () => {
        const guid1 = 'guid-111';
        const guid2 = 'guid-222';

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} }),
        });

        await getModelProperties(mockUrn, guid1);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/metadata/${guid1}/properties`),
          expect.any(Object)
        );

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} }),
        });

        await getModelProperties(mockUrn, guid2);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/metadata/${guid2}/properties`),
          expect.any(Object)
        );
      });
    });

    describe('Error cases', () => {
      it('should throw error when API request fails', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

        await expect(getModelProperties(mockUrn, mockGuid)).rejects.toThrow(
          'Failed to get properties: 404'
        );
      });

      it('should throw error for invalid GUID', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
        });

        await expect(getModelProperties(mockUrn, 'invalid-guid')).rejects.toThrow(
          'Failed to get properties: 400'
        );
      });

      it('should throw error when authentication fails', async () => {
        mockGetAccessToken.mockRejectedValueOnce(new Error('Token invalid'));

        await expect(getModelProperties(mockUrn, mockGuid)).rejects.toThrow('Token invalid');
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete translation workflow', async () => {
      // Start translation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'success' }),
      });

      const startResult = await startTranslation(mockObjectId);
      expect(startResult.status).toBe('pending');

      // Check status - in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'inprogress',
          progress: '50%',
          urn: mockUrn,
          derivatives: [],
        }),
      });

      const progressResult = await getTranslationStatus(mockUrn);
      expect(progressResult.status).toBe('inprogress');

      // Check status - complete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          progress: '100%',
          urn: mockUrn,
          derivatives: [],
        }),
      });

      const completeResult = await getTranslationStatus(mockUrn);
      expect(completeResult.status).toBe('success');
    });

    it('should handle translation failure workflow', async () => {
      // Start translation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'success' }),
      });

      await startTranslation(mockObjectId);

      // Check status - failed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'failed',
          progress: '25%',
          urn: mockUrn,
          derivatives: [
            {
              children: [
                {
                  status: 'failed',
                  message: 'Unsupported file version',
                  code: 'ERR_001',
                },
              ],
            },
          ],
        }),
      });

      const result = await getTranslationStatus(mockUrn);
      expect(result.status).toBe('failed');
    });
  });

  describe('Edge cases', () => {
    it('should handle URNs with special characters', async () => {
      const specialUrn = 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YnVja2V0L29iamVjdA==';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'success',
          progress: '100%',
          urn: specialUrn,
          derivatives: [],
        }),
      });

      const result = await getTranslationStatus(specialUrn);
      expect(result.urn).toBe(specialUrn);
    });

    it('should handle very long object IDs', async () => {
      const longObjectId = 'urn:adsk.objects:os.object:bucket/' + 'x'.repeat(500);
      mockGetObjectUrn.mockReturnValue('very-long-urn');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'success' }),
      });

      await startTranslation(longObjectId);

      expect(mockGetObjectUrn).toHaveBeenCalledWith(longObjectId);
    });

    it('should handle manifest with complex derivative structure', async () => {
      const complexManifest = {
        status: 'success',
        progress: '100%',
        urn: mockUrn,
        derivatives: [
          {
            children: [
              {
                status: 'success',
                name: 'view1',
                children: [
                  { status: 'success', name: 'subview1' },
                  { status: 'success', name: 'subview2' },
                ],
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => complexManifest,
      });

      const result = await getTranslationStatus(mockUrn);

      // Should only extract first level children
      expect(result.messages).toHaveLength(1);
      expect(result.messages?.[0].message).toBe('view1');
    });

    it('should handle unknown manifest status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'unknown-status',
          progress: '50%',
          urn: mockUrn,
          derivatives: [],
        }),
      });

      const result = await getTranslationStatus(mockUrn);

      // Should default to 'pending' for unknown status
      expect(result.status).toBe('pending');
    });
  });
});
