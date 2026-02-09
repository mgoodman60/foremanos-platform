/**
 * Adaptive Symbol Learning System
 * Machine learning-based system for recognizing and learning custom construction symbols
 * 
 * Features:
 * - Pattern recognition for unknown symbols
 * - Context-based symbol classification
 * - Learning from user feedback
 * - Project-specific symbol libraries
 * - Confidence scoring
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { logger } from './logger';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CustomSymbol {
  id: string;
  projectSlug: string;
  symbolId: string; // Unique identifier for this symbol type
  name: string;
  category: string; // e.g., "electrical", "plumbing", "custom"
  description: string;
  visualPattern: string; // Text description of visual appearance
  contexts: string[]; // Where this symbol typically appears
  aliases: string[]; // Alternative names
  confidence: number; // 0-1, how confident we are in this identification
  occurrences: number; // How many times we've seen this
  confirmedBy?: string; // User email who confirmed
  confirmedAt?: Date;
  metadata?: {
    standardReference?: string;
    relatedSymbols?: string[];
    typicalSize?: string;
    [key: string]: any;
  };
}

export interface SymbolRecognitionResult {
  symbol: CustomSymbol | null;
  confidence: number;
  alternatives: Array<{
    symbol: CustomSymbol;
    confidence: number;
    reasoning: string;
  }>;
  isNew: boolean;
  suggestion?: string;
}

export interface LearningFeedback {
  symbolId: string;
  correctName?: string;
  correctCategory?: string;
  isCorrect: boolean;
  userEmail: string;
  timestamp: Date;
  notes?: string;
}

// ============================================================================
// SYMBOL DETECTION
// ============================================================================

/**
 * Detect and identify unknown symbols using AI vision and context
 */
export async function detectUnknownSymbol(
  projectSlug: string,
  description: string,
  context: string,
  visualDescription?: string
): Promise<SymbolRecognitionResult> {
  try {
    // Check if we've seen this symbol before in this project
    const existingSymbol = await findSimilarSymbol(projectSlug, description, context);

    if (existingSymbol && existingSymbol.confidence > 0.7) {
      return {
        symbol: existingSymbol.symbol,
        confidence: existingSymbol.confidence,
        alternatives: [],
        isNew: false
      };
    }

    // Use LLM to analyze and classify the symbol
    const analysis = await analyzeSymbolWithAI(
      description,
      context,
      visualDescription
    );

    // Create or update symbol in our learning database
    const symbol = await learnNewSymbol(
      projectSlug,
      description,
      analysis,
      context
    );

    return {
      symbol,
      confidence: analysis.confidence,
      alternatives: existingSymbol ? [{
        symbol: existingSymbol.symbol,
        confidence: existingSymbol.confidence,
        reasoning: 'Similar symbol found in project history'
      }] : [],
      isNew: true,
      suggestion: analysis.suggestion
    };
  } catch (error) {
    logger.error('ADAPTIVE_SYMBOL', 'Symbol detection error', error as Error);
    return {
      symbol: null,
      confidence: 0,
      alternatives: [],
      isNew: false
    };
  }
}

/**
 * Find similar symbols in the project's learning history
 */
async function findSimilarSymbol(
  projectSlug: string,
  description: string,
  context: string
): Promise<{ symbol: CustomSymbol; confidence: number } | null> {
  try {
    // Get all custom symbols for this project
    const symbols = await getProjectSymbols(projectSlug);

    if (symbols.length === 0) return null;

    // Use simple text similarity for now
    // In production, this would use embeddings or more sophisticated ML
    let bestMatch: CustomSymbol | null = null;
    let bestScore = 0;

    for (const symbol of symbols) {
      let score = 0;

      // Check name similarity
      if (symbol.name.toLowerCase().includes(description.toLowerCase())) {
        score += 0.4;
      }

      // Check alias similarity
      for (const alias of symbol.aliases) {
        if (alias.toLowerCase().includes(description.toLowerCase())) {
          score += 0.3;
          break;
        }
      }

      // Check context overlap
      for (const symbolContext of symbol.contexts) {
        if (context.toLowerCase().includes(symbolContext.toLowerCase())) {
          score += 0.2;
          break;
        }
      }

      // Boost for confirmed symbols
      if (symbol.confirmedBy) {
        score *= 1.2;
      }

      // Boost for frequently seen symbols
      if (symbol.occurrences > 5) {
        score *= 1.1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = symbol;
      }
    }

    if (bestMatch && bestScore > 0.5) {
      return { symbol: bestMatch, confidence: Math.min(bestScore, 1.0) };
    }

    return null;
  } catch (error) {
    logger.error('ADAPTIVE_SYMBOL', 'Error finding similar symbol', error as Error);
    return null;
  }
}

/**
 * Use AI to analyze and classify an unknown symbol
 */
async function analyzeSymbolWithAI(
  description: string,
  context: string,
  visualDescription?: string
): Promise<{
  name: string;
  category: string;
  symbolDescription: string;
  confidence: number;
  suggestion: string;
}> {
  try {
    const prompt = `Analyze this construction drawing symbol:

Description: ${description}
Context: ${context}${visualDescription ? `\nVisual Appearance: ${visualDescription}` : ''}

Please provide:
1. Most likely symbol name
2. Category (architectural, structural, mechanical, electrical, plumbing, fire protection, custom)
3. Detailed description of what this symbol represents
4. Confidence level (0-1)
5. Any suggestions for verification

Respond in JSON format:
{
  "name": "symbol name",
  "category": "category",
  "description": "detailed description",
  "confidence": 0.85,
  "suggestion": "verification suggestion"
}`;

    const response = await callAbacusLLM([{ role: 'user', content: prompt }], {
      temperature: 0.3,
      max_tokens: 500
    });

    // Parse AI response
    try {
      // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
      let contentToParse = response.content;
      const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        contentToParse = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(contentToParse);
      return {
        name: parsed.name || 'Unknown Symbol',
        category: parsed.category || 'custom',
        symbolDescription: parsed.description || description,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        suggestion: parsed.suggestion || 'Review with project team'
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        name: description,
        category: 'custom',
        symbolDescription: description,
        confidence: 0.3,
        suggestion: 'Unable to classify - manual review recommended'
      };
    }
  } catch (error) {
    logger.error('ADAPTIVE_SYMBOL', 'AI analysis error', error as Error);
    return {
      name: description,
      category: 'custom',
      symbolDescription: description,
      confidence: 0.1,
      suggestion: 'AI analysis failed - manual classification needed'
    };
  }
}

/**
 * Learn and store a new symbol
 */
async function learnNewSymbol(
  projectSlug: string,
  originalDescription: string,
  analysis: Awaited<ReturnType<typeof analyzeSymbolWithAI>>,
  context: string
): Promise<CustomSymbol> {
  const symbolId = `${projectSlug}-${analysis.category}-${Date.now()}`;

  const symbol: CustomSymbol = {
    id: symbolId,
    projectSlug,
    symbolId,
    name: analysis.name,
    category: analysis.category,
    description: analysis.symbolDescription,
    visualPattern: originalDescription,
    contexts: [context],
    aliases: [originalDescription, analysis.name].filter((v, i, a) => a.indexOf(v) === i),
    confidence: analysis.confidence,
    occurrences: 1,
    metadata: {
      suggestion: analysis.suggestion,
      learnedAt: new Date().toISOString()
    }
  };

  // Store in memory (in production, this would go to database)
  await storeSymbol(symbol);

  return symbol;
}

// ============================================================================
// SYMBOL STORAGE & RETRIEVAL (DATABASE)
// ============================================================================

async function storeSymbol(symbol: CustomSymbol): Promise<void> {
  // Get project ID from slug
  const project = await prisma.project.findUnique({
    where: { slug: symbol.projectSlug },
    select: { id: true }
  });

  if (!project) {
    throw new Error(`Project not found: ${symbol.projectSlug}`);
  }

  // Map CustomSymbol interface to Prisma model
  const categoryMap: Record<string, any> = {
    'architectural': 'architectural',
    'structural': 'structural',
    'mechanical': 'mechanical',
    'electrical': 'electrical',
    'plumbing': 'plumbing',
    'fire_protection': 'fire_protection',
    'custom': 'custom'
  };

  const prismaCategory = categoryMap[symbol.category] || 'custom';

  // Upsert the symbol
  await prisma.customSymbol.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: symbol.name
      }
    },
    update: {
      description: symbol.description,
      category: prismaCategory,
      aliases: symbol.aliases,
      confidence: symbol.confidence,
      usageCount: symbol.occurrences,
      learnedFrom: symbol.contexts[0] || null,
      contextInfo: symbol.metadata || {},
      confirmedBy: symbol.confirmedBy || null
    },
    create: {
      projectId: project.id,
      name: symbol.name,
      description: symbol.description,
      category: prismaCategory,
      aliases: symbol.aliases,
      confidence: symbol.confidence,
      usageCount: symbol.occurrences,
      learnedFrom: symbol.contexts[0] || null,
      contextInfo: symbol.metadata || {},
      standardMatch: symbol.metadata?.standardReference || null
    }
  });
}

async function getProjectSymbols(projectSlug: string): Promise<CustomSymbol[]> {
  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { id: true }
  });

  if (!project) {
    return [];
  }

  const symbols = await prisma.customSymbol.findMany({
    where: { projectId: project.id },
    orderBy: { usageCount: 'desc' }
  });

  // Map Prisma model back to CustomSymbol interface
  return symbols.map((s: any) => ({
    id: s.id,
    projectSlug,
    symbolId: s.id,
    name: s.name,
    category: s.category,
    description: s.description,
    visualPattern: s.description,
    contexts: s.learnedFrom ? [s.learnedFrom] : [],
    aliases: s.aliases,
    confidence: s.confidence,
    occurrences: s.usageCount,
    confirmedBy: s.confirmedBy || undefined,
    confirmedAt: s.confirmedBy ? s.updatedAt : undefined,
    metadata: {
      standardReference: s.standardMatch || undefined,
      ...(typeof s.contextInfo === 'object' && s.contextInfo !== null ? s.contextInfo as Record<string, any> : {})
    }
  }));
}

/**
 * Get all symbols for a project
 */
export async function getCustomSymbols(
  projectSlug: string,
  category?: string
): Promise<CustomSymbol[]> {
  const symbols = await getProjectSymbols(projectSlug);

  if (category) {
    return symbols.filter(s => s.category === category);
  }

  return symbols;
}

/**
 * Get a specific symbol by ID
 */
export async function getSymbolById(
  symbolId: string
): Promise<CustomSymbol | null> {
  const dbSymbol = await prisma.customSymbol.findUnique({
    where: { id: symbolId },
    include: {
      Project: {
        select: { slug: true }
      }
    }
  });

  if (!dbSymbol) return null;

  return {
    id: dbSymbol.id,
    projectSlug: dbSymbol.Project.slug,
    symbolId: dbSymbol.id,
    name: dbSymbol.name,
    category: dbSymbol.category,
    description: dbSymbol.description,
    visualPattern: dbSymbol.description,
    contexts: dbSymbol.learnedFrom ? [dbSymbol.learnedFrom] : [],
    aliases: dbSymbol.aliases,
    confidence: dbSymbol.confidence,
    occurrences: dbSymbol.usageCount,
    confirmedBy: dbSymbol.confirmedBy || undefined,
    confirmedAt: dbSymbol.confirmedBy ? dbSymbol.updatedAt : undefined,
    metadata: {
      standardReference: dbSymbol.standardMatch || undefined,
      ...(typeof dbSymbol.contextInfo === 'object' && dbSymbol.contextInfo !== null ? dbSymbol.contextInfo as Record<string, any> : {})
    }
  };
}

// ============================================================================
// LEARNING & FEEDBACK
// ============================================================================

/**
 * Apply user feedback to improve symbol recognition
 */
export async function applyLearningFeedback(
  feedback: LearningFeedback
): Promise<boolean> {
  try {
    const symbol = await getSymbolById(feedback.symbolId);

    if (!symbol) return false;

    if (feedback.isCorrect) {
      // Increase confidence and occurrence count
      symbol.confidence = Math.min(1.0, symbol.confidence + 0.1);
      symbol.occurrences += 1;
      symbol.confirmedBy = feedback.userEmail;
      symbol.confirmedAt = feedback.timestamp;
    } else {
      // Update with correct information if provided
      if (feedback.correctName) {
        symbol.name = feedback.correctName;
        symbol.aliases.push(feedback.correctName);
      }
      if (feedback.correctCategory) {
        symbol.category = feedback.correctCategory;
      }
      // Reduce confidence slightly
      symbol.confidence = Math.max(0.1, symbol.confidence - 0.2);
    }

    // Store updated symbol
    await storeSymbol(symbol);

    return true;
  } catch (error) {
    logger.error('ADAPTIVE_SYMBOL', 'Error applying learning feedback', error as Error);
    return false;
  }
}

/**
 * Batch process symbols from document chunks to learn patterns
 */
export async function learnFromDocuments(
  projectSlug: string
): Promise<{
  symbolsLearned: number;
  categoriesFound: Set<string>;
  confidence: number;
}> {
  try {
    const chunks = await prisma.documentChunk.findMany({
      where: {
        Document: {
          Project: { slug: projectSlug }
        }
      }
    });

    let symbolsLearned = 0;
    const categoriesFound = new Set<string>();
    let totalConfidence = 0;

    for (const chunk of chunks) {
      const metadata = chunk.metadata as any;

      // Extract symbols from various metadata fields
      const symbolSources = [
        ...(metadata?.structuralCallouts || []),
        ...(metadata?.mepCallouts || []),
        ...(metadata?.elements || [])
      ];

      for (const source of symbolSources) {
        if (source && source.description) {
          const result = await detectUnknownSymbol(
            projectSlug,
            source.description,
            chunk.content || '',
            source.visualDescription
          );

          if (result.symbol) {
            symbolsLearned++;
            categoriesFound.add(result.symbol.category);
            totalConfidence += result.confidence;
          }
        }
      }
    }

    const avgConfidence = symbolsLearned > 0 ? totalConfidence / symbolsLearned : 0;

    return {
      symbolsLearned,
      categoriesFound,
      confidence: avgConfidence
    };
  } catch (error) {
    logger.error('ADAPTIVE_SYMBOL', 'Error learning from documents', error as Error);
    return {
      symbolsLearned: 0,
      categoriesFound: new Set(),
      confidence: 0
    };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const adaptiveSymbolLearning = {
  detectUnknownSymbol,
  getCustomSymbols,
  getSymbolById,
  applyLearningFeedback,
  learnFromDocuments
};
