/**
 * File Lock Release - Release locks after successful Write/Edit
 * CC 2.1.7 Compliant: Self-contained hook with stdin reading and self-guard
 * Hook: PostToolUse (Write|Edit)
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir, getSessionId, logHook } from '../../lib/common.js';

/**
 * Check if multi-instance coordination is enabled
 */
function isMultiInstanceEnabled(): boolean {
  try {
    execSync('which sqlite3', { stdio: 'ignore', timeout: 2000 });
    const projectDir = getProjectDir();
    const dbPath = `${projectDir}/.claude/coordination/.claude.db`;
    return existsSync(dbPath);
  } catch {
    return false;
  }
}

/**
 * Release file lock in coordination database
 */
function releaseFileLock(filePath: string, instanceId: string): boolean {
  const projectDir = getProjectDir();
  const dbPath = `${projectDir}/.claude/coordination/.claude.db`;

  if (!existsSync(dbPath)) {
    return false;
  }

  try {
    // Escape single quotes for SQLite
    const escapedPath = filePath.replace(/'/g, "''");
    const escapedInstance = instanceId.replace(/'/g, "''");

    execSync(
      `sqlite3 "${dbPath}" "DELETE FROM file_locks WHERE file_path = '${escapedPath}' AND instance_id = '${escapedInstance}';"`,
      { stdio: 'ignore', timeout: 5000 }
    );

    logHook('file-lock-release', `Released lock for ${filePath}`);
    return true;
  } catch (error) {
    logHook('file-lock-release', `Failed to release lock for ${filePath}: ${error}`);
    return false;
  }
}

/**
 * Get instance ID from environment or session
 */
function getInstanceId(): string {
  // Check environment first
  if (process.env.INSTANCE_ID) {
    return process.env.INSTANCE_ID;
  }

  // Check instance env file
  const projectDir = getProjectDir();
  const instanceEnv = `${projectDir}/.claude/.instance_env`;

  if (existsSync(instanceEnv)) {
    try {
      const content = readFileSync(instanceEnv, 'utf8');
      const match = content.match(/CLAUDE_INSTANCE_ID=["']?([^"'\n]+)/);
      if (match) {
        return match[1];
      }
    } catch {
      // Ignore read errors
    }
  }

  // Fall back to session ID
  return getSessionId();
}

/**
 * Release file locks after Write/Edit operations
 */
export function fileLockRelease(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Self-guard: Only run for Write/Edit
  if (toolName !== 'Write' && toolName !== 'Edit') {
    return outputSilentSuccess();
  }

  // Self-guard: Only run if multi-instance coordination is enabled
  if (!isMultiInstanceEnabled()) {
    return outputSilentSuccess();
  }

  // Get file path
  const filePath = getField<string>(input, 'tool_input.file_path') || '';

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Skip coordination directory files
  if (filePath.includes('/.claude/coordination/')) {
    return outputSilentSuccess();
  }

  // Check for errors in tool result
  const toolResult = String(getField<unknown>(input, 'tool_result') || '');
  if (toolResult.includes('error') || toolResult.includes('Error')) {
    // Keep lock on error, will auto-expire
    return outputSilentSuccess();
  }

  // Release lock
  const instanceId = getInstanceId();
  releaseFileLock(filePath, instanceId);

  return outputSilentSuccess();
}
