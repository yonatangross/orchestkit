/**
 * Pattern Sync Push - SessionEnd Hook
 * CC 2.1.7 Compliant: silent on success with suppressOutput
 * Pushes project patterns to global on session end
 *
 * Part of Cross-Project Patterns (#48)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface PatternFile {
  version?: string;
  patterns?: unknown[];
  sync_enabled?: boolean;
  updated?: string;
}

/**
 * Check if sync is enabled
 */
function isSyncEnabled(projectDir: string): boolean {
  const configFile = `${projectDir}/.claude/feedback/sync-config.json`;

  if (!existsSync(configFile)) {
    return true; // Default to enabled
  }

  try {
    const config = JSON.parse(readFileSync(configFile, 'utf-8'));
    return config.sync_enabled !== false;
  } catch {
    return true;
  }
}

/**
 * Push project patterns to global
 */
function pushProjectPatterns(projectDir: string): void {
  const projectPatternsFile = `${projectDir}/.claude/feedback/learned-patterns.json`;
  const globalPatternsFile = `${process.env.HOME}/.claude/global-patterns.json`;

  if (!existsSync(projectPatternsFile)) {
    logHook('pattern-sync-push', 'No project patterns file found');
    return;
  }

  try {
    const projectPatterns: PatternFile = JSON.parse(readFileSync(projectPatternsFile, 'utf-8'));
    const projectList = projectPatterns.patterns || [];

    if (projectList.length === 0) {
      logHook('pattern-sync-push', 'No project patterns to push');
      return;
    }

    // Load existing global patterns
    let globalPatterns: PatternFile = { version: '1.0', patterns: [], updated: '' };
    if (existsSync(globalPatternsFile)) {
      try {
        globalPatterns = JSON.parse(readFileSync(globalPatternsFile, 'utf-8'));
      } catch {
        // Use default if parse fails
      }
    }

    const globalList = globalPatterns.patterns || [];

    // Merge patterns (avoid duplicates by text)
    const existingTexts = new Set((globalList as Array<{ text?: string }>).map((p) => p.text));
    const newPatterns = (projectList as Array<{ text?: string }>).filter((p) => !existingTexts.has(p.text));

    if (newPatterns.length === 0) {
      logHook('pattern-sync-push', 'All project patterns already in global');
      return;
    }

    // Add new patterns
    const mergedPatterns = [...globalList, ...newPatterns];
    globalPatterns.patterns = mergedPatterns;
    globalPatterns.updated = new Date().toISOString();

    // Ensure directory exists
    mkdirSync(`${process.env.HOME}/.claude`, { recursive: true });

    // Write updated patterns
    writeFileSync(globalPatternsFile, JSON.stringify(globalPatterns, null, 2));
    logHook('pattern-sync-push', `Pushed ${newPatterns.length} new patterns to global`);
  } catch (err) {
    logHook('pattern-sync-push', `Failed to push project patterns: ${err}`);
  }
}

/**
 * Pattern sync push hook
 */
export function patternSyncPush(input: HookInput): HookResult {
  const projectDir = input.project_dir || getProjectDir();

  // Check if sync is enabled
  if (!isSyncEnabled(projectDir)) {
    logHook('pattern-sync-push', 'Global sync disabled, skipping push');
    return outputSilentSuccess();
  }

  // Push project patterns to global
  logHook('pattern-sync-push', 'Pushing project patterns to global...');
  pushProjectPatterns(projectDir);

  return outputSilentSuccess();
}
