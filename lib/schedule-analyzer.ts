/**
 * AI-Powered Schedule Update Detection
 * Analyzes daily reports to detect schedule impacts and suggest updates
 */

import { generateLookahead } from './lookahead-service';

interface ScheduleUpdateSuggestion {
  taskId: string;
  taskName: string;
  currentStatus: string;
  currentPercentComplete: number;
  suggestedStatus: string;
  suggestedPercentComplete: number;
  confidence: number; // 0-100
  reasoning: string;
  impactType: 'progress' | 'delay' | 'completion' | 'acceleration';
  severity: 'low' | 'medium' | 'high';
}

interface DailyReportAnalysis {
  hasScheduleImpact: boolean;
  suggestions: ScheduleUpdateSuggestion[];
  summary: string;
}

/**
 * Analyze daily report content for schedule impacts using AI
 */
export async function analyzeScheduleImpact(
  reportContent: string,
  projectId: string
): Promise<DailyReportAnalysis> {
  try {
    // Get current schedule tasks directly from service (avoid HTTP self-call)
    const scheduleData = await generateLookahead(projectId);
    const tasks = scheduleData.tasks || [];

    // Build context for AI
    const scheduleContext = tasks.map((task: any) => ({
      id: task.id,
      taskId: task.taskId,
      name: task.name,
      status: task.status,
      percentComplete: task.percentComplete,
      startDate: task.startDate,
      endDate: task.endDate,
      location: task.location,
    }));

    // Use Abacus AI to analyze the report
    const analysisPrompt = `You are a construction schedule analyzer. Analyze this daily report and identify any schedule impacts.

Current Schedule Context:
${JSON.stringify(scheduleContext, null, 2)}

Daily Report:
${reportContent}

Analyze the report and:
1. Identify which tasks were worked on
2. Detect progress made on each task
3. Identify any delays or issues that may impact the schedule
4. Detect any completed tasks
5. Identify any acceleration or ahead-of-schedule work

For each impacted task, provide:
- Task ID and name
- Current status and suggested new status
- Current % complete and suggested new % complete
- Confidence level (0-100)
- Clear reasoning for the suggestion
- Impact type (progress, delay, completion, acceleration)
- Severity (low, medium, high)

Return ONLY a JSON object with this structure:
{
  "hasScheduleImpact": boolean,
  "suggestions": [
    {
      "taskId": "string",
      "taskName": "string",
      "currentStatus": "string",
      "suggestedStatus": "string",
      "suggestedPercentComplete": number,
      "confidence": number,
      "reasoning": "string",
      "impactType": "progress|delay|completion|acceleration",
      "severity": "low|medium|high"
    }
  ],
  "summary": "string - brief summary of schedule impacts"
}`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not configured, using keyword-based analysis');
      return keywordBasedAnalysis(reportContent, scheduleContext);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: analysisPrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error('AI analysis failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response
    // Strip markdown code blocks if present (Claude sometimes wraps JSON in ```json ... ```)
    let contentToParse = content;
    const jsonMatch = contentToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      contentToParse = jsonMatch[1].trim();
    }

    const analysis = JSON.parse(contentToParse);
    return analysis;
  } catch (error) {
    console.error('Error analyzing schedule impact:', error);
    // Fallback to keyword-based analysis
    return keywordBasedAnalysis(reportContent, []);
  }
}

/**
 * Fallback keyword-based analysis when AI is not available
 */
function keywordBasedAnalysis(
  reportContent: string,
  scheduleContext: any[]
): DailyReportAnalysis {
  const content = reportContent.toLowerCase();
  const suggestions: ScheduleUpdateSuggestion[] = [];

  // Detect delays
  const delayKeywords = [
    'delay',
    'delayed',
    'behind schedule',
    'running late',
    'postponed',
    'weather delay',
    'material delay',
  ];
  const hasDelay = delayKeywords.some(keyword => content.includes(keyword));

  // Detect completions
  const completionKeywords = [
    'completed',
    'finished',
    'done',
    'final',
    'wrapped up',
  ];
  const hasCompletion = completionKeywords.some(keyword => content.includes(keyword));

  // Detect progress
  const progressKeywords = [
    'progress',
    'started',
    'in progress',
    'working on',
    'continuing',
    '%',
    'percent',
  ];
  const hasProgress = progressKeywords.some(keyword => content.includes(keyword));

  // Extract task mentions from schedule context
  for (const task of scheduleContext) {
    const taskMentioned = content.includes(task.name.toLowerCase()) ||
                         (task.location && content.includes(task.location.toLowerCase()));

    if (taskMentioned) {
      let impactType: 'progress' | 'delay' | 'completion' | 'acceleration' = 'progress';
      let severity: 'low' | 'medium' | 'high' = 'low';
      let suggestedStatus = task.status;
      let suggestedPercentComplete = task.percentComplete;

      if (hasDelay) {
        impactType = 'delay';
        severity = 'medium';
        suggestedStatus = 'delayed';
      } else if (hasCompletion) {
        impactType = 'completion';
        severity = 'low';
        suggestedStatus = 'completed';
        suggestedPercentComplete = 100;
      } else if (hasProgress) {
        impactType = 'progress';
        severity = 'low';
        suggestedStatus = 'in_progress';
        suggestedPercentComplete = Math.min(task.percentComplete + 10, 95);
      }

      suggestions.push({
        taskId: task.taskId,
        taskName: task.name,
        currentStatus: task.status,
        currentPercentComplete: task.percentComplete,
        suggestedStatus,
        suggestedPercentComplete,
        confidence: 60, // Lower confidence for keyword-based
        reasoning: `Task mentioned in daily report with ${impactType} indicators`,
        impactType,
        severity,
      });
    }
  }

  return {
    hasScheduleImpact: suggestions.length > 0,
    suggestions,
    summary: suggestions.length > 0
      ? `Detected ${suggestions.length} task(s) with potential schedule impacts based on daily report content`
      : 'No clear schedule impacts detected in this report',
  };
}

/**
 * Extract numerical progress percentages from text
 */
function extractProgressPercentage(text: string): number | null {
  const percentMatch = text.match(/(\d+)%|(\d+)\s*percent/i);
  if (percentMatch) {
    const value = parseInt(percentMatch[1] || percentMatch[2]);
    return Math.min(Math.max(value, 0), 100);
  }
  return null;
}

/**
 * Format schedule update suggestions for display
 */
export function formatScheduleSuggestions(analysis: DailyReportAnalysis): string {
  if (!analysis.hasScheduleImpact) {
    return 'No schedule updates detected from this report.';
  }

  let output = `**Schedule Impact Analysis**\n\n${analysis.summary}\n\n`;

  for (const suggestion of analysis.suggestions) {
    const icon = suggestion.impactType === 'completion' ? '✅' :
                 suggestion.impactType === 'delay' ? '⚠️' :
                 suggestion.impactType === 'acceleration' ? '🚀' : '📊';

    output += `${icon} **${suggestion.taskName}** (${suggestion.confidence}% confidence)\n`;
    output += `   Current: ${suggestion.currentStatus} at ${suggestion.currentPercentComplete || 0}%\n`;
    output += `   Suggested: ${suggestion.suggestedStatus} at ${suggestion.suggestedPercentComplete}%\n`;
    output += `   Reason: ${suggestion.reasoning}\n\n`;
  }

  output += '\n*These are AI-generated suggestions. Please review before applying to the schedule.*';

  return output;
}
