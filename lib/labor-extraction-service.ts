/**
 * Labor Extraction Service
 * Extracts labor hours and crew data from daily report conversations using AI
 */

import { prisma } from '@/lib/db';

interface ExtractedLabor {
  tradeName: string;
  tradeType?: string;
  workerCount: number;
  hoursWorked: number;
  hourlyRate?: number;
  description?: string;
  confidence: number;
}

interface LaborExtractionResult {
  laborEntries: ExtractedLabor[];
  totalWorkers: number;
  totalHours: number;
  extractionConfidence: number;
}

/**
 * Extract labor data from a finalized daily report
 */
export async function extractLaborFromReport(
  conversationId: string,
  projectId: string
): Promise<LaborExtractionResult | null> {
  try {
    // Get conversation messages
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length === 0) return null;

    // Combine messages into content (ChatMessage has 'message' and 'response' fields)
    const reportContent = messages
      .map((m: { message: string | null; response: string | null }) => `User: ${m.message}\nAssistant: ${m.response}`)
      .join('\n\n');

    // Get project's existing trade types for context
    const projectTrades = await prisma.subcontractor.findMany({
      where: { projectId },
      select: { companyName: true, tradeType: true },
    });

    const tradeContext = projectTrades.length > 0
      ? `Known trades on this project: ${projectTrades.map((t: { companyName: string; tradeType: string | null }) => t.tradeType || t.companyName).join(', ')}`
      : 'No known trades yet';

    // Use AI to extract labor data - dynamic import to avoid module issues
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.ABACUSAI_API_KEY,
      baseURL: 'https://api.abacus.ai/llm/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'claude-3-5-sonnet',
      messages: [
        {
          role: 'system',
          content: `You are a construction daily report analyzer. Extract labor/manpower information from daily reports.

${tradeContext}

Extract:
1. Trade name (e.g., "Electricians", "Plumbers", "Carpenters")
2. Number of workers
3. Hours worked (default to 8 if not specified)
4. Any descriptions of work performed

Respond with a JSON object in this exact format:
{
  "laborEntries": [
    {
      "tradeName": "trade name",
      "tradeType": "ELECTRICAL|PLUMBING|HVAC|STRUCTURAL_STEEL|CONCRETE|FRAMING|ROOFING|DRYWALL|PAINTING|FLOORING|LANDSCAPING|SITEWORK|GENERAL",
      "workerCount": number,
      "hoursWorked": number,
      "description": "brief description of work",
      "confidence": 0.0-1.0
    }
  ],
  "totalWorkers": number,
  "totalHours": number,
  "extractionConfidence": 0.0-1.0
}

If no labor data is found, return {"laborEntries": [], "totalWorkers": 0, "totalHours": 0, "extractionConfidence": 0}`,
        },
        {
          role: 'user',
          content: `Extract labor data from this daily report:\n\n${reportContent}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result: LaborExtractionResult = JSON.parse(jsonMatch[0]);
    return result;
  } catch (error) {
    console.error('[LaborExtraction] Error:', error);
    return null;
  }
}

/**
 * Find matching BudgetItem for a trade type
 */
async function findBudgetItemForTrade(projectId: string, tradeType?: string): Promise<string | null> {
  if (!tradeType) return null;

  // Get project budget
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { BudgetItem: true },
  });

  if (!budget?.BudgetItem) return null;

  // Find matching budget item by trade type
  const matchingItem = budget.BudgetItem.find(item => 
    item.tradeType === tradeType && item.isActive
  );

  return matchingItem?.id || null;
}

/**
 * Update BudgetItem actuals after labor is saved
 */
async function updateBudgetItemActuals(budgetItemId: string, hoursWorked: number, totalCost: number): Promise<void> {
  try {
    const item = await prisma.budgetItem.findUnique({ where: { id: budgetItemId } });
    if (!item) return;

    await prisma.budgetItem.update({
      where: { id: budgetItemId },
      data: {
        actualHours: { increment: hoursWorked },
        actualCost: { increment: totalCost },
      },
    });

    console.log(`[LaborExtraction] Updated BudgetItem ${budgetItemId}: +${hoursWorked} hours, +$${totalCost.toFixed(2)}`);
  } catch (error) {
    console.error(`[LaborExtraction] Error updating BudgetItem ${budgetItemId}:`, error);
  }
}

/**
 * Save extracted labor data to the database
 */
export async function saveLaborEntries(
  projectId: string,
  conversationId: string,
  laborData: LaborExtractionResult,
  reportDate: Date
): Promise<{ savedCount: number; linkedToBudget: number; totalLaborCost: number }> {
  let savedCount = 0;
  let linkedToBudget = 0;
  let totalLaborCost = 0;

  // Get project-specific labor rates with intelligent fallback
  const { getAllProjectLaborRates } = await import('./project-specific-pricing');
  const projectLaborRates = await getAllProjectLaborRates(projectId);
  
  // Fallback rates if project-specific not available
  const fallbackRates: Record<string, number> = {
    ELECTRICAL: 78,
    PLUMBING: 72,
    HVAC: 75,
    HVAC_MECHANICAL: 75,
    STRUCTURAL_STEEL: 82,
    CONCRETE: 58,
    CONCRETE_MASONRY: 58,
    FRAMING: 52,
    CARPENTRY_FRAMING: 52,
    ROOFING: 55,
    DRYWALL: 48,
    DRYWALL_FINISHES: 48,
    PAINTING: 42,
    PAINTING_COATING: 42,
    FLOORING: 52,
    LANDSCAPING: 45,
    SITEWORK: 65,
    SITE_UTILITIES: 65,
    GENERAL: 55,
    GENERAL_CONTRACTOR: 55,
  };

  // Helper to get rate for a trade
  const getHourlyRate = (tradeType: string): { rate: number; source: string } => {
    const normalizedTrade = tradeType?.toLowerCase().replace(/[\\s-]/g, '_') || 'general';
    const projectRate = projectLaborRates.get(normalizedTrade);
    
    if (projectRate && projectRate.confidence !== 'low') {
      return { rate: projectRate.hourlyRate, source: projectRate.source };
    }
    
    // Check fallback rates
    const upperTrade = (tradeType || 'GENERAL').toUpperCase().replace(/[\\s-]/g, '_');
    return { rate: fallbackRates[upperTrade] || 55, source: 'default' };
  };

  for (const entry of laborData.laborEntries) {
    if (entry.confidence < 0.5) continue; // Skip low-confidence entries

    try {
      // Calculate labor cost using project-specific or fallback rate
      const rateInfo = getHourlyRate(entry.tradeType || 'GENERAL');
      const hourlyRate = entry.hourlyRate || rateInfo.rate;
      const totalCost = entry.workerCount * entry.hoursWorked * hourlyRate;
      const totalHours = entry.hoursWorked * entry.workerCount;
      totalLaborCost += totalCost;

      // Find matching budget item for this trade
      const budgetItemId = await findBudgetItemForTrade(projectId, entry.tradeType);

      // Create labor entry with optional budget item link
      await prisma.laborEntry.create({
        data: {
          projectId,
          budgetItemId, // Link to budget item if found
          date: reportDate,
          workerName: `${entry.tradeName} Crew (${entry.workerCount} workers)`,
          tradeType: entry.tradeType as any,
          hoursWorked: totalHours,
          hourlyRate,
          totalCost,
          description: entry.description || `${entry.workerCount} ${entry.tradeName} workers`,
          status: entry.confidence >= 0.8 ? 'APPROVED' : 'PENDING',
        },
      });

      savedCount++;

      // Update budget item actuals if linked and approved
      if (budgetItemId && entry.confidence >= 0.8) {
        await updateBudgetItemActuals(budgetItemId, totalHours, totalCost);
        linkedToBudget++;
      }
    } catch (error) {
      console.error(`[LaborExtraction] Error saving entry for ${entry.tradeName}:`, error);
    }
  }

  return { savedCount, linkedToBudget, totalLaborCost };
}

/**
 * Main function to extract and save labor from a daily report
 */
export async function processLaborFromDailyReport(
  conversationId: string,
  projectId: string,
  reportDate: Date
): Promise<{ success: boolean; entriesSaved: number; linkedToBudget: number; totalLaborCost: number }> {
  try {
    console.log(`[LaborExtraction] Processing conversation ${conversationId}`);

    // Extract labor data
    const laborData = await extractLaborFromReport(conversationId, projectId);
    
    if (!laborData || laborData.laborEntries.length === 0) {
      console.log('[LaborExtraction] No labor data found in report');
      return { success: true, entriesSaved: 0, linkedToBudget: 0, totalLaborCost: 0 };
    }

    console.log(`[LaborExtraction] Extracted ${laborData.laborEntries.length} labor entries`);

    // Save to database and link to budget items
    const result = await saveLaborEntries(
      projectId,
      conversationId,
      laborData,
      reportDate
    );

    console.log(`[LaborExtraction] Saved ${result.savedCount} labor entries, ${result.linkedToBudget} linked to budget, $${result.totalLaborCost.toFixed(2)} total cost`);

    return { 
      success: true, 
      entriesSaved: result.savedCount,
      linkedToBudget: result.linkedToBudget,
      totalLaborCost: result.totalLaborCost
    };
  } catch (error) {
    console.error('[LaborExtraction] Error processing labor:', error);
    return { success: false, entriesSaved: 0, linkedToBudget: 0, totalLaborCost: 0 };
  }
}
