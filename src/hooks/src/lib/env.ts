/**
 * Environment readers — effectful functions that read process.env or spawn child processes.
 * Extracted from common.ts for separation of pure vs. effectful code.
 */

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  getLogDir as getLogDirFromPaths,
  getProjectDir as getProjectDirFromPaths,
  getPluginRoot as getPluginRootFromPaths,
  getPluginDataDir as getPluginDataDirFromPaths,
} from './paths.js';
import { getOrGenerateSessionId } from './session-id-generator.js';

// -----------------------------------------------------------------------------
// Environment and Paths
// All functions read env vars dynamically to support testing
// Re-export from paths.ts for cross-platform compatibility
// -----------------------------------------------------------------------------

/**
 * Get the log directory path (cross-platform)
 * Delegates to paths.ts for correct path handling on all platforms
 */
export function getLogDir(): string {
  return getLogDirFromPaths();
}

/**
 * Get the project directory (cross-platform)
 * Delegates to paths.ts for correct path handling on all platforms
 */
export function getProjectDir(): string {
  return getProjectDirFromPaths();
}

/**
 * Get the plugin root directory (cross-platform)
 * Delegates to paths.ts for correct path handling on all platforms
 */
export function getPluginRoot(): string {
  return getPluginRootFromPaths();
}

/**
 * Get the plugin persistent data directory (CC 2.1.78)
 * Returns null if CLAUDE_PLUGIN_DATA is not set (CC < 2.1.78)
 */
export function getPluginDataDir(): string | null {
  return getPluginDataDirFromPaths();
}

/**
 * Get the environment file path (CC 2.1.25: CLAUDE_ENV_FILE support)
 * Falls back to .instance_env for backward compatibility
 */
export function getEnvFile(): string {
  if (process.env.CLAUDE_ENV_FILE) {
    return process.env.CLAUDE_ENV_FILE;
  }
  // Fallback to legacy .instance_env
  const pluginRoot = getPluginRoot();
  return `${pluginRoot}/.claude/.instance_env`;
}

/**
 * Get the session ID
 *
 * Resolution order:
 * 1. CLAUDE_SESSION_ID env var (from CC runtime - preferred)
 * 2. Cached session ID (from .instance/session-id.json)
 * 3. Generate smart session ID: {project}-{branch}-{MMDD}-{HHMM}-{hash4}
 *
 * Example smart ID: "orchestkit-main-0130-1745-a3f2"
 *
 * The old fallback format "fallback-{pid}-{timestamp}" was confusing and unhelpful.
 * Smart IDs are human-readable, showing project, branch, and time context.
 */
export function getSessionId(): string {
  return getOrGenerateSessionId();
}

/**
 * Get cached git branch (set at session start or first call)
 * Caches result in process.env to avoid repeated execSync calls
 */
export function getCachedBranch(projectDir?: string): string {
  if (process.env.ORCHESTKIT_BRANCH) {
    return process.env.ORCHESTKIT_BRANCH;
  }

  try {
    const branch = execFileSync('git', ['branch', '--show-current'], {
      cwd: projectDir || getProjectDir(),
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    process.env.ORCHESTKIT_BRANCH = branch;
    return branch;
  } catch {
    return 'unknown';
  }
}

/**
 * Detect if the project directory is inside a linked git worktree.
 * A linked worktree has `.git` as a file (containing "gitdir: ...") rather than a directory.
 * Caches result in process.env to avoid repeated stat calls (CC 2.1.97).
 */
export function isGitWorktree(projectDir?: string): boolean {
  if (process.env.ORCHESTKIT_IS_WORKTREE !== undefined) {
    return process.env.ORCHESTKIT_IS_WORKTREE === '1';
  }

  try {
    const dir = projectDir || getProjectDir();
    const gitPath = join(dir, '.git');
    // In a linked worktree, .git is a file, not a directory
    const stat = statSync(gitPath);
    const isWorktree = stat.isFile();
    process.env.ORCHESTKIT_IS_WORKTREE = isWorktree ? '1' : '0';
    return isWorktree;
  } catch {
    process.env.ORCHESTKIT_IS_WORKTREE = '0';
    return false;
  }
}

/**
 * Get log level (debug|info|warn|error, default: warn)
 *
 * Resolution order (first match wins):
 * 1. ORCHESTKIT_LOG_LEVEL env var (explicit override)
 * 2. CLAUDE_DEBUG env var (CC 2.1.71 /debug toggle → auto-enable debug)
 * 3. ORK_DEBUG env var (set via CLAUDE_ENV_FILE by ConfigChange or failure-handler)
 * 4. Debug flag file (~/.claude/logs/ork/debug-mode.flag) — fallback for hooks
 *    on events that don't receive CLAUDE_ENV_FILE propagated vars
 * 5. Default: 'warn'
 */
export function getLogLevel(): string {
  // Explicit override always wins
  if (process.env.ORCHESTKIT_LOG_LEVEL) {
    return process.env.ORCHESTKIT_LOG_LEVEL;
  }

  // CC 2.1.71: /debug toggle sets CLAUDE_DEBUG
  if (process.env.CLAUDE_DEBUG) {
    return 'debug';
  }

  // CLAUDE_ENV_FILE propagated: ORK_DEBUG set by ConfigChange or failure-handler
  if (process.env.ORK_DEBUG) {
    return 'debug';
  }

  // Flag file fallback: for hooks on events that don't inherit env file vars
  try {
    const flagPath = join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.claude', 'logs', 'ork', 'debug-mode.flag',
    );
    if (existsSync(flagPath)) {
      return 'debug';
    }
  } catch {
    // Ignore — never crash on flag check
  }

  return 'warn';
}

/**
 * Check if should log at given level
 */
export function shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
  const levels = ['debug', 'info', 'warn', 'error'];
  return levels.indexOf(level) >= levels.indexOf(getLogLevel());
}
