#!/usr/bin/env node
/**
 * Automated Workflow Status Updater
 * 
 * This script automatically updates .workflow-status.json and WORKFLOW_LOG.md
 * based on git activity and commit messages.
 * 
 * Supports all agents:
 *   - [CLAUDE CODE] - Claude Code's commits
 *   - [CODEX] - Codex's commits
 *   - [HUMAN] - Human's commits
 * 
 * Usage:
 *   node scripts/update-workflow-status.js <action> [options]
 * 
 * Actions:
 *   - commit: Update status after commit (detects agent from commit message)
 *   - push: Update deployment status
 *   - start: Mark work as started
 *   - complete: Mark work as completed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const STATUS_FILE = path.join(ROOT_DIR, '.workflow-status.json');
const LOG_FILE = path.join(ROOT_DIR, 'WORKFLOW_LOG.md');

// Get current timestamp in ISO format
function getTimestamp() {
  return new Date().toISOString();
}

// Read current status
function readStatus() {
  try {
    const content = fs.readFileSync(STATUS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return {
      currentWork: null,
      queue: [],
      deployment: { status: 'idle' },
      recent: []
    };
  }
}

// Write status
function writeStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2) + '\n');
}

// Parse commit message for agent and task
function parseCommitMessage(message) {
  const claudeCodeMatch = message.match(/\[CLAUDE CODE\]\s*(.+)/i);
  const codexMatch = message.match(/\[CODEX\]\s*(.+)/i);
  const cursorMatch = message.match(/\[CURSOR\]\s*(.+)/i);
  const humanMatch = message.match(/\[HUMAN\]\s*(.+)/i);
  
  if (claudeCodeMatch) {
    return { agent: 'claude-code', task: claudeCodeMatch[1].split('\n')[0].trim() };
  }
  if (codexMatch) {
    return { agent: 'codex', task: codexMatch[1].split('\n')[0].trim() };
  }
  if (cursorMatch) {
    return { agent: 'cursor', task: cursorMatch[1].split('\n')[0].trim() };
  }
  if (humanMatch) {
    return { agent: 'human', task: humanMatch[1].split('\n')[0].trim() };
  }
  
  return null;
}

// Get latest commit info
function getLatestCommit() {
  try {
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const message = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    return { hash, message, branch };
  } catch (error) {
    return null;
  }
}

// Update status after commit
function updateAfterCommit() {
  const commit = getLatestCommit();
  if (!commit) return;
  
  const parsed = parseCommitMessage(commit.message);
  if (!parsed) return; // Not a workflow commit
  
  const status = readStatus();
  
  // If there's current work matching this agent, mark as complete
  if (status.currentWork && status.currentWork.agent === parsed.agent) {
    status.recent.push({
      agent: parsed.agent,
      task: status.currentWork.task,
      completed: getTimestamp(),
      commit: commit.hash,
      branch: commit.branch
    });
    status.currentWork = null;
  } else {
    // Add to recent
    status.recent.push({
      agent: parsed.agent,
      task: parsed.task,
      completed: getTimestamp(),
      commit: commit.hash,
      branch: commit.branch
    });
  }
  
  // Keep only last 10 recent items
  if (status.recent.length > 10) {
    status.recent = status.recent.slice(-10);
  }
  
  writeStatus(status);
  console.log(`✅ Updated workflow status for ${parsed.agent} commit`);
}

// Update deployment status
function updateDeploymentStatus(action) {
  const commit = getLatestCommit();
  if (!commit) return;
  
  const status = readStatus();
  
  if (action === 'ready') {
    status.deployment = {
      status: 'ready',
      triggeredBy: 'human',
      branch: commit.branch,
      commit: commit.hash
    };
  } else if (action === 'deployed') {
    status.deployment = {
      ...status.deployment,
      status: 'deployed',
      deepAgentStatus: 'completed',
      deployedAt: getTimestamp()
    };
  }
  
  writeStatus(status);
  console.log(`✅ Updated deployment status: ${action}`);
}

// Main
const action = process.argv[2];
const option = process.argv[3];

switch (action) {
  case 'commit':
    updateAfterCommit();
    break;
  case 'push':
    updateDeploymentStatus('ready');
    break;
  case 'deployed':
    updateDeploymentStatus('deployed');
    break;
  default:
    console.log('Usage: node scripts/update-workflow-status.js <commit|push|deployed>');
    process.exit(1);
}
