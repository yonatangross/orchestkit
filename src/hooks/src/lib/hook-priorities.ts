/**
 * Hook Priority Queue - Priority-based throttling under context pressure
 *
 * Priority levels P0-P3. Under context pressure, lower-priority hooks
 * self-throttle to preserve budget for critical hooks.
 *
 * Disabled by default. Enable via .claude/orchestration/config.json:
 *   { "enablePriorityThrottling": true }
 */

import { logHook, getProjectDir } from './common.js';
import { getTotalUsage, getCategoryUsage } from './token-tracker.js';
import { scaleByContextWindow } from './context-window.js';
import { existsSync, readFileSync } from 'node:fs';

// -----------------------------------------------------------------------------
// Priority Levels
// -----------------------------------------------------------------------------

export type HookPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** Priority assignments for known hooks */
const HOOK_PRIORITIES: Record<string, HookPriority> = {
  // P0: Security - never throttled
  'pretool/bash/dangerous-command-blocker': 'P0',
  'pretool/write-edit/file-guard': 'P0',
  'pretool/Write/security-pattern-validator': 'P0',
  'permission/auto-approve-safe-bash': 'P0',
  'permission/auto-approve-project-writes': 'P0',

};

// -----------------------------------------------------------------------------
// Budget Thresholds
// -----------------------------------------------------------------------------

/**
 * Per-category token budgets.
 *
 * CC 2.1.32+ scales skill budget to 2% of context window:
 *   1M context   → ~20000 tokens for skills
 *
 * Baselines calibrated at the 1M context window; `scaleByContextWindow`
 * adjusts for smaller contexts or future expansions. Tokenizer drift
 * (e.g. Opus 4.7 adding ~0-35% overhead vs 4.6) is absorbed because
 * every on-path hook reads the same scaled budget.
 */
function getScaledBudgets(): Record<string, number> {
  return {
    'skill-injection': scaleByContextWindow(1200),
    'memory-inject': scaleByContextWindow(800),
    'decision-capture': scaleByContextWindow(500),
    'suggestions': scaleByContextWindow(400),
    'monitoring': scaleByContextWindow(200),
    'total': scaleByContextWindow(2600),
  };
}

/** Per-category token budgets (scaled by context window) */
export const TOKEN_BUDGETS: Record<string, number> = getScaledBudgets();

/** Throttle thresholds by priority (% of total budget) */
const THROTTLE_AT: Record<HookPriority, number> = {
  'P0': Infinity,  // Never throttle
  'P1': 0.90,      // Throttle at 90% budget
  'P2': 0.70,      // Throttle at 70% budget
  'P3': 0.50,      // Throttle at 50% budget
};

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Check if priority throttling is enabled.
 * Reads from .claude/orchestration/config.json.
 */
export function isPriorityThrottlingEnabled(): boolean {
  const configFile = `${getProjectDir()}/.claude/orchestration/config.json`;
  if (!existsSync(configFile)) return false;

  try {
    const config = JSON.parse(readFileSync(configFile, 'utf8'));
    return config.enablePriorityThrottling === true;
  } catch {
    return false;
  }
}

/**
 * Get the priority level for a hook.
 * Returns 'P2' as default for unknown hooks.
 */
export function getHookPriority(hookName: string): HookPriority {
  return HOOK_PRIORITIES[hookName] || 'P2';
}

/**
 * Check if a hook should be throttled based on current budget usage.
 * Always returns false if priority throttling is disabled.
 */
export function shouldThrottle(hookName: string): boolean {
  if (!isPriorityThrottlingEnabled()) return false;

  const priority = getHookPriority(hookName);
  if (priority === 'P0') return false; // P0 never throttles

  const totalUsage = getTotalUsage();
  const totalBudget = TOKEN_BUDGETS.total;
  const usageRatio = totalUsage / totalBudget;
  const threshold = THROTTLE_AT[priority];

  if (usageRatio >= threshold) {
    logHook('hook-priorities',
      `Throttling ${hookName} (${priority}): usage ${Math.round(usageRatio * 100)}% >= threshold ${Math.round(threshold * 100)}%`,
      'info');
    return true;
  }

  return false;
}

/**
 * Check if a specific category is over its budget.
 */
export function isOverBudget(category: string): boolean {
  const budget = TOKEN_BUDGETS[category];
  if (!budget) return false;
  return getCategoryUsage(category) >= budget;
}

/**
 * Get remaining budget for a category.
 */
export function remainingBudget(category: string): number {
  const budget = TOKEN_BUDGETS[category] || 0;
  const used = getCategoryUsage(category);
  return Math.max(0, budget - used);
}
