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

  // P1: Core skill/memory injection
  'prompt/skill-resolver': 'P1',
  'subagent-start/graph-memory-inject': 'P1',

  // P2: Supplementary context
  'subagent-start/mem0-memory-inject': 'P2',
  'prompt/agent-auto-suggest': 'P2',
  'prompt/agent-orchestrator': 'P2',

  // P3: Monitoring and analytics
  'posttool/context-budget-monitor': 'P3',
  'prompt/context-pruning-advisor': 'P3',
  'prompt/satisfaction-detector': 'P3',
};

// -----------------------------------------------------------------------------
// Budget Thresholds
// -----------------------------------------------------------------------------

/** Per-category token budgets */
export const TOKEN_BUDGETS: Record<string, number> = {
  'skill-injection': 1200,
  'memory-inject': 800,
  'decision-capture': 500,  // Decision/preference detection and injection
  'suggestions': 400,
  'monitoring': 200,
  'total': 2600,  // Updated to include decision-capture
};

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
