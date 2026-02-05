/**
 * Release Lock on Commit - PostToolUse Hook
 * Releases file locks after successful git commit
 *
 * Triggers on: Bash with git commit that succeeded
 * Action: Release locks on committed files
 * CC 2.1.7 Compliant: Proper JSON output
 *
 * Version: 1.0.1
 * Part of Multi-Worktree Coordination System
 */

import { existsSync } from 'node:fs';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getProjectDir } from '../../lib/common.js';

/**
 * Release file locks after Write operations
 * Note: This hook is for Write tool - locks are released on session end or explicit release
 */
export function releaseLockOnCommit(_input: HookInput): HookResult {
  const projectDir = getProjectDir();
  const coordLib = `${projectDir}/.claude/coordination/lib/coordination.sh`;

  // Check if coordination lib exists
  if (!existsSync(coordLib)) {
    return outputSilentSuccess();
  }

  // This hook runs after Write tool - we don't release locks here
  // Locks are released on session end or explicit release
  // The coordination system handles auto-expiration of stale locks

  return outputSilentSuccess();
}
