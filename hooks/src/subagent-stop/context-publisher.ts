/**
 * Context Publisher - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Publishes agent decisions to context (Context Protocol 2.0).
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Path Helpers
// -----------------------------------------------------------------------------

function getDecisionsFile(): string {
  return `${getProjectDir()}/.claude/context/knowledge/decisions/active.json`;
}

function getSessionState(): string {
  return `${getProjectDir()}/.claude/context/session/state.json`;
}

function getLogDir(): string {
  return `${getProjectDir()}/.claude/logs/agent-context`;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

interface DecisionEntry {
  timestamp: string;
  agent: string;
  summary: string;
  status: string;
}

interface DecisionsFile {
  schema_version: string;
  decisions: Record<string, DecisionEntry>;
}

interface TaskEntry {
  agent: string;
  timestamp: string;
  summary: string;
}

interface SessionState {
  schema_version: string;
  session_id: string;
  started_at: string;
  last_activity: string;
  active_agent: string | null;
  tasks_pending: string[];
  tasks_completed: TaskEntry[];
}

function ensureDir(dirPath: string): void {
  try {
    mkdirSync(dirPath, { recursive: true });
  } catch {
    // Ignore
  }
}

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  if (!existsSync(filePath)) {
    return defaultValue;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return defaultValue;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  ensureDir(dir);
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function contextPublisher(input: HookInput): HookResult {
  const agentName = process.env.CLAUDE_AGENT_NAME || 'unknown';
  const timestamp = new Date().toISOString();

  // Read agent output from input
  const output = input.agent_output || input.output || '';

  // Extract summary from output (first 200 chars)
  let summary = output.substring(0, 200);
  if (output.length > 200) {
    summary += '...';
  }

  // Create agent key (replace hyphens with underscores for JSON)
  const agentKey = agentName.replace(/-/g, '_');

  // === Update Decisions File (Context Protocol 2.0) ===
  const decisionsFile = getDecisionsFile();
  const decisionsDir = decisionsFile.substring(0, decisionsFile.lastIndexOf('/'));
  ensureDir(decisionsDir);

  const defaultDecisions: DecisionsFile = {
    schema_version: '2.0.0',
    decisions: {},
  };

  const decisions = readJsonFile(decisionsFile, defaultDecisions);

  const decisionEntry: DecisionEntry = {
    timestamp,
    agent: agentName,
    summary,
    status: 'completed',
  };

  decisions.decisions[agentKey] = decisionEntry;
  writeJsonFile(decisionsFile, decisions);

  // === Update Session State (Context Protocol 2.0) ===
  const sessionStateFile = getSessionState();
  const sessionDir = sessionStateFile.substring(0, sessionStateFile.lastIndexOf('/'));
  ensureDir(sessionDir);

  const defaultState: SessionState = {
    schema_version: '2.0.0',
    session_id: '',
    started_at: timestamp,
    last_activity: timestamp,
    active_agent: null,
    tasks_pending: [],
    tasks_completed: [],
  };

  const sessionState = readJsonFile(sessionStateFile, defaultState);

  const taskEntry: TaskEntry = {
    agent: agentName,
    timestamp,
    summary,
  };

  sessionState.tasks_completed.push(taskEntry);
  sessionState.last_activity = timestamp;
  sessionState.active_agent = null;

  writeJsonFile(sessionStateFile, sessionState);

  // === Logging ===
  const logDir = getLogDir();
  ensureDir(logDir);

  const dateStr = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15);
  const logFile = `${logDir}/${agentName}_${dateStr}.log`;

  const logContent = `=== CONTEXT PUBLICATION (Protocol 2.0) ===
Agent: ${agentName}
Timestamp: ${timestamp}
Decisions file: ${decisionsFile}
Session state: ${sessionStateFile}

=== AGENT OUTPUT ===
${output}
`;

  try {
    writeFileSync(logFile, logContent);
  } catch {
    // Ignore
  }

  return outputSilentSuccess();
}
