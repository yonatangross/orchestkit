/**
 * Multi-Instance Quality Gate Hook
 * Enforces quality checks in multi-instance scenarios
 * CC 2.1.9: Injects quality gate context via additionalContext
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { isAgentTeamsActive } from '../../lib/agent-teams.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Check if multi-instance coordination is enabled
 */
function isMultiInstanceEnabled(projectDir: string): boolean {
  const dbPath = join(projectDir, '.claude', 'coordination', '.claude.db');
  return existsSync(dbPath);
}

/**
 * Get quality gate status from work registry
 */
function getQualityGateStatus(projectDir: string): Record<string, boolean> {
  const registryPath = join(projectDir, '.claude', 'coordination', 'work-registry.json');

  try {
    if (existsSync(registryPath)) {
      const data = JSON.parse(readFileSync(registryPath, 'utf8'));
      return data.qualityGates || {};
    }
  } catch {
    // Ignore
  }

  return {};
}

/**
 * Enforce quality gates before merge/deploy in multi-instance mode
 */
export function multiInstanceQualityGate(input: HookInput, ctx?: HookContext): HookResult {
  // Issue #362: Yield to CC Agent Teams when active
  if (isAgentTeamsActive()) {
    return outputSilentSuccess();
  }

  const command = input.tool_input.command || '';
  const projectDir = ctx?.projectDir ?? getProjectDir();

  // Only process merge/deploy commands
  if (!/gh\s+pr\s+merge|git\s+merge|deploy/.test(command)) {
    return outputSilentSuccess();
  }

  // Check if multi-instance is enabled
  if (!isMultiInstanceEnabled(projectDir)) {
    return outputSilentSuccess();
  }

  // Get quality gate status
  const gates = getQualityGateStatus(projectDir);

  // Check required gates
  const requiredGates = ['tests', 'lint', 'typecheck'];
  const failedGates = requiredGates.filter((gate) => !gates[gate]);

  if (failedGates.length > 0) {
    const context = `Multi-instance quality gate check:
Failed/missing gates: ${failedGates.join(', ')}

Run these checks before merging:
${failedGates.map((g) => `- npm run ${g}`).join('\n')}

Quality gates ensure consistency across instances.`;

    (ctx?.logPermission ?? logPermissionFeedback)('allow', `Quality gates failed: ${failedGates.join(', ')}`, input);
    (ctx?.log ?? logHook)('multi-instance-quality-gate', `Failed: ${failedGates.join(', ')}`);
    return outputAllowWithContext(context);
  }

  // All gates passed
  (ctx?.logPermission ?? logPermissionFeedback)('allow', 'All quality gates passed', input);
  return outputSilentSuccess();
}
