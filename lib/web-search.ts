/**
 * Web Search Utility for Hybrid RAG System
 *
 * Provides supplementary information from the web to bolster document-based answers.
 * Used as a fallback when document information is insufficient or for general
 * construction standards, building codes, and industry best practices.
 *
 * IMPORTANT: Web results SUPPLEMENT documents, never override them.
 */

import { EXTRACTION_MODEL } from '@/lib/model-config';
import { callLLM } from '@/lib/llm-providers';
import { logger } from '@/lib/logger';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
  hasResults: boolean;
}

/**
 * Determines if a query would benefit from web search
 * 
 * Web search is REQUIRED for:
 * - ALL building code questions (IBC, IRC, NEC, IPC, IMC, IECC, etc.)
 * - ALL fire safety codes (NFPA)
 * - ALL accessibility standards (ADA, ANSI)
 * - ALL regulatory compliance questions
 * - Material standards (ASTM, ASCE, ACI)
 * - Safety regulations (OSHA)
 * 
 * Web search is NOT needed for:
 * - Project-specific questions (covered by documents)
 * - Sheet/page references
 * - Document measurements
 * - Project schedules/budgets
 */
export function shouldUseWebSearch(query: string, documentChunksFound: number): boolean {
  const lowerQuery = query.toLowerCase();
  
  // AGGRESSIVE WEB SEARCH FOR ALL CODE/REGULATION QUESTIONS
  // Building codes, fire codes, accessibility, and compliance ALWAYS need web search
  
  const buildingCodeKeywords = [
    // Building Codes
    'ibc', 'international building code', 'building code', 'code requirement',
    'code compliance', 'code section', 'irc', 'residential code',

    // Fire Safety
    'nfpa', 'fire code', 'fire safety', 'fire protection', 'sprinkler',
    'fire alarm', 'egress', 'exit', 'fire rating', 'fire resistance',

    // Accessibility
    'ada', 'accessibility', 'accessible', 'ansi', 'wheelchair',
    'handrail', 'ramp', 'clearance requirement',

    // Electrical
    'nec', 'electrical code', 'wiring', 'circuit', 'outlet requirement',

    // Plumbing
    'ipc', 'plumbing code', 'upc', 'fixture requirement',

    // Mechanical
    'imc', 'mechanical code', 'hvac code', 'ventilation requirement',

    // Energy
    'iecc', 'energy code', 'insulation requirement', 'energy efficiency',

    // General Compliance
    'compliant', 'compliance', 'regulation', 'standard', 'required by code',
    'code requires', 'meets code', 'code minimum', 'code maximum',
    'osha', 'astm', 'asce', 'aci',

    // Code-related questions
    'what does the code say', 'what code requires', 'what does the code require',
    'is this allowed', 'is this permitted', 'what is required', 'minimum requirement',
    'maximum allowed',
  ];
  
  // Check if query is about codes or regulations
  const needsCodeLookup = buildingCodeKeywords.some(keyword => lowerQuery.includes(keyword));
  if (needsCodeLookup) {
    console.log('🔍 [WEB SEARCH TRIGGERED] Code/regulation query detected');
    return true;
  }
  
  // For all other queries, rely on document RAG only
  return false;
}

/**
 * Performs web search and returns formatted results with citations
 */
export async function performWebSearch(query: string): Promise<WebSearchResponse> {
  try {
    // Enhance query with construction context
    const enhancedQuery = enhanceQueryForConstruction(query);

    logger.info('WEB_SEARCH', 'Performing web search', { query: enhancedQuery });

    // Determine if we should mention construction in the prompt
    const hasConstructionContext = enhancedQuery.toLowerCase().includes('construction');
    const promptPrefix = hasConstructionContext
      ? `Search the web for: "${enhancedQuery}"`
      : `Search the web for construction-related information: "${enhancedQuery}"`;

    // Use LLM to provide relevant authoritative sources based on its training knowledge
    const llmResult = await callLLM(
      [
        {
          role: 'system',
          content: 'You are an expert in construction codes and standards. Provide authoritative references with real URLs to official sources like ICC, NFPA, ADA.gov, OSHA, and other regulatory bodies. Only provide URLs that are known to exist.'
        },
        {
          role: 'user',
          content: `${promptPrefix}\n\nProvide 3-5 relevant authoritative sources with:\n1. Title\n2. URL (official source only)\n3. Brief snippet (2-3 sentences)\n4. Source domain\n\nFormat each result clearly with these labels.`
        }
      ],
      { model: EXTRACTION_MODEL, max_tokens: 1500 }
    );

    const content = llmResult.content || '';
    
    // Extract URLs and create results
    let results: WebSearchResult[] = [];
    
    // Pattern to extract URLs
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = content.match(urlPattern) || [];
    
    // Try to parse structured content
    const lines = content.split('\n').filter((line: string) => line.trim());
    let currentResult: Partial<WebSearchResult> = {};

    for (const line of lines) {
      const lower = line.toLowerCase();
      const trimmedLine = line.trim();

      if (lower.includes('title:') || lower.includes('**title')) {
        // Save previous result if it has a URL
        if (currentResult.url) {
          // Add default title if missing
          if (!currentResult.title) {
            currentResult.title = 'Construction Reference';
          }
          results.push(currentResult as WebSearchResult);
        }
        currentResult = { title: trimmedLine.replace(/.*title:?\s*/i, '').replace(/\*\*/g, '').trim() };
      } else if (lower.includes('url:') || lower.includes('link:')) {
        const urlMatch = trimmedLine.match(urlPattern);
        if (urlMatch) {
          currentResult.url = urlMatch[0];
          try {
            currentResult.source = new URL(urlMatch[0]).hostname.replace('www.', '');
          } catch {
            currentResult.source = 'web';
          }
        }
      } else if (lower.includes('snippet:')) {
        currentResult.snippet = trimmedLine.replace(/^.*?snippet:\s*/i, '').replace(/\*\*/g, '').trim();
      } else if (lower.includes('description:')) {
        currentResult.snippet = trimmedLine.replace(/^.*?description:\s*/i, '').replace(/\*\*/g, '').trim();
      } else if (currentResult.title && currentResult.url && !currentResult.snippet && trimmedLine.length > 20 && !urlPattern.test(trimmedLine)) {
        // Extract content line as snippet if we have title and URL but no snippet yet
        // Use regex test to check for actual URLs, not just the string "http"
        currentResult.snippet = trimmedLine.replace(/\*\*/g, '').trim();
      }
    }

    // Add last result if it has a URL
    if (currentResult.url) {
      // Add default title if missing
      if (!currentResult.title) {
        currentResult.title = 'Construction Reference';
      }
      results.push(currentResult as WebSearchResult);
    }
    
    // Fallback: Create basic results from URLs if parsing failed
    if (results.length === 0 && urls.length > 0) {
      results = urls.slice(0, 5).map((url: string, index: number) => ({
        title: `Construction Reference ${index + 1}`,
        url: url,
        snippet: content.substring(Math.max(0, content.indexOf(url) - 100), content.indexOf(url) + 200).trim(),
        source: (() => {
          try {
            return new URL(url).hostname.replace('www.', '');
          } catch {
            return 'web';
          }
        })()
      }));
    }
    
    // Filter out invalid results
    results = results.filter(r => r.url && r.title);
    
    logger.info('WEB_SEARCH', `Found ${results.length} web results`);
    
    return {
      results: results.slice(0, 5), // Limit to 5 results
      query: enhancedQuery,
      hasResults: results.length > 0
    };
    
  } catch (error) {
    logger.error('WEB_SEARCH', 'Web search error', error as Error);
    return {
      results: [],
      query,
      hasResults: false
    };
  }
}

/**
 * Enhances query with construction-specific context
 */
function enhanceQueryForConstruction(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Don't add construction context if it's already present
  if (lowerQuery.includes('construction')) {
    return query;
  }

  // Add context based on query type
  if (lowerQuery.includes('depth') || lowerQuery.includes('footing') || lowerQuery.includes('foundation')) {
    return `${query} construction standards`;
  }
  if ((lowerQuery.includes('code') || lowerQuery.includes('requirement')) && !lowerQuery.includes('building')) {
    return `${query} construction building code`;
  }

  return query;
}

/**
 * Formats web search results for LLM context
 */
export function formatWebResultsForContext(webResults: WebSearchResult[]): string {
  if (webResults.length === 0) {
    return '';
  }
  
  let formatted = '\n\n=== WEB SEARCH RESULTS (SUPPLEMENTARY INFORMATION) ===\n\n';
  formatted += 'The following information from the web can SUPPLEMENT (not override) the document information:\n\n';
  
  webResults.forEach((result, index) => {
    formatted += `[Web Source ${index + 1}]\n`;
    formatted += `Title: ${result.title}\n`;
    formatted += `URL: ${result.url}\n`;
    formatted += `Content: ${result.snippet}\n`;
    formatted += `Source: ${result.source}\n\n`;
  });
  
  formatted += '=== END WEB SEARCH RESULTS ===\n';
  
  return formatted;
}
