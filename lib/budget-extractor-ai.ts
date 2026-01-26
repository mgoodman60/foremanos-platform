/**
 * AI-Powered Budget Extractor
 * 
 * Uses LLM vision API to intelligently extract budget line items from PDF documents
 * Handles various budget formats including CSI/MasterFormat, trade breakdowns, and custom formats
 */

import { prisma } from './db';
import { callAbacusLLM } from './abacus-llm';
import { getFileUrl } from './s3';
import fs from 'fs';
import path from 'path';

const TRADE_TYPES = [
  'general_contractor',
  'concrete_masonry',
  'carpentry_framing',
  'electrical',
  'plumbing',
  'hvac_mechanical',
  'drywall_finishes',
  'site_utilities',
  'structural_steel',
  'roofing',
  'glazing_windows',
  'painting_coating',
  'flooring',
] as const;

type TradeType = typeof TRADE_TYPES[number];

export interface ExtractedBudgetItem {
  name: string;
  description?: string;
  costCode?: string;
  tradeType?: TradeType;
  budgetedAmount: number;
  unit?: string;
  quantity?: number;
  unitCost?: number;
  notes?: string;
}

export interface BudgetExtractionResult {
  totalBudget: number;
  contingency: number;
  lineItems: ExtractedBudgetItem[];
  currency: string;
  extractionMethod: string;
  confidence: number;
}

/**
 * Infer trade type from cost code and item name
 */
function inferTradeType(costCode: string | undefined, name: string): TradeType | undefined {
  const nameLower = name.toLowerCase();
  const code = costCode || '';

  // CSI Division mapping
  if (code.startsWith('01') || code.startsWith('00')) return 'general_contractor';
  if (code.startsWith('03') || nameLower.includes('concrete') || nameLower.includes('masonry')) return 'concrete_masonry';
  if (code.startsWith('05') || nameLower.includes('steel') || nameLower.includes('metal')) return 'structural_steel';
  if (code.startsWith('06') || nameLower.includes('carpentry') || nameLower.includes('framing') || nameLower.includes('wood')) return 'carpentry_framing';
  if (code.startsWith('07') || nameLower.includes('roofing') || nameLower.includes('waterproof')) return 'roofing';
  if (code.startsWith('08') || nameLower.includes('window') || nameLower.includes('door') || nameLower.includes('glass')) return 'glazing_windows';
  if (code.startsWith('09')) {
    if (nameLower.includes('paint') || nameLower.includes('coating')) return 'painting_coating';
    if (nameLower.includes('floor') || nameLower.includes('carpet') || nameLower.includes('tile')) return 'flooring';
    return 'drywall_finishes';
  }
  if (code.startsWith('22') || nameLower.includes('plumbing') || nameLower.includes('piping')) return 'plumbing';
  if (code.startsWith('23') || nameLower.includes('hvac') || nameLower.includes('mechanical') || nameLower.includes('heating')) return 'hvac_mechanical';
  if (code.startsWith('26') || code.startsWith('27') || code.startsWith('28') || nameLower.includes('electric')) return 'electrical';
  if (code.startsWith('31') || code.startsWith('32') || code.startsWith('33') || nameLower.includes('site') || nameLower.includes('excavation')) return 'site_utilities';

  // Keyword-based fallback
  if (nameLower.includes('paint')) return 'painting_coating';
  if (nameLower.includes('floor')) return 'flooring';
  if (nameLower.includes('drywall') || nameLower.includes('finish')) return 'drywall_finishes';

  return undefined;
}

/**
 * Extract budget items from a PDF using AI vision
 */
async function extractBudgetFromPdfWithVision(
  documentId: string,
  cloudStoragePath: string,
  isPublic: boolean,
  documentName: string
): Promise<ExtractedBudgetItem[]> {
  console.log(`[BUDGET_EXTRACTOR] Extracting budget from PDF: ${documentName}`);

  const fileUrl = await getFileUrl(cloudStoragePath, isPublic);
  if (!fileUrl) {
    throw new Error('Failed to get file URL');
  }

  // Fetch the PDF
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  }

  const pdfBuffer = await response.arrayBuffer();
  const base64Pdf = Buffer.from(pdfBuffer).toString('base64');

  const prompt = `You are a construction budget analyst. Analyze this budget/cost estimate document and extract ALL line items.

For EACH budget line item, extract:
1. name: The item description or work category
2. costCode: CSI/MasterFormat code if present (e.g., "03 30 00", "26-00", "3100")
3. budgetedAmount: The dollar amount (just the number, no $ or commas)
4. quantity: Numeric quantity if shown
5. unit: Unit of measure (SF, LF, EA, LS, CY, etc.)
6. unitCost: Cost per unit if shown
7. description: Any additional notes or specifications

IMPORTANT:
- Extract EVERY line item you can identify
- Include subtotals for divisions/categories as separate items
- Parse amounts carefully - remove $ and commas
- If a cost code is not shown, leave it empty
- Look for tables, schedules, and itemized lists

Respond with ONLY valid JSON in this exact format:
{
  "totalBudget": <number>,
  "contingency": <number or 0>,
  "currency": "USD",
  "items": [
    {
      "name": "string",
      "costCode": "string or null",
      "budgetedAmount": <number>,
      "quantity": <number or null>,
      "unit": "string or null",
      "unitCost": <number or null>,
      "description": "string or null"
    }
  ]
}`;

  // For PDF files, we need to include the base64 content in the message
  const messages = [
    {
      role: 'user' as const,
      content: `${prompt}\n\n[Analyzing PDF document: ${documentName}]\n\n[PDF Content: data:application/pdf;base64,${base64Pdf}]`,
    },
  ];

  const llmResponse = await callAbacusLLM(messages, {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    temperature: 0.1,
  });

  const content = llmResponse.content || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[BUDGET_EXTRACTOR] Failed to parse JSON from response:', content.substring(0, 500));
    throw new Error('Failed to parse budget data from document');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const items: ExtractedBudgetItem[] = (parsed.items || []).map((item: any) => ({
      name: item.name || 'Unknown Item',
      description: item.description || undefined,
      costCode: item.costCode || undefined,
      tradeType: inferTradeType(item.costCode, item.name),
      budgetedAmount: parseFloat(item.budgetedAmount) || 0,
      unit: item.unit || undefined,
      quantity: item.quantity ? parseFloat(item.quantity) : undefined,
      unitCost: item.unitCost ? parseFloat(item.unitCost) : undefined,
    }));

    console.log(`[BUDGET_EXTRACTOR] Extracted ${items.length} budget items`);
    return items;
  } catch (parseError) {
    console.error('[BUDGET_EXTRACTOR] JSON parse error:', parseError);
    throw new Error('Failed to parse budget extraction response');
  }
}

/**
 * Extract budget from document text chunks (fallback method)
 */
async function extractBudgetFromChunks(
  documentId: string
): Promise<ExtractedBudgetItem[]> {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    orderBy: { pageNumber: 'asc' },
  });

  if (chunks.length === 0) {
    throw new Error('No document chunks found');
  }

  const allText = chunks.map((c: any) => c.content).join('\n\n');

  const prompt = `Analyze this budget/cost estimate text and extract ALL line items.

Text:
${allText.substring(0, 15000)}

Extract each budget line item with:
- name: Item description
- costCode: CSI code if present
- budgetedAmount: Dollar amount (number only)
- quantity, unit, unitCost if shown

Respond with ONLY valid JSON:
{
  "totalBudget": <number>,
  "contingency": <number>,
  "items": [{"name": "", "costCode": "", "budgetedAmount": 0, ...}]
}`;

  const messages = [{ role: 'user' as const, content: prompt }];

  const llmResponse = await callAbacusLLM(messages, {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    temperature: 0.1,
  });

  const content = llmResponse.content || '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.items || []).map((item: any) => ({
      name: item.name || 'Unknown',
      description: item.description,
      costCode: item.costCode,
      tradeType: inferTradeType(item.costCode, item.name),
      budgetedAmount: parseFloat(item.budgetedAmount) || 0,
      unit: item.unit,
      quantity: item.quantity ? parseFloat(item.quantity) : undefined,
      unitCost: item.unitCost ? parseFloat(item.unitCost) : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Main function to extract budget from a document
 */
export async function extractBudgetWithAI(
  documentId: string,
  projectId: string,
  userId: string
): Promise<BudgetExtractionResult> {
  console.log('[BUDGET_EXTRACTOR] Starting budget extraction');

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (!document.cloud_storage_path) {
    throw new Error('Document has no file path');
  }

  let items: ExtractedBudgetItem[] = [];
  let extractionMethod = 'vision';

  // Try PDF vision extraction first
  try {
    items = await extractBudgetFromPdfWithVision(
      documentId,
      document.cloud_storage_path,
      document.isPublic,
      document.name
    );
  } catch (visionError) {
    console.log('[BUDGET_EXTRACTOR] Vision extraction failed, trying text chunks:', visionError);
    extractionMethod = 'text';
  }

  // Fallback to text chunks
  if (items.length === 0) {
    items = await extractBudgetFromChunks(documentId);
    extractionMethod = 'text';
  }

  if (items.length === 0) {
    throw new Error('No budget items could be extracted from the document');
  }

  // Calculate totals
  const totalBudget = items.reduce((sum, item) => sum + item.budgetedAmount, 0);
  const contingencyItem = items.find(i => 
    i.name.toLowerCase().includes('contingency') || 
    i.name.toLowerCase().includes('reserve')
  );
  const contingency = contingencyItem?.budgetedAmount || 0;

  // Calculate confidence based on extraction quality
  const itemsWithCodes = items.filter(i => i.costCode).length;
  const confidence = Math.min(95, 50 + (itemsWithCodes / items.length) * 30 + (items.length > 5 ? 15 : 0));

  console.log(`[BUDGET_EXTRACTOR] Extraction complete: ${items.length} items, $${totalBudget.toLocaleString()} total`);

  return {
    totalBudget,
    contingency,
    lineItems: items,
    currency: 'USD',
    extractionMethod,
    confidence,
  };
}

/**
 * Import extracted budget into the database
 */
export async function importBudgetToProject(
  projectId: string,
  extraction: BudgetExtractionResult,
  userId: string
): Promise<{ budgetId: string; itemsCreated: number }> {
  console.log('[BUDGET_EXTRACTOR] Importing budget to project');

  // Check for existing budget
  const existingBudget = await prisma.projectBudget.findUnique({
    where: { projectId },
  });

  let budgetId: string;

  if (existingBudget) {
    // Update existing budget
    await prisma.projectBudget.update({
      where: { id: existingBudget.id },
      data: {
        totalBudget: extraction.totalBudget,
        contingency: extraction.contingency,
        lastUpdated: new Date(),
      },
    });
    budgetId = existingBudget.id;

    // Delete existing line items before importing new ones
    await prisma.budgetItem.deleteMany({
      where: { budgetId: existingBudget.id },
    });
  } else {
    // Create new budget
    const newBudget = await prisma.projectBudget.create({
      data: {
        projectId,
        totalBudget: extraction.totalBudget,
        contingency: extraction.contingency,
        baselineDate: new Date(),
        currency: extraction.currency,
      },
    });
    budgetId = newBudget.id;
  }

  // Create budget items
  const itemsToCreate = extraction.lineItems.map(item => ({
    budgetId,
    name: item.name,
    description: item.description || null,
    costCode: item.costCode || null,
    tradeType: item.tradeType || null,
    budgetedAmount: item.budgetedAmount,
    actualCost: 0,
    committedCost: 0,
  }));

  await prisma.budgetItem.createMany({
    data: itemsToCreate,
  });

  console.log(`[BUDGET_EXTRACTOR] Imported ${itemsToCreate.length} budget items`);

  return {
    budgetId,
    itemsCreated: itemsToCreate.length,
  };
}

/**
 * Get trade-level budget breakdown
 */
export async function getTradeBudgetBreakdown(projectId: string): Promise<{
  trades: {
    tradeType: string;
    tradeName: string;
    budgetedAmount: number;
    actualCost: number;
    variance: number;
    variancePercent: number;
    itemCount: number;
  }[];
  unassigned: {
    budgetedAmount: number;
    actualCost: number;
    itemCount: number;
  };
}> {
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: {
      BudgetItem: true,
    },
  });

  if (!budget) {
    return {
      trades: [],
      unassigned: { budgetedAmount: 0, actualCost: 0, itemCount: 0 },
    };
  }

  const tradeNames: Record<string, string> = {
    general_contractor: 'General Contractor',
    concrete_masonry: 'Concrete & Masonry',
    carpentry_framing: 'Carpentry & Framing',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    hvac_mechanical: 'HVAC & Mechanical',
    drywall_finishes: 'Drywall & Finishes',
    site_utilities: 'Site & Utilities',
    structural_steel: 'Structural Steel',
    roofing: 'Roofing',
    glazing_windows: 'Glazing & Windows',
    painting_coating: 'Painting & Coating',
    flooring: 'Flooring',
  };

  // Group by trade
  const tradeMap = new Map<string, { budgeted: number; actual: number; count: number }>();
  let unassignedBudgeted = 0;
  let unassignedActual = 0;
  let unassignedCount = 0;

  for (const item of budget.BudgetItem) {
    if (item.tradeType) {
      const existing = tradeMap.get(item.tradeType) || { budgeted: 0, actual: 0, count: 0 };
      existing.budgeted += item.budgetedAmount;
      existing.actual += item.actualCost;
      existing.count += 1;
      tradeMap.set(item.tradeType, existing);
    } else {
      unassignedBudgeted += item.budgetedAmount;
      unassignedActual += item.actualCost;
      unassignedCount += 1;
    }
  }

  const trades = Array.from(tradeMap.entries()).map(([tradeType, data]) => {
    const variance = data.budgeted - data.actual;
    const variancePercent = data.budgeted > 0 ? (variance / data.budgeted) * 100 : 0;
    return {
      tradeType,
      tradeName: tradeNames[tradeType] || tradeType,
      budgetedAmount: data.budgeted,
      actualCost: data.actual,
      variance,
      variancePercent,
      itemCount: data.count,
    };
  }).sort((a, b) => b.budgetedAmount - a.budgetedAmount);

  return {
    trades,
    unassigned: {
      budgetedAmount: unassignedBudgeted,
      actualCost: unassignedActual,
      itemCount: unassignedCount,
    },
  };
}
