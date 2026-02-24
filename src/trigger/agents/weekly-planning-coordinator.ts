/**
 * Weekly Planning Coordinator Agent — Trigger.dev Task
 *
 * Coordinates weekly planning by analyzing schedule performance,
 * resource availability, and upcoming work to produce weekly
 * planning recommendations.
 */

import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";
import { executeAgentCheck } from "@/lib/plugin/agent-executor";
import { logger } from "@/lib/logger";

interface AgentPayload {
  projectId: string;
  projectSlug: string;
  triggeredBy?: 'schedule' | 'manual' | 'event';
}

export const weeklyPlanningCoordinatorTask = task({
  id: "agent-weekly-planning-coordinator",
  maxDuration: 300,
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30000 },
  run: async (payload: AgentPayload) => {
    const startTime = Date.now();
    triggerLogger.log(`Starting weekly-planning-coordinator agent`, { projectId: payload.projectId });
    logger.info('AGENT_TASK', 'weekly-planning-coordinator triggered', {
      projectId: payload.projectId,
      triggeredBy: payload.triggeredBy || 'manual',
    });

    const result = await executeAgentCheck('weekly-planning-coordinator', payload.projectId, payload.projectSlug);

    const durationMs = Date.now() - startTime;
    triggerLogger.log(`weekly-planning-coordinator completed`, {
      projectId: payload.projectId,
      alertCount: result.alerts.length,
      durationMs,
    });

    return result;
  },
});
