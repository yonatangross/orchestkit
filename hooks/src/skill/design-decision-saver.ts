/**
 * Design Decision Saver Hook
 * Runs on Stop for brainstorming skill
 * Reminds to save design decisions to context - silent operation
 * CC 2.1.7 Compliant
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getLogDir } from '../lib/common.js';

/**
 * Log design decision reminder on session stop
 */
export function designDecisionSaver(_input: HookInput): HookResult {
  const logDir = getLogDir();
  const logFile = `${logDir}/design-decision.log`;

  // Ensure log directory exists
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // Ignore
  }

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const logContent = `[${timestamp}] Brainstorming Complete
Recommended next steps:
  1. Save key decisions to knowledge/decisions/active.json
  2. Create ADR if architectural decision was made
  3. Break down into implementation tasks

Consider using these skills next:
  - /architecture-decision-record (document decisions)
  - /api-design-framework (if API was designed)
  - /database-schema-designer (if schema was designed)
`;

  // Write to log file (silent operation)
  try {
    appendFileSync(logFile, logContent + '\n');
  } catch {
    // Ignore logging errors
  }

  return outputSilentSuccess();
}
