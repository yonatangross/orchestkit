/**
 * Context Budget Monitor - After Tool Use Hook
 * Monitors context usage and triggers compression when threshold exceeded
 *
 * Triggers compression at 70% budget utilization
 * Target after compression: 50%
 *
 * Version: 2.0.0
 * Part of Context Engineering 2.0
 */

import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir, getSessionId, logHook } from '../lib/common.js';

// Configuration
const BUDGET_TOTAL = 2200; // Total token budget for context layer
const COMPRESS_TRIGGER = 0.70; // Trigger compression at 70%
const COMPRESS_TARGET = 0.50; // Target 50% after compression
const MCP_DEFER_TRIGGER = 0.10; // Defer MCP tools when context >10% of effective window

/**
 * Estimate tokens from file content (~4 chars per token)
 */
function estimateTokens(filePath: string): number {
  if (!existsSync(filePath)) return 0;

  try {
    const stats = statSync(filePath);
    return Math.floor(stats.size / 4);
  } catch {
    return 0;
  }
}

/**
 * Calculate total loaded context
 */
function calculateUsage(): number {
  const projectDir = getProjectDir();
  const contextDir = `${projectDir}/context`;

  const alwaysLoadedFiles = [
    `${contextDir}/identity.json`,
    `${contextDir}/session/state.json`,
    `${contextDir}/knowledge/index.json`,
    `${contextDir}/knowledge/blockers/current.json`,
  ];

  let total = 0;
  for (const file of alwaysLoadedFiles) {
    total += estimateTokens(file);
  }

  return total;
}

/**
 * Get effective context window (actual usable vs static max)
 */
function getEffectiveContextWindow(): number {
  const baseWindow = parseInt(process.env.CLAUDE_MAX_CONTEXT || '200000', 10);
  const overheadPercent = 20; // ~20% system overhead
  return Math.floor(baseWindow * (100 - overheadPercent) / 100);
}

/**
 * Check if MCP tools should be deferred
 */
function shouldDeferMcp(currentTokens: number): boolean {
  const effectiveWindow = getEffectiveContextWindow();
  if (effectiveWindow === 0) return true;

  const usageRatio = currentTokens / effectiveWindow;
  return usageRatio > MCP_DEFER_TRIGGER;
}

/**
 * Update MCP deferral state file
 */
function updateMcpDeferState(shouldDefer: boolean, currentTokens: number): void {
  const sessionId = getSessionId();
  const stateFile = `/tmp/claude-mcp-defer-state-${sessionId}.json`;
  const effectiveWindow = getEffectiveContextWindow();

  const state = {
    mcp_deferred: shouldDefer,
    context_tokens: currentTokens,
    effective_window: effectiveWindow,
    updated_at: new Date().toISOString(),
    reason: shouldDefer ? 'context > 10% threshold' : 'context within limits',
  };

  try {
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {
    // Ignore write errors
  }

  logHook('context-budget-monitor',
    `MCP defer state updated: defer=${shouldDefer}, tokens=${currentTokens}, window=${effectiveWindow}`);
}

/**
 * Compress session state
 */
function compressSession(): void {
  const projectDir = getProjectDir();
  const sessionFile = `${projectDir}/context/session/state.json`;

  if (!existsSync(sessionFile)) return;

  try {
    const content = JSON.parse(readFileSync(sessionFile, 'utf8'));

    const compressed = {
      session_id: content.session_id,
      started: content.started,
      current_task: content.current_task,
      next_steps: (content.next_steps || []).slice(-3),
      blockers: content.blockers,
      _compressed: true,
      _compressed_at: new Date().toISOString(),
      _original_files_touched: (content.files_touched || []).length,
      _original_decisions: (content.decisions_this_session || []).length,
    };

    writeFileSync(sessionFile, JSON.stringify(compressed, null, 2));
    logHook('context-budget-monitor', 'Session state compressed');
  } catch {
    // Ignore compression errors
  }
}

/**
 * Archive old decisions
 */
function archiveOldDecisions(): void {
  const projectDir = getProjectDir();
  const decisionsFile = `${projectDir}/context/knowledge/decisions/active.json`;

  if (!existsSync(decisionsFile)) return;

  try {
    const content = JSON.parse(readFileSync(decisionsFile, 'utf8'));
    const decisions = content.decisions || [];

    if (decisions.length > 10) {
      logHook('context-budget-monitor', 'Archiving old decisions (keeping latest 5)...');

      // Create archive directory
      const archiveDir = `${projectDir}/context/archive/decisions`;
      mkdirSync(archiveDir, { recursive: true });

      // Archive older decisions
      const date = new Date();
      const archiveFile = `${archiveDir}/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}.json`;
      writeFileSync(archiveFile, JSON.stringify(decisions.slice(0, -5), null, 2));

      // Keep only latest 5
      content.decisions = decisions.slice(-5);
      writeFileSync(decisionsFile, JSON.stringify(content, null, 2));

      logHook('context-budget-monitor', `Archived ${decisions.length - 5} decisions to ${archiveFile}`);
    }
  } catch {
    // Ignore archive errors
  }
}

/**
 * Monitor context budget and trigger compression if needed
 */
export function contextBudgetMonitor(_input: HookInput): HookResult {
  try {
    const currentTokens = calculateUsage();

    // Guard against division by zero
    const usageRatio = currentTokens / BUDGET_TOTAL;
    const usagePercent = Math.floor(usageRatio * 100);

    logHook('context-budget-monitor',
      `Context usage: ${currentTokens} / ${BUDGET_TOTAL} tokens (${usagePercent}%)`);

    // CC 2.1.7: Check and update MCP deferral state
    const deferMcp = shouldDeferMcp(currentTokens);
    updateMcpDeferState(deferMcp, currentTokens);

    // Check if compression needed
    if (usageRatio > COMPRESS_TRIGGER) {
      logHook('context-budget-monitor',
        `WARNING: Context usage (${usagePercent}%) exceeds threshold (${COMPRESS_TRIGGER * 100}%)`);
      logHook('context-budget-monitor', 'Triggering compression...');

      // Compress session state
      compressSession();

      // Archive old decisions
      archiveOldDecisions();

      // Recalculate
      const newTokens = calculateUsage();
      const newRatio = newTokens / BUDGET_TOTAL;
      const newPercent = Math.floor(newRatio * 100);

      logHook('context-budget-monitor',
        `After compression: ${newTokens} / ${BUDGET_TOTAL} tokens (${newPercent}%)`);

      if (newRatio > COMPRESS_TARGET) {
        logHook('context-budget-monitor',
          'WARNING: Still above target. Manual review recommended.');
      } else {
        logHook('context-budget-monitor', 'Compression successful. Target achieved.');
      }
    } else {
      logHook('context-budget-monitor', 'Context usage within budget. No compression needed.');
    }
  } catch (error) {
    logHook('context-budget-monitor', `Error: ${error}`);
  }

  return outputSilentSuccess();
}
