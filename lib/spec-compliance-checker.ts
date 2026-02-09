/**
 * Spec Compliance Checker
 * 
 * Automatically verifies submittals and materials against project specifications:
 * - Extracts requirements from spec sections
 * - Compares submitted product data against requirements
 * - Identifies compliance issues and severity
 * - Generates actionable recommendations
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { logger } from '@/lib/logger';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ComplianceIssue {
  field: string;
  required: string;
  submitted: string;
  severity: 'critical' | 'warning' | 'info';
  recommendation?: string;
}

export interface ComplianceCheckResult {
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'REQUIRES_REVIEW';
  complianceScore: number;
  issues: ComplianceIssue[];
  criticalIssues: number;
  warnings: number;
  aiAnalysis: string;
  recommendations: string;
}

export interface SpecRequirement {
  section: string;
  paragraph: string;
  requirement: string;
  category: string;
  keywords: string[];
}

// ============================================================================
// SPEC EXTRACTION
// ============================================================================

/**
 * Extract specification requirements from document text
 */
export async function extractSpecRequirements(
  specText: string,
  specSection: string
): Promise<SpecRequirement[]> {
  const prompt = `You are a construction specifications expert. Extract all specific requirements from this specification section.

Spec Section: ${specSection}

For each requirement, identify:
1. Paragraph reference (e.g., "2.1.A", "3.2.B.1")
2. The specific requirement text
3. Category (materials, performance, installation, testing, warranty)
4. Keywords that would appear in a compliant submittal

Return JSON array:
[
  {
    "section": "${specSection}",
    "paragraph": "2.1.A",
    "requirement": "Paint shall be acrylic latex with minimum 50% solids content",
    "category": "materials",
    "keywords": ["acrylic", "latex", "50%", "solids"]
  }
]

Spec text:
${specText.substring(0, 12000)}`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, max_tokens: 3000 }
    );

    const jsonMatch = response.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    logger.error('SPEC_COMPLIANCE', 'Extraction failed', error instanceof Error ? error : undefined);
    return [];
  }
}

// ============================================================================
// COMPLIANCE CHECKING
// ============================================================================

/**
 * Check submittal against spec requirements
 */
export async function checkCompliance(
  projectId: string,
  submittalData: {
    itemType: string;
    itemDescription: string;
    manufacturer?: string;
    model?: string;
    specifications?: Record<string, any>;
    productData?: string;
  },
  specSection: string,
  specRequirements?: SpecRequirement[]
): Promise<ComplianceCheckResult> {
  // Build prompt for compliance analysis
  const prompt = `You are a construction submittal reviewer. Compare this submittal against the specification requirements and identify any compliance issues.

SPEC SECTION: ${specSection}

SPEC REQUIREMENTS:
${specRequirements?.map((r) => `- ${r.paragraph}: ${r.requirement}`).join('\n') || 'Not provided - use general industry standards'}

SUBMITTAL DATA:
Item Type: ${submittalData.itemType}
Description: ${submittalData.itemDescription}
Manufacturer: ${submittalData.manufacturer || 'Not specified'}
Model: ${submittalData.model || 'Not specified'}
Specifications: ${JSON.stringify(submittalData.specifications || {})}
Product Data: ${submittalData.productData?.substring(0, 5000) || 'Not provided'}

Analyze compliance and return JSON:
{
  "status": "COMPLIANT" | "NON_COMPLIANT" | "PARTIAL" | "REQUIRES_REVIEW",
  "complianceScore": 0-100,
  "issues": [
    {
      "field": "solids content",
      "required": "minimum 50%",
      "submitted": "45%",
      "severity": "critical" | "warning" | "info",
      "recommendation": "Request revised submittal with compliant product"
    }
  ],
  "aiAnalysis": "Brief summary of compliance status and key findings",
  "recommendations": "Overall recommendations for resolution"
}`;

  try {
    const response = await callAbacusLLM(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, max_tokens: 2000 }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        status: parsed.status || 'REQUIRES_REVIEW',
        complianceScore: parsed.complianceScore || 0,
        issues: parsed.issues || [],
        criticalIssues: (parsed.issues || []).filter(
          (i: ComplianceIssue) => i.severity === 'critical'
        ).length,
        warnings: (parsed.issues || []).filter(
          (i: ComplianceIssue) => i.severity === 'warning'
        ).length,
        aiAnalysis: parsed.aiAnalysis || 'Analysis completed',
        recommendations: parsed.recommendations || 'Review results and take appropriate action',
      };
    }

    return {
      status: 'REQUIRES_REVIEW',
      complianceScore: 0,
      issues: [],
      criticalIssues: 0,
      warnings: 0,
      aiAnalysis: 'Unable to complete automated analysis',
      recommendations: 'Manual review required',
    };
  } catch (error) {
    logger.error('SPEC_COMPLIANCE', 'Compliance check failed', error instanceof Error ? error : undefined);
    return {
      status: 'REQUIRES_REVIEW',
      complianceScore: 0,
      issues: [],
      criticalIssues: 0,
      warnings: 0,
      aiAnalysis: 'Error during analysis',
      recommendations: 'Manual review required due to system error',
    };
  }
}

/**
 * Run compliance check and store results
 */
export async function runComplianceCheckAndStore(
  projectId: string,
  submittalData: {
    itemType: string;
    itemDescription: string;
    manufacturer?: string;
    model?: string;
    specifications?: Record<string, any>;
    productData?: string;
    submittalId?: string;
    documentId?: string;
  },
  specSection: string,
  specParagraph?: string
): Promise<{ checkId: string; result: ComplianceCheckResult }> {
  // First, try to find spec requirements from project documents
  let specRequirements: SpecRequirement[] = [];

  try {
    // Search for spec section in document chunks
    const specChunks = await prisma.documentChunk.findMany({
      where: {
        Document: { projectId, deletedAt: null },
        OR: [
          { content: { contains: specSection, mode: 'insensitive' } },
          { content: { contains: 'PART 2 - PRODUCTS', mode: 'insensitive' } },
        ],
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    if (specChunks.length > 0) {
      const combinedText = specChunks.map((c) => c.content).join('\n\n');
      specRequirements = await extractSpecRequirements(combinedText, specSection);
    }
  } catch (error) {
    logger.error('SPEC_COMPLIANCE', 'Failed to extract spec requirements', error instanceof Error ? error : undefined);
  }

  // Run compliance check
  const result = await checkCompliance(
    projectId,
    submittalData,
    specSection,
    specRequirements
  );

  // Store result in database
  const check = await prisma.specComplianceCheck.create({
    data: {
      projectId,
      submittalId: submittalData.submittalId,
      documentId: submittalData.documentId,
      itemType: submittalData.itemType,
      itemDescription: submittalData.itemDescription,
      specSection,
      specParagraph,
      specRequirement: specRequirements.length > 0
        ? specRequirements.map((r) => `${r.paragraph}: ${r.requirement}`).join('\n')
        : null,
      status: result.status,
      complianceScore: result.complianceScore,
      issues: result.issues as any,
      criticalIssues: result.criticalIssues,
      warnings: result.warnings,
      aiAnalysis: result.aiAnalysis,
      recommendations: result.recommendations,
    },
  });

  return {
    checkId: check.id,
    result,
  };
}

// ============================================================================
// RETRIEVAL & REPORTING
// ============================================================================

/**
 * Get compliance checks for a project
 */
export async function getProjectComplianceChecks(
  projectId: string,
  options?: {
    status?: string;
    specSection?: string;
    limit?: number;
  }
): Promise<any[]> {
  const where: any = { projectId };

  if (options?.status) {
    where.status = options.status;
  }

  if (options?.specSection) {
    where.specSection = { contains: options.specSection, mode: 'insensitive' };
  }

  return prisma.specComplianceCheck.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
  });
}

/**
 * Get compliance summary for a project
 */
export async function getProjectComplianceSummary(
  projectId: string
): Promise<{
  total: number;
  compliant: number;
  nonCompliant: number;
  partial: number;
  pendingReview: number;
  criticalIssues: number;
  averageScore: number;
}> {
  const checks = await prisma.specComplianceCheck.findMany({
    where: { projectId },
    select: {
      status: true,
      complianceScore: true,
      criticalIssues: true,
    },
  });

  const total = checks.length;
  const compliant = checks.filter((c) => c.status === 'COMPLIANT').length;
  const nonCompliant = checks.filter((c) => c.status === 'NON_COMPLIANT').length;
  const partial = checks.filter((c) => c.status === 'PARTIAL').length;
  const pendingReview = checks.filter((c) => c.status === 'PENDING' || c.status === 'REQUIRES_REVIEW').length;
  const criticalIssues = checks.reduce((sum, c) => sum + c.criticalIssues, 0);
  const averageScore = total > 0
    ? checks.reduce((sum, c) => sum + (c.complianceScore || 0), 0) / total
    : 0;

  return {
    total,
    compliant,
    nonCompliant,
    partial,
    pendingReview,
    criticalIssues,
    averageScore: Math.round(averageScore * 10) / 10,
  };
}

/**
 * Generate compliance report for a spec section
 */
export async function generateSpecSectionReport(
  projectId: string,
  specSection: string
): Promise<string> {
  const checks = await prisma.specComplianceCheck.findMany({
    where: {
      projectId,
      specSection: { contains: specSection, mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (checks.length === 0) {
    return `No compliance checks found for section ${specSection}`;
  }

  let report = `COMPLIANCE REPORT - Section ${specSection}\n`;
  report += '='.repeat(50) + '\n\n';

  const summary = {
    compliant: checks.filter((c) => c.status === 'COMPLIANT').length,
    issues: checks.filter((c) => c.status !== 'COMPLIANT').length,
    avgScore: Math.round(
      checks.reduce((sum, c) => sum + (c.complianceScore || 0), 0) / checks.length
    ),
  };

  report += `Summary: ${summary.compliant} compliant, ${summary.issues} with issues\n`;
  report += `Average Compliance Score: ${summary.avgScore}%\n\n`;

  for (const check of checks) {
    report += `--- ${check.itemDescription} ---\n`;
    report += `Status: ${check.status}\n`;
    report += `Score: ${check.complianceScore}%\n`;
    if (check.criticalIssues > 0) {
      report += `Critical Issues: ${check.criticalIssues}\n`;
    }
    if (check.aiAnalysis) {
      report += `Analysis: ${check.aiAnalysis}\n`;
    }
    report += '\n';
  }

  return report;
}
