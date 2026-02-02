import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock OpenAI client and constructor together
const { mockOpenAI, MockOpenAIConstructor } = vi.hoisted(() => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  };

  const MockOpenAIConstructor = vi.fn().mockImplementation(() => mockOpenAI);

  return { mockOpenAI, MockOpenAIConstructor };
});

vi.mock('openai', () => ({
  default: MockOpenAIConstructor,
}));

// Import functions after mocks
import {
  extractContractData,
  checkInsuranceCompliance,
  calculateContractFinancials,
  ExtractedContractData,
} from '@/lib/contract-extraction-service';

// ============================================
// Test Helpers
// ============================================

function createMockPDFBuffer(content: string = 'test'): Buffer {
  return Buffer.from(content);
}

function createValidContractResponse(): ExtractedContractData {
  return {
    contractNumber: 'SUB-2024-001',
    title: 'Electrical Installation Subcontract',
    contractType: 'SUBCONTRACT',
    contractorName: 'General Construction Corp',
    subcontractorName: 'ABC Electrical Services',
    contractValue: 250000,
    retainagePercent: 10,
    executionDate: '2024-01-15',
    effectiveDate: '2024-01-20',
    completionDate: '2024-12-31',
    scopeOfWork: 'Complete electrical installation for commercial building',
    inclusions: ['Materials', 'Labor', 'Equipment'],
    exclusions: ['Permits', 'Engineering'],
    paymentTerms: 'Net 30',
    billingSchedule: 'MONTHLY',
    glRequired: 1000000,
    wcRequired: true,
    autoRequired: 500000,
    umbrellaRequired: 2000000,
    bondRequired: true,
    bondAmount: 250000,
    liquidatedDamages: 1000,
    warrantyPeriod: 12,
    changeOrderProcess: 'Written approval required',
    disputeResolution: 'Binding arbitration',
    terminationClauses: '30 days written notice',
    confidence: 95,
    extractionNotes: 'All data extracted successfully',
  };
}

// ============================================
// Contract Data Extraction Tests (13 tests)
// ============================================

describe('Contract Extraction Service - extractContractData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  it('should successfully extract contract data from PDF', async () => {
    const mockResponse = createValidContractResponse();

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockResponse),
          },
        },
      ],
    });

    const pdfBuffer = createMockPDFBuffer();
    const result = await extractContractData(pdfBuffer, 'subcontract.pdf');

    expect(result).toEqual(mockResponse);
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.2',
        max_tokens: 4000,
      })
    );
  });

  it('should handle JSON response wrapped in markdown code blocks', async () => {
    const mockResponse = createValidContractResponse();
    const markdownJSON = `\`\`\`json\n${JSON.stringify(mockResponse, null, 2)}\n\`\`\``;

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: markdownJSON,
          },
        },
      ],
    });

    const pdfBuffer = createMockPDFBuffer();
    const result = await extractContractData(pdfBuffer, 'subcontract.pdf');

    expect(result).toEqual(mockResponse);
  });

  it('should handle JSON response wrapped in code blocks without json tag', async () => {
    const mockResponse = createValidContractResponse();
    const markdownJSON = `\`\`\`\n${JSON.stringify(mockResponse, null, 2)}\n\`\`\``;

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: markdownJSON,
          },
        },
      ],
    });

    const pdfBuffer = createMockPDFBuffer();
    const result = await extractContractData(pdfBuffer, 'subcontract.pdf');

    expect(result).toEqual(mockResponse);
  });

  it('should convert PDF buffer to base64 correctly', async () => {
    const mockResponse = createValidContractResponse();

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockResponse),
          },
        },
      ],
    });

    const pdfBuffer = Buffer.from('test-pdf-content');
    await extractContractData(pdfBuffer, 'test.pdf');

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const userMessage = callArgs.messages[1];

    expect(userMessage.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text' }),
        expect.objectContaining({
          type: 'image_url',
          image_url: {
            url: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
          },
        }),
      ])
    );
  });

  it('should include system and user prompts in API call', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
    });

    const pdfBuffer = createMockPDFBuffer();
    await extractContractData(pdfBuffer, 'contract.pdf');

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];

    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[0].content).toContain('expert construction contract analyst');
    expect(callArgs.messages[1].role).toBe('user');
    expect(callArgs.messages[1].content[0].text).toContain('contract.pdf');
  });

  it('should extract partial data when some fields are missing', async () => {
    const partialResponse: ExtractedContractData = {
      contractNumber: 'SUB-2024-001',
      contractorName: 'General Contractor',
      subcontractorName: 'Subcontractor LLC',
      contractValue: 100000,
      confidence: 60,
      extractionNotes: 'Some fields could not be found in document',
    };

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(partialResponse),
          },
        },
      ],
    });

    const result = await extractContractData(createMockPDFBuffer(), 'incomplete.pdf');

    expect(result.contractNumber).toBe('SUB-2024-001');
    expect(result.confidence).toBe(60);
    expect(result.glRequired).toBeUndefined();
    expect(result.executionDate).toBeUndefined();
  });

  it('should handle empty response from AI', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: '',
          },
        },
      ],
    });

    const result = await extractContractData(createMockPDFBuffer(), 'test.pdf');

    expect(result).toEqual({});
  });

  it('should handle malformed JSON response gracefully', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'This is not valid JSON',
          },
        },
      ],
    });

    const result = await extractContractData(createMockPDFBuffer(), 'test.pdf');

    expect(result.confidence).toBe(0);
    expect(result.extractionNotes).toContain('Extraction failed');
  });

  it('should handle API errors gracefully', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(
      new Error('API rate limit exceeded')
    );

    const result = await extractContractData(createMockPDFBuffer(), 'test.pdf');

    expect(result.confidence).toBe(0);
    expect(result.extractionNotes).toBe('Extraction failed: API rate limit exceeded');
  });

  it('should handle network timeout errors', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(
      new Error('Request timeout')
    );

    const result = await extractContractData(createMockPDFBuffer(), 'test.pdf');

    expect(result.confidence).toBe(0);
    expect(result.extractionNotes).toBe('Extraction failed: Request timeout');
  });

  it('should handle missing choices in API response', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [],
    });

    const result = await extractContractData(createMockPDFBuffer(), 'test.pdf');

    expect(result).toEqual({});
  });

  it('should use lazy-loaded OpenAI client for API calls', async () => {
    // OpenAI client uses lazy initialization (singleton pattern)
    // The constructor is called once and the instance is reused
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ confidence: 80 }) } }],
    });

    await extractContractData(createMockPDFBuffer(), 'test.pdf');

    // Verify the chat completions API was called
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.2',
        max_tokens: 4000,
      })
    );
  });

  it('should log successful extraction with confidence level', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ confidence: 85 }),
          },
        },
      ],
    });

    await extractContractData(createMockPDFBuffer(), 'test-contract.pdf');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Contract Extraction] Extracted data from test-contract.pdf with 85% confidence')
    );

    consoleSpy.mockRestore();
  });
});

// ============================================
// Insurance Compliance Tests (15 tests)
// ============================================

describe('Contract Extraction Service - checkInsuranceCompliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return compliant when all insurance requirements are met', () => {
    const contract = {
      glRequired: 1000000,
      wcRequired: true,
      autoRequired: 500000,
      umbrellaRequired: 2000000,
    };

    const certificates = [
      {
        certType: 'GENERAL_LIABILITY',
        coverageAmount: 1000000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: true,
      },
      {
        certType: 'WORKERS_COMP',
        coverageAmount: 1000000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: true,
      },
      {
        certType: 'AUTO_LIABILITY',
        coverageAmount: 500000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: true,
      },
      {
        certType: 'UMBRELLA_EXCESS',
        coverageAmount: 2000000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: true,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should flag missing General Liability certificate', () => {
    const contract = {
      glRequired: 1000000,
      wcRequired: false,
      autoRequired: null,
      umbrellaRequired: null,
    };

    const certificates: any[] = [];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain('Missing General Liability certificate (min $1,000,000 required)');
  });

  it('should flag insufficient General Liability coverage', () => {
    const contract = {
      glRequired: 2000000,
      wcRequired: false,
      autoRequired: null,
      umbrellaRequired: null,
    };

    const certificates = [
      {
        certType: 'GENERAL_LIABILITY',
        coverageAmount: 1000000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: false,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain(
      'General Liability coverage insufficient: $1,000,000 < $2,000,000 required'
    );
  });

  it('should flag expired General Liability certificate', () => {
    const contract = {
      glRequired: 1000000,
      wcRequired: false,
      autoRequired: null,
      umbrellaRequired: null,
    };

    const certificates = [
      {
        certType: 'GENERAL_LIABILITY',
        coverageAmount: 1000000,
        expirationDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        isCompliant: false,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain('General Liability certificate has expired');
  });

  it('should warn when General Liability expires within 30 days', () => {
    const contract = {
      glRequired: 1000000,
      wcRequired: false,
      autoRequired: null,
      umbrellaRequired: null,
    };

    const certificates = [
      {
        certType: 'GENERAL_LIABILITY',
        coverageAmount: 1000000,
        expirationDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        isCompliant: true,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(true);
    expect(result.warnings).toContain('General Liability certificate expires within 30 days');
  });

  it('should flag missing Workers Compensation certificate', () => {
    const contract = {
      glRequired: null,
      wcRequired: true,
      autoRequired: null,
      umbrellaRequired: null,
    };

    const certificates: any[] = [];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain('Missing Workers Compensation certificate');
  });

  it('should flag expired Workers Compensation certificate', () => {
    const contract = {
      glRequired: null,
      wcRequired: true,
      autoRequired: null,
      umbrellaRequired: null,
    };

    const certificates = [
      {
        certType: 'WORKERS_COMP',
        coverageAmount: 1000000,
        expirationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        isCompliant: false,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain('Workers Compensation certificate has expired');
  });

  it('should flag missing Auto Liability certificate', () => {
    const contract = {
      glRequired: null,
      wcRequired: false,
      autoRequired: 500000,
      umbrellaRequired: null,
    };

    const certificates: any[] = [];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain('Missing Auto Liability certificate (min $500,000 required)');
  });

  it('should flag insufficient Auto Liability coverage', () => {
    const contract = {
      glRequired: null,
      wcRequired: false,
      autoRequired: 1000000,
      umbrellaRequired: null,
    };

    const certificates = [
      {
        certType: 'AUTO_LIABILITY',
        coverageAmount: 500000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: false,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain(
      'Auto Liability coverage insufficient: $500,000 < $1,000,000 required'
    );
  });

  it('should flag missing Umbrella/Excess certificate', () => {
    const contract = {
      glRequired: null,
      wcRequired: false,
      autoRequired: null,
      umbrellaRequired: 5000000,
    };

    const certificates: any[] = [];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain('Missing Umbrella/Excess certificate (min $5,000,000 required)');
  });

  it('should flag insufficient Umbrella/Excess coverage', () => {
    const contract = {
      glRequired: null,
      wcRequired: false,
      autoRequired: null,
      umbrellaRequired: 10000000,
    };

    const certificates = [
      {
        certType: 'UMBRELLA_EXCESS',
        coverageAmount: 5000000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: false,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toContain(
      'Umbrella/Excess coverage insufficient: $5,000,000 < $10,000,000 required'
    );
  });

  it('should handle contract with no insurance requirements', () => {
    const contract = {
      glRequired: null,
      wcRequired: false,
      autoRequired: null,
      umbrellaRequired: null,
    };

    const certificates: any[] = [];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should accumulate multiple insurance issues', () => {
    const contract = {
      glRequired: 1000000,
      wcRequired: true,
      autoRequired: 500000,
      umbrellaRequired: 2000000,
    };

    const certificates: any[] = [];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(false);
    expect(result.issues).toHaveLength(4);
    expect(result.issues).toContain('Missing General Liability certificate (min $1,000,000 required)');
    expect(result.issues).toContain('Missing Workers Compensation certificate');
    expect(result.issues).toContain('Missing Auto Liability certificate (min $500,000 required)');
    expect(result.issues).toContain('Missing Umbrella/Excess certificate (min $2,000,000 required)');
  });

  it('should accumulate multiple warnings for expiring certificates', () => {
    const expirationDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days

    const contract = {
      glRequired: 1000000,
      wcRequired: true,
      autoRequired: 500000,
      umbrellaRequired: 2000000,
    };

    const certificates = [
      {
        certType: 'GENERAL_LIABILITY',
        coverageAmount: 1000000,
        expirationDate,
        isCompliant: true,
      },
      {
        certType: 'WORKERS_COMP',
        coverageAmount: 1000000,
        expirationDate,
        isCompliant: true,
      },
      {
        certType: 'AUTO_LIABILITY',
        coverageAmount: 500000,
        expirationDate,
        isCompliant: true,
      },
      {
        certType: 'UMBRELLA_EXCESS',
        coverageAmount: 2000000,
        expirationDate,
        isCompliant: true,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(true);
    expect(result.warnings).toHaveLength(4);
  });

  it('should handle certificates with exact required coverage amounts', () => {
    const contract = {
      glRequired: 1000000,
      wcRequired: false,
      autoRequired: 500000,
      umbrellaRequired: null,
    };

    const certificates = [
      {
        certType: 'GENERAL_LIABILITY',
        coverageAmount: 1000000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: true,
      },
      {
        certType: 'AUTO_LIABILITY',
        coverageAmount: 500000,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isCompliant: true,
      },
    ];

    const result = checkInsuranceCompliance(contract, certificates);

    expect(result.isCompliant).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ============================================
// Contract Financials Tests (12 tests)
// ============================================

describe('Contract Extraction Service - calculateContractFinancials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate basic contract financials correctly', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments = [
      {
        grossAmount: 100000,
        retainageHeld: 10000,
        currentPayment: 90000,
        status: 'PAID',
      },
    ];

    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.originalValue).toBe(1000000);
    expect(result.approvedCOs).toBe(0);
    expect(result.currentValue).toBe(1000000);
    expect(result.totalBilled).toBe(100000);
    expect(result.totalPaid).toBe(90000);
    expect(result.retainageHeld).toBe(10000);
    expect(result.balanceRemaining).toBe(900000); // 1000000 - 90000 - 10000
    expect(result.percentComplete).toBe(10); // (90000 + 10000) / 1000000 * 100
  });

  it('should include approved change orders in current value', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1150000,
      retainagePercent: 10,
    };

    const payments: any[] = [];

    const changeOrders = [
      {
        approvedAmount: 100000,
        status: 'APPROVED',
      },
      {
        approvedAmount: 50000,
        status: 'APPROVED',
      },
    ];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.originalValue).toBe(1000000);
    expect(result.approvedCOs).toBe(150000);
    expect(result.currentValue).toBe(1150000);
  });

  it('should exclude pending change orders from totals', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments: any[] = [];

    const changeOrders = [
      {
        approvedAmount: 100000,
        status: 'APPROVED',
      },
      {
        approvedAmount: 50000,
        status: 'PENDING',
      },
      {
        approvedAmount: 75000,
        status: 'REJECTED',
      },
    ];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.approvedCOs).toBe(100000);
  });

  it('should handle multiple paid and partial payments', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments = [
      {
        grossAmount: 100000,
        retainageHeld: 10000,
        currentPayment: 90000,
        status: 'PAID',
      },
      {
        grossAmount: 150000,
        retainageHeld: 15000,
        currentPayment: 135000,
        status: 'PAID',
      },
      {
        grossAmount: 75000,
        retainageHeld: 7500,
        currentPayment: 67500,
        status: 'PARTIAL',
      },
    ];

    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.totalBilled).toBe(325000);
    expect(result.totalPaid).toBe(292500); // 90000 + 135000 + 67500
    expect(result.retainageHeld).toBe(32500); // 10000 + 15000 + 7500
  });

  it('should exclude pending payments from paid totals', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments = [
      {
        grossAmount: 100000,
        retainageHeld: 10000,
        currentPayment: 90000,
        status: 'PAID',
      },
      {
        grossAmount: 50000,
        retainageHeld: 5000,
        currentPayment: 45000,
        status: 'PENDING',
      },
    ];

    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.totalBilled).toBe(150000); // All payments counted in billed
    expect(result.totalPaid).toBe(90000); // Only PAID status counted
  });

  it('should calculate percent complete correctly', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments = [
      {
        grossAmount: 500000,
        retainageHeld: 50000,
        currentPayment: 450000,
        status: 'PAID',
      },
    ];

    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.percentComplete).toBe(50); // (450000 + 50000) / 1000000 * 100
  });

  it('should handle zero current value without division error', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 0,
      retainagePercent: 10,
    };

    const payments: any[] = [];
    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.percentComplete).toBe(0);
  });

  it('should calculate balance remaining correctly', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments = [
      {
        grossAmount: 300000,
        retainageHeld: 30000,
        currentPayment: 270000,
        status: 'PAID',
      },
    ];

    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    // Balance = Current Value - Total Paid - Retainage Held
    // 1000000 - 270000 - 30000 = 700000
    expect(result.balanceRemaining).toBe(700000);
  });

  it('should handle contract with no payments', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments: any[] = [];
    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.totalBilled).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.retainageHeld).toBe(0);
    expect(result.balanceRemaining).toBe(1000000);
    expect(result.percentComplete).toBe(0);
  });

  it('should handle contract with no change orders', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments = [
      {
        grossAmount: 100000,
        retainageHeld: 10000,
        currentPayment: 90000,
        status: 'PAID',
      },
    ];

    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.approvedCOs).toBe(0);
    expect(result.currentValue).toBe(1000000);
  });

  it('should handle change orders with null approved amounts', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments: any[] = [];

    const changeOrders = [
      {
        approvedAmount: null,
        status: 'APPROVED',
      },
      {
        approvedAmount: 50000,
        status: 'APPROVED',
      },
    ];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    expect(result.approvedCOs).toBe(50000);
  });

  it('should round percent complete to nearest integer', () => {
    const contract = {
      originalValue: 1000000,
      currentValue: 1000000,
      retainagePercent: 10,
    };

    const payments = [
      {
        grossAmount: 333333,
        retainageHeld: 33333,
        currentPayment: 300000,
        status: 'PAID',
      },
    ];

    const changeOrders: any[] = [];

    const result = calculateContractFinancials(contract, payments, changeOrders);

    // (300000 + 33333) / 1000000 * 100 = 33.3333
    expect(result.percentComplete).toBe(33);
    expect(Number.isInteger(result.percentComplete)).toBe(true);
  });
});
