#!/usr/bin/env node
/**
 * Generate Agent Task Files
 * 
 * Automatically generates task files for Codex, Cursor, or other agents
 * based on the current workflow status and role assignments.
 * 
 * Usage:
 *   node scripts/generate-agent-tasks.js <agent-name>
 * 
 * Examples:
 *   node scripts/generate-agent-tasks.js codex
 *   node scripts/generate-agent-tasks.js cursor
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const STATUS_FILE = path.join(ROOT_DIR, '.workflow-status.json');
const ROLE_ASSIGNMENTS = path.join(ROOT_DIR, 'ROLE_ASSIGNMENTS.md');
const TASK_TEMPLATE_DIR = path.join(ROOT_DIR, '.templates');

// Read workflow status
function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading workflow status:', error);
    process.exit(1);
  }
}

// Generate task file for an agent
function generateTaskFile(agentName) {
  const status = readStatus();
  const agentKey = agentName.toLowerCase().replace(/\s+/g, '-');
  
  // Get current work for this agent
  const currentWork = status.currentWork?.[agentKey];
  
  if (!currentWork) {
    console.error(`No current work found for agent: ${agentName}`);
    console.log('Available agents:', Object.keys(status.currentWork || {}));
    process.exit(1);
  }

  const phase = status.currentWork.phase || 'Current Phase';
  const task = currentWork.task || 'Complete assigned tasks';
  const files = currentWork.files || [];
  const branch = currentWork.branch || 'main';

  // Generate quick start file
  const quickStartContent = generateQuickStart(agentName, phase, task, files, branch, currentWork);
  
  // Generate detailed tasks file
  const detailedContent = generateDetailedTasks(agentName, phase, task, files, branch, currentWork, status);

  // Write files
  const quickStartFile = path.join(ROOT_DIR, `${agentName.toUpperCase()}_QUICK_START.md`);
  const detailedFile = path.join(ROOT_DIR, `${agentName.toUpperCase()}_TASKS.md`);

  fs.writeFileSync(quickStartFile, quickStartContent);
  fs.writeFileSync(detailedFile, detailedContent);

  console.log(`✅ Generated task files for ${agentName}:`);
  console.log(`   - ${quickStartFile}`);
  console.log(`   - ${detailedFile}`);
}

function generateQuickStart(agentName, phase, task, files, branch, currentWork) {
  const status = currentWork.status || 'pending';
  
  return `# ${agentName.toUpperCase()} Quick Start - ${phase}

## Current Task
**Status:** ${status}  
**Branch:** \`${branch}\`  
**Task:** ${task}

## What You Need to Do

${generateTaskInstructions(agentName, currentWork, files)}

## Quick Instructions

1. **Read this file first** - Start here for quick overview
2. **Read detailed file** - \`${agentName.toUpperCase()}_TASKS.md\` for full context
3. **Work on branch:** \`${branch}\`
4. **Commit with prefix:** \`[${agentName.toUpperCase()}]\` (or \`[${agentName.toUpperCase().replace(' ', ' ')}]\` if multi-word)
5. **Files you'll work with:**
${files.map(f => `   - \`${f}\``).join('\n')}

## If You're Stuck

- Check \`${agentName.toUpperCase()}_TASKS.md\` for detailed instructions
- Check \`PHASE1_PROGRESS.md\` (or similar) for context
- Check \`ROLE_ASSIGNMENTS.md\` for your role details
- Check \`.workflow-status.json\` for current status

## After Completing

1. Update \`.workflow-status.json\` - mark your tasks as completed
2. Commit all changes with proper prefix
3. Push to branch: \`${branch}\`
`;
}

function generateDetailedTasks(agentName, phase, task, files, branch, currentWork, status) {
  return `# ${agentName.toUpperCase()} ${phase} - Detailed Tasks

## Current Status
- **Branch:** \`${branch}\`
- **Phase:** ${phase}
- **Your Status:** ${currentWork.status || 'pending'}
- **Task:** ${task}

## Your Tasks (${agentName.toUpperCase()})

${generateDetailedTaskList(agentName, currentWork, files, status)}

## Files You'll Need to Read

${files.map(f => `1. \`${f}\` - ${getFileDescription(f)}`).join('\n')}

## Testing Setup

${getTestingInstructions()}

## Success Criteria

${getSuccessCriteria(agentName, currentWork)}

## After Completing

1. Update \`.workflow-status.json\` - mark your tasks as completed
2. Commit all changes with \`[${agentName.toUpperCase()}]\` prefix
3. Push to branch: \`${branch}\`
4. Note: Next agent will review after you're done

## Questions?

If you're stuck:
- Check \`PHASE1_PROGRESS.md\` (or similar) for context
- Read \`ROLE_ASSIGNMENTS.md\` for your role details
- Check existing code patterns in the project
- Check \`.workflow-status.json\` for current status
`;
}

function generateTaskInstructions(agentName, currentWork, files) {
  // This would be customized based on the agent and task
  // For now, provide a generic structure
  return `### Priority Tasks

1. **Review assigned files** - Check what needs to be done
2. **Follow role assignments** - See \`ROLE_ASSIGNMENTS.md\`
3. **Complete tasks** - Work through the detailed task list
4. **Test your changes** - Ensure everything works
5. **Commit and push** - Use proper commit prefix

### Key Files
${files.slice(0, 5).map(f => `- \`${f}\``).join('\n')}
${files.length > 5 ? `- ... and ${files.length - 5} more files` : ''}
`;
}

function generateDetailedTaskList(agentName, currentWork, files, status) {
  // This would parse ROLE_ASSIGNMENTS.md or use a template
  // For now, provide a generic structure
  return `### Task 1: [Main Task]

**Description:** ${currentWork.task}

**Steps:**
1. Review the assigned files
2. Understand the current implementation
3. Make necessary changes
4. Test your changes
5. Commit with proper prefix

**Commit:** \`[${agentName.toUpperCase()}] ${currentWork.task}\`

---

*Note: Detailed task breakdown should be customized based on the specific phase and agent role. See ROLE_ASSIGNMENTS.md for specific tasks.*
`;
}

function getFileDescription(filePath) {
  // Provide descriptions based on file patterns
  if (filePath.includes('types/')) return 'Type definitions';
  if (filePath.includes('lib/')) return 'Utility functions';
  if (filePath.includes('hooks/')) return 'React hooks';
  if (filePath.includes('components/')) return 'React components';
  if (filePath.includes('__tests__/')) return 'Test files';
  return 'Project file';
}

function getTestingInstructions() {
  return `**Check if testing is set up:**
- Look for \`jest.config.js\`, \`vitest.config.ts\`, or test scripts in \`package.json\`
- If not set up, you may need to configure testing framework

**Run tests:**
\`\`\`bash
npm test
# or
yarn test
\`\`\`

**Note:** If testing setup is complex, focus on other tasks first.`;
}

function getSuccessCriteria(agentName, currentWork) {
  return `✅ All assigned tasks completed  
✅ Code follows project conventions  
✅ TypeScript compiles without errors  
✅ Changes tested (if applicable)  
✅ Commits use proper prefix: \`[${agentName.toUpperCase()}]\`
`;
}

// Main
const agentName = process.argv[2];

if (!agentName) {
  console.error('Usage: node scripts/generate-agent-tasks.js <agent-name>');
  console.error('Example: node scripts/generate-agent-tasks.js codex');
  process.exit(1);
}

generateTaskFile(agentName);
