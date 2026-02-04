/**
 * Cross-platform path utilities for TypeScript hooks
 *
 * Provides consistent path handling across Windows, macOS, and Linux.
 * All path construction uses path.join() for correct separators.
 * All temp directories use os.tmpdir() for platform awareness.
 */

import os from 'node:os';
import path from 'node:path';

/**
 * Get the user's home directory (cross-platform)
 * Prefers explicit env vars, falls back to os.homedir()
 */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

/**
 * Get the system temp directory (cross-platform)
 * Returns /tmp on Unix, C:\Users\X\AppData\Local\Temp on Windows
 */
export function getTempDir(): string {
  return os.tmpdir();
}

/**
 * Get the project directory from environment
 */
export function getProjectDir(): string {
  return process.env.CLAUDE_PROJECT_DIR || '.';
}

/**
 * Get the plugin root directory from environment
 */
export function getPluginRoot(): string {
  return process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_PROJECT_DIR || '.';
}

/**
 * Get the log directory path (cross-platform)
 * Uses path.join() for correct separators on all platforms
 */
export function getLogDir(): string {
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return path.join(getHomeDir(), '.claude', 'logs', 'ork');
  }
  return path.join(getProjectDir(), '.claude', 'logs');
}

/**
 * Get the memory directory path (cross-platform)
 */
export function getMemoryDir(): string {
  return path.join(getProjectDir(), '.claude', 'memory');
}

/**
 * Get the coordination directory path (cross-platform)
 */
export function getCoordinationDir(): string {
  return path.join(getProjectDir(), '.claude', 'coordination');
}

/**
 * Normalize a path for consistent comparison
 * Converts backslashes to forward slashes and removes trailing slashes
 */
export function normalizePath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/').replace(/\/$/, '');
}

/**
 * Check if a path is absolute
 */
export function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p);
}

/**
 * Join path segments (cross-platform)
 * Re-export for convenience
 */
export const joinPath = path.join;

/**
 * Get path separator for current platform
 */
export const pathSeparator = path.sep;
