/**
 * Autodesk Model Derivative Service
 * Handles translation of design files to viewable formats
 */

import { getAccessToken } from './autodesk-auth';
import { getObjectUrn } from './autodesk-oss';
import { logger } from './logger';

const MD_BASE_URL = 'https://developer.api.autodesk.com/modelderivative/v2';

export type TranslationStatus = 'pending' | 'inprogress' | 'success' | 'failed' | 'timeout';

interface TranslationJob {
  urn: string;
  status: TranslationStatus;
  progress: string;
  messages?: Array<{ type: string; message: string; code?: string }>;
}

interface ManifestDerivative {
  name: string;
  hasThumbnail: string;
  status: string;
  progress: string;
  outputType: string;
  children?: ManifestDerivative[];
}

interface Manifest {
  type: string;
  hasThumbnail: string;
  status: string;
  progress: string;
  region: string;
  urn: string;
  version: string;
  derivatives: ManifestDerivative[];
}

/**
 * Supported input formats for translation
 */
export const SUPPORTED_FORMATS = [
  '.dwg',    // AutoCAD 2D/3D
  '.dxf',    // AutoCAD Exchange
  '.dwf',    // Design Web Format
  '.dwfx',   // Design Web Format XPS
  '.rvt',    // Revit
  '.rfa',    // Revit Family
  '.ifc',    // Industry Foundation Classes (BIM)
  '.nwd',    // Navisworks
  '.nwc',    // Navisworks Cache
  '.3ds',    // 3D Studio
  '.fbx',    // Autodesk FBX
  '.obj',    // Wavefront OBJ
  '.stl',    // Stereolithography
  '.stp',    // STEP
  '.step',   // STEP
  '.iges',   // IGES
  '.igs',    // IGES
  '.f3d',    // Fusion 360
  '.skp',    // SketchUp
  '.zip',    // Compressed archives
];

/**
 * Check if a file format is supported for translation
 */
export function isSupportedFormat(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SUPPORTED_FORMATS.includes(ext);
}

/**
 * Start a translation job for a design file
 */
export async function startTranslation(
  objectId: string,
  rootFilename?: string
): Promise<TranslationJob> {
  const token = await getAccessToken();
  const urn = getObjectUrn(objectId);

  const jobPayload: Record<string, unknown> = {
    input: {
      urn: urn,
      ...(rootFilename && { rootFilename }),
    },
    output: {
      formats: [
        {
          type: 'svf2', // Optimized viewer format
          views: ['2d', '3d'],
        },
      ],
    },
  };

  const response = await fetch(`${MD_BASE_URL}/designdata/job`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-ads-force': 'true', // Force re-translation if already exists
    },
    body: JSON.stringify(jobPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start translation: ${errorText}`);
  }

  const result = await response.json();
  logger.info('MODEL_DERIVATIVE', 'Translation started', { urn });

  return {
    urn: urn,
    status: 'pending',
    progress: '0%',
  };
}

/**
 * Get the status of a translation job
 */
export async function getTranslationStatus(urn: string): Promise<TranslationJob> {
  const token = await getAccessToken();

  const response = await fetch(`${MD_BASE_URL}/designdata/${urn}/manifest`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return { urn, status: 'pending', progress: '0%' };
    }
    const errorText = await response.text();
    throw new Error(`Failed to get translation status: ${errorText}`);
  }

  const manifest: Manifest = await response.json();

  let status: TranslationStatus = 'pending';
  if (manifest.status === 'success') status = 'success';
  else if (manifest.status === 'failed') status = 'failed';
  else if (manifest.status === 'inprogress') status = 'inprogress';
  else if (manifest.status === 'timeout') status = 'timeout';

  return {
    urn,
    status,
    progress: manifest.progress || '0%',
    messages: manifest.derivatives?.[0]?.children?.map(c => ({
      type: c.status,
      message: c.name,
    })),
  };
}

/**
 * Get the manifest with all derivatives for a translated model
 */
export async function getManifest(urn: string): Promise<Manifest | null> {
  const token = await getAccessToken();

  const response = await fetch(`${MD_BASE_URL}/designdata/${urn}/manifest`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to get manifest: ${response.status}`);
  }

  return await response.json();
}

/**
 * Delete a manifest and its derivatives
 */
export async function deleteManifest(urn: string): Promise<void> {
  const token = await getAccessToken();

  const response = await fetch(`${MD_BASE_URL}/designdata/${urn}/manifest`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete manifest: ${response.status}`);
  }
}

/**
 * Get metadata (properties, attributes) from a translated model
 */
export async function getModelMetadata(urn: string): Promise<unknown> {
  const token = await getAccessToken();

  const response = await fetch(`${MD_BASE_URL}/designdata/${urn}/metadata`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get metadata: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get properties for all objects in a model view
 */
export async function getModelProperties(
  urn: string,
  guid: string
): Promise<unknown> {
  const token = await getAccessToken();

  const response = await fetch(
    `${MD_BASE_URL}/designdata/${urn}/metadata/${guid}/properties`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get properties: ${response.status}`);
  }

  return await response.json();
}
