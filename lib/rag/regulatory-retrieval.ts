/**
 * Regulatory Retrieval Module
 *
 * Contains functions for retrieving regulatory document chunks,
 * admin corrections, and generating context prompts with corrections
 * and enhanced OCR metadata.
 *
 * Functions:
 * - classifyQueryType
 * - retrieveRegulatoryChunks
 * - retrieveRelevantCorrections
 * - generateContextWithCorrections
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  AdminCorrection,
  DocumentChunk,
  RegulatoryChunk,
  ScoredCorrection,
} from './core-types';
import { extractSheetNumbers } from './document-retrieval';

// Re-export types that consumers expect from this module
export type { AdminCorrection, RegulatoryChunk };

/**
 * Classify query to determine if regulatory documents should be searched
 * Returns: "regulatory", "project_document", or "both"
 */
export function classifyQueryType(query: string): 'regulatory' | 'project_document' | 'both' {
  const lowerQuery = query.toLowerCase();

  // Regulatory keywords that suggest code/standard questions
  const regulatoryKeywords = [
    'code', 'requirement', 'standard', 'regulation', 'compliance', 'ada', 'ibc', 'nfpa',
    'required', 'shall', 'must', 'minimum', 'maximum', 'allowed', 'permitted',
    'accessibility', 'fire', 'safety', 'egress', 'occupancy', 'building code',
    'width', 'clearance', 'height requirement', 'spacing requirement',
    'what is required', 'is this compliant', 'does this meet', 'whats required',
    'corridor width', 'door width', 'parking requirement', 'accessible',
  ];

  // Project-specific keywords
  const projectKeywords = [
    'plan', 'drawing', 'sheet', 'schedules', 'budget', 'cost', 'timeline',
    'contractor', 'vendor', 'material', 'equipment', 'installation',
    'phase', 'milestone', 'deliverable', 'who is', 'when is', 'where is',
  ];

  const hasRegulatory = regulatoryKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasProject = projectKeywords.some(keyword => lowerQuery.includes(keyword));

  if (hasRegulatory && hasProject) return 'both';
  if (hasRegulatory) return 'regulatory';
  return 'project_document';
}

/**
 * Retrieve relevant chunks from regulatory documents
 * Uses simpler keyword matching since regulatory documents are well-structured
 */
export async function retrieveRegulatoryChunks(
  query: string,
  projectSlug: string,
  limit: number = 5
): Promise<RegulatoryChunk[]> {
  try {
    // Get project ID
    const project = await prisma.project.findUnique({
      where: { slug: projectSlug },
      select: { id: true },
    });

    if (!project) return [];

    // Get all processed regulatory documents for this project
    const regulatoryDocs = await prisma.regulatoryDocument.findMany({
      where: {
        projectId: project.id,
        processed: true,
      },
      select: { id: true, type: true, standard: true },
    });

    if (regulatoryDocs.length === 0) return [];

    // Extract keywords from query
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);

    // Search chunks from regulatory documents
    const chunks = await prisma.documentChunk.findMany({
      where: {
        regulatoryDocumentId: {
          in: regulatoryDocs.map((d) => d.id),
        },
        OR: keywords.map(keyword => ({
          content: {
            contains: keyword,
            mode: 'insensitive' as Prisma.QueryMode,
          },
        })),
      },
      take: limit * 2, // Get extra for scoring
      include: {
        RegulatoryDocument: {
          select: {
            type: true,
            standard: true,
            jurisdiction: true,
          },
        },
      },
    });

    // Score chunks based on keyword matches
    const scoredChunks = chunks.map((chunk) => {
      const content = chunk.content.toLowerCase();
      let score = 0;

      // Count keyword matches
      keywords.forEach(keyword => {
        const matches = (content.match(new RegExp(keyword, 'gi')) || []).length;
        score += matches * 10;
      });

      // Boost ADA standards for accessibility questions
      if (chunk.RegulatoryDocument?.type === 'ada' &&
          (query.toLowerCase().includes('accessible') ||
           query.toLowerCase().includes('ada') ||
           query.toLowerCase().includes('parking'))) {
        score += 50;
      }

      // Boost building codes for structural/safety questions
      if (chunk.RegulatoryDocument?.type === 'building_code' &&
          (query.toLowerCase().includes('code') ||
           query.toLowerCase().includes('required'))) {
        score += 40;
      }

      return {
        ...chunk,
        score,
        isRegulatory: true as const,
        // Map regulatoryDocumentId to documentId for compatibility
        documentId: chunk.regulatoryDocumentId || chunk.documentId,
      };
    });

    // Sort by score and take top chunks
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score: _score, RegulatoryDocument, ...chunk }) => ({
        ...chunk,
        metadata: {
          ...(typeof chunk.metadata === 'object' && chunk.metadata !== null ? chunk.metadata : {}),
          regulatoryType: RegulatoryDocument?.type,
          standard: RegulatoryDocument?.standard,
          jurisdiction: RegulatoryDocument?.jurisdiction,
        },
      }));
  } catch (error) {
    logger.error('RAG', 'Error retrieving regulatory chunks', error as Error);
    return [];
  }
}


/**
 * Retrieve relevant admin corrections based on query
 * Returns corrections that match query keywords and are active
 */
export async function retrieveRelevantCorrections(
  query: string,
  projectSlug?: string,
  limit: number = 3
): Promise<AdminCorrection[]> {
  try {
    // Extract keywords from query
    const queryWords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    if (queryWords.length === 0) {
      return [];
    }

    // Build where clause
    const whereClause: Prisma.AdminCorrectionWhereInput = {
      isActive: true,
    };

    // Filter by project if provided
    if (projectSlug) {
      const project = await prisma.project.findUnique({
        where: { slug: projectSlug },
        select: { id: true }
      });

      if (project) {
        whereClause.OR = [
          { projectId: project.id },
          { projectId: null } // Include global corrections
        ];
      }
    }

    // Fetch all active corrections
    const corrections = await prisma.adminCorrection.findMany({
      where: whereClause,
      select: {
        id: true,
        originalQuestion: true,
        correctedAnswer: true,
        adminNotes: true,
        keywords: true,
        usageCount: true,
      },
      orderBy: {
        usageCount: 'desc', // Prioritize frequently used corrections
      },
    });

    // Score and rank corrections based on keyword overlap
    const scoredCorrections: ScoredCorrection[] = corrections.map((correction) => {
      let score = 0;
      const correctionKeywords = correction.keywords.map((k) => k.toLowerCase());

      // Calculate keyword overlap
      for (const queryWord of queryWords) {
        for (const keyword of correctionKeywords) {
          if (keyword.includes(queryWord) || queryWord.includes(keyword)) {
            score += 10;
          }
        }
      }

      // Bonus for question similarity
      const questionWords = correction.originalQuestion
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/);

      const commonWords = queryWords.filter((word) =>
        questionWords.includes(word)
      );
      score += commonWords.length * 5;

      return {
        ...correction,
        score,
      };
    });

    // Return top matches
    const relevantCorrections = scoredCorrections
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Increment usage count for matched corrections
    if (relevantCorrections.length > 0) {
      await prisma.adminCorrection.updateMany({
        where: {
          id: { in: relevantCorrections.map((c) => c.id) },
        },
        data: {
          usageCount: { increment: 1 },
        },
      });
    }

    return relevantCorrections;
  } catch (error) {
    logger.error('RAG', 'Error retrieving admin corrections', error as Error);
    return [];
  }
}

/**
 * Generate context prompt with admin corrections
 */
export function generateContextWithCorrections(
  chunks: DocumentChunk[],
  corrections: AdminCorrection[]
): string {
  let prompt = '';

  // Add admin corrections first (highest priority)
  if (corrections.length > 0) {
    prompt += '=== ADMIN CORRECTIONS & GUIDANCE (HIGHEST PRIORITY) ===\n\n';
    prompt += 'The following corrections were provided by project administrators based on previous similar questions. These should be considered the most accurate and authoritative information:\n\n';

    corrections.forEach((correction, index) => {
      prompt += `[Admin Correction ${index + 1}]\n`;
      prompt += `Similar Question: ${correction.originalQuestion}\n`;
      prompt += `Corrected Answer: ${correction.correctedAnswer}\n`;
      if (correction.adminNotes) {
        prompt += `Admin Notes: ${correction.adminNotes}\n`;
      }
      prompt += '\n';
    });

    prompt += '---\n\n';
  }

  // Add document context
  if (chunks.length === 0 && corrections.length === 0) {
    return 'No specific document context or admin corrections available. Provide general construction industry guidance.';
  }

  if (chunks.length > 0) {
    prompt += '=== DOCUMENT CONTEXT ===\n\n';
    prompt += 'Based on the following project documents:\n\n';

    for (const chunk of chunks) {
      // Check if this is a regulatory chunk
      if (chunk.isRegulatory || chunk.regulatoryDocumentId) {
        const standard = chunk.metadata?.standard || 'Regulatory Document';
        const jurisdiction = chunk.metadata?.jurisdiction || '';
        const regulatoryType = chunk.metadata?.regulatoryType || '';
        const pageRef = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';

        prompt += `[${standard}${jurisdiction ? ' - ' + jurisdiction : ''}${pageRef}] (${regulatoryType.toUpperCase()} CODE)\n${chunk.content}\n\n`;
      } else {
        const docName = chunk.metadata?.documentName || 'Unknown Document';
        const pageRef = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';

        const isPlans = docName.toLowerCase().includes('plans.pdf');
        const sheetNumbers = isPlans ? extractSheetNumbers(chunk.content) : [];
        const sheetRef = sheetNumbers.length > 0 ? ` [Sheets: ${sheetNumbers.join(', ')}]` : '';

        // ENHANCED: Extract and display OCR metadata for construction plans
        let ocrMetadata = '';
        if (chunk.metadata) {
          const meta = chunk.metadata;

          // Add scale information (critical for dimensions)
          if (meta.scale) {
            ocrMetadata += `\n  \u{1F4CF} Scale: ${meta.scale}`;
          }

          // Add title block information (project context)
          if (meta.projectName || meta.architect || meta.engineer) {
            ocrMetadata += `\n  \u{1F4CB} Title Block:`;
            if (meta.projectName) ocrMetadata += ` Project: ${meta.projectName}`;
            if (meta.architect) ocrMetadata += ` | Architect: ${meta.architect}`;
            if (meta.engineer) ocrMetadata += ` | Engineer: ${meta.engineer}`;
            if (meta.issueDate) ocrMetadata += ` | Date: ${meta.issueDate}`;
          }

          // Add dimensions (labeled and derived)
          if (meta.labeled_dimensions || meta.derived_dimensions) {
            ocrMetadata += `\n  \u{1F4D0} Dimensions:`;
            if (meta.labeled_dimensions && meta.labeled_dimensions.length > 0) {
              ocrMetadata += ` ${meta.labeled_dimensions.join(', ')}`;
            }
            if (meta.derived_dimensions && meta.derived_dimensions.length > 0) {
              ocrMetadata += ` (derived: ${meta.derived_dimensions.join(', ')})`;
            }
          }

          // Add zones/areas (spatial organization)
          if (meta.zones && meta.zones.length > 0) {
            const zoneNames = meta.zones.map((z) => z.name).join(', ');
            ocrMetadata += `\n  \u{1F5FA}\uFE0F  Zones: ${zoneNames}`;
          }

          // Add legend entries (material/pattern definitions)
          if (meta.hasLegend && meta.legendEntriesCount) {
            ocrMetadata += `\n  \u{1F511} Legend: ${meta.legendEntriesCount} entries (material/pattern definitions included)`;
          }

          // Add hatch patterns (visual material indicators)
          if (meta.hasHatchPatterns && meta.hatchPatternsCount) {
            ocrMetadata += `\n  \u{1F3A8} Hatch Patterns: ${meta.hatchPatternsCount} identified (see content for details)`;
          }

          // Add note count
          if (meta.notesCount) {
            ocrMetadata += `\n  \u{1F4DD} Notes: ${meta.notesCount} construction notes`;
          }

          // PHASE 1: Material Quantity Takeoffs
          if (meta.materialQuantitiesCount && meta.materialQuantitiesCount > 0) {
            ocrMetadata += `\n  \u{1F4B0} Material Quantities: ${meta.materialQuantitiesCount} items with cost estimation data`;
          }

          // PHASE 1: Submittal Requirements
          if (meta.submittalsCount && meta.submittalsCount > 0) {
            ocrMetadata += `\n  \u{1F4CB} Submittal Requirements: ${meta.submittalsCount} items requiring approval`;
          }

          // PHASE 1: Inspection & Testing Requirements
          if (meta.inspectionsCount && meta.inspectionsCount > 0) {
            ocrMetadata += `\n  \u{1F50D} Inspection/Testing: ${meta.inspectionsCount} quality control requirements`;
          }

          // PHASE 1: Equipment Specifications
          if (meta.equipmentSpecsCount && meta.equipmentSpecsCount > 0) {
            ocrMetadata += `\n  \u2699\uFE0F  Equipment Specs: ${meta.equipmentSpecsCount} items with detailed specifications`;
          }
        }

        prompt += `[${docName}${pageRef}${sheetRef}]${ocrMetadata}\n${chunk.content}\n\n`;
      }
    }

    prompt += 'IMPORTANT: When providing information from Plans.pdf, ALWAYS cite the sheet number (e.g., A-001, S-002) along with the page number. Format: "(Plans.pdf, Sheet A-001, Page X)". For other documents, cite as "(Document Name, Page X)". For regulatory codes, cite as "(Standard Name, Section/Page X)".\n\n';
  }

  prompt += '\nINSTRUCTIONS FOR GPT-5.2 / GPT-4o / Claude:\n';
  prompt += '1. Prioritize admin corrections above all other sources\n';
  prompt += '2. If admin corrections conflict with documents, favor the admin corrections and explain why\n';
  prompt += '3. Use document context to support or elaborate on admin corrections\n';
  prompt += '4. When answering code/compliance questions, cite BOTH regulatory standards AND project documents when available\n';
  prompt += '5. For regulatory information, always include the standard name (e.g., "Per ADA 2010" or "Per IBC 2021")\n';
  prompt += '6. If project documents conflict with regulatory codes, note the discrepancy and cite both sources\n';
  prompt += '7. If information is not in the provided context, say so and provide general guidance\n';
  prompt += '\n\u{1F50D} ENHANCED OCR METADATA USAGE:\n';
  prompt += '8. ALWAYS use Scale information (\u{1F4CF}) when discussing dimensions - e.g., "per scale 1/4"=1\'-0""\n';
  prompt += '9. Reference Title Block info (\u{1F4CB}) for project context - architect, engineer, issue dates\n';
  prompt += '10. Cite specific Dimensions (\u{1F4D0}) with their units when answering measurement questions\n';
  prompt += '11. Use Zone information (\u{1F5FA}\uFE0F) to provide spatial context - "in the Building Slab zone" or "Parking Lot area"\n';
  prompt += '12. Reference Legend entries (\u{1F511}) when discussing materials or hatch patterns\n';
  prompt += '13. Leverage construction Notes (\u{1F4DD}) for specifications and installation requirements\n';
  prompt += '14. When multiple chunks provide info, synthesize across them citing each source\n';
  prompt += '\n\u{1F48E} PHASE 1 METADATA USAGE (CRITICAL FOR COST & SCHEDULE):\n';
  prompt += '15. Material Quantities (\u{1F4B0}): When answering cost/material questions, cite extracted quantities with zones - e.g., "Building Slab: 120 CY concrete" or "Parking Lot: 40 CY"\n';
  prompt += '16. Submittal Requirements (\u{1F4CB}): When discussing approvals/timelines, reference submittal requirements with CSI sections, due dates, and approval authorities\n';
  prompt += '17. Inspection/Testing (\u{1F50D}): When addressing quality control, cite specific testing standards (ASTM, ACI, AWS), frequencies, and inspector qualifications\n';
  prompt += '18. Equipment Specs (\u2699\uFE0F): When discussing equipment, provide manufacturer, model, capacity, electrical/mechanical specs, and location from extracted data\n';
  prompt += '19. For procurement questions, combine Material Quantities + Equipment Specs for comprehensive answers\n';
  prompt += '20. For schedule questions, reference Submittal Requirements lead times and Inspection/Testing frequencies\n';

  return prompt;
}
