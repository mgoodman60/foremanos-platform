/**
 * Contract Extraction Service
 * Uses AI to extract key terms and data from subcontractor contracts
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.ABACUSAI_API_KEY,
  baseURL: 'https://api.abacus.ai/llm/v1',
});

export interface ExtractedContractData {
  // Identification
  contractNumber?: string;
  title?: string;
  contractType?: string;
  
  // Parties
  contractorName?: string;
  subcontractorName?: string;
  
  // Financial
  contractValue?: number;
  retainagePercent?: number;
  
  // Dates
  executionDate?: string;
  effectiveDate?: string;
  completionDate?: string;
  
  // Scope
  scopeOfWork?: string;
  inclusions?: string[];
  exclusions?: string[];
  
  // Payment terms
  paymentTerms?: string;
  billingSchedule?: string;
  
  // Insurance requirements
  glRequired?: number;
  wcRequired?: boolean;
  autoRequired?: number;
  umbrellaRequired?: number;
  bondRequired?: boolean;
  bondAmount?: number;
  
  // Key clauses
  liquidatedDamages?: number;
  warrantyPeriod?: number;  // months
  changeOrderProcess?: string;
  disputeResolution?: string;
  terminationClauses?: string;
  
  // AI confidence
  confidence?: number;
  extractionNotes?: string;
}

export async function extractContractData(
  pdfContent: Buffer,
  fileName: string
): Promise<ExtractedContractData> {
  try {
    const base64Content = pdfContent.toString('base64');
    
    const systemPrompt = `You are an expert construction contract analyst. Extract key terms and data from subcontractor contracts.

Analyze the provided contract PDF and extract all relevant information in a structured format.

IMPORTANT:
- Extract exact values from the document
- For monetary values, extract the number only (e.g., 500000 not "$500,000")
- For percentages, extract as decimal (e.g., 10 for 10%, not 0.10)
- For dates, use ISO format YYYY-MM-DD
- If a value is not found, omit it from the response
- Provide a confidence score (0-100) based on how much information you could reliably extract`;

    const userPrompt = `Extract contract data from this subcontractor contract document: ${fileName}

Provide the extracted data as a JSON object with these fields:
{
  "contractNumber": "contract/agreement number if found",
  "title": "contract title or subject",
  "contractType": "SUBCONTRACT | PURCHASE_ORDER | SERVICE_AGREEMENT | MASTER_AGREEMENT | TASK_ORDER",
  "contractorName": "general contractor name",
  "subcontractorName": "subcontractor company name",
  "contractValue": numeric value,
  "retainagePercent": numeric percentage,
  "executionDate": "YYYY-MM-DD",
  "effectiveDate": "YYYY-MM-DD",
  "completionDate": "YYYY-MM-DD",
  "scopeOfWork": "full scope description",
  "inclusions": ["list of included items"],
  "exclusions": ["list of excluded items"],
  "paymentTerms": "payment terms description (e.g., Net 30)",
  "billingSchedule": "WEEKLY | BIWEEKLY | MONTHLY | MILESTONE | COMPLETION",
  "glRequired": minimum general liability coverage amount,
  "wcRequired": true/false if workers comp required,
  "autoRequired": minimum auto liability coverage amount,
  "umbrellaRequired": minimum umbrella coverage amount,
  "bondRequired": true/false if bond required,
  "bondAmount": bond amount if required,
  "liquidatedDamages": per-day amount,
  "warrantyPeriod": months,
  "changeOrderProcess": "description of CO process",
  "disputeResolution": "arbitration/litigation/mediation details",
  "terminationClauses": "termination conditions",
  "confidence": 0-100,
  "extractionNotes": "any important notes about the extraction"
}

ONLY respond with valid JSON. Do not include any other text.`;

    const response = await openai.chat.completions.create({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64Content}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    
    // Parse JSON from response, handling markdown code blocks
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const extracted = JSON.parse(jsonStr) as ExtractedContractData;
    
    console.log(`[Contract Extraction] Extracted data from ${fileName} with ${extracted.confidence || 0}% confidence`);
    
    return extracted;
  } catch (error) {
    console.error('[Contract Extraction] Error:', error);
    return {
      confidence: 0,
      extractionNotes: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check contract insurance compliance
 */
export function checkInsuranceCompliance(
  contract: {
    glRequired?: number | null;
    wcRequired?: boolean;
    autoRequired?: number | null;
    umbrellaRequired?: number | null;
  },
  certificates: Array<{
    certType: string;
    coverageAmount: number;
    expirationDate: Date;
    isCompliant: boolean;
  }>
): {
  isCompliant: boolean;
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  // Check General Liability
  if (contract.glRequired) {
    const glCert = certificates.find(c => c.certType === 'GENERAL_LIABILITY');
    if (!glCert) {
      issues.push(`Missing General Liability certificate (min $${contract.glRequired.toLocaleString()} required)`);
    } else if (glCert.coverageAmount < contract.glRequired) {
      issues.push(`General Liability coverage insufficient: $${glCert.coverageAmount.toLocaleString()} < $${contract.glRequired.toLocaleString()} required`);
    } else if (glCert.expirationDate < now) {
      issues.push('General Liability certificate has expired');
    } else if (glCert.expirationDate < thirtyDaysFromNow) {
      warnings.push('General Liability certificate expires within 30 days');
    }
  }
  
  // Check Workers Comp
  if (contract.wcRequired) {
    const wcCert = certificates.find(c => c.certType === 'WORKERS_COMP');
    if (!wcCert) {
      issues.push('Missing Workers Compensation certificate');
    } else if (wcCert.expirationDate < now) {
      issues.push('Workers Compensation certificate has expired');
    } else if (wcCert.expirationDate < thirtyDaysFromNow) {
      warnings.push('Workers Compensation certificate expires within 30 days');
    }
  }
  
  // Check Auto Liability
  if (contract.autoRequired) {
    const autoCert = certificates.find(c => c.certType === 'AUTO_LIABILITY');
    if (!autoCert) {
      issues.push(`Missing Auto Liability certificate (min $${contract.autoRequired.toLocaleString()} required)`);
    } else if (autoCert.coverageAmount < contract.autoRequired) {
      issues.push(`Auto Liability coverage insufficient: $${autoCert.coverageAmount.toLocaleString()} < $${contract.autoRequired.toLocaleString()} required`);
    } else if (autoCert.expirationDate < now) {
      issues.push('Auto Liability certificate has expired');
    } else if (autoCert.expirationDate < thirtyDaysFromNow) {
      warnings.push('Auto Liability certificate expires within 30 days');
    }
  }
  
  // Check Umbrella/Excess
  if (contract.umbrellaRequired) {
    const umbrellaCert = certificates.find(c => c.certType === 'UMBRELLA_EXCESS');
    if (!umbrellaCert) {
      issues.push(`Missing Umbrella/Excess certificate (min $${contract.umbrellaRequired.toLocaleString()} required)`);
    } else if (umbrellaCert.coverageAmount < contract.umbrellaRequired) {
      issues.push(`Umbrella/Excess coverage insufficient: $${umbrellaCert.coverageAmount.toLocaleString()} < $${contract.umbrellaRequired.toLocaleString()} required`);
    } else if (umbrellaCert.expirationDate < now) {
      issues.push('Umbrella/Excess certificate has expired');
    } else if (umbrellaCert.expirationDate < thirtyDaysFromNow) {
      warnings.push('Umbrella/Excess certificate expires within 30 days');
    }
  }
  
  return {
    isCompliant: issues.length === 0,
    issues,
    warnings,
  };
}

/**
 * Calculate contract financial summary
 */
export function calculateContractFinancials(
  contract: {
    originalValue: number;
    currentValue: number;
    retainagePercent: number;
  },
  payments: Array<{
    grossAmount: number;
    retainageHeld: number;
    currentPayment: number;
    status: string;
  }>,
  changeOrders: Array<{
    approvedAmount: number | null;
    status: string;
  }>
): {
  originalValue: number;
  approvedCOs: number;
  currentValue: number;
  totalBilled: number;
  totalPaid: number;
  retainageHeld: number;
  balanceRemaining: number;
  percentComplete: number;
} {
  const approvedCOs = changeOrders
    .filter(co => co.status === 'APPROVED' && co.approvedAmount)
    .reduce((sum, co) => sum + (co.approvedAmount || 0), 0);
  
  const paidPayments = payments.filter(p => p.status === 'PAID' || p.status === 'PARTIAL');
  const totalBilled = payments.reduce((sum, p) => sum + p.grossAmount, 0);
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.currentPayment, 0);
  const retainageHeld = payments.reduce((sum, p) => sum + p.retainageHeld, 0);
  
  return {
    originalValue: contract.originalValue,
    approvedCOs,
    currentValue: contract.currentValue,
    totalBilled,
    totalPaid,
    retainageHeld,
    balanceRemaining: contract.currentValue - totalPaid - retainageHeld,
    percentComplete: contract.currentValue > 0 
      ? Math.round((totalPaid + retainageHeld) / contract.currentValue * 100) 
      : 0,
  };
}
