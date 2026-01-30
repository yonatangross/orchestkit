/**
 * Pattern Sync Pull - SessionStart Hook
 * CC 2.1.7 Compliant: silent on success with suppressOutput
 * Pulls global patterns into project on session start
 *
 * Part of Cross-Project Patterns (#48)
 * Optimized with timeout and file size checks to prevent startup hangs
 */

import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';
import { getHomeDir } from '../lib/paths.js';

interface PatternFile {
  version?: string;
  patterns?: unknown[];
  sync_enabled?: boolean;
}

const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

/**
 * Check if slow hooks should be skipped
 */
function shouldSkipSlowHooks(): boolean {
  return process.env.ORCHESTKIT_SKIP_SLOW_HOOKS === '1';
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
 * Check if file size is within limits
 */
function checkFileSize(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return true; // File doesn't exist, that's fine
  }

  try {
    const stats = statSync(filePath);
    if (stats.size > MAX_FILE_SIZE_BYTES) {
      logHook('pattern-sync-pull', `WARN: Skipping - file too large: ${filePath} (${stats.size} bytes)`);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Pull global patterns into project
 */
function pullGlobalPatterns(projectDir: string): void {
  const home = getHomeDir();
  const globalPatternsFile = `${home}/.claude/global-patterns.json`;
  const projectPatternsFile = `${projectDir}/.claude/feedback/learned-patterns.json`;

  if (!existsSync(globalPatternsFile)) {
    logHook('pattern-sync-pull', 'No global patterns file found');
    return;
  }

  try {
    const globalPatterns: PatternFile = JSON.parse(readFileSync(globalPatternsFile, 'utf-8'));
    const globalList = globalPatterns.patterns || [];

    if (globalList.length === 0) {
      logHook('pattern-sync-pull', 'No global patterns to pull');
      return;
    }

    // Load existing project patterns
    let projectPatterns: PatternFile = { version: '1.0', patterns: [] };
    if (existsSync(projectPatternsFile)) {
      try {
        projectPatterns = JSON.parse(readFileSync(projectPatternsFile, 'utf-8'));
      } catch {
        // Use default if parse fails
      }
    }

    const projectList = projectPatterns.patterns || [];

    // Merge patterns (avoid duplicates by text)
    const existingTexts = new Set((projectList as Array<{ text?: string }>).map((p) => p.text));
    const newPatterns = (globalList as Array<{ text?: string }>).filter((p) => !existingTexts.has(p.text));

    if (newPatterns.length === 0) {
      logHook('pattern-sync-pull', 'All global patterns already in project');
      return;
    }

    // Add new patterns
    const mergedPatterns = [...projectList, ...newPatterns];
    projectPatterns.patterns = mergedPatterns;

    // Ensure directory exists
    mkdirSync(`${projectDir}/.claude/feedback`, { recursive: true });

    // Write updated patterns
    writeFileSync(projectPatternsFile, JSON.stringify(projectPatterns, null, 2));
    logHook('pattern-sync-pull', `Pulled ${newPatterns.length} new patterns from global`);
  } catch (err) {
    logHook('pattern-sync-pull', `Failed to pull global patterns: ${err}`);
  }
}

/**
 * Pattern sync pull hook
 */
export function patternSyncPull(input: HookInput): HookResult {
  // Bypass if slow hooks are disabled
  if (shouldSkipSlowHooks()) {
    logHook('pattern-sync-pull', 'Skipping pattern sync (ORCHESTKIT_SKIP_SLOW_HOOKS=1)');
    return outputSilentSuccess();
  }

  const projectDir = input.project_dir || getProjectDir();

  // Check if sync is enabled
  if (!isSyncEnabled(projectDir)) {
    logHook('pattern-sync-pull', 'Global sync disabled, skipping pull');
    return outputSilentSuccess();
  }

  // Check file sizes
  const home2 = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const globalPatternsFile = `${home2}/.claude/global-patterns.json`;
  const projectPatternsFile = `${projectDir}/.claude/feedback/learned-patterns.json`;

  if (!checkFileSize(globalPatternsFile) || !checkFileSize(projectPatternsFile)) {
    logHook('pattern-sync-pull', 'Skipping pattern sync due to large files');
    return outputSilentSuccess();
  }

  // Pull global patterns
  logHook('pattern-sync-pull', 'Pulling global patterns...');
  pullGlobalPatterns(projectDir);
  logHook('pattern-sync-pull', 'Global patterns pulled successfully');

  return outputSilentSuccess();
}
