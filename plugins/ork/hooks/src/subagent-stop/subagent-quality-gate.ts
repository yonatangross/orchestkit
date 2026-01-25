/**
 * Subagent Quality Gate - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Validates subagent output quality.
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWarning, logHook } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const METRICS_FILE = '/tmp/claude-session-metrics.json';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

interface Metrics {
  errors: number;
  [key: string]: unknown;
}

function incrementErrorCount(): void {
  if (!existsSync(METRICS_FILE)) {
    return;
  }

  try {
    const metrics: Metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf8'));
    metrics.errors = (metrics.errors || 0) + 1;
    writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function subagentQualityGate(input: HookInput): HookResult {
  const agentId = input.agent_id || '';
  const subagentType = input.subagent_type || '';
  const error = input.error || '';

  logHook('subagent-quality-gate', `Quality gate check: ${subagentType} (${agentId})`);

  // Check if subagent had errors
  if (error && error !== 'null') {
    logHook('subagent-quality-gate', `ERROR: Subagent failed - ${error}`);

    // Track error count
    incrementErrorCount();

    return outputWarning(`Subagent ${subagentType} failed: ${error}`);
  }

  return outputSilentSuccess();
}
