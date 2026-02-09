/**
 * Code Library Integration and Compliance Checking
 *
 * Extracted from lib/rag-enhancements.ts — integration with building codes
 * (IBC, NEC, IPC, IMC, NFPA, ADA) and automated compliance checking.
 */

import { prisma } from '../db';
import type {
  CodeReference,
  CodeLibrary,
  ComplianceIssue,
  ComplianceReport,
  EnhancedChunk,
} from './types';

/**
 * Load code library from project's regulatory documents
 */
export async function loadCodeLibrary(projectSlug: string): Promise<CodeLibrary> {
  // Load regulatory documents from database
  const regulatoryDocs = await prisma.regulatoryDocument.findMany({
    where: {
      Project: { slug: projectSlug },
      processed: true,
    },
    include: {
      DocumentChunk: true,
    },
  });

  const standards = new Map<string, CodeReference[]>();

  for (const doc of regulatoryDocs) {
    const refs: CodeReference[] = [];

    for (const chunk of doc.DocumentChunk) {
      // Parse code section from chunk
      const sectionMatch = chunk.content.match(/(?:Section|\u00a7)\s*(\d+(?:\.\d+)*)/i);
      if (sectionMatch) {
        const section = sectionMatch[1];

        // Extract title (usually next line or in bold)
        const lines = chunk.content.split('\n');
        let title = '';
        for (let i = 0; i < lines.length && i < 3; i++) {
          if (lines[i].trim().length > 0 && lines[i].trim().length < 100) {
            title = lines[i].trim();
            break;
          }
        }

        refs.push({
          standard: doc.type.toUpperCase(),
          version: doc.version || 'Latest',
          section,
          title,
          text: chunk.content,
          applicability: extractApplicability(chunk.content),
          keywords: extractCodeKeywords(chunk.content),
        });
      }
    }

    if (refs.length > 0) {
      standards.set(doc.type.toUpperCase(), refs);
    }
  }

  return {
    standards,
    lastUpdated: new Date(),
  };
}

function extractApplicability(text: string): string[] {
  const applicability: string[] = [];

  if (text.match(/commercial|business|mercantile/i)) applicability.push('commercial');
  if (text.match(/residential|dwelling|apartment/i)) applicability.push('residential');
  if (text.match(/institutional|educational|healthcare/i)) applicability.push('institutional');
  if (text.match(/assembly|theater|restaurant/i)) applicability.push('assembly');
  if (text.match(/industrial|factory|storage/i)) applicability.push('industrial');

  return applicability;
}

function extractCodeKeywords(text: string): string[] {
  const keywords: string[] = [];
  const keywordPatterns = [
    'accessibility', 'egress', 'fire', 'sprinkler', 'exit', 'door', 'stair',
    'corridor', 'occupancy', 'load', 'height', 'area', 'width', 'clearance',
    'handrail', 'guard', 'ramp', 'elevator', 'restroom', 'parking',
    'electrical', 'panel', 'circuit', 'grounding', 'wiring', 'receptacle',
    'plumbing', 'fixture', 'water', 'drainage', 'vent', 'trap',
    'mechanical', 'ventilation', 'exhaust', 'duct', 'hvac'
  ];

  for (const keyword of keywordPatterns) {
    if (text.toLowerCase().includes(keyword)) {
      keywords.push(keyword);
    }
  }

  return keywords;
}

/**
 * Find relevant code references for a query
 */
export async function findRelevantCodes(
  query: string,
  projectSlug: string,
  maxResults: number = 5
): Promise<CodeReference[]> {
  const codeLibrary = await loadCodeLibrary(projectSlug);
  const allRefs: CodeReference[] = [];

  // Collect all code references
  for (const refs of codeLibrary.standards.values()) {
    allRefs.push(...refs);
  }

  // Score and rank references
  const scored = allRefs.map(ref => {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Title match (highest weight)
    if (ref.title.toLowerCase().includes(queryLower)) score += 10;

    // Keyword match
    for (const keyword of ref.keywords) {
      if (queryLower.includes(keyword)) score += 3;
    }

    // Text content match
    if (ref.text.toLowerCase().includes(queryLower)) score += 2;

    // Section number match
    if (queryLower.match(/\d{3,4}/) && ref.section.includes(queryLower.match(/\d{3,4}/)![0])) {
      score += 8;
    }

    return { ref, score };
  });

  // Sort by score and return top results
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.ref);
}

/**
 * Automated compliance checking against applicable building codes
 */
export async function checkCompliance(
  chunks: EnhancedChunk[],
  projectSlug: string,
  scope?: string[]
): Promise<ComplianceReport> {
  const issues: ComplianceIssue[] = [];
  const codeLibrary = await loadCodeLibrary(projectSlug);
  const codesChecked: string[] = [];

  // Check egress requirements
  if (!scope || scope.includes('egress')) {
    const egressIssues = await checkEgressCompliance(chunks, codeLibrary);
    issues.push(...egressIssues);
    codesChecked.push('IBC - Egress');
  }

  // Check accessibility requirements
  if (!scope || scope.includes('accessibility')) {
    const accessibilityIssues = await checkAccessibilityCompliance(chunks, codeLibrary);
    issues.push(...accessibilityIssues);
    codesChecked.push('ADA - Accessibility');
  }

  // Check electrical requirements
  if (!scope || scope.includes('electrical')) {
    const electricalIssues = await checkElectricalCompliance(chunks, codeLibrary);
    issues.push(...electricalIssues);
    codesChecked.push('NEC - Electrical');
  }

  // Check plumbing requirements
  if (!scope || scope.includes('plumbing')) {
    const plumbingIssues = await checkPlumbingCompliance(chunks, codeLibrary);
    issues.push(...plumbingIssues);
    codesChecked.push('IPC - Plumbing');
  }

  // Check mechanical requirements
  if (!scope || scope.includes('mechanical')) {
    const mechanicalIssues = await checkMechanicalCompliance(chunks, codeLibrary);
    issues.push(...mechanicalIssues);
    codesChecked.push('IMC - Mechanical');
  }

  // Calculate summary
  const summary = {
    violations: issues.filter(i => i.severity === 'violation').length,
    warnings: issues.filter(i => i.severity === 'warning').length,
    recommendations: issues.filter(i => i.severity === 'recommendation').length,
    compliant: 0, // Would need to track successful checks
    totalChecks: issues.length,
  };

  return {
    projectName: projectSlug,
    checkDate: new Date(),
    codesChecked,
    issues,
    summary,
  };
}

async function checkEgressCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];

  // Check door widths
  for (const chunk of chunks) {
    const doorMatches = chunk.content.matchAll(/door.*?(\d+)["']?\s*(?:x|\u00d7)\s*(\d+)["']?/gi);
    for (const match of doorMatches) {
      const width = parseInt(match[1]);
      if (width < 32) {
        issues.push({
          severity: 'violation',
          code: 'IBC 1010.1.1',
          requirement: 'Minimum door width of 32 inches clear',
          finding: `Door width ${width}" is less than required 32" minimum`,
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Increase door width to minimum 32" clear or verify if exception applies',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }

  // Check corridor widths
  for (const chunk of chunks) {
    const corridorMatches = chunk.content.matchAll(/corridor.*?(\d+)["']?\s*(?:wide|width)/gi);
    for (const match of corridorMatches) {
      const width = parseInt(match[1]);
      if (width < 44) {
        issues.push({
          severity: width < 36 ? 'violation' : 'warning',
          code: 'IBC 1020.2',
          requirement: 'Minimum corridor width of 44 inches',
          finding: `Corridor width ${width}" is less than required 44" minimum`,
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Increase corridor width to 44" minimum or verify occupancy classification',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }

  return issues;
}

async function checkAccessibilityCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];

  // Check restroom accessibility
  for (const chunk of chunks) {
    if (chunk.content.match(/restroom|toilet|lavatory/i)) {
      // Check for accessible fixture counts
      const accessibleMatches = chunk.content.match(/accessible|ADA/i);
      if (!accessibleMatches) {
        issues.push({
          severity: 'warning',
          code: 'ADA 213.2',
          requirement: 'Accessible fixtures required in restrooms',
          finding: 'No accessible fixtures noted in restroom',
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Verify accessible fixture provisions or add ADA notation',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }

      // Check clearances
      const clearanceMatch = chunk.content.match(/clearance.*?(\d+)["']?\s*x\s*(\d+)["']?/i);
      if (clearanceMatch) {
        const clear1 = parseInt(clearanceMatch[1]);
        const clear2 = parseInt(clearanceMatch[2]);
        if (clear1 < 60 || clear2 < 60) {
          issues.push({
            severity: 'violation',
            code: 'ADA 305.3',
            requirement: 'Minimum 60" turning space required',
            finding: `Clearance ${clear1}" x ${clear2}" is less than required 60" minimum`,
            location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
            recommendation: 'Increase clearance to 60" x 60" minimum or provide T-turn space',
            sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          });
        }
      }
    }
  }

  return issues;
}

async function checkElectricalCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];

  // Check GFCI requirements
  for (const chunk of chunks) {
    if (chunk.content.match(/restroom|bathroom|kitchen|outdoor/i)) {
      if (!chunk.content.match(/GFCI|ground fault/i)) {
        issues.push({
          severity: 'warning',
          code: 'NEC 210.8',
          requirement: 'GFCI protection required in wet locations',
          finding: 'No GFCI notation in area requiring ground fault protection',
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Verify GFCI protection or add notation to plans',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }

  // Check receptacle spacing
  for (const chunk of chunks) {
    const spacingMatch = chunk.content.match(/receptacle.*?(\d+)['"]?\s*(?:o\.?c\.?|on center|spacing)/i);
    if (spacingMatch) {
      const spacing = parseInt(spacingMatch[1]);
      if (spacing > 144) { // 12 feet
        issues.push({
          severity: 'violation',
          code: 'NEC 210.52',
          requirement: 'Maximum 12 feet spacing for receptacles along walls',
          finding: `Receptacle spacing of ${spacing}" exceeds 144" (12') maximum`,
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Reduce receptacle spacing to 12\' maximum or provide additional outlets',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }

  return issues;
}

async function checkPlumbingCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];

  // Check fixture unit calculations
  for (const chunk of chunks) {
    if (chunk.content.match(/fixture unit|DFU|WFU/i)) {
      // This would require complex calculation - simplified for demo
      const fuMatch = chunk.content.match(/(\d+)\s*(?:DFU|fixture units?)/i);
      if (fuMatch) {
        const fu = parseInt(fuMatch[1]);
        if (fu > 200) {
          issues.push({
            severity: 'recommendation',
            code: 'IPC 702.1',
            requirement: 'Verify drain sizing for fixture unit load',
            finding: `High fixture unit count (${fu} DFU) - verify drain sizing`,
            location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
            recommendation: 'Review IPC Table 702.1 to confirm adequate drain sizing',
            sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          });
        }
      }
    }
  }

  return issues;
}

async function checkMechanicalCompliance(chunks: EnhancedChunk[], codeLibrary: CodeLibrary): Promise<ComplianceIssue[]> {
  const issues: ComplianceIssue[] = [];

  // Check ventilation rates
  for (const chunk of chunks) {
    const ventMatch = chunk.content.match(/ventilation.*?(\d+)\s*CFM\s*per\s*person/i);
    if (ventMatch) {
      const cfmPerPerson = parseInt(ventMatch[1]);
      if (cfmPerPerson < 15) {
        issues.push({
          severity: 'warning',
          code: 'IMC 403.3',
          requirement: 'Minimum 15 CFM per person outdoor air',
          finding: `Ventilation rate of ${cfmPerPerson} CFM/person is less than 15 CFM/person minimum`,
          location: chunk.sourceReference || `Page ${chunk.pageNumber}`,
          recommendation: 'Increase outdoor air ventilation rate to meet IMC requirements',
          sourceSheet: chunk.sourceReference || `Page ${chunk.pageNumber}`,
        });
      }
    }
  }

  return issues;
}
