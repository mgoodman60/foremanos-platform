/**
 * Spec Reference Parser
 * Parses CSI specification references from extraction metadata into
 * structured data stored in DocumentChunk metadata for RAG search.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface CsiReference {
  section: string;
  title: string;
  manufacturer: string;
  productNumber: string;
}

export interface SpecReferenceResult {
  referencesProcessed: number;
}

/** CSI division titles for the first 2-digit prefix */
const CSI_DIVISION_TITLES: Record<string, string> = {
  '01': 'General Requirements',
  '02': 'Existing Conditions',
  '03': 'Concrete',
  '04': 'Masonry',
  '05': 'Metals',
  '06': 'Wood, Plastics, Composites',
  '07': 'Thermal & Moisture Protection',
  '08': 'Openings',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '13': 'Special Construction',
  '14': 'Conveying Equipment',
  '21': 'Fire Suppression',
  '22': 'Plumbing',
  '23': 'HVAC',
  '25': 'Integrated Automation',
  '26': 'Electrical',
  '27': 'Communications',
  '28': 'Electronic Safety & Security',
  '31': 'Earthwork',
  '32': 'Exterior Improvements',
  '33': 'Utilities',
};

/**
 * Parse CSI references from extraction metadata.
 * Groups references by CSI division and stores structured data in
 * the existing DocumentChunk metadata for the given sheet.
 */
export async function parseSpecReferences(
  documentId: string,
  _projectId: string,
  sheetNumber: string,
  csiReferences: CsiReference[]
): Promise<SpecReferenceResult> {
  logger.info('SPEC_REFERENCE', 'Starting spec reference parsing', {
    documentId,
    sheetNumber,
    referenceCount: csiReferences.length,
  });

  if (csiReferences.length === 0) {
    return { referencesProcessed: 0 };
  }

  // Group by CSI division (first 2 digits)
  const byDivision: Record<string, CsiReference[]> = {};
  for (const ref of csiReferences) {
    const divisionCode = ref.section.replace(/\s+/g, '').substring(0, 2);
    if (!byDivision[divisionCode]) byDivision[divisionCode] = [];
    byDivision[divisionCode].push(ref);
  }

  // Build structured CSI data
  const structuredCsi = Object.entries(byDivision).map(([division, refs]) => ({
    division,
    divisionTitle: CSI_DIVISION_TITLES[division] || 'Unknown',
    references: refs.map(r => ({
      section: r.section,
      title: r.title,
      manufacturer: r.manufacturer,
      productNumber: r.productNumber,
    })),
  }));

  // Update existing DocumentChunk metadata for this sheet
  try {
    const chunk = await prisma.documentChunk.findFirst({
      where: { documentId, sheetNumber },
      select: { id: true, metadata: true },
    });

    if (chunk) {
      const existingMeta = (chunk.metadata as Record<string, any>) || {};
      await prisma.documentChunk.update({
        where: { id: chunk.id },
        data: {
          metadata: {
            ...existingMeta,
            csiReferences: structuredCsi,
            csiDivisions: Object.keys(byDivision),
            csiReferenceCount: csiReferences.length,
          },
        },
      });
    } else {
      logger.warn('SPEC_REFERENCE', 'No DocumentChunk found for sheet', {
        documentId,
        sheetNumber,
      });
    }
  } catch (error) {
    logger.warn('SPEC_REFERENCE', 'Failed to store CSI references', {
      error: (error as Error).message,
      documentId,
    });
  }

  logger.info('SPEC_REFERENCE', 'Spec reference parsing complete', {
    documentId,
    referencesProcessed: csiReferences.length,
    divisions: Object.keys(byDivision),
  });

  return { referencesProcessed: csiReferences.length };
}
