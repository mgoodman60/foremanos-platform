"use strict";
/**
 * Daily Report Auto-Finalization Runner (Runtime Compatible)
 *
 * This script must be run from the Next.js app directory to properly resolve dependencies.
 * Usage: cd /home/ubuntu/construction_project_assistant/nextjs_space && npx tsx scripts/auto-finalize-reports-runtime.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv_1 = require("dotenv");
const date_fns_1 = require("date-fns");
// Load environment variables from .env file
(0, dotenv_1.config)();
const db_1 = require("../lib/db");
const report_finalization_1 = require("../lib/report-finalization");
// Configuration
const CONFIG = {
    logsDir: '/home/ubuntu/auto_finalize_logs',
};
// Timezone offset mapping (simplified - using standard offsets)
const TIMEZONE_OFFSETS = {
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'America/Phoenix': -7,
    'America/Anchorage': -9,
    'America/Honolulu': -10,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Asia/Tokyo': 9,
    'Australia/Sydney': 11,
    'UTC': 0,
};
/**
 * Convert UTC time to local time for a timezone
 */
function toLocalTime(utcDate, timezone) {
    const offset = TIMEZONE_OFFSETS[timezone] || 0;
    return (0, date_fns_1.addHours)(utcDate, offset);
}
/**
 * Evaluate all projects for finalization readiness
 */
async function evaluateProjects(currentTime) {
    const projects = await db_1.prisma.project.findMany({
        where: {
            dailyReportEnabled: true,
        },
        select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            finalizationTime: true,
        },
    });
    const evaluations = [];
    for (const project of projects) {
        const projectTime = toLocalTime(currentTime, project.timezone);
        const localTime = (0, date_fns_1.format)(projectTime, 'HH:mm');
        const targetDate = (0, date_fns_1.format)(projectTime, 'yyyy-MM-dd');
        const [targetHour, targetMinute] = project.finalizationTime.split(':').map(Number);
        const [currentHour, currentMinute] = localTime.split(':').map(Number);
        const isDue = currentHour >= targetHour && (currentHour > targetHour || currentMinute >= targetMinute);
        evaluations.push({
            projectId: project.id,
            projectName: project.name || 'Unnamed Project',
            slug: project.slug,
            timezone: project.timezone,
            finalizationTime: project.finalizationTime,
            localTime,
            isDue,
            skipReason: isDue ? undefined : `Local time ${localTime} before finalization time ${project.finalizationTime}`,
            targetDate: isDue ? targetDate : undefined,
        });
    }
    return evaluations;
}
/**
 * Process reports for finalization
 */
async function processReports(conversationIds) {
    const results = [];
    for (const conversationId of conversationIds) {
        try {
            const conversation = await db_1.prisma.conversation.findUnique({
                where: { id: conversationId },
                include: {
                    project: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            if (!conversation) {
                results.push({
                    reportId: conversationId,
                    projectId: 'unknown',
                    projectName: 'Unknown',
                    targetDate: 'unknown',
                    success: false,
                    error: 'Conversation not found',
                });
                continue;
            }
            const targetDate = conversation.dailyReportDate
                ? (0, date_fns_1.format)(new Date(conversation.dailyReportDate), 'yyyy-MM-dd')
                : (0, date_fns_1.format)(new Date(), 'yyyy-MM-dd');
            const result = await (0, report_finalization_1.finalizeReport)({
                conversationId,
                method: 'auto',
                skipWarning: false,
            });
            results.push({
                reportId: conversationId,
                projectId: conversation.project?.id || 'unknown',
                projectName: conversation.project?.name || 'Unknown',
                targetDate,
                success: result.success && result.finalized,
                error: result.error || result.warning,
                documentId: result.documentId,
                onedriveExported: result.onedriveExported,
                ragIndexed: result.ragIndexed,
            });
        }
        catch (error) {
            results.push({
                reportId: conversationId,
                projectId: 'unknown',
                projectName: 'Unknown',
                targetDate: 'unknown',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    return results;
}
/**
 * Write detailed Markdown run report
 */
function writeRunReport(results) {
    if (!fs.existsSync(CONFIG.logsDir)) {
        fs.mkdirSync(CONFIG.logsDir, { recursive: true });
    }
    const timestamp = (0, date_fns_1.format)(results.timestamp, 'yyyyMMdd_HHmmss');
    const filename = `auto_finalize_run_${timestamp}.md`;
    const filepath = path.join(CONFIG.logsDir, filename);
    let content = `# Daily Report Auto-Finalization Run\n\n`;
    content += `**Run Time (UTC):** ${(0, date_fns_1.format)(results.timestamp, 'yyyy-MM-dd HH:mm:ss')}\n\n`;
    content += `## Summary\n\n`;
    content += `- **Projects Evaluated:** ${results.totalProjects}\n`;
    content += `- **Projects Due:** ${results.projectsDue}\n`;
    content += `- **Reports Found:** ${results.reportsFound}\n`;
    content += `- **Reports Finalized:** ${results.reportsFinalized}\n`;
    content += `- **Reports Failed:** ${results.reportsFailed}\n\n`;
    content += `## Projects Evaluated\n\n`;
    for (const proj of results.projectsEvaluated) {
        content += `### ${proj.projectName} (${proj.slug})\n\n`;
        content += `- **Project ID:** ${proj.projectId}\n`;
        content += `- **Timezone:** ${proj.timezone}\n`;
        content += `- **Finalization Time:** ${proj.finalizationTime}\n`;
        content += `- **Local Time:** ${proj.localTime}\n`;
        content += `- **Due This Run:** ${proj.isDue ? 'Yes' : 'No'}\n`;
        if (proj.skipReason) {
            content += `- **Skip Reason:** ${proj.skipReason}\n`;
        }
        if (proj.targetDate) {
            content += `- **Target Date:** ${proj.targetDate}\n`;
        }
        content += `\n`;
    }
    if (results.reportsProcessed.length > 0) {
        content += `## Reports Processed\n\n`;
        for (const report of results.reportsProcessed) {
            const status = report.success ? '✅ Success' : '❌ Failed';
            content += `### ${status} - ${report.projectName} (${report.targetDate})\n\n`;
            content += `- **Report ID:** ${report.reportId}\n`;
            content += `- **Project ID:** ${report.projectId}\n`;
            content += `- **Target Date:** ${report.targetDate}\n`;
            if (report.success) {
                if (report.documentId) {
                    content += `- **Document ID:** ${report.documentId}\n`;
                }
                if (report.onedriveExported !== undefined) {
                    content += `- **OneDrive Exported:** ${report.onedriveExported ? 'Yes' : 'No'}\n`;
                }
                if (report.ragIndexed !== undefined) {
                    content += `- **RAG Indexed:** ${report.ragIndexed ? 'Yes' : 'No'}\n`;
                }
            }
            else if (report.error) {
                content += `- **Error:** ${report.error}\n`;
            }
            content += `\n`;
        }
    }
    else {
        content += `## Reports Processed\n\n`;
        content += `No reports were processed during this run.\n\n`;
    }
    fs.writeFileSync(filepath, content, 'utf8');
    return filepath;
}
/**
 * Write error report
 */
function writeErrorReport(error) {
    if (!fs.existsSync(CONFIG.logsDir)) {
        fs.mkdirSync(CONFIG.logsDir, { recursive: true });
    }
    const timestamp = (0, date_fns_1.format)(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `auto_finalize_error_${timestamp}.md`;
    const filepath = path.join(CONFIG.logsDir, filename);
    let content = `# Daily Report Auto-Finalization Error\n\n`;
    content += `**Time (UTC):** ${(0, date_fns_1.format)(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n\n`;
    content += `## Error\n\n`;
    content += `**Message:** ${error.message}\n\n`;
    if (error.stack) {
        content += `**Stack Trace:**\n\n\`\`\`\n${error.stack}\n\`\`\`\n\n`;
    }
    fs.writeFileSync(filepath, content, 'utf8');
    return filepath;
}
/**
 * Main execution
 */
async function main() {
    try {
        console.log('[AUTO-FINALIZE] Starting auto-finalization run...');
        const currentTime = new Date();
        console.log(`[AUTO-FINALIZE] Current time (UTC): ${(0, date_fns_1.format)(currentTime, 'yyyy-MM-dd HH:mm:ss')}`);
        console.log('[AUTO-FINALIZE] Evaluating projects...');
        const projectEvaluations = await evaluateProjects(currentTime);
        console.log(`[AUTO-FINALIZE] Evaluated ${projectEvaluations.length} projects`);
        const projectsDue = projectEvaluations.filter(p => p.isDue).length;
        console.log(`[AUTO-FINALIZE] ${projectsDue} projects due for finalization`);
        console.log('[AUTO-FINALIZE] Fetching reports ready for finalization...');
        const conversationIds = await (0, report_finalization_1.getReportsReadyForFinalization)();
        console.log(`[AUTO-FINALIZE] Found ${conversationIds.length} reports to process`);
        let reportsProcessed = [];
        if (conversationIds.length > 0) {
            console.log('[AUTO-FINALIZE] Processing reports...');
            reportsProcessed = await processReports(conversationIds);
            const successCount = reportsProcessed.filter(r => r.success).length;
            const failCount = reportsProcessed.filter(r => !r.success).length;
            console.log(`[AUTO-FINALIZE] Processing complete: ${successCount} succeeded, ${failCount} failed`);
        }
        else {
            console.log('[AUTO-FINALIZE] No reports to process');
        }
        const results = {
            timestamp: currentTime,
            projectsEvaluated: projectEvaluations,
            reportsProcessed,
            totalProjects: projectEvaluations.length,
            projectsDue,
            reportsFound: conversationIds.length,
            reportsFinalized: reportsProcessed.filter(r => r.success).length,
            reportsFailed: reportsProcessed.filter(r => !r.success).length,
        };
        console.log('[AUTO-FINALIZE] Writing run report...');
        const reportPath = writeRunReport(results);
        console.log(`[AUTO-FINALIZE] Run report written to: ${reportPath}`);
        console.log('[AUTO-FINALIZE] Finalization run completed successfully');
        await db_1.prisma.$disconnect();
        process.exit(0);
    }
    catch (error) {
        console.error('[AUTO-FINALIZE] Fatal error during execution:', error);
        try {
            const errorReportPath = writeErrorReport(error);
            console.error(`[AUTO-FINALIZE] Error report written to: ${errorReportPath}`);
        }
        catch (writeError) {
            console.error('[AUTO-FINALIZE] Failed to write error report:', writeError);
        }
        await db_1.prisma.$disconnect();
        process.exit(1);
    }
}
// Execute
main();
