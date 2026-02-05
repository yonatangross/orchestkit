/**
 * Subagent Context Stager - SubagentStart Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * This hook:
 * 1. Checks if there are active todos from session state
 * 2. Stages relevant context files based on the task description
 * 3. Returns systemMessage with staged context
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir, getSessionId } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Path Helpers
// -----------------------------------------------------------------------------

function getSessionState(): string {
  return `${getProjectDir()}/.claude/context/session/state.json`;
}

function getDecisionsFile(): string {
  return `${getProjectDir()}/.claude/context/knowledge/decisions/active.json`;
}

function getIssueDir(): string {
  return `${getProjectDir()}/docs/issues`;
}

// -----------------------------------------------------------------------------
// Context Extraction Functions
// -----------------------------------------------------------------------------

interface SessionState {
  tasks_pending?: string[];
  [key: string]: unknown;
}

interface DecisionsFile {
  decisions?: Array<{
    category?: string;
    title?: string;
    status?: string;
  }>;
}

function extractPendingTasks(): { count: number; summary: string } {
  const sessionState = getSessionState();
  if (!existsSync(sessionState)) {
    return { count: 0, summary: '' };
  }

  try {
    const state: SessionState = JSON.parse(readFileSync(sessionState, 'utf8'));
    const tasksPending = state.tasks_pending || [];
    const count = tasksPending.length;

    if (count === 0) {
      return { count: 0, summary: '' };
    }

    const summary = tasksPending.slice(0, 3).map((t) => `- ${t}`).join('\n');
    return { count, summary };
  } catch {
    return { count: 0, summary: '' };
  }
}

function extractRelevantDecisions(taskDescription: string, category: string): string {
  const decisionsFile = getDecisionsFile();
  if (!existsSync(decisionsFile)) {
    return '';
  }

  try {
    const data: DecisionsFile = JSON.parse(readFileSync(decisionsFile, 'utf8'));
    const decisions = data.decisions || [];

    const relevantDecisions = decisions
      .filter((d) => d.category === category || d.category === 'api' || d.category === 'database')
      .slice(0, 5)
      .map((d) => `- ${d.title} (${d.status || 'unknown'})`);

    return relevantDecisions.join('\n');
  } catch {
    return '';
  }
}

function findIssueDoc(issueNum: string): string {
  const issueDir = getIssueDir();
  if (!existsSync(issueDir)) {
    return '';
  }

  try {
    const entries = readdirSync(issueDir);
    const match = entries.find((entry) => entry.includes(issueNum));
    if (match) {
      return `docs/issues/${match}`;
    }
  } catch {
    // Ignore
  }
  return '';
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function subagentContextStager(input: HookInput): HookResult {
  const toolInput = input.tool_input || {};
  const subagentType = (toolInput.subagent_type as string) || '';
  const taskDescription = (toolInput.task_description as string) || (toolInput.description as string) || '';

  logHook('subagent-context-stager', `Staging context for ${subagentType}`);

  let stagedContext = '';

  // === CHECK FOR ACTIVE TODOS (Context Protocol 2.0) ===
  const { count: pendingCount, summary: taskSummary } = extractPendingTasks();
  if (pendingCount > 0) {
    logHook('subagent-context-stager', `Found ${pendingCount} pending tasks`);
    stagedContext += `ACTIVE TODOS:\n${taskSummary}\n\n`;
  }

  // === STAGE RELEVANT ARCHITECTURE DECISIONS ===
  const taskLower = taskDescription.toLowerCase();

  if (/backend|api|endpoint|database|migration/.test(taskLower)) {
    logHook('subagent-context-stager', 'Backend task detected - staging backend decisions');
    const backendDecisions = extractRelevantDecisions(taskDescription, 'backend');
    if (backendDecisions) {
      stagedContext += `RELEVANT DECISIONS:\n${backendDecisions}\n\n`;
    }
  }

  if (/frontend|react|ui|component/.test(taskLower)) {
    logHook('subagent-context-stager', 'Frontend task detected - staging frontend decisions');
    const frontendDecisions = extractRelevantDecisions(taskDescription, 'frontend');
    if (frontendDecisions) {
      stagedContext += `RELEVANT DECISIONS:\n${frontendDecisions}\n\n`;
    }
  }

  // === STAGE TESTING REMINDERS ===
  if (/test|testing|pytest|jest/.test(taskLower)) {
    logHook('subagent-context-stager', 'Testing task detected - staging test context');
    stagedContext += `TESTING REMINDERS:
- Use 'tee' for visible test output
- Check test patterns in backend/tests/ or frontend/src/**/__tests__/
- Ensure coverage meets threshold requirements

`;
  }

  // === STAGE ISSUE DOCUMENTATION ===
  if (/issue|#\d+|bug|fix/.test(taskLower)) {
    logHook('subagent-context-stager', 'Issue-related task detected');

    const issueMatch = taskDescription.match(/#(\d+)/);
    if (issueMatch) {
      const issueNum = issueMatch[1];
      const issueDoc = findIssueDoc(issueNum);
      if (issueDoc) {
        stagedContext += `ISSUE DOCS: ${issueDoc}\n\n`;
        logHook('subagent-context-stager', `Staged issue documentation for #${issueNum}`);
      }
    }
  }

  // === RETURN SYSTEM MESSAGE (CC 2.1.7 Compliant) ===
  if (stagedContext) {
    const systemMessage = `${stagedContext}\nTask: ${taskDescription}\nSubagent: ${subagentType}`;
    const lineCount = stagedContext.split('\n').filter(Boolean).length;
    logHook('subagent-context-stager', `Staged context with ${lineCount} lines`);

    return {
      continue: true,
      systemMessage,
    };
  }

  logHook('subagent-context-stager', 'No context staged for this task');
  return outputSilentSuccess();
}
