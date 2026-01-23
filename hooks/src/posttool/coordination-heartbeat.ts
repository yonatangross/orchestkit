/**
 * Coordination Heartbeat - Update heartbeat after each tool use
 * Hook: PostToolUse (*)
 * CC 2.1.6 Compliant: ensures JSON output on all code paths
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir, logHook } from '../lib/common.js';

/**
 * Update coordination heartbeat
 */
export function coordinationHeartbeat(_input: HookInput): HookResult {
  const projectDir = getProjectDir();
  const coordLib = `${projectDir}/.claude/coordination/lib/coordination.sh`;

  // Check if coordination lib exists
  if (!existsSync(coordLib)) {
    return outputSilentSuccess();
  }

  try {
    // Load instance ID if available
    const instanceEnv = `${projectDir}/.claude/.instance_env`;
    let instanceId = process.env.CLAUDE_SESSION_ID || '';

    if (existsSync(instanceEnv)) {
      const content = readFileSync(instanceEnv, 'utf8');
      const match = content.match(/CLAUDE_INSTANCE_ID=["']?([^"'\n]+)/);
      if (match) {
        instanceId = match[1];
      }
    }

    // Update heartbeat (lightweight operation)
    if (instanceId) {
      execSync(
        `source "${coordLib}" && INSTANCE_ID="${instanceId}" coord_heartbeat 2>/dev/null || true`,
        {
          shell: '/bin/bash',
          stdio: 'ignore',
          timeout: 5000,
        }
      );
    }
  } catch (error) {
    // Coordination update failed, but don't block execution
    logHook('coordination-heartbeat', `Heartbeat update failed: ${error}`);
  }

  return outputSilentSuccess();
}
