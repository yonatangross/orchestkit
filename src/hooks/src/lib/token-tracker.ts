/**
 * Session Token Tracker - Per-hook, per-category token usage tracking
 *
 * Tracks how many tokens each hook injects into Claude's context per session.
 * State persisted to .claude/orchestration/token-usage-{sessionId}.json.
 *
 * Used by Phase 3 budget enforcement to throttle low-priority hooks.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getProjectDir, getSessionId, logHook } from './common.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TokenRecord {
  hookName: string;
  category: string;
  tokens: number;
  timestamp: string;
}

interface SessionTokenState {
  sessionId: string;
  totalTokensInjected: number;
  byCategory: Record<string, number>;
  byHook: Record<string, number>;
  records: TokenRecord[];
}

// -----------------------------------------------------------------------------
// State Management
// -----------------------------------------------------------------------------

function getStateDir(): string {
  return `${getProjectDir()}/.claude/orchestration`;
}

function getTokenStateFile(): string {
  const sessionId = getSessionId();
  return `${getStateDir()}/token-usage-${sessionId}.json`;
}

function ensureStateDir(): void {
  const dir = getStateDir();
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }
}

function loadTokenState(): SessionTokenState {
  const stateFile = getTokenStateFile();

  if (existsSync(stateFile)) {
    try {
      return JSON.parse(readFileSync(stateFile, 'utf8')) as SessionTokenState;
    } catch {
      // Return fresh state on error
    }
  }

  return {
    sessionId: getSessionId(),
    totalTokensInjected: 0,
    byCategory: {},
    byHook: {},
    records: [],
  };
}

function saveTokenState(state: SessionTokenState): void {
  ensureStateDir();
  const stateFile = getTokenStateFile();

  try {
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {
    logHook('token-tracker', 'Failed to save token state');
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Track token usage for a hook invocation.
 * Call after building output content, before returning HookResult.
 */
export function trackTokenUsage(hookName: string, category: string, tokens: number): void {
  const state = loadTokenState();

  state.totalTokensInjected += tokens;
  state.byCategory[category] = (state.byCategory[category] || 0) + tokens;
  state.byHook[hookName] = (state.byHook[hookName] || 0) + tokens;

  // Keep last 100 records to avoid unbounded growth
  if (state.records.length >= 100) {
    state.records = state.records.slice(-80);
  }

  state.records.push({
    hookName,
    category,
    tokens,
    timestamp: new Date().toISOString(),
  });

  saveTokenState(state);

  logHook('token-tracker', `Tracked ${tokens}t for ${hookName} (${category})`);
}

/**
 * Get total tokens injected for a category this session.
 */
export function getCategoryUsage(category: string): number {
  const state = loadTokenState();
  return state.byCategory[category] || 0;
}

/**
 * Get total tokens injected across all categories this session.
 */
export function getTotalUsage(): number {
  return loadTokenState().totalTokensInjected;
}

/**
 * Get per-hook usage map.
 */
export function getHookUsage(): Record<string, number> {
  return loadTokenState().byHook;
}

/**
 * Get full session token state (for diagnostics).
 */
export function getTokenState(): SessionTokenState {
  return loadTokenState();
}
