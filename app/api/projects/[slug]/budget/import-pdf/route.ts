import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { EXTRACTION_MODEL } from '@/lib/model-config';
import { callLLM } from '@/lib/llm-providers';

// Helper to parse Walker Company PDF text
function _parseWalkerCompanyPDF(text: string): Array<{
  phaseCode: number;
  phaseName: string;
  categoryNumber: number;
  name: string;
  budgetedAmount: number;
  contractAmount: number;
  billedToDate: number;
  actualCost: number;
  budgetedHours: number;
  actualHours: number;
}> {
  const items: Array<{
    phaseCode: number;
    phaseName: string;
    categoryNumber: number;
    name: string;
    budgetedAmount: number;
    contractAmount: number;
    billedToDate: number;
    actualCost: number;
    budgetedHours: number;
    actualHours: number;
  }> = [];
  
  const lines = text.split('\n');
  let currentPhase: { code: number; name: string } | null = null;
  
  for (const line of lines) {
    // Match phase headers like "Phase: 100 - GENERAL REQUIREMENTS" or "Phase: 2300 - HVAC / PLUMBING"
    const phaseMatch = line.match(/Phase:\s*(\d+)\s*-\s*(.+)/i);
    if (phaseMatch) {
      currentPhase = {
        code: parseInt(phaseMatch[1]),
        name: phaseMatch[2].trim()
      };
      continue;
    }
    
    // Match budget line items
    // Format: Cat#  Description  [numbers...]
    // e.g.: "1        Mobilization / Demobilization                                        0          0           2,500       0%         -2,500"
    if (currentPhase) {
      // Try to match a line item (starts with a number)
      const lineMatch = line.match(/^\s*(\d+)\s+(.+?)\s{2,}([\d,.-]+)?\s+([\d,.-]+)?\s+([\d,.-]+)?\s+([\d,.-]+)?\s+[\d]+%\s+([\d,.-]+)?/);
      if (lineMatch) {
        const name = lineMatch[2].trim();
        // Skip if it looks like a total line
        if (name.toLowerCase().includes('total') || name.toLowerCase().includes('phase')) continue;
        
        const parseNumber = (str: string | undefined): number => {
          if (!str) return 0;
          return parseFloat(str.replace(/,/g, '')) || 0;
        };
        
        items.push({
          phaseCode: currentPhase.code,
          phaseName: currentPhase.name,
          categoryNumber: parseInt(lineMatch[1]),
          name,
          contractAmount: parseNumber(lineMatch[3]),
          billedToDate: parseNumber(lineMatch[4]),
          actualCost: parseNumber(lineMatch[5]),
          budgetedAmount: parseNumber(lineMatch[6]),
          budgetedHours: 0,
          actualHours: 0
        });
      }
    }
  }
  
  return items;
}

// POST /api/projects/[slug]/budget/import-pdf - Import budget from Walker Company PDF
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get project
    const project = await prisma.project.findFirst({
      where: { slug: params.slug },
      include: { ProjectBudget: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get or create project budget
    let budget = project.ProjectBudget?.[0];
    if (!budget) {
      budget = await prisma.projectBudget.create({
        data: {
          projectId: project.id,
          totalBudget: 0,
          contingency: 0,
          baselineDate: new Date()
        }
      });
    }

    // Read PDF using LLM API
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Use LLM to extract budget data from PDF
    const llmResult = await callLLM(
      [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64
              }
            },
            {
              type: 'text',
              text: `Extract all budget line items from this Walker Company Job Cost Report PDF.

For each line item, provide:
- phaseCode (numeric, e.g., 100, 200, 2300)
- phaseName (e.g., "GENERAL REQUIREMENTS", "SITEWORK")
- categoryNumber (the Cat. number, 1, 2, 3, etc.)
- name (the Description)
- budgetedAmount (the Budget column amount)
- actualCost (the Actual column amount)
- billedToDate (the Billed column amount, usually 0)

Return as a JSON array. Example:
[
  {"phaseCode": 100, "phaseName": "GENERAL REQUIREMENTS", "categoryNumber": 1, "name": "Mobilization", "budgetedAmount": 2500, "actualCost": 0, "billedToDate": 0},
  ...
]

Only return the JSON array, no other text.`
            }
          ] as any
        }
      ],
      { model: EXTRACTION_MODEL, max_tokens: 4096 }
    );

    const content = llmResult.content || '';
    
    // Parse JSON from LLM response
    let parsedItems: any[] = [];
    try {
      // Extract JSON array from response
      const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        parsedItems = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse LLM response:', e);
      return NextResponse.json(
        { error: 'Failed to parse budget data from PDF' },
        { status: 500 }
      );
    }

    // Create budget items
    let itemsCreated = 0;
    let totalBudgetAdded = 0;

    for (const item of parsedItems) {
      // Skip if no name
      if (!item.name || item.name.toLowerCase().includes('total')) continue;
      
      const costCode = `${item.phaseCode || 0}-${String(item.categoryNumber || 1).padStart(2, '0')}`;
      
      // Check if item already exists
      const existing = await prisma.budgetItem.findFirst({
        where: {
          budgetId: budget.id,
          phaseCode: item.phaseCode,
          categoryNumber: item.categoryNumber
        }
      });

      if (existing) {
        // Update existing item
        await prisma.budgetItem.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            budgetedAmount: item.budgetedAmount || 0,
            actualCost: item.actualCost || 0,
            billedToDate: item.billedToDate || 0
          }
        });
      } else {
        // Create new item
        await prisma.budgetItem.create({
          data: {
            budgetId: budget.id,
            name: item.name,
            costCode,
            phaseCode: item.phaseCode || null,
            phaseName: item.phaseName || null,
            categoryNumber: item.categoryNumber || 1,
            budgetedAmount: item.budgetedAmount || 0,
            actualCost: item.actualCost || 0,
            billedToDate: item.billedToDate || 0,
            committedCost: 0,
            actualHours: 0,
            budgetedHours: 0
          }
        });
        itemsCreated++;
        totalBudgetAdded += item.budgetedAmount || 0;
      }
    }

    // Update total budget
    if (totalBudgetAdded > 0) {
      await prisma.projectBudget.update({
        where: { id: budget.id },
        data: {
          totalBudget: {
            increment: totalBudgetAdded
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      itemsCreated,
      totalItems: parsedItems.length,
      totalBudgetAdded
    });
  } catch (error) {
    console.error('[API] Error importing PDF:', error);
    return NextResponse.json(
      { error: 'Failed to import budget from PDF' },
      { status: 500 }
    );
  }
}
