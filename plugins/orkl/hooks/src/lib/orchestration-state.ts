/**
 * Orchestration State - Session state management for agent orchestration
 * Issue #197: Agent Orchestration Layer
 *
 * Manages:
 * - Active dispatched agents
 * - Injected skills tracking
 * - Prompt history for context continuity
 * - State persistence across hook invocations
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getProjectDir, getSessionId, logHook } from './common.js';
import type {
  OrchestrationState,
  DispatchedAgent,
  OrchestrationConfig,
  ClassificationResult,
} from './orchestration-types.js';

// -----------------------------------------------------------------------------
// State File Management
// -----------------------------------------------------------------------------

function getStateDir(): string {
  return `${getProjectDir()}/.claude/orchestration`;
}

function getStateFile(): string {
  const sessionId = getSessionId();
  return `${getStateDir()}/session-${sessionId}.json`;
}

function getConfigFile(): string {
  return `${getProjectDir()}/.claude/orchestration/config.json`;
}

/**
 * Ensure state directory exists
 */
function ensureStateDir(): void {
  const dir = getStateDir();
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      logHook('orchestration-state', `Failed to create state dir: ${dir}`);
    }
  }
}

// -----------------------------------------------------------------------------
// State Operations
// -----------------------------------------------------------------------------

/**
 * Load orchestration state for current session
 */
export function loadState(): OrchestrationState {
  const stateFile = getStateFile();

  if (existsSync(stateFile)) {
    try {
      const data = readFileSync(stateFile, 'utf8');
      return JSON.parse(data) as OrchestrationState;
    } catch (err) {
      logHook('orchestration-state', `Failed to load state: ${err}`);
    }
  }

  // Return default state
  return {
    sessionId: getSessionId(),
    activeAgents: [],
    injectedSkills: [],
    promptHistory: [],
    maxHistorySize: 10,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save orchestration state
 */
export function saveState(state: OrchestrationState): void {
  ensureStateDir();
  const stateFile = getStateFile();

  state.updatedAt = new Date().toISOString();

  try {
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    logHook('orchestration-state', `Failed to save state: ${err}`);
  }
}

/**
 * Update state with a mutation function
 */
export function updateState(
  mutate: (state: OrchestrationState) => void
): OrchestrationState {
  const state = loadState();
  mutate(state);
  saveState(state);
  return state;
}

// -----------------------------------------------------------------------------
// Agent Tracking
// -----------------------------------------------------------------------------

/**
 * Add a dispatched agent to state
 */
export function trackDispatchedAgent(
  agent: string,
  confidence: number,
  taskId?: string
): DispatchedAgent {
  const dispatched: DispatchedAgent = {
    agent,
    taskId,
    confidence,
    dispatchedAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
    maxRetries: 3,
  };

  updateState(state => {
    // Remove any existing entry for same agent
    state.activeAgents = state.activeAgents.filter(a => a.agent !== agent);
    state.activeAgents.push(dispatched);
  });

  logHook('orchestration-state', `Tracked dispatched agent: ${agent} (conf: ${confidence})`);
  return dispatched;
}

/**
 * Update agent status
 */
export function updateAgentStatus(
  agent: string,
  status: DispatchedAgent['status'],
  taskId?: string
): void {
  updateState(state => {
    const entry = state.activeAgents.find(a => a.agent === agent);
    if (entry) {
      entry.status = status;
      if (taskId) entry.taskId = taskId;
      if (status === 'retrying') entry.retryCount++;
    }
  });

  logHook('orchestration-state', `Updated agent status: ${agent} -> ${status}`);
}

/**
 * Remove completed/failed agent from tracking
 */
export function removeAgent(agent: string): void {
  updateState(state => {
    state.activeAgents = state.activeAgents.filter(a => a.agent !== agent);
  });
}

/**
 * Get currently active agent (if any)
 */
export function getActiveAgent(): DispatchedAgent | undefined {
  const state = loadState();
  return state.activeAgents.find(a => a.status === 'in_progress');
}

/**
 * Check if an agent is currently dispatched
 */
export function isAgentDispatched(agent: string): boolean {
  const state = loadState();
  return state.activeAgents.some(
    a => a.agent === agent && (a.status === 'pending' || a.status === 'in_progress')
  );
}

// -----------------------------------------------------------------------------
// Skill Tracking
// -----------------------------------------------------------------------------

/**
 * Track injected skill
 */
export function trackInjectedSkill(skill: string): void {
  updateState(state => {
    if (!state.injectedSkills.includes(skill)) {
      state.injectedSkills.push(skill);
    }
  });
}

/**
 * Check if skill was already injected
 */
export function isSkillInjected(skill: string): boolean {
  const state = loadState();
  return state.injectedSkills.includes(skill);
}

/**
 * Get all injected skills
 */
export function getInjectedSkills(): string[] {
  return loadState().injectedSkills;
}

// -----------------------------------------------------------------------------
// Prompt History
// -----------------------------------------------------------------------------

/**
 * Add prompt to history (for context continuity)
 */
export function addToPromptHistory(prompt: string): void {
  updateState(state => {
    state.promptHistory.push(prompt);
    // Trim to max size
    if (state.promptHistory.length > state.maxHistorySize) {
      state.promptHistory = state.promptHistory.slice(-state.maxHistorySize);
    }
  });
}

/**
 * Get recent prompt history
 */
export function getPromptHistory(): string[] {
  return loadState().promptHistory;
}

// -----------------------------------------------------------------------------
// Classification Caching
// -----------------------------------------------------------------------------

/**
 * Store last classification result
 */
export function cacheClassification(result: ClassificationResult): void {
  updateState(state => {
    state.lastClassification = result;
  });
}

/**
 * Get last classification result
 */
export function getLastClassification(): ClassificationResult | undefined {
  return loadState().lastClassification;
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const DEFAULT_CONFIG_VALUES: OrchestrationConfig = {
  enableAutoDispatch: true,
  enableSkillInjection: true,
  maxSkillInjectionTokens: 800,
  enableCalibration: true,
  enablePipelines: true,
  maxRetries: 3,
  retryDelayBaseMs: 1000,
};

/**
 * Load orchestration configuration
 */
export function loadConfig(): OrchestrationConfig {
  const configFile = getConfigFile();

  if (existsSync(configFile)) {
    try {
      const data = readFileSync(configFile, 'utf8');
      return { ...DEFAULT_CONFIG_VALUES, ...JSON.parse(data) };
    } catch {
      // Return defaults on error
    }
  }

  return DEFAULT_CONFIG_VALUES;
}

/**
 * Save orchestration configuration
 */
export function saveConfig(config: Partial<OrchestrationConfig>): void {
  ensureStateDir();
  const configFile = getConfigFile();
  const current = loadConfig();
  const merged = { ...current, ...config };

  try {
    writeFileSync(configFile, JSON.stringify(merged, null, 2));
  } catch (err) {
    logHook('orchestration-state', `Failed to save config: ${err}`);
  }
}

// -----------------------------------------------------------------------------
// Cleanup
// -----------------------------------------------------------------------------

/**
 * Clear session state (called on session end)
 */
export function clearSessionState(): void {
  const stateFile = getStateFile();

  try {
    if (existsSync(stateFile)) {
      const { unlinkSync } = require('node:fs');
      unlinkSync(stateFile);
      logHook('orchestration-state', 'Cleared session state');
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Clean up old state files (keep last 5 sessions)
 */
export function cleanupOldStates(): void {
  const dir = getStateDir();

  if (!existsSync(dir)) return;

  try {
    const { readdirSync, statSync, unlinkSync } = require('node:fs');
    const files = readdirSync(dir)
      .filter((f: string) => f.startsWith('session-') && f.endsWith('.json'))
      .map((f: string) => ({
        name: f,
        path: `${dir}/${f}`,
        mtime: statSync(`${dir}/${f}`).mtime.getTime(),
      }))
      .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime);

    // Keep only last 5
    for (const file of files.slice(5)) {
      try {
        unlinkSync(file.path);
        logHook('orchestration-state', `Cleaned up old state: ${file.name}`);
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
