/**
 * Data Integrity Watchdog Agent — Trigger.dev Task
 *
 * Monitors data consistency across project intelligence files,
 * detects anomalies, and flags integrity issues.
 */

import { task, logger as triggerLogger } from "@trigger.dev/sdk/v3";
import { executeAgentCheck } from "@/lib/plugin/agent-executor";
import { logger } from "@/lib/logger";

interface AgentPayload {
  projectId: string;
  projectSlug: string;
  triggeredBy?: 'schedule' | 'manual' | 'event';
}

export const dataIntegrityWatchdogTask = task({
  id: "agent-data-integrity-watchdog",
  maxDuration: 300,
  retry: { maxAttempts: 2, factor: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30000 },
  run: async (payload: AgentPayload) => {
    const startTime = Date.now();
    triggerLogger.log(`Starting data-integrity-watchdog agent`, { projectId: payload.projectId });
    logger.info('AGENT_TASK', 'data-integrity-watchdog triggered', {
      projectId: payload.projectId,
      triggeredBy: payload.triggeredBy || 'manual',
    });

    const result = await executeAgentCheck('data-integrity-watchdog', payload.projectId, payload.projectSlug);

    const durationMs = Date.now() - startTime;
    triggerLogger.log(`data-integrity-watchdog completed`, {
      projectId: payload.projectId,
      alertCount: result.alerts.length,
      durationMs,
    });

    return result;
  },
});
