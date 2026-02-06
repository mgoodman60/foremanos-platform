/**
 * Budget Auto-Sync Service
 * Automatically extracts budget data from uploaded documents and syncs with takeoffs
 */

import { prisma } from '@/lib/db';
import OpenAI from 'openai';
import { EXTRACTION_MODEL } from '@/lib/model-config';

interface ExtractedBudgetItem {
  phaseCode: number;
  phaseName: string;
  categoryNumber: number;
  name: string;
  budgetedAmount: number;
  contractAmount: number;
}

/**
 * Extract budget data from document content using AI
 */
export async function extractBudgetFromContent(content: string): Promise<ExtractedBudgetItem[]> {
  const prompt = `Extract budget line items from this document. Return as JSON array with this structure:
[
  {
    "phaseCode": 100,
    "phaseName": "GENERAL REQUIREMENTS",
    "categoryNumber": 1,
    "name": "Mobilization",
    "budgetedAmount": 35000,
    "contractAmount": 35000
  }
]

CSI Phase codes:
- 100: General Requirements
- 200: Existing Conditions / Demolition
- 300: Concrete
- 400: Masonry
- 500: Metals
- 600: Woods & Plastics
- 700: Thermal & Moisture Protection
- 800: Doors & Windows
- 900: Finishes
- 1000: Specialties
- 2200: Plumbing
- 2300: HVAC
- 2600: Electrical
- 3100-3300: Sitework

Document content:
${content.substring(0, 15000)}

Return ONLY the JSON array, no explanation.`;

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: EXTRACTION_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[Budget Auto-Sync] Failed to extract budget:', error);
  }
  
  return [];
}

/**
 * Sync extracted budget with project budget database
 */
export async function syncBudgetToProject(
  projectId: string,
  items: ExtractedBudgetItem[]
): Promise<{ created: number; updated: number; total: number }> {
  if (items.length === 0) {
    return { created: 0, updated: 0, total: 0 };
  }

  // Get or create project budget
  let budget = await prisma.projectBudget.findUnique({
    where: { projectId },
  });

  const totalBudget = items.reduce((sum, item) => sum + (item.budgetedAmount || 0), 0);

  if (!budget) {
    budget = await prisma.projectBudget.create({
      data: {
        Project: { connect: { id: projectId } },
        totalBudget,
        contingency: totalBudget * 0.05,
        baselineDate: new Date(),
      },
    });
  } else {
    await prisma.projectBudget.update({
      where: { id: budget.id },
      data: { totalBudget },
    });
  }

  let created = 0;
  let updated = 0;

  for (const item of items) {
    // Check if item exists
    const existing = await prisma.budgetItem.findFirst({
      where: {
        budgetId: budget.id,
        phaseCode: item.phaseCode,
        categoryNumber: item.categoryNumber,
      },
    });

    if (existing) {
      await prisma.budgetItem.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          phaseName: item.phaseName,
          budgetedAmount: item.budgetedAmount,
          contractAmount: item.contractAmount,
        },
      });
      updated++;
    } else {
      await prisma.budgetItem.create({
        data: {
          budgetId: budget.id,
          phaseCode: item.phaseCode,
          phaseName: item.phaseName,
          categoryNumber: item.categoryNumber,
          name: item.name,
          description: item.name,
          budgetedAmount: item.budgetedAmount,
          contractAmount: item.contractAmount,
          actualCost: 0,
          billedToDate: 0,
          budgetedHours: 0,
          actualHours: 0,
        },
      });
      created++;
    }
  }

  return { created, updated, total: items.length };
}

/**
 * Compare takeoffs against budget and flag variances
 */
export async function compareTakeoffsToBudget(projectId: string): Promise<{
  matches: number;
  overBudget: number;
  underBudget: number;
  missing: number;
  variances: Array<{
    category: string;
    takeoffAmount: number;
    budgetAmount: number;
    variance: number;
    variancePercent: number;
  }>;
}> {
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { BudgetItem: true },
  });

  const takeoffs = await prisma.materialTakeoff.findMany({
    where: { projectId },
    include: { TakeoffLineItem: true },
  });

  if (!budget || takeoffs.length === 0) {
    return { matches: 0, overBudget: 0, underBudget: 0, missing: 0, variances: [] };
  }

  // Aggregate takeoff by category
  const takeoffByCategory: Record<string, number> = {};
  for (const takeoff of takeoffs) {
    for (const item of takeoff.TakeoffLineItem) {
      const cat = item.category || 'Other';
      takeoffByCategory[cat] = (takeoffByCategory[cat] || 0) + (item.totalCost || 0);
    }
  }

  // Map CSI phases to takeoff categories
  const phaseToCategory: Record<string, string> = {
    'GENERAL REQUIREMENTS': 'General',
    'SITEWORK': 'Sitework',
    'CONCRETE': 'Concrete',
    'METALS': 'Metals',
    'WOODS & PLASTICS': 'Woods & Plastics',
    'THERMAL & MOISTURE': 'Roofing',
    'DOORS & WINDOWS': 'Doors & Windows',
    'FINISHES': 'Interior Finishes',
    'SPECIALTIES': 'Specialties',
    'PLUMBING': 'Plumbing',
    'HVAC': 'HVAC',
    'ELECTRICAL': 'Electrical',
  };

  const variances: Array<{
    category: string;
    takeoffAmount: number;
    budgetAmount: number;
    variance: number;
    variancePercent: number;
  }> = [];

  let matches = 0;
  let overBudget = 0;
  let underBudget = 0;
  let missing = 0;

  // Group budget by phase
  const budgetByPhase: Record<string, number> = {};
  for (const item of budget.BudgetItem) {
    const phase = item.phaseName || 'Other';
    budgetByPhase[phase] = (budgetByPhase[phase] || 0) + (item.budgetedAmount || 0);
  }

  // Compare
  for (const [phaseName, budgetAmount] of Object.entries(budgetByPhase)) {
    const category = phaseToCategory[phaseName.toUpperCase()] || phaseName;
    const takeoffAmount = takeoffByCategory[category] || 0;
    const variance = takeoffAmount - budgetAmount;
    const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

    if (takeoffAmount === 0) {
      missing++;
    } else if (Math.abs(variancePercent) <= 5) {
      matches++;
    } else if (variance > 0) {
      overBudget++;
    } else {
      underBudget++;
    }

    variances.push({
      category,
      takeoffAmount,
      budgetAmount,
      variance,
      variancePercent,
    });
  }

  return { matches, overBudget, underBudget, missing, variances };
}

/**
 * Auto-process a budget document when uploaded
 */
export async function processUploadedBudgetDocument(
  documentId: string,
  projectId: string
): Promise<{ success: boolean; itemsProcessed: number; message: string }> {
  try {
    // Get document chunks (content)
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' },
    });

    if (chunks.length === 0) {
      return { success: false, itemsProcessed: 0, message: 'No content found in document' };
    }

    const content = chunks.map(c => c.content).join('\n\n');

    // Extract budget items
    const items = await extractBudgetFromContent(content);
    
    if (items.length === 0) {
      return { success: false, itemsProcessed: 0, message: 'Could not extract budget items from document' };
    }

    // Sync to database
    const result = await syncBudgetToProject(projectId, items);

    // Compare with takeoffs
    const comparison = await compareTakeoffsToBudget(projectId);

    console.log(`[Budget Auto-Sync] Processed ${result.total} items, ${result.created} created, ${result.updated} updated`);
    console.log(`[Budget Auto-Sync] Takeoff comparison: ${comparison.matches} matches, ${comparison.overBudget} over, ${comparison.underBudget} under`);

    return {
      success: true,
      itemsProcessed: result.total,
      message: `Imported ${result.created} new items, updated ${result.updated} existing. Takeoff coverage: ${comparison.matches + comparison.overBudget + comparison.underBudget} categories compared.`,
    };
  } catch (error) {
    console.error('[Budget Auto-Sync] Error:', error);
    return { success: false, itemsProcessed: 0, message: 'Failed to process budget document' };
  }
}
