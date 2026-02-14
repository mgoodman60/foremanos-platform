import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParsedPayApp, ParsedPayAppItem } from '@/lib/pay-app-parser';

// Mock dependencies using vi.hoisted
const mocks = vi.hoisted(() => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  OpenAI: vi.fn(),
}));

vi.mock('openai', () => ({
  default: mocks.OpenAI,
}));

// Mock fs
const readFileSyncMock = vi.fn();
vi.mock('fs', () => ({
  readFileSync: readFileSyncMock,
}));

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-openai-api-key';

describe('PayAppParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup OpenAI constructor to return mock instance
    mocks.OpenAI.mockReturnValue(mocks.openai);
  });

  describe('parsePayAppDocument', () => {
    describe('PDF and Image Files', () => {
      it('should parse PDF payment application with complete data', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 5,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 500000,
                  previouslyApproved: 350000,
                  currentPeriod: 75000,
                  totalCompleted: 425000,
                  retainage: 21250,
                  retainagePercent: 5,
                  netDue: 53750,
                  contractorName: 'ABC Construction',
                  projectName: 'Office Building',
                  items: [
                    {
                      lineNumber: 1,
                      costCode: '03-30-00',
                      description: 'Concrete Foundation',
                      scheduledValue: 100000,
                      fromPreviousApp: 80000,
                      thisApplication: 15000,
                      materialsStored: 0,
                      totalCompleted: 95000,
                      percentComplete: 95,
                      balanceToFinish: 5000,
                      retainage: 4750,
                    },
                    {
                      lineNumber: 2,
                      costCode: '05-50-00',
                      description: 'Structural Steel',
                      scheduledValue: 200000,
                      fromPreviousApp: 150000,
                      thisApplication: 30000,
                      materialsStored: 5000,
                      totalCompleted: 180000,
                      percentComplete: 90,
                      balanceToFinish: 20000,
                      retainage: 9000,
                    },
                  ],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF content');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app-5.pdf', 'application/pdf');

        expect(result.applicationNumber).toBe(5);
        expect(result.periodStart).toBe('2024-01-01');
        expect(result.periodEnd).toBe('2024-01-31');
        expect(result.scheduledValue).toBe(500000);
        expect(result.currentPeriod).toBe(75000);
        expect(result.retainagePercent).toBe(5);
        expect(result.netDue).toBe(53750);
        expect(result.contractorName).toBe('ABC Construction');
        expect(result.items).toHaveLength(2);
        expect(result.items[0].costCode).toBe('03-30-00');
        expect(result.confidence).toBe('high');

        expect(mocks.openai.chat.completions.create).toHaveBeenCalledWith({
          model: 'claude-opus-4-6',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({ type: 'text' }),
                expect.objectContaining({
                  type: 'image_url',
                  image_url: expect.objectContaining({
                    url: expect.stringContaining('data:application/pdf;base64,'),
                  }),
                }),
              ]),
            }),
          ]),
          max_tokens: 8000,
          temperature: 0.1,
        });
      });

      it('should parse image file (PNG) payment application', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 3,
                  periodStart: '2024-02-01',
                  periodEnd: '2024-02-29',
                  scheduledValue: 250000,
                  previouslyApproved: 100000,
                  currentPeriod: 50000,
                  totalCompleted: 150000,
                  retainage: 7500,
                  retainagePercent: 5,
                  netDue: 42500,
                  items: [
                    {
                      description: 'Electrical Work',
                      scheduledValue: 250000,
                      fromPreviousApp: 100000,
                      thisApplication: 50000,
                      materialsStored: 0,
                      totalCompleted: 150000,
                      percentComplete: 60,
                      balanceToFinish: 100000,
                      retainage: 7500,
                    },
                  ],
                  confidence: 'medium',
                  warnings: ['Cost codes not found'],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PNG image data');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.png', 'image/png');

        expect(result.applicationNumber).toBe(3);
        expect(result.items[0].description).toBe('Electrical Work');
        expect(result.confidence).toBe('medium');

        const callArgs = mocks.openai.chat.completions.create.mock.calls[0][0];
        expect(callArgs.messages[1].content[1].image_url.url).toContain('data:image/png;base64,');
      });
    });

    describe('Excel/CSV Files', () => {
      it('should parse Excel file as text content', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 2,
                  periodStart: '2024-03-01',
                  periodEnd: '2024-03-31',
                  scheduledValue: 300000,
                  previouslyApproved: 150000,
                  currentPeriod: 80000,
                  totalCompleted: 230000,
                  retainage: 11500,
                  retainagePercent: 5,
                  netDue: 68500,
                  items: [
                    {
                      lineNumber: 1,
                      description: 'HVAC Installation',
                      scheduledValue: 300000,
                      fromPreviousApp: 150000,
                      thisApplication: 80000,
                      materialsStored: 10000,
                      totalCompleted: 230000,
                      percentComplete: 76.67,
                      balanceToFinish: 70000,
                      retainage: 11500,
                    },
                  ],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const excelContent = 'Line,Description,Amount\n1,HVAC Installation,80000';
        const fileBuffer = Buffer.from(excelContent);
        const result = await parsePayAppDocument(
          fileBuffer,
          'pay-app.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        expect(result.applicationNumber).toBe(2);
        expect(result.items[0].description).toBe('HVAC Installation');

        const callArgs = mocks.openai.chat.completions.create.mock.calls[0][0];
        expect(callArgs.messages[1].content).toContain('Line,Description,Amount');
        expect(callArgs.messages[1].content).not.toContain('image_url');
      });

      it('should truncate large text files to 50000 characters', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-04-01',
                  periodEnd: '2024-04-30',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 25000,
                  totalCompleted: 25000,
                  retainage: 1250,
                  retainagePercent: 5,
                  netDue: 23750,
                  items: [],
                  confidence: 'low',
                  warnings: ['Large file truncated'],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const largeContent = 'x'.repeat(100000);
        const fileBuffer = Buffer.from(largeContent);
        const result = await parsePayAppDocument(fileBuffer, 'large.csv', 'text/csv');

        expect(result.applicationNumber).toBe(1);

        const callArgs = mocks.openai.chat.completions.create.mock.calls[0][0];
        const messageContent = callArgs.messages[1].content;
        // Message includes header text + truncated content (50000 chars max for file content)
        expect(messageContent.length).toBeLessThanOrEqual(50200); // Header + 50000 char content
      });
    });

    describe('Data Validation and Defaults', () => {
      it('should default missing application number to 1 with warning', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 25000,
                  totalCompleted: 25000,
                  retainage: 1250,
                  retainagePercent: 5,
                  netDue: 23750,
                  items: [],
                  confidence: 'low',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.applicationNumber).toBe(1);
        expect(result.warnings).toContain('Application number not found, defaulting to 1');
      });

      it('should default missing period dates to current month with warning', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 25000,
                  totalCompleted: 25000,
                  retainage: 1250,
                  retainagePercent: 5,
                  netDue: 23750,
                  items: [],
                  confidence: 'low',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result.warnings).toContain('Period dates not found, using current month');
      });

      it('should calculate scheduledValue from items if missing', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  previouslyApproved: 0,
                  currentPeriod: 0,
                  totalCompleted: 0,
                  retainage: 0,
                  retainagePercent: 0,
                  netDue: 0,
                  items: [
                    {
                      description: 'Item 1',
                      scheduledValue: 50000,
                      fromPreviousApp: 0,
                      thisApplication: 10000,
                      materialsStored: 0,
                      totalCompleted: 10000,
                      percentComplete: 20,
                      balanceToFinish: 40000,
                      retainage: 500,
                    },
                    {
                      description: 'Item 2',
                      scheduledValue: 75000,
                      fromPreviousApp: 0,
                      thisApplication: 15000,
                      materialsStored: 0,
                      totalCompleted: 15000,
                      percentComplete: 20,
                      balanceToFinish: 60000,
                      retainage: 750,
                    },
                  ],
                  confidence: 'medium',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.scheduledValue).toBe(125000); // 50000 + 75000
      });

      it('should calculate totalCompleted from items if missing', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 0,
                  retainage: 0,
                  retainagePercent: 0,
                  netDue: 0,
                  items: [
                    {
                      description: 'Item 1',
                      scheduledValue: 100000,
                      fromPreviousApp: 0,
                      thisApplication: 30000,
                      materialsStored: 0,
                      totalCompleted: 30000,
                      percentComplete: 30,
                      balanceToFinish: 70000,
                      retainage: 1500,
                    },
                  ],
                  confidence: 'medium',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.totalCompleted).toBe(30000);
      });

      it('should calculate currentPeriod from items if missing', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  totalCompleted: 0,
                  retainage: 0,
                  retainagePercent: 0,
                  netDue: 0,
                  items: [
                    {
                      description: 'Item 1',
                      scheduledValue: 100000,
                      fromPreviousApp: 0,
                      thisApplication: 25000,
                      materialsStored: 0,
                      totalCompleted: 25000,
                      percentComplete: 25,
                      balanceToFinish: 75000,
                      retainage: 1250,
                    },
                  ],
                  confidence: 'medium',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.currentPeriod).toBe(25000);
      });

      it('should calculate previouslyApproved from items if missing', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 2,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  currentPeriod: 0,
                  totalCompleted: 0,
                  retainage: 0,
                  retainagePercent: 0,
                  netDue: 0,
                  items: [
                    {
                      description: 'Item 1',
                      scheduledValue: 100000,
                      fromPreviousApp: 40000,
                      thisApplication: 20000,
                      materialsStored: 0,
                      totalCompleted: 60000,
                      percentComplete: 60,
                      balanceToFinish: 40000,
                      retainage: 3000,
                    },
                  ],
                  confidence: 'medium',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.previouslyApproved).toBe(40000);
      });

      it('should calculate retainage from retainagePercent and totalCompleted', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 50000,
                  totalCompleted: 50000,
                  retainagePercent: 10,
                  netDue: 0,
                  items: [],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.retainage).toBe(5000); // 50000 * 0.10
      });

      it('should calculate retainagePercent from retainage and totalCompleted', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 40000,
                  totalCompleted: 40000,
                  retainage: 2000,
                  netDue: 0,
                  items: [],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.retainagePercent).toBe(5); // (2000 / 40000) * 100
      });

      it('should calculate netDue from currentPeriod and retainage', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 30000,
                  totalCompleted: 30000,
                  retainage: 1500,
                  retainagePercent: 5,
                  items: [],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.netDue).toBe(28500); // 30000 - 1500
      });

      it('should merge AI warnings with validation warnings', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 25000,
                  totalCompleted: 25000,
                  retainage: 1250,
                  retainagePercent: 5,
                  netDue: 23750,
                  items: [],
                  confidence: 'low',
                  warnings: ['Poor image quality', 'Some values estimated'],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.warnings).toContain('Poor image quality');
        expect(result.warnings).toContain('Some values estimated');
        expect(result.warnings).toContain('Application number not found, defaulting to 1');
      });
    });

    describe('Error Handling', () => {
      it('should throw error when no JSON found in AI response', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: 'This is plain text without JSON',
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');

        await expect(parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf')).rejects.toThrow(
          'No valid JSON found in AI response'
        );
      });

      it('should throw error when AI API fails', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        mocks.openai.chat.completions.create.mockRejectedValue(
          new Error('API rate limit exceeded')
        );

        const fileBuffer = Buffer.from('PDF');

        await expect(parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf')).rejects.toThrow(
          'Failed to parse payment application: API rate limit exceeded'
        );
      });

      it('should throw error when response has no choices', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');

        await expect(parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf')).rejects.toThrow(
          'No valid JSON found in AI response'
        );
      });

      it('should throw error when JSON parsing fails', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: '{ "invalid": json syntax }',
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');

        await expect(parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf')).rejects.toThrow(
          'Failed to parse payment application'
        );
      });
    });

    describe('OpenAI Configuration', () => {
      it('should use Abacus.AI base URL and API key', async () => {
        // Need to clear the module cache and re-import to test initialization
        vi.resetModules();

        // Re-setup mocks after reset
        mocks.OpenAI.mockReturnValue(mocks.openai);

        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 25000,
                  totalCompleted: 25000,
                  retainage: 1250,
                  retainagePercent: 5,
                  netDue: 23750,
                  items: [],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(mocks.OpenAI).toHaveBeenCalledWith({
          apiKey: 'test-openai-api-key',
        });
      });

      it('should reuse OpenAI instance on subsequent calls', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 25000,
                  totalCompleted: 25000,
                  retainage: 1250,
                  retainagePercent: 5,
                  netDue: 23750,
                  items: [],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        await parsePayAppDocument(fileBuffer, 'pay-app-1.pdf', 'application/pdf');

        const initialCallCount = mocks.OpenAI.mock.calls.length;

        await parsePayAppDocument(fileBuffer, 'pay-app-2.pdf', 'application/pdf');

        // Should not create new instance
        expect(mocks.OpenAI).toHaveBeenCalledTimes(initialCallCount);
      });

      it('should use claude-opus-4-6 model with correct parameters', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 100000,
                  previouslyApproved: 0,
                  currentPeriod: 25000,
                  totalCompleted: 25000,
                  retainage: 1250,
                  retainagePercent: 5,
                  netDue: 23750,
                  items: [],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(mocks.openai.chat.completions.create).toHaveBeenCalledWith({
          model: 'claude-opus-4-6',
          messages: expect.any(Array),
          max_tokens: 8000,
          temperature: 0.1,
        });
      });
    });

    describe('Complex Line Items', () => {
      it('should parse multiple line items with varying data completeness', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 4,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 750000,
                  previouslyApproved: 400000,
                  currentPeriod: 150000,
                  totalCompleted: 550000,
                  retainage: 27500,
                  retainagePercent: 5,
                  netDue: 122500,
                  items: [
                    {
                      lineNumber: 1,
                      costCode: '01-00-00',
                      description: 'General Conditions',
                      scheduledValue: 50000,
                      fromPreviousApp: 40000,
                      thisApplication: 5000,
                      materialsStored: 0,
                      totalCompleted: 45000,
                      percentComplete: 90,
                      balanceToFinish: 5000,
                      retainage: 2250,
                    },
                    {
                      lineNumber: 2,
                      description: 'Site Preparation (no cost code)',
                      scheduledValue: 100000,
                      fromPreviousApp: 80000,
                      thisApplication: 15000,
                      materialsStored: 0,
                      totalCompleted: 95000,
                      percentComplete: 95,
                      balanceToFinish: 5000,
                      retainage: 4750,
                    },
                    {
                      costCode: '03-00-00',
                      description: 'Concrete (no line number)',
                      scheduledValue: 200000,
                      fromPreviousApp: 150000,
                      thisApplication: 30000,
                      materialsStored: 5000,
                      totalCompleted: 180000,
                      percentComplete: 90,
                      balanceToFinish: 20000,
                      retainage: 9000,
                    },
                  ],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.items).toHaveLength(3);
        expect(result.items[0].lineNumber).toBe(1);
        expect(result.items[0].costCode).toBe('01-00-00');
        expect(result.items[1].lineNumber).toBe(2);
        expect(result.items[1].costCode).toBeUndefined();
        expect(result.items[2].lineNumber).toBeUndefined();
        expect(result.items[2].costCode).toBe('03-00-00');
      });

      it('should handle items with materials stored', async () => {
        const { parsePayAppDocument } = await import('@/lib/pay-app-parser');

        const mockResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  applicationNumber: 1,
                  periodStart: '2024-01-01',
                  periodEnd: '2024-01-31',
                  scheduledValue: 200000,
                  previouslyApproved: 0,
                  currentPeriod: 50000,
                  totalCompleted: 50000,
                  retainage: 2500,
                  retainagePercent: 5,
                  netDue: 47500,
                  items: [
                    {
                      description: 'Steel Framing',
                      scheduledValue: 200000,
                      fromPreviousApp: 0,
                      thisApplication: 30000,
                      materialsStored: 20000,
                      totalCompleted: 50000,
                      percentComplete: 25,
                      balanceToFinish: 150000,
                      retainage: 2500,
                    },
                  ],
                  confidence: 'high',
                  warnings: [],
                }),
              },
            },
          ],
        };

        mocks.openai.chat.completions.create.mockResolvedValue(mockResponse);

        const fileBuffer = Buffer.from('PDF');
        const result = await parsePayAppDocument(fileBuffer, 'pay-app.pdf', 'application/pdf');

        expect(result.items[0].materialsStored).toBe(20000);
        expect(result.items[0].totalCompleted).toBe(50000);
      });
    });
  });

  describe('matchItemsToBudget', () => {
    it('should match items by exact cost code', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          costCode: '03-30-00',
          description: 'Concrete Foundation',
          scheduledValue: 100000,
          fromPreviousApp: 0,
          thisApplication: 25000,
          materialsStored: 0,
          totalCompleted: 25000,
          percentComplete: 25,
          balanceToFinish: 75000,
          retainage: 1250,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: '03-30-00',
          name: 'Foundation Work',
          description: 'Concrete foundation',
        },
        {
          id: 'budget-2',
          costCode: '05-00-00',
          name: 'Steel',
          description: 'Structural steel',
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      expect(matches.get(parsedItems[0])).toBe('budget-1');
    });

    it('should match items by case-insensitive cost code', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          costCode: 'CSI-03-30',
          description: 'Concrete Work',
          scheduledValue: 50000,
          fromPreviousApp: 0,
          thisApplication: 10000,
          materialsStored: 0,
          totalCompleted: 10000,
          percentComplete: 20,
          balanceToFinish: 40000,
          retainage: 500,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: 'csi-03-30',
          name: 'Concrete Foundation',
          description: null,
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      expect(matches.get(parsedItems[0])).toBe('budget-1');
    });

    it('should match items by partial numeric cost code', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          costCode: 'CSI-26-00-00',
          description: 'Electrical Systems',
          scheduledValue: 150000,
          fromPreviousApp: 0,
          thisApplication: 30000,
          materialsStored: 0,
          totalCompleted: 30000,
          percentComplete: 20,
          balanceToFinish: 120000,
          retainage: 1500,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: '26-00-00',
          name: 'Electrical',
          description: 'Electrical work',
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      // Should match because 'CSI-26-00-00' → '260000' matches '26-00-00' → '260000'
      expect(matches.get(parsedItems[0])).toBe('budget-1');
    });

    it('should match items by description similarity', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          description: 'HVAC mechanical installation',
          scheduledValue: 200000,
          fromPreviousApp: 0,
          thisApplication: 40000,
          materialsStored: 0,
          totalCompleted: 40000,
          percentComplete: 20,
          balanceToFinish: 160000,
          retainage: 2000,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: null,
          name: 'HVAC Systems',
          description: 'Mechanical HVAC installation and equipment',
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      expect(matches.get(parsedItems[0])).toBe('budget-1');
    });

    it('should not match when similarity score is below threshold', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          description: 'Landscaping',
          scheduledValue: 30000,
          fromPreviousApp: 0,
          thisApplication: 5000,
          materialsStored: 0,
          totalCompleted: 5000,
          percentComplete: 16.67,
          balanceToFinish: 25000,
          retainage: 250,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: null,
          name: 'Electrical Work',
          description: 'Power distribution',
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      expect(matches.get(parsedItems[0])).toBeNull();
    });

    it('should prioritize exact cost code over description match', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          costCode: '03-30-00',
          description: 'Foundation work and concrete',
          scheduledValue: 100000,
          fromPreviousApp: 0,
          thisApplication: 20000,
          materialsStored: 0,
          totalCompleted: 20000,
          percentComplete: 20,
          balanceToFinish: 80000,
          retainage: 1000,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: '03-30-00',
          name: 'Concrete',
          description: 'Misc concrete',
        },
        {
          id: 'budget-2',
          costCode: null,
          name: 'Foundation',
          description: 'Foundation work and concrete installation',
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      // Should match budget-1 (exact cost code) not budget-2 (description)
      expect(matches.get(parsedItems[0])).toBe('budget-1');
    });

    it('should match multiple items to different budget items', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          costCode: '03-00-00',
          description: 'Concrete',
          scheduledValue: 100000,
          fromPreviousApp: 0,
          thisApplication: 20000,
          materialsStored: 0,
          totalCompleted: 20000,
          percentComplete: 20,
          balanceToFinish: 80000,
          retainage: 1000,
        },
        {
          costCode: '05-00-00',
          description: 'Steel',
          scheduledValue: 150000,
          fromPreviousApp: 0,
          thisApplication: 30000,
          materialsStored: 0,
          totalCompleted: 30000,
          percentComplete: 20,
          balanceToFinish: 120000,
          retainage: 1500,
        },
        {
          costCode: '26-00-00',
          description: 'Electrical',
          scheduledValue: 80000,
          fromPreviousApp: 0,
          thisApplication: 16000,
          materialsStored: 0,
          totalCompleted: 16000,
          percentComplete: 20,
          balanceToFinish: 64000,
          retainage: 800,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: '03-00-00',
          name: 'Concrete',
          description: null,
        },
        {
          id: 'budget-2',
          costCode: '05-00-00',
          name: 'Steel',
          description: null,
        },
        {
          id: 'budget-3',
          costCode: '26-00-00',
          name: 'Electrical',
          description: null,
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      expect(matches.get(parsedItems[0])).toBe('budget-1');
      expect(matches.get(parsedItems[1])).toBe('budget-2');
      expect(matches.get(parsedItems[2])).toBe('budget-3');
    });

    it('should handle empty budget items list', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          description: 'Concrete Work',
          scheduledValue: 100000,
          fromPreviousApp: 0,
          thisApplication: 20000,
          materialsStored: 0,
          totalCompleted: 20000,
          percentComplete: 20,
          balanceToFinish: 80000,
          retainage: 1000,
        },
      ];

      const budgetItems: any[] = [];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      expect(matches.get(parsedItems[0])).toBeNull();
    });

    it('should handle empty parsed items list', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: '03-00-00',
          name: 'Concrete',
          description: null,
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      expect(matches.size).toBe(0);
    });

    it('should ignore short words in description matching', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          description: 'A of the work',
          scheduledValue: 50000,
          fromPreviousApp: 0,
          thisApplication: 10000,
          materialsStored: 0,
          totalCompleted: 10000,
          percentComplete: 20,
          balanceToFinish: 40000,
          retainage: 500,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: null,
          name: 'A the of',
          description: 'work for the project',
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      // Should match on "work" (> 2 chars), not "A", "of", "the"
      expect(matches.get(parsedItems[0])).toBe('budget-1');
    });

    it('should handle null cost codes in budget items', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          costCode: '03-00-00',
          description: 'Concrete foundation work',
          scheduledValue: 100000,
          fromPreviousApp: 0,
          thisApplication: 20000,
          materialsStored: 0,
          totalCompleted: 20000,
          percentComplete: 20,
          balanceToFinish: 80000,
          retainage: 1000,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: null,
          name: 'Foundation',
          description: 'Concrete foundation work installation',
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      // Should match by description
      expect(matches.get(parsedItems[0])).toBe('budget-1');
    });

    it('should handle undefined cost codes in parsed items', async () => {
      const { matchItemsToBudget } = await import('@/lib/pay-app-parser');

      const parsedItems: ParsedPayAppItem[] = [
        {
          description: 'HVAC system installation',
          scheduledValue: 200000,
          fromPreviousApp: 0,
          thisApplication: 40000,
          materialsStored: 0,
          totalCompleted: 40000,
          percentComplete: 20,
          balanceToFinish: 160000,
          retainage: 2000,
        },
      ];

      const budgetItems = [
        {
          id: 'budget-1',
          costCode: '23-00-00',
          name: 'HVAC',
          description: 'HVAC system installation and equipment',
        },
      ];

      const matches = matchItemsToBudget(parsedItems, budgetItems);

      // Should match by description
      expect(matches.get(parsedItems[0])).toBe('budget-1');
    });
  });
});
