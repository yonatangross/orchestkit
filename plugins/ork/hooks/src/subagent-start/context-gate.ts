/**
 * Context Gate - SubagentStart Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Prevents context overflow by limiting concurrent background agents.
 *
 * Strategy:
 * - Track active background agents in session
 * - Block new background spawns when limit exceeded
 * - Force sequential execution for expensive operations
 * - Suggest context compression when approaching limits
 *
 * Version: 1.0.0 (TypeScript port)
 * Part of Context Engineering 2.0
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputDeny, outputWarning, logHook, getProjectDir } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const MAX_CONCURRENT_BACKGROUND = 4;
const MAX_AGENTS_PER_RESPONSE = 6;
const WARNING_THRESHOLD = 3;
const EXPENSIVE_TYPES = /^(test-generator|backend-system-architect|workflow-architect|security-auditor|llm-integrator)$/;

// State file paths
function getStateFile(): string {
  return `${getProjectDir()}/.claude/logs/agent-state.json`;
}

function getSpawnLog(): string {
  return `${getProjectDir()}/.claude/logs/subagent-spawns.jsonl`;
}

// -----------------------------------------------------------------------------
// State Tracking
// -----------------------------------------------------------------------------

interface StateData {
  active_background: string[];
  session_total: number;
  last_cleanup: string | null;
  blocked_count: number;
}

function initState(): void {
  const stateFile = getStateFile();
  const dir = stateFile.substring(0, stateFile.lastIndexOf('/'));

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Ignore
  }

  if (!existsSync(stateFile)) {
    const initialState: StateData = {
      active_background: [],
      session_total: 0,
      last_cleanup: null,
      blocked_count: 0,
    };
    try {
      writeFileSync(stateFile, JSON.stringify(initialState, null, 2));
    } catch {
      // Ignore
    }
  }
}

function countActiveBackground(): number {
  const spawnLog = getSpawnLog();
  if (!existsSync(spawnLog)) {
    return 0;
  }

  try {
    const content = readFileSync(spawnLog, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const recentLines = lines.slice(-20);

    // Count agents spawned in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let count = 0;

    for (const line of recentLines) {
      try {
        const entry = JSON.parse(line);
        if (entry.timestamp && entry.timestamp > fiveMinutesAgo) {
          count++;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return count;
  } catch {
    return 0;
  }
}

function countCurrentResponseAgents(): number {
  const spawnLog = getSpawnLog();
  if (!existsSync(spawnLog)) {
    return 0;
  }

  try {
    const content = readFileSync(spawnLog, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const recentLines = lines.slice(-20);

    // Count agents spawned in last 2 seconds (same response)
    const twoSecondsAgo = new Date(Date.now() - 2 * 1000).toISOString();
    let count = 0;

    for (const line of recentLines) {
      try {
        const entry = JSON.parse(line);
        if (entry.timestamp && entry.timestamp > twoSecondsAgo) {
          count++;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return count;
  } catch {
    return 0;
  }
}

function incrementBlockedCount(): void {
  const stateFile = getStateFile();
  try {
    if (existsSync(stateFile)) {
      const state: StateData = JSON.parse(readFileSync(stateFile, 'utf8'));
      state.blocked_count = (state.blocked_count || 0) + 1;
      writeFileSync(stateFile, JSON.stringify(state, null, 2));
    }
  } catch {
    // Ignore
  }
}

function incrementSessionTotal(): void {
  const stateFile = getStateFile();
  try {
    if (existsSync(stateFile)) {
      const state: StateData = JSON.parse(readFileSync(stateFile, 'utf8'));
      state.session_total = (state.session_total || 0) + 1;
      writeFileSync(stateFile, JSON.stringify(state, null, 2));
    }
  } catch {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function contextGate(input: HookInput): HookResult {
  initState();

  const toolInput = input.tool_input || {};
  const subagentType = (toolInput.subagent_type as string) || '';
  const description = (toolInput.description as string) || '';
  const runInBackground = toolInput.run_in_background === true || toolInput.run_in_background === 'true';

  logHook('context-gate', `Context gate check: ${subagentType} (background=${runInBackground})`);

  // Count current state
  const activeCount = countActiveBackground();
  const responseCount = countCurrentResponseAgents();

  logHook('context-gate', `Active background: ${activeCount}, Current response: ${responseCount}`);

  // Check 1: Too many agents in single response
  if (responseCount >= MAX_AGENTS_PER_RESPONSE) {
    logHook('context-gate', `BLOCKED: Too many agents in single response (${responseCount} >= ${MAX_AGENTS_PER_RESPONSE})`);

    return outputDeny(`Context Overflow Protection

Too many agents spawned in a single response (${responseCount} agents).

Maximum allowed: ${MAX_AGENTS_PER_RESPONSE} per response

SOLUTION: Split into multiple responses or use sequential execution.
Consider using the /context-compression skill first.

Attempted: ${subagentType} - ${description}`);
  }

  // Check 2: Too many concurrent background agents
  if (runInBackground && activeCount >= MAX_CONCURRENT_BACKGROUND) {
    logHook('context-gate', `BLOCKED: Too many concurrent background agents (${activeCount} >= ${MAX_CONCURRENT_BACKGROUND})`);

    incrementBlockedCount();

    return outputDeny(`Background Agent Limit

Too many background agents running concurrently (${activeCount} active).

Maximum allowed: ${MAX_CONCURRENT_BACKGROUND} concurrent background agents

SOLUTION:
1. Wait for existing agents to complete
2. Run this agent in foreground (remove run_in_background)
3. Use /context-compression to free up context

Attempted: ${subagentType} - ${description}`);
  }

  // Warning: Approaching limits
  if (activeCount >= WARNING_THRESHOLD) {
    logHook('context-gate', `WARNING: Approaching context budget limit`);

    // Update session total
    incrementSessionTotal();

    return outputWarning(`Context Budget Warning

${activeCount} background agents active (limit: ${MAX_CONCURRENT_BACKGROUND}).

Consider:
- Running remaining agents sequentially
- Using /context-compression skill
- Waiting for current agents to complete

Proceeding with: ${subagentType} - ${description}`);
  }

  // Warning: Expensive agent type
  if (EXPENSIVE_TYPES.test(subagentType) && activeCount >= 2) {
    logHook('context-gate', `WARNING: Expensive agent type with multiple active: ${subagentType}`);
    return outputWarning(`Spawning expensive agent (${subagentType}) with ${activeCount} others active`);
  }

  // Update session total
  incrementSessionTotal();

  // Allow the agent to proceed
  logHook('context-gate', `Context gate passed: ${subagentType}`);

  return outputSilentSuccess();
}
