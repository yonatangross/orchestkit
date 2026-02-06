/**
 * File Lock Release - Release locks after successful Write/Edit
 * CC 2.1.7 Compliant: Self-contained hook with stdin reading and self-guard
 * Hook: PostToolUse (Write|Edit)
 *
 * Issue #361: Uses shared file-lock utilities from lib/file-lock.ts
 * Now uses atomic writes (temp+rename) via shared saveLocks.
 */

import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir, logHook } from '../../lib/common.js';
import { getOrGenerateSessionId } from '../../lib/session-id-generator.js';
import {
  getLocksFilePath,
  isCoordinationEnabled,
  loadLocks,
  saveLocks,
  cleanExpiredLocks,
} from '../../lib/file-lock.js';

/**
 * Get current instance ID using unified session ID resolution.
 *
 * Priority (via getOrGenerateSessionId):
 * 1. CLAUDE_SESSION_ID env var (from CC runtime)
 * 2. Cached session ID (from .instance/session-id.json)
 * 3. Smart session ID: {project}-{branch}-{MMDD}-{HHMM}-{hash4}
 *
 * Example: "orchestkit-main-0130-1745-a3f2"
 */
function getInstanceId(): string {
  return getOrGenerateSessionId();
}

/**
 * Release file lock from locks.json
 */
function releaseFileLock(locksPath: string, filePath: string, instanceId: string): boolean {
  try {
    const data = loadLocks(locksPath);
    const originalCount = data.locks.length;

    // Clean expired locks AND remove matching lock
    data.locks = cleanExpiredLocks(data.locks).filter(
      l => !(l.file_path === filePath && l.instance_id === instanceId)
    );

    if (data.locks.length < originalCount) {
      saveLocks(locksPath, data);
      logHook('file-lock-release', `Released lock for ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    logHook('file-lock-release', `Failed to release lock for ${filePath}: ${error}`);
    return false;
  }
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

  const projectDir = getProjectDir();

  // Self-guard: Only run if coordination is enabled
  if (!isCoordinationEnabled(projectDir)) {
    return outputSilentSuccess();
  }

  // Get file path
  const filePath = getField<string>(input, 'tool_input.file_path') || '';

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Skip coordination directory files
  if (filePath.includes('/.claude/coordination/') || filePath.includes('.claude/coordination')) {
    return outputSilentSuccess();
  }

  // Normalize path (match multi-instance-lock.ts behavior)
  const normalizedPath = filePath.startsWith(projectDir)
    ? filePath.slice(projectDir.length + 1)
    : filePath;

  // Release lock regardless of result (lock should be released even on error)
  const locksPath = getLocksFilePath(projectDir);
  const instanceId = getInstanceId();
  releaseFileLock(locksPath, normalizedPath, instanceId);

  return outputSilentSuccess();
}
