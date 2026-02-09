/**
 * Pay Application Parser Service
 * Uses AI to extract payment application data from uploaded documents (PDF, Excel, images)
 */

import OpenAI from 'openai';
import { readFileSync } from 'fs';
import path from 'path';
import { EXTRACTION_MODEL } from '@/lib/model-config';
import { logger } from '@/lib/logger';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openaiInstance;
}

export interface ParsedPayAppItem {
  lineNumber?: number;
  costCode?: string;
  description: string;
  scheduledValue: number;
  fromPreviousApp: number;
  thisApplication: number;
  materialsStored: number;
  totalCompleted: number;
  percentComplete: number;
  balanceToFinish: number;
  retainage: number;
}

export interface ParsedPayApp {
  applicationNumber: number;
  periodStart: string;
  periodEnd: string;
  scheduledValue: number;
  previouslyApproved: number;
  currentPeriod: number;
  totalCompleted: number;
  retainage: number;
  retainagePercent: number;
  netDue: number;
  contractorName?: string;
  projectName?: string;
  items: ParsedPayAppItem[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export async function parsePayAppDocument(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ParsedPayApp> {
  const warnings: string[] = [];
  
  // Convert to base64 for AI processing
  const base64Content = fileBuffer.toString('base64');
  
  const systemPrompt = `You are an expert at parsing construction payment applications, particularly AIA G702/G703 forms.

Extract the following information from the payment application document:
1. Application Number
2. Period dates (start and end)
3. Contract/Scheduled Value
4. Previously Approved amounts
5. Current Period billing
6. Total Completed to date
7. Retainage (amount and percentage)
8. Net Due this period
9. Line items with:
   - Cost code (if available)
   - Description/Item name
   - Scheduled Value
   - From Previous Applications
   - This Application
   - Materials Stored
   - Total Completed
   - Percent Complete
   - Balance to Finish
   - Retainage

Respond ONLY with valid JSON in this exact format:
{
  "applicationNumber": number,
  "periodStart": "YYYY-MM-DD",
  "periodEnd": "YYYY-MM-DD",
  "scheduledValue": number,
  "previouslyApproved": number,
  "currentPeriod": number,
  "totalCompleted": number,
  "retainage": number,
  "retainagePercent": number,
  "netDue": number,
  "contractorName": "string or null",
  "projectName": "string or null",
  "items": [
    {
      "lineNumber": number or null,
      "costCode": "string or null",
      "description": "string",
      "scheduledValue": number,
      "fromPreviousApp": number,
      "thisApplication": number,
      "materialsStored": number,
      "totalCompleted": number,
      "percentComplete": number (0-100),
      "balanceToFinish": number,
      "retainage": number
    }
  ],
  "confidence": "high" | "medium" | "low",
  "warnings": ["array of any issues or missing data"]
}`;

  try {
    let messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Handle different file types
    if (mimeType.includes('pdf') || mimeType.includes('image')) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Parse this payment application document (${fileName}) and extract all payment information. Return JSON only.`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Content}`
            }
          }
        ]
      });
    } else {
      // For Excel/CSV, decode and send as text
      const textContent = fileBuffer.toString('utf-8');
      messages.push({
        role: 'user',
        content: `Parse this payment application data (${fileName}) and extract all payment information. Return JSON only.\n\nDocument content:\n${textContent.substring(0, 50000)}`
      });
    }

    const response = await getOpenAI().chat.completions.create({
      model: EXTRACTION_MODEL,
      messages,
      max_tokens: 8000,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedPayApp;
    
    // Validate required fields
    if (!parsed.applicationNumber) {
      parsed.applicationNumber = 1;
      warnings.push('Application number not found, defaulting to 1');
    }
    
    if (!parsed.periodStart || !parsed.periodEnd) {
      const today = new Date();
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      parsed.periodStart = parsed.periodStart || firstOfMonth.toISOString().split('T')[0];
      parsed.periodEnd = parsed.periodEnd || today.toISOString().split('T')[0];
      warnings.push('Period dates not found, using current month');
    }

    // Calculate derived values if missing
    if (parsed.items && parsed.items.length > 0) {
      // Sum from items if header values are missing
      if (!parsed.scheduledValue) {
        parsed.scheduledValue = parsed.items.reduce((sum, item) => sum + (item.scheduledValue || 0), 0);
      }
      if (!parsed.totalCompleted) {
        parsed.totalCompleted = parsed.items.reduce((sum, item) => sum + (item.totalCompleted || 0), 0);
      }
      if (!parsed.currentPeriod) {
        parsed.currentPeriod = parsed.items.reduce((sum, item) => sum + (item.thisApplication || 0), 0);
      }
      if (!parsed.previouslyApproved) {
        parsed.previouslyApproved = parsed.items.reduce((sum, item) => sum + (item.fromPreviousApp || 0), 0);
      }
    }

    // Calculate retainage if not provided
    if (!parsed.retainage && parsed.retainagePercent && parsed.totalCompleted) {
      parsed.retainage = parsed.totalCompleted * (parsed.retainagePercent / 100);
    }
    if (!parsed.retainagePercent && parsed.retainage && parsed.totalCompleted) {
      parsed.retainagePercent = (parsed.retainage / parsed.totalCompleted) * 100;
    }

    // Calculate net due
    if (!parsed.netDue) {
      parsed.netDue = parsed.currentPeriod - (parsed.retainage || 0);
    }

    parsed.warnings = [...(parsed.warnings || []), ...warnings];
    
    return parsed;
    
  } catch (error) {
    logger.error('PAY_APP_PARSER', 'Error parsing payment application', error as Error);
    throw new Error(`Failed to parse payment application: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Match parsed items to existing budget items using fuzzy matching
 */
export function matchItemsToBudget(
  parsedItems: ParsedPayAppItem[],
  budgetItems: { id: string; costCode?: string | null; name: string; description?: string | null }[]
): Map<ParsedPayAppItem, string | null> {
  const matches = new Map<ParsedPayAppItem, string | null>();
  
  for (const item of parsedItems) {
    let bestMatch: string | null = null;
    let bestScore = 0;
    
    for (const budget of budgetItems) {
      let score = 0;
      
      // Exact cost code match
      if (item.costCode && budget.costCode && 
          item.costCode.toLowerCase() === budget.costCode.toLowerCase()) {
        score += 100;
      }
      
      // Partial cost code match
      if (item.costCode && budget.costCode) {
        const itemCode = item.costCode.replace(/[^0-9]/g, '');
        const budgetCode = budget.costCode.replace(/[^0-9]/g, '');
        if (itemCode === budgetCode) {
          score += 50;
        }
      }
      
      // Description similarity
      const descWords = item.description.toLowerCase().split(/\s+/);
      const budgetWords = (budget.name + ' ' + (budget.description || '')).toLowerCase().split(/\s+/);
      const commonWords = descWords.filter(w => budgetWords.includes(w) && w.length > 2);
      score += commonWords.length * 10;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = budget.id;
      }
    }
    
    // Only match if score is above threshold
    matches.set(item, bestScore >= 20 ? bestMatch : null);
  }
  
  return matches;
}
