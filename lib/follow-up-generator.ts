/**
 * Follow-up Suggestions Generator
 * 
 * Generates contextual follow-up questions based on the user's query,
 * AI response, and document context.
 */

import { callAbacusLLM } from './abacus-llm';
import { logger } from './logger';

interface GenerateFollowUpParams {
  userQuery: string;
  aiResponse: string;
  documentContext?: string;
  projectType?: string;
}

// Pre-defined follow-up templates by query type
const FOLLOW_UP_TEMPLATES: Record<string, string[]> = {
  schedule: [
    "What tasks are on the critical path?",
    "Are there any schedule delays to be aware of?",
    "What's the float on non-critical tasks?",
    "Who is assigned to these tasks?"
  ],
  budget: [
    "What's the cost breakdown by phase?",
    "Are we tracking to budget?",
    "What are the largest cost items?",
    "Show change orders impact on budget"
  ],
  dimensions: [
    "What are the structural specifications?",
    "Are there any similar dimensions elsewhere?",
    "What materials are specified?",
    "Show me the related details"
  ],
  materials: [
    "What's the total quantity needed?",
    "Are there alternative materials specified?",
    "What's the installation method?",
    "Show material specifications"
  ],
  mep: [
    "Show the routing path",
    "What equipment is connected?",
    "Are there any conflicts to resolve?",
    "What are the load requirements?"
  ],
  general: [
    "Can you show me the related drawings?",
    "What else should I know about this?",
    "Are there any related specifications?",
    "What's the timeline for this?"
  ]
};

/**
 * Detect query type for template selection
 */
function detectQueryType(query: string): string {
  const q = query.toLowerCase();
  
  if (q.includes('schedule') || q.includes('timeline') || q.includes('when') || q.includes('deadline')) {
    return 'schedule';
  }
  if (q.includes('budget') || q.includes('cost') || q.includes('price') || q.includes('expense')) {
    return 'budget';
  }
  if (q.includes('dimension') || q.includes('size') || q.includes('height') || q.includes('width') || q.includes('depth')) {
    return 'dimensions';
  }
  if (q.includes('material') || q.includes('concrete') || q.includes('steel') || q.includes('lumber')) {
    return 'materials';
  }
  if (q.includes('electrical') || q.includes('plumbing') || q.includes('hvac') || q.includes('mechanical') || q.includes('mep')) {
    return 'mep';
  }
  
  return 'general';
}

/**
 * Generate follow-up suggestions using AI
 */
export async function generateFollowUpSuggestions({
  userQuery,
  aiResponse,
  documentContext,
  projectType = 'construction'
}: GenerateFollowUpParams): Promise<string[]> {
  try {
    // Quick path: Use templates if response is short or simple
    const queryType = detectQueryType(userQuery);
    const templates = FOLLOW_UP_TEMPLATES[queryType] || FOLLOW_UP_TEMPLATES.general;
    
    // For simple queries, just return templates
    if (aiResponse.length < 200 || !documentContext) {
      return templates.slice(0, 3);
    }
    
    // For complex queries, use AI to generate contextual suggestions
    const prompt = `You are a construction project assistant. Based on the following conversation, generate 3 highly relevant follow-up questions the user might want to ask next.

User's Question: ${userQuery}

Assistant's Response (summary): ${aiResponse.slice(0, 500)}...

Rules:
1. Questions should be specific and actionable
2. Questions should help the user dig deeper or explore related topics
3. Keep questions concise (under 60 characters each)
4. Focus on construction-relevant follow-ups
5. Don't repeat information already provided

Return ONLY the 3 questions, one per line, no numbering or bullets.`;

    const response = await callAbacusLLM([
      { role: 'user', content: prompt }
    ], {
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0.7
    });

    if (response && response.content) {
      const suggestions = response.content
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 80 && !s.startsWith('-') && !s.match(/^\d/))
        .slice(0, 3);
      
      if (suggestions.length >= 2) {
        return suggestions;
      }
    }
    
    // Fallback to templates
    return templates.slice(0, 3);
  } catch (error) {
    logger.error('FOLLOW_UP', 'Error generating suggestions', error as Error);
    // Return template suggestions on error
    const queryType = detectQueryType(userQuery);
    return (FOLLOW_UP_TEMPLATES[queryType] || FOLLOW_UP_TEMPLATES.general).slice(0, 3);
  }
}

/**
 * Quick follow-up generator (template-based, no AI call)
 */
export function getQuickFollowUps(userQuery: string): string[] {
  const queryType = detectQueryType(userQuery);
  return (FOLLOW_UP_TEMPLATES[queryType] || FOLLOW_UP_TEMPLATES.general).slice(0, 3);
}
