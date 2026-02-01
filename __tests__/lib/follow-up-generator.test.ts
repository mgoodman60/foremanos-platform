import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing the module
const mocks = vi.hoisted(() => ({
  callAbacusLLM: vi.fn(),
}));

vi.mock('@/lib/abacus-llm', () => ({
  callAbacusLLM: mocks.callAbacusLLM,
}));

describe('Follow-up Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // detectQueryType Tests
  // ============================================
  describe('detectQueryType - internal function via getQuickFollowUps', () => {
    it('should detect schedule query type from keywords', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const scheduleResults = getQuickFollowUps('when is the project deadline?');
      expect(scheduleResults).toContain("What tasks are on the critical path?");
      expect(scheduleResults).toContain("Are there any schedule delays to be aware of?");
    });

    it('should detect budget query type', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const budgetResults = getQuickFollowUps('what is the total cost?');
      expect(budgetResults).toContain("What's the cost breakdown by phase?");
      expect(budgetResults).toContain("Are we tracking to budget?");
    });

    it('should detect dimensions query type', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const dimensionResults = getQuickFollowUps('what is the height of the wall?');
      expect(dimensionResults).toContain("What are the structural specifications?");
    });

    it('should detect materials query type', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const materialResults = getQuickFollowUps('what concrete is specified?');
      expect(materialResults).toContain("What's the total quantity needed?");
    });

    it('should detect MEP query type', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const mepResults = getQuickFollowUps('where is the hvac routing?');
      expect(mepResults).toContain("Show the routing path");
      expect(mepResults).toContain("What equipment is connected?");
    });

    it('should default to general query type for unmatched keywords', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const generalResults = getQuickFollowUps('tell me about the project');
      expect(generalResults).toContain("Can you show me the related drawings?");
      expect(generalResults).toContain("What else should I know about this?");
    });

    it('should handle empty query string', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('');
      expect(results).toHaveLength(3);
      expect(results[0]).toContain('Can you show me the related drawings?');
    });
  });

  // ============================================
  // getQuickFollowUps Tests
  // ============================================
  describe('getQuickFollowUps', () => {
    it('should return exactly 3 follow-up suggestions', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('what is the schedule?');
      expect(results).toHaveLength(3);
    });

    it('should return schedule-specific suggestions for timeline query', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('what is the timeline?');
      expect(results).toEqual([
        "What tasks are on the critical path?",
        "Are there any schedule delays to be aware of?",
        "What's the float on non-critical tasks?"
      ]);
    });

    it('should return budget-specific suggestions for expense query', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('what are the expenses?');
      expect(results).toEqual([
        "What's the cost breakdown by phase?",
        "Are we tracking to budget?",
        "What are the largest cost items?"
      ]);
    });

    it('should handle case-insensitive matching', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const upperResults = getQuickFollowUps('WHAT IS THE SCHEDULE?');
      const lowerResults = getQuickFollowUps('what is the schedule?');
      expect(upperResults).toEqual(lowerResults);
    });

    it('should detect schedule from "when" keyword', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('when do we start?');
      expect(results[0]).toBe("What tasks are on the critical path?");
    });

    it('should detect budget from "price" keyword', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('what is the price?');
      expect(results[0]).toBe("What's the cost breakdown by phase?");
    });

    it('should detect dimensions from "width" keyword', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('what is the width?');
      expect(results[0]).toBe("What are the structural specifications?");
    });

    it('should detect materials from "steel" keyword', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('what steel is needed?');
      expect(results[0]).toBe("What's the total quantity needed?");
    });

    it('should detect MEP from "electrical" keyword', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('where is the electrical panel?');
      expect(results[0]).toBe("Show the routing path");
    });

    it('should detect MEP from "plumbing" keyword', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('show plumbing layout');
      expect(results[0]).toBe("Show the routing path");
    });

    it('should detect MEP from "mechanical" keyword', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('mechanical systems overview');
      expect(results[0]).toBe("Show the routing path");
    });
  });

  // ============================================
  // generateFollowUpSuggestions - Template Path Tests
  // ============================================
  describe('generateFollowUpSuggestions - template path', () => {
    it('should return templates for short AI response (< 200 chars)', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const results = await generateFollowUpSuggestions({
        userQuery: 'what is the schedule?',
        aiResponse: 'The project starts on Monday.',
        documentContext: 'Some context',
        projectType: 'construction'
      });

      expect(results).toHaveLength(3);
      expect(results).toContain("What tasks are on the critical path?");
      expect(mocks.callAbacusLLM).not.toHaveBeenCalled();
    });

    it('should return templates when no document context provided', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const results = await generateFollowUpSuggestions({
        userQuery: 'what is the budget?',
        aiResponse: 'This is a very long response that exceeds 200 characters. It contains detailed information about the budget breakdown, including labor costs, material costs, equipment costs, and overhead. The total budget is $1,000,000.',
      });

      expect(results).toHaveLength(3);
      expect(results).toContain("What's the cost breakdown by phase?");
      expect(mocks.callAbacusLLM).not.toHaveBeenCalled();
    });

    it('should return templates when document context is empty string', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const results = await generateFollowUpSuggestions({
        userQuery: 'what materials are needed?',
        aiResponse: 'This is a very long response that exceeds 200 characters. It contains detailed information about the materials needed for the project, including concrete, steel, lumber, drywall, and finishing materials.',
        documentContext: ''
      });

      expect(results).toHaveLength(3);
      expect(results).toContain("What's the total quantity needed?");
      expect(mocks.callAbacusLLM).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // generateFollowUpSuggestions - AI Path Tests
  // ============================================
  describe('generateFollowUpSuggestions - AI path', () => {
    it('should use AI to generate suggestions for complex queries', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: 'What is the critical path?\nAre there any delays?\nWho is responsible for milestones?',
        model: 'gpt-4o-mini',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'what is the project schedule?',
        aiResponse: 'This is a very detailed response that exceeds 200 characters and contains lots of information about the project timeline, key milestones, critical path analysis, and resource allocation across multiple phases of construction.',
        documentContext: 'Detailed project documentation with schedule data',
        projectType: 'construction'
      });

      expect(results).toHaveLength(3);
      expect(results).toEqual([
        'What is the critical path?',
        'Are there any delays?',
        'Who is responsible for milestones?'
      ]);
      expect(mocks.callAbacusLLM).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('what is the project schedule?')
          })
        ]),
        expect.objectContaining({
          model: 'gpt-4o-mini',
          max_tokens: 150,
          temperature: 0.7
        })
      );
    });

    it('should truncate AI response to 500 characters in prompt', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: 'Question 1\nQuestion 2\nQuestion 3',
        model: 'gpt-4o-mini'
      });

      const longResponse = 'x'.repeat(1000);
      await generateFollowUpSuggestions({
        userQuery: 'test query',
        aiResponse: longResponse,
        documentContext: 'context'
      });

      expect(mocks.callAbacusLLM).toHaveBeenCalled();
      const callArgs = mocks.callAbacusLLM.mock.calls[0];
      const prompt = callArgs[0][0].content;
      expect(prompt).toContain('x'.repeat(500) + '...');
      expect(prompt).not.toContain('x'.repeat(501));
    });

    it('should filter out numbered suggestions from AI response', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: '1. First question\n2. Second question\n3. Third question',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'test query',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      // Should fallback to templates because numbered items are filtered out
      expect(results).toHaveLength(3);
      expect(results[0]).not.toMatch(/^\d/);
    });

    it('should filter out bulleted suggestions from AI response', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: '- First question\n- Second question\n- Third question',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'test query',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      // Should fallback to templates because bulleted items are filtered out
      expect(results).toHaveLength(3);
      expect(results[0].startsWith('-')).toBe(false);
    });

    it('should filter out suggestions longer than 80 characters', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const longQuestion = 'This is an extremely long follow-up question that exceeds the 80 character limit and should be filtered out';
      mocks.callAbacusLLM.mockResolvedValue({
        content: `${longQuestion}\nShort question 1\nShort question 2`,
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'test query',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).not.toContain(longQuestion);
    });

    it('should filter out empty lines from AI response', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: 'Question 1\n\n\nQuestion 2\n\nQuestion 3',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'test query',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(results.every(r => r.length > 0)).toBe(true);
    });

    it('should limit AI suggestions to first 3 after filtering', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: 'Q1\nQ2\nQ3\nQ4\nQ5\nQ6',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'test query',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(results).toEqual(['Q1', 'Q2', 'Q3']);
    });

    it('should fallback to templates when AI returns less than 2 valid suggestions', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: 'Only one question',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'what is the schedule?',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(results).toContain("What tasks are on the critical path?");
    });

    it('should fallback to templates when AI returns empty content', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: '',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'what is the budget?',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(results).toContain("What's the cost breakdown by phase?");
    });

    it('should fallback to templates when AI returns null content', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: null as any,
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'what materials?',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(results).toContain("What's the total quantity needed?");
    });
  });

  // ============================================
  // generateFollowUpSuggestions - Error Handling Tests
  // ============================================
  describe('generateFollowUpSuggestions - error handling', () => {
    it('should fallback to templates when AI call throws error', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockRejectedValue(new Error('API timeout'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const results = await generateFollowUpSuggestions({
        userQuery: 'what is the schedule?',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(results).toContain("What tasks are on the critical path?");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[FollowUp] Error generating suggestions:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should log error and return templates on network failure', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const results = await generateFollowUpSuggestions({
        userQuery: 'show mep layout',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(results).toContain("Show the routing path");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle AI response with only whitespace', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: '   \n\n   \n   ',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'test query',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      // Should fallback to general templates
      expect(results[0]).toBe("Can you show me the related drawings?");
    });
  });

  // ============================================
  // generateFollowUpSuggestions - Edge Cases
  // ============================================
  describe('generateFollowUpSuggestions - edge cases', () => {
    it('should handle exactly 200 character response (boundary)', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const response200 = 'x'.repeat(200);
      const results = await generateFollowUpSuggestions({
        userQuery: 'test',
        aiResponse: response200,
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(mocks.callAbacusLLM).toHaveBeenCalled();
    });

    it('should handle exactly 199 character response (boundary)', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const response199 = 'x'.repeat(199);
      const results = await generateFollowUpSuggestions({
        userQuery: 'test',
        aiResponse: response199,
        documentContext: 'context'
      });

      expect(results).toHaveLength(3);
      expect(mocks.callAbacusLLM).not.toHaveBeenCalled();
    });

    it('should use default project type when not provided', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const results = await generateFollowUpSuggestions({
        userQuery: 'test',
        aiResponse: 'short'
      });

      expect(results).toHaveLength(3);
    });

    it('should handle custom project type parameter', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const results = await generateFollowUpSuggestions({
        userQuery: 'test',
        aiResponse: 'short',
        projectType: 'commercial'
      });

      expect(results).toHaveLength(3);
    });

    it('should handle undefined document context', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const results = await generateFollowUpSuggestions({
        userQuery: 'test',
        aiResponse: 'short',
        documentContext: undefined
      });

      expect(results).toHaveLength(3);
      expect(mocks.callAbacusLLM).not.toHaveBeenCalled();
    });

    it('should trim whitespace from AI suggestions', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: '  Question 1  \n  Question 2  \n  Question 3  ',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'test',
        aiResponse: 'x'.repeat(300),
        documentContext: 'context'
      });

      expect(results).toEqual(['Question 1', 'Question 2', 'Question 3']);
    });

    it('should handle query with multiple matching keywords', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      // "schedule" should match first
      const results = getQuickFollowUps('what is the schedule and budget?');
      expect(results[0]).toBe("What tasks are on the critical path?");
    });

    it('should handle unicode characters in query', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const results = getQuickFollowUps('¿Cuál es el presupuesto?');
      expect(results).toHaveLength(3);
      expect(results[0]).toBe("Can you show me the related drawings?");
    });

    it('should handle very long query string', async () => {
      const { getQuickFollowUps } = await import('@/lib/follow-up-generator');

      const longQuery = 'schedule '.repeat(100);
      const results = getQuickFollowUps(longQuery);
      expect(results).toHaveLength(3);
      expect(results[0]).toBe("What tasks are on the critical path?");
    });
  });

  // ============================================
  // Integration Tests
  // ============================================
  describe('generateFollowUpSuggestions - integration', () => {
    it('should generate contextual MEP follow-ups with AI', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: 'What is the electrical load?\nAre there any code violations?\nWhere is the panel located?',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'show me the electrical system',
        aiResponse: 'The electrical system includes a 400A main panel with 12 circuits serving the building. There are 3 sub-panels distributed across floors. The system is designed for 120/208V three-phase power. Each sub-panel serves a different zone.',
        documentContext: 'Electrical drawings Sheet E-1 through E-5',
        projectType: 'construction'
      });

      expect(results).toEqual([
        'What is the electrical load?',
        'Are there any code violations?',
        'Where is the panel located?'
      ]);
    });

    it('should use templates for simple budget query', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      const results = await generateFollowUpSuggestions({
        userQuery: 'what is the budget?',
        aiResponse: 'The budget is $1M.',
        projectType: 'construction'
      });

      expect(results).toEqual([
        "What's the cost breakdown by phase?",
        "Are we tracking to budget?",
        "What are the largest cost items?"
      ]);
      expect(mocks.callAbacusLLM).not.toHaveBeenCalled();
    });

    it('should handle mixed content with special characters', async () => {
      const { generateFollowUpSuggestions } = await import('@/lib/follow-up-generator');

      mocks.callAbacusLLM.mockResolvedValue({
        content: 'What about 3" conduit routing?\nHow to handle 90° bends?\nWhere are the J-boxes?',
        model: 'gpt-4o-mini'
      });

      const results = await generateFollowUpSuggestions({
        userQuery: 'electrical conduit details',
        aiResponse: 'x'.repeat(300),
        documentContext: 'Sheet E-2.1'
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toContain('3" conduit');
    });
  });
});
