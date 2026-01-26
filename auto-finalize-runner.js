/**
 * Daily Report Auto-Finalization Runner (Using existing db module)
 */

const fs = require('fs');
const path = require('path');

// Simple timezone conversion helper
function convertToTimezone(date, timezone) {
  const dateStr = date.toLocaleString('en-US', { timeZone: timezone });
  return new Date(dateStr);
}

function formatDate(date, format) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  if (format === 'yyyy-MM-dd') return `${year}-${month}-${day}`;
  if (format === 'HH:mm') return `${hours}:${minutes}`;
  if (format === 'yyyy-MM-dd HH:mm:ss') return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  if (format === 'yyyyMMdd_HHmmss') return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  
  return date.toISOString();
}

const CONFIG = {
  logsDir: '/home/ubuntu/auto_finalize_logs',
};

async function main() {
  let prisma;
  
  try {
    console.log('[AUTO-FINALIZE] Starting auto-finalization run...');
    console.log('[AUTO-FINALIZE] Working directory:', process.cwd());
    
    // Change to the nextjs_space directory
    process.chdir('/home/ubuntu/construction_project_assistant/nextjs_space');
    console.log('[AUTO-FINALIZE] Changed to:', process.cwd());
    
    // Load environment variables
    require('dotenv').config();
    console.log('[AUTO-FINALIZE] Environment loaded');
    
    // Import Prisma client from the app's db module
    const dbModule = require('./lib/db.ts');
    prisma = dbModule.prisma;
    console.log('[AUTO-FINALIZE] Prisma client loaded');
    
    const currentTime = new Date();
    console.log(`[AUTO-FINALIZE] Current time (UTC): ${formatDate(currentTime, 'yyyy-MM-dd HH:mm:ss')}`);
    
    console.log('[AUTO-FINALIZE] Evaluating projects...');
    
    const projects = await prisma.project.findMany({
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
    
    console.log(`[AUTO-FINALIZE] Found ${projects.length} projects with daily reports enabled`);
    
    const projectEvaluations = [];
    const dueProjectIds = [];
    
    for (const project of projects) {
      try {
        const projectTime = convertToTimezone(currentTime, project.timezone);
        const localTime = formatDate(projectTime, 'HH:mm');
        const targetDate = formatDate(projectTime, 'yyyy-MM-dd');
        
        const [targetHour, targetMinute] = project.finalizationTime.split(':').map(Number);
        const [currentHour, currentMinute] = localTime.split(':').map(Number);
        
        const isDue = currentHour >= targetHour && (
          currentHour > targetHour || currentMinute >= targetMinute
        );
        
        projectEvaluations.push({
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
        
        if (isDue) {
          dueProjectIds.push(project.id);
        }
      } catch (error) {
        console.error(`[AUTO-FINALIZE] Error evaluating project ${project.id}:`, error.message);
        projectEvaluations.push({
          projectId: project.id,
          projectName: project.name || 'Unnamed Project',
          slug: project.slug,
          timezone: project.timezone,
          finalizationTime: project.finalizationTime,
          localTime: 'ERROR',
          isDue: false,
          skipReason: `Error: ${error.message}`,
        });
      }
    }
    
    const projectsDue = dueProjectIds.length;
    console.log(`[AUTO-FINALIZE] ${projectsDue} projects due for finalization`);
    
    // Fetch reports ready for finalization
    console.log('[AUTO-FINALIZE] Fetching reports ready for finalization...');
    
    const conversations = await prisma.conversation.findMany({
      where: {
        isDailyReport: true,
        finalized: false,
        projectId: { in: dueProjectIds },
      },
      select: {
        id: true,
        projectId: true,
        dailyReportDate: true,
      },
    });
    
    console.log(`[AUTO-FINALIZE] Found ${conversations.length} reports to process`);
    
    const reportsProcessed = [];
    
    if (conversations.length > 0) {
      console.log('[AUTO-FINALIZE] Processing reports...');
      
      // Import finalization function
      const finalizationModule = require('./lib/report-finalization.ts');
      const { finalizeReport } = finalizationModule;
      
      for (const conversation of conversations) {
        try {
          const conversationFull = await prisma.conversation.findUnique({
            where: { id: conversation.id },
            include: {
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });
          
          const targetDate = conversation.dailyReportDate
            ? formatDate(new Date(conversation.dailyReportDate), 'yyyy-MM-dd')
            : formatDate(new Date(), 'yyyy-MM-dd');
          
          console.log(`[AUTO-FINALIZE] Finalizing report ${conversation.id} for ${conversationFull.project?.name || 'Unknown'} (${targetDate})...`);
          
          const result = await finalizeReport({
            conversationId: conversation.id,
            method: 'auto',
            skipWarning: false,
          });
          
          reportsProcessed.push({
            reportId: conversation.id,
            projectId: conversationFull.project?.id || 'unknown',
            projectName: conversationFull.project?.name || 'Unknown',
            targetDate,
            success: result.success && result.finalized,
            error: result.error || result.warning,
            documentId: result.documentId,
            onedriveExported: result.onedriveExported,
            ragIndexed: result.ragIndexed,
          });
          
          if (result.success && result.finalized) {
            console.log(`[AUTO-FINALIZE] ✅ Successfully finalized report ${conversation.id}`);
          } else {
            console.log(`[AUTO-FINALIZE] ❌ Failed to finalize report ${conversation.id}: ${result.error || result.warning}`);
          }
          
        } catch (error) {
          console.error(`[AUTO-FINALIZE] Error processing report ${conversation.id}:`, error.message);
          reportsProcessed.push({
            reportId: conversation.id,
            projectId: conversation.projectId || 'unknown',
            projectName: 'Unknown',
            targetDate: 'unknown',
            success: false,
            error: error.message,
          });
        }
      }
      
      const successCount = reportsProcessed.filter(r => r.success).length;
      const failCount = reportsProcessed.filter(r => !r.success).length;
      
      console.log(`[AUTO-FINALIZE] Processing complete: ${successCount} succeeded, ${failCount} failed`);
    } else {
      console.log('[AUTO-FINALIZE] No reports to process');
    }
    
    // Write run report
    console.log('[AUTO-FINALIZE] Writing run report...');
    
    if (!fs.existsSync(CONFIG.logsDir)) {
      fs.mkdirSync(CONFIG.logsDir, { recursive: true });
    }
    
    const timestamp = formatDate(currentTime, 'yyyyMMdd_HHmmss');
    const filename = `auto_finalize_run_${timestamp}.md`;
    const filepath = path.join(CONFIG.logsDir, filename);
    
    let content = `# Daily Report Auto-Finalization Run\n\n`;
    content += `**Run Time (UTC):** ${formatDate(currentTime, 'yyyy-MM-dd HH:mm:ss')}\n\n`;
    
    content += `## Summary\n\n`;
    content += `- **Projects Evaluated:** ${projectEvaluations.length}\n`;
    content += `- **Projects Due:** ${projectsDue}\n`;
    content += `- **Reports Found:** ${conversations.length}\n`;
    content += `- **Reports Finalized:** ${reportsProcessed.filter(r => r.success).length}\n`;
    content += `- **Reports Failed:** ${reportsProcessed.filter(r => !r.success).length}\n\n`;
    
    content += `## Projects Evaluated\n\n`;
    
    for (const proj of projectEvaluations) {
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
    
    if (reportsProcessed.length > 0) {
      content += `## Reports Processed\n\n`;
      
      for (const report of reportsProcessed) {
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
        } else if (report.error) {
          content += `- **Error:** ${report.error}\n`;
        }
        
        content += `\n`;
      }
    } else {
      content += `## Reports Processed\n\n`;
      content += `No reports were processed during this run.\n\n`;
    }
    
    fs.writeFileSync(filepath, content, 'utf8');
    
    console.log(`[AUTO-FINALIZE] Run report written to: ${filepath}`);
    console.log('[AUTO-FINALIZE] Finalization run completed successfully');
    
    await prisma.$disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('[AUTO-FINALIZE] Fatal error during execution:', error);
    console.error('[AUTO-FINALIZE] Stack trace:', error.stack);
    
    try {
      if (!fs.existsSync(CONFIG.logsDir)) {
        fs.mkdirSync(CONFIG.logsDir, { recursive: true });
      }
      
      const timestamp = formatDate(new Date(), 'yyyyMMdd_HHmmss');
      const filename = `auto_finalize_error_${timestamp}.md`;
      const filepath = path.join(CONFIG.logsDir, filename);
      
      let content = `# Daily Report Auto-Finalization Error\n\n`;
      content += `**Time (UTC):** ${formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n\n`;
      content += `## Error\n\n`;
      content += `**Message:** ${error.message}\n\n`;
      
      if (error.stack) {
        content += `**Stack Trace:**\n\n\`\`\`\n${error.stack}\n\`\`\`\n\n`;
      }
      
      fs.writeFileSync(filepath, content, 'utf8');
      console.error(`[AUTO-FINALIZE] Error report written to: ${filepath}`);
    } catch (writeError) {
      console.error('[AUTO-FINALIZE] Failed to write error report:', writeError);
    }
    
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (e) {
        console.error('[AUTO-FINALIZE] Error disconnecting Prisma:', e);
      }
    }
    
    process.exit(1);
  }
}

main();
