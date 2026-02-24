/**
 * Field Intelligence Advisor Agent — Trigger.dev Task
 *
 * Analyzes field reports, weather impacts, and site conditions to
 * provide actionable field intelligence recommendations.
 */

import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";
import { executeAgentCheck } from "@/lib/plugin/agent-executor";
import { logger } from "@/lib/logger";

interface AgentPayload {
  projectId: string;
  projectSlug: string;
  triggeredBy?: 'schedule' | 'manual' | 'event';
}

export const fieldIntelligenceAdvisorTask = task({
  id: "agent-field-intelligence-advisor",
  maxDuration: 300,
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30000 },
  run: async (payload: AgentPayload) => {
    const startTime = Date.now();
    triggerLogger.log(`Starting field-intelligence-advisor agent`, { projectId: payload.projectId });
    logger.info('AGENT_TASK', 'field-intelligence-advisor triggered', {
      projectId: payload.projectId,
      triggeredBy: payload.triggeredBy || 'manual',
    });

    const result = await executeAgentCheck('field-intelligence-advisor', payload.projectId, payload.projectSlug);

    const durationMs = Date.now() - startTime;
    triggerLogger.log(`field-intelligence-advisor completed`, {
      projectId: payload.projectId,
      alertCount: result.alerts.length,
      durationMs,
    });

    return result;
  },
});
