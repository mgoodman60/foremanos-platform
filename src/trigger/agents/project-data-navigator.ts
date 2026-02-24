/**
 * Project Data Navigator Agent — Trigger.dev Task
 *
 * Navigates and cross-references project data across all intelligence
 * files to surface connections and insights.
 */

import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";
import { executeAgentCheck } from "@/lib/plugin/agent-executor";
import { logger } from "@/lib/logger";

interface AgentPayload {
  projectId: string;
  projectSlug: string;
  triggeredBy?: 'schedule' | 'manual' | 'event';
}

export const projectDataNavigatorTask = task({
  id: "agent-project-data-navigator",
  maxDuration: 300,
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30000 },
  run: async (payload: AgentPayload) => {
    const startTime = Date.now();
    triggerLogger.log(`Starting project-data-navigator agent`, { projectId: payload.projectId });
    logger.info('AGENT_TASK', 'project-data-navigator triggered', {
      projectId: payload.projectId,
      triggeredBy: payload.triggeredBy || 'manual',
    });

    const result = await executeAgentCheck('project-data-navigator', payload.projectId, payload.projectSlug);

    const durationMs = Date.now() - startTime;
    triggerLogger.log(`project-data-navigator completed`, {
      projectId: payload.projectId,
      alertCount: result.alerts.length,
      durationMs,
    });

    return result;
  },
});
