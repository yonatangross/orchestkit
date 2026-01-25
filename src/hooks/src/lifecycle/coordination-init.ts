/**
 * Coordination Initialization - Register instance at session start
 * Hook: SessionStart
 * CC 2.1.7 Compliant: Self-guarding - only runs when CLAUDE_MULTI_INSTANCE=1
 * Version: 1.1.0
 * Optimized with timeout to prevent startup hangs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getSessionId, outputSilentSuccess } from '../lib/common.js';

interface SessionState {
  current_task?: {
    description?: string;
  };
}

/**
 * Check if multi-instance mode is enabled
 */
function isMultiInstanceEnabled(): boolean {
  return process.env.CLAUDE_MULTI_INSTANCE === '1';
}

/**
 * Check if slow hooks should be skipped
 */
function shouldSkipSlowHooks(): boolean {
  return process.env.ORCHESTKIT_SKIP_SLOW_HOOKS === '1';
}

/**
 * Get task description from session state
 */
function getTaskDescription(projectDir: string): string {
  const stateFile = `${projectDir}/.claude/context/session/state.json`;

  if (!existsSync(stateFile)) {
    return 'General development';
  }

  try {
    const state: SessionState = JSON.parse(readFileSync(stateFile, 'utf-8'));
    return state.current_task?.description || 'General development';
  } catch {
    return 'General development';
  }
}

/**
 * Get agent role from environment
 */
function getAgentRole(): string {
  return process.env.CLAUDE_SUBAGENT_ROLE || 'main';
}

/**
 * Generate unique instance ID
 */
function generateInstanceId(): string {
  const sessionId = getSessionId();
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8);
  return `${sessionId.slice(0, 8)}-${timestamp}-${random}`;
}

/**
 * Save instance ID to environment file
 */
function saveInstanceId(projectDir: string, instanceId: string): void {
  const envFile = `${projectDir}/.claude/.instance_env`;

  try {
    mkdirSync(`${projectDir}/.claude`, { recursive: true });
    appendFileSync(envFile, `CLAUDE_INSTANCE_ID=${instanceId}\n`);
    logHook('coordination-init', `Saved instance ID: ${instanceId}`);
  } catch (err) {
    logHook('coordination-init', `Failed to save instance ID: ${err}`);
  }
}

/**
 * Initialize heartbeat for this instance
 */
function initHeartbeat(projectDir: string, instanceId: string, taskDesc: string, agentRole: string): void {
  const heartbeatsDir = `${projectDir}/.claude/coordination/heartbeats`;

  try {
    mkdirSync(heartbeatsDir, { recursive: true });

    const heartbeat = {
      instance_id: instanceId,
      task: taskDesc,
      role: agentRole,
      status: 'active',
      started_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
    };

    writeFileSync(`${heartbeatsDir}/${instanceId}.json`, JSON.stringify(heartbeat, null, 2));
    logHook('coordination-init', `Initialized heartbeat for ${instanceId}`);
  } catch (err) {
    logHook('coordination-init', `Failed to initialize heartbeat: ${err}`);
  }
}

/**
 * Coordination initialization hook
 */
export function coordinationInit(input: HookInput): HookResult {
  // Self-guard: Only run when multi-instance mode is enabled
  if (!isMultiInstanceEnabled()) {
    logHook('coordination-init', 'Multi-instance not enabled, skipping');
    return outputSilentSuccess();
  }

  // Bypass if slow hooks are disabled
  if (shouldSkipSlowHooks()) {
    logHook('coordination-init', 'Skipping coordination init (ORCHESTKIT_SKIP_SLOW_HOOKS=1)');
    return outputSilentSuccess();
  }

  logHook('coordination-init', 'Starting coordination initialization');

  const projectDir = input.project_dir || getProjectDir();
  const taskDesc = getTaskDescription(projectDir);
  const agentRole = getAgentRole();

  // Generate and save instance ID
  const instanceId = generateInstanceId();

  // Store instance ID for other hooks
  process.env.CLAUDE_INSTANCE_ID = instanceId;
  saveInstanceId(projectDir, instanceId);

  // Initial heartbeat
  initHeartbeat(projectDir, instanceId, taskDesc, agentRole);

  logHook('coordination-init', `Coordination initialized: ${instanceId}`);

  return outputSilentSuccess();
}
