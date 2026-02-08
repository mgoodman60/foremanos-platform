import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock callLLM with vi.hoisted
const mockCallLLM = vi.hoisted(() => vi.fn());

vi.mock('@/lib/llm-providers', () => ({
  callLLM: mockCallLLM,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock process.env before imports
const originalEnv = process.env;

// Import after mocks
import {
  shouldUseWebSearch,
  performWebSearch,
  formatWebResultsForContext,
  type WebSearchResult,
  type WebSearchResponse,
} from '@/lib/web-search';

describe('Web Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('shouldUseWebSearch', () => {
    describe('Building Code Queries', () => {
      it('should trigger for IBC queries', () => {
        expect(shouldUseWebSearch('What does the IBC say about wall heights?', 0)).toBe(true);
        expect(shouldUseWebSearch('international building code requirements', 5)).toBe(true);
        expect(shouldUseWebSearch('IBC section 1234', 0)).toBe(true);
      });

      it('should trigger for IRC queries', () => {
        expect(shouldUseWebSearch('IRC residential code egress', 0)).toBe(true);
        expect(shouldUseWebSearch('residential code compliance', 3)).toBe(true);
      });

      it('should trigger for general building code queries', () => {
        expect(shouldUseWebSearch('building code requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('code compliance check', 5)).toBe(true);
        expect(shouldUseWebSearch('what does the code require?', 0)).toBe(true);
        expect(shouldUseWebSearch('code section reference', 2)).toBe(true);
      });
    });

    describe('Fire Safety Code Queries', () => {
      it('should trigger for NFPA queries', () => {
        expect(shouldUseWebSearch('NFPA 13 sprinkler requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('fire code compliance', 5)).toBe(true);
      });

      it('should trigger for fire safety queries', () => {
        expect(shouldUseWebSearch('fire alarm requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('sprinkler system code', 3)).toBe(true);
        expect(shouldUseWebSearch('egress requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('fire rating specifications', 2)).toBe(true);
        expect(shouldUseWebSearch('fire resistance required', 1)).toBe(true);
      });

      it('should trigger for exit/egress queries', () => {
        expect(shouldUseWebSearch('exit width requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('egress distance code', 5)).toBe(true);
      });
    });

    describe('Accessibility Code Queries', () => {
      it('should trigger for ADA queries', () => {
        expect(shouldUseWebSearch('ADA compliance requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('accessibility standards', 5)).toBe(true);
      });

      it('should trigger for ANSI accessibility queries', () => {
        expect(shouldUseWebSearch('ANSI accessibility code', 0)).toBe(true);
        expect(shouldUseWebSearch('wheelchair clearance requirements', 3)).toBe(true);
      });

      it('should trigger for specific accessibility features', () => {
        expect(shouldUseWebSearch('handrail height requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('ramp slope code', 5)).toBe(true);
        expect(shouldUseWebSearch('clearance requirement for doors', 2)).toBe(true);
      });
    });

    describe('Electrical Code Queries', () => {
      it('should trigger for NEC queries', () => {
        expect(shouldUseWebSearch('NEC electrical code', 0)).toBe(true);
        expect(shouldUseWebSearch('electrical code requirements', 5)).toBe(true);
      });

      it('should trigger for electrical system queries', () => {
        expect(shouldUseWebSearch('wiring code requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('circuit breaker code', 3)).toBe(true);
        expect(shouldUseWebSearch('outlet requirement spacing', 1)).toBe(true);
      });
    });

    describe('Plumbing Code Queries', () => {
      it('should trigger for IPC/UPC queries', () => {
        expect(shouldUseWebSearch('IPC plumbing code', 0)).toBe(true);
        expect(shouldUseWebSearch('UPC requirements', 5)).toBe(true);
      });

      it('should trigger for fixture requirement queries', () => {
        expect(shouldUseWebSearch('fixture requirement for office building', 0)).toBe(true);
        expect(shouldUseWebSearch('plumbing code fixture count', 3)).toBe(true);
      });
    });

    describe('Mechanical/HVAC Code Queries', () => {
      it('should trigger for IMC queries', () => {
        expect(shouldUseWebSearch('IMC mechanical code', 0)).toBe(true);
        expect(shouldUseWebSearch('HVAC code requirements', 5)).toBe(true);
      });

      it('should trigger for ventilation queries', () => {
        expect(shouldUseWebSearch('ventilation requirement for classroom', 0)).toBe(true);
        expect(shouldUseWebSearch('mechanical code compliance', 3)).toBe(true);
      });
    });

    describe('Energy Code Queries', () => {
      it('should trigger for IECC queries', () => {
        expect(shouldUseWebSearch('IECC energy code', 0)).toBe(true);
        expect(shouldUseWebSearch('energy code compliance', 5)).toBe(true);
      });

      it('should trigger for insulation requirement queries', () => {
        expect(shouldUseWebSearch('insulation requirement R-value', 0)).toBe(true);
        expect(shouldUseWebSearch('energy efficiency code', 3)).toBe(true);
      });
    });

    describe('General Compliance Queries', () => {
      it('should trigger for compliance/regulation queries', () => {
        expect(shouldUseWebSearch('compliance check required', 0)).toBe(true);
        expect(shouldUseWebSearch('regulation requirements', 5)).toBe(true);
        expect(shouldUseWebSearch('standard specification', 2)).toBe(true);
      });

      it('should trigger for OSHA queries', () => {
        expect(shouldUseWebSearch('OSHA safety requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('OSHA compliance', 5)).toBe(true);
      });

      it('should trigger for material standard queries', () => {
        expect(shouldUseWebSearch('ASTM material standard', 0)).toBe(true);
        expect(shouldUseWebSearch('ASCE structural standard', 3)).toBe(true);
        expect(shouldUseWebSearch('ACI concrete requirements', 1)).toBe(true);
      });

      it('should trigger for code-related question patterns', () => {
        expect(shouldUseWebSearch('what does the code say about this?', 0)).toBe(true);
        expect(shouldUseWebSearch('what code requires for egress', 5)).toBe(true);
        expect(shouldUseWebSearch('is this allowed by code?', 2)).toBe(true);
        expect(shouldUseWebSearch('is this permitted under building code?', 1)).toBe(true);
        expect(shouldUseWebSearch('what is required by code?', 0)).toBe(true);
        expect(shouldUseWebSearch('minimum requirement by code', 3)).toBe(true);
        expect(shouldUseWebSearch('maximum allowed by code', 2)).toBe(true);
      });

      it('should trigger for code compliance patterns', () => {
        expect(shouldUseWebSearch('code compliance verification', 0)).toBe(true);
        expect(shouldUseWebSearch('meets code requirements', 5)).toBe(true);
        expect(shouldUseWebSearch('code minimum for foundation', 2)).toBe(true);
        expect(shouldUseWebSearch('code maximum height', 1)).toBe(true);
      });
    });

    describe('Non-Code Queries (Should NOT Trigger)', () => {
      it('should NOT trigger for project-specific queries', () => {
        expect(shouldUseWebSearch('What is on sheet S-001?', 0)).toBe(false);
        expect(shouldUseWebSearch('Show me the foundation plan', 5)).toBe(false);
        expect(shouldUseWebSearch('What does the project schedule say?', 10)).toBe(false);
      });

      it('should NOT trigger for document reference queries', () => {
        expect(shouldUseWebSearch('What is on page 5?', 0)).toBe(false);
        expect(shouldUseWebSearch('Find sheet reference A-100', 5)).toBe(false);
      });

      it('should NOT trigger for measurement queries', () => {
        expect(shouldUseWebSearch('What is the wall thickness?', 0)).toBe(false);
        expect(shouldUseWebSearch('Measure the room dimensions', 5)).toBe(false);
      });

      it('should NOT trigger for budget/schedule queries', () => {
        expect(shouldUseWebSearch('What is the project budget?', 0)).toBe(false);
        expect(shouldUseWebSearch('When is the foundation work scheduled?', 5)).toBe(false);
      });

      it('should NOT trigger for general construction questions', () => {
        expect(shouldUseWebSearch('What is a footing?', 0)).toBe(false);
        expect(shouldUseWebSearch('How do I pour concrete?', 5)).toBe(false);
      });

      it('should NOT trigger for empty or whitespace queries', () => {
        expect(shouldUseWebSearch('', 0)).toBe(false);
        expect(shouldUseWebSearch('   ', 0)).toBe(false);
        expect(shouldUseWebSearch('\n\t', 0)).toBe(false);
      });
    });

    describe('Case Insensitivity', () => {
      it('should detect keywords regardless of case', () => {
        expect(shouldUseWebSearch('ibc CODE requirements', 0)).toBe(true);
        expect(shouldUseWebSearch('ADA COMPLIANCE', 5)).toBe(true);
        expect(shouldUseWebSearch('Nfpa Fire Code', 2)).toBe(true);
        expect(shouldUseWebSearch('OSHA REQUIREMENTS', 1)).toBe(true);
      });
    });

    describe('DocumentChunksFound Parameter', () => {
      it('should trigger regardless of document chunks found', () => {
        // Web search is triggered for code queries even if documents exist
        expect(shouldUseWebSearch('IBC building code', 0)).toBe(true);
        expect(shouldUseWebSearch('IBC building code', 100)).toBe(true);
      });
    });
  });

  describe('performWebSearch', () => {
    describe('Success Cases', () => {
      it('should perform web search and return structured results', async () => {
        const content = `
Title: IBC 2021 Building Code Requirements
URL: https://codes.iccsafe.org/content/IBC2021
Snippet: The International Building Code (IBC) establishes minimum requirements for building systems using prescriptive and performance-related provisions.
Source: codes.iccsafe.org

Title: ADA Standards for Accessible Design
URL: https://www.ada.gov/regs2010/2010ADAstandards
Snippet: The 2010 ADA Standards set minimum requirements for newly designed and constructed facilities.
Source: ada.gov
        `.trim();

        mockCallLLM.mockResolvedValue({ content, model: 'claude-sonnet-4-5-20250929' });

        const result = await performWebSearch('IBC building code requirements');

        expect(result.hasResults).toBe(true);
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.query).toContain('IBC building code requirements');
        expect(mockCallLLM).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
          expect.objectContaining({ model: 'claude-sonnet-4-5-20250929', max_tokens: 1500 })
        );
      });

      it('should extract URLs from content', async () => {
        mockCallLLM.mockResolvedValue({
          content: `
Here are some relevant sources:
- https://www.example.com/building-codes
- https://www.test.org/regulations
- https://codes.example.net/ibc
          `.trim(),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('building code');

        expect(result.hasResults).toBe(true);
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results.some(r => r.url.includes('example.com'))).toBe(true);
      });

      it('should limit results to 5', async () => {
        mockCallLLM.mockResolvedValue({
          content: Array.from({ length: 10 }, (_, i) => `
Title: Result ${i + 1}
URL: https://example.com/result-${i + 1}
Snippet: Content for result ${i + 1}
          `).join('\n'),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test query');

        expect(result.results.length).toBeLessThanOrEqual(5);
      });

      it('should extract source domain from URL', async () => {
        mockCallLLM.mockResolvedValue({
          content: `
Title: Test Result
URL: https://www.example.com/page
Snippet: Test content
          `.trim(),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test');

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results[0].source).toBe('example.com');
      });

      it('should handle URLs without www prefix', async () => {
        mockCallLLM.mockResolvedValue({
          content: 'URL: https://codes.iccsafe.org/content',
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test');

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results[0].source).toBe('codes.iccsafe.org');
      });

      it('should enhance query with construction context', async () => {
        mockCallLLM.mockResolvedValue({ content: '', model: 'claude-sonnet-4-5-20250929' });

        await performWebSearch('code requirements');

        const callArgs = mockCallLLM.mock.calls[0];
        const userMessage = callArgs[0].find((m: any) => m.role === 'user');

        expect(userMessage.content).toContain('construction building code');
      });

      it('should add construction context for foundation queries', async () => {
        mockCallLLM.mockResolvedValue({ content: '', model: 'claude-sonnet-4-5-20250929' });

        await performWebSearch('footing depth requirements');

        const callArgs = mockCallLLM.mock.calls[0];
        const userMessage = callArgs[0].find((m: any) => m.role === 'user');

        expect(userMessage.content).toContain('construction standards');
      });

      it('should not add duplicate construction context', async () => {
        mockCallLLM.mockResolvedValue({ content: '', model: 'claude-sonnet-4-5-20250929' });

        await performWebSearch('construction building code requirements');

        const callArgs = mockCallLLM.mock.calls[0];
        const userMessage = callArgs[0].find((m: any) => m.role === 'user');

        // Should not add extra "construction" since it's already present
        const constructionCount = (userMessage.content.match(/construction/gi) || []).length;
        expect(constructionCount).toBe(1);
      });
    });

    describe('API Configuration', () => {
      it('should send correct request parameters', async () => {
        mockCallLLM.mockResolvedValue({ content: '', model: 'claude-sonnet-4-5-20250929' });

        await performWebSearch('test query');

        expect(mockCallLLM).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
          expect.objectContaining({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 1500,
          })
        );

        const callArgs = mockCallLLM.mock.calls[0];
        const messages = callArgs[0];

        expect(messages).toHaveLength(2);
        expect(messages[0].role).toBe('system');
        expect(messages[1].role).toBe('user');
      });
    });

    describe('Error Handling', () => {
      it('should handle callLLM errors gracefully', async () => {
        mockCallLLM.mockRejectedValue(new Error('API request failed'));

        const result = await performWebSearch('test query');

        expect(result.hasResults).toBe(false);
        expect(result.results).toEqual([]);
      });

      it('should handle network errors', async () => {
        mockCallLLM.mockRejectedValue(new Error('Network error'));

        const result = await performWebSearch('test query');

        expect(result.hasResults).toBe(false);
        expect(result.results).toEqual([]);
      });

      it('should handle empty content response', async () => {
        mockCallLLM.mockResolvedValue({ content: '', model: 'claude-sonnet-4-5-20250929' });

        const result = await performWebSearch('test query');

        // Should return empty results, not crash
        expect(result.hasResults).toBe(false);
        expect(result.results).toEqual([]);
      });

      it('should handle invalid URLs gracefully', async () => {
        mockCallLLM.mockResolvedValue({
          content: `
Title: Test Result
URL: not-a-valid-url
Snippet: Test content
          `.trim(),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test');

        // Should handle invalid URL gracefully
        if (result.results.length > 0) {
          expect(result.results[0].source).toBe('web');
        }
      });

      it('should filter out results without URLs', async () => {
        mockCallLLM.mockResolvedValue({
          content: `
Title: Valid Result
URL: https://example.com
Snippet: This has a URL

Title: Invalid Result
Snippet: This has no URL
          `.trim(),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test');

        // Should only include results with valid URLs
        expect(result.results.every(r => r.url)).toBe(true);
      });
    });

    describe('Content Parsing', () => {
      it('should parse structured content with labels', async () => {
        mockCallLLM.mockResolvedValue({
          content: `
**Title:** Building Code Reference
URL: https://codes.example.com
Snippet: Comprehensive building code information
Source: codes.example.com
          `.trim(),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test');

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results[0].title).toBe('Building Code Reference');
      });

      it('should handle description label as snippet', async () => {
        mockCallLLM.mockResolvedValue({
          content: `
Title: Test
URL: https://example.com
Description: This is a description instead of snippet
          `.trim(),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test');

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results[0].snippet).toContain('description');
      });

      it('should extract snippet from content if no label', async () => {
        mockCallLLM.mockResolvedValue({
          content: `
Title: Test Result
URL: https://example.com
This is content that should become the snippet because it is long enough and has no http.
          `.trim(),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test');

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results[0].snippet).toBeTruthy();
      });

      it('should create fallback results from URLs only', async () => {
        mockCallLLM.mockResolvedValue({
          content: `
Some text with URLs embedded:
https://example.com/page1
https://example.org/page2
          `.trim(),
          model: 'claude-sonnet-4-5-20250929',
        });

        const result = await performWebSearch('test');

        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results.some(r => r.title.includes('Construction Reference'))).toBe(true);
      });
    });
  });

  describe('formatWebResultsForContext', () => {
    it('should return empty string for no results', () => {
      const formatted = formatWebResultsForContext([]);

      expect(formatted).toBe('');
    });

    it('should format single result correctly', () => {
      const results: WebSearchResult[] = [
        {
          title: 'IBC Building Code',
          url: 'https://codes.iccsafe.org/content/IBC2021',
          snippet: 'The International Building Code establishes minimum requirements.',
          source: 'codes.iccsafe.org',
        },
      ];

      const formatted = formatWebResultsForContext(results);

      expect(formatted).toContain('WEB SEARCH RESULTS');
      expect(formatted).toContain('SUPPLEMENTARY INFORMATION');
      expect(formatted).toContain('[Web Source 1]');
      expect(formatted).toContain('Title: IBC Building Code');
      expect(formatted).toContain('URL: https://codes.iccsafe.org/content/IBC2021');
      expect(formatted).toContain('Content: The International Building Code');
      expect(formatted).toContain('Source: codes.iccsafe.org');
      expect(formatted).toContain('END WEB SEARCH RESULTS');
    });

    it('should format multiple results correctly', () => {
      const results: WebSearchResult[] = [
        {
          title: 'Result 1',
          url: 'https://example.com/1',
          snippet: 'First result content',
          source: 'example.com',
        },
        {
          title: 'Result 2',
          url: 'https://test.org/2',
          snippet: 'Second result content',
          source: 'test.org',
        },
        {
          title: 'Result 3',
          url: 'https://codes.net/3',
          snippet: 'Third result content',
          source: 'codes.net',
        },
      ];

      const formatted = formatWebResultsForContext(results);

      expect(formatted).toContain('[Web Source 1]');
      expect(formatted).toContain('[Web Source 2]');
      expect(formatted).toContain('[Web Source 3]');
      expect(formatted).toContain('Result 1');
      expect(formatted).toContain('Result 2');
      expect(formatted).toContain('Result 3');
    });

    it('should include SUPPLEMENT instruction', () => {
      const results: WebSearchResult[] = [
        {
          title: 'Test',
          url: 'https://example.com',
          snippet: 'Test content',
          source: 'example.com',
        },
      ];

      const formatted = formatWebResultsForContext(results);

      expect(formatted).toContain('SUPPLEMENT (not override)');
    });

    it('should format with clear section markers', () => {
      const results: WebSearchResult[] = [
        {
          title: 'Test',
          url: 'https://example.com',
          snippet: 'Test content',
          source: 'example.com',
        },
      ];

      const formatted = formatWebResultsForContext(results);

      expect(formatted).toMatch(/===.*WEB SEARCH RESULTS.*===/);
      expect(formatted).toMatch(/===.*END WEB SEARCH RESULTS.*===/);
    });

    it('should preserve all result properties', () => {
      const results: WebSearchResult[] = [
        {
          title: 'Complex Result',
          url: 'https://www.ada.gov/standards/2010',
          snippet: 'The 2010 ADA Standards for Accessible Design set minimum requirements.',
          source: 'ada.gov',
        },
      ];

      const formatted = formatWebResultsForContext(results);

      expect(formatted).toContain('Complex Result');
      expect(formatted).toContain('https://www.ada.gov/standards/2010');
      expect(formatted).toContain('The 2010 ADA Standards');
      expect(formatted).toContain('ada.gov');
    });

    it('should handle results with special characters', () => {
      const results: WebSearchResult[] = [
        {
          title: 'Result with "quotes" and \'apostrophes\'',
          url: 'https://example.com/path?query=value&other=123',
          snippet: 'Content with special chars: @#$%^&*()',
          source: 'example.com',
        },
      ];

      const formatted = formatWebResultsForContext(results);

      expect(formatted).toContain('quotes');
      expect(formatted).toContain('apostrophes');
      expect(formatted).toContain('query=value');
      expect(formatted).toContain('@#$%^&*()');
    });

    it('should maintain consistent formatting across results', () => {
      const results: WebSearchResult[] = [
        {
          title: 'Result 1',
          url: 'https://example1.com',
          snippet: 'Content 1',
          source: 'example1.com',
        },
        {
          title: 'Result 2',
          url: 'https://example2.com',
          snippet: 'Content 2',
          source: 'example2.com',
        },
      ];

      const formatted = formatWebResultsForContext(results);

      // Each result should have same structure
      const source1Index = formatted.indexOf('[Web Source 1]');
      const source2Index = formatted.indexOf('[Web Source 2]');

      expect(source1Index).toBeGreaterThan(-1);
      expect(source2Index).toBeGreaterThan(source1Index);

      // Check that both have Title, URL, Content, Source
      const section1 = formatted.substring(source1Index, source2Index);
      const section2 = formatted.substring(source2Index);

      expect(section1).toContain('Title:');
      expect(section1).toContain('URL:');
      expect(section1).toContain('Content:');
      expect(section1).toContain('Source:');

      expect(section2).toContain('Title:');
      expect(section2).toContain('URL:');
      expect(section2).toContain('Content:');
      expect(section2).toContain('Source:');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full workflow for code query', async () => {
      const query = 'ADA door width requirements';

      // Step 1: Check if web search should be used
      const shouldSearch = shouldUseWebSearch(query, 5);
      expect(shouldSearch).toBe(true);

      // Step 2: Perform web search
      mockCallLLM.mockResolvedValue({
        content: `
Title: ADA Standards for Accessible Design
URL: https://www.ada.gov/regs2010/2010ADAstandards
Snippet: Section 404.2.3 requires minimum 32 inch clear opening width for doors.
Source: ada.gov
        `.trim(),
        model: 'claude-sonnet-4-5-20250929',
      });

      const searchResults = await performWebSearch(query);
      expect(searchResults.hasResults).toBe(true);

      // Step 3: Format for context
      const formatted = formatWebResultsForContext(searchResults.results);
      expect(formatted).toContain('ADA Standards');
      expect(formatted).toContain('32 inch');
    });

    it('should skip web search for project-specific query', () => {
      const query = 'What is on sheet A-101?';
      const shouldSearch = shouldUseWebSearch(query, 10);

      expect(shouldSearch).toBe(false);
    });

    it('should handle empty query gracefully', async () => {
      mockCallLLM.mockResolvedValue({ content: '', model: 'claude-sonnet-4-5-20250929' });

      const result = await performWebSearch('');

      expect(result.hasResults).toBe(false);
      expect(result.results).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long queries', async () => {
      const longQuery = 'building code requirements '.repeat(50);

      mockCallLLM.mockResolvedValue({ content: '', model: 'claude-sonnet-4-5-20250929' });

      await performWebSearch(longQuery);

      expect(mockCallLLM).toHaveBeenCalled();
    });

    it('should handle Unicode and emoji in queries', async () => {
      mockCallLLM.mockResolvedValue({ content: '', model: 'claude-sonnet-4-5-20250929' });

      await performWebSearch('建築コード 🏗️ requirements');

      expect(mockCallLLM).toHaveBeenCalled();
    });

    it('should handle results with missing fields', async () => {
      mockCallLLM.mockResolvedValue({
        content: `
URL: https://example.com
        `.trim(),
        model: 'claude-sonnet-4-5-20250929',
      });

      const result = await performWebSearch('test');

      // Should create fallback titles
      if (result.results.length > 0) {
        expect(result.results[0].title).toBeTruthy();
      }
    });

    it('should handle callLLM errors', async () => {
      mockCallLLM.mockRejectedValue(new Error('LLM error'));

      const result = await performWebSearch('test');

      expect(result.hasResults).toBe(false);
      expect(result.results).toEqual([]);
    });

    it('should handle mixed case keywords correctly', () => {
      expect(shouldUseWebSearch('What does IbC say?', 0)).toBe(true);
      expect(shouldUseWebSearch('nFpA fire code', 0)).toBe(true);
      expect(shouldUseWebSearch('Ada COMPLIANCE', 0)).toBe(true);
    });

    it('should detect code keywords in compound queries', () => {
      expect(shouldUseWebSearch('What are the IBC requirements for this specific building?', 0)).toBe(true);
      expect(shouldUseWebSearch('Check NFPA compliance and also ADA accessibility', 5)).toBe(true);
    });
  });
});
