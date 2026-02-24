/**
 * Deadline Sentinel Agent — Trigger.dev Task
 *
 * Proactively monitors all project deadlines across schedule milestones,
 * submittal due dates, RFI response windows, procurement lead times,
 * inspection prerequisites, and contract notice periods.
 */

import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";
import { executeAgentCheck } from "@/lib/plugin/agent-executor";
import { logger } from "@/lib/logger";

interface AgentPayload {
  projectId: string;
  projectSlug: string;
  triggeredBy?: 'schedule' | 'manual' | 'event';
}

export const deadlineSentinelTask = task({
  id: "agent-deadline-sentinel",
  maxDuration: 300,
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30000 },
  run: async (payload: AgentPayload) => {
    const startTime = Date.now();
    triggerLogger.log(`Starting deadline-sentinel agent`, { projectId: payload.projectId });
    logger.info('AGENT_TASK', 'deadline-sentinel triggered', {
      projectId: payload.projectId,
      triggeredBy: payload.triggeredBy || 'manual',
    });

    const result = await executeAgentCheck('deadline-sentinel', payload.projectId, payload.projectSlug);

    const durationMs = Date.now() - startTime;
    triggerLogger.log(`deadline-sentinel completed`, {
      projectId: payload.projectId,
      alertCount: result.alerts.length,
      durationMs,
    });

    return result;
  },
});
