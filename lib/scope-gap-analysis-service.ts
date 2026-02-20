/**
 * Scope Gap Analysis Service
 * Uses AI to identify gaps between subcontractor quotes and project requirements
 * Pulls requirements from schedule tasks, documents, and existing project scope
 */

import { prisma } from '@/lib/db';
import { callAbacusLLM } from '@/lib/abacus-llm';
import { TRADE_DISPLAY_NAMES } from '@/lib/trade-inference';
import { logger } from '@/lib/logger';

export interface ScopeGap {
  id: string;
  category: 'missing_scope' | 'partial_coverage' | 'ambiguous' | 'exclusion_risk';
  severity: 'high' | 'medium' | 'low';
  description: string;
  projectRequirement: string;
  quoteReference?: string;
  estimatedCostImpact?: number;
  recommendation: string;
  tradeType?: string;
  relatedTaskIds?: string[];
  relatedQuoteIds?: string[];
}

export interface ScopeGapAnalysisResult {
  projectId: string;
  tradeType?: string;
  analysisDate: string;
  overallCoverageScore: number; // 0-100
  gaps: ScopeGap[];
  coveredItems: string[];
  recommendations: string[];
  totalEstimatedGapCost: number;
  confidence: number;
}

interface ScheduleTaskResult {
  id: string;
  name: string;
  description: string | null;
  inferredTradeType: string | null;
}

interface DocumentChunkResult {
  content: string;
}

interface _BudgetItemResult {
  description: string;
  budgetedAmount: unknown;
  costCode: string | null;
}

interface QuoteResult {
  id: string;
  companyName: string;
  tradeType: string | null;
  totalAmount: unknown;
  scopeDescription: string | null;
  inclusions: unknown;
  exclusions: unknown;
  extractedData: unknown;
}

/**
 * Get project requirements from various sources
 */
async function getProjectRequirements(projectId: string, tradeType?: string): Promise<{
  scheduleTasks: Array<{ id: string; name: string; description?: string | null; tradeType?: string | null }>;
  documentScopes: string[];
  budgetItems: Array<{ description: string; budgetedAmount: number; costCode?: string | null }>;
}> {
  // Get schedule tasks (filtered by trade if specified)
  const scheduleWhere: Record<string, unknown> = {
    schedule: { projectId }
  };
  
  if (tradeType) {
    scheduleWhere.inferredTradeType = tradeType;
  }
  
  const scheduleTasks: ScheduleTaskResult[] = await prisma.scheduleTask.findMany({
    where: scheduleWhere,
    select: {
      id: true,
      name: true,
      description: true,
      inferredTradeType: true,
    }
  });

  // Get relevant document chunks that might contain scope requirements
  const documentChunks: DocumentChunkResult[] = await prisma.documentChunk.findMany({
    where: {
      Document: { projectId },
      OR: [
        { content: { contains: 'scope' } },
        { content: { contains: 'specification' } },
        { content: { contains: 'requirement' } },
        { content: { contains: 'shall' } },
        { content: { contains: 'must' } },
      ]
    },
    select: { content: true },
    take: 50, // Limit for AI context
  });

  // Get existing budget items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgetItemWhere: any = {
    ProjectBudget: { projectId },
  };
  if (tradeType) {
    budgetItemWhere.tradeType = tradeType;
  }
  
  const budgetItems = await prisma.budgetItem.findMany({
    where: budgetItemWhere,
    select: {
      description: true,
      budgetedAmount: true,
      costCode: true,
    }
  });

  return {
    scheduleTasks: scheduleTasks.map((t: ScheduleTaskResult) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      tradeType: t.inferredTradeType
    })),
    documentScopes: documentChunks.map((c: DocumentChunkResult) => c.content).slice(0, 20),
    budgetItems: budgetItems.map((b: { description: string | null; budgetedAmount: unknown; costCode: string | null }) => ({
      description: b.description || '',
      budgetedAmount: Number(b.budgetedAmount),
      costCode: b.costCode
    }))
  };
}

/**
 * Get quote data for analysis
 */
async function getQuoteData(projectId: string, tradeType?: string, quoteIds?: string[]): Promise<Array<{
  id: string;
  companyName: string;
  tradeType?: string | null;
  totalAmount: number;
  scopeDescription?: string | null;
  inclusions: string[];
  exclusions: string[];
  extractedData?: unknown;
}>> {
  const where: Record<string, unknown> = { projectId };
  
  if (tradeType) {
    where.tradeType = tradeType;
  }
  
  if (quoteIds && quoteIds.length > 0) {
    where.id = { in: quoteIds };
  }
  
  const quotes: QuoteResult[] = await prisma.subcontractorQuote.findMany({
    where,
    select: {
      id: true,
      companyName: true,
      tradeType: true,
      totalAmount: true,
      scopeDescription: true,
      inclusions: true,
      exclusions: true,
      extractedData: true,
    }
  });

  return quotes.map((q: QuoteResult) => ({
    id: q.id,
    companyName: q.companyName,
    tradeType: q.tradeType,
    totalAmount: Number(q.totalAmount),
    scopeDescription: q.scopeDescription,
    inclusions: q.inclusions as string[],
    exclusions: q.exclusions as string[],
    extractedData: q.extractedData,
  }));
}

/**
 * Analyze scope gaps using AI
 */
export async function analyzeScopeGaps(
  projectId: string,
  options?: {
    tradeType?: string;
    quoteIds?: string[];
  }
): Promise<ScopeGapAnalysisResult> {
  logger.info('SCOPE_GAP', 'Starting analysis', { projectId });
  
  const { tradeType, quoteIds } = options || {};
  
  // Gather project requirements
  const requirements = await getProjectRequirements(projectId, tradeType);
  
  // Gather quote data
  const quotes = await getQuoteData(projectId, tradeType, quoteIds);
  
  if (quotes.length === 0) {
    return {
      projectId,
      tradeType,
      analysisDate: new Date().toISOString(),
      overallCoverageScore: 0,
      gaps: [{
        id: 'no-quotes',
        category: 'missing_scope',
        severity: 'high',
        description: 'No quotes available for analysis',
        projectRequirement: 'Subcontractor coverage required',
        recommendation: 'Upload subcontractor quotes to begin scope gap analysis',
        tradeType,
      }],
      coveredItems: [],
      recommendations: ['Upload subcontractor quotes for this trade/project'],
      totalEstimatedGapCost: 0,
      confidence: 100,
    };
  }
  
  // Build AI prompt
  const prompt = buildAnalysisPrompt(requirements, quotes, tradeType);
  
  try {
    const response = await callAbacusLLM([
      { role: 'system', content: SCOPE_GAP_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ], {
      temperature: 0.2,
      max_tokens: 4000,
    });
    
    // Parse AI response - response is an LLMResponse object with content property
    const result = parseAnalysisResponse(response.content, projectId, tradeType);
    
    logger.info('SCOPE_GAP', 'Analysis complete', { gaps: result.gaps.length, coverageScore: result.overallCoverageScore });
    
    return result;
    
  } catch (error) {
    logger.error('SCOPE_GAP', 'Analysis error', error instanceof Error ? error : undefined);
    return {
      projectId,
      tradeType,
      analysisDate: new Date().toISOString(),
      overallCoverageScore: 0,
      gaps: [{
        id: 'analysis-error',
        category: 'ambiguous',
        severity: 'medium',
        description: 'Unable to complete scope gap analysis',
        projectRequirement: 'Analysis failed',
        recommendation: 'Please try again or manually review quotes',
      }],
      coveredItems: [],
      recommendations: ['Retry analysis or perform manual review'],
      totalEstimatedGapCost: 0,
      confidence: 0,
    };
  }
}

const SCOPE_GAP_SYSTEM_PROMPT = `You are an expert construction project manager analyzing scope coverage between project requirements and subcontractor quotes.

Your task is to identify gaps where project requirements are NOT covered by submitted quotes, or only partially covered.

For each gap found, assess:
1. Category: missing_scope (not mentioned at all), partial_coverage (mentioned but incomplete), ambiguous (unclear coverage), exclusion_risk (explicitly excluded)
2. Severity: high (critical path/safety), medium (important but not critical), low (minor/cosmetic)
3. Estimated cost impact if known
4. Specific recommendation to address

Be thorough but practical. Focus on substantive gaps, not minor administrative items.

Respond in JSON format:
{
  "overallCoverageScore": 0-100,
  "gaps": [
    {
      "category": "missing_scope|partial_coverage|ambiguous|exclusion_risk",
      "severity": "high|medium|low",
      "description": "Clear description of the gap",
      "projectRequirement": "The specific requirement not covered",
      "quoteReference": "Which quote/section relates (if any)",
      "estimatedCostImpact": number or null,
      "recommendation": "How to address this gap"
    }
  ],
  "coveredItems": ["List of requirements that ARE covered"],
  "recommendations": ["Overall recommendations"],
  "totalEstimatedGapCost": number,
  "confidence": 0-100
}`;

function buildAnalysisPrompt(
  requirements: Awaited<ReturnType<typeof getProjectRequirements>>,
  quotes: Awaited<ReturnType<typeof getQuoteData>>,
  tradeType?: string
): string {
  const tradeLabel = tradeType ? TRADE_DISPLAY_NAMES[tradeType] || tradeType : 'All Trades';
  
  let prompt = `## Scope Gap Analysis Request\n\n`;
  prompt += `**Trade Focus:** ${tradeLabel}\n\n`;
  
  // Add schedule tasks as requirements
  prompt += `### Project Schedule Tasks (Requirements)\n`;
  if (requirements.scheduleTasks.length > 0) {
    requirements.scheduleTasks.forEach((task, i) => {
      prompt += `${i + 1}. ${task.name}`;
      if (task.description) prompt += ` - ${task.description}`;
      if (task.tradeType) prompt += ` [${TRADE_DISPLAY_NAMES[task.tradeType] || task.tradeType}]`;
      prompt += `\n`;
    });
  } else {
    prompt += `No schedule tasks found for this trade.\n`;
  }
  
  // Add budget items as requirements
  prompt += `\n### Budget Line Items (Expected Work)\n`;
  if (requirements.budgetItems.length > 0) {
    requirements.budgetItems.forEach((item, i) => {
      prompt += `${i + 1}. ${item.description}`;
      if (item.costCode) prompt += ` [${item.costCode}]`;
      prompt += ` - Budget: $${item.budgetedAmount.toLocaleString()}\n`;
    });
  } else {
    prompt += `No budget items found.\n`;
  }
  
  // Add document scopes (condensed)
  if (requirements.documentScopes.length > 0) {
    prompt += `\n### Relevant Specification Excerpts\n`;
    prompt += requirements.documentScopes.slice(0, 10).join('\n---\n').substring(0, 3000);
    prompt += `\n`;
  }
  
  // Add quote information
  prompt += `\n### Submitted Quotes\n`;
  quotes.forEach((quote, i) => {
    prompt += `\n**Quote ${i + 1}: ${quote.companyName}**\n`;
    prompt += `- Trade: ${quote.tradeType ? TRADE_DISPLAY_NAMES[quote.tradeType] || quote.tradeType : 'Not specified'}\n`;
    prompt += `- Total Amount: $${quote.totalAmount.toLocaleString()}\n`;
    
    if (quote.scopeDescription) {
      prompt += `- Scope: ${quote.scopeDescription.substring(0, 500)}\n`;
    }
    
    if (quote.inclusions.length > 0) {
      prompt += `- Inclusions:\n`;
      quote.inclusions.forEach(inc => prompt += `  • ${inc}\n`);
    }
    
    if (quote.exclusions.length > 0) {
      prompt += `- **Exclusions (IMPORTANT):**\n`;
      quote.exclusions.forEach(exc => prompt += `  ⚠️ ${exc}\n`);
    }
    
    // Add line items if available
    const extractedData = quote.extractedData as { lineItems?: Array<{ description: string; totalPrice?: number }> } | null;
    if (extractedData?.lineItems && extractedData.lineItems.length > 0) {
      prompt += `- Line Items:\n`;
      extractedData.lineItems.slice(0, 15).forEach(item => {
        prompt += `  • ${item.description}`;
        if (item.totalPrice) prompt += ` - $${item.totalPrice.toLocaleString()}`;
        prompt += `\n`;
      });
    }
  });
  
  prompt += `\n---\n\nAnalyze the coverage of project requirements by the submitted quotes. Identify all gaps, partial coverage, and risks from exclusions.`;
  
  return prompt;
}

function parseAnalysisResponse(
  response: string,
  projectId: string,
  tradeType?: string
): ScopeGapAnalysisResult {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Transform gaps with IDs
    const gaps: ScopeGap[] = (parsed.gaps || []).map((gap: Partial<ScopeGap>, index: number) => ({
      id: `gap-${Date.now()}-${index}`,
      category: gap.category || 'ambiguous',
      severity: gap.severity || 'medium',
      description: gap.description || 'Unspecified gap',
      projectRequirement: gap.projectRequirement || '',
      quoteReference: gap.quoteReference,
      estimatedCostImpact: gap.estimatedCostImpact,
      recommendation: gap.recommendation || 'Review with subcontractor',
      tradeType,
    }));
    
    return {
      projectId,
      tradeType,
      analysisDate: new Date().toISOString(),
      overallCoverageScore: parsed.overallCoverageScore || 0,
      gaps,
      coveredItems: parsed.coveredItems || [],
      recommendations: parsed.recommendations || [],
      totalEstimatedGapCost: parsed.totalEstimatedGapCost || 0,
      confidence: parsed.confidence || 75,
    };
    
  } catch (error) {
    logger.error('SCOPE_GAP', 'Parse error', error instanceof Error ? error : undefined);
    return {
      projectId,
      tradeType,
      analysisDate: new Date().toISOString(),
      overallCoverageScore: 50,
      gaps: [{
        id: 'parse-error',
        category: 'ambiguous',
        severity: 'low',
        description: 'Analysis completed but response parsing failed',
        projectRequirement: 'Manual review recommended',
        recommendation: 'Please review quotes manually or retry analysis',
      }],
      coveredItems: [],
      recommendations: ['Manual review recommended'],
      totalEstimatedGapCost: 0,
      confidence: 25,
    };
  }
}

/**
 * Analyze gaps for a specific trade type
 */
export async function analyzeTradeGaps(
  projectId: string,
  tradeType: string
): Promise<ScopeGapAnalysisResult> {
  return analyzeScopeGaps(projectId, { tradeType });
}

/**
 * Analyze gaps for specific quotes
 */
export async function analyzeQuoteGaps(
  projectId: string,
  quoteIds: string[]
): Promise<ScopeGapAnalysisResult> {
  // Get the trade type from the first quote
  const quote = await prisma.subcontractorQuote.findFirst({
    where: { id: { in: quoteIds } },
    select: { tradeType: true }
  });
  
  return analyzeScopeGaps(projectId, { 
    tradeType: quote?.tradeType || undefined, 
    quoteIds 
  });
}

/**
 * Get gap summary for all trades in a project
 */
export async function getProjectGapSummary(projectId: string): Promise<{
  byTrade: Array<{
    tradeType: string;
    tradeName: string;
    quoteCount: number;
    gapCount?: number;
    coverageScore?: number;
  }>;
  totalQuotes: number;
  tradesWithGaps: number;
}> {
  // Get quote counts by trade
  const quoteCounts = await prisma.subcontractorQuote.groupBy({
    by: ['tradeType'],
    where: { projectId },
    _count: { id: true }
  });
  
  type GroupByResult = typeof quoteCounts[number];
  
  const byTrade = quoteCounts
    .filter((q: GroupByResult) => q.tradeType)
    .map((q: GroupByResult) => ({
      tradeType: q.tradeType!,
      tradeName: TRADE_DISPLAY_NAMES[q.tradeType!] || q.tradeType!,
      quoteCount: q._count.id,
    }));
  
  return {
    byTrade,
    totalQuotes: quoteCounts.reduce((sum: number, q: GroupByResult) => sum + q._count.id, 0),
    tradesWithGaps: 0, // Will be populated after analysis
  };
}
