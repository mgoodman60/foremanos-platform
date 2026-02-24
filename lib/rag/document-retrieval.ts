/**
 * Document Retrieval Module — PRIMARY RAG API
 *
 * Contains the main `retrieveRelevantDocuments` function and all internal
 * scoring/ranking helpers: detectQueryIntent, applyCategoryBoost, extractKeywords,
 * calculateRelevanceScore, calculateProximityScore, extractSheetNumbers.
 *
 * Also contains `generateContextPrompt` for basic context prompt generation.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { isPluginAvailable } from '@/lib/plugin';
import { searchPluginReferences } from '@/lib/plugin/reference-loader';
import type {
  ChunkMetadata,
  DocumentChunk,
  ScoredChunk,
  TitleBlockData,
} from './core-types';

// Re-export types that consumers expect from this module
export type { DocumentChunk, ScoredChunk };

/**
 * Simple keyword-based document retrieval
 * In production, this would use vector embeddings for semantic search
 */
export async function retrieveRelevantDocuments(
  query: string,
  userRole: 'admin' | 'client' | 'guest' | 'pending',
  limit: number = 5,
  projectSlug?: string
): Promise<{ chunks: DocumentChunk[]; documentNames: string[] }> {
  try {
    // CRITICAL: Filter by project FIRST to ensure complete project isolation
    const whereClause: Prisma.DocumentWhereInput = {
      processed: true,
    };

    // MUST filter by project - this ensures no cross-project document leakage
    if (projectSlug) {
      const projects = await prisma.project.findMany({
        where: { slug: projectSlug },
        select: { id: true }
      });

      whereClause.projectId = {
        in: projects.map((p) => p.id)
      };
    } else {
      // If no projectSlug provided, return empty results to prevent cross-project access
      return { chunks: [], documentNames: [] };
    }

    // Add role-based access control (secondary filter after project isolation)
    if (userRole === 'guest') {
      // Guests can only access 'guest' level documents
      whereClause.accessLevel = 'guest';
    } else if (userRole === 'client') {
      // Clients can access 'client' and 'guest' level documents
      whereClause.accessLevel = { in: ['client', 'guest'] };
    }
    // Admin users can access all documents (no accessLevel filter)

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        DocumentChunk: true,
      },
    });

    // Extract keywords from query
    const keywords = extractKeywords(query);

    // Detect query intent for category boosting
    const queryIntent = detectQueryIntent(query);

    // Score and rank chunks
    const scoredChunks: ScoredChunk[] = [];

    for (const doc of documents) {
      for (const chunk of doc.DocumentChunk) {
        // Skip chunks that failed extraction — they contain garbage content
        const chunkMeta = chunk.metadata as Record<string, unknown> | null;
        if (chunkMeta?.skipForRag) continue;

        let score = calculateRelevanceScore(chunk.content, keywords, query, doc.name);

        // Apply category boost based on query intent
        if (score > 0) {
          score = applyCategoryBoost(score, doc.category, queryIntent);

          const existingMetadata = (typeof chunk.metadata === 'object' && chunk.metadata !== null)
            ? chunk.metadata as Record<string, unknown>
            : {};

          scoredChunks.push({
            chunk: {
              ...chunk,
              documentId: chunk.documentId || '',
              documentCategory: doc.category,
              documentName: doc.name,
              titleBlockData: chunk.titleBlockData as TitleBlockData | undefined,
              metadata: {
                ...existingMetadata,
                documentName: doc.name,
                accessLevel: doc.accessLevel,
                category: doc.category,
              } as ChunkMetadata,
            },
            score,
          });
        }
      }
    }

    // Sort by score and take top results
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, limit).map(sc => sc.chunk);

    // ── Plugin Reference Integration ───────────────────────────────
    // When the ai-intelligence plugin is available, search its reference
    // documents for relevant construction knowledge and merge into results.
    // Plugin chunks are scored slightly lower so actual project documents
    // rank higher than general reference material.
    if (isPluginAvailable()) {
      try {
        const pluginResults = searchPluginReferences(query, Math.max(2, Math.floor(limit / 2)));

        // Determine the score floor: plugin results should not outrank
        // the lowest-scoring project document already in the results.
        const lowestProjectScore = scoredChunks.length > 0
          ? scoredChunks[Math.min(scoredChunks.length - 1, limit - 1)]?.score ?? 0
          : 0;

        for (const result of pluginResults) {
          // Scale plugin score to be below project document scores.
          // Use 70% of the plugin's raw score, capped at 90% of the lowest project chunk score.
          let adjustedScore = result.score * 0.7;
          if (lowestProjectScore > 0) {
            adjustedScore = Math.min(adjustedScore, lowestProjectScore * 0.9);
          }

          // Only include if the plugin chunk has a meaningful score
          if (adjustedScore < 5) continue;

          const pluginChunk: DocumentChunk = {
            id: `plugin-ref-${result.chunk.skillSlug}-${result.chunk.filename}-${result.chunk.chunkIndex}`,
            content: result.chunk.content,
            documentId: 'plugin-reference',
            pageNumber: result.chunk.chunkIndex + 1,
            metadata: {
              documentName: `[Reference] ${result.chunk.title}`,
              category: 'plugin_reference',
              accessLevel: 'admin',
            } as ChunkMetadata,
            documentCategory: 'plugin_reference',
            documentName: `[Reference] ${result.chunk.title}`,
          };

          topChunks.push(pluginChunk);
        }
      } catch (err) {
        // Plugin reference search should never break the main RAG pipeline
        logger.warn('RAG', 'Plugin reference search failed (non-fatal)', { error: String(err) });
      }
    }

    // Get unique document names
    const documentNames = [...new Set(
      topChunks.map(c => c.metadata?.documentName).filter(Boolean)
    )];

    return {
      chunks: topChunks,
      documentNames,
    };
  } catch (error) {
    logger.error('RAG', 'Error retrieving documents', error as Error);
    return { chunks: [], documentNames: [] };
  }
}

/**
 * Detect query intent to boost relevant document categories
 */
function detectQueryIntent(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const intents: string[] = [];

  // Budget/Cost related
  if (lowerQuery.match(/\b(cost|budget|price|pricing|estimate|bid|quote|payment|invoice|expense)\b/i)) {
    intents.push('budget_cost');
  }

  // Schedule related
  if (lowerQuery.match(/\b(schedule|timeline|deadline|milestone|duration|gantt|critical path|phase|when|date)\b/i)) {
    intents.push('schedule');
  }

  // Plans/Drawings related
  if (lowerQuery.match(/\b(plan|drawing|blueprint|sheet|elevation|section|detail|dimension|scale|layout)\b/i)) {
    intents.push('plans_drawings');
  }

  // Specifications related
  if (lowerQuery.match(/\b(spec|specification|material|product|datasheet|technical|standard|requirement)\b/i)) {
    intents.push('specifications');
  }

  // Contracts related
  if (lowerQuery.match(/\b(contract|agreement|rfi|change order|submittal|legal|proposal|addendum)\b/i)) {
    intents.push('contracts');
  }

  // Daily Reports related
  if (lowerQuery.match(/\b(daily|log|report|inspection|progress|status|field|observation|weather)\b/i)) {
    intents.push('daily_reports');
  }

  return intents;
}

/**
 * Apply category boost to relevance score based on query intent
 */
function applyCategoryBoost(score: number, documentCategory: string, queryIntents: string[]): number {
  if (!documentCategory || queryIntents.length === 0) {
    return score;
  }

  // Strong boost if document category matches query intent
  if (queryIntents.includes(documentCategory)) {
    return score * 1.5; // 50% boost for matching category
  }

  // Moderate boost for related categories
  const relatedCategories: Record<string, string[]> = {
    'budget_cost': ['contracts', 'specifications'],
    'schedule': ['contracts', 'daily_reports'],
    'plans_drawings': ['specifications', 'daily_reports'],
    'specifications': ['plans_drawings', 'budget_cost'],
    'contracts': ['budget_cost', 'schedule'],
    'daily_reports': ['schedule', 'plans_drawings'],
  };

  const related = relatedCategories[documentCategory] || [];
  if (queryIntents.some(intent => related.includes(intent))) {
    return score * 1.2; // 20% boost for related category
  }

  return score;
}

/**
 * Extract important keywords from query with comprehensive synonym expansion
 */
export function extractKeywords(query: string): string[] {
  // Remove common words
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with',
    'to', 'for', 'of', 'as', 'by', 'from', 'what', 'how', 'when', 'where', 'who',
    'why', 'can', 'could', 'would', 'should', 'do', 'does', 'did', 'have', 'has',
    'had', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'me', 'my', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them',
  ]);

  // Comprehensive construction term synonyms
  const synonyms: Record<string, string[]> = {
    // Foundation terms
    'footer': ['footing', 'footer', 'footers', 'footings', 'foundation', 'bottom', 'base'],
    'footing': ['footing', 'footer', 'footers', 'footings', 'foundation', 'bottom', 'base'],
    'foundation': ['foundation', 'footing', 'footer', 'base', 'bottom'],

    // Grade/depth terms
    'subgrade': ['subgrade', 'grade', 'below grade', 'finished grade', 'exterior grade', 'ground'],
    'grade': ['grade', 'subgrade', 'finished grade', 'exterior grade', 'ground', 'level'],
    'below': ['below', 'depth', 'under', 'beneath', 'minimum'],

    // Structural terms
    'rebar': ['rebar', 'reinforcement', 'reinforcing', 'steel', 'bar'],
    'reinforcement': ['reinforcement', 'rebar', 'reinforcing', 'steel'],
    'concrete': ['concrete', 'pour', 'slab', 'mix'],
    'structural': ['structural', 'structure', 'framing', 'support'],

    // Mechanical/Electrical
    'hvac': ['hvac', 'mechanical', 'heating', 'cooling', 'ventilation', 'air'],
    'electrical': ['electrical', 'electric', 'power', 'wiring', 'circuit'],
    'plumbing': ['plumbing', 'pipe', 'piping', 'water', 'drain', 'sewer'],

    // Dimensions/measurements
    'dimension': ['dimension', 'size', 'measurement', 'length', 'width', 'height'],

    // Specifications
    'specification': ['specification', 'spec', 'requirement', 'detail', 'note'],
    'requirement': ['requirement', 'spec', 'specification', 'code', 'standard'],

    // Counting & Quantity terms (for "how many" questions)
    'receptacles': ['receptacles', 'receptacle', 'outlets', 'outlet', 'duplex', 'plug'],
    'receptacle': ['receptacle', 'receptacles', 'outlet', 'outlets', 'duplex', 'plug'],
    'outlets': ['outlets', 'outlet', 'receptacles', 'receptacle', 'plug'],
    'outlet': ['outlet', 'outlets', 'receptacle', 'receptacles', 'plug'],
    'fixtures': ['fixtures', 'fixture', 'light', 'lights', 'lighting'],
    'fixture': ['fixture', 'fixtures', 'light', 'lights', 'lighting'],
    'lights': ['lights', 'light', 'fixtures', 'fixture', 'lighting', 'luminaire'],
    'light': ['light', 'lights', 'fixture', 'fixtures', 'lighting', 'luminaire'],
    'doors': ['doors', 'door', 'entry', 'entries', 'opening'],
    'door': ['door', 'doors', 'entry', 'opening'],
    'windows': ['windows', 'window', 'glazing', 'openings'],
    'window': ['window', 'windows', 'glazing', 'opening'],
    'many': ['many', 'count', 'number', 'total', 'quantity', 'amount'],
    'count': ['count', 'number', 'total', 'quantity', 'many', 'amount'],
    'schedules': ['schedules', 'table', 'list', 'legend', 'chart'],
    'legend': ['legend', 'schedules', 'key', 'symbol', 'table'],

    // Measurement & Dimension terms
    'depth': ['depth', 'deep', 'below', 'bottom', 'minimum', 'depth of'],
    'height': ['height', 'high', 'tall', 'elevation', 'vertical'],
    'width': ['width', 'wide', 'breadth', 'horizontal'],
    'thickness': ['thickness', 'thick', 'thk'],
    'clearance': ['clearance', 'clear', 'opening', 'space'],
    'spacing': ['spacing', 'space', 'on center', 'o.c.', 'oc'],
    'size': ['size', 'dimension', 'measurement', 'dimensions'],

    // Material & Finish terms
    'finish': ['finish', 'finishes', 'coating', 'surface'],
    'material': ['material', 'materials', 'construction', 'type'],
    'frame': ['frame', 'framing', 'structure', 'support'],
    'wall': ['wall', 'walls', 'partition', 'partitions'],
    'ceiling': ['ceiling', 'ceilings', 'overhead'],
    'floor': ['floor', 'floors', 'flooring', 'deck'],
    'roof': ['roof', 'roofing', 'rooftop'],

    // System & Equipment terms
    'system': ['system', 'systems', 'equipment', 'unit'],
    'unit': ['unit', 'units', 'equipment', 'system'],
    'panel': ['panel', 'panels', 'panelboard', 'board'],
    'duct': ['duct', 'ducts', 'ductwork', 'ducting'],
    'pipe': ['pipe', 'pipes', 'piping', 'conduit'],

    // Calculation & Volume terms (for extrapolation queries)
    'cubic': ['cubic', 'volume', 'cu', 'yards', 'excavation'],
    'volume': ['volume', 'cubic', 'capacity', 'cu', 'yards'],
    'yards': ['yards', 'yard', 'yd', 'cy', 'cubic yards'],
    'excavation': ['excavation', 'excavate', 'excavating', 'dig', 'remove', 'removed'],
    'removed': ['removed', 'excavation', 'excavate', 'dig', 'remove'],
    'area': ['area', 'square', 'sq', 'square feet', 'sf'],
    'square': ['square', 'area', 'sq', 'sf', 'square feet'],
    'linear': ['linear', 'length', 'lf', 'lineal', 'run'],
    'perimeter': ['perimeter', 'around', 'linear', 'length', 'total'],
  };

  const baseKeywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => {
      const cleaned = word.replace(/[^a-z0-9]/g, '');
      return cleaned.length > 2 && !stopWords.has(cleaned);
    });

  // Expand with synonyms
  const expandedKeywords = new Set<string>(baseKeywords);
  baseKeywords.forEach(keyword => {
    if (synonyms[keyword]) {
      synonyms[keyword].forEach(syn => expandedKeywords.add(syn));
    }
  });

  return Array.from(expandedKeywords);
}

/**
 * Calculate relevance score for a chunk with advanced matching
 */
function calculateRelevanceScore(
  content: string,
  keywords: string[],
  fullQuery: string,
  documentName: string
): number {
  const contentLower = content.toLowerCase();
  let score = 0;

  // PRIORITY BOOST: Plans.pdf should be prioritized for construction questions
  const isPlansDocument = documentName.toLowerCase().includes('plans.pdf');
  if (isPlansDocument) {
    score += 60; // Strong boost for Plans.pdf
  }

  // EXACT PHRASE MATCH: Highest priority
  if (contentLower.includes(fullQuery.toLowerCase())) {
    score += 150;
  }

  // COUNTING QUERY DETECTION: Boost content when user asks "how many"
  const isCountingQuery = /\b(how many|count|total|number of|quantity of)\b/i.test(fullQuery);
  if (isCountingQuery) {
    // Look for schedule/legend indicators in content
    const hasScheduleIndicators = /\b(schedule|legend|total|quantity|count|list of|table)\b/i.test(content);
    if (hasScheduleIndicators) {
      score += 100; // Major boost for schedule/legend content on counting questions
    }

    // Look for tabular data patterns (multiple lines with similar structure)
    const lines = content.split('\n');
    const hasTabularStructure = lines.filter(line => /\d+\s+\w+/.test(line)).length > 3;
    if (hasTabularStructure) {
      score += 60; // Boost for tabular data
    }
  }

  // MULTI-WORD PHRASE MATCHING: Detect common construction phrases
  const constructionPhrases = [
    { phrase: 'minimum depth', boost: 80 },
    { phrase: 'bottom of footing', boost: 80 },
    { phrase: 'bottom of footer', boost: 80 },
    { phrase: 'below grade', boost: 70 },
    { phrase: 'finished grade', boost: 70 },
    { phrase: 'exterior grade', boost: 70 },
    { phrase: 'interior grade', boost: 70 },
    { phrase: 'concrete strength', boost: 60 },
    { phrase: 'reinforcing steel', boost: 60 },
    { phrase: 'rebar spacing', boost: 60 },
    { phrase: 'foundation wall', boost: 60 },
    { phrase: 'slab on grade', boost: 60 },
    { phrase: 'structural steel', boost: 60 },
    { phrase: 'live load', boost: 50 },
    { phrase: 'dead load', boost: 50 },
    { phrase: 'wind load', boost: 50 },
    { phrase: 'seismic', boost: 50 },
    { phrase: 'bearing capacity', boost: 70 },
    { phrase: 'soil bearing', boost: 70 },
    { phrase: 'fire rating', boost: 50 },
    { phrase: 'exit width', boost: 50 },
    { phrase: 'occupancy', boost: 40 },

    // COUNTING & QUANTITY PHRASES (for "how many" questions)
    { phrase: 'fixture schedule', boost: 90 },
    { phrase: 'door schedule', boost: 90 },
    { phrase: 'window schedule', boost: 90 },
    { phrase: 'equipment schedule', boost: 90 },
    { phrase: 'symbol legend', boost: 85 },
    { phrase: 'legend', boost: 80 },
    { phrase: 'panel schedule', boost: 85 },
    { phrase: 'lighting schedule', boost: 85 },
    { phrase: 'receptacle schedule', boost: 85 },
    { phrase: 'finish schedule', boost: 80 },
    { phrase: 'total quantity', boost: 75 },
    { phrase: 'quantity', boost: 60 },
    { phrase: 'count', boost: 60 },
    { phrase: 'number of', boost: 60 },

    // DIMENSION & MEASUREMENT PHRASES
    { phrase: 'floor to ceiling', boost: 75 },
    { phrase: 'ceiling height', boost: 75 },
    { phrase: 'wall thickness', boost: 70 },
    { phrase: 'slab thickness', boost: 70 },
    { phrase: 'clear height', boost: 68 },
    { phrase: 'clear width', boost: 68 },
    { phrase: 'opening size', boost: 65 },
    { phrase: 'rough opening', boost: 65 },
    { phrase: 'on center', boost: 70 },
    { phrase: 'center to center', boost: 70 },

    // CONSTRUCTION METHOD PHRASES
    { phrase: 'construction detail', boost: 65 },
    { phrase: 'installation detail', boost: 65 },
    { phrase: 'connection detail', boost: 60 },
    { phrase: 'typical detail', boost: 58 },
    { phrase: 'cross section', boost: 60 },
    { phrase: 'wall section', boost: 60 },

    // MATERIAL & FINISH PHRASES
    { phrase: 'material specification', boost: 65 },
    { phrase: 'finish specification', boost: 65 },
    { phrase: 'paint finish', boost: 55 },
    { phrase: 'floor finish', boost: 55 },
    { phrase: 'wall finish', boost: 55 },
    { phrase: 'ceiling finish', boost: 55 },

    // VISUAL INTELLIGENCE PHRASES (enhanced extraction)
    { phrase: 'visual materials', boost: 70 },
    { phrase: 'hatching pattern', boost: 65 },
    { phrase: 'plumbing fixtures', boost: 80 },
    { phrase: 'electrical devices', boost: 80 },
    { phrase: 'spatial data', boost: 70 },
    { phrase: 'spot elevation', boost: 75 },
    { phrase: 'floor-to-floor', boost: 75 },
    { phrase: 'fire rated', boost: 70 },
    { phrase: 'trades required', boost: 65 },
    { phrase: 'demolition elements', boost: 70 },
    { phrase: 'new construction', boost: 60 },
    { phrase: 'revision cloud', boost: 65 },
    { phrase: 'section cut', boost: 60 },
    { phrase: 'match line', boost: 60 },
    { phrase: 'duct size', boost: 65 },
    { phrase: 'sprinkler head', boost: 70 },
    { phrase: 'fire damper', boost: 70 },
    { phrase: 'footing schedule', boost: 80 },
    { phrase: 'rebar schedule', boost: 80 },
    { phrase: 'concrete mix', boost: 65 },
    { phrase: 'pipe size', boost: 65 },
    { phrase: 'conduit size', boost: 65 },
    { phrase: 'diffuser', boost: 60 },
    { phrase: 'water closet', boost: 60 },
    { phrase: 'lavatory', boost: 55 },
    { phrase: 'floor drain', boost: 55 },
  ];

  for (const { phrase, boost } of constructionPhrases) {
    if (contentLower.includes(phrase)) {
      score += boost;
    }
  }

  // ENHANCED MEASUREMENT DETECTION: Significantly boost content with dimensions/measurements
  // More comprehensive patterns with weighted scoring
  const measurementPatterns = [
    { pattern: /\d+["']\s*-?\s*\d*["']?/g, weight: 22 },                    // 24", 2'-0", 1'-6"
    { pattern: /\d+\/\d+\s*["']?/g, weight: 18 },                           // 3/4", 1/2"
    { pattern: /#\d+/g, weight: 20 },                                       // #4, #5 (rebar sizes)
    { pattern: /\d+\s*(?:inch|inches)\b/gi, weight: 22 },                   // 12 inches
    { pattern: /\d+\s*(?:foot|feet|ft)\b/gi, weight: 22 },                  // 2 feet, 10 ft
    { pattern: /\d+\s*psf\b/gi, weight: 25 },                               // pounds per square foot
    { pattern: /\d+\s*psi\b/gi, weight: 25 },                               // pounds per square inch (concrete)
    { pattern: /\d+\s*kips?\b/gi, weight: 24 },                             // structural loads
    { pattern: /\d+\s*lbs?\b/gi, weight: 18 },                              // pounds
    { pattern: /\d+\s*sf\b/gi, weight: 18 },                                // square feet
    { pattern: /\d+\s*cf\b/gi, weight: 18 },                                // cubic feet
    { pattern: /\d+\s*lf\b/gi, weight: 18 },                                // linear feet
    { pattern: /\d+\s*mph\b/gi, weight: 18 },                               // wind speed
    { pattern: /\d+\s*degrees?\b/gi, weight: 15 },                          // angles/temperature
    { pattern: /\d+\s*gauge\b/gi, weight: 18 },                             // material gauge
    { pattern: /\d+\s*@\s*\d+/gi, weight: 30 },                             // spacing (e.g., #4 @ 12" O.C.)
    { pattern: /\bo\.?c\.?\b/gi, weight: 25 },                              // on center spacing
    { pattern: /\d+\s*min\.?/gi, weight: 28 },                              // minimum measurements
    { pattern: /\d+\s*max\.?/gi, weight: 28 },                              // maximum measurements
    { pattern: /\d+\s*below/gi, weight: 26 },                               // depth below (e.g., 24" below)
    { pattern: /\d+\s*above/gi, weight: 22 },                               // height above
    { pattern: /\d+\s*thick/gi, weight: 24 },                               // thickness
    { pattern: /\d+\s*wide/gi, weight: 22 },                                // width
    { pattern: /\d+\s*high/gi, weight: 22 },                                // height
    { pattern: /\d+\s*deep/gi, weight: 24 },                                // depth
    { pattern: /\d+\s*dia\.?/gi, weight: 22 },                              // diameter
  ];

  let totalMeasurementScore = 0;
  let _measurementCount = 0;
  for (const { pattern, weight } of measurementPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      _measurementCount += matches.length;
      totalMeasurementScore += matches.length * weight;
    }
  }

  if (totalMeasurementScore > 0) {
    score += Math.min(150, totalMeasurementScore); // Increased cap from 100 to 150 points
  }

  // KEYWORD PROXIMITY ANALYSIS: Keywords appearing near each other are more relevant
  if (keywords.length >= 2) {
    const proximityBoost = calculateProximityScore(contentLower, keywords);
    score += proximityBoost;
  }

  // INDIVIDUAL KEYWORD MATCHES with context
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = contentLower.match(regex);
    if (matches) {
      score += matches.length * 12;
    }
  }

  // DOMAIN-SPECIFIC TERM BOOSTING (refined list)
  const domainTerms: Record<string, number> = {
    // High priority structural/foundation terms
    'footing': 25, 'footer': 25, 'foundation': 25, 'subgrade': 25,
    'excavation': 20, 'bearing': 20, 'soil': 18,

    // Medium priority construction terms
    'structural': 15, 'reinforcement': 15, 'rebar': 15, 'concrete': 15,
    'steel': 12, 'framing': 12, 'beam': 12, 'column': 12,

    // Specification terms
    'specification': 12, 'requirement': 12, 'code': 12, 'standard': 12,
    'detail': 10, 'note': 10, 'dimension': 10,

    // Building systems
    'mechanical': 10, 'electrical': 10, 'plumbing': 10, 'hvac': 10,
    'fire': 10, 'sprinkler': 10, 'alarm': 10,

    // Project management
    'schedules': 8, 'budget': 8, 'cost': 8, 'timeline': 8,
    'milestone': 8, 'phase': 8, 'contractor': 8,

    // Counting & Fixture terms (for "how many" questions)
    'receptacle': 20, 'receptacles': 20, 'outlet': 20, 'outlets': 20,
    'fixture': 18, 'fixtures': 18, 'light': 18, 'lights': 18,
    'door': 15, 'doors': 15, 'window': 15, 'windows': 15,
    'panel': 15, 'panels': 15, 'equipment': 15,
    'legend': 22, 'symbol': 18, 'quantity': 18, 'total': 15,
    'count': 15, 'number': 12,
  };

  for (const [term, termBoost] of Object.entries(domainTerms)) {
    if (keywords.includes(term) && contentLower.includes(term)) {
      score += termBoost;
    }
  }

  // SHEET NUMBER BOOST: Content with sheet references is authoritative
  const sheetNumberPattern = /[A-Z]-\d{3}/gi;
  const sheetMatches = content.match(sheetNumberPattern);
  if (sheetMatches && sheetMatches.length > 0) {
    score += 40 * sheetMatches.length;

    // DISCIPLINE-SPECIFIC BOOSTS
    const disciplineBoosts: Record<string, number> = {
      'S-': 70,  // Structural (foundations, footings, beams)
      'A-': 50,  // Architectural (walls, doors, finishes)
      'M-': 45,  // Mechanical
      'P-': 45,  // Plumbing
      'E-': 40,  // Electrical
      'C-': 40,  // Civil
      'L-': 30,  // Landscape
    };

    for (const sheet of sheetMatches) {
      const discipline = sheet.substring(0, 2).toUpperCase();
      const boost = disciplineBoosts[discipline];
      if (boost) {
        score += boost;
      }
    }
  }

  // CONSTRUCTION NOTES/SPECIFICATIONS BOOST - SIGNIFICANTLY INCREASED
  const specPatterns = [
    // NOTES SECTIONS (CRITICAL - MAJOR BOOST)
    { pattern: /GENERAL\s+NOTES?/gi, boost: 85 },
    { pattern: /STRUCTURAL\s+NOTES?/gi, boost: 90 },
    { pattern: /ARCHITECTURAL\s+NOTES?/gi, boost: 80 },
    { pattern: /MECHANICAL\s+NOTES?/gi, boost: 75 },
    { pattern: /ELECTRICAL\s+NOTES?/gi, boost: 75 },
    { pattern: /PLUMBING\s+NOTES?/gi, boost: 75 },
    { pattern: /DETAIL\s+NOTES?/gi, boost: 70 },
    { pattern: /CONSTRUCTION\s+NOTES?/gi, boost: 80 },
    { pattern: /\bNOTES?:/gi, boost: 60 },

    // SPECIFICATION LANGUAGE
    { pattern: /MINIMUM\s+\w+/gi, boost: 45 },
    { pattern: /MAXIMUM\s+\w+/gi, boost: 45 },
    { pattern: /SHALL\s+BE/gi, boost: 35 },
    { pattern: /SHALL\s+NOT/gi, boost: 35 },
    { pattern: /REQUIRED/gi, boost: 30 },
    { pattern: /AS\s+SHOWN/gi, boost: 25 },
    { pattern: /AS\s+NOTED/gi, boost: 25 },
    { pattern: /SEE\s+DETAIL/gi, boost: 25 },
    { pattern: /REFER\s+TO/gi, boost: 20 },
    { pattern: /TYPICAL/gi, boost: 20 },
    { pattern: /UNLESS\s+OTHERWISE/gi, boost: 25 },

    // SCHEDULE & LEGEND PATTERNS (for counting questions)
    { pattern: /\bDOOR\s+SCHEDULE\b/gi, boost: 95 },
    { pattern: /\bWINDOW\s+SCHEDULE\b/gi, boost: 95 },
    { pattern: /\bFIXTURE\s+SCHEDULE\b/gi, boost: 95 },
    { pattern: /\bEQUIPMENT\s+SCHEDULE\b/gi, boost: 90 },
    { pattern: /\bPANEL\s+SCHEDULE\b/gi, boost: 90 },
    { pattern: /\bLIGHTING\s+SCHEDULE\b/gi, boost: 90 },
    { pattern: /\bRECEPTACLE\s+SCHEDULE\b/gi, boost: 90 },
    { pattern: /\bFINISH\s+SCHEDULE\b/gi, boost: 85 },
    { pattern: /\bSCHEDULE\b/gi, boost: 65 },
    { pattern: /\bLEGEND\b/gi, boost: 65 },
    { pattern: /\bSYMBOL\s+KEY\b/gi, boost: 60 },
    { pattern: /\bEQUIPMENT\s+LIST\b/gi, boost: 60 },
    { pattern: /\bTOTAL\s*[:=]/gi, boost: 55 },
    { pattern: /\bQUANTITY\s*[:=]/gi, boost: 55 },
    { pattern: /\bQTY\s*[:=]/gi, boost: 50 },
    { pattern: /\bCOUNT\s*[:=]/gi, boost: 50 },
    { pattern: /\bNO\.\s+OF\b/gi, boost: 50 },
  ];

  for (const { pattern, boost } of specPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      score += boost * Math.min(matches.length, 3); // Cap per pattern
    }
  }

  // UPPERCASE CONTENT BOOST: All-caps sections are usually critical specs
  const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (uppercaseRatio > 0.4) {
    score += 30; // This chunk likely contains important specifications
  }

  return score;
}

/**
 * Calculate proximity score for keywords appearing near each other
 */
function calculateProximityScore(content: string, keywords: string[]): number {
  let proximityScore = 0;
  const words = content.split(/\s+/);

  // For each pair of keywords, check if they appear within 10 words of each other
  for (let i = 0; i < keywords.length; i++) {
    for (let j = i + 1; j < keywords.length; j++) {
      const keyword1 = keywords[i];
      const keyword2 = keywords[j];

      // Find positions of both keywords
      const positions1: number[] = [];
      const positions2: number[] = [];

      words.forEach((word, index) => {
        if (word.includes(keyword1)) positions1.push(index);
        if (word.includes(keyword2)) positions2.push(index);
      });

      // Check for proximity
      for (const pos1 of positions1) {
        for (const pos2 of positions2) {
          const distance = Math.abs(pos1 - pos2);
          if (distance <= 10) {
            // Closer words get higher scores
            proximityScore += Math.max(0, 30 - distance * 2);
          }
        }
      }
    }
  }

  return proximityScore;
}

/**
 * Generate context prompt from retrieved chunks
 */
export function generateContextPrompt(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) {
    return 'No specific document context available. Provide general construction industry guidance.';
  }

  let prompt = 'Based on the following project documents:\n\n';

  for (const chunk of chunks) {
    const docName = chunk.metadata?.documentName || 'Unknown Document';
    const pageRef = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';

    // Extract sheet numbers from content if this is Plans.pdf
    const isPlans = docName.toLowerCase().includes('plans.pdf');
    const sheetNumbers = isPlans ? extractSheetNumbers(chunk.content) : [];
    const sheetRef = sheetNumbers.length > 0 ? ` [Sheets: ${sheetNumbers.join(', ')}]` : '';

    prompt += `[${docName}${pageRef}${sheetRef}]\n${chunk.content}\n\n`;
  }

  prompt += 'IMPORTANT: When providing information from Plans.pdf, ALWAYS cite the sheet number (e.g., A-001, S-002) along with the page number. Format: "(Plans.pdf, Sheet A-001, Page X)". For other documents, cite as "(Document Name, Page X)".\n\n';
  prompt += 'Use this project-specific information to answer the question accurately. If the information is not in the provided context, say so and provide general guidance.';

  return prompt;
}

/**
 * Extract sheet numbers from content (A-001, M-001, etc.)
 */
export function extractSheetNumbers(content: string): string[] {
  const sheetPattern = /[A-Z]-\d{3}/g;
  const matches = content.match(sheetPattern);
  return matches ? [...new Set(matches)] : []; // Return unique sheet numbers
}
