/**
 * AI-Powered Document Categorization Service
 * Analyzes document metadata (filename, content preview, file type) to suggest appropriate categories
 */

type DocumentCategory = string;

// Category display names and descriptions
// Keys must match Prisma DocumentCategory enum in schema.prisma
export const CATEGORY_INFO: Record<DocumentCategory, { label: string; description: string; keywords: string[] }> = {
  budget_cost: {
    label: 'Budget & Cost',
    description: 'Budget files, cost estimates, pricing sheets, invoices',
    keywords: ['budget', 'cost', 'estimate', 'pricing', 'invoice', 'payment', 'bid', 'quote', 'financial', 'expense']
  },
  schedule: {
    label: 'Schedule',
    description: 'Gantt charts, timelines, critical path, project schedules',
    keywords: ['schedule', 'timeline', 'gantt', 'critical path', 'milestone', 'deadline', 'calendar', 'duration', 'phase']
  },
  plans_drawings: {
    label: 'Plans & Drawings',
    description: 'Architectural, structural, MEP drawings and plans',
    keywords: ['plan', 'drawing', 'blueprint', 'architectural', 'structural', 'mep', 'electrical', 'plumbing', 'hvac', 'elevation', 'section', 'detail', 'site plan', 'floor plan', 'conformance']
  },
  specifications: {
    label: 'Specifications',
    description: 'Technical specifications, product datasheets, material specs',
    keywords: ['spec', 'specification', 'datasheet', 'technical', 'material', 'product', 'standard', 'requirement']
  },
  contracts: {
    label: 'Contracts',
    description: 'Contracts, change orders, RFIs, legal documents',
    keywords: ['contract', 'agreement', 'rfi', 'change order', 'submittal', 'legal', 'proposal', 'addendum', 'amendment']
  },
  daily_reports: {
    label: 'Daily Reports',
    description: 'Daily logs, inspection reports, progress reports',
    keywords: ['daily', 'log', 'report', 'inspection', 'progress', 'status', 'field', 'observation']
  },
  photos: {
    label: 'Photos',
    description: 'Progress photos, site photos, documentation images',
    keywords: ['photo', 'image', 'picture', 'jpg', 'jpeg', 'png', 'site photo', 'progress photo']
  },
  other: {
    label: 'Other',
    description: 'Miscellaneous documents that don\'t fit other categories',
    keywords: []
  }
};

/**
 * Analyzes a document and suggests a category using LLM API
 */
export async function suggestDocumentCategory(
  fileName: string,
  fileType: string,
  contentPreview?: string
): Promise<{
  suggestedCategory: DocumentCategory;
  confidence: number;
  reasoning: string;
}> {
  // First try simple keyword matching for common patterns
  const keywordMatch = matchCategoryByKeywords(fileName, fileType);
  if (keywordMatch.confidence >= 0.8) {
    return keywordMatch;
  }

  // Use LLM for more complex analysis
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Updated from deprecated gpt-3.5-turbo (Jan 2026)
        messages: [
          {
            role: 'system',
            content: `You are a construction document classifier. Analyze the document and suggest ONE of these categories:
- budget_cost: Budget files, cost estimates, invoices
- schedule: Gantt charts, timelines, project schedules
- plans_drawings: Architectural/structural/MEP drawings and plans
- specifications: Technical specs, product datasheets
- contracts: Contracts, change orders, RFIs, legal documents
- daily_reports: Daily reports, inspection reports, progress reports
- photos: Progress photos, site documentation images
- other: Miscellaneous documents

Respond with ONLY a JSON object: {"category": "<category>", "confidence": 0.0-1.0, "reasoning": "<brief explanation>"}`
          },
          {
            role: 'user',
            content: `Classify this document:
Filename: ${fileName}
File type: ${fileType}${contentPreview ? `\nContent preview: ${contentPreview.substring(0, 500)}` : ''}`
          }
        ],
        temperature: 0.1,
        max_tokens: 150
      }),
    });

    if (!response.ok) {
      console.error('LLM API error:', response.status);
      return keywordMatch; // Fallback to keyword match
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse JSON response
    // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
    let contentToParse = content;
    const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      contentToParse = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(contentToParse);
    
    return {
      suggestedCategory: parsed.category as DocumentCategory,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning
    };
  } catch (error) {
    console.error('Error in AI categorization:', error);
    return keywordMatch; // Fallback to keyword match
  }
}

/**
 * Simple keyword-based category matching (fast, no API calls)
 */
function matchCategoryByKeywords(
  fileName: string,
  fileType: string
): {
  suggestedCategory: DocumentCategory;
  confidence: number;
  reasoning: string;
} {
  const lowerFileName = fileName.toLowerCase();
  const lowerFileType = fileType.toLowerCase();

  // Check image file types for photos
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'heic'].includes(lowerFileType)) {
    return {
      suggestedCategory: 'photos',
      confidence: 0.95,
      reasoning: 'Image file type detected'
    };
  }

  // Check each category's keywords
  for (const [category, info] of Object.entries(CATEGORY_INFO)) {
    if (category === 'other') continue;

    for (const keyword of info.keywords) {
      if (lowerFileName.includes(keyword)) {
        return {
          suggestedCategory: category as DocumentCategory,
          confidence: 0.85,
          reasoning: `Filename contains "${keyword}"`
        };
      }
    }
  }

  // Default to "other" if no match
  return {
    suggestedCategory: 'other',
    confidence: 0.5,
    reasoning: 'No clear category indicators found'
  };
}

/**
 * Get category label for display
 */
export function getCategoryLabel(category: DocumentCategory): string {
  return CATEGORY_INFO[category].label;
}

/**
 * Get category description
 */
export function getCategoryDescription(category: DocumentCategory): string {
  return CATEGORY_INFO[category].description;
}

/**
 * Get all available categories for dropdown
 */
export function getAllCategories(): Array<{ value: DocumentCategory; label: string; description: string }> {
  return Object.entries(CATEGORY_INFO).map(([value, info]) => ({
    value: value as DocumentCategory,
    label: info.label,
    description: info.description
  }));
}
