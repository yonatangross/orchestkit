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

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, outputWarning, getProjectDir } from '../lib/common.js';
import { atomicWriteSync } from '../lib/atomic-write.js';
import { NOOP_CTX } from '../lib/context.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const MAX_CONCURRENT_BACKGROUND = 6;
const MAX_AGENTS_PER_RESPONSE = 8;
const WARNING_THRESHOLD = 5;
const EXPENSIVE_TYPES = /^(test-generator|backend-system-architect|workflow-architect|security-auditor|llm-integrator)$/;

// Worktree isolation: raise limits when in worktree (CC 2.1.49).
//
// Two layouts exist in practice (#3310): CC's own EnterWorktree creates
// `.claude/worktrees/<name>`, and the mandated hand-rolled layout (global
// CLAUDE.md, worktree-new.sh) is `<repo>/.worktrees/<task>`. The old second
// test, '/.git/worktrees/', matched NEITHER — that path holds git metadata,
// never a checkout a process could cwd into — so the raised limits had never
// applied exactly where parallel agents are routine.
function isInWorktree(): boolean {
  const cwd = process.cwd();
  return cwd.includes('.claude/worktrees/') || cwd.includes('/.worktrees/');
}

function getEffectiveLimits(): { maxBackground: number; maxPerResponse: number } {
  if (isInWorktree()) {
    return { maxBackground: 10, maxPerResponse: 12 };
  }
  return { maxBackground: MAX_CONCURRENT_BACKGROUND, maxPerResponse: MAX_AGENTS_PER_RESPONSE };
}

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
  const dir = dirname(stateFile);

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
      atomicWriteSync(stateFile, JSON.stringify(initialState, null, 2));
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
      atomicWriteSync(stateFile, JSON.stringify(state, null, 2));
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
      atomicWriteSync(stateFile, JSON.stringify(state, null, 2));
    }
  } catch {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function contextGate(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  initState();

  const toolInput = input.tool_input || {};
  const subagentType = (toolInput.subagent_type as string) || '';
  const description = (toolInput.description as string) || '';
  const runInBackground = toolInput.run_in_background === true || toolInput.run_in_background === 'true';

  ctx.log('context-gate', `Context gate check: ${subagentType} (background=${runInBackground})`);

  // Count current state
  const activeCount = countActiveBackground();
  const responseCount = countCurrentResponseAgents();

  ctx.log('context-gate', `Active background: ${activeCount}, Current response: ${responseCount}`);

  const limits = getEffectiveLimits();

  // Over-limit paths ADVISE rather than deny (#3310).
  //
  // The old outputDeny() envelope hardcodes hookEventName:'PreToolUse' and a
  // permissionDecision — a shape CC reads NOTHING of on SubagentStart, so the
  // "block" never blocked anything, once, while logging that it had. CC's own
  // runtime caps (16 concurrent / 1000 per run) are the real governor; this
  // hook's value is telling the model it is over budget, which the universal
  // { continue:true, systemMessage } shape delivers on every event.
  // incrementBlockedCount() stays: it now counts would-have-advised events,
  // and losing that telemetry would hide how often the situation occurs.

  // Check 1: Too many agents in single response
  if (responseCount >= limits.maxPerResponse) {
    ctx.log('context-gate', `ADVISORY: Too many agents in single response (${responseCount} >= ${limits.maxPerResponse})`);

    return outputWarning(
      `Too many agents in one response (${responseCount}/${limits.maxPerResponse}). ` +
        `Split into multiple responses or run sequentially. Spawning anyway: ${subagentType} — ${description}`,
    );
  }

  // Check 2: Too many concurrent background agents
  if (runInBackground && activeCount >= limits.maxBackground) {
    ctx.log('context-gate', `ADVISORY: Too many concurrent background agents (${activeCount} >= ${limits.maxBackground})`);

    incrementBlockedCount();

    return outputWarning(
      `Too many background agents (${activeCount}/${limits.maxBackground}). ` +
        `Prefer waiting for existing agents or running in foreground. Spawning anyway: ${subagentType} — ${description}`,
    );
  }

  // Warning: Approaching limits
  if (activeCount >= WARNING_THRESHOLD) {
    ctx.log('context-gate', `WARNING: Approaching context budget limit`);

    // Update session total
    incrementSessionTotal();

    return outputWarning(`Context Budget Warning

${activeCount} background agents active (limit: ${limits.maxBackground}).

Consider:
- Running remaining agents sequentially
- Using /context-optimization skill
- Waiting for current agents to complete

Proceeding with: ${subagentType} - ${description}`);
  }

  // Warning: Expensive agent type
  if (EXPENSIVE_TYPES.test(subagentType) && activeCount >= 2) {
    ctx.log('context-gate', `WARNING: Expensive agent type with multiple active: ${subagentType}`);
    return outputWarning(`Spawning expensive agent (${subagentType}) with ${activeCount} others active`);
  }

  // Update session total
  incrementSessionTotal();

  // Allow the agent to proceed
  ctx.log('context-gate', `Context gate passed: ${subagentType}`);

  return outputSilentSuccess();
}
