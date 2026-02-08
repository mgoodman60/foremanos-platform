import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mocks Setup - Must use vi.hoisted for mock objects
// ============================================

// Mock callLLM
const mockCallLLM = vi.hoisted(() => vi.fn());

vi.mock('@/lib/llm-providers', () => ({
  callLLM: mockCallLLM,
}));

vi.mock('@/lib/model-config', () => ({
  SIMPLE_MODEL: 'gpt-4o-mini',
}));

// Mock lookahead-service
const mockGenerateLookahead = vi.hoisted(() => vi.fn());
vi.mock('@/lib/lookahead-service', () => ({
  generateLookahead: mockGenerateLookahead,
}));

// Import functions after mocks are set up
import {
  analyzeScheduleImpact,
  formatScheduleSuggestions,
} from '@/lib/schedule-analyzer';

describe('Schedule Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallLLM.mockReset();
    mockGenerateLookahead.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeScheduleImpact', () => {
    const mockScheduleData = {
      tasks: [
        {
          id: 'task-1',
          taskId: 'T001',
          name: 'Foundation Work',
          status: 'in_progress',
          percentComplete: 50,
          startDate: '2024-01-01',
          endDate: '2024-01-15',
          location: 'Building A',
        },
        {
          id: 'task-2',
          taskId: 'T002',
          name: 'Framing',
          status: 'not_started',
          percentComplete: 0,
          startDate: '2024-01-16',
          endDate: '2024-01-30',
          location: 'Building A',
        },
      ],
    };

    const mockAIResponse = {
      hasScheduleImpact: true,
      suggestions: [
        {
          taskId: 'T001',
          taskName: 'Foundation Work',
          currentStatus: 'in_progress',
          currentPercentComplete: 50,
          suggestedStatus: 'completed',
          suggestedPercentComplete: 100,
          confidence: 85,
          reasoning: 'Daily report indicates foundation work was completed today',
          impactType: 'completion',
          severity: 'low',
        },
      ],
      summary: 'Detected 1 task completion based on daily report',
    };

    it('should successfully analyze schedule impact with AI', async () => {
      // Mock schedule data from lookahead service
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      // Mock AI analysis
      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(mockAIResponse),
        model: 'gpt-4o-mini',
      });

      const reportContent = 'Completed foundation work at Building A. Poured final concrete slab.';
      const result = await analyzeScheduleImpact(reportContent, 'project-1');

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].taskId).toBe('T001');
      expect(result.suggestions[0].suggestedPercentComplete).toBe(100);
      expect(result.suggestions[0].impactType).toBe('completion');
      expect(result.summary).toContain('completion');
    });

    it('should handle AI response with markdown code blocks', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      // AI response wrapped in markdown
      const wrappedResponse = '```json\n' + JSON.stringify(mockAIResponse) + '\n```';
      mockCallLLM.mockResolvedValueOnce({
        content: wrappedResponse,
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact('Completed foundation work', 'project-1');

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].taskId).toBe('T001');
    });

    it('should handle schedule fetch failure gracefully', async () => {
      mockGenerateLookahead.mockRejectedValueOnce(new Error('Schedule fetch failed'));

      const result = await analyzeScheduleImpact('Some report content', 'project-1');

      // Should fall back to keyword-based analysis
      expect(result).toBeDefined();
      expect(result.hasScheduleImpact).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should handle AI API failure and fall back to keyword analysis', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      mockCallLLM.mockRejectedValueOnce(new Error('API error'));

      const result = await analyzeScheduleImpact('Foundation work completed', 'project-1');

      expect(result).toBeDefined();
      expect(result.hasScheduleImpact).toBeDefined();
    });

    it('should handle AI response with no content', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      mockCallLLM.mockResolvedValueOnce({
        content: '',
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact('Some content', 'project-1');

      expect(result).toBeDefined();
      expect(result.hasScheduleImpact).toBeDefined();
    });

    it('should handle AI response with invalid JSON', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      mockCallLLM.mockResolvedValueOnce({
        content: 'This is not valid JSON {broken',
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact('Some content', 'project-1');

      // Should fall back to keyword analysis
      expect(result).toBeDefined();
      expect(result.hasScheduleImpact).toBeDefined();
    });

    it('should handle empty schedule tasks', async () => {
      mockGenerateLookahead.mockResolvedValueOnce({ tasks: [] });

      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          hasScheduleImpact: false,
          suggestions: [],
          summary: 'No tasks to analyze',
        }),
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact('Some report', 'project-1');

      expect(result).toBeDefined();
      expect(result.hasScheduleImpact).toBe(false);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should handle multiple task suggestions', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const multiTaskResponse = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'in_progress',
            currentPercentComplete: 50,
            suggestedStatus: 'completed',
            suggestedPercentComplete: 100,
            confidence: 90,
            reasoning: 'Foundation completed',
            impactType: 'completion',
            severity: 'low',
          },
          {
            taskId: 'T002',
            taskName: 'Framing',
            currentStatus: 'not_started',
            currentPercentComplete: 0,
            suggestedStatus: 'delayed',
            suggestedPercentComplete: 0,
            confidence: 75,
            reasoning: 'Material delay reported',
            impactType: 'delay',
            severity: 'high',
          },
        ],
        summary: '1 completion and 1 delay detected',
      };

      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify(multiTaskResponse),
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact('Multiple updates', 'project-1');

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].impactType).toBe('completion');
      expect(result.suggestions[1].impactType).toBe('delay');
    });
  });

  describe('Keyword-Based Analysis', () => {
    const mockScheduleData = {
      tasks: [
        {
          id: 'task-1',
          taskId: 'T001',
          name: 'Foundation Work',
          status: 'in_progress',
          percentComplete: 50,
          startDate: '2024-01-01',
          endDate: '2024-01-15',
          location: 'Building A',
        },
      ],
    };

    // callLLM throws to force keyword-based fallback
    beforeEach(() => {
      mockCallLLM.mockRejectedValue(new Error('Force keyword fallback'));
    });

    it('should detect delay keywords', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const result = await analyzeScheduleImpact(
        'Foundation work delayed due to weather delay',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions[0].impactType).toBe('delay');
      expect(result.suggestions[0].severity).toBe('medium');
      expect(result.suggestions[0].suggestedStatus).toBe('delayed');
    });

    it('should detect completion keywords', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const result = await analyzeScheduleImpact(
        'Foundation work completed and finished today',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions[0].impactType).toBe('completion');
      expect(result.suggestions[0].suggestedPercentComplete).toBe(100);
      expect(result.suggestions[0].suggestedStatus).toBe('completed');
    });

    it('should detect progress keywords', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const result = await analyzeScheduleImpact(
        'Continuing Foundation work, making good progress',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions[0].impactType).toBe('progress');
      expect(result.suggestions[0].suggestedPercentComplete).toBe(60); // 50 + 10
      expect(result.suggestions[0].suggestedStatus).toBe('in_progress');
    });

    it('should match task by name', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const result = await analyzeScheduleImpact(
        'foundation work is in progress',
        'project-1'
      );

      expect(result.suggestions[0].taskName).toBe('Foundation Work');
    });

    it('should match task by location', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const result = await analyzeScheduleImpact(
        'Work at building a is progressing well',
        'project-1'
      );

      expect(result.suggestions[0].taskName).toBe('Foundation Work');
    });

    it('should return no impact when no tasks mentioned', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const result = await analyzeScheduleImpact(
        'General site cleanup was performed',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(false);
      expect(result.suggestions).toHaveLength(0);
      expect(result.summary).toContain('No clear schedule impacts');
    });

    it('should handle progress percentage increase cap at 95%', async () => {
      const highProgressTask = {
        tasks: [
          {
            id: 'task-1',
            taskId: 'T001',
            name: 'Foundation Work',
            status: 'in_progress',
            percentComplete: 90,
            startDate: '2024-01-01',
            endDate: '2024-01-15',
            location: 'Building A',
          },
        ],
      };

      mockGenerateLookahead.mockResolvedValueOnce(highProgressTask);

      const result = await analyzeScheduleImpact(
        'Foundation work continuing with progress',
        'project-1'
      );

      // Should cap at 95%
      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].suggestedPercentComplete).toBe(95);
    });

    it('should set confidence to 60 for keyword-based analysis', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const result = await analyzeScheduleImpact(
        'Foundation work completed',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].confidence).toBe(60);
    });

    it('should handle tasks without location', async () => {
      const taskWithoutLocation = {
        tasks: [
          {
            id: 'task-1',
            taskId: 'T001',
            name: 'Foundation Work',
            status: 'in_progress',
            percentComplete: 50,
            startDate: '2024-01-01',
            endDate: '2024-01-15',
            location: null,
          },
        ],
      };

      mockGenerateLookahead.mockResolvedValueOnce(taskWithoutLocation);

      const result = await analyzeScheduleImpact(
        'Foundation work completed',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].taskName).toBe('Foundation Work');
    });

    it('should detect various delay keywords', async () => {
      const delayKeywords = [
        'delayed',
        'behind schedule',
        'running late',
        'postponed',
        'weather delay',
        'material delay',
      ];

      for (const keyword of delayKeywords) {
        mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

        const result = await analyzeScheduleImpact(
          `Foundation work ${keyword}`,
          'project-1'
        );

        expect(result.hasScheduleImpact).toBe(true);
        expect(result.suggestions).toHaveLength(1);
        expect(result.suggestions[0].impactType).toBe('delay');
      }
    });

    it('should detect various completion keywords', async () => {
      const completionKeywords = ['completed', 'finished', 'done', 'final', 'wrapped up'];

      for (const keyword of completionKeywords) {
        mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

        const result = await analyzeScheduleImpact(
          `Foundation work ${keyword}`,
          'project-1'
        );

        expect(result.hasScheduleImpact).toBe(true);
        expect(result.suggestions).toHaveLength(1);
        expect(result.suggestions[0].impactType).toBe('completion');
      }
    });

    it('should detect percentage symbols in content', async () => {
      mockGenerateLookahead.mockResolvedValueOnce(mockScheduleData);

      const result = await analyzeScheduleImpact(
        'Foundation work is 75% complete',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].impactType).toBe('progress');
    });
  });

  describe('formatScheduleSuggestions', () => {
    it('should format suggestions with no schedule impact', () => {
      const analysis = {
        hasScheduleImpact: false,
        suggestions: [],
        summary: 'No impacts detected',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toBe('No schedule updates detected from this report.');
    });

    it('should format completion suggestion with correct icon', () => {
      const analysis = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'in_progress',
            currentPercentComplete: 50,
            suggestedStatus: 'completed',
            suggestedPercentComplete: 100,
            confidence: 85,
            reasoning: 'Work completed today',
            impactType: 'completion' as const,
            severity: 'low' as const,
          },
        ],
        summary: '1 task completed',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toContain('✅');
      expect(result).toContain('Foundation Work');
      expect(result).toContain('85% confidence');
      expect(result).toContain('in_progress at 50%');
      expect(result).toContain('completed at 100%');
      expect(result).toContain('Work completed today');
    });

    it('should format delay suggestion with correct icon', () => {
      const analysis = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'in_progress',
            currentPercentComplete: 50,
            suggestedStatus: 'delayed',
            suggestedPercentComplete: 50,
            confidence: 75,
            reasoning: 'Weather delay',
            impactType: 'delay' as const,
            severity: 'high' as const,
          },
        ],
        summary: '1 delay detected',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toContain('⚠️');
      expect(result).toContain('Foundation Work');
      expect(result).toContain('Weather delay');
    });

    it('should format acceleration suggestion with correct icon', () => {
      const analysis = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'in_progress',
            currentPercentComplete: 50,
            suggestedStatus: 'ahead_of_schedule',
            suggestedPercentComplete: 75,
            confidence: 80,
            reasoning: 'Ahead of schedule',
            impactType: 'acceleration' as const,
            severity: 'low' as const,
          },
        ],
        summary: '1 acceleration',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toContain('🚀');
      expect(result).toContain('Ahead of schedule');
    });

    it('should format progress suggestion with correct icon', () => {
      const analysis = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'in_progress',
            currentPercentComplete: 50,
            suggestedStatus: 'in_progress',
            suggestedPercentComplete: 60,
            confidence: 70,
            reasoning: 'Good progress',
            impactType: 'progress' as const,
            severity: 'low' as const,
          },
        ],
        summary: '1 progress update',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toContain('📊');
      expect(result).toContain('Good progress');
    });

    it('should include summary at the top', () => {
      const analysis = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'in_progress',
            currentPercentComplete: 50,
            suggestedStatus: 'completed',
            suggestedPercentComplete: 100,
            confidence: 85,
            reasoning: 'Work done',
            impactType: 'completion' as const,
            severity: 'low' as const,
          },
        ],
        summary: 'Detected 1 task completion',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toContain('**Schedule Impact Analysis**');
      expect(result).toContain('Detected 1 task completion');
    });

    it('should include disclaimer at the bottom', () => {
      const analysis = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'in_progress',
            currentPercentComplete: 50,
            suggestedStatus: 'completed',
            suggestedPercentComplete: 100,
            confidence: 85,
            reasoning: 'Work done',
            impactType: 'completion' as const,
            severity: 'low' as const,
          },
        ],
        summary: '1 task',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toContain('AI-generated suggestions');
      expect(result).toContain('Please review before applying');
    });

    it('should format multiple suggestions', () => {
      const analysis = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'in_progress',
            currentPercentComplete: 50,
            suggestedStatus: 'completed',
            suggestedPercentComplete: 100,
            confidence: 85,
            reasoning: 'Completed',
            impactType: 'completion' as const,
            severity: 'low' as const,
          },
          {
            taskId: 'T002',
            taskName: 'Framing',
            currentStatus: 'not_started',
            currentPercentComplete: 0,
            suggestedStatus: 'delayed',
            suggestedPercentComplete: 0,
            confidence: 75,
            reasoning: 'Material delay',
            impactType: 'delay' as const,
            severity: 'high' as const,
          },
        ],
        summary: '2 tasks impacted',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toContain('Foundation Work');
      expect(result).toContain('Framing');
      expect(result).toContain('✅');
      expect(result).toContain('⚠️');
    });

    it('should handle null or 0 currentPercentComplete', () => {
      const analysis = {
        hasScheduleImpact: true,
        suggestions: [
          {
            taskId: 'T001',
            taskName: 'Foundation Work',
            currentStatus: 'not_started',
            currentPercentComplete: 0,
            suggestedStatus: 'in_progress',
            suggestedPercentComplete: 10,
            confidence: 70,
            reasoning: 'Started work',
            impactType: 'progress' as const,
            severity: 'low' as const,
          },
        ],
        summary: '1 task started',
      };

      const result = formatScheduleSuggestions(analysis);

      expect(result).toContain('not_started at 0%');
      expect(result).toContain('in_progress at 10%');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle network timeout on schedule fetch', async () => {
      mockGenerateLookahead.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await analyzeScheduleImpact('Some content', 'project-1');

      expect(result).toBeDefined();
      expect(result.hasScheduleImpact).toBeDefined();
    });

    it('should handle network timeout on AI call', async () => {
      mockGenerateLookahead.mockResolvedValueOnce({ tasks: [] });

      mockCallLLM.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await analyzeScheduleImpact('Some content', 'project-1');

      expect(result).toBeDefined();
    });

    it('should handle malformed schedule data', async () => {
      mockGenerateLookahead.mockResolvedValueOnce({ not_tasks: 'invalid' } as any);

      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          hasScheduleImpact: false,
          suggestions: [],
          summary: 'No tasks',
        }),
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact('Some content', 'project-1');

      expect(result).toBeDefined();
    });

    it('should handle empty report content', async () => {
      mockGenerateLookahead.mockResolvedValueOnce({ tasks: [] });

      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          hasScheduleImpact: false,
          suggestions: [],
          summary: 'No content to analyze',
        }),
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact('', 'project-1');

      expect(result).toBeDefined();
    });

    it('should handle very long report content', async () => {
      const longContent = 'A'.repeat(10000);

      mockGenerateLookahead.mockResolvedValueOnce({ tasks: [] });

      mockCallLLM.mockResolvedValueOnce({
        content: JSON.stringify({
          hasScheduleImpact: false,
          suggestions: [],
          summary: 'Analyzed long content',
        }),
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact(longContent, 'project-1');

      expect(result).toBeDefined();
    });

    it('should handle special characters in task names', async () => {
      const specialCharsSchedule = {
        tasks: [
          {
            id: 'task-1',
            taskId: 'T001',
            name: 'Foundation & Concrete Work (Phase 1)',
            status: 'in_progress',
            percentComplete: 50,
            startDate: '2024-01-01',
            endDate: '2024-01-15',
            location: 'Building A',
          },
        ],
      };

      mockGenerateLookahead.mockResolvedValueOnce(specialCharsSchedule);
      mockCallLLM.mockRejectedValueOnce(new Error('Force keyword fallback'));

      const result = await analyzeScheduleImpact(
        'Foundation & Concrete Work (Phase 1) is completed',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].taskName).toBe('Foundation & Concrete Work (Phase 1)');
    });

    it('should handle case-insensitive task matching', async () => {
      const schedule = {
        tasks: [
          {
            id: 'task-1',
            taskId: 'T001',
            name: 'FOUNDATION WORK',
            status: 'in_progress',
            percentComplete: 50,
            startDate: '2024-01-01',
            endDate: '2024-01-15',
            location: 'BUILDING A',
          },
        ],
      };

      mockGenerateLookahead.mockResolvedValueOnce(schedule);
      mockCallLLM.mockRejectedValueOnce(new Error('Force keyword fallback'));

      const result = await analyzeScheduleImpact(
        'foundation work completed at building a',
        'project-1'
      );

      expect(result.hasScheduleImpact).toBe(true);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].taskName).toBe('FOUNDATION WORK');
    });

    it('should handle AI response with empty content', async () => {
      mockGenerateLookahead.mockResolvedValueOnce({ tasks: [] });

      mockCallLLM.mockResolvedValueOnce({
        content: '',
        model: 'gpt-4o-mini',
      });

      const result = await analyzeScheduleImpact('Some content', 'project-1');

      expect(result).toBeDefined();
    });
  });
});
