/**
 * Material Extraction Service
 * Extracts material deliveries and costs from daily report conversations
 * and links them to budget items
 */

import { prisma } from '@/lib/db';

interface ExtractedMaterial {
  materialName: string;
  supplier?: string;
  quantity: number;
  unit: string;
  unitCost?: number;
  totalCost: number;
  tradeType?: string;
  deliveryNotes?: string;
  confidence: number;
}

interface MaterialExtractionResult {
  materials: ExtractedMaterial[];
  totalMaterialCost: number;
  extractionConfidence: number;
}

/**
 * Extract material data from a finalized daily report
 */
export async function extractMaterialsFromReport(
  conversationId: string,
  projectId: string
): Promise<MaterialExtractionResult | null> {
  try {
    // Get conversation messages
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length === 0) return null;

    // Combine messages into content
    const reportContent = messages
      .map((m: { message: string | null; response: string | null }) => 
        `User: ${m.message}\nAssistant: ${m.response}`
      )
      .join('\n\n');

    // Also check materialDeliveries field on conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { materialDeliveries: true },
    });

    // Get existing material deliveries from conversation metadata
    const existingDeliveries = (conversation?.materialDeliveries as any[]) || [];

    // Use AI to extract additional material data
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: `You are a construction daily report analyzer. Extract material delivery and cost information from daily reports.

Extract:
1. Material name (e.g., "Concrete", "Rebar", "Lumber", "Drywall")
2. Supplier/vendor name if mentioned
3. Quantity delivered
4. Unit of measurement (cy, lf, sf, ea, tons, etc.)
5. Cost per unit if mentioned
6. Total cost if mentioned (or calculate from quantity × unit cost)
7. Associated trade (ELECTRICAL, PLUMBING, HVAC, CONCRETE, FRAMING, etc.)
8. Delivery notes

Respond with a JSON object in this exact format:
{
  "materials": [
    {
      "materialName": "material name",
      "supplier": "supplier name or null",
      "quantity": number,
      "unit": "unit type",
      "unitCost": number or null,
      "totalCost": number,
      "tradeType": "ELECTRICAL|PLUMBING|HVAC|STRUCTURAL_STEEL|CONCRETE|FRAMING|ROOFING|DRYWALL|PAINTING|FLOORING|LANDSCAPING|SITEWORK|GENERAL",
      "deliveryNotes": "notes or null",
      "confidence": 0.0-1.0
    }
  ],
  "totalMaterialCost": number,
  "extractionConfidence": 0.0-1.0
}

If no material data is found, return {"materials": [], "totalMaterialCost": 0, "extractionConfidence": 0}

Common material-trade mappings:
- Concrete, Rebar, Forms → CONCRETE
- Wire, Conduit, Panels, Fixtures → ELECTRICAL
- Pipe, Fittings, Fixtures → PLUMBING
- Ductwork, HVAC equipment → HVAC
- Steel beams, columns → STRUCTURAL_STEEL
- Lumber, studs, plywood → FRAMING
- Shingles, membrane → ROOFING
- Drywall, mud, tape → DRYWALL
- Paint, primer → PAINTING`,
        },
        {
          role: 'user',
          content: `Extract material delivery data from this daily report:\n\n${reportContent}`,
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

    const result: MaterialExtractionResult = JSON.parse(jsonMatch[0]);

    // Merge with existing deliveries from conversation metadata
    for (const delivery of existingDeliveries) {
      // Check if not already in extracted results
      const exists = result.materials.some(
        m => m.materialName.toLowerCase() === (delivery.material || '').toLowerCase()
      );

      if (!exists && delivery.material) {
        result.materials.push({
          materialName: delivery.material,
          supplier: delivery.sub || delivery.supplier,
          quantity: delivery.quantity || 1,
          unit: delivery.unit || 'ea',
          unitCost: delivery.unitCost,
          totalCost: delivery.totalCost || delivery.quantity * (delivery.unitCost || 0),
          tradeType: delivery.tradeType || 'GENERAL',
          deliveryNotes: delivery.notes,
          confidence: 0.9, // High confidence for manually entered data
        });
        result.totalMaterialCost += delivery.totalCost || 0;
      }
    }

    return result;
  } catch (error) {
    console.error('[MaterialExtraction] Error:', error);
    return null;
  }
}

/**
 * Find matching BudgetItem for materials by trade type or material name
 */
async function findBudgetItemForMaterial(
  projectId: string,
  tradeType?: string,
  materialName?: string
): Promise<string | null> {
  // Get project budget
  const budget = await prisma.projectBudget.findUnique({
    where: { projectId },
    include: { BudgetItem: true },
  });

  if (!budget?.BudgetItem) return null;

  // First, try to match by trade type
  if (tradeType) {
    const matchingItem = budget.BudgetItem.find(item => 
      item.tradeType === tradeType && item.isActive
    );
    if (matchingItem) return matchingItem.id;
  }

  // Fallback: try to match by material name in budget item name/description
  if (materialName) {
    const lowerName = materialName.toLowerCase();
    const matchingItem = budget.BudgetItem.find(item => 
      item.isActive && (
        item.name.toLowerCase().includes(lowerName) ||
        (item.description && item.description.toLowerCase().includes(lowerName))
      )
    );
    if (matchingItem) return matchingItem.id;
  }

  return null;
}

/**
 * Update BudgetItem actual cost after material delivery
 */
async function updateBudgetItemMaterialCost(
  budgetItemId: string,
  materialCost: number
): Promise<void> {
  try {
    await prisma.budgetItem.update({
      where: { id: budgetItemId },
      data: {
        actualCost: { increment: materialCost },
      },
    });

    console.log(`[MaterialExtraction] Updated BudgetItem ${budgetItemId}: +$${materialCost.toFixed(2)} material cost`);
  } catch (error) {
    console.error(`[MaterialExtraction] Error updating BudgetItem ${budgetItemId}:`, error);
  }
}

/**
 * Generate unique procurement number for material delivery
 */
async function generateProcurementNumber(projectId: string): Promise<string> {
  const count = await prisma.procurement.count({ where: { projectId } });
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `MAT-${dateStr}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Map trade type to procurement type
 */
function mapTradeToProcurementType(tradeType?: string): 'MATERIAL' | 'EQUIPMENT' {
  // Most materials from daily reports are MATERIAL type
  // Equipment would be things like machinery, tools
  const equipmentTrades = ['HVAC'];
  if (tradeType && equipmentTrades.includes(tradeType)) {
    return 'EQUIPMENT';
  }
  return 'MATERIAL';
}

/**
 * Save extracted material data to database and update budget
 */
export async function saveMaterialEntries(
  projectId: string,
  conversationId: string,
  materialData: MaterialExtractionResult,
  reportDate: Date,
  createdBy?: string
): Promise<{ savedCount: number; linkedToBudget: number; totalMaterialCost: number }> {
  let savedCount = 0;
  let linkedToBudget = 0;
  let totalMaterialCost = 0;

  // Get a system user or first admin for createdBy if not provided
  let userId = createdBy;
  if (!userId) {
    const systemUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true },
    });
    userId = systemUser?.id || 'system';
  }

  for (const material of materialData.materials) {
    if (material.confidence < 0.5) continue; // Skip low-confidence entries

    try {
      totalMaterialCost += material.totalCost;

      // Find matching budget item
      const budgetItemId = await findBudgetItemForMaterial(
        projectId,
        material.tradeType,
        material.materialName
      );

      // Generate unique procurement number
      const procurementNumber = await generateProcurementNumber(projectId);

      // Create procurement record with all required fields
      await prisma.procurement.create({
        data: {
          project: { connect: { id: projectId } },
          budgetItem: budgetItemId ? { connect: { id: budgetItemId } } : undefined,
          procurementNumber,
          description: material.materialName,
          itemType: mapTradeToProcurementType(material.tradeType),
          quantity: material.quantity,
          unit: material.unit,
          vendorName: material.supplier || 'Unknown Vendor',
          actualCost: material.totalCost,
          quotedCost: material.unitCost ? material.unitCost * material.quantity : undefined,
          actualDelivery: reportDate,
          status: 'RECEIVED',
          notes: material.deliveryNotes || `Extracted from daily report (confidence: ${(material.confidence * 100).toFixed(0)}%)`,
          createdByUser: { connect: { id: userId } },
        },
      });

      savedCount++;

      // Update budget item actual cost if linked and high confidence
      if (budgetItemId && material.confidence >= 0.7) {
        await updateBudgetItemMaterialCost(budgetItemId, material.totalCost);
        linkedToBudget++;
      }
    } catch (error) {
      console.error(`[MaterialExtraction] Error saving material ${material.materialName}:`, error);
    }
  }

  return { savedCount, linkedToBudget, totalMaterialCost };
}

/**
 * Main function to extract and save materials from a daily report
 */
export async function processMaterialsFromDailyReport(
  conversationId: string,
  projectId: string,
  reportDate: Date
): Promise<{ success: boolean; entriesSaved: number; linkedToBudget: number; totalMaterialCost: number }> {
  try {
    console.log(`[MaterialExtraction] Processing conversation ${conversationId}`);

    // Extract material data
    const materialData = await extractMaterialsFromReport(conversationId, projectId);

    if (!materialData || materialData.materials.length === 0) {
      console.log('[MaterialExtraction] No material data found in report');
      return { success: true, entriesSaved: 0, linkedToBudget: 0, totalMaterialCost: 0 };
    }

    console.log(`[MaterialExtraction] Extracted ${materialData.materials.length} material deliveries`);

    // Save to database and link to budget items
    const result = await saveMaterialEntries(
      projectId,
      conversationId,
      materialData,
      reportDate
    );

    console.log(`[MaterialExtraction] Saved ${result.savedCount} material entries, ${result.linkedToBudget} linked to budget, $${result.totalMaterialCost.toFixed(2)} total cost`);

    return {
      success: true,
      entriesSaved: result.savedCount,
      linkedToBudget: result.linkedToBudget,
      totalMaterialCost: result.totalMaterialCost,
    };
  } catch (error) {
    console.error('[MaterialExtraction] Error processing materials:', error);
    return { success: false, entriesSaved: 0, linkedToBudget: 0, totalMaterialCost: 0 };
  }
}
