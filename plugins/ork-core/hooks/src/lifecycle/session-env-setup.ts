/**
 * Session Environment Setup - Initializes session environment
 * Hook: SessionStart
 * CC 2.1.6 Compliant - Supports agent_type field
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getSessionId, outputSilentSuccess } from '../lib/common.js';

interface SessionState {
  agent_type?: string;
  session_id?: string;
  last_activity?: string;
  [key: string]: unknown;
}

interface SessionMetrics {
  session_id: string;
  started_at: string;
  agent_type: string;
  tools: Record<string, number>;
  errors: number;
  warnings: number;
}

/**
 * Get current git branch
 */
function getCurrentBranch(projectDir: string): string {
  try {
    return execSync('git branch --show-current', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 500,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Session environment setup hook
 */
export function sessionEnvSetup(input: HookInput): HookResult {
  logHook('session-env-setup', 'Setting up session environment');

  const projectDir = input.project_dir || getProjectDir();
  const sessionId = input.session_id || getSessionId();
  const metricsFile = '/tmp/claude-session-metrics.json';

  // Create logs directory if needed
  try {
    mkdirSync(`${projectDir}/.claude/logs`, { recursive: true });
  } catch {
    // Ignore mkdir errors
  }

  // Extract agent_type from environment or hook input
  let agentType = process.env.AGENT_TYPE || '';
  if (!agentType && input.agent_type) {
    agentType = input.agent_type;
  }

  // Initialize session metrics
  const metrics: SessionMetrics = {
    session_id: sessionId,
    started_at: new Date().toISOString(),
    agent_type: agentType,
    tools: {},
    errors: 0,
    warnings: 0,
  };

  try {
    writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
    logHook('session-env-setup', 'Initialized session metrics');
  } catch (err) {
    logHook('session-env-setup', `Failed to initialize metrics: ${err}`);
  }

  // Update session state with agent_type (CC 2.1.6 feature)
  const sessionState = `${projectDir}/.claude/context/session/state.json`;
  if (existsSync(sessionState) && agentType) {
    try {
      const state: SessionState = JSON.parse(readFileSync(sessionState, 'utf-8'));
      state.agent_type = agentType;
      state.session_id = sessionId;
      state.last_activity = new Date().toISOString();
      writeFileSync(sessionState, JSON.stringify(state, null, 2));
      logHook('session-env-setup', `Updated session state with agent_type: ${agentType}`);
    } catch (err) {
      logHook('session-env-setup', `Failed to update session state: ${err}`);
    }
  }

  // Check git status with timeout
  const branch = getCurrentBranch(projectDir);
  if (branch) {
    logHook('session-env-setup', `Git branch: ${branch}`);
  }

  // Log agent type if present
  if (agentType) {
    logHook('session-env-setup', `Agent type: ${agentType}`);
  }

  return outputSilentSuccess();
}
