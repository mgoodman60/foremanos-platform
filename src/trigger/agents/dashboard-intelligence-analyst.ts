/**
 * Dashboard Intelligence Analyst Agent — Trigger.dev Task
 *
 * Analyzes dashboard data patterns and generates intelligent insights
 * for project dashboards.
 */

import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";
import { executeAgentCheck } from "@/lib/plugin/agent-executor";
import { logger } from "@/lib/logger";

interface AgentPayload {
  projectId: string;
  projectSlug: string;
  triggeredBy?: 'schedule' | 'manual' | 'event';
}

export const dashboardIntelligenceAnalystTask = task({
  id: "agent-dashboard-intelligence-analyst",
  maxDuration: 300,
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30000 },
  run: async (payload: AgentPayload) => {
    const startTime = Date.now();
    triggerLogger.log(`Starting dashboard-intelligence-analyst agent`, { projectId: payload.projectId });
    logger.info('AGENT_TASK', 'dashboard-intelligence-analyst triggered', {
      projectId: payload.projectId,
      triggeredBy: payload.triggeredBy || 'manual',
    });

    const result = await executeAgentCheck('dashboard-intelligence-analyst', payload.projectId, payload.projectSlug);

    const durationMs = Date.now() - startTime;
    triggerLogger.log(`dashboard-intelligence-analyst completed`, {
      projectId: payload.projectId,
      alertCount: result.alerts.length,
      durationMs,
    });

    return result;
  },
});
