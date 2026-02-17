/**
 * Subcontractor Quote Analysis Service
 * Uses AI to extract budget and scope data from uploaded quotes
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getFileUrl } from '@/lib/s3';
import OpenAI from 'openai';

const openai = new OpenAI();

interface ExtractedLineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice: number;
  category?: string;
  csiCode?: string;
}

interface ExtractedQuoteData {
  companyName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  quoteNumber?: string;
  quoteDate?: string;
  expirationDate?: string;
  tradeType?: string;
  
  // Financial breakdown
  totalAmount: number;
  laborCost?: number;
  materialCost?: number;
  equipmentCost?: number;
  overheadMarkup?: number;
  contingency?: number;
  taxAmount?: number;
  
  // Scope
  scopeDescription?: string;
  lineItems: ExtractedLineItem[];
  inclusions: string[];
  exclusions: string[];
  assumptions: string[];
  
  // Payment terms
  paymentTerms?: string;
  retainage?: number;
  
  // Confidence
  confidence: number;
  analysisNotes: string;
}

const TRADE_TYPE_MAP: Record<string, string> = {
  'electrical': 'electrical',
  'electric': 'electrical',
  'plumbing': 'plumbing',
  'plumber': 'plumbing',
  'hvac': 'hvac_mechanical',
  'mechanical': 'hvac_mechanical',
  'heating': 'hvac_mechanical',
  'air conditioning': 'hvac_mechanical',
  'concrete': 'concrete_masonry',
  'masonry': 'concrete_masonry',
  'brick': 'concrete_masonry',
  'carpentry': 'carpentry_framing',
  'framing': 'carpentry_framing',
  'drywall': 'drywall_finishes',
  'painting': 'painting_coating',
  'roofing': 'roofing',
  'steel': 'structural_steel',
  'structural': 'structural_steel',
  'glazing': 'glazing_windows',
  'windows': 'glazing_windows',
  'flooring': 'flooring',
  'tile': 'flooring',
  'site': 'site_utilities',
  'excavation': 'site_utilities',
  'utilities': 'site_utilities',
  'general': 'general_contractor',
};

function inferTradeType(text: string): string | undefined {
  const lowerText = text.toLowerCase();
  for (const [keyword, trade] of Object.entries(TRADE_TYPE_MAP)) {
    if (lowerText.includes(keyword)) {
      return trade;
    }
  }
  return undefined;
}

/**
 * Fetch PDF content and convert to base64 for AI analysis
 */
async function fetchPDFAsBase64(cloudStoragePath: string): Promise<string | null> {
  try {
    const fileUrl = await getFileUrl(cloudStoragePath, false);
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Failed to fetch PDF');
    
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  } catch (error) {
    logger.error('QUOTE_ANALYSIS', 'Error fetching PDF', error as Error);
    return null;
  }
}

/**
 * Analyze a subcontractor quote PDF using AI
 */
export async function analyzeQuotePDF(
  cloudStoragePath: string,
  fileName: string
): Promise<ExtractedQuoteData | null> {
  try {
    logger.info('QUOTE_ANALYSIS', `Analyzing quote`, { fileName });
    
    // Fetch PDF as base64
    const pdfBase64 = await fetchPDFAsBase64(cloudStoragePath);
    if (!pdfBase64) {
      return null;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a construction cost estimator. Analyze this subcontractor quote/bid document and extract the following information in JSON format:

{
  "companyName": "Name of the subcontractor company",
  "contactName": "Contact person name if available",
  "contactEmail": "Email address if available",
  "contactPhone": "Phone number if available",
  "quoteNumber": "Quote/Bid number if available",
  "quoteDate": "Quote date in YYYY-MM-DD format",
  "expirationDate": "Expiration date in YYYY-MM-DD format if available",
  "tradeType": "One of: electrical, plumbing, hvac_mechanical, concrete_masonry, carpentry_framing, drywall_finishes, painting_coating, roofing, structural_steel, glazing_windows, flooring, site_utilities, general_contractor",
  
  "totalAmount": 0.00,
  "laborCost": 0.00,
  "materialCost": 0.00,
  "equipmentCost": 0.00,
  "overheadMarkup": 0.00,
  "contingency": 0.00,
  "taxAmount": 0.00,
  
  "scopeDescription": "Brief description of the scope of work",
  "lineItems": [
    {
      "description": "Line item description",
      "quantity": 0,
      "unit": "EA/SF/LF/etc",
      "unitPrice": 0.00,
      "totalPrice": 0.00,
      "category": "Labor/Material/Equipment",
      "csiCode": "CSI Division code if identifiable"
    }
  ],
  "inclusions": ["List of what is included in the quote"],
  "exclusions": ["List of what is NOT included"],
  "assumptions": ["List of assumptions made"],
  
  "paymentTerms": "Payment terms if specified",
  "retainage": 0,
  
  "confidence": 0.0-1.0,
  "analysisNotes": "Any notes about data quality or uncertainty"
}

Be accurate with numbers. If a value is not found, use null. Extract as many line items as possible. The confidence score should reflect how much data you could extract accurately.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.error('QUOTE_ANALYSIS', 'No response content');
      return null;
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('QUOTE_ANALYSIS', 'Could not find JSON in response');
      return null;
    }

    const extracted: ExtractedQuoteData = JSON.parse(jsonMatch[0]);
    
    // Infer trade type if not detected
    if (!extracted.tradeType && extracted.scopeDescription) {
      extracted.tradeType = inferTradeType(extracted.scopeDescription + ' ' + extracted.companyName);
    }

    logger.info('QUOTE_ANALYSIS', 'Extraction complete', { companyName: extracted.companyName, totalAmount: extracted.totalAmount, confidence: extracted.confidence });
    
    return extracted;
  } catch (error) {
    logger.error('QUOTE_ANALYSIS', 'Error analyzing quote', error as Error);
    return null;
  }
}

/**
 * Create or update subcontractor from quote data
 */
export async function linkOrCreateSubcontractor(
  projectId: string,
  quoteData: ExtractedQuoteData
): Promise<string | null> {
  try {
    // Try to find existing subcontractor
    let subcontractor = await prisma.subcontractor.findFirst({
      where: {
        projectId,
        companyName: {
          equals: quoteData.companyName,
          mode: 'insensitive',
        },
      },
    });

    if (!subcontractor && quoteData.tradeType) {
      // Create new subcontractor
      subcontractor = await prisma.subcontractor.create({
        data: {
          projectId,
          companyName: quoteData.companyName,
          tradeType: quoteData.tradeType as any,
          contactName: quoteData.contactName,
          contactEmail: quoteData.contactEmail,
          contactPhone: quoteData.contactPhone,
        },
      });
      logger.info('QUOTE_ANALYSIS', 'Created subcontractor', { companyName: subcontractor.companyName });
    }

    return subcontractor?.id || null;
  } catch (error) {
    logger.error('QUOTE_ANALYSIS', 'Error linking subcontractor', error as Error);
    return null;
  }
}

/**
 * Convert quote line items to budget items
 */
export async function convertQuoteToBudgetItems(
  quoteId: string,
  projectId: string
): Promise<number> {
  try {
    const quote = await prisma.subcontractorQuote.findUnique({
      where: { id: quoteId },
    });

    if (!quote || !quote.extractedData) {
      return 0;
    }

    const extractedData = quote.extractedData as unknown as ExtractedQuoteData;
    const lineItems = extractedData.lineItems || [];
    
    // Get or create project budget
    let budget = await prisma.projectBudget.findUnique({
      where: { projectId },
    });

    if (!budget) {
      budget = await prisma.projectBudget.create({
        data: {
          projectId,
          totalBudget: 0,
          contingency: 0,
          baselineDate: new Date(),
        },
      });
    }

    let createdCount = 0;

    for (const item of lineItems) {
      if (!item.totalPrice || item.totalPrice <= 0) continue;

      await prisma.budgetItem.create({
        data: {
          budgetId: budget.id,
          name: item.description,
          description: `From quote: ${quote.companyName}`,
          budgetedAmount: item.totalPrice,
          actualCost: 0,
          costCode: item.csiCode,
          tradeType: quote.tradeType as any,
          linkedTaskIds: [quoteId],
        },
      });
      createdCount++;
    }

    // Update quote as imported
    await prisma.subcontractorQuote.update({
      where: { id: quoteId },
      data: {
        importedToBudget: true,
        importedAt: new Date(),
      },
    });

    // Update total budget
    const allItems = await prisma.budgetItem.findMany({
      where: { budgetId: budget.id },
    });
    const newTotal = allItems.reduce((sum: number, i: { budgetedAmount: number }) => sum + i.budgetedAmount, 0);
    
    await prisma.projectBudget.update({
      where: { id: budget.id },
      data: { totalBudget: newTotal },
    });

    logger.info('QUOTE_ANALYSIS', `Created ${createdCount} budget items from quote`);
    return createdCount;
  } catch (error) {
    logger.error('QUOTE_ANALYSIS', 'Error converting to budget', error as Error);
    return 0;
  }
}

/**
 * Compare quotes for the same trade
 */
export async function compareQuotes(
  projectId: string,
  quoteIds: string[]
): Promise<{
  quotes: Array<{
    id: string;
    companyName: string;
    totalAmount: number;
    laborCost: number;
    materialCost: number;
  }>;
  lowestBid: string;
  highestBid: string;
  averageAmount: number;
  spreadPercent: number;
}> {
  const quotes = await prisma.subcontractorQuote.findMany({
    where: {
      id: { in: quoteIds },
      projectId,
    },
    orderBy: { totalAmount: 'asc' },
  });

  interface QuoteRecord {
    id: string;
    companyName: string;
    totalAmount: unknown;
    laborCost: unknown;
    materialCost: unknown;
  }
  
  const totals = quotes.map((q: QuoteRecord) => Number(q.totalAmount));
  const avg = totals.reduce((a: number, b: number) => a + b, 0) / totals.length;
  const spread = totals.length > 1 
    ? ((totals[totals.length - 1] - totals[0]) / avg) * 100 
    : 0;

  return {
    quotes: quotes.map((q: QuoteRecord) => ({
      id: q.id,
      companyName: q.companyName,
      totalAmount: Number(q.totalAmount),
      laborCost: Number(q.laborCost) || 0,
      materialCost: Number(q.materialCost) || 0,
    })),
    lowestBid: quotes[0]?.id || '',
    highestBid: quotes[quotes.length - 1]?.id || '',
    averageAmount: avg,
    spreadPercent: spread,
  };
}
